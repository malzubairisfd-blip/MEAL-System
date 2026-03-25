// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/entry/page.tsx
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
import { ArrowLeft, Loader2, Search, ThumbsUp, Check, ChevronsUpDown, Database, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from '@/components/ui/textarea';

// --- Types ---
interface Project { projectId: string; projectName: string; }
interface HealthCenter { hc_id: string; hc_name: string; hw_id: string; hw_name: string;}
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; [key: string]: any; }
interface Child { id: number; child_id: string; child_name: string; benef_id: string; [key: string]: any; }

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

// --- Zod Schema ---
const formSchema = z.object({
  attend_hc: z.enum(['نعم', 'لا']),
  conf_date_day: z.string().optional(),
  conf_date_month: z.string().optional(),
  conf_date_year: z.string().optional(),
  
  // 'No' attend branch
  not_attend_reason_hc: z.string().optional(),

  // 'Yes' attend branch
  child_has_cmam_hc: z.enum(['نعم', 'لا']).optional(),

  // 'Yes' attend -> 'No' cmam sub-branch
  muac_hc_no: z.number().optional(),
  comments: z.string().optional(),

  // 'Yes' attend -> 'Yes' cmam sub-branch
  hc_card_no: z.string().optional(),
  meas_type: z.enum(['المواك', 'الزد اسكور']).optional(),
  muac_hc: z.number().optional(),
  zscore_h: z.string().optional(),
  zscore_w: z.string().optional(),
  zscore: z.string().optional(),
  child_cmam_cond: z.enum(['سوء تغذية متوسط', 'سوء تغذية حاد']).optional(),
  exp_start_treat_date_day: z.string().optional(),
  exp_start_treat_date_month: z.string().optional(),
  exp_start_treat_date_year: z.string().optional(),
  exp_end_treat_date_day: z.string().optional(),
  exp_end_treat_date_month: z.string().optional(),
  exp_end_treat_date_year: z.string().optional(),
  cmam_result_hc: z.string().optional(),
});


