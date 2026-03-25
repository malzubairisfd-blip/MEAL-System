// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/entry/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ChevronsUpDown, Check, Loader2, Search, Database, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface Project { projectId: string; projectName: string; }
interface Educator { ED_ID: string; ED_NAME: string; }
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; BENEF_CLASS_DESC: string; ED_ID?: string; ED_NAME?: string; }
interface Child { id: number; child_id: string; child_name: string; benef_id: string; cmam_qualify: string; }
interface HealthCenter { hc_id: string; hc_name: string; hw_id: string; hw_name: string;}

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

const formSchema = z.object({
  isExistingChild: z.string().default('نعم'),
  child_first_name: z.string().optional(),
  child_gender: z.enum(['ذكر', 'أنثى']).optional(),
  new_child_age_mon: z.string().optional(),
  child_has_cmam: z.enum(['نعم', 'لا']).optional(),
  child_cmam_type: z.enum(['سوء تغذية متوسط', 'سوء تغذية حاد']).optional(),
  muac: z.number().optional(),
  go_health_center: z.enum(['نعم', 'لا']).optional(),
  disc_date_day: z.string().optional(),
  disc_date_month: z.string().optional(),
  disc_date_year: z.string().optional(),
  near_health_center: z.string().optional(),
  comments: z.string().optional(),
}).refine(data => {
    if (data.isExistingChild === 'لا') {
        return !!data.child_first_name && !!data.child_gender && !!data.new_child_age_mon;
    }
    return true;
}, {
    message: "New child details are required.",
    path: ['child_first_name'],
}).refine(data => {
    if (data.child_has_cmam === 'نعم') {
        return !!data.child_cmam_type && !!data.muac && !!data.go_health_center && !!data.disc_date_day && !!data.disc_date_month && !!data.disc_date_year;
    }
    return true;
}, {
    message: "All fields are required when malnutrition is 'Yes'",
    path: ['child_has_cmam'],
});


export default function ChildScreeningDataEntryPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [educators, setEducators] = useState<Educator[]>([]);
    const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
    const [allChildren, setAllChildren] = useState<Child[]>([]);
    const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedEducatorId, setSelectedEducatorId] = useState("");
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<string>("");
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    const [childSearch, setChildSearch] = useState("");
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [educatorOpen, setEducatorOpen] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            isExistingChild: 'نعم',
            muac: 7.0,
        }
    });

    const watchIsExisting = form.watch("isExistingChild");
    const watchHasCmam = form.watch("child_has_cmam");
    const watchFirstName = form.watch("child_first_name");
    const watchGender = form.watch("child_gender");

    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({...p, projects: false})));
    }, []);

    const handleProjectSelect = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        setSelectedEducatorId("");
        setSelectedBeneficiary(null);
        setSelectedChildId("");
        form.reset();
        
        if (!projectId) return;

        setLoading(p => ({...p, data: true}));
        try {
            const [bnfRes, hcRes, childRes] = await Promise.all([
                fetch(`/api/bnf-cmam?projectId=${projectId}`),
                fetch(`/api/health-centers?projectId=${projectId}`),
                fetch(`/api/child-cmam?projectId=${projectId}`)
            ]);
            
            const bnfData = await bnfRes.json();
            setAllBeneficiaries(bnfData);
            
            const uniqueEducators = Array.from(new Map(bnfData.filter((b:any)=>b.ED_ID).map((item: any) => [item.ED_ID, {ED_ID: item.ED_ID, ED_NAME: item.ED_NAME}])).values()) as Educator[];
            setEducators(uniqueEducators);
            setHealthCenters(await hcRes.json());
            setAllChildren(await childRes.json());
        } catch (error: any) {
            toast({ title: "Error loading data", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, data: false}));
        }
    }, [toast, form]);

    const beneficiariesForEducator = useMemo(() => {
        if (!selectedEducatorId) return [];
        let filtered = allBeneficiaries.filter(b => b.BENEF_CLASS_DESC === 'مستفيدة' && b.ED_ID === selectedEducatorId);
        if (beneficiarySearch) {
            const ls = beneficiarySearch.toLowerCase();
            filtered = filtered.filter(b => String(b.BENEF_ID).toLowerCase().includes(ls) || b.BENEF_NAME.toLowerCase().includes(ls));
        }
        return filtered;
    }, [allBeneficiaries, selectedEducatorId, beneficiarySearch]);

    const childrenOfBeneficiary = useMemo(() => {
        if (!selectedBeneficiary) return [];
        let filtered = allChildren.filter(c => c.benef_id === selectedBeneficiary.BENEF_ID && c.cmam_qualify === 'Qualified');
        if (childSearch) {
            const ls = childSearch.toLowerCase();
            filtered = filtered.filter(c => String(c.child_id).toLowerCase().includes(ls) || c.child_name.toLowerCase().includes(ls));
        }
        return filtered;
    }, [allChildren, selectedBeneficiary, childSearch]);

     const moveToNext = useCallback(() => {
        form.reset({ isExistingChild: 'نعم', child_has_cmam: undefined, muac: 7.0 });

        const currentChildIndex = childrenOfBeneficiary.findIndex(c => c.child_id === selectedChildId);
        if (currentChildIndex > -1 && currentChildIndex < childrenOfBeneficiary.length - 1) {
             const nextChild = childrenOfBeneficiary[currentChildIndex + 1];
             setSelectedChildId(nextChild.child_id);
             toast({ title: "Next Child", description: `Switched to child: ${nextChild.child_name}`});
             return;
        }
        
        const currentBnfIndex = beneficiariesForEducator.findIndex(b => b.id === selectedBeneficiary?.id);
        if (currentBnfIndex > -1 && currentBnfIndex < beneficiariesForEducator.length - 1) {
             const nextBnf = beneficiariesForEducator[currentBnfIndex + 1];
             setSelectedBeneficiary(nextBnf);
             toast({ title: "Next Beneficiary", description: `Switched to: ${nextBnf.BENEF_NAME}`});
        } else {
             toast({ title: "End of List", description: "You have reviewed all children for this educator."});
             setSelectedChildId("");
             setSelectedBeneficiary(null);
        }
    }, [childrenOfBeneficiary, selectedChildId, form, toast, beneficiariesForEducator, selectedBeneficiary]);
    
    useEffect(() => {
        if (selectedBeneficiary && childrenOfBeneficiary.length > 0) {
            const firstChild = childrenOfBeneficiary[0];
            setSelectedChildId(firstChild.child_id);
            form.reset({ isExistingChild: 'نعم', child_has_cmam: undefined, muac: 7.0 });
        } else {
            setSelectedChildId("");
        }
    }, [selectedBeneficiary, childrenOfBeneficiary, form]);


    const handleSave = async (data: z.infer<typeof formSchema>) => {
        if ((data.isExistingChild === 'نعم' && !selectedChildId) || !selectedBeneficiary) {
            toast({ title: "Selection Missing", variant: "destructive" });
            return;
        }

        setLoading(p => ({...p, saving: true}));

        try {
            let action: string;
            let payload: any = {};
            const hc = healthCenters.find(h => h.hc_name === data.near_health_center);

            if (data.isExistingChild === 'نعم') {
                action = 'update_child';
                payload = { id: allChildren.find(c => c.child_id === selectedChildId)?.id };

                if (data.child_has_cmam === 'نعم') {
                    Object.assign(payload, {
                        child_has_cmam: 'نعم',
                        child_cmam_type: data.child_cmam_type,
                        muac: data.muac,
                        go_health_center: data.go_health_center,
                        disc_date: data.disc_date_year ? `${data.disc_date_year}-${data.disc_date_month}-${data.disc_date_day}` : null,
                        near_health_center: hc?.hc_name, hc_id: hc?.hc_id, hw_id: hc?.hw_id, hw_name: hc?.hw_name,
                        comments: data.comments
                    });
                } else if (data.child_has_cmam === 'لا') {
                    Object.assign(payload, {
                        child_has_cmam: 'لا',
                        muac: data.muac,
                        comments: data.comments,
                        child_cmam_type: null, go_health_center: null, disc_date: null, near_health_center: null,
                    });
                }
            } else { // New Child
                action = 'create_new_child';
                const commonPayload = {
                    project_id: selectedProjectId,
                    benef_id: selectedBeneficiary.BENEF_ID,
                    child_first_name: data.child_first_name,
                    child_gender: data.child_gender,
                    new_child_age_mon: parseInt(data.new_child_age_mon || '0'),
                    child_has_cmam: data.child_has_cmam
                };
                if (data.child_has_cmam === 'نعم') {
                    Object.assign(payload, {
                        ...commonPayload,
                        child_cmam_type: data.child_cmam_type,
                        muac: data.muac,
                        go_health_center: data.go_health_center,
                        disc_date: data.disc_date_year ? `${data.disc_date_year}-${data.disc_date_month}-${data.disc_date_day}` : null,
                        near_health_center: hc?.hc_name, hc_id: hc?.hc_id, hw_id: hc?.hw_id, hw_name: hc?.hw_name,
                        comments: data.comments
                    });
                } else {
                     Object.assign(payload, {
                        ...commonPayload,
                        muac: data.muac,
                        comments: data.comments
                    });
                }
            }
            
            const res = await fetch('/api/child-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload: payload })
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "نجاح", description: "تم حفظ بيانات الطفل بنجاح" });

            if (data.isExistingChild === 'نعم') {
                moveToNext();
            } else {
                form.reset({ isExistingChild: 'لا' });
                await handleProjectSelect(selectedProjectId);
            }
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };
    
    useEffect(() => {
        const timer = setTimeout(() => {
            if (watchIsExisting === 'لا' && watchFirstName && watchGender && selectedBeneficiary) {
                fetch('/api/validate-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: watchFirstName, gender: watchGender, benef_id: selectedBeneficiary.BENEF_ID })
                }).then(res => res.json()).then(data => setValidationErrors(data.result || []));
            } else {
                setValidationErrors([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [watchFirstName, watchGender, watchIsExisting, selectedBeneficiary]);


    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-foreground">إدخال نتائج الفحص (CMAM) للأطفال</h1>
                <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening"><ArrowLeft className="mr-2 h-4 w-4"/> عودة</Link></Button>
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database"><Database className="mr-2 h-4 w-4"/>Database</Link></Button>
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/export"><FileText className="mr-2 h-4 w-4"/>Export</Link></Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-t-4 border-t-primary shadow-sm">
                    <CardHeader className="bg-muted/30 pb-4"><CardTitle className="text-lg">تحديد المشروع والمثقفة</CardTitle></CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>المشروع</Label>
                            <Select onValueChange={handleProjectSelect} value={selectedProjectId}>
                                <SelectTrigger><SelectValue placeholder="اختر المشروع..." /></SelectTrigger>
                                <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>اختر المثقفة</Label>
                            <Popover open={educatorOpen} onOpenChange={setEducatorOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={educatorOpen} className="w-full justify-between disabled:opacity-50" disabled={!selectedProjectId}>
                                        {selectedEducatorId ? educators.find((e) => e.ED_ID === selectedEducatorId)?.ED_NAME : "اختر المثقفة..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <Command>
                                        <CommandInput placeholder="ابحث عن المثقفة..." />
                                        <CommandList>
                                            <CommandEmpty>لم يتم العثور على مثقفة.</CommandEmpty>
                                            <CommandGroup>
                                                {educators.map((ed) => (
                                                    <CommandItem key={ed.ED_ID} value={ed.ED_NAME} onSelect={() => { setSelectedEducatorId(ed.ED_ID); setEducatorOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", selectedEducatorId === ed.ED_ID ? "opacity-100" : "opacity-0")} />
                                                        {ed.ED_NAME} ({ed.ED_ID})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-primary shadow-sm">
                    <CardHeader className="bg-muted/30 pb-4"><CardTitle className="text-lg">اختيار المستفيدة</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-4">
                         <Input placeholder="بحث بالاسم او رقم المستفيدة..." value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} disabled={!selectedEducatorId} />
                         <ScrollArea className="h-[200px] border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted sticky top-0"><TableRow><TableHead className="w-[50px]">تحديد</TableHead><TableHead>ID</TableHead><TableHead>الاسم</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {beneficiariesForEducator.map(b => (
                                        <TableRow key={b.id} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", selectedBeneficiary?.id === b.id && 'bg-primary/10')} onClick={() => {setSelectedBeneficiary(b); setSelectedChildId("");}}>
                                            <TableCell><Checkbox checked={selectedBeneficiary?.id === b.id} /></TableCell>
                                            <TableCell className="font-medium">{b.BENEF_ID}</TableCell>
                                            <TableCell>{b.BENEF_NAME}</TableCell>
                                        </TableRow>
                                    ))}
                                    {beneficiariesForEducator.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground h-24">الرجاء تحديد المشروع والمثقفة أولاً</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                         </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {selectedBeneficiary && (
                <Card className="border-t-4 border-t-secondary shadow-md">
                    <CardHeader className="bg-muted/30"><CardTitle className="text-lg">3. Child Details & Screening</CardTitle></CardHeader>
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8">
                                <FormField control={form.control} name="isExistingChild" render={({field}) => (
                                    <FormItem className="bg-card p-4 rounded-lg border">
                                        <FormLabel className="text-base font-semibold">هل الطفل مسجل سابقا في قاعدة البيانات؟</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-8 pt-3">
                                                <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="نعم" id="yes"/><Label htmlFor="yes" className="font-normal m-0 cursor-pointer">نعم</Label></div>
                                                <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="لا" id="no"/><Label htmlFor="no" className="font-normal m-0 cursor-pointer">لا</Label></div>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )} />

                                {watchIsExisting === 'نعم' && (
                                    <div className="space-y-4">
                                        <Label className="text-base font-semibold">اختيار الطفل</Label>
                                        <Input placeholder="بحث باسم أو رقم الطفل..." value={childSearch} onChange={e => setChildSearch(e.target.value)} className="max-w-md"/>
                                        <ScrollArea className="h-[200px] border rounded-md">
                                            <Table>
                                                <TableHeader className="bg-muted sticky top-0"><TableRow><TableHead className="w-[50px]">تحديد</TableHead><TableHead>رقم الطفل</TableHead><TableHead>اسم الطفل</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {childrenOfBeneficiary.length > 0 ? childrenOfBeneficiary.map(c => (
                                                        <TableRow key={c.id} className={cn("cursor-pointer hover:bg-muted/50", selectedChildId === c.child_id && 'bg-secondary/10')} onClick={() => setSelectedChildId(c.child_id)}>
                                                            <TableCell><Checkbox checked={selectedChildId === c.child_id} /></TableCell>
                                                            <TableCell className="font-medium">{c.child_id}</TableCell>
                                                            <TableCell>{c.child_name}</TableCell>
                                                        </TableRow>
                                                    )) : (
                                                        <TableRow><TableCell colSpan={3} className="text-center text-yellow-600 h-24 bg-yellow-500/10">لايوجد طفل لدى المستفيدة مؤهل قد يكون عمر الطفل ٥ سنوات او اكثر يرجى اختيار مستفيدة أخرى او إدخال طفل جديد</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </div>
                                )}

                                {watchIsExisting === 'لا' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-card">
                                        <FormField control={form.control} name="child_gender" render={({ field }) => (
                                            <FormItem><FormLabel>جنس الطفل</FormLabel><FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6 pt-2">
                                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="ذكر" id="m"/><Label htmlFor="m" className="font-normal m-0 cursor-pointer">ذكر</Label></div>
                                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="أنثى" id="f"/><Label htmlFor="f" className="font-normal m-0 cursor-pointer">أنثى</Label></div>
                                                </RadioGroup>
                                            </FormControl></FormItem>
                                        )} />
                                        
                                        <FormField control={form.control} name="child_first_name" render={({ field }) => (
                                            <FormItem><FormLabel>اسم الطفل الجديد</FormLabel><FormControl><Input placeholder="الاسم الأول فقط..." {...field}/></FormControl></FormItem>
                                        )} />
                                        
                                        {validationErrors.length > 0 && (
                                            <div className="col-span-1 md:col-span-2 p-3 rounded bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                                                <p className="font-semibold mb-1">يوجد ملاحظات على الاسم:</p>
                                                <ul className="list-disc list-inside text-sm space-y-1">{validationErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                                            </div>
                                        )}

                                        <FormField control={form.control} name="new_child_age_mon" render={({ field }) => (
                                            <FormItem><FormLabel>عمر الطفل بالاشهر</FormLabel><FormControl><Input type="number" min="6" max="59" placeholder="6 - 59" {...field}/></FormControl></FormItem>
                                        )} />
                                    </div>
                                )}

                                {((watchIsExisting === 'نعم' && selectedChildId) || watchIsExisting === 'لا') && (
                                    <div className="space-y-6 pt-6 border-t border-dashed">
                                        <FormField control={form.control} name="child_has_cmam" render={({ field }) => (
                                            <FormItem className="bg-accent/10 p-4 rounded-lg border border-accent/20">
                                                <FormLabel className="text-base font-semibold text-accent-foreground">هل يعاني الطفل من سوء تغذية؟</FormLabel>
                                                <FormControl>
                                                    <RadioGroup 
                                                        onValueChange={value => {
                                                            field.onChange(value);
                                                            if (value === 'لا') {
                                                                form.setValue('muac', 12.5);
                                                            } else {
                                                                form.setValue('muac', 7.0);
                                                            }
                                                        }} 
                                                        value={field.value} 
                                                        className="flex gap-8 pt-3"
                                                    >
                                                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="نعم" id="c_yes"/><Label htmlFor="c_yes" className="font-medium cursor-pointer m-0">نعم</Label></div>
                                                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="لا" id="c_no"/><Label htmlFor="c_no" className="font-medium cursor-pointer m-0">لا</Label></div>
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )} />

                                        {watchHasCmam === 'لا' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card p-6 rounded-lg border shadow-sm">
                                                <FormField control={form.control} name="muac" render={({ field }) => (
                                                    <FormItem><FormLabel>قياس المواك: {field.value || 12.5}</FormLabel><FormControl>
                                                        <Slider min={12.5} max={20} step={0.1} value={[field.value || 12.5]} onValueChange={(v) => field.onChange(v[0])} />
                                                    </FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="comments" render={({ field }) => (
                                                    <FormItem><FormLabel>ملاحظات</FormLabel><FormControl><Textarea placeholder="أدخل ملاحظاتك هنا..." {...field} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                            </div>
                                        )}

                                        {watchHasCmam === 'نعم' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card p-6 rounded-lg border shadow-sm">
                                                <FormField control={form.control} name="child_cmam_type" render={({ field }) => (
                                                    <FormItem><FormLabel>حالة الطفل حاليا</FormLabel><FormControl>
                                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6 pt-2">
                                                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="سوء تغذية متوسط" id="mam"/><Label htmlFor="mam" className="font-normal m-0 cursor-pointer">سوء تغذية متوسط</Label></div>
                                                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="سوء تغذية حاد" id="sam"/><Label htmlFor="sam" className="font-normal m-0 cursor-pointer">سوء تغذية حاد</Label></div>
                                                        </RadioGroup>
                                                    </FormControl></FormItem>
                                                )} />

                                                <FormField control={form.control} name="muac" render={({ field }) => (
                                                    <FormItem><FormLabel>قياس المواك: {field.value || 7}</FormLabel><FormControl>
                                                        <Slider
                                                            min={7}
                                                            max={16}
                                                            step={0.1}
                                                            value={[field.value || 7]}
                                                            onValueChange={(v) => field.onChange(v[0])}
                                                        />
                                                    </FormControl><FormMessage /></FormItem>
                                                )} />

                                                <FormField control={form.control} name="go_health_center" render={({ field }) => (
                                                    <FormItem><FormLabel>هل يذهب الى المرفق الصحي؟</FormLabel><FormControl>
                                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6 pt-2">
                                                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="نعم" id="gh_yes"/><Label htmlFor="gh_yes" className="font-normal m-0 cursor-pointer">نعم</Label></div>
                                                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="لا" id="gh_no"/><Label htmlFor="gh_no" className="font-normal m-0 cursor-pointer">لا</Label></div>
                                                        </RadioGroup>
                                                    </FormControl></FormItem>
                                                )} />

                                                <div className="space-y-3">
                                                    <Label>تاريخ اكتشاف الحالة</Label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <FormField control={form.control} name="disc_date_day" render={({field})=><FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اليوم"/></SelectTrigger></FormControl><SelectContent>{days.map(d=><SelectItem key={d} value={String(d).padStart(2, '0')}>{d}</SelectItem>)}</SelectContent></Select></FormItem>}/>
                                                        <FormField control={form.control} name="disc_date_month" render={({field})=><FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="الشهر"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i)=><SelectItem key={m} value={String(i+1).padStart(2, '0')}>{m}</SelectItem>)}</SelectContent></Select></FormItem>}/>
                                                        <FormField control={form.control} name="disc_date_year" render={({field})=><FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="السنة"/></SelectTrigger></FormControl><SelectContent>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>}/>
                                                    </div>
                                                </div>

                                                <FormField control={form.control} name="near_health_center" render={({ field }) => (
                                                    <FormItem className="col-span-1 md:col-span-2"><FormLabel>اقرب مركز صحي للذهاب الية</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="اختر المرفق الصحي..." /></SelectTrigger></FormControl>
                                                        <SelectContent>{healthCenters.map(hc => <SelectItem key={hc.hc_id} value={hc.hc_name}>{hc.hc_name}</SelectItem>)}</SelectContent>
                                                    </Select></FormItem>
                                                )} />
                                            </div>
                                        )}
                                        
                                        <div className="pt-4 flex justify-end">
                                             <Button type="submit" size="lg" className="w-full md:w-auto" disabled={loading.saving || !form.formState.isValid}>
                                                 {loading.saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5"/>} Save & Next
                                             </Button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
