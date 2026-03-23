// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/entry/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Loader2, Search, Check, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// --- Types ---
interface Project { projectId: string; projectName: string; }
interface Educator { ED_ID: string; ED_NAME: string; }
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; WOMAN_ID: string; [key: string]: any; }
interface Child { id: number; child_id: string; child_name: string; }
interface HealthCenter { hc_id: string; hc_name: string; hw_id: string; hw_name: string;}

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

// --- Zod Schema ---
const formSchema = z.object({
  isExistingChild: z.enum(['نعم', 'لا']).optional(),
  // Existing child fields
  child_id: z.string().optional(),
  // New child fields
  child_first_name: z.string().optional(),
  child_gender: z.enum(['ذكر', 'أنثى']).optional(),
  new_child_age_mon: z.coerce.number().min(6).max(59).optional(),
  
  // Common fields
  child_has_cmam: z.enum(['نعم', 'لا']).optional(),
  child_cmam_type: z.enum(['سوء تغذية متوسط', 'سوء تغذية حاد']).optional(),
  muac: z.number().optional(),
  go_health_center: z.enum(['نعم', 'لا']).optional(),
  disc_date_day: z.string().optional(),
  disc_date_month: z.string().optional(),
  disc_date_year: z.string().optional(),
  near_health_center: z.string().optional(),
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
    
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    const [childSearch, setChildSearch] = useState("");
    
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { muac: 7 }
    });

    const watchIsExisting = form.watch("isExistingChild");
    const watchHasCmam = form.watch("child_has_cmam");
    const watchChildFirstName = form.watch("child_first_name");
    const watchChildGender = form.watch("child_gender");

    // --- Data Fetching ---
    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({...p, projects: false})));
    }, []);

    const handleProjectSelect = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        setSelectedEducatorId("");
        setSelectedBeneficiary(null);
        setEducators([]);
        setAllBeneficiaries([]);
        setAllChildren([]);
        setHealthCenters([]);
        if (!projectId) return;

        setLoading(p => ({...p, data: true}));
        try {
            const [bnfRes, hcRes, childRes] = await Promise.all([
                fetch(`/api/bnf-cmam?projectId=${projectId}`),
                fetch(`/api/health-centers?projectId=${projectId}`),
                fetch(`/api/child-cmam?projectId=${projectId}`),
            ]);
            
            const bnfData = await bnfRes.json();
            setAllBeneficiaries(bnfData);
            const uniqueEducators: Educator[] = Array.from(new Map(bnfData.map((item: any) => [item.ED_ID, item])).values());
            setEducators(uniqueEducators);
            
            setHealthCenters(await hcRes.json());
            setAllChildren(await childRes.json());
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, data: false}));
        }
    }, [toast]);
    
    // --- UI Filtering & Memoization ---
    const beneficiariesForEducator = useMemo(() => {
        let filtered = allBeneficiaries.filter(b => b.BENEF_CLASS_DESC === 'مستفيدة');
        if (selectedEducatorId) filtered = filtered.filter(b => b.ED_ID === selectedEducatorId);
        if (beneficiarySearch) {
            const lowerSearch = beneficiarySearch.toLowerCase();
            filtered = filtered.filter(b => 
                String(b.BENEF_ID).toLowerCase().includes(lowerSearch) || 
                b.BENEF_NAME.toLowerCase().includes(lowerSearch)
            );
        }
        return filtered;
    }, [allBeneficiaries, selectedEducatorId, beneficiarySearch]);

    const childrenOfBeneficiary = useMemo(() => {
        let filtered = allChildren.filter(c => c.benef_id === selectedBeneficiary?.BENEF_ID && c.cmam_qualify === 'Qualified');
        if (childSearch) {
            const lowerSearch = childSearch.toLowerCase();
            filtered = filtered.filter(c => 
                c.child_id.toLowerCase().includes(lowerSearch) || 
                c.child_name.toLowerCase().includes(lowerSearch)
            );
        }
        return filtered;
    }, [allChildren, selectedBeneficiary, childSearch]);
    
    // --- Validation Logic ---
    useEffect(() => {
        const timer = setTimeout(() => {
            if (watchIsExisting === 'لا' && watchChildFirstName && watchChildGender && selectedBeneficiary) {
                fetch('/api/validate-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: watchChildFirstName, gender: watchChildGender, benef_id: selectedBeneficiary.BENEF_ID })
                }).then(res => res.json()).then(data => setValidationErrors(data.result || []));
            } else {
                setValidationErrors([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [watchChildFirstName, watchChildGender, watchIsExisting, selectedBeneficiary]);

    const moveToNextChild = useCallback(() => {
        const currentChildId = form.getValues('child_id');
        const currentIndex = childrenOfBeneficiary.findIndex(c => c.child_id === currentChildId);
        if (currentIndex > -1 && currentIndex < childrenOfBeneficiary.length - 1) {
            form.reset({
              isExistingChild: 'نعم',
              child_id: childrenOfBeneficiary[currentIndex + 1].child_id,
            });
        } else {
             toast({ title: "End of List", description: "All children for this beneficiary have been reviewed."});
             form.reset({ isExistingChild: 'نعم', child_id: undefined });
        }
    }, [childrenOfBeneficiary, form, toast]);


    // --- Form Actions ---
    useEffect(() => {
        if (watchHasCmam === 'لا' && watchIsExisting === 'نعم') {
            const childId = form.getValues('child_id');
            if (childId) {
                setLoading(p => ({...p, saving: true}));
                fetch('/api/child-cmam', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([{ id: allChildren.find(c=>c.child_id === childId)?.id, child_has_cmam: 'لا' }])
                }).then(res => {
                    if (!res.ok) throw new Error("Failed to update status.");
                    toast({ title: "Updated", description: "Child marked as not having CMAM." });
                    moveToNextChild();
                }).catch(err => toast({ title: "Update Error", description: err.message, variant: "destructive"}))
                  .finally(() => setLoading(p => ({...p, saving: false})));
            }
        }
    }, [watchHasCmam, watchIsExisting, form, allChildren, toast, moveToNextChild]);

    const onFormSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!selectedBeneficiary) return;
        setLoading(p => ({...p, saving: true}));
        
        try {
            let payload: any = {};
            if (data.isExistingChild === 'نعم') {
                const child = allChildren.find(c => c.child_id === data.child_id);
                if (!child) throw new Error("Selected child not found.");
                payload.id = child.id; // For PUT request
            } else { // New Child
                payload.action = 'create_new_child';
                payload.benef_id = selectedBeneficiary.BENEF_ID;
                payload.child_first_name = data.child_first_name;
                payload.child_gender = data.child_gender;
                payload.new_child_age_mon = data.new_child_age_mon;
            }

            const selectedHC = healthCenters.find(hc => hc.hc_name === data.near_health_center);
            
            Object.assign(payload, {
                child_has_cmam: data.child_has_cmam,
                child_cmam_type: data.child_cmam_type,
                muac: data.muac,
                go_health_center: data.go_health_center,
                disc_date: `${data.disc_date_year}-${data.disc_date_month}-${data.disc_date_day}`,
                near_health_center: data.near_health_center,
                hc_id: selectedHC?.hc_id,
                hc_name: selectedHC?.hc_name,
                hw_id: selectedHC?.hw_id,
                hw_name: selectedHC?.hw_name,
            });

            const method = data.isExistingChild === 'نعم' ? 'PUT' : 'POST';
            const body = data.isExistingChild === 'نعم' ? JSON.stringify([payload]) : JSON.stringify(payload);

            const res = await fetch('/api/child-cmam', { method, headers: { 'Content-Type': 'application/json' }, body });
            if (!res.ok) throw new Error("Failed to save data.");
            
            toast({ title: "Success", description: `Record for ${data.isExistingChild === 'نعم' ? 'existing' : 'new'} child saved.`});
            
            // Refresh local data and move to next
            await handleProjectSelect(selectedProjectId);
            
            if (data.isExistingChild === 'نعم') {
                moveToNextChild();
            } else {
                form.reset({ isExistingChild: 'لا', child_first_name: '', child_gender: undefined, new_child_age_mon: undefined });
            }

        } catch (err: any) {
            toast({ title: "Save Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };
    
    const isFormDisabled = !selectedBeneficiary || (watchIsExisting === 'نعم' && !form.getValues('child_id')) || loading.saving;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Child Screening Results Entry</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
            </div>
            
            <Card>
                <CardHeader><CardTitle>1. Select Project & Educator</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select onValueChange={handleProjectSelect} value={selectedProjectId}><SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent></Select>
                    <Select onValueChange={setSelectedEducatorId} value={selectedEducatorId} disabled={!selectedProjectId}>
                        <SelectTrigger><SelectValue placeholder="اختر المثقفة..." /></SelectTrigger>
                        <SelectContent>{educators.map(e => <SelectItem key={e.ED_ID} value={e.ED_ID}>{e.ED_NAME} ({e.ED_ID})</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle>اختيار المستفيدة</CardTitle></CardHeader>
                    <CardContent>
                        <Input placeholder="Search by ID or name..." value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} />
                        <ScrollArea className="h-96 mt-4 border rounded-md">
                            <Table>
                                <TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Beneficiary ID</TableHead><TableHead>Beneficiary Name</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {beneficiariesForEducator.map(b => (
                                        <TableRow key={b.id} onClick={() => setSelectedBeneficiary(b)} className={cn("cursor-pointer", selectedBeneficiary?.id === b.id && 'bg-primary/10')}>
                                            <TableCell><Checkbox checked={selectedBeneficiary?.id === b.id} /></TableCell>
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
                        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
                            <CardHeader>
                                <CardTitle>Data Entry</CardTitle>
                                <CardDescription>{selectedBeneficiary ? `Entering data for children of ${selectedBeneficiary.BENEF_NAME}` : "Select a beneficiary to start."}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="isExistingChild" render={({field}) => (
                                    <FormItem><FormLabel>هل الطفل مسجل سابقا في قاعدة البيانات؟</FormLabel>
                                    <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                        <FormItem><FormControl><RadioGroupItem value="نعم"/></FormControl><FormLabel className="font-normal">نعم</FormLabel></FormItem>
                                        <FormItem><FormControl><RadioGroupItem value="لا"/></FormControl><FormLabel className="font-normal">لا</FormLabel></FormItem>
                                    </RadioGroup></FormControl><FormMessage /></FormItem>
                                )} />

                                {watchIsExisting === 'نعم' && (
                                     <FormField control={form.control} name="child_id" render={({ field }) => (
                                        <FormItem><FormLabel>اختيار الطفل</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select child..." /></SelectTrigger></FormControl>
                                            <SelectContent>{childrenOfBeneficiary.length > 0 ? childrenOfBeneficiary.map(c => <SelectItem key={c.id} value={c.child_id}>{c.child_name}</SelectItem>) : <div className="p-4 text-center text-sm text-muted-foreground">لايوجد طفل لدى المستفيدة مؤهل قد يكون عمر الطفل ٥ سنوات او اكثر يرجى اختيار مستفيدة أخرى او إدخال طفل جديد</div>}</SelectContent>
                                        </Select><FormMessage /></FormItem>
                                     )} />
                                )}

                                {watchIsExisting === 'لا' && (<>
                                    <FormField control={form.control} name="child_first_name" render={({ field }) => (<FormItem><FormLabel>اسم الطفل الجديد</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage /></FormItem>)} />
                                    {validationErrors.length > 0 && <Card className="p-2 border-destructive bg-destructive/10 text-destructive-foreground"><CardContent className="p-2 text-xs">{validationErrors.join(', ')}</CardContent></Card>}
                                    <FormField control={form.control} name="child_gender" render={({ field }) => (
                                        <FormItem><FormLabel>جنس الطفل</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                            <FormItem><FormControl><RadioGroupItem value="ذكر"/></FormControl><FormLabel className="font-normal">ذكر</FormLabel></FormItem>
                                            <FormItem><FormControl><RadioGroupItem value="أنثى"/></FormControl><FormLabel className="font-normal">أنثى</FormLabel></FormItem>
                                        </RadioGroup></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="new_child_age_mon" render={({ field }) => (<FormItem><FormLabel>عمر الطفل بالاشهر</FormLabel><FormControl><Input type="number" {...field} min="6" max="59"/></FormControl><FormMessage /></FormItem>)} />
                                </>)}
                                
                                <div className="border-t pt-4 space-y-4">
                                    <FormField control={form.control} name="child_has_cmam" render={({ field }) => (
                                        <FormItem><FormLabel>هل يعاني الطفل من سوء تغذية؟</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                            <FormItem><FormControl><RadioGroupItem value="نعم"/></FormControl><FormLabel className="font-normal">نعم</FormLabel></FormItem>
                                            <FormItem><FormControl><RadioGroupItem value="لا"/></FormControl><FormLabel className="font-normal">لا</FormLabel></FormItem>
                                        </RadioGroup></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                
                                {watchHasCmam === 'نعم' && (
                                    <div className="space-y-4 border-t pt-4">
                                        <FormField control={form.control} name="child_cmam_type" render={({ field }) => (
                                            <FormItem><FormLabel>حالة الطفل حاليا</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                                <FormItem><FormControl><RadioGroupItem value="سوء تغذية متوسط"/></FormControl><FormLabel className="font-normal">سوء تغذية متوسط</FormLabel></FormItem>
                                                <FormItem><FormControl><RadioGroupItem value="سوء تغذية حاد"/></FormControl><FormLabel className="font-normal">سوء تغذية حاد</FormLabel></FormItem>
                                            </RadioGroup></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="muac" render={({ field }) => (<FormItem><FormLabel>قياس المواك: {field.value}</FormLabel><FormControl><Slider min={7} max={16} step={0.1} value={[field.value || 7]} onValueChange={v => field.onChange(v[0])} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="go_health_center" render={({ field }) => (
                                            <FormItem><FormLabel>هل يذهب الى المرفق الصحي؟</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                                <FormItem><FormControl><RadioGroupItem value="نعم"/></FormControl><FormLabel className="font-normal">نعم</FormLabel></FormItem>
                                                <FormItem><FormControl><RadioGroupItem value="لا"/></FormControl><FormLabel className="font-normal">لا</FormLabel></FormItem>
                                            </RadioGroup></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <div className="space-y-2">
                                            <Label>تاريخ اكتشاف الحالة</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <FormField control={form.control} name="disc_date_day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day"/></SelectTrigger></FormControl><SelectContent>{days.map(d=><SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                                <FormField control={form.control} name="disc_date_month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger></FormControl><SelectContent>{months.map((m,i)=><SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                                <FormField control={form.control} name="disc_date_year" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger></FormControl><SelectContent>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                            </div>
                                        </div>
                                         <FormField control={form.control} name="near_health_center" render={({ field }) => (
                                            <FormItem><FormLabel>اقرب مركز صحي للذهاب اليه</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select health center..." /></SelectTrigger></FormControl><SelectContent>{healthCenters.map(hc => <SelectItem key={hc.hc_id} value={hc.hc_name}>{hc.hc_name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                         )} />
                                         <Button type="submit" disabled={isFormDisabled}>{isFormDisabled && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update Child Record</Button>
                                    </div>
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

```
  </change>
  <change>
    <file>src/lib/fullValidation.ts</file>
    <content><![CDATA[// lib/fullValidation.ts
import Database from "better-sqlite3";
import path from "path";

/* ================= DATABASES ================= */
const getDataPath = () => path.join(process.cwd(), 'src', 'data');

const getNamesDb = () => {
    const dbPath = path.join(getDataPath(), 'names.db');
    const db = new Database(dbPath);
    db.exec("CREATE TABLE IF NOT EXISTS names (name_key TEXT PRIMARY KEY, final_flag TEXT)");
    return db;
}

const getCmamDb = () => {
    const dbPath = path.join(getDataPath(), 'child-CMAM.db');
    return new Database(dbPath, { fileMustExist: true });
}

/* ================= NORMALIZATION ================= */
function baseArabicNormalize(value: any): string {
  if (!value) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/يحيي|يحيى/g, "يحي")
    .replace(/عبد\s+/g, "عبد")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك")
    .replace(/ء/g, "")
    .replace(/[^ء-ي\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ================= HELPERS ================= */
function normalizeSpace(v: string) {
  return v ? v.trim().replace(/\s+/g, " ") : "";
}

function compareArabicNames(a: string, b: string) {
  const na = baseArabicNormalize(a);
  const nb = baseArabicNormalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const aParts = na.split(" ");
  const bParts = nb.split(" ");
  let matches = 0;
  for (const pa of aParts) {
    for (const pb of bParts) {
      if (pa === pb) matches++;
    }
  }
  return matches / Math.max(aParts.length, bParts.length);
}

/* ================= DB FUNCTIONS ================= */
function checkNameGenderInDB(
  name: string,
  gender: "M" | "F"
): { valid: boolean; flag?: string } {
  const normalized = baseArabicNormalize(name);
  const namesDB = getNamesDb();
  try {
      const row: any = namesDB
        .prepare("SELECT final_flag FROM names WHERE name_key = ? LIMIT 1")
        .get(normalized);

      if (row) {
        const flags = row.final_flag.split(" "); 
        const valid = flags.includes(gender);
        return { valid, flag: row.final_flag };
      } else {
        namesDB
          .prepare(
            "INSERT INTO names (name_key, final_flag) VALUES (?, ?)"
          )
          .run(normalized, gender);
        return { valid: true, flag: gender };
      }
  } finally {
      namesDB.close();
  }
}

function checkDuplicateChild(inputName: string, benef_id: string) {
  if (!inputName || !benef_id) return null;
  const cmamDB = getCmamDb();
  try {
      const rows: any[] = cmamDB
        .prepare(
          "SELECT child_first_name FROM child_cmam WHERE benef_id = ?"
        )
        .all(benef_id);

      let bestScore = 0;
      let bestMatch = "";

      for (const row of rows) {
        const score = compareArabicNames(inputName, row.child_first_name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = row.child_first_name;
        }
      }

      if (bestScore >= 0.9)
        return `⚠ الطفل مسجل مسبقاً (${bestMatch})`;
      if (bestScore >= 0.7)
        return `⚠ يوجد اسم مشابه (${bestMatch})`;

      return null;
  } catch (error: any) {
      if (error.code === 'SQLITE_CANTOPEN') return null; // DB doesn't exist yet
      throw error;
  }
  finally {
      cmamDB.close();
  }
}

/* ================= MAIN VALIDATION FUNCTION ================= */
export function fullValidation({
  child_first_name,
  child_gender, // "ذكر" | "أنثى"
  benef_id,
}: {
  child_first_name: string;
  child_gender: "ذكر" | "أنثى";
  benef_id: string;
}) {
  const errors: string[] = [];

  if (!child_first_name) return errors;

  const name = child_first_name;
  const normalized = baseArabicNormalize(name);

  // ===== BASIC NAME VALIDATIONS =====
  if (name.startsWith(" ")) errors.push("الاسم يبدأ بمسافة");
  if (name.endsWith(" ")) errors.push("الاسم ينتهي بمسافة");
  if (normalizeSpace(name) !== name)
    errors.push("توجد اكثر من مسافة في منتصف الاسم");
  if (!/^[ء-ي\s]+$/.test(name))
    errors.push("الاسم يجب الا يحتوي على حروف غير عربية");
  if (normalized.length < 3)
    errors.push("الاسم يجب ان يتكون من ثلاثة حروف على الأقل");
  if (normalized.length > 11)
    errors.push("عدد الاحرف يجب الا يزيد عن 11 حرف");
  if (/(.)\1{2,}/.test(normalized))
    errors.push("توجد حروف مكررة أكثر من ثلاث مرات");

  // ===== GENDER VALIDATION (NAMES.DB) =====
  const genderMap = { ذكر: "M", أنثى: "F" } as const;
  const selectedGender = genderMap[child_gender];

  try {
    const dbCheck = checkNameGenderInDB(name, selectedGender);
    if (!dbCheck.valid) {
        if (selectedGender === "M") errors.push("الاسم ليس مذكرا");
        if (selectedGender === "F") errors.push("الاسم ليس مؤنثا");
    }
  } catch (e: any) {
    console.warn("Could not validate gender against DB:", e.message);
  }

  // ===== DUPLICATE CHECK (CHILD-CMAM.DB) =====
  try {
    const duplicateMsg = checkDuplicateChild(name, benef_id);
    if (duplicateMsg) errors.push(duplicateMsg);
  } catch(e: any) {
    console.warn("Could not check for duplicates:", e.message);
  }


  return errors;
}
