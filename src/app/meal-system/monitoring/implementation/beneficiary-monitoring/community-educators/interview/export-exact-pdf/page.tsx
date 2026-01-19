
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Plus, Trash2, FileDown, Eye, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const TableColumnSchema = z.object({
  header: z.string().min(1),
  dataKey: z.string().min(1),
  width: z.coerce.number(),
  textSize: z.coerce.number(),
  headerColor: z.string(),
  headerBgColor: z.string(),
  headerBold: z.boolean(),
  textColor: z.string(),
  textBold: z.boolean(),
});

const PdfSettingsSchema = z.object({
  templateName: z.string().min(1, "Template name is required"),
  title: z.string().min(1),
  titleColor: z.string(),
  titleBgColor: z.string(),
  titleBold: z.boolean(),
  pageSize: z.enum(['a4', 'letter', 'legal']),
  pageOrientation: z.enum(['portrait', 'landscape']),
  fitColumns: z.boolean(),
  pageBorder: z.boolean(),
  pageBorderColor: z.string(),
  pageBorderThickness: z.coerce.number(),
  headerHallNameType: z.enum(['manual', 'dynamic']),
  headerHallNameManual: z.string().optional(),
  headerHallNameDynamic: z.string().optional(),
  headerHallNoType: z.enum(['manual', 'dynamic']),
  headerHallNoManual: z.string().optional(),
  headerHallNoDynamic: z.string().optional(),
  tableColumns: z.array(TableColumnSchema),
  tableOuterBorder: z.boolean(),
  tableInnerBorder: z.boolean(),
  tableBorderColor: z.string(),
  tableBorderThickness: z.coerce.number(),
  rowHeight: z.coerce.number(),
});

type PdfSettings = z.infer<typeof PdfSettingsSchema>;

function ExportExactPDFPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') || '');
  const [applicantColumns, setApplicantColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState({ projects: true, generating: false, templates: true });
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const [templates, setTemplates] = useState<PdfSettings[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');

  const form = useForm<PdfSettings>({
    resolver: zodResolver(PdfSettingsSchema),
    defaultValues: {
      templateName: "New Template",
      title: "كشف درجات ممثل الصحة",
      titleColor: "#FFFFFF", titleBgColor: "#0070C0", titleBold: true,
      pageSize: 'a4', pageOrientation: 'portrait', fitColumns: true,
      pageBorder: true, pageBorderColor: '#000000', pageBorderThickness: 0.5,
      headerHallNameType: 'dynamic', headerHallNameDynamic: 'interview_hall_name',
      headerHallNoType: 'dynamic', headerHallNoDynamic: 'interview_hall_no',
      tableColumns: [
        { header: 'الرقم', dataKey: '_index', width: 15, textSize: 10, headerColor: "#000000", headerBgColor: "#F2F2F2", headerBold: true, textBold: false, textColor: "#000000" },
        { header: 'اسم المتقدمة', dataKey: 'applicant_name', width: 60, textSize: 10, headerColor: "#000000", headerBgColor: "#F2F2F2", headerBold: true, textBold: false, textColor: "#000000" },
      ],
      tableOuterBorder: true, tableInnerBorder: true, tableBorderColor: "#444444", tableBorderThickness: 0.2, rowHeight: 10,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tableColumns" });

  useEffect(() => {
    fetch('/api/projects').then(res => res.json()).then(data => {
        if (Array.isArray(data)) setProjects(data);
        setLoading(p => ({...p, projects: false}));
    });
    fetch('/api/ed-selection').then(res => res.json()).then(data => {
        if(data && data[0]) setApplicantColumns(['_index', ...Object.keys(data[0])]);
    });
  }, []);

  useEffect(() => {
    setLoading(p => ({ ...p, templates: true }));
    fetch('/api/pdf-templates')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => toast({ title: 'Error', description: 'Could not load templates.', variant: 'destructive' }))
      .finally(() => setLoading(p => ({ ...p, templates: false })));
  }, [toast]);

  const handleTemplateSelect = (templateName: string) => {
    const template = templates.find(t => t.templateName === templateName);
    if (template) {
      form.reset(template);
      setSelectedTemplateName(template.templateName);
      toast({ title: 'Template Loaded', description: `Loaded settings from "${templateName}".` });
    }
  };

  const handleSaveTemplate = async () => {
    const currentValues = form.getValues();
    if (!currentValues.templateName) {
      toast({ title: "Template Name Required", description: "Please enter a name for your template before saving.", variant: 'destructive' });
      return;
    }

    let newTemplates = [...templates];
    const existingIndex = newTemplates.findIndex(t => t.templateName === currentValues.templateName);

    if (existingIndex > -1) {
      if (confirm(`A template named "${currentValues.templateName}" already exists. Overwrite it?`)) {
        newTemplates[existingIndex] = currentValues;
      } else {
        return; // User cancelled overwrite
      }
    } else {
      newTemplates.push(currentValues);
    }
    
    setLoading(p => ({ ...p, templates: true }));
    try {
      const res = await fetch('/api/pdf-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplates)
      });
      if (!res.ok) throw new Error("Failed to save templates on server.");
      setTemplates(newTemplates);
      setSelectedTemplateName(currentValues.templateName);
      toast({ title: 'Template Saved!', description: `Settings for "${currentValues.templateName}" have been saved.` });
    } catch(e: any) {
      toast({ title: 'Save Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(p => ({ ...p, templates: false }));
    }
  };

  const handleGenerate = async (outputType: 'preview' | 'download') => {
    if (!selectedProjectId) return toast({ title: "Error", description: "Select a project first" });
    setLoading(p => ({...p, generating: true}));
    try {
        const response = await fetch('/api/interviews/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: selectedProjectId, settings: form.getValues() })
        });
        if (!response.ok) throw new Error("Failed to generate PDF");
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
            URL.revokeObjectURL(url); // Clean up immediately for download
        }
    } catch (e: any) {
        toast({ title: "Export Error", description: e.message, variant: "destructive" });
    } finally {
        setLoading(p => ({...p, generating: false}));
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">PDF Designer (RTL Server-Side)</h1>
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Project Data Source</CardTitle></CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Template Management</CardTitle>
          <CardDescription>Load, save, or manage your PDF export templates.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select onValueChange={handleTemplateSelect} value={selectedTemplateName}>
            <SelectTrigger>
              <SelectValue placeholder="Load a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.templateName} value={t.templateName}>{t.templateName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleSaveTemplate} disabled={loading.templates}>
            {loading.templates && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Save Settings as Template
          </Button>
        </CardContent>
      </Card>

      <Form {...form}>
        <form className="space-y-6">
            <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Document & Page Settings</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                        <FormField control={form.control} name="templateName" render={({field}) => (
                            <FormItem><FormLabel>Template Name</FormLabel><Input {...field} /></FormItem>
                        )}/>
                        <FormField control={form.control} name="pageSize" render={({field}) => (
                            <FormItem><FormLabel>Size</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="a4">A4</SelectItem><SelectItem value="letter">Letter</SelectItem></SelectContent>
                                </Select>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="pageOrientation" render={({field}) => (
                            <FormItem><FormLabel>Orientation</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="portrait">Portrait</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent>
                                </Select>
                            </FormItem>
                        )}/>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                    <AccordionTrigger>Header & Title Design</AccordionTrigger>
                    <AccordionContent className="space-y-4 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="title" render={({field}) => (
                                <FormItem><FormLabel>Main Title (Arabic)</FormLabel><Input {...field} className="text-right" dir="rtl" /></FormItem>
                            )}/>
                            <div className="flex gap-4">
                                <FormField control={form.control} name="titleBgColor" render={({field}) => (
                                    <FormItem><FormLabel>Bg Color</FormLabel><Input type="color" {...field} /></FormItem>
                                )}/>
                                <FormField control={form.control} name="titleColor" render={({field}) => (
                                    <FormItem><FormLabel>Text Color</FormLabel><Input type="color" {...field} /></FormItem>
                                )}/>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                    <AccordionTrigger>Table Columns (Order: First item = Rightmost column)</AccordionTrigger>
                    <AccordionContent className="p-4 space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="border p-4 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <FormField control={form.control} name={`tableColumns.${index}.header`} render={({field}) => (
                                    <FormItem><FormLabel>Header Text</FormLabel><Input {...field} /></FormItem>
                                )}/>
                                <FormField control={form.control} name={`tableColumns.${index}.dataKey`} render={({field}) => (
                                    <FormItem><FormLabel>Data Field</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {applicantColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name={`tableColumns.${index}.width`} render={({field}) => (
                                    <FormItem><FormLabel>Width (mm)</FormLabel><Input type="number" {...field} /></FormItem>
                                )}/>
                                <Button type="button" variant="destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={() => append({ header: 'جديد', dataKey: 'applicant_name', width: 30, textSize: 10, headerColor: "#000000", headerBgColor: "#F2F2F2", headerBold: true, textBold: false, textColor: "#000000" })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Column
                        </Button>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex justify-end gap-2 sticky bottom-4 bg-background p-4 border rounded-lg shadow-lg">
                <Button type="button" onClick={handleSaveTemplate} disabled={loading.templates}>
                    <Save className="mr-2 h-4 w-4" /> Save Template
                </Button>
                <Button type="button" variant="secondary" onClick={() => handleGenerate('preview')} disabled={loading.generating}>
                    {loading.generating ? <Loader2 className="animate-spin mr-2"/> : <Eye className="mr-2 h-4 w-4"/>} Preview
                </Button>
                <Button type="button" onClick={() => handleGenerate('download')} disabled={loading.generating}>
                    <FileDown className="mr-2 h-4 w-4"/> Download PDF
                </Button>
            </div>
        </form>
      </Form>

      {pdfPreviewUrl && (
        <Card className="mt-8"><CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent><iframe src={pdfPreviewUrl} className="w-full h-[800px] border rounded-md" /></CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ExportExactPDFPage() {
    return <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}><ExportExactPDFPageContent /></Suspense>
}
