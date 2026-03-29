// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/entry/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
interface HealthCenter { hc_id: string; hc_name: string; hw_id: string; hw_name: string;}
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; hc_id: string; [key: string]: any; }

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

// --- Zod Schema ---
const formSchema = z.object({
  attend_hc: z.enum(['نعم', 'لا']),
  conf_date_day: z.string().optional(),
  conf_date_month: z.string().optional(),
  conf_date_year: z.string().optional(),
  
  // 'No' branch
  not_attend_reason: z.string().optional(),

  // 'Yes' branch
  bnf_has_cmam_hc: z.enum(['نعم', 'لا']).optional(),

  // 'Yes' -> 'No' sub-branch
  hc_muac_no: z.number().optional(),

  // 'Yes' -> 'Yes' sub-branch
  hc_card_no: z.string().optional(),
  bnf_cmam_cond: z.enum(['حامل', 'مرضع']).optional(),
  bnf_preg_mon: z.string().optional(),
  bnf_child_age: z.string().optional(),
  hc_muac_yes: z.number().optional(),
  exp_start_treat_date_day: z.string().optional(),
  exp_start_treat_date_month: z.string().optional(),
  exp_start_treat_date_year: z.string().optional(),
  exp_end_treat_date_day: z.string().optional(),
  exp_end_treat_date_month: z.string().optional(),
  exp_end_treat_date_year: z.string().optional(),
  follow_up_status: z.string().optional(),
}).refine(data => {
    if (data.attend_hc === 'نعم') {
        return !!data.bnf_has_cmam_hc;
    }
    return true;
}, { message: "This field is required.", path: ["bnf_has_cmam_hc"] })
.refine(data => {
    if (data.attend_hc === 'نعم' && data.bnf_has_cmam_hc === 'نعم') {
        return !!data.bnf_cmam_cond;
    }
    return true;
}, { message: "This field is required.", path: ["bnf_cmam_cond"] });


