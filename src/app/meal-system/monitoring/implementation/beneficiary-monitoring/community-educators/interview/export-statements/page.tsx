
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
import { amiriFontBase64 } from "@/lib/amiri-font";
import jsPDF from "jspdf";
import "jspdf-autotable";


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

const safeText = (v: any) => (v === null || v === undefined ? "" : String(v));

const statements = [
    {
      title: "كشف درجات ممثل الصندوق",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "درجة الفقر", "درجة الاستهداف", "ملاحظات", "توقيع ممثل الصندوق"],
      widths: [20, 40, 150, 50, 50, 90, 80],
    },
    {
      title: "كشف درجات ممثل الصحة",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "اللياقة الصحية", "القدرة على العمل", "ملاحظات صحية", "توقيع ممثل الصحة"],
      widths: [20, 40, 150, 50, 50, 90, 80],
    },
    {
      title: "كشف درجات ممثل المجلس المحلي",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "الإقامة الفعلية", "السمعة المجتمعية", "ملاحظات", "توقيع ممثل المجلس"],
      widths: [20, 40, 150, 50, 60, 80, 80],
    },
    {
      title: "كشف الحضور والغياب",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "حضرت", "غابت", "سبب الغياب", "التوقيع"],
      widths: [20, 40, 150, 40, 40, 110, 80],
    },
    {
      title: "كشف التواصل",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "رقم الهاتف", "تم التواصل", "لم يتم", "ملاحظات"],
      widths: [20, 40, 150, 80, 50, 50, 90],
    },
    {
      title: "كشف تعديلات البيانات",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "البيان قبل التعديل", "البيان بعد التعديل", "سبب التعديل", "توقيع اللجنة"],
      widths: [20, 40, 120, 100, 100, 80, 80],
    },
    {
      title: "كشف درجات المقابلة (FINAL DECISION)",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "درجة المؤهل", "درجة الهوية", "درجة الخبرة", "المجموع", "القرار", "ملاحظات"],
      widths: [20, 40, 120, 50, 50, 50, 50, 60, 90],
      footer: true,
    },
];

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
            
            const accepted = allApplicants.filter(a => a['Acceptance Statement'] === 'مقبولة');
            setAllAccepted(accepted);

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
    
    const generateCombinedPdf = async () => {
        setLoading(prev => ({ ...prev, exporting: true }));
        try {
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            doc.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
            doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
            doc.setFont("Amiri");

            const project = projects.find(p => p.projectId === selectedProjectId);
            if (!project) throw new Error("Project not found");

            for (const hall of halls) {
                if (!hall.name) continue;

                const hallApplicants = allAccepted.filter(a => a.hallName === hall.name && String(a.hallNumber) === String(hall.number));
                if (hallApplicants.length === 0) continue;

                for (const stmt of statements) {
                    doc.addPage();
                    doc.setFont("Amiri");
                    doc.setFontSize(12);

                    drawRight(doc, `اسم المشروع: ${project.projectName}`, 15, doc.internal.pageSize.getHeight() - 15);
                    drawRight(doc, `الجهة المنفذة: `, 15, doc.internal.pageSize.getHeight() - 22);
                    drawRight(doc, `المحافظة / المديرية: ${project.governorates[0] || ''} / ${project.districts[0] || ''}`, 15, doc.internal.pageSize.getHeight() - 29);
                    doc.text(`اسم القاعة: ${hall.name}`, 15, 15);
                    doc.text(`رقم القاعة: ${hall.number}`, 15, 22);
                    doc.text(`تاريخ المقابلة: `, 15, 29);
                    
                    drawCenter(doc, stmt.title, doc.internal.pageSize.getHeight() - 45, 16);

                    const body = hallApplicants.map((applicant, i) => {
                        const baseData = [
                            i + 1,
                            safeText(applicant["_id"]),
                            safeText(applicant.applicantName),
                        ];
                        if (stmt.title.includes("التواصل")) {
                            return [...baseData.slice(0,3), safeText(applicant["phoneNumber"]), '', '', ''];
                        }
                        return [...baseData, ...Array(stmt.cols.length - 3).fill('')];
                    });

                     (doc as any).autoTable({
                        head: [stmt.cols],
                        body: body,
                        startY: 55,
                        theme: 'grid',
                        styles: { font: 'Amiri', halign: 'center', cellPadding: 2, fontSize: 8 },
                        headStyles: { fillColor: [40, 116, 166], font: 'Amiri', fontStyle: 'bold' },
                        columnStyles: { 2: { halign: 'right' } }
                    });
                    
                    if(stmt.footer) {
                         const finalY = (doc as any).lastAutoTable.finalY + 25;
                         const roles = ["رئيس اللجنة", "ممثل الصندوق", "ممثل الصحة", "ممثل المجلس المحلي"];
                         const cellWidth = doc.internal.pageSize.getWidth() / roles.length;
                         roles.forEach((role, i) => {
                            const x = (cellWidth * i) + (cellWidth / 2);
                            doc.text(role, x, finalY, { align: 'center' });
                            doc.text("الاسم:", x, finalY + 7, { align: 'center' });
                            doc.text("التوقيع:", x, finalY + 14, { align: 'center' });
                            doc.text("التاريخ:", x, finalY + 21, { align: 'center' });
                         });
                    }
                }
            }
            doc.deletePage(1); // Delete the initial blank page
            doc.save(`Interview_Statements_${project.projectName}.pdf`);
            toast({ title: `Combined PDF Generated for ${project.projectName}` });
        } catch (error: any) {
            toast({ title: "PDF Export Error", description: error.message, variant: "destructive" });
        } finally {
             setLoading(prev => ({ ...prev, exporting: false }));
        }
    };
    
    const drawRight = (doc: jsPDF, text: string, x: number, y: number, size = 10) => {
        const textWidth = doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
        doc.text(text, doc.internal.pageSize.getWidth() - x - textWidth, y, { align: 'right' });
    };

    const drawCenter = (doc: jsPDF, text: string, y: number, size = 12) => {
        const textWidth = doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
        doc.text(text, (doc.internal.pageSize.getWidth() - textWidth) / 2, y);
    };

    const unassignedApplicants = useMemo(() => allAccepted.filter(a => !a.hallName || !a.hallNumber), [allAccepted]);
    
    const canExport = useMemo(() => {
        if (!selectedProjectId || allAccepted.length === 0) return false;
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
            <CardDescription>Once all applicants are assigned, generate the final PDF document for all halls.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
            <Button onClick={generateCombinedPdf} disabled={!canExport || loading.exporting}>
                {loading.exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Generate All Statements PDF
            </Button>
            {selectedProjectId && !canExport && <p className="text-xs text-muted-foreground mt-2">This will be enabled once all accepted applicants for the selected project have been assigned.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
