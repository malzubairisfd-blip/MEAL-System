// src/app/meal-system/monitoring/implementation/enrollment/review/download/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import { openDB, IDBPDatabase } from 'idb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { saveAs } from 'file-saver';


interface Project {
  projectId: string;
  projectName: string;
}

const ENROLLMENT_DB_NAME = 'enrollment-review-db';
const ENROLLMENT_STORE_NAME = 'files';
const ENROLLMENT_IMAGES_KEY = 'enrollmentDashboardImages';
const ENROLLMENT_PROCESSED_KEY = 'enrollmentDashboardData';
const ENROLLMENT_DB_VERSION = 2;

// Normalization function
const normalizeReason = (s: string | null | undefined): string => {
  if (!s) return "";
  return String(s)
    .replace(/[أإآ]/g, "ا") // alef variations
    .replace(/ى/g, "ي")    // alef maqsura
    .replace(/ة/g, "ه")    // ta marbuta
    .replace(/[^\u0600-\u06FF\s]/g, '') // Keep only Arabic letters and spaces
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
};

const NORMALIZED_CODE_MAP: Record<string, number> = {
    'ازدواج في الاستفاده مثقفه مستفيده': 2,
    'ازدواج في الاستفاده مثقفه و مستفيده': 2,
    'ازدوج في الاستفادة مثقفة و مستفيدة': 2,
    'التكرار': 3,
    'مستفيده مكرره': 3,
    'عدم القبول بمنافع واشتراطات المشروع': 4,
    'عدم القبول ب منافع المشروع': 4,
    'غياب لاكثر من ثلاث جلسات عامه': 5,
    'الوفاه لاسمح الله': 6,
    'الوفاه': 6,
    'لا تنطبق عليها المعايير': 7,
    'عدم انطباق معايير التأهل على المرأة': 7,
    'عدم استيفاء شروط الالتحاق بالمشروع': 9,
    'خطا في الادخال': 10,
    'ازدواج مثقفه': 12,
    'انتحال شخصيه': 13,
    'تزوير وثائق': 14,
    'انتقال دائم لسكن واقامه المستفيده خارج المديريه': 15,
    'عدم الاستدلال على عنوانها': 51,
    'عدم العثور على المرأة': 51,
    'مغادره المنطقه مؤقتا': 52,
    'رفضت الحضور': 53,
    'نازحه': 54,
    'لم تحضر غائبه': 55,
    'سفر مؤقت': 56,
    'اخرى': 99,
    'اخرى تذكر': 99,
};

const getRecommendation = (code: number) => {
  if ([2, 3, 12].includes(code)) return 'تصنف إلى تكرار/ازدواج';
  if ([6, 7, 9, 13, 10, 14].includes(code)) return 'تصنف إلى مستبعدة';
  if ([4, 5, 15, 51, 52, 53, 54, 55, 56, 99].includes(code)) return 'تبقى مرشحة';
  return '';
};

