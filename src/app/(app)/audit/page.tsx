
"use client";

import { useState, useEffect } from "react";
import type { RecordRow, AuditFinding } from "@/lib/auditEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ChevronLeft, FileDown, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with the autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}


export default function AuditPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState({ data: false, audit: false, export: false });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(prev => ({...prev, data: true}));
    try {
        const res = await fetch("/api/cluster-cache");
        const data = await res.json();
        if (res.ok && data.clusters) {
            const flattenedRows: RecordRow[] = data.clusters.flat();
            setRows(flattenedRows);
            if (flattenedRows.length > 0) {
              toast({ title: "Data Loaded", description: `${flattenedRows.length} records ready for audit.` });
            } else {
              toast({ title: "No Data", description: "No data in cache. Please upload and process a file first." });
            }
        } else {
            toast({ title: "Error", description: "Failed to load data from cache.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Network Error", description: "Could not connect to the server.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, data: false}));
    }
  }

  async function runAuditNow() {
    if (rows.length === 0) {
        toast({ title: "No Data", description: "Please load data before running an audit.", variant: "destructive" });
        return;
    }
    setLoading(prev => ({...prev, audit: true}));
    try {
        const res = await fetch("/api/audit", {
        method: "POST",
        body: JSON.stringify({ rows }),
        headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();
        if (res.ok) {
            setFindings(data.findings);
            toast({ title: "Audit Complete", description: `${data.findings.length} potential issues found.` });
        } else {
            toast({ title: "Audit Error", description: "An error occurred during the audit.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Network Error", description: "Could not connect to the audit service.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, audit: false}));
    }
  }
  
  const getSeverityBadge = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high": return <Badge variant="destructive">High</Badge>;
      case "medium": return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const exportToExcel = async () => {
    if (findings.length === 0) {
      toast({ title: "No Data", description: "No audit findings to export.", variant: "destructive" });
      return;
    }
    setLoading(prev => ({ ...prev, export: true }));
    try {
      const response = await fetch('/api/audit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findings }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate Excel file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Your Excel file has been downloaded." });
    } catch (error) {
      console.error(error);
      toast({ title: "Export Error", description: "Could not export data to Excel.", variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  const exportToPdf = async () => {
    if (findings.length === 0) {
      toast({ title: "No Data", description: "No audit findings to export.", variant: "destructive" });
      return;
    }
    
    const doc = new jsPDF() as jsPDFWithAutoTable;

    try {
      // Fetch and embed the font
      const fontResponse = await fetch('/fonts/Amiri-Regular.ttf');
      if (!fontResponse.ok) throw new Error("Font file not found");
      const fontBuffer = await fontResponse.arrayBuffer();
      const fontBase64 = arrayBufferToBase64(fontBuffer);

      doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
      doc.setFont('Amiri');
    } catch (fontError) {
      console.error("Font loading error:", fontError);
      toast({ title: "Font Error", description: "Could not load the required font for PDF generation.", variant: "destructive" });
      // Fallback to default font
      doc.setFont("helvetica");
    }
    
    // Header
    doc.setFontSize(18);
    doc.text("تقرير تدقيق البيانات", doc.internal.pageSize.width - 14, 22, { align: 'right', lang: 'ar' });
    doc.setFontSize(11);
    doc.text(`تم إنشاؤه في: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = findings.flatMap(finding => 
      finding.records.map(record => ({
        severity: finding.severity,
        type: finding.type,
        description: finding.description,
        womanName: record.womanName,
        husbandName: record.husbandName,
        nationalId: record.nationalId,
        phone: record.phone,
      }))
    );

    doc.autoTable({
      startY: 40,
      head: [['الرقم القومي', 'الزوج', 'الزوجة', 'الوصف', 'النوع', 'الخطورة']],
      body: tableData.map(d => [d.nationalId, d.husbandName, d.womanName, d.description, d.type, d.severity]),
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], font: 'Amiri', halign: 'right' },
      bodyStyles: { font: 'Amiri', halign: 'right' },
      didParseCell: function (data) {
        if (data.section !== 'body') return;
        // Right-align Arabic content is now set in bodyStyles
        
        const rowData = tableData[data.row.index];
        if (rowData?.severity === 'high') {
          data.cell.styles.fillColor = '#fde2e2'; // Light red
        } else if (rowData?.severity === 'medium') {
          data.cell.styles.fillColor = '#fef3c7'; // Light yellow
        }
      },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`صفحة ${i} من ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }
    
    doc.save("audit-report.pdf");
    toast({ title: "Export Successful", description: "Your PDF file has been downloaded." });
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Data Integrity Audit</CardTitle>
                  <CardDescription>
                    Run a set of rules against your dataset to identify potential issues like duplicates, invalid relationships, and data entry errors.
                    {rows.length > 0 && ` Currently loaded ${rows.length} records.`}
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/review">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Review
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={loadData} disabled={loading.data || loading.audit}>
              {loading.data ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reload Data
            </Button>
            <Button onClick={runAuditNow} disabled={loading.audit || loading.data || rows.length === 0}>
              {loading.audit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Run Audit
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {loading.audit ? (
        <div className="text-center text-muted-foreground py-10">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">Running audit...</p>
        </div>
      ) : findings.length > 0 ? (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Audit Findings</CardTitle>
                        <CardDescription>{findings.length} issues identified.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={exportToExcel} variant="outline" disabled={loading.export}>
                            {loading.export ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            Export to Excel
                        </Button>
                         <Button onClick={exportToPdf} variant="outline">
                            <FileText className="mr-2 h-4 w-4" />
                            Export PDF Report
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                    {findings.map((f, i) => (
                    <AccordionItem value={`item-${i}`} key={i}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-4">
                                {getSeverityBadge(f.severity)}
                                <span className="font-semibold text-left">{f.type}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2">
                            <p className="text-muted-foreground">{f.description}</p>
                            <div className="p-3 bg-muted/50 rounded-md">
                                <h4 className="font-semibold mb-2">Affected Records:</h4>
                                <ul className="space-y-1 text-sm">
                                {f.records.map((r, idx: number) => (
                                    <li key={idx} className="flex justify-between">
                                    <span>{r.womanName} (Husband: {r.husbandName})</span>
                                    <span className="font-mono text-muted-foreground">ID: {r.nationalId}</span>
                                    </li>
                                ))}
                                </ul>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
      ) : (
        !loading.audit && rows.length > 0 && (
            <Card className="text-center py-10">
                <CardContent className="flex flex-col items-center gap-4">
                    <ShieldCheck className="h-12 w-12 text-green-500" />
                    <h3 className="text-xl font-semibold">No Issues Found</h3>
                    <p className="text-muted-foreground">The audit completed without finding any issues based on the current rules.</p>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}

    