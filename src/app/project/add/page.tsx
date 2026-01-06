// src/app/project/add/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FeatureCollection } from 'geojson';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';


// --- Zod Schema for Validation ---
const projectSchema = z.object({
  projectId: z.string().regex(/^[a-zA-Z0-9-]+$/, "Only numbers, letters, and hyphens are allowed.").min(1, "Project ID is required."),
  projectName: z.string().min(1, "Project Name is required.").max(100, "Project Name must be 100 characters or less."),
  governorates: z.array(z.string()).min(1, "At least one governorate is required."),
  districts: z.array(z.string()).min(1, "At least one district is required."),
  subDistricts: z.array(z.string()).min(1, "At least one sub-district is required."),
  villages: z.coerce.number().min(1, "Number of villages is required."),
  startDateMonth: z.string().min(1, "Start month is required."),
  startDateYear: z.string().min(1, "Start year is required."),
  endDateMonth: z.string().min(1, "End month is required."),
  endDateYear: z.string().min(1, "End year is required."),
  beneficiaries: z.coerce.number().min(1, "Total beneficiaries is required."),
  budget: z.coerce.number().min(0, "Budget is required."),
  status: z.enum(['Completed', 'Ongoing'], { required_error: "Project status is required." }),
  summary: z.string().min(100, "Summary must be at least 100 characters.").max(500, "Summary must be 500 characters or less."),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// --- Multi-Select Combobox Component ---
interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

const MultiSelectCombobox = ({ options, value, onChange, placeholder = "Select items..." }: MultiSelectProps) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (selectedValue: string) => {
        const newSelected = value.includes(selectedValue)
            ? value.filter(v => v !== selectedValue)
            : [...value, selectedValue];
        onChange(newSelected);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto min-h-10">
                    <div className="flex flex-wrap gap-1">
                        {value.length > 0 ? (
                            value.map(val => (
                                <Badge key={val} variant="secondary" className="mr-1">
                                    {val}
                                    <span
                                        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); handleSelect(val); }}
                                    >
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </span>
                                </Badge>
                            ))
                        ) : (
                            <span>{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map(option => (
                                <CommandItem
                                    key={option.value}
                                    onSelect={() => handleSelect(option.value)}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};


// --- Main Form Page Component ---
export default function AddProjectPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [admin1Data, setAdmin1Data] = useState<string[]>([]);
    const [admin2Data, setAdmin2Data] = useState<string[]>([]);
    const [admin3Data, setAdmin3Data] = useState<string[]>([]);

    useEffect(() => {
      const fetchData = async (path: string, setter: React.Dispatch<React.SetStateAction<string[]>>, key: string) => {
        try {
          const res = await fetch(path);
          const geojson: FeatureCollection = await res.json();
          const names = new Set(geojson.features.map(f => f.properties?.[key]).filter(Boolean));
          setter(Array.from(names) as string[]);
        } catch (error) {
          console.error(`Failed to load ${path}`, error);
        }
      };
      fetchData('/data/yemen_admin1.geojson', setAdmin1Data, 'ADM1_AR');
      fetchData('/data/yemen_admin2.geojson', setAdmin2Data, 'ADM2_AR');
      fetchData('/data/yemen_admin3.geojson', setAdmin3Data, 'ADM3_AR');
    }, []);

    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectId: "",
            projectName: "",
            governorates: [],
            districts: [],
            subDistricts: [],
            villages: 0,
            beneficiaries: 0,
            budget: 0,
            summary: "",
        },
    });

    const summaryLength = form.watch('summary')?.length || 0;
    const projectNameLength = form.watch('projectName')?.length || 0;

    const onSubmit = async (data: ProjectFormValues) => {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "An unknown error occurred.");
            }
            toast({
                title: "Project Saved!",
                description: `Project "${data.projectName}" has been successfully created.`,
            });
            router.push('/project');
        } catch (error: any) {
            toast({
                title: "Submission Failed",
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const months = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);
    const years = useMemo(() => Array.from({ length: 21 }, (_, i) => String(new Date().getFullYear() - 10 + i)), []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Add New Project</h1>
                <Button variant="outline" asChild>
                    <Link href="/project">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Project Information Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Project Information</CardTitle>
                            <CardDescription>Provide the core details of the project.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project ID</FormLabel>
                                    <FormControl><Input placeholder="e.g., PROJ-123-YEM" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="projectName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project Name</FormLabel>
                                    <FormControl><Input placeholder="Enter project name..." {...field} /></FormControl>
                                    <FormDescription>{projectNameLength}/100</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="governorates" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Governorate(s)</FormLabel>
                                    <MultiSelectCombobox options={admin1Data.map(g => ({ value: g, label: g }))} value={field.value} onChange={field.onChange} placeholder="Select governorates..." />
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="districts" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>District(s)</FormLabel>
                                    <MultiSelectCombobox options={admin2Data.map(d => ({ value: d, label: d }))} value={field.value} onChange={field.onChange} placeholder="Select districts..." />
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="subDistricts" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sub-District(s)</FormLabel>
                                    <MultiSelectCombobox options={admin3Data.map(s => ({ value: s, label: s }))} value={field.value} onChange={field.onChange} placeholder="Select sub-districts..." />
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="villages" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>No. of Villages</FormLabel>
                                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="startDateMonth" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl>
                                            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                 <FormField control={form.control} name="startDateYear" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>&nbsp;</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl>
                                            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="endDateMonth" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Date</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl>
                                            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                 <FormField control={form.control} name="endDateYear" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>&nbsp;</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl>
                                            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                             <FormField control={form.control} name="beneficiaries" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Beneficiaries</FormLabel>
                                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="budget" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Budget</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                              <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Ongoing">Ongoing</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    {/* Professional Summary Section */}
                    <Card>
                         <CardHeader>
                            <CardTitle>2. Professional Summary</CardTitle>
                            <CardDescription>Provide a concise summary of the project (100-500 characters).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormField control={form.control} name="summary" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                      <textarea
                                          {...field}
                                          className="w-full min-h-[150px] p-3 rounded-md border border-input text-sm"
                                          placeholder="Write your project summary here..."
                                      />
                                    </FormControl>
                                     <FormDescription className="flex justify-end">
                                        <span className={cn(summaryLength < 100 || summaryLength > 500 ? 'text-destructive' : 'text-muted-foreground')}>
                                          {summaryLength}/500
                                        </span>
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    {/* Submission Button */}
                    <div className="flex justify-end">
                         <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save & Submit Project
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
