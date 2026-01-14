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
  S: z.number(),
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
  IS_EC: z.enum(['yes', 'no', '1', '0']),
  IS_PC: z.enum(['1', '0', 'yes', 'no']),
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
  MUD_NAME: string;
  LOC_ID: string;
  IS_PC: '1' | '0' | 'yes' | 'no';
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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [projRes, locRes, epcRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch('/api/locations'),
                    fetch('/api/education-payment-centers')
                ]);
                
                const projectsData = projRes.ok ? await projRes.json() : [];
                const locationsData = locRes.ok ? await locRes.json() : [];
                const epcsData = epcRes.ok ? await epcRes.json() : [];

                setProjects(projectsData);
                setLocations(locationsData);
                setEpcs(epcsData);

                if (FAC_ID) {
                    const centerToEdit = epcsData.find((c: Epc) => c.FAC_ID === FAC_ID);
                    if (centerToEdit) {
                        form.reset(centerToEdit);
                    } else {
                        toast({ title: "Error", description: "Center not found.", variant: "destructive" });
                        router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification');
                    }
                } else {
                     toast({ title: "Error", description: "No center ID provided.", variant: "destructive" });
                     router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification');
                }
            } catch (error) {
                toast({ title: "Failed to load initial data", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [FAC_ID, toast, router, form]);
    
    const { control, watch, setValue } = form;

    const onSubmit = async (data: FormValues) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/education-payment-centers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
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

    if (loading) {
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
                   {/* Form is identical to add-center, but pre-filled */}
                   <p>Editing form fields will go here, replicating the 'add-center' structure but populated with fetched data.</p>
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