// Jaro-Winkler similarity function for fuzzy matching
const jaroWinkler = (a: string, b: string): number => {
    const s1 = String(a || "");
    const s2 = String(b || "");
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;

    const l1 = s1.length;
    const l2 = s2.length;
    const matchDist = Math.floor(Math.max(l1, l2) / 2) - 1;
    const m1 = Array(l1).fill(false);
    const m2 = Array(l2).fill(false);
    let matches = 0;

    for (let i = 0; i < l1; i++) {
        const start = Math.max(0, i - matchDist);
        const end = Math.min(i + matchDist + 1, l2);
        for (let j = start; j < end; j++) {
            if (m2[j]) continue;
            if (s1[i] !== s2[j]) continue;
            m1[i] = true;
            m2[j] = true;
            matches++;
            break;
        }
    }

    if (!matches) return 0;

    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < l1; i++) {
        if (!m1[i]) continue;
        while (!m2[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    transpositions /= 2;
    const jaro = (matches / l1 + matches / l2 + (matches - transpositions) / matches) / 3;

    let prefix = 0;
    const maxPrefix = Math.min(4, l1, l2);
    for (let i = 0; i < maxPrefix; i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
};


const buildDisqualifiedSheet = (worksheet: ExcelJS.Worksheet, records: any[]) => {
    const headers = [
      { header: 'م', key: 'serial', width: 5 },
      { header: 'كود المستفيدة', key: 'benef_id', width: 15 },
      { header: 'اسم المستفيدة', key: 'bnf_name', width: 30 },
      { header: 'كود الاستبعاد', key: 'code', width: 15 },
      { header: 'مبرر الاستبعاد', key: 'reason', width: 40 },
      { header: 'كود المثقفة', key: 'ed_id', width: 15 },
      { header: 'اسم المثقفة', key: 'ed_name', width: 30 },
      { header: 'ملاحظات', key: 'notes', width: 40 },
      { header: 'مقترح وتوصية الفرع', key: 'recommendation', width: 30 },
      { header: 'ملاحظات الوحدة', key: 'hq_notes', width: 30 },
      { header: 'توصية الوحدة', key: 'hq_recommendation', width: 30 },
    ];
    worksheet.columns = headers;

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }; // Red header
    headerRow.alignment = { horizontal: 'center' };


    const filtered = records.filter(r => r.the_reason_for_not_joining_the_project_is_stated);

    filtered.forEach((record, index) => {
      const reason = record.the_reason_for_not_joining_the_project_is_stated;
      const normalizedReason = normalizeReason(reason);
      
      let bestMatch = { score: 0, code: 99 };
      const SIMILARITY_THRESHOLD = 0.85;

      for (const [key, code] of Object.entries(NORMALIZED_CODE_MAP)) {
          const normalizedKey = normalizeReason(key);
          const score = jaroWinkler(normalizedReason, normalizedKey);

          if (score > bestMatch.score) {
              bestMatch = { score, code };
          }
      }
      
      const finalCode = bestMatch.score >= SIMILARITY_THRESHOLD ? bestMatch.code : 99;
      const recommendation = getRecommendation(finalCode);
      
      worksheet.addRow({
        serial: index + 1,
        benef_id: record.benef_id,
        bnf_name: record.bnf_name,
        code: finalCode,
        reason,
        ed_id: record.ed_id,
        ed_name: record.ed_name,
        notes: record.other_things_to_mention,
        recommendation,
        hq_notes: '',
        hq_recommendation: ''
      });
    });

    worksheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
    });
};

