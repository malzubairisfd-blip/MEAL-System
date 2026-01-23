// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/edit-center/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const CenterSchema = z.object({
  id: z.any().optional(),
  project_id: z.string().min(1, "Project is required."),
  project_name: z.string().optional(),
  proj_no: z.coerce.number().optional(),
  mud_no: z.coerce.number().optional(),
  mud_name: z.string().min(1, "District name is required."),
  ozla_no: z.coerce.number().optional(),
  ozla_name: z.string().min(1, "Sub-district name is required."),
  vill_no: z.coerce.number().optional(),
  vill_name: z.string().min(1, "Village name is required."),
  fac_id: z.string().min(1, "Facility ID is required."),
  fac_name: z.string().min(1, "Facility name is required."),
  loc_id: z.coerce.number().optional(),
  loc_full_name: z.string().optional(),
  is_ec: z.coerce.number().optional(),
  is_pc: z.coerce.number().optional(),
  pc_id: z.string().optional(),
  notes: z.string().optional(),
  pc_name2: z.string().optional(),
  is_pc2: z.coerce.number().optional(),
  pc_loc2: z.coerce.number().optional(),
  same_ozla: z.coerce.boolean().optional(),
  same_ec_pc: z.coerce.boolean().optional(),
});

type FormValues = z.infer<typeof CenterSchema>;

interface Project {
  projectId: string;
  projectName: string;
  governorates: string[];
  districts: string[];
}

interface Location {
  gov_name: string;
  mud_name: string;
  ozla_name: string;
  vill_name: string;
  mud_loc_id: number;
  ozla_loc_id: number;
  vill_loc_id: number;
}

interface Epc {
  fac_id: string;
  fac_name: string;
  mud_name: string;
  loc_id: string;
  is_pc: '1' | '0' | 'yes' | 'no';
}

const normalizeArabic = (s: string | null | undefined): string => {
    if (!s) return "";
    return String(s)
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/\s+/g, ' ')
        .trim();
};

function EditCenterPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const FAC_ID = searchParams.get('FAC_ID');
    
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [epcs, setEpcs] = useState<Epc[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(CenterSchema),
    });

    const { control, watch, setValue, reset } = form;
    
    useEffect(() => {
        if (!FAC_ID) {
            toast({ title: "Error", description: "No center ID provided.", variant: "destructive" });
            router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification');
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const [projRes, locRes, centerRes, allEpcsRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch('/api/locations'),
                    fetch(`/api/education-payment-centers?FAC_ID=${FAC_ID}`),
                    fetch('/api/education-payment-centers')
                ]);
                
                if (projRes.ok) setProjects(await projRes.json());
                if (locRes.ok) setLocations(await locRes.json());
                if (allEpcsRes.ok) setEpcs(await allEpcsRes.json());
                
                if (centerRes.ok) {
                    const centerToEdit = await centerRes.json();
                     reset({
                        ...centerToEdit,
                        is_pc: String(centerToEdit.is_pc),
                    });
                } else {
                     throw new Error("Center not found or failed to load.");
                }
            } catch (error: any) {
                toast({ title: "Failed to load data", description: error.message, variant: "destructive" });
                router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [FAC_ID, toast, router, reset]);

    const selectedProjectId = watch('project_id');
    const selectedMudName = watch('mud_name');
    const selectedOzlaName = watch('ozla_name');
    const selectedVillName = watch('vill_name');
    const isPc = watch('is_pc');
    const pcId = watch('pc_id');
    
    const projectOptions = useMemo(() => projects, [projects]);
    
    const mudOptions = useMemo(() => {
        if (!selectedProjectId) return [];
        const project = projects.find(p => p.projectId === selectedProjectId);
        if (!project) return [];
        const projectDistricts = new Set(project.districts.map(d => normalizeArabic(d)));
        return Array.from(new Set(locations
            .filter(l => projectDistricts.has(normalizeArabic(l.mud_name)))
            .map(l => l.mud_name)));
    }, [selectedProjectId, projects, locations]);

    const ozlaOptions = useMemo(() => {
        if (!selectedMudName) return [];
        return Array.from(new Set(locations.filter(l => normalizeArabic(l.mud_name) === normalizeArabic(selectedMudName)).map(l => l.ozla_name)));
    }, [selectedMudName, locations]);
    
    const villOptions = useMemo(() => {
        if (!selectedOzlaName) return [];
        return Array.from(new Set(locations.filter(l => normalizeArabic(l.ozla_name) === normalizeArabic(selectedOzlaName)).map(l => l.vill_name)));
    }, [selectedOzlaName, locations]);

    const paymentCenterOptions = useMemo(() => {
        if (!selectedMudName) return [];
        return epcs.filter(e => (String(e.is_pc) === '1' || String(e.is_pc) === 'yes') && normalizeArabic(e.mud_name) === normalizeArabic(selectedMudName));
    }, [epcs, selectedMudName]);
    
    useEffect(() => {
        const location = locations.find(l => normalizeArabic(l.mud_name) === normalizeArabic(selectedMudName) && normalizeArabic(l.ozla_name) === normalizeArabic(selectedOzlaName) && normalizeArabic(l.vill_name) === normalizeArabic(selectedVillName));
        if (location) {
            setValue('mud_no', location.mud_loc_id);
            setValue('ozla_no', location.ozla_loc_id);
            setValue('vill_no', location.vill_loc_id);
            setValue('loc_id', location.vill_loc_id);
            setValue('loc_full_name', `${location.gov_name}/${location.mud_name}/${location.ozla_name}/${location.vill_name}`);
        }
    }, [selectedMudName, selectedOzlaName, selectedVillName, locations, setValue]);
    
    useEffect(() => {
      if (String(isPc) === '1') {
        setValue('pc_id', watch('fac_id'));
        setValue('pc_name2', watch('fac_name'));
        setValue('pc_loc2', watch('loc_id'));
        setValue('is_pc2', 1);
      }
    }, [isPc, setValue, watch]);
    
    useEffect(() => {
      if(String(isPc) === '0' && pcId) {
        const selectedEpc = epcs.find(e => e.fac_id === pcId);
        if(selectedEpc) {
          setValue('pc_name2', selectedEpc.fac_name);
          setValue('pc_loc2', Number(selectedEpc.loc_id));
        }
      }
    }, [isPc, pcId, epcs, setValue]);
    
    useEffect(() => {
        const locId = watch('loc_id');
        const pcLoc2 = watch('pc_loc2');
        if (String(isPc) === '1') {
            setValue('same_ozla', true);
        } else if (locId && pcLoc2) {
            setValue('same_ozla', String(locId).substring(0, 6) === String(pcLoc2).substring(0, 6));
        }
    }, [isPc, watch, setValue]);
    
    useEffect(() => {
        setValue('same_ec_pc', watch('pc_id') === watch('fac_id'));
    }, [watch, setValue]);

    const onSubmit = async (data: FormValues) => {
        setIsSaving(true);
        try {
             const payload = { ...data, is_pc: Number(data.is_pc), is_ec: data.is_ec === 'yes' ? 1 : 0 };
            const response = await fetch('/api/education-payment-centers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Failed to update the center.');
            toast({ title: "Success", description: "Center has been updated." });
            router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || !form.getValues('fac_id')) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Edit Center</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader><CardTitle>Location Details</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField control={control} name="project_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger></FormControl>
                                        <SelectContent>{projectOptions.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={control} name="mud_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>District (MUD_NAME)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger></FormControl>
                                        <SelectContent>{mudOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                     <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="ozla_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sub-District (OZLA_NAME)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedMudName}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Sub-District" /></SelectTrigger></FormControl>
                                        <SelectContent>{ozlaOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                    </Select>
                                     <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="vill_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Village (VILL_NAME)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedOzlaName}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Village" /></SelectTrigger></FormControl>
                                        <SelectContent>{villOptions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                    </Select>
                                     <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader><CardTitle>Center Identification</CardTitle></CardHeader>
                         <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={control} name="fac_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Facility ID (FAC_ID)</FormLabel>
                                    <FormControl><Input {...field} readOnly /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="fac_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Facility Name (FAC_NAME)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                         </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Center Type & Payment Info</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={control} name="is_ec" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Is Education Center (IS_EC)?</FormLabel>
                                    <Select onValueChange={field.onChange} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">Yes</SelectItem>
                                            <SelectItem value="0">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="is_pc" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Is Payment Center (IS_PC)?</FormLabel>
                                    <Select onValueChange={field.onChange} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">Yes</SelectItem>
                                            <SelectItem value="0">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            {(String(isPc) === '0') && (
                                <FormField control={control} name="pc_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Center ID (PC_ID)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedMudName}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Payment Center" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {paymentCenterOptions.map(e => (
                                                    <SelectItem key={e.fac_id} value={e.fac_id}>{e.fac_name} ({e.fac_id})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Additional Info & Notes</CardTitle></CardHeader>
                        <CardContent>
                             <FormField control={control} name="notes" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl><Textarea {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                     <div className="flex justify-end">
                         <Button type="submit" size="lg" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}

export default function EditCenterPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <EditCenterPageContent />
        </Suspense>
    );
}