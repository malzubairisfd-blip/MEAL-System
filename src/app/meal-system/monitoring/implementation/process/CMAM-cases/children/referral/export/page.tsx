// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/export/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { saveAs } from "file-saver";
import { Input } from "@/components/ui/input";

interface Project {
  projectId: string;
  projectName: string;
}

export default function ExportChildReferralStatementsPage() {
  const { toast } = useToast();
  const workerRef = React.useRef<Worker | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState({ projectId: '', followUpCycle: 1, followUpMonth: '' });
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState({ projects: true, configs: true, action: false });

  useEffect(() => {
    setLoading(prev => ({ ...prev, projects: true, configs: true }));
    Promise.all([
        fetch("/api/projects").then((res) => res.json()),
        fetch("/api/bnf-referral-cycle").then((res) => res.json())
    ]).then(([projectData, configData]) => {
        setProjects(projectData || []);
        setConfig(configData || { projectId: '', followUpCycle: 1, followUpMonth: '' });
        if (configData.projectId) {
            setSelectedProject(configData.projectId);
        }
    }).catch(err => {
        toast({ title: "Error loading initial data", description: err.message, variant: "destructive" });
    }).finally(() => {
        setLoading(prev => ({ ...prev, projects: false, configs: false }));
    });
    
    const worker = new Worker(new URL("@/workers/childreferralcmam-export.worker.ts", import.meta.url));
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, [toast]);
  

  const handleUpdateAndExport = async () => {
    if (!selectedProject || !config.followUpCycle || !config.followUpMonth) {
      toast({
        title: "Incomplete Selection",
        description: "Please select a project. Cycle and month are loaded from configuration.",
        variant: "destructive",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    toast({ title: "Processing", description: "Preparing referral statements..." });

    try {
      const response = await fetch(`/api/child-cmam?projectId=${selectedProject}`);
      if (!response.ok) throw new Error("Failed to fetch CMAM data.");
      const beneficiaries = await response.json();

      if (!workerRef.current) throw new Error("Export worker is not initialized.");

      const [fontRegularRes, fontBoldRes, logoRes] = await Promise.all([
        fetch("/fonts/NotoNaskhArabic-Regular.ttf"),
        fetch("/fonts/NotoNaskhArabic-Bold.ttf"),
        fetch("/sfd-logo.png"),
      ]);
      const [fontRegularBuffer, fontBoldBuffer, logoBlob] = await Promise.all([
        fontRegularRes.arrayBuffer(),
        fontBoldRes.arrayBuffer(),
        logoRes.blob(),
      ]);

      const toBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

      const fontBase64 = {
        regular: toBase64(fontRegularBuffer),
        bold: toBase64(fontBoldBuffer),
        logo: await blobToBase64(logoBlob),
      };

      workerRef.current.postMessage({
        beneficiaries: beneficiaries,
        fontBase64,
        selectedCycle: config.followUpCycle,
        selectedMonth: config.followUpMonth,
      });

      workerRef.current.onmessage = (event) => {
        const { type, data, error } = event.data;
        if (type === "done-all") {
          const blob = new Blob([data], { type: "application/zip" });
          saveAs(blob, `Child_Referral_Statements_Cycle_${config.followUpCycle}.zip`);
          toast({ title: "Export Complete", description: "Statements are ready." });
        } else if (type === "error") {
          throw new Error(error);
        }
        setLoading((prev) => ({ ...prev, action: false }));
      };
    } catch (error: any) {
      toast({ title: "Process Failed", description: error.message, variant: "destructive" });
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Export Referral Malnourished Statements (Children)</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/referral">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cycles
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Select the project to generate reports for. The cycle and month are pre-configured.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={selectedProject}
              onValueChange={setSelectedProject}
              disabled={loading.projects}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.projectId} value={project.projectId}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>دورة المتابعة</Label>
            <Input value={`Cycle: ${config.followUpCycle}`} readOnly className="bg-muted"/>
          </div>

          <div className="space-y-2">
            <Label>شهر المتابعة</Label>
            <Input value={`Month: ${config.followUpMonth}`} readOnly className="bg-muted"/>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleUpdateAndExport} disabled={loading.action || !selectedProject}>
          {loading.action ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Update & Export Statements
        </Button>
      </div>
    </div>
  );
}
