// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-center/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  PROJ_NO: z.literal(2),
  MUD_NO: z.number({ required_error: "MUD_NO is required." }),
  MUD_NAME: z.string().min(1, "District name is required."),
  OZLA_NO: z.number({ required_error: "OZLA_NO is required." }),
  OZLA_NAME: z.string().min(1, "Sub-district name is required."),
  VILL_NO: z.number({ required_error: "VILL_NO is required." }),
  VILL_NAME: z.string().min(1, "Village name is required."),
  FAC_ID: z.string().min(1, "Facility ID is required."),
  FAC_TYPE: z.string().min(1, "Facility type is required."),
  FAC_TEXT: z.string().min(1, "Facility text is required."),
  FAC_NAME: z.string().min(1, "Facility name is required."),
  LOC_ID: z.string().min(1, "Location ID is required."),
  LOC_FULL_NAME: z.string().min(1, "Full location name is required."),
  IS_EC: z.enum(['yes', 'no'], { required_error: "IS_EC is required." }),
  IS_PC: z.enum(['1', '0'], { required_error: "IS_PC is required." }),
  PC_ID: z.string().min(1, "PC_ID is required."),
  NOTES: z.string().optional(),
  PC_NAME2: z.string().optional(),
  IS_PC2: z.number().optional(),
  PC_LOC2: z.string().optional(),
  SAME_OZLA: z.boolean().optional(),
  same_ec_pc: z.boolean().optional(),
  projectId: z.string().min(1, "Project is required."),
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
  FAC_ID: string;
  FAC_NAME: string;
  LOC_ID: string;
  IS_PC: '1' | '0';
}

