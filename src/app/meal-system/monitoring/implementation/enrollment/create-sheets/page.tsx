// src/app/meal-system/monitoring/implementation/enrollment/create-sheets/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, FileText, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface Project {
    projectId: string;
    projectName: string;
}

export default function CreateEnrollmentSheetsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState(0);
  const [sheetsGenerated, setSheetsGenerated] = useState(0);
  const [totalSheets, setTotalSheets] = useState(0);

  useEffect(() => {
    async function fetchProjects() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error("Failed to fetch projects");
            setProjects(await res.json());
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    }
    fetchProjects();
  }, [toast]);
  
  const handleGenerate = async (isSample: boolean) => {
    if (!selectedProjectId) {
      toast({ title: "No Project Selected", description: "Please select a project.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStatus("Initializing...");
    setProgress(0);
    setSheetsGenerated(0);
    setTotalSheets(0);

    try {
        const res = await fetch('/api/bnf-assessed');
        if (!res.ok) throw new Error("Failed to fetch beneficiary data.");
        let allBeneficiaries = await res.json();
        
        const projectBeneficiaries = allBeneficiaries.filter((bnf: any) => bnf.project_id === selectedProjectId);

        if (projectBeneficiaries.length === 0) {
          toast({ title: "No Data", description: "No beneficiaries found for the selected project.", variant: 'default' });
          setLoading(false);
          return;
        }

        const worker = new Worker(new URL('../../../../../../workers/enrollment.worker.ts', import.meta.url));
        
        worker.onmessage = (event) => {
            const { type, status: workerStatus, progress: workerProgress, current, total, data, error } = event.data;

            if (type === 'progress') {
                setStatus(workerStatus);
                setProgress(workerProgress);
                if (current && total) {
                    setSheetsGenerated(current);
                    setTotalSheets(total);
                }
            } else if (type === 'done-sample' || type === 'done-all') {
                const blob = new Blob([data], { type: isSample ? "application/pdf" : "application/zip" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = isSample 
                    ? `Enrollment_Sample_${selectedProjectId}.pdf` 
                    : `Enrollment_Forms_${selectedProjectId}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast({ title: "Success", description: "File downloaded." });
                setLoading(false);
                worker.terminate();
            } else if (type === 'error') {
                toast({ title: "Worker Error", description: error, variant: "destructive" });
                setLoading(false);
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
             toast({ title: "Worker Initialization Error", description: err.message, variant: "destructive" });
             setLoading(false);
        }

        const fontRes = await fetch('/fonts/Amiri-Regular.ttf');
        const fontBuffer = await fontRes.arrayBuffer();
        const fontBase64 = btoa(new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        setStatus("Starting generation...");
        setProgress(10);
        
        let beneficiariesToSend = projectBeneficiaries;
        if (isSample) {
            beneficiariesToSend = [projectBeneficiaries[Math.floor(Math.random() * projectBeneficiaries.length)]];
        }

        worker.postMessage({ beneficiaries: beneficiariesToSend, fontBase64, sample: isSample });

    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-xl">Export Enrollment Forms</CardTitle>
          <CardDescription className="text-center">
            Generate PDF enrollment forms for all beneficiaries in a project, grouped by educator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium">Select Project</label>
                 <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.map(p => (
                            <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex gap-2">
                <Button
                    size="lg"
                    onClick={() => handleGenerate(false)}
                    disabled={loading || !selectedProjectId}
                    className="w-full"
                >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {loading ? "Generating..." : "Download All Forms (ZIP)"}
                </Button>
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => handleGenerate(true)}
                    disabled={loading || !selectedProjectId}
                >
                    <File className="mr-2 h-4 w-4" />
                    Download Sample
                </Button>
            </div>

            {loading && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{status}</span>
                        <span>{sheetsGenerated} / {totalSheets} sheets</span>
                    </div>
                    <Progress value={progress} />
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
