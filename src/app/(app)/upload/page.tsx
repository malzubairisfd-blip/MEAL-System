
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import type { RecordRow } from "@/lib/fuzzyCluster";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, PartyPopper, ChevronRight, FileDown, CheckCircle, AlertCircle, Sparkles, Microscope, Settings } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { generateClusterDescription } from "@/ai/flows/llm-powered-audit-assistant";
import Link from "next/link";

type Mapping = {
  [key: string]: string;
};

type Cluster = RecordRow[];

export default function UploadPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [settings, setSettings] = useState({ minPairScore: 0.60, minInternalScore: 0.50 });
  const { toast } = useToast();

  useEffect(() => {
    try {
        const savedSettings = localStorage.getItem('beneficiary-insights-settings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
    } catch (e) {
        console.warn("Could not load settings from localStorage");
    }
  }, []);

  const requiredFields = [
    "womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children",
  ];

  const allFieldsMapped = requiredFields.every((field) => mapping[field]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    setProgress(20);

    try {
      const data = await file.arrayBuffer();
      setProgress(40);
      const workbook = XLSX.read(data, { type: "array", cellDates: true, dense: true });
      setProgress(60);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      setProgress(80);

      if (!json.length || Object.keys(json[0] as object).length === 0) {
        toast({ title: "Error", description: "The uploaded file or its first sheet is empty.", variant: "destructive" });
        resetState();
        return;
      }
      
      setRawData(json);
      setColumns(Object.keys(json[0] as object));
      setClusters([]);
      setProgress(100);
      toast({ title: "Success", description: "File processed. Please map the columns.", });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to process the file.", variant: "destructive" });
      resetState();
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 1000);
    }
  };
  
  const resetState = () => {
    setRawData([]);
    setColumns([]);
    setMapping({});
    setClusters([]);
    setFileName("");
    setLoading(false);
    setProgress(0);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  const runClustering = async () => {
    if (!rawData.length || !allFieldsMapped) {
      toast({ title: "Missing Information", description: "Please upload a file and map all required columns.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setProgress(0);

    const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 10 : 90));
    }, 500);

    const rows: RecordRow[] = rawData.map((row: any, index: number) => ({
      _internalId: `row_${index}`, // Assign internal ID
      womanName: String(row[mapping.womanName] || ""),
      husbandName: String(row[mapping.husbandName] || ""),
      nationalId: String(row[mapping.nationalId] || ""),
      phone: String(row[mapping.phone] || ""),
      village: String(row[mapping.village] || ""),
      subdistrict: String(row[mapping.subdistrict] || ""),
      children: String(row[mapping.children] || "").split(/[;,،]/).map((x) => x.trim()).filter(Boolean),
    }));

    try {
      const res = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, opts: settings }),
      });

      const data = await res.json();
      
      clearInterval(interval);
      setProgress(100);

      if (data.ok) {
        setClusters(data.result.clusters);
        toast({
          title: "Clustering Complete",
          description: `${data.result.clusters.length} clusters found.`,
          action: <PartyPopper className="text-green-500" />,
        });
        await fetch("/api/cluster-cache", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clusters: data.result.clusters }),
        });
      } else {
        toast({ title: "Clustering Error", description: data.error, variant: "destructive" });
        setClusters([]);
      }
    } catch (error) {
      clearInterval(interval);
      console.error(error);
      toast({ title: "Network Error", description: "Failed to connect to the clustering service.", variant: "destructive" });
    } finally {
        setTimeout(() => {
            setLoading(false);
            setProgress(0);
        }, 1000);
    }
  };

  const exportToExcel = async () => {
    if (rawData.length === 0) {
      toast({ title: "No Data", description: "No data to export. Please upload and process a file.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const allRecordIds = new Set(rawData.map((_, i) => `row_${i}`));
    const clusteredRecordIds = new Set(clusters.flat().map(r => r._internalId));
    const unclusteredIds = Array.from(allRecordIds).filter(id => !clusteredRecordIds.has(id));

    const processedRows: RecordRow[] = rawData.map((row: any, index: number) => ({
      _internalId: `row_${index}`,
      womanName: String(row[mapping.womanName] || ""),
      husbandName: String(row[mapping.husbandName] || ""),
      nationalId: String(row[mapping.nationalId] || ""),
      phone: String(row[mapping.phone] || ""),
      village: String(row[mapping.village] || ""),
      subdistrict: String(row[mapping.subdistrict] || ""),
      children: String(row[mapping.children] || "").split(/[;,،]/).map((x) => x.trim()).filter(Boolean),
    }));

    const unclusteredRecords = unclusteredIds.map(id => {
        const index = parseInt(id.split('_')[1]);
        return processedRows[index];
    });

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            clusters,
            unclustered: unclusteredRecords,
            originalData: rawData,
            originalColumns: columns
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate Excel file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'full-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Your file has been downloaded." });
    } catch (error) {
      console.error(error);
      toast({ title: "Export Error", description: "Could not export data to Excel.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [aiDescriptions, setAiDescriptions] = useState<Record<number, {loading: boolean, description: string | null}>>({});

  const handleGenerateDescription = async (cluster: Cluster, index: number) => {
    setAiDescriptions(prev => ({...prev, [index]: {loading: true, description: null}}));
    try {
      const result = await generateClusterDescription({ cluster });
      setAiDescriptions(prev => ({...prev, [index]: {loading: false, description: result.description}}));
    } catch (error) {
      console.error("AI Description Error", error);
      toast({title: "AI Error", description: "Could not generate description.", variant: "destructive"})
      setAiDescriptions(prev => ({...prev, [index]: {loading: false, description: "Error generating description."}}));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>Step 1: Upload Data File</CardTitle>
                    <CardDescription>Upload a .xlsx, .csv, or .txt file containing beneficiary data.</CardDescription>
                </div>
                 <Button variant="outline" asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Clustering Settings
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label htmlFor="file-upload" className={`flex-1 flex items-center justify-center w-full h-20 px-4 transition bg-background border-2 border-dashed rounded-md appearance-none cursor-pointer hover:border-primary ${fileName ? 'border-primary' : ''}`}>
                <span className="flex items-center space-x-2">
                    <FileUp className="w-6 h-6 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">
                        {fileName || "Click to select a file or drag and drop"}
                    </span>
                </span>
                <Input id="file-upload" type="file" className="hidden" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.txt" onChange={handleFile} disabled={loading} />
            </Label>
            {fileName && (
              <Button variant="outline" onClick={resetState} disabled={loading}>Clear</Button>
            )}
          </div>
          {loading && progress > 0 && <Progress value={progress} className="w-full mt-4" />}
        </CardContent>
      </Card>

      {rawData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>Match the required fields to the columns from your uploaded file.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requiredFields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`map-${field}`} className="flex items-center">
                    {field} {mapping[field] && <CheckCircle className="ml-2 h-4 w-4 text-green-500" />}
                  </Label>
                  <Select
                    value={mapping[field] || ""}
                    onValueChange={(value) => setMapping((m) => ({ ...m, [field]: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger id={`map-${field}`}>
                      <SelectValue placeholder="Select a column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center">
              <Button onClick={runClustering} disabled={loading || !allFieldsMapped} className="w-full sm:w-auto">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                Run Clustering
              </Button>
              {!allFieldsMapped && (
                  <p className="text-sm text-muted-foreground flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> All fields must be mapped to run clustering.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {clusters.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>Step 3: Results</CardTitle>
                    <CardDescription>{clusters.length} potential duplicate clusters found.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportToExcel} variant="outline" disabled={loading}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export Full Report
                    </Button>
                     <Button asChild>
                        <Link href="/review">
                           Go to Review
                           <Microscope className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {clusters.map((cluster, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <AccordionTrigger>Cluster {index + 1} ({cluster.length} records)</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 p-2">
                      {cluster.map((record, i) => (
                        <div key={i} className="text-sm p-2 rounded-md bg-muted/50">
                          <p><strong>Woman:</strong> {record.womanName}</p>
                          <p><strong>Husband:</strong> {record.husbandName}</p>
                          <p><strong>Phone:</strong> {record.phone}</p>
                          <p><strong>ID:</strong> {record.nationalId}</p>
                        </div>
                      ))}
                      <div className="mt-4">
                        <Button variant="ghost" onClick={() => handleGenerateDescription(cluster, index)} disabled={aiDescriptions[index]?.loading}>
                           {aiDescriptions[index]?.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-primary" />}
                            Generate AI Summary
                        </Button>
                        {aiDescriptions[index] && !aiDescriptions[index]?.loading && aiDescriptions[index]?.description && (
                          <div className="mt-2 p-3 rounded-md border bg-background text-sm">
                            <p className="font-semibold mb-2">AI Summary:</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{aiDescriptions[index]?.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