export default function AddCenterPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // Data states
    const [projects, setProjects] = useState<Project[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [epcs, setEpcs] = useState<Epc[]>([]);
    const [nextS, setNextS] = useState(1);
    const [nextFacId, setNextFacId] = useState('2-30361');

    const form = useForm<FormValues>({
        resolver: zodResolver(CenterSchema),
        defaultValues: { PROJ_NO: 2 },
    });

    const { control, watch, setValue } = form;

    const selectedProject = watch('projectId');
    const selectedMudName = watch('MUD_NAME');
    const selectedOzlaName = watch('OZLA_NAME');
    const selectedVillName = watch('VILL_NAME');
    const facType = watch('FAC_TYPE');
    const facText = watch('FAC_TEXT');
    const isPc = watch('IS_PC');
    const pcId = watch('PC_ID');

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [projRes, locRes, epcRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch('/api/locations'),
                    fetch('/api/education-payment-centers')
                ]);
                if (projRes.ok) setProjects(await projRes.json());
                if (locRes.ok) setLocations(await locRes.json());
                if (epcRes.ok) {
                  const data = await epcRes.json();
                  setEpcs(data);
                  setNextS(data.length + 1);
                  const lastFacId = data.length > 0 ? Math.max(...data.map((c: Epc) => parseInt(c.FAC_ID.split('-')[1]))) : 30360;
                  setNextFacId(`2-${lastFacId + 1}`);
                }
            } catch (error) {
                toast({ title: "Failed to load initial data", variant: "destructive" });
            }
        };
        fetchData();
    }, [toast]);
    
    // Auto-generate FAC_ID
    useEffect(() => {
      setValue('FAC_ID', nextFacId);
    }, [nextFacId, setValue]);

    // Derived options for selects
    const projectOptions = useMemo(() => projects, [projects]);
    const mudOptions = useMemo(() => {
        if (!selectedProject) return [];
        const project = projects.find(p => p.projectId === selectedProject);
        if (!project) return [];
        return Array.from(new Set(locations
            .filter(l => project.districts.includes(l.mud_name) && project.governorates.includes(l.gov_name))
            .map(l => l.mud_name)));
    }, [selectedProject, projects, locations]);

    const ozlaOptions = useMemo(() => {
        if (!selectedMudName) return [];
        return Array.from(new Set(locations.filter(l => l.mud_name === selectedMudName).map(l => l.ozla_name)));
    }, [selectedMudName, locations]);
    
    const villOptions = useMemo(() => {
        if (!selectedOzlaName) return [];
        return Array.from(new Set(locations.filter(l => l.ozla_name === selectedOzlaName).map(l => l.vill_name)));
    }, [selectedOzlaName, locations]);

    // Update form values based on selections
    useEffect(() => {
        const location = locations.find(l => l.mud_name === selectedMudName && l.ozla_name === selectedOzlaName && l.vill_name === selectedVillName);
        if (location) {
            setValue('MUD_NO', location.mud_loc_id);
            setValue('OZLA_NO', location.ozla_loc_id);
            setValue('VILL_NO', location.vill_loc_id);
            setValue('LOC_ID', String(location.vill_loc_id));
            setValue('LOC_FULL_NAME', `${location.gov_name}/${location.mud_name}/${location.ozla_name}/${location.vill_name}`);
        }
    }, [selectedMudName, selectedOzlaName, selectedVillName, locations, setValue]);

    // Generate FAC_NAME
    useEffect(() => {
        if (facType && facText && selectedVillName) {
            setValue('FAC_NAME', `${facType} ${facText} - ${selectedVillName}`);
        }
    }, [facType, facText, selectedVillName, setValue]);

    // Handle PC_ID logic
    useEffect(() => {
      if (isPc === '1') {
        setValue('PC_ID', watch('FAC_ID'));
        setValue('PC_NAME2', watch('FAC_NAME'));
        setValue('PC_LOC2', watch('LOC_ID'));
        setValue('IS_PC2', 1);
      }
    }, [isPc, setValue, watch]);
    
    useEffect(() => {
      if(isPc === '0' && pcId) {
        const selectedEpc = epcs.find(e => e.FAC_ID === pcId);
        if(selectedEpc) {
          setValue('PC_NAME2', selectedEpc.FAC_NAME);
          setValue('PC_LOC2', selectedEpc.LOC_ID);
        }
      }
    }, [isPc, pcId, epcs, setValue]);

    // Calculate SAME_OZLA
    useEffect(() => {
        const locId = watch('LOC_ID');
        const pcLoc2 = watch('PC_LOC2');
        if (isPc === '1') {
            setValue('SAME_OZLA', true);
        } else if (locId && pcLoc2) {
            setValue('SAME_OZLA', locId.substring(0, 6) === pcLoc2.substring(0, 6));
        }
    }, [isPc, watch, setValue]);
    
    // Calculate same_ec_pc
    useEffect(() => {
        setValue('same_ec_pc', watch('PC_ID') === watch('FAC_ID'));
    }, [watch, setValue]);


    const onSubmit = async (data: FormValues) => {
        setIsSaving(true);
        try {
            const payload = { ...data, S: nextS };
            const response = await fetch('/api/education-payment-centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Failed to save the center.');
            toast({ title: "Success", description: "New center has been added." });
            router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Add New Education/Payment Center</h1>
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
                            <FormField control={control} name="projectId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger></FormControl>
                                        <SelectContent>{projectOptions.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={control} name="MUD_NAME" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>District (MUD_NAME)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProject}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger></FormControl>
                                        <SelectContent>{mudOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                     <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="OZLA_NAME" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sub-District (OZLA_NAME)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedMudName}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Sub-District" /></SelectTrigger></FormControl>
                                        <SelectContent>{ozlaOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                    </Select>
                                     <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="VILL_NAME" render={({ field }) => (
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
                              <FormField control={control} name="FAC_ID" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Facility ID (FAC_ID)</FormLabel>
                                    <FormControl><Input {...field} readOnly /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="space-y-2">
                                <FormLabel>Facility Name (FAC_NAME)</FormLabel>
                                <FormField control={control} name="FAC_TYPE" render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Facility Type" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="مدرسة">مدرسة</SelectItem>
                                                <SelectItem value="ملحق جامع">ملحق جامع</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                 <FormField control={control} name="FAC_TEXT" render={({ field }) => (
                                    <FormItem>
                                        <FormControl><Input {...field} placeholder="Enter facility text..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                 <FormField control={control} name="FAC_NAME" render={({ field }) => (
                                    <FormItem>
                                        <FormControl><Input {...field} readOnly placeholder="Generated Name..." /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                         </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Center Type & Payment Info</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={control} name="IS_EC" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Is Education Center (IS_EC)?</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={control} name="IS_PC" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Is Payment Center (IS_PC)?</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">Yes</SelectItem>
                                            <SelectItem value="0">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            {isPc === '0' && (
                                <FormField control={control} name="PC_ID" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Center ID (PC_ID)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Payment Center" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {epcs.filter(e => e.IS_PC === '1').map(e => (
                                                    <SelectItem key={e.FAC_ID} value={e.FAC_ID}>{e.FAC_NAME} ({e.FAC_ID})</SelectItem>
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
                             <FormField control={control} name="NOTES" render={({ field }) => (
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
                            Save & Submit Center
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
