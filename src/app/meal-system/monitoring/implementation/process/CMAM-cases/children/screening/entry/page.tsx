// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/entry/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft, 
  Loader2, 
  Check, 
  ChevronsUpDown, 
  Save, 
  FileText, 
  Database, 
  List, 
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
interface Project { projectId: string; projectName: string; }
interface Educator { ED_ID: string; ED_NAME: string; }
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; BENEF_CLASS_DESC: string; ED_ID?: string; ED_NAME?: string; }
interface Child { id: number; child_id: string; child_name: string; benef_id: string; cmam_qualify: string; }
interface HealthCenter { hc_id: string; hc_name: string; hw_id: string; hw_name: string; }


const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);


export default function ChildScreeningDataEntryPage() {
    const { toast } = useToast();
    
    // --- Data States ---
    const [projects, setProjects] = useState<Project[]>([]);
    const [educators, setEducators] = useState<Educator[]>([]);
    const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
    const [allChildren, setAllChildren] = useState<Child[]>([]);
    const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
    
    // --- Selections ---
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedEducatorId, setSelectedEducatorId] = useState("");
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<string>("");
    
    // --- UI States ---
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    const [childSearch, setChildSearch] = useState("");
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [educatorOpen, setEducatorOpen] = useState(false);

    const form = useForm({
        defaultValues: {
            isExistingChild: 'نعم',
            child_first_name: '',
            child_gender: undefined,
            new_child_age_mon: '',
            child_has_cmam: undefined,
            child_cmam_type: undefined,
            muac: 7.0,
            go_health_center: undefined,
            disc_date_day: '',
            disc_date_month: '',
            disc_date_year: '',
            near_health_center: '',
        }
    });

    const watchIsExisting = form.watch("isExistingChild");
    const watchHasCmam = form.watch("child_has_cmam");
    const watchFirstName = form.watch("child_first_name");
    const watchGender = form.watch("child_gender");

    // --- Init Fetch ---
    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({...p, projects: false})));
    }, []);

    const handleProjectSelect = async (projectId: string) => {
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
    };

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

    const moveToNextChild = useCallback(() => {
        if(childrenOfBeneficiary.length === 0) return;
        const currentIndex = childrenOfBeneficiary.findIndex(c => c.child_id === selectedChildId);
        if (currentIndex > -1 && currentIndex < childrenOfBeneficiary.length - 1) {
             const nextChild = childrenOfBeneficiary[currentIndex + 1];
             setSelectedChildId(nextChild.child_id);
             form.reset({ isExistingChild: 'نعم', child_has_cmam: undefined });
             toast({ title: "تم الانتقال", description: `تم الانتقال إلى الطفل التالي: ${nextChild.child_name}`});
        } else {
             toast({ title: "اكتملت القائمة", description: "تم الانتهاء من جميع الأطفال المؤهلين لهذه المستفيدة."});
             setSelectedChildId("");
        }
    }, [childrenOfBeneficiary, selectedChildId, form, toast]);

    const handleSave = async (data: any) => {
        if (!selectedBeneficiary) return;
        setLoading(p => ({...p, saving: true}));

        try {
            const hc = healthCenters.find(h => h.hc_name === data.near_health_center);
            const commonPayload = {
                project_id: selectedProjectId,
                child_has_cmam: data.child_has_cmam,
                child_cmam_type: data.child_has_cmam === 'نعم' ? data.child_cmam_type : null,
                muac: data.child_has_cmam === 'نعم' ? data.muac : null,
                go_health_center: data.child_has_cmam === 'نعم' ? data.go_health_center : null,
                disc_date: data.disc_date_year ? `${data.disc_date_year}-${data.disc_date_month}-${data.disc_date_day}` : null,
                near_health_center: hc?.hc_name,
                hc_id: hc?.hc_id, hc_name: hc?.hc_name, hw_id: hc?.hw_id, hw_name: hc?.hw_name
            };

            const payload = data.isExistingChild === 'نعم' 
                ? { action: 'update_child', payload: { ...commonPayload, child_id: selectedChildId } }
                : { 
                    action: 'create_new_child', 
                    payload: { 
                        ...commonPayload, 
                        benef_id: selectedBeneficiary.BENEF_ID,
                        child_first_name: data.child_first_name,
                        child_gender: data.child_gender,
                        new_child_age_mon: parseInt(data.new_child_age_mon)
                    } 
                  };

            const res = await fetch('/api/child-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "نجاح", description: "تم حفظ بيانات الطفل بنجاح" });

            if (data.isExistingChild === 'نعم') {
                moveToNextChild();
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
    const subscription = form.watch((value, { name }) => {
        // Only trigger if the specific field 'child_has_cmam' changed to 'لا'
        if (name === 'child_has_cmam' && value.child_has_cmam === 'لا') {
            if (value.isExistingChild === 'نعم' && selectedChildId) {
                
                // FIX: Wrap in a timeout to move execution out of the React render cycle
                setTimeout(() => {
                    handleSave({ 
                        child_has_cmam: 'لا', 
                        isExistingChild: 'نعم' 
                    } as any);
                }, 0);
                
            }
        }
    });
    return () => subscription.unsubscribe();
}, [form, handleSave, selectedChildId]);

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
                <h1 className="text-3xl font-bold text-foreground">إدخال نتائج الفحص (CMAM)</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening"><ArrowLeft className="mr-2 h-4 w-4"/> عودة</Link></Button>
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
                                <TableHeader className="bg-muted sticky top-0"><TableRow><TableHead className="w-[50px]">تحديد</TableHead><TableHead>رقم المستفيدة</TableHead><TableHead>اسم المستفيدة</TableHead></TableRow></TableHeader>
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
                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-8 pt-3">
                                                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="نعم" id="c_yes"/><Label htmlFor="c_yes" className="font-medium cursor-pointer m-0">نعم</Label></div>
                                                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="لا" id="c_no"/><Label htmlFor="c_no" className="font-medium cursor-pointer m-0">لا</Label></div>
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )} />

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
                                             <Button type="submit" size="lg" className="w-full md:w-auto" disabled={loading.saving || (watchHasCmam !== 'نعم' && watchHasCmam !== 'لا')}>
                                                 {loading.saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5"/>} Save Child Data
                                             </Button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}
            <div className="flex flex-wrap justify-end gap-2">
                                                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" asChild>
                                                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/preparing">
                                                        <List className="ml-2 h-4 w-4" /> Preparing Child CMAM List
                                                    </Link>
                                                </Button>
                                                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" asChild>
                                                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database">
                                                        <Database className="ml-2 h-4 w-4" /> Child CMAM Database
                                                    </Link>
                                                </Button>
                                                <Button variant="outline" className="border-green-500 text-green-500 hover:bg-green-500/10" asChild>
                                                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/export">
                                                        <FileText className="ml-2 h-4 w-4" /> Exporting Child CMAM Statements
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                
        );
}
