// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/connecting/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Key, Link2, Users, GitBranch, Shuffle, Save, CheckCircle, Search } from "lucide-react";

interface Project {
  projectId: string;
  projectName: string;
}

interface Educator {
  applicant_id: number;
  ed_id: string;
  applicant_name: string;
  loc_name: string;
  working_village: string;
  ed_bnf_cnt: number;
  contract_type: string;
  ec_id: string | null;
}

interface EC {
  fac_id: string;
  fac_name: string;
}

interface ConnectionResult {
    bnf_connected: number;
    ed_connected: number;
    ec_connected: number;
    pc_connected: number;
}

const SummaryCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
);


export default function ConnectingPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loading, setLoading] = useState({ projects: true, data: false, action: '' });
    
    const [startCode, setStartCode] = useState('');
    const [highestCode, setHighestCode] = useState('');

    const [educators, setEducators] = useState<Educator[]>([]);
    const [selectedEducatorIds, setSelectedEducatorIds] = useState<Set<number>>(new Set());
    const [educationCenters, setEducationCenters] = useState<EC[]>([]);
    const [selectedEc, setSelectedEc] = useState('');
    
    const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);

    const [unlinkedSearch, setUnlinkedSearch] = useState('');

    // Fetch projects on initial load
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    // Fetch related data when a project is selected
    const handleProjectSelect = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        setEducators([]);
        setEducationCenters([]);
        setHighestCode('');
        setStartCode('');
        if (!projectId) return;

        setLoading(prev => ({ ...prev, data: true }));
        try {
            const [edRes, ecRes] = await Promise.all([
                fetch('/api/ed-selection'),
                fetch('/api/education-payment-centers')
            ]);
            
            if (!edRes.ok) throw new Error('Could not fetch educators data.');
            const allEducators = await edRes.json();
            const projectEducators = allEducators.filter((e: any) => e.project_id === projectId);
            setEducators(projectEducators);
            
            const maxEdIdNum = projectEducators
                .filter((e: Educator) => e.ed_id && e.ed_id.startsWith('2-'))
                .map((e: Educator) => parseInt(e.ed_id.split('-')[1], 10))
                .reduce((max: number, current: number) => (current > max ? current : max), 0);

            if(maxEdIdNum > 0) {
                setHighestCode(`2-${maxEdIdNum + 1}`);
                setStartCode(String(maxEdIdNum + 1));
            }

            if (!ecRes.ok) throw new Error('Could not fetch education centers.');
            const allEcs = await ecRes.json();
            setEducationCenters(allEcs.filter((ec: any) => ec.project_id === projectId));

        } catch (error: any) {
            toast({ title: "Error loading project data", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({ ...prev, data: false }));
        }
    }, [toast]);

    const handleApiAction = async (action: string, payload: any) => {
        setLoading(prev => ({ ...prev, action }));
        try {
            const res = await fetch('/api/data-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.details || result.error || 'An unknown error occurred.');
            
            toast({ title: "Success", description: result.message });
            
            if (action === 'connect-bnf-to-ed') {
                setConnectionResult(result.stats);
            }
            // Refresh data after action
            await handleProjectSelect(selectedProjectId);
            setSelectedEducatorIds(new Set()); // Clear selection

        } catch (error: any) {
            toast({ title: "Action Failed", description: error.message, variant: 'destructive' });
        } finally {
            setLoading(prev => ({ ...prev, action: '' }));
        }
    };
    
    const unlinkedEducators = useMemo(() => educators.filter(e => !e.ec_id && e.contract_type === 'مثقفة مجتمعية'), [educators]);

    const filteredUnlinkedEducators = useMemo(() => {
        const sorted = [...unlinkedEducators].sort((a, b) => (a.working_village || '').localeCompare(b.working_village || ''));

        if (!unlinkedSearch.trim()) {
            return sorted;
        }

        const searchTerms = unlinkedSearch.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);

        if (searchTerms.length === 0) {
            return sorted;
        }

        return sorted.filter(edu => {
            return searchTerms.some(term => 
                String(edu.ed_id).toLowerCase().includes(term) ||
                edu.applicant_name.toLowerCase().includes(term) ||
                (edu.working_village || '').toLowerCase().includes(term)
            );
        });
    }, [unlinkedEducators, unlinkedSearch]);

    const handleSelectAllSearched = (checked: boolean | 'indeterminate') => {
        if (typeof checked !== 'boolean') return;
        const searchedIds = new Set(filteredUnlinkedEducators.map(e => e.applicant_id));
        if (checked) {
            setSelectedEducatorIds(prev => new Set([...Array.from(prev), ...Array.from(searchedIds)]));
        } else {
            setSelectedEducatorIds(prev => {
                const newSet = new Set(prev);
                searchedIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        }
    };

    const isAllSearchedSelected = useMemo(() => {
        if (filteredUnlinkedEducators.length === 0) return false;
        return filteredUnlinkedEducators.every(edu => selectedEducatorIds.has(edu.applicant_id));
    }, [filteredUnlinkedEducators, selectedEducatorIds]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Connect BNF, ED, EC, PC</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card>
                <CardHeader><CardTitle>1. Select Project</CardTitle></CardHeader>
                <CardContent><Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects}>
                    <SelectTrigger><SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                </Select></CardContent>
            </Card>

            {loading.data ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : selectedProjectId && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>2. Generate Unique Educator Codes</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-end gap-4">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="start-code">Enter Starting Number</Label>
                                <Input id="start-code" type="number" value={startCode} onChange={e => setStartCode(e.target.value)} placeholder="e.g., 2344" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label>Next Recommended Code</Label>
                                <Input value={highestCode} readOnly className="bg-muted" />
                            </div>
                            <Button onClick={() => handleApiAction('generate-ed-codes', { projectId: selectedProjectId, startCode: `2-${startCode}` })} disabled={loading.action === 'generate-ed-codes' || !startCode}>
                                {loading.action === 'generate-ed-codes' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Key className="mr-2 h-4 w-4" />}
                                Generate Codes
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>3. Connect Educators to Education Centers (ED to EC)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by ED_ID, Name, or Village (use comma to separate values)"
                                        value={unlinkedSearch}
                                        onChange={e => setUnlinkedSearch(e.target.value)}
                                        className="pl-10 mb-2"
                                    />
                                </div>
                                <ScrollArea className="h-72 border rounded-md">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="w-12">
                                            <Checkbox 
                                                checked={isAllSearchedSelected}
                                                onCheckedChange={handleSelectAllSearched}
                                            />
                                        </TableHead><TableHead>ED_ID</TableHead><TableHead>Applicant Name</TableHead><TableHead>Working Village</TableHead><TableHead>BNF Count</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {filteredUnlinkedEducators.map(edu => (
                                                <TableRow key={edu.applicant_id}>
                                                    <TableCell><Checkbox checked={selectedEducatorIds.has(edu.applicant_id)} onCheckedChange={checked => setSelectedEducatorIds(prev => { const s = new Set(prev); if(checked) s.add(edu.applicant_id); else s.delete(edu.applicant_id); return s; })} /></TableCell>
                                                    <TableCell>{edu.ed_id}</TableCell>
                                                    <TableCell>{edu.applicant_name}</TableCell>
                                                    <TableCell>{edu.working_village}</TableCell>
                                                    <TableCell>{edu.ed_bnf_cnt}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                            <div className="flex items-end gap-4">
                                <div className="flex-1 space-y-2">
                                    <Label>Assign to Education Center</Label>
                                    <Select value={selectedEc} onValueChange={setSelectedEc}>
                                        <SelectTrigger><SelectValue placeholder="Select EC" /></SelectTrigger>
                                        <SelectContent><ScrollArea className="h-60">{educationCenters.map(ec => <SelectItem key={ec.fac_id} value={ec.fac_id}>{ec.fac_name} ({ec.fac_id})</SelectItem>)}</ScrollArea></SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={() => handleApiAction('connect-ed-to-ec', { educatorIds: Array.from(selectedEducatorIds), ecFacId: selectedEc })} disabled={loading.action === 'connect-ed-to-ec' || selectedEducatorIds.size === 0 || !selectedEc}>
                                     {loading.action === 'connect-ed-to-ec' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Link2 className="mr-2 h-4 w-4" />}
                                    Connect Selected ({selectedEducatorIds.size})
                                </Button>
                                 <Button onClick={() => handleApiAction('enrich-ec-pc', {})} disabled={loading.action === 'enrich-ec-pc'}>
                                    {loading.action === 'enrich-ec-pc' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Enrich Center Data
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    
                     <Card>
                        <CardHeader>
                            <CardTitle>4. Balance & Connect Beneficiaries (ED to BNF)</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                             <div className="flex gap-4">
                                 <Button onClick={() => handleApiAction('balance-bnf-counts', { projectId: selectedProjectId })} disabled={loading.action === 'balance-bnf-counts'}>
                                     {loading.action === 'balance-bnf-counts' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4" />}
                                     Balance Beneficiary Counts
                                 </Button>
                                 <Button onClick={() => handleApiAction('connect-bnf-to-ed', { projectId: selectedProjectId })} disabled={loading.action === 'connect-bnf-to-ed' || loading.action === 'balance-bnf-counts'}>
                                     {loading.action === 'connect-bnf-to-ed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GitBranch className="mr-2 h-4 w-4" />}
                                     Connect Beneficiaries to Educators
                                 </Button>
                             </div>
                             <ScrollArea className="h-72 border rounded-md">
                                 <Table>
                                     <TableHeader><TableRow><TableHead>ED_ID</TableHead><TableHead>Applicant Name</TableHead><TableHead>Working Village</TableHead><TableHead>BNF Count</TableHead></TableRow></TableHeader>
                                     <TableBody>{educators.filter(e => e.contract_type === 'مثقفة مجتمعية').map(edu => <TableRow key={edu.applicant_id}><TableCell>{edu.ed_id}</TableCell><TableCell>{edu.applicant_name}</TableCell><TableCell>{edu.working_village}</TableCell><TableCell>{edu.ed_bnf_cnt}</TableCell></TableRow>)}</TableBody>
                                 </Table>
                             </ScrollArea>
                         </CardContent>
                    </Card>

                    {connectionResult && (
                         <Card>
                            <CardHeader><CardTitle>5. Connection Results</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <SummaryCard title="Beneficiaries Connected" value={connectionResult.bnf_connected} icon={<Users />} />
                                <SummaryCard title="Educators Assigned" value={connectionResult.ed_connected} icon={<Users />} />
                                <SummaryCard title="Education Centers Used" value={connectionResult.ec_connected} icon={<Users />} />
                                <SummaryCard title="Payment Centers Used" value={connectionResult.pc_connected} icon={<Users />} />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
    
