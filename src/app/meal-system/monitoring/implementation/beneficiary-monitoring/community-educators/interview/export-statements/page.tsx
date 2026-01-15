// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, FileDown, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Project {
  projectId: string;
  projectName: string;
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
    
    const [loading, setLoading] = useState({ projects: true, exporting: false });

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
    
    const generatePdf = async () => {
        if (!selectedProjectId || halls.some(h => !h.name)) {
            toast({ title: "Incomplete Information", description: "Please select a project and ensure all halls have a name.", variant: "destructive"});
            return;
        }
        
        setLoading(prev => ({ ...prev, exporting: true }));
        try {
            const response = await fetch('/api/interview-statements', {
                method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ projectId: selectedProjectId, halls: halls })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to generate PDF`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Interview_Statements_${selectedProjectId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            toast({ title: `PDF Generated` });

        } catch (error: any) {
            toast({ title: "PDF Export Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({ ...prev, exporting: false }));
        }
    };

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
      
      <Card>
        <CardHeader>
            <CardTitle>2. Generate & Export</CardTitle>
            <CardDescription>Generate a single PDF containing all statements for all configured halls.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
            <Button onClick={generatePdf} disabled={loading.exporting || !selectedProjectId}>
                {loading.exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Generate All Statements PDF
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
