
"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import type { RecordRow } from "@/lib/fuzzyCluster";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, PartyPopper, ChevronRight, Settings, Users, Sigma, Blocks, AlertCircle, Group } from "lucide-react";
import Link from "next/link";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle } from "lucide-react";

type Mapping = {
  [key: string]: string;
};

type Cluster = RecordRow[];

const MAPPING_KEY = 'beneficiary-insights-mapping';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [loading, setLoading] = useState({ process: false, cluster: false });
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
        const savedMapping = localStorage.getItem(MAPPING_KEY);
        if (savedMapping) {
            setMapping(JSON.parse(savedMapping));
        }
        // Clear old cache on load
        sessionStorage.removeItem('cacheId');
    } catch (e) {
        console.warn("Could not load settings from localStorage");
    }
  }, []);

  const handleMappingChange = (field: string, value: string) => {
    const newMapping = { ...mapping, [field]: value };
    setMapping(newMapping);
    try {
      localStorage.setItem(MAPPING_KEY, JSON.stringify(newMapping));
    } catch (e) {
      console.warn("Could not save mapping to localStorage");
    }
  };

  const requiredFields = [
    "womanName", "husbandName", "children", "phone", "nationalId", "subdistrict", "village",
  ];
  const allMappingFields = ["beneficiaryId", ...requiredFields];

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
      
      const fileColumns = Object.keys(json[0] as object);
      setRawData(json);
      setColumns(fileColumns);
      setClusters([]);
      sessionStorage.removeItem('cacheId'); // Clear previous cache ID

      // Auto-apply saved mappings
      const savedMapping = localStorage.getItem(MAPPING_KEY);
      if (savedMapping) {
        const parsedMapping = JSON.parse(savedMapping);
        const newMapping = { ...parsedMapping };
        Object.keys(parsedMapping).forEach(field => {
            if (!fileColumns.includes(parsedMapping[field])) {
                delete newMapping[field]; // Remove mapping if column not in new file
            }
        });
        setMapping(newMapping);
      }

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
    // Do not reset mapping, so user can re-upload without losing it
    setClusters([]);
    setFileName("");
    setFile(null);
    setLoading({ process: false, cluster: false });
    setProgress(0);
    sessionStorage.removeItem('cacheId');
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

    const progressInterval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 5 : 90));
    }, 500);

    try {
        const rows: RecordRow[] = rawData.map((row: any, index: number) => ({
          ...row,
          _internalId: `row_${index}`,
          beneficiaryId: String(row[mapping.beneficiaryId] || `row_${index}`),
          womanName: String(row[mapping.womanName] || ""),
          husbandName: String(row[mapping.husbandName] || ""),
          nationalId: String(row[mapping.nationalId] || ""),
          phone: String(row[mapping.phone] || ""),
          village: String(row[mapping.village] || ""),
          subdistrict: String(row[mapping.subdistrict] || ""),
          children: String(row[mapping.children] || "").split(/[;,،]/).map((x) => x.trim()).filter(Boolean),
        }));

        const fieldsForApi = rows.map(row => ({
          _internalId: row._internalId,
          beneficiaryId: row.beneficiaryId,
          womanName: row.womanName,
          husbandName: row.husbandName,
          nationalId: row.nationalId,
          phone: row.phone,
          village: row.village,
          subdistrict: row.subdistrict,
          children: row.children
        }));

        const clusterRes = await fetch("/api/cluster", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: fieldsForApi, opts: settings }),
        });

        const clusterData = await clusterRes.json();
        
        if (!clusterRes.ok || !clusterData.ok) {
            throw new Error(clusterData.error || "Clustering failed on the server.");
        }
        
        clearInterval(progressInterval);
        setProgress(95);

        // Now, save to the server-side file cache
        const cacheRes = await fetch("/api/cluster-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                clusters: clusterData.result.clusters, 
                rows: rows,
                originalHeaders: columns,
                idColumnName: mapping.beneficiaryId || ''
            }),
        });

        if (!cacheRes.ok) {
            throw new Error("Failed to save data to server cache.");
        }

        const { cacheId } = await cacheRes.json();
        sessionStorage.setItem('cacheId', cacheId);

        setClusters(clusterData.result.clusters);
        setProgress(100);
        
        toast({
          title: "Clustering Complete",
          description: `${clusterData.result.clusters.length} clusters found.`,
          action: <PartyPopper className="text-green-500" />,
        });

    } catch (error: any) {
      clearInterval(progressInterval);
      setProgress(0);
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setClusters([]);
    } finally {
       setLoading(prev => ({...prev, cluster: false}));
       setTimeout(() => setProgress(0), 2000); // Keep progress bar for a bit for user feedback
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
              <Button variant="outline" onClick={resetState} disabled={loading.process || loading.cluster}>Clear</Button>
            )}
          </div>
          {loading.process && <Progress value={progress} className="w-full mt-4" />}
        </CardContent>
      </Card>

      {rawData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>Match the required fields to the columns from your uploaded file. Your selections will be saved for future uploads.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allMappingFields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="flex items-center capitalize">
                    {field.replace(/([A-Z])/g, ' $1')}
                    {mapping[field] && <CheckCircle className="ml-2 h-4 w-4 text-green-500" />}
                    {!requiredFields.includes(field) && <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>}
                  </Label>
                  <Card>
                    <CardContent className="p-2">
                      <ScrollArea className="h-32 w-full">
                        <RadioGroup
                          value={mapping[field] || ""}
                          onValueChange={(value) => handleMappingChange(field, value)}
                          className="grid grid-cols-2 gap-x-4 gap-y-2 p-2"
                          disabled={loading.process || loading.cluster}
                        >
                          {columns.map((c) => (
                            <div key={`${field}-${c}`} className="flex items-center space-x-2">
                              <RadioGroupItem value={c} id={`${field}-${c}`} />
                              <Label htmlFor={`${field}-${c}`} className="text-sm font-normal truncate" title={c}>{c}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1 w-full sm:w-auto">
                <Button onClick={runClustering} disabled={loading.process || loading.cluster || !allRequiredFieldsMapped} className="w-full sm:w-auto">
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
              <CardDescription>A summary of the clustering analysis. You can now proceed to review the clusters.</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryStats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 text-center">
                    <Card>
                        <CardHeader className="pb-2"><Group className="mx-auto h-6 w-6 text-primary" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.totalProcessed}</p>
                            <p className="text-xs text-muted-foreground">Total Records</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><Users className="mx-auto h-6 w-6 text-green-600" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.totalClustered}</p>
                            <p className="text-xs text-muted-foreground">Clustered</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><Users className="mx-auto h-6 w-6 text-slate-500" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.totalUnclustered}</p>
                            <p className="text-xs text-muted-foreground">Unclustered</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><Blocks className="mx-auto h-6 w-6 text-blue-600" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.numClusters}</p>
                            <p className="text-xs text-muted-foreground">Clusters Found</p>
                        </CardContent>
                    </Card>
                    <Card className="col-span-2 lg:col-span-1">
                        <CardHeader className="pb-2"><Sigma className="mx-auto h-6 w-6 text-purple-600" /></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summaryStats.avgClusterSize}</p>
                            <p className="text-xs text-muted-foreground">Avg. Cluster Size</p>
                        </CardContent>
                    </Card>
                </div>
            )}
            <div className="flex gap-4">
                <Button asChild>
                    <Link href="/review">
                       Go to Review
                       <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    