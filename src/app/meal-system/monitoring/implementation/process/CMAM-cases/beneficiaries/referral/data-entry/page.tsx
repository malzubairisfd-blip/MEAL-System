
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Loader2, Search, ThumbsUp, Check, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// --- Types ---
interface Project { projectId: string; projectName: string; }
interface HealthCenter { hc_id: string; hc_name: string; }
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; hc_id: string; [key: string]: any; }

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

// --- Zod Schema ---
const formSchema = z.object({
  bnf_attend_c: z.enum(['نعم', 'لا']),
  not_attend_reason_c: z.string().optional(),
  date_attend_c_day: z.string().optional(),
  date_attend_c_month: z.string().optional(),
  date_attend_c_year: z.string().optional(),
  bnf_isprev_ref_c: z.enum(['نعم', 'لا']).optional(),
  hc_muac_c_no: z.number().optional(), // For NO malnutrition (23 to 30)
  cmam_result_c_no: z.string().optional(),
  hc_muac_c: z.number().optional(), // For YES malnutrition (17 to 26)
  cmam_result_c: z.string().optional(),
}).refine(data => {
    if (data.bnf_attend_c === 'نعم') {
        return !!data.bnf_isprev_ref_c;
    }
    return true;
}, { message: "This field is required.", path: ["bnf_isprev_ref_c"] });


export default function EnhancedReferralDataEntryPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [config, setConfig] = useState({ projectId: '', followUpCycle: 1, followUpMonth: '' });
    const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    
    const [selectedHealthCenterId, setSelectedHealthCenterId] = useState("");
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | null>(null);
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    
    const [loading, setLoading] = useState({ projects: true, config: true, data: false, saving: false });
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { hc_muac_c_no: 23, hc_muac_c: 17 }
    });

    const watchAttend = form.watch("bnf_attend_c");
    const watchHasMalnutrition = form.watch("bnf_isprev_ref_c");
    
    const [healthCenterPopoverOpen, setHealthCenterPopoverOpen] = useState(false);

    // --- Data Fetching (Restored Promise.all block) ---
    useEffect(() => {
        setLoading(p => ({...p, projects: true, config: true}));
        Promise.all([
            fetch('/api/projects').then(res => res.json()),
            fetch('/api/bnf-referral-cycle').then(res => res.json())
        ]).then(([projData, confData]) => {
            setProjects(projData);
            setConfig(confData);
            if(confData.projectId) handleProjectSelect(confData.projectId, confData);
        }).finally(() => setLoading(p => ({...p, projects: false, config: false})));
    }, []);

    const handleProjectSelect = useCallback(async (projectId: string, currentConfig = config) => {
        setConfig(prev => ({...prev, projectId}));
        setSelectedHealthCenterId("");
        setSelectedBeneficiaryId(null);
        
        if (!projectId) {
            setHealthCenters([]);
            setBeneficiaries([]);
            return;
        }

        setLoading(p => ({...p, data: true}));
        try {
            const res = await fetch(`/api/bnf-cmam?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to load CMAM data.");
            const allBnfs = await res.json();
            
            const cycle = currentConfig.followUpCycle;
            const qualifiedBnfs = allBnfs.filter((b: any) => {
                 if (cycle === 1) return b.bnf_has_cmam_hc === 'نعم' && (b.next_cycle_c1 === 'Qualified' || !b.next_cycle_c1 || b.next_cycle_c1 === 'Last Month Qualification');
                 if (cycle === 2) return b.next_cycle_c2 === 'Qualified' || b.next_cycle_c2 === 'Last Month Qualification';
                 if (cycle === 3) return b.next_cycle_c3 === 'Qualified' || b.next_cycle_c3 === 'Last Month Qualification';
                 return false;
            });

            setBeneficiaries(qualifiedBnfs);
            const uniqueHCs: HealthCenter[] = Array.from(new Map(qualifiedBnfs.map((item: any) => [item.hc_id, { hc_id: item.hc_id, hc_name: item.hc_name }])).values());
            setHealthCenters(uniqueHCs);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, data: false}));
        }
    }, [toast, config]);

    // --- Filtering ---
    const filteredHCs = useMemo(() => {
        if (!beneficiarySearch) return healthCenters;
        return healthCenters.filter(hc => hc.hc_name.toLowerCase().includes(beneficiarySearch.toLowerCase()));
    }, [healthCenters, beneficiarySearch]);

    const filteredBeneficiaries = useMemo(() => {
        let filtered = beneficiaries;
        if (selectedHealthCenterId) {
            filtered = filtered.filter(b => b.hc_id === selectedHealthCenterId);
        }
        if (beneficiarySearch) {
            const lowerSearch = beneficiarySearch.toLowerCase();
            filtered = filtered.filter(b => 
                String(b.BENEF_ID).toLowerCase().includes(lowerSearch) || 
                b.BENEF_NAME.toLowerCase().includes(lowerSearch)
            );
        }
        return filtered;
    }, [beneficiaries, selectedHealthCenterId, beneficiarySearch]);

    // --- Form Logic ---
    const moveToNextBeneficiary = useCallback(() => {
        form.reset({
            bnf_attend_c: undefined,
            not_attend_reason_c: '',
            bnf_isprev_ref_c: undefined,
            hc_muac_c_no: 23,
            hc_muac_c: 17
        });
        const currentIndex = filteredBeneficiaries.findIndex(b => b.id === selectedBeneficiaryId);
        if (currentIndex !== -1 && currentIndex < filteredBeneficiaries.length - 1) {
            setSelectedBeneficiaryId(filteredBeneficiaries[currentIndex + 1].id);
        } else {
             toast({ title: "End of List", description: "All beneficiaries in this list have been reviewed." });
             setSelectedBeneficiaryId(null);
        }
    }, [filteredBeneficiaries, selectedBeneficiaryId, form, toast]);

    const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!selectedBeneficiaryId) return;

        setLoading(p => ({...p, saving: true}));

        const payload: any = {
            id: selectedBeneficiaryId,
            conf_date: `${data.conf_date_year}-${data.conf_date_month}-${data.conf_date_day}`,
            attend_hc: data.attend_hc,
        };

        if (data.attend_hc === 'لا') {
            payload.not_attend_reason_c = data.not_attend_reason_c;
        } else {
            payload.bnf_has_cmam_hc = data.bnf_has_cmam_hc;
            if (data.bnf_has_cmam_hc === 'لا') {
                payload.hc_muac = data.hc_muac_c_no;
            } else {
                payload.hc_card_no = data.hc_card_no;
                payload.bnf_cmam_cond = data.bnf_cmam_cond;
                payload.bnf_preg_mon = data.bnf_preg_mon;
                payload.bnf_child_age = data.bnf_child_age;
                payload.hc_muac = data.hc_muac_c;
                payload.exp_start_treat_date = `${data.exp_start_treat_date_year}-${data.exp_start_treat_date_month}-${data.exp_start_treat_date_day}`;
                payload.exp_end_treat_date = `${data.exp_end_treat_date_year}-${data.exp_end_treat_date_month}-${data.exp_end_treat_date_day}`;
                payload.not_attend_reason_c = data.cmam_result_c; // Re-using field
            }
        }
        
        try {
            await fetch('/api/bnf-cmam', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([payload])
            });
            
            toast({ title: "Success", description: "Record updated successfully."});
            moveToNextBeneficiary();
        } catch(err: any) {
            toast({ title: "Save Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };


    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-3">
                    <ThumbsUp className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">إدخال بيانات إحالة المستفيدات</h1>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="hover:bg-slate-100" asChild>
                        <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/cycles"><ArrowLeft className="mr-2 h-4 w-4"/>العودة</Link>
                    </Button>
                    <Button variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" asChild>
                        <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/database"><Database className="mr-2 h-4 w-4"/>Beneficiaries CMAM Database</Link>
                    </Button>
                    <Button variant="default" className="shadow-md" asChild>
                        <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/export"><FileText className="mr-2 h-4 w-4"/>Exporting Beneficiaries Referral Statements</Link>
                    </Button>
                </div>
            </div>

            {/* Project & Cycle Configuration */}
            <Card>
                <CardHeader><CardTitle>1. حدد المشروع</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <Select onValueChange={(v) => handleProjectSelect(v)} value={config.projectId}><SelectTrigger><SelectValue placeholder="اختر المشروع..." /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent></Select>
                    <Input value={`دورة المتابعة: ${config.followUpCycle}`} readOnly className="bg-muted"/>
                    <Input value={`شهر المتابعة: ${config.followUpMonth}`} readOnly className="bg-muted"/>
                </CardContent>
            </Card>

            {config.projectId && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle>اختيار المستفيدة</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                             <Label>اختر المركز الصحي</Label>
                             <Popover open={healthCenterPopoverOpen} onOpenChange={setHealthCenterPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={healthCenterPopoverOpen} className="w-full justify-between disabled:opacity-50" disabled={!config.projectId}>
                                        {selectedHealthCenterId ? healthCenters.find((hc) => hc.hc_id === selectedHealthCenterId)?.hc_name : "اختر المركز..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <Command>
                                        <CommandInput placeholder="ابحث عن المركز الصحي..." />
                                        <CommandList>
                                            <CommandEmpty>لم يتم العثور على مركز صحي.</CommandEmpty>
                                            <CommandGroup>
                                                <ScrollArea className="h-[200px]">
                                                    {filteredHCs.map((hc) => (
                                                        <CommandItem
                                                            key={hc.hc_id}
                                                            value={hc.hc_name}
                                                            onSelect={() => {
                                                                setSelectedHealthCenterId(hc.hc_id);
                                                                setHealthCenterPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selectedHealthCenterId === hc.hc_id ? "opacity-100" : "opacity-0")} />
                                                            {hc.hc_name} ({hc.hc_id})
                                                        </CommandItem>
                                                    ))}
                                                </ScrollArea>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        {selectedHealthCenterId && (
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input placeholder="بحث بالاسم او رقم المستفيدة..." className="pl-9" value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} />
                                </div>
                                <ScrollArea className="h-96 mt-4 border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="w-[60px] text-center font-bold text-white">تحديد</TableHead>
                                                <TableHead className="font-bold text-white">ID</TableHead>
                                                <TableHead className="font-bold text-white">اسم المستفيدة</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {filteredBeneficiaries.map(b => (
                                            <TableRow key={b.id} onClick={() => setSelectedBeneficiaryId(b.id)} className={cn("cursor-pointer", selectedBeneficiaryId === b.id && 'bg-primary/10')}>
                                                <TableCell><Checkbox checked={selectedBeneficiaryId === b.id} /></TableCell>
                                                <TableCell>{b.BENEF_ID}</TableCell><TableCell>{b.BENEF_NAME}</TableCell>
                                            </TableRow>
                                        ))}</TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className={cn("lg:col-span-2", !selectedBeneficiaryId && "opacity-50 pointer-events-none")}>
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                        <CardHeader><CardTitle>Confirmation Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>تاريخ تأكيد الحالة</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField control={form.control} name="conf_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="conf_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="conf_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div>
                            </div>

                            <FormField control={form.control} name="bnf_attend_c" render={({ field }) => (
                                <FormItem><FormLabel>هل امتثلت المستفيدة الى المركز الصحي؟</FormLabel>
                                <FormControl><div className="flex gap-4 pt-2">
                                    <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                    <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                                </div></FormControl><FormMessage /></FormItem>
                            )} />

                            {watchAttend === 'لا' && (
                                <>
                                <FormField control={form.control} name="not_attend_reason_c" render={({ field }) => (
                                    <FormItem><FormLabel>سبب عدم الحضور</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                                )} />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                                </>
                            )}

                            {watchAttend === 'نعم' && (
                                <FormField control={form.control} name="bnf_isprev_ref_c" render={({ field }) => (
                                    <FormItem><FormLabel>هل تعاني المستفيدة من سوء تغذية؟</FormLabel>
                                    <FormControl><div className="flex gap-4 pt-2">
                                        <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                        <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                                    </div></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                            
                             {watchAttend === 'نعم' && watchHasMalnutrition === 'لا' && (
                                <>
                                <FormField control={form.control} name="hc_muac_c_no" render={({ field }) => (
                                <FormItem><FormLabel>قياس المواك: {field.value || 23}</FormLabel>
                                <FormControl><Slider min={23} max={30} step={0.1} value={[field.value || 23]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>
                                )} />
                                 <FormField control={form.control} name="cmam_result_c_no" render={({ field }) => (
                                    <FormItem><FormLabel>نتيجة المتابعة</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر النتيجة..."/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {["شفاء", "تخلف", "الوفاة", "عدم استجابة", "انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                    </SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                                </>
                             )}

                            {watchAttend === 'نعم' && watchHasMalnutrition === 'نعم' && (
                            <>
                                <FormField control={form.control} name="hc_muac_c" render={({ field }) => (
                                <FormItem><FormLabel>قياس المواك: {field.value || 17}</FormLabel>
                                <FormControl><Slider min={17} max={26} step={0.1} value={[field.value || 17]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField
                                    control={form.control}
                                    name="cmam_result_c"
                                    render={({ field }) => (
                                    <FormItem><FormLabel>حالة المتابعه</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر الحالة..."/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="مستمر بالمعالجة">مستمر بالمعالجة</SelectItem>
                                        <SelectItem value="شفاء">شفاء</SelectItem>
                                        <SelectItem value="تخلف">تخلف</SelectItem>
                                        <SelectItem value="الوفاة">الوفاة</SelectItem>
                                        <SelectItem value="عدم استجابة">عدم استجابة</SelectItem>
                                        <SelectItem value="انتهاء فترة الدعم / تخريج من برنامج سوء التغذية">انتهاء فترة الدعم / تخريج من برنامج سوء التغذية</SelectItem>
                                    </SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                            </>
                            )}
                        </CardContent>
                    </form>
                    </Form>
                </Card>}
            </div>
            )}
        </div>
    );
}

