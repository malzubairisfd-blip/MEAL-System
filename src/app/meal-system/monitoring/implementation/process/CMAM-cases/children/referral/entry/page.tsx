// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/entry/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Loader2, Search, Database, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface Project { projectId: string; projectName: string; }
interface HealthCenter { hc_id: string; hc_name: string; }
interface Beneficiary { id: number; BENEF_ID: string; BENEF_NAME: string; hc_id: string; [key: string]: any; }
interface Child { id: number; child_id: string; child_name: string; benef_id: string; [key: string]: any; }

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "دسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

const formSchema = z.object({
  // This schema can be expanded if direct form submission is needed
});

export default function ChildReferralDataEntryPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [config, setConfig] = useState({ projectId: "", followUpCycle: 1, followUpMonth: "" });
    const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [allChildren, setAllChildren] = useState<Child[]>([]);
    const [selectedHealthCenterId, setSelectedHealthCenterId] = useState("");
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | null>(null);
    const [beneficiarySearch, setBeneficiarySearch] = useState("");
    const [loading, setLoading] = useState({ projects: true, config: true, data: false, saving: false });
    const [hcSearch, setHcSearch] = useState('');

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema)
    });

    useEffect(() => {
        Promise.all([
            fetch('/api/projects').then(res => res.json()),
            fetch('/api/child-referral-cycle').then(res => res.json())
        ]).then(([projData, confData]) => {
            setProjects(projData);
            setConfig(confData);
            if(confData.projectId) handleProjectSelect(confData.projectId);
        }).finally(() => setLoading(p => ({...p, projects: false, config: false})));
    }, []);

    const handleProjectSelect = useCallback(async (projectId: string) => {
        setConfig(prev => ({ ...prev, projectId }));
        setSelectedHealthCenterId("");
        setSelectedBeneficiaryId(null);

        if (!projectId) {
            setHealthCenters([]);
            setBeneficiaries([]);
            setAllChildren([]);
            return;
        }

        setLoading(p => ({ ...p, data: true }));
        try {
            const [childRes, bnfRes] = await Promise.all([
                fetch(`/api/child-cmam?projectId=${projectId}`),
                fetch(`/api/bnf-cmam?projectId=${projectId}`)
            ]);

            const children: Child[] = await childRes.json();
            const bnfs: Beneficiary[] = await bnfRes.json();
            
            setAllChildren(children);
            setBeneficiaries(bnfs);

            const uniqueHCs = Array.from(new Map(bnfs.filter(b => b.hc_id).map(b => [b.hc_id, {hc_id: b.hc_id, hc_name: b.hc_name}])).values()) as HealthCenter[];
            setHealthCenters(uniqueHCs);

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({ ...p, data: false }));
        }
    }, [toast]);
    
    const filteredBeneficiaries = useMemo(() => {
        if (!selectedHealthCenterId) return [];
        let filtered = beneficiaries.filter(b => b.hc_id === selectedHealthCenterId);
        if (beneficiarySearch) {
            const ls = beneficiarySearch.toLowerCase();
            filtered = filtered.filter(b => String(b.BENEF_ID).includes(ls) || b.BENEF_NAME.toLowerCase().includes(ls));
        }
        return filtered;
    }, [beneficiaries, selectedHealthCenterId, beneficiarySearch]);

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Child Referral Data Entry</h1>
                 <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/referral">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>1. Project & Cycle</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                     <Select onValueChange={handleProjectSelect} value={config.projectId}>
                        <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                     <Input value={`دورة المتابعة: ${config.followUpCycle}`} readOnly className="bg-muted"/>
                     <Input value={`شهر المتابعة: ${config.followUpMonth}`} readOnly className="bg-muted"/>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>2. Select Health Center & Beneficiary</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Health Center</Label>
                             <Select value={selectedHealthCenterId} onValueChange={setSelectedHealthCenterId} disabled={!config.projectId}>
                                <SelectTrigger><SelectValue placeholder="Select Health Center..."/></SelectTrigger>
                                <SelectContent><ScrollArea className="h-60">{healthCenters.map(hc=><SelectItem key={hc.hc_id} value={hc.hc_id}>{hc.hc_name}</SelectItem>)}</ScrollArea></SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Beneficiary</Label>
                            <Input placeholder="Search Beneficiary..." value={beneficiarySearch} onChange={e=>setBeneficiarySearch(e.target.value)} disabled={!selectedHealthCenterId} />
                            <ScrollArea className="h-96 mt-2 border rounded-md">
                                <Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>ID</TableHead><TableHead>Name</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {filteredBeneficiaries.map(b=>(
                                        <TableRow key={b.id} onClick={()=>setSelectedBeneficiaryId(b.id)} className={cn("cursor-pointer", selectedBeneficiaryId === b.id && "bg-primary/10")}>
                                            <TableCell><Checkbox checked={selectedBeneficiaryId === b.id} /></TableCell>
                                            <TableCell>{b.BENEF_ID}</TableCell><TableCell>{b.BENEF_NAME}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody></Table>
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            </div>
            {/* Form will go here */}
        </div>
    );
}
