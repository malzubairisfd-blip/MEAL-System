"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { amiriFontBase64 } from "@/lib/amiri-font";
import { useToast } from "@/hooks/use-toast";

interface Project {
  projectId: string;
  projectName: string;
}

interface Applicant {
  applicant_id: number;
  applicant_name: string;
  id_type: string;
  id_no: string;
  interview_hall_no: number;
  interview_hall_name: string;
}

export default function ExportExactPDFPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to fetch projects');
        setProjects(await res.json());
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    };
    fetchProjects();
  }, [toast]);

  useEffect(() => {
    if (!selectedProjectId) {
        setApplicants([]);
        return;
    };
    
    const fetchApplicants = async () => {
        setIsFetchingData(true);
        try {
            const res = await fetch(`/api/ed-selection`);
             if (!res.ok) throw new Error('Failed to fetch applicants');
             const allApplicants = await res.json();
             const projectApplicants = allApplicants.filter((app: any) => app.project_id === selectedProjectId && app.interview_hall_no != null);
             setApplicants(projectApplicants);
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsFetchingData(false);
        }
    };
    fetchApplicants();
  }, [selectedProjectId, toast]);

  const generateExactPDF = () => {
    if (applicants.length === 0) {
        toast({ title: "No Data", description: "No applicants with assigned halls for the selected project.", variant: "destructive"});
        return;
    }

    setLoading(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      const fontData = amiriFontBase64.replace(/^data:font\/ttf;base64,/, "").replace(/\s/g, "");
      doc.addFileToVFS("Amiri-Regular.ttf", fontData);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      doc.setFont("Amiri");

      const pageWidth = doc.internal.pageSize.getWidth();

      const groupedByHall = applicants.reduce((acc, app) => {
        const hallNum = app.interview_hall_no || 0;
        if (!acc[hallNum]) {
            acc[hallNum] = { hallName: app.interview_hall_name, applicants: [] };
        }
        acc[hallNum].applicants.push(app);
        return acc;
      }, {} as Record<number, { hallName: string, applicants: Applicant[] }>);


      Object.entries(groupedByHall).forEach(([hallNumber, hallData], hallIndex) => {
          if (hallIndex > 0) {
              doc.addPage();
          }
          
          // --- HEADER ---
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text("الصندوق الاجتماعي للتنمية", pageWidth - 15, 10, { align: 'right' });
          doc.text("برنامج التحويلات النقدية المشروطة في التغذية", pageWidth - 15, 15, { align: 'right' });

          // --- LOGO ---
          const logoX = 15, logoY = 10;
          doc.setFillColor(40, 60, 80);
          doc.rect(logoX, logoY, 8, 24, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("S", logoX + 4, logoY + 6, { align: 'center', baseline: 'middle' });
          doc.text("F", logoX + 4, logoY + 14, { align: 'center', baseline: 'middle' });
          doc.text("D", logoX + 4, logoY + 22, { align: 'center', baseline: 'middle' });
          doc.setFont("Amiri", "normal");
          doc.setTextColor(40, 60, 80);
          doc.setFontSize(14);
          doc.text("الصندوق", logoX + 10, logoY + 6);
          doc.text("الاجتماعي", logoX + 10, logoY + 13);
          doc.text("للتنمية", logoX + 10, logoY + 20);
          doc.setFontSize(7);
          doc.text("Social Fund for Development", logoX, logoY + 28);

          // --- INFO TABLE ---
          (doc as any).autoTable({
            startY: 20, margin: { left: pageWidth - 100 }, head: [],
            body: [[hallData.hallName || 'N/A', "مركز التدريب"], [hallNumber, "رقم القاعة"]],
            theme: 'grid', styles: { font: 'Amiri', fontSize: 10, cellPadding: 1, halign: 'center', valign: 'middle' },
            columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 30, fillColor: [240, 240, 240], fontStyle: 'bold' } }
          });
          
          // --- TITLE ---
          doc.setFont("Amiri");
          const title = "كشف درجات ممثل الصحة";
          const titleWidth = 80, titleHeight = 10, titleX = (pageWidth - titleWidth) / 2, titleY = 20;
          doc.setFillColor(0, 176, 240);
          doc.roundedRect(titleX, titleY, titleWidth, titleHeight, 2, 2, 'F');
          doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont("Amiri", "bold");
          doc.text(title, titleX + (titleWidth / 2), titleY + 7, { align: 'center' });

          // --- MAIN TABLE ---
          const tableHeaders = ["درجة المقابلة", "رقمها", "نوع الهوية", "اسم المثقفة", "كود\nالمثقفة", "الرقم"];
          const tableBody = hallData.applicants.map((row, i) => ["", row.id_no || '', row.id_type || '', row.applicant_name, row.applicant_id, i + 1]);
          
          (doc as any).autoTable({
            startY: 45, head: [tableHeaders], body: tableBody,
            theme: 'grid', styles: { font: 'Amiri', fontSize: 10, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [230, 230, 230], textColor: [0,0,0], fontStyle: 'bold', lineWidth: 0.2 },
            columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 40 }, 2: { cellWidth: 30 }, 3: { cellWidth: 80, halign: 'right' }, 4: { cellWidth: 20 }, 5: { cellWidth: 15 } },
            margin: { left: (pageWidth - 235) / 2 }
          });
          
          // --- FOOTER ---
          const finalY = (doc as any).lastAutoTable.finalY + 15;
          doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont("Amiri", "normal");
          doc.text("الاسم:", pageWidth - 20, finalY, { align: 'right' });
          doc.text("التوقيع:", pageWidth - 20, finalY + 10, { align: 'right' });
      });

      doc.save("Interview_Scores_Exact_Replica.pdf");

    } catch (error) {
      console.error(error);
      toast({title: "Error Generating PDF", description: "See console for details.", variant: 'destructive'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export Interview Sheets</CardTitle>
          <CardDescription>Select a project to generate a PDF of the interview scoresheet, formatted exactly as required.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder="Select a Project" />
                </SelectTrigger>
                <SelectContent>
                    {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button onClick={generateExactPDF} disabled={loading || isFetchingData || !selectedProjectId} className="bg-blue-600 hover:bg-blue-700">
              {(loading || isFetchingData) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              {isFetchingData ? 'Loading Applicants...' : loading ? 'Generating PDF...' : `Export PDF for ${applicants.length} Applicants`}
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
