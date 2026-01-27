"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface Project {
    projectId: string;
    projectName: string;
}

export default function CreateIDCardsPage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("Idle");
    const [progress, setProgress] = useState(0);
    const [sheetsGenerated, setSheetsGenerated] = useState(0);
    const [totalSheets, setTotalSheets] = useState(0);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const { toast } = useToast();

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            }
        };
        fetchProjects();
    }, [toast]);

    const handleDownload = async () => {
        if (!selectedProjectId) {
            toast({ title: "No Project Selected", description: "Please select a project to generate cards for.", variant: "destructive" });
            return;
        }

        setLoading(true);
        setStatus("Fetching beneficiary data...");
        setProgress(5);

        try {
            const res = await fetch('/api/bnf-assessed');
            if (!res.ok) throw new Error("Failed to fetch beneficiary data.");
            let allBeneficiaries = await res.json();
            
            const projectBeneficiaries = allBeneficiaries.filter((bnf: any) => bnf.project_id === selectedProjectId);

            if (projectBeneficiaries.length === 0) {
              toast({ title: "No Data", description: "No beneficiaries found for the selected project to generate ID cards.", variant: 'default' });
              setLoading(false);
              return;
            }

            const worker = new Worker(new URL('@/workers/id-card.worker.ts', import.meta.url));

            worker.onmessage = (event) => {
                const { type, status: workerStatus, progress: workerProgress, current, total, data, error } = event.data;
                if (type === 'progress') {
                    setStatus(workerStatus);
                    setProgress(workerProgress);
                    if(current && total) {
                        setSheetsGenerated(current);
                        setTotalSheets(total);
                    }
                } else if (type === 'done-sample' || type === 'done-all') {
                    setStatus("Download ready!");
                    const blob = new Blob([data], { type: "application/zip" });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Beneficiary_ID_Cards_${selectedProjectId}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    toast({ title: "Success", description: "ID cards ZIP file downloaded." });
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
            
            const [fontRegularRes, fontBoldRes] = await Promise.all([
                fetch('/fonts/NotoNaskhArabic-Regular.ttf'),
                fetch('/fonts/NotoNaskhArabic-Bold.ttf')
            ]);
            
            if (!fontRegularRes.ok || !fontBoldRes.ok) {
              throw new Error("Failed to fetch font files.");
            }
    
            const fontRegularBuffer = await fontRegularRes.arrayBuffer();
            const fontBoldBuffer = await fontBoldRes.arrayBuffer();
            
            const fontBase64 = {
              regular: btoa(new Uint8Array(fontRegularBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')),
              bold: btoa(new Uint8Array(fontBoldBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')),
            };

            setStatus("Starting generation...");
            setProgress(10);
            worker.postMessage({ beneficiaries: projectBeneficiaries, fontBase64 });

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10">
            <Card className="w-full max-w-lg mx-auto">
                <CardHeader>
                    <CardTitle className="text-center text-xl">Export Beneficiary ID Cards</CardTitle>
                    <CardDescription className="text-center">
                        Generate PDF ID cards for all beneficiaries in a project, grouped by educator.
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

                    <Button
                        size="lg"
                        onClick={handleDownload}
                        disabled={loading || !selectedProjectId}
                        className="w-full"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {loading ? "Generating..." : "Download ID Cards (ZIP)"}
                    </Button>

                    {loading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{status}</span>
                                <span>{sheetsGenerated} / {totalSheets}</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