export default function ConfirmationDataEntryPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [allChildren, setAllChildren] = useState<Child[]>([]);
    
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedHealthCenterId, setSelectedHealthCenterId] = useState("");
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    const [childSearch, setChildSearch] = useState("");
    
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            attend_hc: undefined,
            muac_hc_no: 12.5,
            muac_hc: 7.0,
        }
    });

    const watchAttendHC = form.watch("attend_hc");
    const watchHasCmamHC = form.watch("child_has_cmam_hc");
    const watchMeasType = form.watch("meas_type");
    
    useEffect(() => {
        setLoading(p => ({...p, projects: true}));
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({...p, projects: false})));
    }, []);

    const handleProjectSelect = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        setSelectedHealthCenterId("");
        setSelectedBeneficiary(null);
        setSelectedChildId("");
        form.reset();
        
        if (!projectId) {
            setAllChildren([]);
            return;
        }

        setLoading(p => ({...p, data: true}));
        try {
            const res = await fetch(`/api/child-cmam?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to load child CMAM data.");
            const data = await res.json();
            setAllChildren(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, data: false}));
        }
    }, [toast, form]);

    const healthCenters = useMemo((): HealthCenter[] => {
        if (!allChildren.length) return [];
        const qualifiedChildren = allChildren.filter(c => c.child_has_cmam === 'نعم');
        const uniqueHCs = Array.from(new Map(qualifiedChildren.map(c => [c.hc_id, { hc_id: c.hc_id, hc_name: c.hc_name, hw_id: c.hw_id, hw_name: c.hw_name }])).values());
        return uniqueHCs;
    }, [allChildren]);
    
    const beneficiariesInHc = useMemo((): Beneficiary[] => {
        if (!selectedHealthCenterId) return [];
        const childrenInHc = allChildren.filter(c => c.hc_id === selectedHealthCenterId && c.child_has_cmam === 'نعم');
        const uniqueBnfs = Array.from(new Map(childrenInHc.map(c => [c.benef_id, { id: c.id, BENEF_ID: c.benef_id, BENEF_NAME: c.bnf_name }])).values());
        return uniqueBnfs;
    }, [allChildren, selectedHealthCenterId]);
    
    const filteredBeneficiaries = useMemo(() => {
        if (!beneficiarySearch) return beneficiariesInHc;
        const ls = beneficiarySearch.toLowerCase();
        return beneficiariesInHc.filter(b => String(b.BENEF_ID).toLowerCase().includes(ls) || b.BENEF_NAME.toLowerCase().includes(ls));
    }, [beneficiariesInHc, beneficiarySearch]);

    const childrenOfBeneficiary = useMemo(() => {
        if (!selectedBeneficiary) return [];
        let filtered = allChildren.filter(c => c.benef_id === selectedBeneficiary.BENEF_ID && c.cmam_qualify === 'Qualified' && c.child_has_cmam === 'نعم');
        if (childSearch) {
            const ls = childSearch.toLowerCase();
            filtered = filtered.filter(c => String(c.child_id).toLowerCase().includes(ls) || c.child_name.toLowerCase().includes(ls));
        }
        return filtered;
    }, [allChildren, selectedBeneficiary, childSearch]);

    const moveToNext = useCallback(() => {
        form.reset({ attend_hc: undefined, muac_hc: 7.0, muac_hc_no: 12.5 });

        const currentChildIndex = childrenOfBeneficiary.findIndex(c => c.child_id === selectedChildId);
        if (currentChildIndex > -1 && currentChildIndex < childrenOfBeneficiary.length - 1) {
             const nextChild = childrenOfBeneficiary[currentChildIndex + 1];
             setSelectedChildId(nextChild.child_id);
             toast({ title: "Next Child", description: `Switched to child: ${nextChild.child_name}`});
             return;
        }
        
        const currentBnfIndex = filteredBeneficiaries.findIndex(b => b.id === selectedBeneficiary?.id);
        if (currentBnfIndex > -1 && currentBnfIndex < filteredBeneficiaries.length - 1) {
             const nextBnf = filteredBeneficiaries[currentBnfIndex + 1];
             setSelectedBeneficiary(nextBnf);
             toast({ title: "Next Beneficiary", description: `Switched to: ${nextBnf.BENEF_NAME}`});
        } else {
             toast({ title: "End of List", description: "You have reviewed all children for this educator."});
             setSelectedChildId("");
             setSelectedBeneficiary(null);
        }
    }, [childrenOfBeneficiary, selectedChildId, form, toast, filteredBeneficiaries, selectedBeneficiary]);
    
    useEffect(() => {
        if (selectedBeneficiary && childrenOfBeneficiary.length > 0) {
            const firstUnreviewedChild = childrenOfBeneficiary.find(c => !c.attend_hc);
            if(firstUnreviewedChild) {
              setSelectedChildId(firstUnreviewedChild.child_id);
            } else {
              setSelectedChildId(childrenOfBeneficiary[0].child_id);
            }
            form.reset({ attend_hc: undefined, muac_hc: 7.0, muac_hc_no: 12.5 });
        } else {
            setSelectedChildId("");
        }
    }, [selectedBeneficiary, childrenOfBeneficiary, form]);


    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!selectedChildId) {
            toast({ title: "Selection Missing", variant: "destructive" });
            return;
        }

        setLoading(p => ({...p, saving: true}));

        const fullDate = (data.conf_date_day && data.conf_date_month && data.conf_date_year)
            ? `${data.conf_date_year}-${data.conf_date_month}-${data.conf_date_day}`
            : null;

        let payload: any = { 
            id: allChildren.find(c => c.child_id === selectedChildId)?.id,
            conf_date: fullDate,
        };
        
        try {
            if (!fullDate && data.attend_hc === 'نعم') {
                throw new Error("تاريخ تأكيد الحالة is required.");
            }

            payload.attend_hc = data.attend_hc;
            
            if (data.attend_hc === 'لا') {
                if (!data.not_attend_reason_hc) throw new Error("سبب عدم الحضور is required.");
                payload.not_attend_reason_hc = data.not_attend_reason_hc;
            } else if (data.attend_hc === 'نعم') {
                if (!data.child_has_cmam_hc) throw new Error("هل يعاني الطفل من سوء تغذية is required.");
                payload.child_has_cmam_hc = data.child_has_cmam_hc;

                if (data.child_has_cmam_hc === 'لا') {
                    if (data.muac_hc_no === undefined) throw new Error("قياس المواك is required.");
                    payload.muac_hc = data.muac_hc_no;
                    payload.not_attend_reason_hc = data.comments; 
                } else {
                    if (!data.meas_type || !data.child_cmam_cond) throw new Error("Please fill all required malnutrition details.");
                    payload.hc_card_no = data.hc_card_no;
                    payload.meas_type = data.meas_type;
                    payload.muac_hc = data.meas_type === 'المواك' ? data.muac_hc : null;
                    payload.zscore_h = data.meas_type === 'الزد اسكور' ? data.zscore_h : null;
                    payload.zscore_w = data.meas_type === 'الزد اسكور' ? data.zscore_w : null;
                    payload.zscore = data.meas_type === 'الزد اسكور' ? data.zscore : null;
                    payload.child_cmam_cond = data.child_cmam_cond;
                    payload.exp_start_treat_date = data.exp_start_treat_date_year ? `${data.exp_start_treat_date_year}-${data.exp_start_treat_date_month}-${data.exp_start_treat_date_day}` : null;
                    payload.exp_end_treat_date = data.exp_end_treat_date_year ? `${data.exp_end_treat_date_year}-${data.exp_end_treat_date_month}-${data.exp_end_treat_date_day}` : null;
                    payload.cmam_result_hc = data.cmam_result_hc;
                }
            }
            
            const res = await fetch('/api/child-cmam', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([payload])
            });
            if (!res.ok) throw new Error(await res.text());
            
            toast({ title: "Success", description: "Record updated successfully." });
            await handleProjectSelect(selectedProjectId); // Refresh data
            moveToNext();

        } catch (err: any) {
            toast({ title: "Save Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };


    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-foreground">إدخال نتائج تأكيد سوء التغذية (للأطفال)</h1>
                <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation"><ArrowLeft className="mr-2 h-4 w-4"/> عودة</Link></Button>
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database"><Database className="mr-2 h-4 w-4"/>Database</Link></Button>
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/export"><FileText className="mr-2 h-4 w-4"/>Export</Link></Button>
                </div>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>1. حدد المشروع و المركز الصحي</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select onValueChange={handleProjectSelect} value={selectedProjectId}>
                        <SelectTrigger><SelectValue placeholder="اختر المشروع..." /></SelectTrigger>
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
                <Card className="lg:col-span-1 space-y-4">
                    <CardHeader><CardTitle>اختيار المستفيدة</CardTitle></CardHeader>
                    <CardContent>
                        <Input placeholder="بحث بالاسم او رقم المستفيدة..." value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} disabled={!selectedHealthCenterId} />
                        <ScrollArea className="h-48 mt-4 border rounded-md">
                            <Table><TableHeader><TableRow><TableHead>تحديد</TableHead><TableHead>ID</TableHead><TableHead>الاسم</TableHead></TableRow></TableHeader>
                            <TableBody>{filteredBeneficiaries.map(b => (
                                <TableRow key={b.BENEF_ID} onClick={()=>{setSelectedBeneficiary(b); setSelectedChildId('');}} className={cn("cursor-pointer", selectedBeneficiary?.BENEF_ID === b.BENEF_ID && 'bg-primary/10')}>
                                    <TableCell><Checkbox checked={selectedBeneficiary?.BENEF_ID === b.BENEF_ID} /></TableCell>
                                    <TableCell>{b.BENEF_ID}</TableCell><TableCell>{b.BENEF_NAME}</TableCell>
                                </TableRow>
                            ))}</TableBody></Table>
                         </ScrollArea>
                    </CardContent>
                    
                    {selectedBeneficiary && <Card>
                        <CardHeader><CardTitle>اختيار الطفل</CardTitle></CardHeader>
                        <CardContent>
                             <Input placeholder="بحث بالاسم او رقم الطفل..." value={childSearch} onChange={e => setChildSearch(e.target.value)} />
                             <ScrollArea className="h-48 mt-4 border rounded-md">
                                <Table><TableHeader><TableRow><TableHead>تحديد</TableHead><TableHead>ID</TableHead><TableHead>الاسم</TableHead></TableRow></TableHeader>
                                <TableBody>{childrenOfBeneficiary.map(c => (
                                    <TableRow key={c.id} onClick={()=>setSelectedChildId(c.child_id)} className={cn("cursor-pointer", selectedChildId === c.child_id && 'bg-secondary/10')}>
                                        <TableCell><Checkbox checked={selectedChildId === c.child_id} /></TableCell>
                                        <TableCell>{c.child_id}</TableCell><TableCell>{c.child_name}</TableCell>
                                    </TableRow>
                                ))}</TableBody></Table>
                             </ScrollArea>
                        </CardContent>
                    </Card>}
                </Card>

                {selectedChildId && <Card className="lg:col-span-2">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <CardHeader><CardTitle>بيانات تأكيد الحالة للطفل المحدد</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2"><Label>تاريخ تأكيد الحالة</Label><div className="grid grid-cols-3 gap-2">
                                <FormField control={form.control} name="conf_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="يوم"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                <FormField control={form.control} name="conf_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="شهر"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                <FormField control={form.control} name="conf_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="سنة"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            </div></div>
                            <FormField control={form.control} name="attend_hc" render={({ field }) => (<FormItem><FormLabel>هل الطفل حضر الى المركز الصحي؟</FormLabel><FormControl><div className="flex gap-4 pt-2">
                                <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                            </div></FormControl><FormMessage /></FormItem>)} />

                            {watchAttendHC === 'لا' && (<><FormField control={form.control} name="not_attend_reason_hc" render={({ field }) => (<FormItem><FormLabel>سبب عدم الحضور</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)} /><Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button></>)}
                            {watchAttendHC === 'نعم' && (<FormField control={form.control} name="child_has_cmam_hc" render={({ field }) => (<FormItem><FormLabel>هل يعاني الطفل من سوء تغذية؟</FormLabel><FormControl><div className="flex gap-4 pt-2">
                                <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                            </div></FormControl><FormMessage /></FormItem>)} />)}
                            
                             {watchAttendHC === 'نعم' && watchHasCmamHC === 'لا' && (<>
                                <FormField control={form.control} name="muac_hc_no" render={({ field }) => (
                                <FormItem><FormLabel>قياس المواك: {field.value?.toFixed(1) || 12.5}</FormLabel>
                                <FormControl><Slider min={12.5} max={20} step={0.1} value={[field.value || 12.5]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>
                                )} />
                                 <FormField control={form.control} name="comments" render={({ field }) => (
                                    <FormItem><FormLabel>ملاحظات</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>
                                )} />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                                </>
                             )}

                            {watchAttendHC === 'نعم' && watchHasCmamHC === 'نعم' && (<div className="space-y-6 border-t pt-6 mt-6">
                                <FormField control={form.control} name="hc_card_no" render={({ field }) => (<FormItem><FormLabel>رقم الكرت الحصري</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={form.control} name="meas_type" render={({ field }) => (<FormItem><FormLabel>نوع القياس المستخدم</FormLabel><FormControl><div className="flex gap-4 pt-2">
                                    <Button type="button" variant={field.value === 'المواك' ? 'default' : 'outline'} onClick={() => field.onChange('المواك')} className="flex-1">المواك</Button>
                                    <Button type="button" variant={field.value === 'الزد اسكور' ? 'default' : 'outline'} onClick={() => field.onChange('الزد اسكور')} className="flex-1">الزد اسكور</Button>
                                </div></FormControl><FormMessage /></FormItem>)} />
                                {watchMeasType === 'المواك' && (<FormField control={form.control} name="muac_hc" render={({ field }) => (<FormItem><FormLabel>قياس المواك: {field.value?.toFixed(1) || 7.0}</FormLabel><FormControl><Slider min={7} max={12.4} step={0.1} value={[field.value || 7]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>)} />)}
                                {watchMeasType === 'الزد اسكور' && (<div className="grid grid-cols-2 gap-4"><FormField control={form.control} name="zscore_h" render={({ field }) => (<FormItem><FormLabel>قياس الطول</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} /><FormField control={form.control} name="zscore_w" render={({ field }) => (<FormItem><FormLabel>قياس الوزن</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="zscore" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>قياس الزد اسكور</FormLabel><FormControl><div className="flex gap-2 p-2 border rounded-md justify-around">{[-3, -2, -1, 0, 1, 2, 3].map(v => <Button key={v} type="button" variant={field.value === String(v) ? 'default' : 'outline'} onClick={() => field.onChange(String(v))} className="h-10 w-10">{v}</Button>)}</div></FormControl></FormItem>)} />
                                </div>)}
                                <FormField control={form.control} name="child_cmam_cond" render={({ field }) => (<FormItem><FormLabel>حالة الطفل حاليا</FormLabel><FormControl><div className="flex gap-4 pt-2">
                                    <Button type="button" variant={field.value === 'سوء تغذية متوسط' ? 'default' : 'outline'} onClick={() => field.onChange('سوء تغذية متوسط')} className="flex-1">سوء تغذية متوسط</Button>
                                    <Button type="button" variant={field.value === 'سوء تغذية حاد' ? 'default' : 'outline'} onClick={() => field.onChange('سوء تغذية حاد')} className="flex-1">سوء تغذية حاد</Button>
                                </div></FormControl><FormMessage /></FormItem>)} />
                                <div className="space-y-2"><Label>تاريخ بدء العلاج</Label><div className="grid grid-cols-3 gap-2">
                                    <FormField control={form.control} name="exp_start_treat_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="يوم"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="exp_start_treat_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="شهر"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="exp_start_treat_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="سنة"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div></div>
                                <div className="space-y-2"><Label>التاريخ المتوقع لانتهاء العلاج</Label><div className="grid grid-cols-3 gap-2">
                                    <FormField control={form.control} name="exp_end_treat_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="يوم"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="exp_end_treat_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="شهر"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name="exp_end_treat_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="سنة"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div></div>
                                <FormField
                                    control={form.control}
                                    name="cmam_result_hc"
                                    render={({ field }) => (
                                    <FormItem><FormLabel>حالة المتابعة</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status..."/></SelectTrigger></FormControl>
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
                            </div>)}
                        </CardContent>
                    </form>
                    </Form>
                </Card>}
            </div>
            )}
        </div>
    );
}
