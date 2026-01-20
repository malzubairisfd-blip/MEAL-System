
"use client";

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Plus, Trash2, FileDown, Eye, Info, Save, RotateCcw, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUpToLine, ArrowDownToLine, Divide } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- REUSABLE COLOR PICKER COMPONENT ---
const globalColorHistory = new Set<string>(["#000000", "#FFFFFF", "#2F80B5", "#F3F4F6"]);

const ColorPicker = ({ value, onChange, label }: { value: string, onChange: (c: string) => void, label?: string }) => {
    const [history, setHistory] = useState<string[]>(Array.from(globalColorHistory));

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        onChange(newColor);
        globalColorHistory.add(newColor);
        if (globalColorHistory.size > 8) {
            const iterator = globalColorHistory.values();
            globalColorHistory.delete(iterator.next().value);
        }
        setHistory(Array.from(globalColorHistory));
    };

    return (
        <div className="flex flex-col gap-1">
            {label && <span className="text-xs font-medium">{label}</span>}
            <div className="flex gap-2 items-center">
                <div className="relative w-full">
                    <Input type="color" value={value} onChange={handleColorChange} className="h-9 w-full cursor-pointer p-1" />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9"><Palette className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2">
                        <div className="grid grid-cols-4 gap-2">
                            {history.map((c) => (
                                <div
                                    key={c}
                                    className="w-8 h-8 rounded-full border cursor-pointer shadow-sm hover:scale-110 transition-transform"
                                    style={{ backgroundColor: c }}
                                    onClick={() => onChange(c)}
                                    title={c}
                                />
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

// --- SCHEMAS ---

const AlignmentSchema = z.enum(['left', 'center', 'right']);
const VerticalAlignmentSchema = z.enum(['top', 'middle', 'bottom']);

const CellStyleSchema = z.object({
    fontSize: z.coerce.number().default(10),
    textColor: z.string().default("#000000"),
    bgColor: z.string().optional(),
    bold: z.boolean().default(false),
    italic: z.boolean().default(false),
    halign: AlignmentSchema.default('center'),
    valign: VerticalAlignmentSchema.default('middle'),
});

const TableColumnSchema = z.object({
    header: z.string().min(1),
    dataKey: z.string().min(1),
    width: z.coerce.number().default(30),
    headerStyle: CellStyleSchema.extend({
        bgColor: z.string().default("#2F80B5"),
        textColor: z.string().default("#FFFFFF"),
        bold: z.boolean().default(true)
    }),
    bodyStyle: CellStyleSchema.extend({
        bgColor: z.string().optional(),
        textColor: z.string().default("#000000")
    }),
});

const InfoBoxStyleSchema = CellStyleSchema.extend({
    labelTextColor: z.string().optional(),
    labelBgColor: z.string(),
    valueBgColor: z.string(),
    width: z.coerce.number(),
    height: z.coerce.number()
});

const PdfSettingsSchema = z.object({
    templateName: z.string().min(1),
    pageSize: z.enum(['a4', 'letter', 'legal']),
    pageOrientation: z.enum(['portrait', 'landscape']),
    headerHeight: z.coerce.number(),
    borderColor: z.string(),
    borderWidth: z.coerce.number().default(0.5),
    title: z.string().min(1),
    titleStyle: CellStyleSchema.extend({ height: z.coerce.number().optional() }),
    infoBoxStyle: InfoBoxStyleSchema,
    tableColumns: z.array(TableColumnSchema),
    rowHeight: z.coerce.number().default(8),
    footerStyle: CellStyleSchema.extend({
      showStampBoxes: z.boolean().default(true),
    }),
});

type PdfSettings = z.infer<typeof PdfSettingsSchema>;

const InfoBoxStyleControls = ({ namePrefix, control }: { namePrefix: 'infoBoxStyle', control: any }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={control} name={`${namePrefix}.width`} render={({ field }) => (<FormItem><FormLabel>Box Width (mm)</FormLabel><Input type="number" {...field} /></FormItem>)} />
            <FormField control={control} name={`${namePrefix}.height`} render={({ field }) => (<FormItem><FormLabel>Box Height (mm)</FormLabel><Input type="number" {...field} /></FormItem>)} />
            <FormField control={control} name={`${namePrefix}.fontSize`} render={({ field }) => (<FormItem><FormLabel>Font Size</FormLabel><Input type="number" {...field} /></FormItem>)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField control={control} name={`${namePrefix}.labelTextColor`} render={({ field }) => (<FormItem><ColorPicker label="Label Text" value={field.value || '#000000'} onChange={field.onChange} /></FormItem>)} />
            <FormField control={control} name={`${namePrefix}.textColor`} render={({ field }) => (<FormItem><ColorPicker label="Value Text" value={field.value} onChange={field.onChange} /></FormItem>)} />
            <FormField control={control} name={`${namePrefix}.labelBgColor`} render={({ field }) => (<FormItem><ColorPicker label="Label BG" value={field.value} onChange={field.onChange} /></FormItem>)} />
            <FormField control={control} name={`${namePrefix}.valueBgColor`} render={({ field }) => (<FormItem><ColorPicker label="Value BG" value={field.value} onChange={field.onChange} /></FormItem>)} />
        </div>
    </div>
);


function ExportExactPDFPageContent() {
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') || '');
    const [applicantColumns, setApplicantColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState({ projects: true, generating: false });
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [savedTemplates, setSavedTemplates] = useState<string[]>([]);

    useEffect(() => {
        const templates: string[] = [];
        if (typeof window !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('pdf_template_')) {
                    templates.push(key.replace('pdf_template_', ''));
                }
            }
        }
        setSavedTemplates(templates.sort());
    }, []);

    const defaultInfoBoxStyle = {
        fontSize: 10, textColor: "#000000", labelTextColor: "#000000", labelBgColor: "#F3F4F6", valueBgColor: "#FFFFFF",
        bold: false, italic: false, width: 60, height: 8, halign: 'right' as const, valign: 'middle' as const
    };

    const form = useForm<PdfSettings>({
        resolver: zodResolver(PdfSettingsSchema),
        defaultValues: {
            templateName: "My Custom Template",
            pageSize: 'a4',
            pageOrientation: 'portrait',
            headerHeight: 60,
            borderColor: "#000000",
            borderWidth: 0.5,
            title: "كشف درجات المتقدمات للمقابلة",
            titleStyle: {
                fontSize: 14, textColor: "#FFFFFF", bgColor: "#2F3C50",
                bold: true, italic: false, height: 10, halign: 'center', valign: 'middle'
            },
            infoBoxStyle: { ...defaultInfoBoxStyle },
            rowHeight: 10,
            tableColumns: [
                {
                    header: 'م', dataKey: '_index', width: 15,
                    headerStyle: { fontSize: 10, textColor: "#FFFFFF", bgColor: "#2F80B5", bold: true, halign: 'center', valign: 'middle', italic: false },
                    bodyStyle: { fontSize: 10, textColor: "#000000", bold: false, halign: 'center', valign: 'middle', italic: false }
                },
                {
                    header: 'اسم المتقدمة', dataKey: 'applicant_name', width: 70,
                    headerStyle: { fontSize: 10, textColor: "#FFFFFF", bgColor: "#2F80B5", bold: true, halign: 'center', valign: 'middle', italic: false },
                    bodyStyle: { fontSize: 10, textColor: "#000000", bold: false, halign: 'right', valign: 'middle', italic: false }
                },
                {
                    header: 'الدرجة', dataKey: 'total_score', width: 25,
                    headerStyle: { fontSize: 10, textColor: "#FFFFFF", bgColor: "#2F80B5", bold: true, halign: 'center', valign: 'middle', italic: false },
                    bodyStyle: { fontSize: 10, textColor: "#000000", bold: true, halign: 'center', valign: 'middle', italic: false }
                },
            ],
            footerStyle: {
                fontSize: 10, textColor: "#000000", bold: true, italic: false, halign: 'right', valign: 'middle',
                showStampBoxes: true,
            }
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "tableColumns" });
    const { watch } = form;
    const tableColumns = watch("tableColumns");
    const pageSize = watch("pageSize");
    const pageOrientation = watch("pageOrientation");

     const { totalWidth, usedWidth, remainingWidth } = useMemo(() => {
        const A4_WIDTH_P = 210;
        const A4_HEIGHT_L = 297;
        const LETTER_WIDTH_P = 215.9;
        const LETTER_HEIGHT_L = 279.4;
        const MARGIN = 20;

        let pageWidth;
        if (pageSize === 'a4') {
            pageWidth = pageOrientation === 'portrait' ? A4_WIDTH_P : A4_HEIGHT_L;
        } else {
            pageWidth = pageOrientation === 'portrait' ? LETTER_WIDTH_P : LETTER_HEIGHT_L;
        }

        const totalWidth = pageWidth - MARGIN;
        const usedWidth = tableColumns.reduce((sum, col) => sum + (Number(col.width) || 0), 0);
        const remainingWidth = totalWidth - usedWidth;

        return { totalWidth, usedWidth, remainingWidth };
    }, [tableColumns, pageSize, pageOrientation]);

    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(data => {
            if (Array.isArray(data)) setProjects(data);
            setLoading(p => ({ ...p, projects: false }));
        });
        fetch('/api/ed-selection').then(res => res.json()).then(data => {
            if (data && data[0]) setApplicantColumns(['_index', ...Object.keys(data[0])]);
        });
    }, []);

    const saveTemplate = () => {
        const values = form.getValues();
         if (!values.templateName) {
            toast({ title: "Cannot Save", description: "Please enter a name for the template first.", variant: "destructive" });
            return;
        }
        localStorage.setItem(`pdf_template_${values.templateName}`, JSON.stringify(values));
        toast({ title: "Saved", description: `Template "${values.templateName}" saved to local storage.` });
         if (!savedTemplates.includes(values.templateName)) {
            setSavedTemplates(prev => [...prev, values.templateName].sort());
        }
    };

    const loadTemplate = (name: string) => {
        if (!name) return;
        const saved = localStorage.getItem(`pdf_template_${name}`);
        if (saved) {
            form.reset(JSON.parse(saved));
            toast({ title: "Loaded", description: `Template "${name}" loaded.` });
        } else {
            toast({ variant: "destructive", title: "Error", description: "Template not found" });
        }
    };

    const handleGenerate = async (outputType: 'preview' | 'download') => {
        if (!selectedProjectId) return toast({ title: "Error", description: "Select a project first" });
        setLoading(p => ({ ...p, generating: true }));
        try {
            const response = await fetch('/api/interviews/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProjectId, settings: form.getValues() })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to generate PDF");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);

            if (outputType === 'preview') {
                 setPdfPreviewUrl(url);
            } else {
                const link = document.createElement('a');
                link.href = url;
                link.download = `${form.getValues().templateName}.pdf`;
                link.click();
            }
        } catch (e: any) {
            toast({ title: "Export Error", description: e.message, variant: "destructive" });
        } finally {
            setLoading(p => ({ ...p, generating: false }));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Advanced PDF Designer</h1>
                <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            </div>

            <Card>
                <CardHeader className="pb-3"><CardTitle>1. Data Source</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label>Select Project</Label>
                            <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a project..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Form {...form}>
                <form className="space-y-6">

                    <Card>
                        <CardHeader className="pb-3"><CardTitle>2. Template Manager</CardTitle></CardHeader>
                         <CardContent className="space-y-4">
                            <FormField control={form.control} name="templateName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Template Name</FormLabel>
                                    <Input {...field} placeholder="Enter a name for your template..." />
                                </FormItem>
                            )} />
                            <div className="flex gap-4 items-end">
                                <FormItem className="flex-1">
                                    <FormLabel>Load Saved Template</FormLabel>
                                    <Select onValueChange={loadTemplate}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a template to load..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {savedTemplates.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                <Button type="button" variant="outline" onClick={saveTemplate}><Save className="mr-2 h-4 w-4"/> Save Current</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Accordion type="multiple" defaultValue={['page', 'info-box', 'footer', 'table']} className="w-full">
                        <AccordionItem value="page">
                            <AccordionTrigger>3. Page, Title & Border Settings</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 bg-slate-900/50">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <FormField control={form.control} name="pageSize" render={({ field }) => (
                                        <FormItem><FormLabel>Size</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="a4">A4</SelectItem><SelectItem value="letter">Letter</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="pageOrientation" render={({ field }) => (
                                        <FormItem><FormLabel>Orientation</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="portrait">Portrait</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent></Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="headerHeight" render={({ field }) => (
                                        <FormItem><FormLabel>Top Margin (mm)</FormLabel><Input type="number" {...field} /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="borderWidth" render={({ field }) => (
                                        <FormItem><FormLabel>Border Width (mm)</FormLabel><Input type="number" step="0.1" {...field} /></FormItem>
                                    )} />
                                     <FormField control={form.control} name="borderColor" render={({ field }) => (
                                        <FormItem><FormLabel>Page Border Color</FormLabel>
                                        <ColorPicker value={field.value} onChange={field.onChange} />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="border-t pt-4 mt-4 border-slate-700">
                                    <Label className="mb-2 block font-bold">Main Document Title</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><Input {...field} className="text-right font-serif text-lg" dir="rtl" /></FormItem>)} />
                                        <div className="flex gap-4">
                                            <FormField control={form.control} name="titleStyle.bgColor" render={({ field }) => (<FormItem><ColorPicker label="Background" value={field.value || '#ffffff'} onChange={field.onChange} /></FormItem>)} />
                                            <FormField control={form.control} name="titleStyle.textColor" render={({ field }) => (<FormItem><ColorPicker label="Text" value={field.value} onChange={field.onChange} /></FormItem>)} />
                                            <FormField control={form.control} name="titleStyle.fontSize" render={({ field }) => (<FormItem><FormLabel>Size</FormLabel><Input type="number" {...field} className="w-20" /></FormItem>)} />
                                            <FormField control={form.control} name="titleStyle.bold" render={({ field }) => (<FormItem className="flex items-center gap-2 pt-6"><Switch checked={field.value} onCheckedChange={field.onChange} /><Label>Bold</Label></FormItem>)} />
                                            <FormField control={form.control} name="titleStyle.italic" render={({ field }) => (<FormItem className="flex items-center gap-2 pt-6"><Switch checked={field.value} onCheckedChange={field.onChange} /><Label>Italic</Label></FormItem>)} />
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                         <AccordionItem value="info-box">
                            <AccordionTrigger>4. Header Info Boxes</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 bg-slate-900/50">
                               <InfoBoxStyleControls namePrefix="infoBoxStyle" control={form.control} />
                            </AccordionContent>
                        </AccordionItem>

                         <AccordionItem value="footer">
                            <AccordionTrigger>5. Footer Settings</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 bg-slate-900/50">
                                <div className="flex gap-4 items-center">
                                    <FormField control={form.control} name="footerStyle.textColor" render={({ field }) => (<FormItem><ColorPicker label="Text" value={field.value} onChange={field.onChange} /></FormItem>)} />
                                    <FormField control={form.control} name="footerStyle.fontSize" render={({ field }) => (<FormItem><FormLabel>Size</FormLabel><Input type="number" {...field} className="w-20" /></FormItem>)} />
                                    <FormField control={form.control} name="footerStyle.bold" render={({ field }) => (<FormItem className="flex items-center gap-2 pt-6"><Switch checked={field.value} onCheckedChange={field.onChange} /><Label>Bold</Label></FormItem>)} />
                                     <FormField control={form.control} name="footerStyle.showStampBoxes" render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 pt-6">
                                            <Switch id="showStampBoxes" checked={field.value} onCheckedChange={field.onChange} />
                                            <Label htmlFor="showStampBoxes">Show Stamp Boxes</Label>
                                        </FormItem>
                                     )} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="table">
                            <AccordionTrigger>6. Table Columns & Styling</AccordionTrigger>
                             <AccordionContent className="p-4 space-y-4 bg-slate-900/50">

                                <Card className="mb-4 bg-slate-800 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-base text-white">Table Width Allocation (mm)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex justify-around items-center">
                                        <div className="text-center">
                                            <p className="text-sm text-slate-400">Total Printable</p>
                                            <p className="text-2xl font-bold text-slate-100">{totalWidth.toFixed(1)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm text-slate-400">Used</p>
                                            <p className="text-2xl font-bold text-slate-100">{usedWidth.toFixed(1)}</p>
                                        </div>
                                        <div className={cn("text-center p-2 rounded-lg", remainingWidth < 0 ? 'bg-red-500/20' : 'bg-green-500/20')}>
                                            <p className="text-sm text-slate-400">Remaining</p>
                                            <p className={cn("text-2xl font-bold", remainingWidth < 0 ? 'text-red-400' : 'text-green-400')}>{remainingWidth.toFixed(1)}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex items-center gap-4 mb-4">
                                    <Label>Global Row Height:</Label>
                                    <FormField control={form.control} name="rowHeight" render={({field}) => <Input type="number" {...field} className="w-24" />} />
                                </div>

                                {fields.map((field, index) => (
                                    <Card key={field.id} className="relative overflow-hidden border-l-4 border-l-primary bg-slate-800/50">
                                        <div className="absolute top-2 right-2">
                                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-red-700 hover:bg-red-50" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                        <CardContent className="p-4 pt-4">
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 md:col-span-4 space-y-3 border-r pr-4 border-slate-700">
                                                    <h4 className="font-bold text-sm text-slate-400 mb-2">Column Data</h4>
                                                    <FormField control={form.control} name={`tableColumns.${index}.header`} render={({ field }) => (
                                                        <FormItem><FormLabel>Header Text</FormLabel><Input {...field} /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`tableColumns.${index}.dataKey`} render={({ field }) => (
                                                        <FormItem><FormLabel>Data Field</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>{applicantColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`tableColumns.${index}.width`} render={({ field }) => (
                                                        <FormItem><FormLabel>Width (mm)</FormLabel><Input type="number" {...field} /></FormItem>
                                                    )} />
                                                </div>

                                                <div className="col-span-12 md:col-span-8">
                                                    <Tabs defaultValue="header" className="w-full">
                                                        <TabsList className="w-full justify-start bg-slate-700/50">
                                                            <TabsTrigger value="header">Header Style</TabsTrigger>
                                                            <TabsTrigger value="body">Body Style</TabsTrigger>
                                                        </TabsList>

                                                        <TabsContent value="header" className="space-y-3 p-2 bg-slate-900/50 rounded border border-slate-700 mt-2">
                                                            <div className="flex flex-wrap gap-4 items-end">
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.bgColor`} render={({ field }) => (<ColorPicker label="Background" value={field.value || '#ffffff'} onChange={field.onChange} />)} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.textColor`} render={({ field }) => (<ColorPicker label="Text" value={field.value} onChange={field.onChange} />)} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.fontSize`} render={({ field }) => (<FormItem><FormLabel>Size</FormLabel><Input type="number" {...field} className="w-16 h-9" /></FormItem>)} />
                                                            </div>
                                                            <div className="flex gap-4 items-center">
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.bold`} render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><Switch checked={field.value} onCheckedChange={field.onChange} /><Label>Bold</Label></FormItem>)} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.italic`} render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><Switch checked={field.value} onCheckedChange={field.onChange} /><Label>Italic</Label></FormItem>)} />
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.halign`} render={({ field }) => (
                                                                     <FormItem><FormLabel>H-Align</FormLabel><Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></FormItem>
                                                                )} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.headerStyle.valign`} render={({ field }) => (
                                                                     <FormItem><FormLabel>V-Align</FormLabel><Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Top</SelectItem><SelectItem value="middle">Middle</SelectItem><SelectItem value="bottom">Bottom</SelectItem></SelectContent></Select></FormItem>
                                                                )} />
                                                            </div>
                                                        </TabsContent>

                                                        <TabsContent value="body" className="space-y-3 p-2 bg-slate-900/50 rounded border border-slate-700 mt-2">
                                                            <div className="flex flex-wrap gap-4 items-end">
                                                                <FormField control={form.control} name={`tableColumns.${index}.bodyStyle.bgColor`} render={({ field }) => (<ColorPicker label="Background" value={field.value || '#ffffff'} onChange={field.onChange} />)} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.bodyStyle.textColor`} render={({ field }) => (<ColorPicker label="Text" value={field.value} onChange={field.onChange} />)} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.bodyStyle.fontSize`} render={({ field }) => (<FormItem><FormLabel>Size</FormLabel><Input type="number" {...field} className="w-16 h-9" /></FormItem>)} />
                                                            </div>
                                                            <div className="flex gap-4 items-center">
                                                                <FormField control={form.control} name={`tableColumns.${index}.bodyStyle.bold`} render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><Switch checked={field.value} onCheckedChange={field.onChange} /><Label>Bold</Label></FormItem>)} />
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <FormField control={form.control} name={`tableColumns.${index}.bodyStyle.halign`} render={({ field }) => (
                                                                     <FormItem><FormLabel>H-Align</FormLabel><Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></FormItem>
                                                                )} />
                                                                <FormField control={form.control} name={`tableColumns.${index}.bodyStyle.valign`} render={({ field }) => (
                                                                     <FormItem><FormLabel>V-Align</FormLabel><Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Top</SelectItem><SelectItem value="middle">Middle</SelectItem><SelectItem value="bottom">Bottom</SelectItem></SelectContent></Select></FormItem>
                                                                )} />
                                                            </div>
                                                        </TabsContent>
                                                    </Tabs>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => append({
                                    header: 'جديد', dataKey: 'applicant_name', width: 30,
                                    headerStyle: { fontSize: 10, textColor: "#FFFFFF", bgColor: "#2F80B5", bold: true, halign: 'center', valign: 'middle', italic: false },
                                    bodyStyle: { fontSize: 10, textColor: "#000000", bold: false, halign: 'right', valign: 'middle', italic: false }
                                })}>
                                    <Plus className="mr-2 h-4 w-4" /> Add Column
                                </Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end gap-2 sticky bottom-4 bg-background/80 backdrop-blur p-4 border rounded-lg shadow-lg">
                        <Button type="button" variant="secondary" onClick={() => handleGenerate('preview')} disabled={loading.generating}>
                            {loading.generating ? <Loader2 className="animate-spin mr-2" /> : <Eye className="mr-2 h-4 w-4" />} Live Preview
                        </Button>
                        <Button type="button" onClick={() => handleGenerate('download')} disabled={loading.generating}>
                            <FileDown className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </div>
                </form>
            </Form>

            {pdfPreviewUrl && (
                <div className="mt-8">
                    <Label className="text-xl font-bold mb-2 block">Document Preview</Label>
                    <iframe src={pdfPreviewUrl} className="w-full h-[900px] border-4 border-slate-700 rounded-xl" />
                </div>
            )}
        </div>
    );
}

export default function ExportExactPDFPage() {
    return <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}><ExportExactPDFPageContent /></Suspense>
}
