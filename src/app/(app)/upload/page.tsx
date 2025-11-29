
"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import type { RecordRow } from "@/lib/fuzzyCluster";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, PartyPopper, ChevronRight, FileDown, CheckCircle, AlertCircle, Settings, Users, Bot, Sigma, FileSpreadsheet, Plus, Key, ArrowDownUp, SortAsc, Palette, Download, Group, FileInput, Blocks } from "lucide-react";
import Link from "next/link";
import { fullPairwiseBreakdown } from "@/lib/fuzzyCluster";

type Mapping = {
  [key: string]: string;
};

type Cluster = RecordRow[];

type ProcessedRecord = RecordRow & {
    clusterId?: number;
    pairScore?: number;
    nameScore?: number;
    husbandScore?: number;
    idScore?: number;
    phoneScore?: number;
    locationScore?: number;
    childrenScore?: number;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [loading, setLoading] = useState({ process: false, cluster: false, export: false });
  const [progress, setProgress] = useState(0);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [settings, setSettings] = useState({ minPairScore: 0.60, minInternalScore: 0.50 });
  const { toast } = useToast();

  const [showExportWorkflow, setShowExportWorkflow] = useState(false);
  const [processedRecords, setProcessedRecords] = useState<ProcessedRecord[]>([]);

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

  const optionalFields = ["beneficiaryId"];
  const requiredFields = [
    "womanName", "husbandName", "children", "phone", "nationalId", "subdistrict", "village",
  ];
  const allMappingFields = ["beneficiaryId", "womanName", "husbandName", "children", "phone", "nationalId", "subdistrict", "village"];

  const allRequiredFieldsMapped = requiredFields.every((field) => mapping[field]);
  
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setLoading(prev => ({...prev, process: true}));
    setFileName(selectedFile.name);
    setFile(selectedFile);
    setProgress(20);

    try {
      const data = await selectedFile.arrayBuffer();
      setProgress(40);
      const wb = XLSX.read(data, { type: "array", cellDates: true, dense: true });
      setProgress(60);
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setProgress(80);

      if (!json.length || Object.keys(json[0] as object).length === 0) {
        toast({ title: "Error", description: "The uploaded file or its first sheet is empty.", variant: "destructive" });
        resetState();
        return;
      }
      
      setRawData(json);
      setColumns(Object.keys(json[0] as object));
      setClusters([]);
      setShowExportWorkflow(false);
      setProgress(100);
      toast({ title: "Success", description: "File processed. Please map the columns.", });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to process the file.", variant: "destructive" });
      resetState();
    } finally {
      setTimeout(() => {
        setLoading(prev => ({...prev, process: false}));
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
    setFile(null);
    setShowExportWorkflow(false);
    setLoading({ process: false, cluster: false, export: false });
    setProgress(0);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  const runClustering = async () => {
    if (!rawData.length || !allRequiredFieldsMapped) {
      toast({ title: "Missing Information", description: "Please upload a file and map all required columns.", variant: "destructive" });
      return;
    }

    setLoading(prev => ({...prev, cluster: true}));
    setProgress(0);

    const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 5 : 90));
    }, 500);

    const rows: RecordRow[] = rawData.map((row: any, index: number) => ({
      _internalId: `row_${index}`, // Assign internal ID
      beneficiaryId: String(row[mapping.beneficiaryId] || `row_${index}`), // Use internalId as fallback for matching
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
        
        // Generate processed records from clusters for export
        const clusterMap = new Map<string, any>();
        data.result.clusters.forEach((cluster: Cluster, index: number) => {
            const pairs = fullPairwiseBreakdown(cluster);
            if (pairs.length > 0) {
                // For simplicity, we assign the top pair's score to all records in the cluster.
                // A more advanced approach might average scores or handle it differently.
                const topPair = pairs[0];
                const scoreData = {
                    clusterId: index + 1,
                    pairScore: topPair.score,
                    nameScore: topPair.breakdown.nameScore,
                    husbandScore: topPair.breakdown.husbandScore,
                    idScore: topPair.breakdown.idScore,
                    phoneScore: topPair.breakdown.phoneScore,
                    locationScore: topPair.breakdown.locationScore,
                    childrenScore: topPair.breakdown.childrenScore,
                };
                cluster.forEach(record => {
                    // Use internal ID as the key
                    clusterMap.set(record._internalId!, { ...record, ...scoreData });
                });
            } else if (cluster.length > 0) {
                 // Handle single-record clusters if they were to appear, or clusters with no valid pairs
                cluster.forEach(record => {
                    clusterMap.set(record._internalId!, { ...record, clusterId: index + 1 });
                });
            }
        });

        // Create the final list of all records, enriching those that are in a cluster
        const allProcessed: ProcessedRecord[] = rows.map((row) => {
            if (clusterMap.has(row._internalId!)) {
                return clusterMap.get(row._internalId!);
            }
            // Return the original record if it's not in any cluster
            return row;
        });

        setProcessedRecords(allProcessed);


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
       setLoading(prev => ({...prev, cluster: false}));
       setProgress(0);
    }
  };

  const summaryStats = useMemo(() => {
    if (clusters.length === 0 && rawData.length === 0) return null;
    const clusteredRecords = clusters.flat();
    const totalProcessed = rawData.length;
    const totalClustered = clusteredRecords.length;
    const totalUnclustered = totalProcessed - totalClustered;
    const avgClusterSize = clusters.length > 0 ? (totalClustered / clusters.length).toFixed(2) : 0;
    return { totalProcessed, totalClustered, totalUnclustered, numClusters: clusters.length, avgClusterSize };
  }, [clusters, rawData]);

  // --- EXPORT WORKFLOW FUNCTIONS ---

  const handleDownload = async () => {
    if (processedRecords.length === 0 || rawData.length === 0 || !mapping.beneficiaryId) {
        toast({ title: "Missing Data", description: "Please ensure data is clustered and Beneficiary ID is mapped before exporting.", variant: "destructive"});
        return;
    }

    setLoading(prev => ({...prev, export: true}));
    
    try {
        const response = await fetch('/api/export-enriched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                originalData: rawData,
                processedRecords,
                idColumnName: mapping.beneficiaryId
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate enriched Excel file.');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enriched_${fileName || 'report.xlsx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast({ title: "Download Started", description: "Your enriched file is being downloaded." });

    } catch (error: any) {
        console.error(error);
        toast({ title: "Export Error", description: error.message, variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, export: false}));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>Step 1: Upload Data File</CardTitle>
                    <CardDescription>Upload a .xlsx, .xls, .xlsm, or .xlsb file containing beneficiary data.</CardDescription>
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
                <Input id="file-upload" type="file" className="hidden" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.txt" onChange={handleFile} disabled={loading.process} />
            </Label>
            {fileName && (
              <Button variant="outline" onClick={resetState} disabled={loading.process || loading.cluster || loading.export}>Clear</Button>
            )}
          </div>
          {loading.process && <Progress value={progress} className="w-full mt-4" />}
        </CardContent>
      </Card>

      {rawData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>Match the required fields to the columns from your uploaded file. Beneficiary ID is required for the export workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allMappingFields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`map-${field}`} className="flex items-center capitalize">
                    {field.replace(/([A-Z])/g, ' $1')}
                    {allRequiredFieldsMapped && requiredFields.includes(field) && <CheckCircle className="ml-2 h-4 w-4 text-green-500" />}
                    {field === 'beneficiaryId' && <span className="ml-2 text-xs font-semibold text-destructive">(Required for Export)</span>}
                  </Label>
                  <Select
                    value={mapping[field] || ""}
                    onValueChange={(value) => setMapping((m) => ({ ...m, [field]: value }))}
                    disabled={loading.process || loading.cluster || loading.export}
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
            <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1 w-full sm:w-auto">
                <Button onClick={runClustering} disabled={loading.process || loading.cluster || loading.export || !allRequiredFieldsMapped} className="w-full sm:w-auto">
                  {loading.cluster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                  Run Clustering
                </Button>
                 {loading.cluster && <Progress value={progress} className="w-full mt-2" />}
              </div>
              {!allRequiredFieldsMapped && !loading.cluster && (
                  <p className="text-sm text-muted-foreground flex items-center pt-2"><AlertCircle className="h-4 w-4 mr-2" /> All required fields must be mapped to run clustering.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {clusters.length > 0 && (
        <Card>
          <CardHeader>
              <CardTitle>Step 3: Results</CardTitle>
              <CardDescription>A summary of the clustering analysis. You can now proceed to review the clusters or create a detailed export.</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryStats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 text-center">
                    <Card>
                        <CardHeader className="pb-2"><Group className="mx-auto h-6 w-6 text-primary" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.totalProcessed}</p>
                            <p className="text-xs text-muted-foreground">إجمالي السجلات</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><Users className="mx-auto h-6 w-6 text-green-600" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.totalClustered}</p>
                            <p className="text-xs text-muted-foreground">السجلات المجمعة</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><Users className="mx-auto h-6 w-6 text-slate-500" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.totalUnclustered}</p>
                            <p className="text-xs text-muted-foreground">السجلات غير المجمعة</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><Blocks className="mx-auto h-6 w-6 text-blue-600" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.numClusters}</p>
                            <p className="text-xs text-muted-foreground">عدد المجموعات</p>
                        </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1">
                        <CardHeader className="pb-2"><Sigma className="mx-auto h-6 w-6 text-purple-600" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.avgClusterSize}</p>
                            <p className="text-xs text-muted-foreground">متوسط حجم المجموعة</p>
                        </CardContent>
                    </Card>
                </div>
            )}
            <div className="flex gap-4">
                <Button onClick={() => setShowExportWorkflow(!showExportWorkflow)}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {showExportWorkflow ? "Hide Export Workflow" : "Export Full Report"}
                </Button>
                <Button asChild variant="outline">
                    <Link href="/review">
                       Review Clusters
                       <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showExportWorkflow && (
        <Card>
            <CardHeader>
                <CardTitle>Step 4: Generate Enriched Report</CardTitle>
                <CardDescription>Generate and download a fully enriched Excel file with all analysis data, sorting, and professional formatting applied.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 rounded-lg border border-primary">
                    <h4 className="font-semibold flex items-center"><Download className="mr-2 h-5 w-5 text-primary" /> Download Enriched Report</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                        Click the button below to generate a new Excel file. This file will contain your original data enriched with the following:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside space-y-1">
                        <li>New columns for Cluster ID and all similarity scores.</li>
                        <li>Data sorted by Cluster ID to group potential duplicates.</li>
                        <li>Professional styling with colors, borders, and RTL layout for easy analysis.</li>
                    </ul>
                     <Button onClick={handleDownload} disabled={loading.export || !mapping.beneficiaryId} className="mt-4">
                        {loading.export ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Generate and Download Report
                    </Button>
                    {!mapping.beneficiaryId && <p className="text-xs text-destructive mt-2">Beneficiary ID must be mapped in Step 2 to enable export.</p>}
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

    
    