export default function ConfirmationDataEntryPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedHealthCenterId, setSelectedHealthCenterId] = useState("");
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | null>(null);
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            attend_hc: undefined,
            conf_date_day: "",
            conf_date_month: "",
            conf_date_year: "",
            bnf_has_cmam_hc: undefined,
            hc_muac_no: 25,
            hc_muac_yes: 17,
            not_attend_reason: "",
            bnf_cmam_cond: undefined,
            hc_card_no: "",
            bnf_preg_mon: "1",
            bnf_child_age: "1",
            exp_start_treat_date_day: "",
            exp_start_treat_date_month: "",
            exp_start_treat_date_year: "",
            exp_end_treat_date_day: "",
            exp_end_treat_date_month: "",
            exp_end_treat_date_year: "",
            follow_up_status: ""
        }
    });

    const watchAttendHC = form.watch("attend_hc");
    const watchHasCmamHC = form.watch("bnf_has_cmam_hc");
    const watchBnfCmamCond = form.watch("bnf_cmam_cond");
    
    const [healthCenterPopoverOpen, setHealthCenterPopoverOpen] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        setLoading(p => ({...p, projects: true}));
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({...p, projects: false})));
    }, []);

    useEffect(() => {
        if (!selectedProjectId) { setHealthCenters([]); setBeneficiaries([]); return; }
        setLoading(p => ({...p, data: true}));
        fetch(`/api/bnf-cmam?projectId=${selectedProjectId}`)
          .then(res => res.json())
          .then(data => {
              const qualifiedBnfs = data.filter((b: any) => b.bnf_has_cmam === 'نعم');
              setBeneficiaries(qualifiedBnfs);
              const uniqueHCs: HealthCenter[] = Array.from(new Map(qualifiedBnfs.map((item: any) => [item.hc_id, item])).values());
              setHealthCenters(uniqueHCs);
          })
          .catch(err => toast({ title: "Error", description: err.message, variant: "destructive"}))
          .finally(() => setLoading(p => ({...p, data: false})));
    }, [selectedProjectId, toast]);

    // --- Filtering & Memoization ---
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
    const resetFormValues = useCallback(() => {
        form.reset({
            attend_hc: undefined,
            conf_date_day: "",
            conf_date_month: "",
            conf_date_year: "",
            not_attend_reason: "",
            bnf_has_cmam_hc: undefined,
            hc_muac_no: 25,
            hc_muac_yes: 17,
            bnf_cmam_cond: undefined,
            hc_card_no: "",
            bnf_preg_mon: "1",
            bnf_child_age: "1",
            exp_start_treat_date_day: "",
            exp_start_treat_date_month: "",
            exp_start_treat_date_year: "",
            exp_end_treat_date_day: "",
            exp_end_treat_date_month: "",
            exp_end_treat_date_year: "",
            follow_up_status: ""
        });
    }, [form]);

    const moveToNextBeneficiary = useCallback(() => {
        resetFormValues();
        const currentIndex = filteredBeneficiaries.findIndex(b => b.id === selectedBeneficiaryId);
        if (currentIndex !== -1 && currentIndex < filteredBeneficiaries.length - 1) {
            setSelectedBeneficiaryId(filteredBeneficiaries[currentIndex + 1].id);
        } else {
             toast({ title: "End of List", description: "All beneficiaries in this list have been reviewed." });
             setSelectedBeneficiaryId(null);
        }
    }, [filteredBeneficiaries, selectedBeneficiaryId, resetFormValues, toast]);

    const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!selectedBeneficiaryId) return;

        setLoading(p => ({...p, saving: true}));

        const payload: any = {
            id: selectedBeneficiaryId,
            conf_date: `${data.conf_date_year}-${data.conf_date_month}-${data.conf_date_day}`,
            attend_hc: data.attend_hc,
        };

        if (data.attend_hc === 'لا') {
            payload.not_attend_reason = data.not_attend_reason;
        } else {
            payload.bnf_has_cmam_hc = data.bnf_has_cmam_hc;
            if (data.bnf_has_cmam_hc === 'لا') {
                payload.hc_muac = data.hc_muac_no;
            } else {
                payload.hc_card_no = data.hc_card_no;
                payload.bnf_cmam_cond = data.bnf_cmam_cond;
                payload.bnf_preg_mon = data.bnf_preg_mon;
                payload.bnf_child_age = data.bnf_child_age;
                payload.hc_muac = data.hc_muac_yes;
                payload.exp_start_treat_date = `${data.exp_start_treat_date_year}-${data.exp_start_treat_date_month}-${data.exp_start_treat_date_day}`;
                payload.exp_end_treat_date = `${data.exp_end_treat_date_year}-${data.exp_end_treat_date_month}-${data.exp_end_treat_date_day}`;
                payload.not_attend_reason = data.follow_up_status; // Re-using field
            }
        }
        
        try {
            const res = await fetch('/api/bnf-cmam', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([payload])
            });
            if (!res.ok) throw new Error("Failed to save confirmation results.");
            toast({ title: "Success", description: "Record updated successfully." });
            moveToNextBeneficiary();
        } catch (err: any) {
            toast({ title: "Save Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Confirmation Malnutrition Results Data Entry</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Confirmation Hub</Link>
                </Button>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>1. Select Project & Health Center</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                        <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                     <Select onValueChange={setSelectedHealthCenterId} value={selectedHealthCenterId} disabled={!selectedProjectId}>
                        <SelectTrigger><SelectValue placeholder="اختر المركز..." /></SelectTrigger>
                        <SelectContent>{healthCenters.map(hc => <SelectItem key={hc.hc_id} value={hc.hc_id}>{hc.hc_name} ({hc.hc_id})</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedHealthCenterId && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle>اختيار المستفيدة</CardTitle></CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by ID or name..." className="pl-8" value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-96 mt-4 border rounded-md">
                            <Table>
                                <TableHeader><TableRow><TableHead>Select</TableHead><TableHead>ID</TableHead><TableHead>Name</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {filteredBeneficiaries.map(b => (
                                        <TableRow 
                                            key={b.id} 
                                            onClick={() => {
                                                setSelectedBeneficiaryId(b.id);
                                                resetFormValues(); // Added so manual clicks also reset the form
                                            }} 
                                            className={cn("cursor-pointer", selectedBeneficiaryId === b.id && 'bg-primary/10')}
                                        >
                                            <TableCell><Checkbox checked={selectedBeneficiaryId === b.id} /></TableCell>
                                            <TableCell>{b.BENEF_ID}</TableCell>
                                            <TableCell>{b.BENEF_NAME}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <Form {...form}>
                    {/* Added key prop bound to selectedBeneficiaryId. This forces React to remount the entire form block from scratch, destroying any lingering state inside Shadcn select components. */}
                    <form key={selectedBeneficiaryId || "form"} onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                        <CardHeader><CardTitle>Confirmation Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>تاريخ تأكيد الحالة</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField control={form.control} name="conf_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Day"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="conf_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="conf_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div>
                            </div>

                            <FormField control={form.control} name="attend_hc" render={({ field }) => (
                                <FormItem><FormLabel>هل المستفيدة حظرت الى المركز الصحي؟</FormLabel>
                                <FormControl><div className="flex gap-4 pt-2">
                                    <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                    <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                                </div></FormControl><FormMessage /></FormItem>
                            )} />

                            {watchAttendHC === 'لا' && (
                                <>
                                <FormField control={form.control} name="not_attend_reason" render={({ field }) => (
                                    <FormItem><FormLabel>سبب عدم الحظور</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                                )} />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                                </>
                            )}

                            {watchAttendHC === 'نعم' && (
                                <FormField control={form.control} name="bnf_has_cmam_hc" render={({ field }) => (
                                    <FormItem><FormLabel>هل تعاني المستفيدة من سوء تغذية؟</FormLabel>
                                    <FormControl><div className="flex gap-4 pt-2">
                                        <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                        <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                                    </div></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                            
                             {watchAttendHC === 'نعم' && watchHasCmamHC === 'لا' && (
                                <>
                                <FormField control={form.control} name="hc_muac_no" render={({ field }) => (
                                <FormItem><FormLabel>قياس المواك: {field.value || 23}</FormLabel>
                                <FormControl><Slider min={23} max={30} step={0.1} value={[field.value || 23]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                                </>
                             )}

                            {watchAttendHC === 'نعم' && watchHasCmamHC === 'نعم' && (
                            <>
                                <FormField control={form.control} name="hc_card_no" render={({ field }) => (
                                    <FormItem><FormLabel>رقم الكرت الحصري</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>
                                )} />
                                <FormField control={form.control} name="bnf_cmam_cond" render={({ field }) => (
                                <FormItem><FormLabel>حالة المستفيدة حاليا</FormLabel><FormControl><div className="flex gap-4 pt-2">
                                    <Button type="button" variant={field.value === 'حامل' ? 'default' : 'outline'} onClick={() => field.onChange('حامل')} className="flex-1">حامل</Button>
                                    <Button type="button" variant={field.value === 'مرضع' ? 'default' : 'outline'} onClick={() => field.onChange('مرضع')} className="flex-1">مرضع</Button>
                                </div></FormControl><FormMessage /></FormItem>
                                )} />
                                {watchBnfCmamCond === 'حامل' && (
                                     <FormField control={form.control} name="bnf_preg_mon" render={({ field }) => (
                                    <FormItem><FormLabel>شهر الحمل: {field.value || 1}</FormLabel>
                                    <FormControl><Slider min={1} max={9} step={1} value={[Number(field.value) || 1]} onValueChange={(v) => field.onChange(String(v[0]))} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                )}
                                 {watchBnfCmamCond === 'مرضع' && (
                                     <FormField control={form.control} name="bnf_child_age" render={({ field }) => (
                                    <FormItem><FormLabel>عمر الرضيع: {field.value || 1}</FormLabel>
                                    <FormControl><Slider min={1} max={6} step={1} value={[Number(field.value) || 1]} onValueChange={(v) => field.onChange(String(v[0]))} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                )}
                                <FormField control={form.control} name="hc_muac_yes" render={({ field }) => (
                                <FormItem><FormLabel>قياس المواك: {field.value || 17}</FormLabel>
                                <FormControl><Slider min={17} max={26} step={0.1} value={[field.value || 17]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="space-y-2">
                                    <Label>تاريخ بدء العلاج</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <FormField control={form.control} name="exp_start_treat_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Day"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="exp_start_treat_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="exp_start_treat_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    </div>
                                </div>
                                 <div className="space-y-2">
                                    <Label>التاريخ المتوقع للانتهاء العلاج</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <FormField control={form.control} name="exp_end_treat_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Day"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="exp_end_treat_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="exp_end_treat_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    </div>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="follow_up_status"
                                    render={({ field }) => (
                                    <FormItem><FormLabel>حالة المتابعه</FormLabel><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Select status..."/></SelectTrigger></FormControl>
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
                </Card>
            </div>
            )}
        </div>
    );
}
