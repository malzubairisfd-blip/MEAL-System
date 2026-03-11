// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/entry/page.tsx
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ChevronsUpDown, Check, Loader2, Search, Database, FileDown, FileEdit, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Project { projectId: string; projectName: string; }
interface Educator { ED_ID: string; ED_NAME: string; }
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; ED_ID: string; [key: string]: any; }
interface HealthCenter { hc_id: string; hc_name: string; hw_id: string; hw_name: string;}

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

const formSchema = z.object({
  bnf_has_cmam: z.enum(['نعم', 'لا']),
  bnf_preg_lec: z.enum(['حامل', 'مرضع']).optional(),
  preg_mon: z.string().optional(),
  child_age: z.string().optional(),
  muac: z.number().optional(),
  go_health_center: z.enum(['نعم', 'لا']).optional(),
  disc_date_day: z.string().optional(),
  disc_date_month: z.string().optional(),
  disc_date_year: z.string().optional(),
  near_health_center: z.string().optional(),
}).refine(data => {
    if (data.bnf_has_cmam === 'لا') return true; // If 'No', no other fields are required
    // If 'Yes', all subsequent fields are required
    return data.bnf_preg_lec && data.muac && data.go_health_center && data.disc_date_day && data.disc_date_month && data.disc_date_year;
}, {
    message: "All fields are required when malnutrition is 'Yes'",
    path: ['bnf_has_cmam'], // You can associate this error with a specific field if you want
});