const addDashboardImages = (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, images: Record<string, string> | undefined, processedData: any) => {
    if (!images) return;
    worksheet.views = [{ rightToLeft: true }];
    worksheet.columns = [
      { width: 2 },
      { width: 20 },
      { width: 20 },
      { width: 16 },
      { width: 20 },
      { width: 20 },
    ];

    worksheet.mergeCells('B2:F2');
    const titleCell = worksheet.getCell('B2');
    titleCell.value = "Analysis Dashboard Report";
    titleCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF002060' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 30;

    const kf = processedData.keyFigures;
    const keyFiguresData = [
      { title: 'Total Enrollments', value: processedData?.total ?? '', cell: 'B4' },
      ...(processedData?.modificationTypes
        ? Object.entries(processedData.modificationTypes).map(([type, value], idx) => ({
            title: type,
            value,
            cell: String.fromCharCode(67 + idx) + '4'
          }))
        : []),
    ];

    keyFiguresData.forEach(item => {
      const title = worksheet.getCell(item.cell);
      title.value = item.title;
      title.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };

      const valueCell = worksheet.getCell(item.cell.replace('4', '5'));
      valueCell.value = item.value as any;
      valueCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF002060' } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    worksheet.getRow(5).height = 30;

    const addImage = (base64: string, tl: { col: number; row: number }, ext: { width: number; height: number }) => {
      if (!base64 || !base64.startsWith('data:image/png;base64,')) return;
      const imageId = workbook.addImage({
        base64: base64.split(',')[1],
        extension: 'png'
      });
      worksheet.addImage(imageId, { tl, ext });
    };

    let currentRow = 7;
    const rowGap = 1;

    if (images.signingDays) addImage(images.signingDays, { col: 1, row: currentRow }, { width: 450, height: 400 });
    if (images.ozlaChart) addImage(images.ozlaChart, { col: 6, row: currentRow }, { width: 450, height: 400 });
    currentRow += Math.round(400 / 15) + rowGap;

    if (images.bubbleChart) addImage(images.bubbleChart, { col: 1, row: currentRow }, { width: 900, height: 400 });
    currentRow += Math.round(400 / 15) + rowGap;

    if (images.namePartsTable) addImage(images.namePartsTable, { col: 1, row: currentRow }, { width: 450, height: 250 });
    if (images.pieCharts) addImage(images.pieCharts, { col: 6, row: currentRow }, { width: 450, height: 250 });
    currentRow += Math.round(250 / 15) + rowGap;

    if (images.nonSigningChart) addImage(images.nonSigningChart, { col: 1, row: currentRow }, { width: 900, height: 300 });
    currentRow += Math.round(300 / 15) + rowGap;

    if (images.recommendationsTable) addImage(images.recommendationsTable, { col: 1, row: currentRow }, { width: 900, height: 250 });
};

export default function DownloadEnrollmentPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState({ projects: true, generating: false, progress: 0 });
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(prev => ({ ...prev, projects: true }));
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error("Failed to load projects");
        setProjects(await res.json());
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(prev => ({ ...prev, projects: false }));
      }
    };
    fetchProjects();
  }, [toast]);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find(p => p.projectId === projectId);
    setSelectedProject(project || null);
  };

  const getEnrollmentDb = async (): Promise<IDBPDatabase> => openDB(ENROLLMENT_DB_NAME, ENROLLMENT_DB_VERSION);

  const loadEnrollmentDashboardData = async () => {
    try {
      const db = await getEnrollmentDb();
      const chartImages = await db.get(ENROLLMENT_STORE_NAME, ENROLLMENT_IMAGES_KEY);
      const processedDataForReport = await db.get(ENROLLMENT_STORE_NAME, ENROLLMENT_PROCESSED_KEY);
      if (chartImages && processedDataForReport) {
        return { chartImages, processedDataForReport };
      }
    } catch (error) {
      console.error("Failed to read dashboard cache:", error);
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!selectedProjectId) {
      toast({ title: "No Project Selected", description: "Please select a project.", variant: "destructive" });
      return;
    }
    
    setLoading(prev => ({ ...prev, generating: true, progress: 5 }));
    setStatus("Fetching enrollment records");

    try {
        const res = await fetch(`/api/enrollment-review?projectId=${selectedProjectId}`);
        if (!res.ok) throw new Error("Failed to fetch data.");
        const records = await res.json();
      
        setStatus("Building workbook");
        setLoading(prev => ({ ...prev, progress: 20 }));

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "MEAL System";
        
        const mainSheet = workbook.addWorksheet('Enrollment Review Results');

        if (records.length > 0) {
            const columns = Object.keys(records[0]);
            mainSheet.columns = columns.map(key => ({ header: key, key, width: 20 }));
            
            const headerRow = mainSheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
            headerRow.alignment = { horizontal: 'center' };

            mainSheet.addRows(records);

            mainSheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                 row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });
        }
        
        setStatus("Adding disqualified sheet");
        setLoading(prev => ({ ...prev, progress: 40 }));
        
        const disqualifiedSheet = workbook.addWorksheet('Disqualified');
        buildDisqualifiedSheet(disqualifiedSheet, records);

        setStatus("Loading dashboard cache");
        setLoading(prev => ({ ...prev, progress: 60 }));

        const cachedDashboard = await loadEnrollmentDashboardData();
        if (cachedDashboard) {
            const dashboardSheet = workbook.addWorksheet('Enrollment Dashboard');
            addDashboardImages(workbook, dashboardSheet, cachedDashboard.chartImages, cachedDashboard.processedDataForReport);
        }

        setStatus("Finalizing file");
        setLoading(prev => ({ ...prev, progress: 90 }));

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Enrollment_Review_Report_${selectedProjectId}.xlsx`);

        setLoading(prev => ({ ...prev, generating: false, progress: 100 }));
        setStatus("Completed");
        toast({ title: "Success", description: "Enrollment report downloaded." });
    } catch (error: any) {
        setLoading(prev => ({ ...prev, generating: false, progress: 0 }));
        setStatus("Idle");
        toast({ title: "Error", description: error.message || 'Failed to generate the report.', variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Download Enrollment Reports</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/enrollment/review">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review Hub
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Select Project</CardTitle>
          <CardDescription>Select the project for which you want to generate the Excel report.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects || loading.generating}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
            </SelectTrigger>
            <SelectContent>
              {projects.map(project => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName} ({project.projectId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProject && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm">
              <p><strong>Project ID:</strong> {selectedProject.projectId}</p>
              <p><strong>Project Name:</strong> {selectedProject.projectName}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Generate & Download</CardTitle>
          <CardDescription>Download the compiled Excel workbook that includes all sheets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerate} disabled={!selectedProjectId || loading.generating}>
            {loading.generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {loading.generating ? `Generating... (${status})` : "Generate & Download Report"}
          </Button>
          {loading.generating && (
            <div className="space-y-1">
              <Progress value={loading.progress} />
              <p className="text-sm text-center mt-1 text-muted-foreground">
                {status}...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
