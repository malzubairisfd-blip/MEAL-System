
// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Link as LinkIcon, FileDown, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Project {
  projectId: string;
  projectName: string;
  governorates: string[];
  districts: string[];
}

interface Applicant {
  _id: string;
  applicantName: string;
  hallName?: string | null;
  hallNumber?: string | null;
  [key: string]: any;
}

interface Hall {
  name: string;
  number: string;
}

export default function ExportStatementsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    
    const [numberOfHalls, setNumberOfHalls] = useState(1);
    const [halls, setHalls] = useState<Hall[]>([{ name: '', number: '1' }]);
    
    const [allAccepted, setAllAccepted] = useState<Applicant[]>([]);
    const [selectedApplicants, setSelectedApplicants] = useState<Set<string>>(new Set());
    const [selectedHall, setSelectedHall] = useState('');
    
    const [loading, setLoading] = useState({ projects: true, applicants: false, linking: false, exporting: false });
    const [allInitiallyAssigned, setAllInitiallyAssigned] = useState(false);

    // Fetch projects on load
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error('Failed to fetch projects.');
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    const fetchApplicants = useCallback(async (projectId: string) => {
        if (!projectId) {
            setAllAccepted([]);
            setAllInitiallyAssigned(false);
            return;
        }
        setLoading(prev => ({ ...prev, applicants: true }));
        try {
            const res = await fetch('/api/ed-selection');
            if (!res.ok) throw new Error('Failed to fetch applicant data.');
            const allApplicants: Applicant[] = await res.json();
            
            // This logic is simplified; in a real app, you might filter by projectId if the API returns all.
            const accepted = allApplicants.filter(a => a['Acceptance Statement'] === 'مقبولة');
            setAllAccepted(accepted);

            // Verification step
            const unassigned = accepted.filter(a => !a.hallName || !a.hallNumber);
            setAllInitiallyAssigned(unassigned.length === 0 && accepted.length > 0);
            if (unassigned.length === 0 && accepted.length > 0) {
                 toast({ title: "Verification Complete", description: "All accepted applicants are already assigned to halls. You can generate PDFs now." });
            }

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setLoading(prev => ({ ...prev, applicants: false }));
        }
    }, [toast]);
    
    useEffect(() => {
        if(selectedProjectId) {
            fetchApplicants(selectedProjectId);
        }
    }, [selectedProjectId, fetchApplicants]);


    useEffect(() => {
        setHalls(prev => {
           const newHalls = Array.from({ length: numberOfHalls }, (_, i) => prev[i] || { name: '', number: String(i + 1) });
           // Ensure hall numbers are sequential if length changes
           return newHalls.map((h, i) => ({...h, number: String(i+1)}));
        });
    }, [numberOfHalls]);

    const handleHallChange = (index: number, field: 'name' | 'number', value: string) => {
        setHalls(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
    };
    
    const handleSelectApplicant = (applicantId: string) => {
        setSelectedApplicants(prev => {
            const newSet = new Set(prev);
            newSet.has(applicantId) ? newSet.delete(applicantId) : newSet.add(applicantId);
            return newSet;
        });
    };

    const handleLinkApplicants = async () => {
        const hallInfo = halls.find(h => h.number === selectedHall);
        if (!hallInfo || !hallInfo.name) {
            toast({ title: "Hall not configured", description: "Please ensure the selected hall has a name.", variant: "destructive" });
            return;
        }
        setLoading(prev => ({ ...prev, linking: true }));
        try {
            const res = await fetch('/api/ed-selection', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicantIds: Array.from(selectedApplicants), hallName: hallInfo.name, hallNumber: hallInfo.number }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Failed to assign applicants.");
            toast({ title: "Success", description: `${selectedApplicants.size} applicants assigned to ${hallInfo.name}.` });
            setSelectedApplicants(new Set());
            setSelectedHall('');
            await fetchApplicants(selectedProjectId); // Refresh the data to update UI
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({ ...prev, linking: false }));
        }
    };
    
    const generatePdfForHall = async (hall: Hall) => {
      setLoading(prev => ({ ...prev, exporting: true }));
      try {
        const payload = {
          projectId: selectedProjectId,
          hall: hall,
        }
        const response = await fetch('/api/interview-statements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Could not generate PDF.");
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Interview_Statements_${hall.name}_${hall.number}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast({ title: `PDF Generated for Hall ${hall.name}` });

      } catch (error: any) {
        toast({ title: "PDF Export Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(prev => ({ ...prev, exporting: false }));
      }
    };

    const unassignedApplicants = useMemo(() => allAccepted.filter(a => !a.hallName || !a.hallNumber), [allAccepted]);
    
    // Check if we have any data loaded first, and if everything is assigned
    const canExport = useMemo(() => {
        if (!selectedProjectId || allAccepted.length === 0) return false;
        // Export is enabled if everyone is assigned (unassigned length is 0)
        return unassignedApplicants.length === 0;
    }, [selectedProjectId, allAccepted, unassignedApplicants]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Export Interview Statements</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>1. Project & Hall Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label>Project</Label>
                     <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                         <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                         <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="num-halls">Number of Interview Halls</Label>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setNumberOfHalls(n => Math.max(1, n-1))}><Minus className="h-4 w-4"/></Button>
                        <Input id="num-halls" type="number" min="1" value={numberOfHalls} onChange={(e) => setNumberOfHalls(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 text-center" />
                        <Button variant="outline" size="icon" onClick={() => setNumberOfHalls(n => n+1)}><Plus className="h-4 w-4"/></Button>
                    </div>
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {halls.map((hall, index) => (
                      <Card key={index} className="p-4 space-y-2">
                          <Label className="font-semibold">Hall {index + 1}</Label>
                          <Input placeholder="Hall Name" value={hall.name} onChange={(e) => handleHallChange(index, 'name', e.target.value)} />
                          <Input placeholder="Hall Number" value={hall.number} readOnly />
                      </Card>
                  ))}
              </div>
          </CardContent>
      </Card>
      
      {loading.applicants && (
         <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
      )}

      {!loading.applicants && selectedProjectId && !allInitiallyAssigned && (
        <Card>
            <CardHeader>
                <CardTitle>2. Assign Applicants to Halls</CardTitle>
                <CardDescription>Select applicants from the table and assign them to a configured hall.</CardDescription>
            </CardHeader>
            <CardContent>
                {unassignedApplicants.length > 0 ? (
                    <div className="space-y-4">
                        <ScrollArea className="h-96 border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                              checked={selectedApplicants.size === unassignedApplicants.length && unassignedApplicants.length > 0}
                                              onCheckedChange={(checked) => setSelectedApplicants(checked ? new Set(unassignedApplicants.map(a => a._id)) : new Set())}
                                            />
                                        </TableHead>
                                        <TableHead>Applicant ID</TableHead>
                                        <TableHead>Applicant Name</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unassignedApplicants.map(app => (
                                        <TableRow key={app._id} onClick={() => handleSelectApplicant(app._id)} className="cursor-pointer">
                                            <TableCell><Checkbox checked={selectedApplicants.has(app._id)} onCheckedChange={() => handleSelectApplicant(app._id)}/></TableCell>
                                            <TableCell>{app._id}</TableCell>
                                            <TableCell>{app.applicantName}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <p className="text-sm font-medium">{selectedApplicants.size} applicants selected</p>
                            <div className="flex-1 flex gap-2 items-center">
                                <Select onValueChange={setSelectedHall} value={selectedHall}>
                                    <SelectTrigger className="md:w-72">
                                        <SelectValue placeholder="Select a hall to assign..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {halls.filter(h => h.name && h.number).map((h, i) => (
                                            <SelectItem key={i} value={h.number}>{h.name} (Hall {h.number})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button onClick={handleLinkApplicants} disabled={selectedApplicants.size === 0 || !selectedHall || loading.linking}>
                                    {loading.linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LinkIcon className="mr-2 h-4 w-4"/>}
                                    Link Applicants
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : <p className="text-center text-muted-foreground p-8">All accepted applicants have been assigned.</p>}
            </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
            <CardTitle>3. Generate & Export</CardTitle>
            <CardDescription>Once all applicants are assigned, generate the final PDF documents for each hall.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
             {halls.map((hall, index) => (
                <Button key={index} onClick={() => generatePdfForHall(hall)} disabled={!canExport || loading.exporting || !hall.name}>
                    {loading.exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    Hall {hall.number || index + 1} PDF
                </Button>
            ))}
            {selectedProjectId && !canExport && <p className="text-xs text-muted-foreground mt-2">This will be enabled once all accepted applicants for the selected project have been assigned.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