export default function ScreeningDataEntryPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [educators, setEducators] = useState<Educator[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);

    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedEducatorId, setSelectedEducatorId] = useState("");
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | null>(null);
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });

    const form = useForm<z.infer<typeof formSchema>>({ 
        resolver: zodResolver(formSchema),
        defaultValues: {
            muac: 17,
            bnf_has_cmam: undefined,
            bnf_preg_lec: undefined,
            preg_mon: undefined,
            child_age: undefined,
            go_health_center: undefined,
            disc_date_day: undefined,
            disc_date_month: undefined,
            disc_date_year: undefined,
            near_health_center: undefined
        }
    });
    const watchHasCmam = form.watch("bnf_has_cmam");
    const watchPregLec = form.watch("bnf_preg_lec");
    
    const [healthCenterPopoverOpen, setHealthCenterPopoverOpen] = useState(false);

    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({...p, projects: false})));
    }, []);

    useEffect(() => {
        if (!selectedProjectId) { setEducators([]); setBeneficiaries([]); setHealthCenters([]); return; }
        setLoading(p => ({...p, data: true}));
        Promise.all([
            fetch('/api/bnf-cmam').then(res => res.json()),
            fetch('/api/health-centers').then(res => res.json())
        ]).then(([cmamData, hcData]) => {
            const projectCmams = cmamData.filter((r: any) => r.project_id === selectedProjectId);
            const uniqueEducators: Educator[] = Array.from(new Map(projectCmams.map((item: any) => [item.ED_ID, item])).values());
            setEducators(uniqueEducators);
            setBeneficiaries(projectCmams);
            
            const projectHCs = hcData.filter((r: any) => r.project_id === selectedProjectId);
            setHealthCenters(projectHCs);
            
        }).catch(err => toast({ title: "Error loading data", description: err.message, variant: "destructive" }))
          .finally(() => setLoading(p => ({...p, data: false})));
    }, [selectedProjectId, toast]);

    const filteredBeneficiaries = useMemo(() => {
        let filtered = beneficiaries.filter(b => b.cmam_qualify === 'Qualified');
        if (selectedEducatorId) {
            filtered = filtered.filter(b => b.ED_ID === selectedEducatorId);
        }
        if (beneficiarySearch) {
            const lowerSearch = beneficiarySearch.toLowerCase();
            filtered = filtered.filter(b => 
                String(b.BENEF_ID).toLowerCase().includes(lowerSearch) || 
                b.BENEF_NAME.toLowerCase().includes(lowerSearch)
            );
        }
        return filtered;
    }, [beneficiaries, selectedEducatorId, beneficiarySearch]);
    
    const moveToNextBeneficiary = useCallback(() => {
        form.reset({
            muac: 17,
            bnf_has_cmam: undefined,
            bnf_preg_lec: undefined,
            preg_mon: undefined,
            child_age: undefined,
            go_health_center: undefined,
            disc_date_day: undefined,
            disc_date_month: undefined,
            disc_date_year: undefined,
            near_health_center: undefined
        });
        const currentIndex = filteredBeneficiaries.findIndex(b => b.id === selectedBeneficiaryId);
        if (currentIndex !== -1 && currentIndex < filteredBeneficiaries.length - 1) {
            setSelectedBeneficiaryId(filteredBeneficiaries[currentIndex + 1].id);
        } else {
             toast({ title: "End of List", description: "You have reviewed all beneficiaries for this educator."});
             setSelectedBeneficiaryId(null);
        }
    }, [filteredBeneficiaries, selectedBeneficiaryId, form, toast]);

    const handleCmamDecision = useCallback(async (value: 'نعم' | 'لا') => {
        if (value === 'لا' && selectedBeneficiaryId) {
             setLoading(p => ({...p, saving: true}));
             try {
                const res = await fetch('/api/bnf-cmam', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([{ id: selectedBeneficiaryId, bnf_has_cmam: 'لا' }]),
                });
                if (!res.ok) throw new Error("Failed to update record.");
                toast({ title: "Record Updated", description: "Beneficiary marked as not having malnutrition." });
                moveToNextBeneficiary();
             } catch(err: any) {
                toast({ title: "Update Error", description: err.message, variant: "destructive"});
             } finally {
                setLoading(p => ({...p, saving: false}));
             }
        }
    }, [selectedBeneficiaryId, toast, moveToNextBeneficiary]);
    
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'bnf_has_cmam') {
                handleCmamDecision(value.bnf_has_cmam as 'نعم' | 'لا');
            }
        });
        return () => subscription.unsubscribe();
    }, [form, handleCmamDecision]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!selectedBeneficiaryId) {
            toast({ title: "No beneficiary selected", variant: "destructive" });
            return;
        }

        setLoading(p => ({...p, saving: true}));
        const selectedHC = healthCenters.find(hc => hc.hc_name === data.near_health_center);

        const payload = {
            id: selectedBeneficiaryId,
            ...data,
            disc_date: `${data.disc_date_year}-${data.disc_date_month}-${data.disc_date_day}`,
            hc_id: selectedHC?.hc_id,
            hc_name: selectedHC?.hc_name,
            hw_id: selectedHC?.hw_id,
            hw_name: selectedHC?.hw_name
        };

        try {
            const res = await fetch('/api/bnf-cmam', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([payload]),
            });
            if (!res.ok) throw new Error("Failed to save screening results.");
            toast({ title: "Success", description: "Screening results saved." });
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
                <h1 className="text-3xl font-bold">CMAM Screening: Data Entry</h1>
                <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening"><ArrowLeft className="mr-2 h-4 w-4"/>Back</Link></Button>
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/database"><Database className="mr-2 h-4 w-4"/>Database</Link></Button>
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/export"><FileDown className="mr-2 h-4 w-4"/>Export</Link></Button>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>1. Select Project & Educator</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={selectedEducatorId} onValueChange={setSelectedEducatorId} disabled={!selectedProjectId}>
                         <SelectTrigger><SelectValue placeholder="Select Educator..." /></SelectTrigger>
                         <SelectContent>{educators.map(e => <SelectItem key={e.ED_ID} value={e.ED_ID}>{e.ED_NAME} ({e.ED_ID})</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle>اختيار المستفيدة</CardTitle></CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by ID or name..." className="pl-8" value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-96 mt-4 border rounded-md">
                            <RadioGroup value={String(selectedBeneficiaryId)} onValueChange={id => setSelectedBeneficiaryId(Number(id))} className="p-2">
                               {filteredBeneficiaries.map(bnf => (
                                <div key={bnf.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md">
                                    <RadioGroupItem value={String(bnf.id)} id={`bnf-${bnf.id}`} />
                                    <Label htmlFor={`bnf-${bnf.id}`} className="flex flex-col">
                                        <span>{bnf.BENEF_NAME}</span>
                                        <span className="text-xs text-muted-foreground">{bnf.BENEF_ID}</span>
                                    </Label>
                                </div>
                               ))}
                            </RadioGroup>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <CardHeader><CardTitle>Screening Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                 <FormField
                                    control={form.control}
                                    name="bnf_has_cmam"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>هل تعاني المستفيدة من سوء تغذية؟</FormLabel>
                                        <FormControl>
                                            <div className="flex gap-4 pt-2">
                                                <Button
                                                    type="button"
                                                    variant={field.value === 'نعم' ? 'default' : 'outline'}
                                                    onClick={() => field.onChange('نعم')}
                                                    className="flex-1"
                                                >
                                                    نعم
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={field.value === 'لا' ? 'destructive' : 'outline'}
                                                    onClick={() => field.onChange('لا')}
                                                    className="flex-1"
                                                >
                                                    لا
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                {watchHasCmam === 'نعم' && (
                                <>
                                <FormField control={form.control} name="bnf_preg_lec" render={({ field }) => (
                                    <FormItem><FormLabel>حالة المستفيدة حاليا</FormLabel>
                                        <FormControl>
                                            <div className="flex gap-4 pt-2">
                                                <Button type="button" variant={field.value === 'حامل' ? 'default' : 'outline'} onClick={() => field.onChange('حامل')} className="flex-1">حامل</Button>
                                                <Button type="button" variant={field.value === 'مرضع' ? 'default' : 'outline'} onClick={() => field.onChange('مرضع')} className="flex-1">مرضع</Button>
                                            </div>
                                        </FormControl>
                                    <FormMessage /></FormItem>
                                )} />
                                {watchPregLec === 'حامل' && (
                                <FormField control={form.control} name="preg_mon" render={({ field }) => (
                                <FormItem><FormLabel>شهر الحمل: {field.value || 1}</FormLabel>
                                <FormControl><Slider min={1} max={9} step={1} value={[Number(field.value) || 1]} onValueChange={(v) => field.onChange(String(v[0]))} /></FormControl>
                                <FormMessage /></FormItem>
                                )}/>
                                )}
                                {watchPregLec === 'مرضع' && (
                                <FormField control={form.control} name="child_age" render={({ field }) => (
                                <FormItem><FormLabel>عمر الرضيع: {field.value || 1}</FormLabel>
                                <FormControl><Slider min={1} max={6} step={1} value={[Number(field.value) || 1]} onValueChange={(v) => field.onChange(String(v[0]))} /></FormControl>
                                <FormMessage /></FormItem>
                                )}/>
                                )}
                                <FormField control={form.control} name="muac" render={({ field }) => (
                                <FormItem><FormLabel>قياس المواك: {field.value || 17}</FormLabel>
                                <FormControl><Slider min={17} max={26} step={0.1} value={[field.value || 17]} onValueChange={(v) => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>
                                )} />
                                 <FormField control={form.control} name="go_health_center" render={({ field }) => (
                                    <FormItem><FormLabel>هل تذهب الى المرفق الصحي؟</FormLabel>
                                        <FormControl>
                                            <div className="flex gap-4 pt-2">
                                                <Button type="button" variant={field.value === 'نعم' ? 'default' : 'outline'} onClick={() => field.onChange('نعم')} className="flex-1">نعم</Button>
                                                <Button type="button" variant={field.value === 'لا' ? 'destructive' : 'outline'} onClick={() => field.onChange('لا')} className="flex-1">لا</Button>
                                            </div>
                                        </FormControl>
                                    <FormMessage /></FormItem>
                                )} />
                                <div className="space-y-2">
                                <Label>تاريخ اكتشاف الحالة</Label>
                                <div className="grid grid-cols-3 gap-2">
                                <FormField control={form.control} name="disc_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day"/></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                <FormField control={form.control} name="disc_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                <FormField control={form.control} name="disc_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="near_health_center"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>اقرب مركز صحي للذهاب الية</FormLabel>
                                        <Popover open={healthCenterPopoverOpen} onOpenChange={setHealthCenterPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value
                                                        ? healthCenters.find(
                                                            (hc) => hc.hc_name === field.value
                                                            )?.hc_name
                                                        : "Select health center..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search health center..." />
                                                    <CommandEmpty>No health center found.</CommandEmpty>
                                                    <CommandList>
                                                        <ScrollArea className="h-60">
                                                        {healthCenters.map((hc) => (
                                                            <CommandItem
                                                                value={hc.hc_name}
                                                                key={hc.hc_id}
                                                                onSelect={() => {
                                                                    form.setValue("near_health_center", hc.hc_name)
                                                                    setHealthCenterPopoverOpen(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        hc.hc_name === field.value
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                    )}
                                                                />
                                                                {hc.hc_name}
                                                            </CommandItem>
                                                        ))}
                                                        </ScrollArea>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={loading.saving}>{loading.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update & Next</Button>
                                </>
                                )}
                            </CardContent>
                        </form>
                    </Form>
                </Card>
            </div>
        </div>
    );
}
