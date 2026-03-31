"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { saveAs } from "file-saver";
import JSZip from "jszip";

interface Project {
  projectId: string;
  projectName: string;
}

const MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, أغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

type BeneficiaryRecord = Record<string, any>;

const ROWS_PER_PAGE = 8;

// Dynamic import for html2pdf to avoid SSR issues in Next.js
let html2pdf: any;
if (typeof window !== "undefined") {
  html2pdf = require("html2pdf.js");
}

export default function ExportChildReferralStatementsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState({ projectId: '', followUpCycle: 1, followUpMonth: '' });
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState({ projects: true, configs: true, action: false });
  const { followUpCycle: selectedCycle, followUpMonth: selectedMonth } = config;

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
  }, [toast]);

  const handleUpdateAndExport = async () => {
    if (!selectedProject || !config.followUpCycle || !config.followUpMonth) {
      toast({
        title: "Incomplete Selection",
        description: "Please select a project, cycle, and month before exporting.",
        variant: "destructive",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    toast({ title: "Processing", description: "Preparing referral statements..." });

    try {
      const response = await fetch(`/api/child-cmam?projectId=${selectedProject}`);
      if (!response.ok) throw new Error("Failed to fetch CMAM data.");
      const rawBeneficiaries = await response.json();

      // Lowercase keys
      const normalizedBeneficiaries = normalizeKeys(rawBeneficiaries);
      
      // Transform and fix age logic
      const transformed = applyCycleTransformations(normalizedBeneficiaries, selectedCycle, selectedMonth);

      // Fetch logo as base64 for reliable HTML rendering
      const logoRes = await fetch("/sfd-logo.png");
      const logoBlob = await logoRes.blob();
      const logoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(logoBlob);
      });

      const workerConfigs = [
        {
          measType: "المواك",
          columns: [
  "benef_id",
  "child_id",
  "bnf_name",
  "child_name",
  "child_gender",
  `child_age_c${selectedCycle}`,
  `child_attend_c${selectedCycle}`,
  `date_attend_c${selectedCycle}`,
  "hc_card_no",
  `child_has_cmam_c${selectedCycle}`,
  "meas_type",
  `muac_c${selectedCycle}`,
  `child_cmam_cond_c${selectedCycle}`,
  `cmam_result_c${selectedCycle}`,
  `not_attend_reason_c${selectedCycle}`
],
          headers: [
            "كود المستفيدة", "كود الطفل", "اسم الأم", "اسم الطفل", "الجنس", 
            "العمر", "هل امتثل الطفل", "تاريخ الامتثال", "رقم الكرت الحصري", 
            "هل يعاني من سوء تغذية", "نوع القياس المستخدم", "قياس المواك", "حالة الطفل حاليا", 
            "نتيجة المتابعة", "سبب عدم الحضور"
          ],
          filter: (r: any) => {
            const nextCycleValue = r[`next_cycle_c${selectedCycle}`];
            return (
              r.child_has_cmam === "نعم" &&
              ["Qualified", "Last Month Qualification"].includes(nextCycleValue) &&
              r.meas_type === "المواك"
            );
          },
        },
        {
          measType: "الزد اسكور",
          columns: [
  "benef_id",
  "child_id",
  "bnf_name",
  "child_name",
  "child_gender",
  `child_age_c${selectedCycle}`,
  `child_attend_c${selectedCycle}`,
  `date_attend_c${selectedCycle}`,
  "hc_card_no",
  `child_has_cmam_c${selectedCycle}`,
  "meas_type",
  `zscore_h_c${selectedCycle}`,
  `zscore_w_c${selectedCycle}`,
  `zscore_c${selectedCycle}`,
  `child_cmam_cond_c${selectedCycle}`,
  `cmam_result_c${selectedCycle}`,
  `not_attend_reason_c${selectedCycle}`
],
          headers: [
            "كود المستفيدة", "كود الطفل", "اسم الأم", "اسم الطفل", "الجنس", 
            "العمر", "هل امتثل الطفل", "تاريخ الامتثال", "رقم الكرت الحصري", 
            "هل يعاني من سوء تغذية", "نوع القياس المستخدم", "الطول", "الوزن", 
            "قياس الزد اسكور", "حالة الطفل حاليا", "نتيجة المتابعة", "سبب عدم الحضور"
          ],
          filter: (r: any) => {
            const nextCycleValue = r[`next_cycle_c${selectedCycle}`];
            return (
              r.child_has_cmam === "نعم" &&
              ["Qualified", "Last Month Qualification"].includes(nextCycleValue) &&
              r.meas_type === "الزد اسكور"
            );
          },
        },
      ];

      const zip = new JSZip();

      // Group all valid records by Health Center (HC) to combine "المواك" and "الزد اسكور" into one PDF
      const hcGroups: Record<string, any[]> = {};
      for (const row of transformed) {
        const isMouak = workerConfigs[0].filter(row);
        const isZscore = workerConfigs[1].filter(row);
        if (isMouak || isZscore) {
          const hc = row.hc_id || "unknown-hc";
          if (!hcGroups[hc]) hcGroups[hc] = [];
          hcGroups[hc].push(row);
        }
      }

      for (const hc of Object.keys(hcGroups)) {
        const hcRows = hcGroups[hc];
        const firstRecord = hcRows[0];

        let htmlString = `
          <style>
            .pdf-wrapper {
              font-family: 'NotoNaskhArabic', sans-serif;
              direction: rtl;
              text-align: right;
              color: #000;
              width: 297mm;
              background: white;
            }
            .pdf-page {
              width: 297mm;
              height: 209mm;
              padding: 8mm;
              box-sizing: border-box;
              border: 4px solid black;
              position: relative;
              background: white;
              page-break-after: always;
              page-break-inside: avoid;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            table.data-table { width: 100%; border-collapse: collapse; margin-top: 5mm; text-align: center; table-layout: fixed; }
            table.data-table th { background-color: #f0f0f0; font-weight: bold; font-size: 11px; border: 1px solid black; padding: 6px 2px; }
            table.data-table td { border: 1px solid black; padding: 6px 2px; font-size: 11px; text-align: center; word-wrap: break-word; }
            
            table.header-table { width: 100%; border-collapse: collapse; margin-top: 5mm; font-size: 11px; text-align: center; }
            table.header-table th, table.header-table td { border: 1px solid black; padding: 6px; }
            table.header-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          </style>
          <div class="pdf-wrapper">
        `;

        // 1. Generate Cover Page
        htmlString += buildCoverPageHTML(hcRows, firstRecord, logoBase64, selectedCycle, selectedMonth);

        // Filter and sort for each measurement type
        const mouakRows = hcRows.filter(workerConfigs[0].filter).sort(sortFn);
        const zscoreRows = hcRows.filter(workerConfigs[1].filter).sort(sortFn);

        // 2. Generate Data Pages for 'المواك'
        if (mouakRows.length > 0) {
          const grouped = groupByHwEd(mouakRows);
          htmlString += buildDataPagesHTML(grouped, logoBase64, selectedCycle, selectedMonth, workerConfigs[0]);
        }

        // 3. Generate Data Pages for 'الزد اسكور' on new pages
        if (zscoreRows.length > 0) {
          if (mouakRows.length > 0) {
            htmlString += `<div class="html2pdf__page-break"></div>`;
          }
          const grouped = groupByHwEd(zscoreRows);
          htmlString += buildDataPagesHTML(grouped, logoBase64, selectedCycle, selectedMonth, workerConfigs[1]);
        }

        htmlString += `</div>`;

        // Generate PDF using html2pdf
        const pdfBlob = await html2pdf().set({
          margin: 0, // Set to 0 to respect the 8mm padding in .pdf-page CSS
          filename: 'report.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        }).from(htmlString).output('blob');

        const safeName = `${firstRecord.hc_id}-${firstRecord.hc_name}`.replace(/[\/\\?%*:|"<>]/g, "-");
        zip.file(`${safeName}.pdf`, pdfBlob);

        // Brief pause to not block the main thread completely
        await new Promise((r) => setTimeout(r, 50));
      }

      const zipData = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 5 },
      });

      saveAs(zipData, `Child_Referral_Statements_Cycle_${selectedCycle}.zip`);
      toast({ title: "Export Complete", description: "Statements are ready." });

    } catch (error: any) {
      toast({ title: "Process Failed", description: error.message, variant: "destructive" });
    } finally {
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

// Helper Functions
function normalizeKeys(records: BeneficiaryRecord[]): BeneficiaryRecord[] {
  return records.map(record => {
    const norm = { ...record };
    ['GOV_NAME', 'MUD_NAME', 'OZLA_NAME', 'ED_ID', 'ED_NAME'].forEach(key => {
      if (norm[key] !== undefined) {
        norm[key.toLowerCase()] = norm[key];
        delete norm[key];
      }
    });
    return norm;
  });
}

function chunkArray(arr: any[], size: number) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function computeAgeDiff(confDate: Date, followUpMonthNumber: number) {
  if (!confDate || isNaN(confDate.getTime())) return 0;

  // Step 1: same year, follow-up month, day = 1
  const followUpDate = new Date(
    confDate.getFullYear(),
    followUpMonthNumber - 1,
    1
  );

  // Step 2: difference in days
  const diffMs = followUpDate.getTime() - confDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Prevent negative values
  const rawMonths = Math.max(diffDays / 30, 0);

  // Step 3: apply 0.70 rule
  const integerPart = Math.floor(rawMonths);
  const decimalPart = rawMonths - integerPart;

  const roundedMonths =
    decimalPart >= 0.7 ? integerPart + 1 : integerPart;

  return roundedMonths;
}

function applyCycleTransformations(
  beneficiaries: BeneficiaryRecord[],
  cycle: number,
  followUpMonth: string
): BeneficiaryRecord[] {
  const followUpMonthNumber = MONTHS[followUpMonth] || 1;

  return beneficiaries.map((record) => {
    const updated = { ...record };
    const attendKey = `child_attend_c${cycle}`;
    const measKey = `meas_type_c${cycle}` as const;
    const hasCmamKey = `child_has_cmam_c${cycle}`;
    const formattedAttend = updated[attendKey] === "نعم" && updated[hasCmamKey] === "نعم";

    if (cycle === 1) {
      updated["child_isprev_ref_c1"] = formattedAttend ? "نعم" : updated["child_isprev_ref_c1"];

      if (formattedAttend && updated["child_has_cmam_hc"] === "نعم") {
        const confDateStr = updated.conf_date || updated.CONF_DATE;
        const confDate = confDateStr ? new Date(confDateStr) : new Date();
        
        // Revised ageIncrement logic (.70 threshold mapping)
        const ageIncrement = computeAgeDiff(confDate, followUpMonthNumber);

        const existing =
          Number(
            updated.new_child_age_mon ||
            0
          ) || 0;

        updated["child_age_c1"] = ageIncrement + existing;

        const muac = Number(updated["muac_hc"] || 0);
        const measType = updated["meas_type"] || "";
        const childAge = Number(updated["child_age_c1"] || 0);

        if (measType === "المواك" && muac >= 12.5) updated["next_cycle_c1"] = "Disqualified";
        else if (measType === "الزد اسكور") {
          const zscore = Number(updated["zscore_hc"] ?? 0);
          if ([-1, 0, 1, 2, 3].includes(zscore)) updated["next_cycle_c1"] = "Disqualified";
        }
        if (childAge >= 60) updated["next_cycle_c1"] = "Disqualified";
        if (childAge === 59) updated["next_cycle_c1"] = "Last Month Qualification";
        if (!updated["next_cycle_c1"]) updated["next_cycle_c1"] = "Qualified";
      }

      return updated;
    }

    if (cycle === 2) {
      const prevQualified = updated["next_cycle_c1"] === "Qualified";

      if (formattedAttend && prevQualified) {
        updated["child_isprev_ref_c2"] = "نعم";
        updated["child_age_c2"] = Number(updated["child_age_c1"] || 0) + 1;

        const cure = computeCureRate(updated, 1, 2);
        if (cure.cure) updated["cure_rate_c2"] = cure.cure;
        if (cure.negative !== null) updated["negative_c2"] = cure.negative;
        if (cure.positive !== null) updated["positive_c2"] = cure.positive;
      }

      const nextCycleValue = determineNextCycle(updated, 2, { prevNextCycle: updated["next_cycle_c1"], cureField: "c2" });
      updated["next_cycle_c2"] = nextCycleValue;

      if (!updated["next_cycle_c2"] && updated["child_isprev_ref_c2"] === "نعم" && prevQualified) updated["next_cycle_c2"] = "Qualified";
      return updated;
    }

    if (cycle === 3) {
      const prevQualified = updated["next_cycle_c2"] === "Qualified";

      if (formattedAttend && prevQualified) {
        updated["child_isprev_ref_c3"] = "نعم";
        updated["child_age_c3"] = Number(updated["child_age_c2"] || 0) + 1;

        const cure = computeCureRate(updated, 2, 3);
        if (cure.cure) updated["cure_rate_c3"] = cure.cure;
        if (cure.negative !== null) updated["negative_c3"] = cure.negative;
        if (cure.positive !== null) updated["positive_c3"] = cure.positive;
      }

      const nextCycleValue = determineNextCycle(updated, 3, { prevNextCycle: updated["next_cycle_c2"], cureField: "c3" });
      updated["next_cycle_c3"] = nextCycleValue;

      if (!updated["next_cycle_c3"] && updated["child_isprev_ref_c3"] === "نعم" && prevQualified) updated["next_cycle_c3"] = "Qualified";
      return updated;
    }

    return updated;
  });
}

function computeCureRate(record: BeneficiaryRecord, prevCycle: number, currentCycle: number) {
  const measType = record[`meas_type_c${currentCycle}`] || record.meas_type;

  const prevMuac = Number(record[`muac_c${prevCycle}`] || 0);
  const currentMuac = Number(record[`muac_c${currentCycle}`] || 0);
  const prevZ = Number(record[`zscore_c${prevCycle}`] || 0);
  const currentZ = Number(record[`zscore_c${currentCycle}`] || 0);

  if (measType === "المواك") {
    if (currentMuac < prevMuac) return { cure: "Negative", negative: Number((prevMuac - currentMuac).toFixed(1)), positive: null };
    if (currentMuac === prevMuac) return { cure: "No Improvement", negative: null, positive: null };
    return { cure: "Positive", negative: null, positive: Number((currentMuac - prevMuac).toFixed(1)) };
  }

  if (measType === "الزد اسكور") {
    if (prevZ === -3 && currentZ === -2) return { cure: "Negative", negative: -1, positive: null };
    if ((prevZ === -2 && currentZ === -2) || (prevZ === -3 && currentZ === -3)) return { cure: "No Improvement", negative: null, positive: null };

    const positiveScore = determineZscorePositive(prevZ, currentZ);
    if (positiveScore !== null) return { cure: "Positive", negative: null, positive: positiveScore };
  }

  return { cure: "", negative: null, positive: null };
}

function determineZscorePositive(prev: number, current: number): number | null {
  const map: Record<string, number> = {
    "-1:-2": 1, "-1:-3": 2, "-2:-3": 1, "0:-3": 3, "2:-3": 5,
    "3:-3": 6, "0:-2": 2, "2:-2": 4, "3:-2": 5,
  };
  return map[`${prev}:${current}`] ?? null;
}

function determineNextCycle(
  record: BeneficiaryRecord,
  cycle: number,
  options: { prevNextCycle?: string; cureField: string }
) {
  const prevNext = options.prevNextCycle;
  const meas = record[`meas_type_c${cycle}`] || record.meas_type;
  const age = Number(record[`child_age_c${cycle}`] || 0);
  const muac = Number(record[`muac_c${cycle - 1}`] || 0);
  const zscore = Number(record[`zscore_c${cycle - 1}`] || 0);
  const cmamResult = record[`cmam_result_c${cycle - 1}`];
  const cureField = record[`cure_rate_c${cycle}`];

  if (muac >= 12.5) return "Disqualified";
  if (meas === "الزد اسكور" && [-1, 0, 1, 2, 3].includes(zscore)) return "Disqualified";
  if (age >= 60) return "Disqualified";
  if (["شفاء", "الوفاة", "انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"].includes(cmamResult)) return "Disqualified";

  if (prevNext === "Last Month Qualification") return "Disqualified";
  if (prevNext === "Disqualified") return "Disqualified";

  if (
    cureField &&
    (cureField === "Negative" || cureField === "No Improvement") &&
    (record[`cure_rate_c${cycle - 1}`] === "Negative" || record[`cure_rate_c${cycle - 1}`] === "No Improvement")
  )
    return "Disqualified";

  if (age === 59) return "Last Month Qualification";
  return null;
}

// Sorting and Grouping Helpers
function sortFn(a: any, b: any) {
  const edCompare = String(a.ed_id || "").localeCompare(String(b.ed_id || ""), "ar");
  if (edCompare !== 0) return edCompare;
  return String(a.hw_name || "").localeCompare(String(b.hw_name || ""), "ar");
}

function groupByHwEd(rows: any[]) {
  const grouped: Record<string, Record<string, any[]>> = {};
  for (const row of rows) {
    const hw = row.hw_name || "unknown-hw";
    const ed = row.ed_id || "unknown-ed";
    if (!grouped[hw]) grouped[hw] = {};
    if (!grouped[hw][ed]) grouped[hw][ed] = [];
    grouped[hw][ed].push(row);
  }
  return grouped;
}

// --- HTML Generators ---
function buildCoverPageHTML(hcRows: any[], firstRecord: any, logoBase64: string, cycle: number, month: string) {
  const hWId = firstRecord.hw_id || "";
  const hWName = firstRecord.hw_name || "";
  const hCName = firstRecord.hc_name || "";

  return `
    <div class="pdf-page">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="text-align: right; font-weight: bold; font-size: 15px;">
          الجمهورية اليمنية<br/>الصندوق الاجتماعي للتنمية<br/>فرع صنعاء
        </div>
        <div style="text-align: left; display: flex; flex-direction: column; align-items: center;">
          <img src="${logoBase64}" style="width: 90px; margin-bottom: 5px;" />
          <div style="font-size: 11px; font-weight: bold;">الصندوق الاجتماعي للتنمية</div>
          <div style="font-size: 9px;">Social Fund for Development</div>
        </div>
      </div>

      <div style="text-align: center; border: 1px solid black; padding: 10px; margin: 20px 80px; font-size: 24px; font-weight: bold; background: #f9f9f9;">
        برنامج التحويلات النقدية المشروطة في التغذية
      </div>
      
      <div style="text-align: center; border: 1px solid black; padding: 10px; margin: 0 100px 30px; font-size: 20px; font-weight: bold; background: #f9f9f9;">
        كشف امتثال الأطفال  الصحي
      </div>

      <div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 40px;">
        المرفق الصحي: ${hCName}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 20px; margin-top: auto;">
        <div style="flex: 1; border: 1px solid black; padding: 15px; background: #f5f5f5;">
          <h3 style="margin-top: 0; text-align: right; border-bottom: 1px solid #ccc; padding-bottom: 5px;">التعليمات</h3>
          <ul style="font-size: 14px; line-height: 1.8; text-align: right; padding-right: 20px;">
            <li>في عمود هل حظر الطفل  الصحي يرجى اختيار: نعم / لا</li>
            <li>في حال كانت الإجابة لا يرجى كتابة السبب في عمود سبب عدم الحظور</li>
            <li>في عمود هل يعاني الطفل من سوء تغذية يرجى اختيار: نعم / لا</li>
            <li>في حال كانت الإجابة لا يرجى كتابة قياس المواك أو الزد اسكور</li>
            <li>في عمود حالة الطفل يرجى اختيار: سوء تغذية متوسط / سوء تغذية حاد</li>
            <li>في حال كان القياس المستخدم هو الزد اسكور يرجى تعبئة الطول والوزن...</li>
            <li>وفي عمود حالة المتابعة يرجى اختيار أحد الخيارات: مستمر بالمعالجة، شفاء، تخلف، الوفاة، عدم استجابة...</li>
          </ul>
        </div>
        <div style="width: 250px; display: flex; flex-direction: column; gap: 15px;">
          <table class="header-table" style="margin-top: 0;">
            <tr><th>عدد الأطفال</th></tr>
            <tr><td style="font-weight: bold;">${hcRows.length || 0}</td></tr>
          </table>
          <table class="header-table" style="margin-top: 0;">
            <tr><th>عدد الحالات</th></tr>
            <tr><td style="font-weight: bold;">.......</td></tr>
          </table>
          <div style="margin-top: auto; font-size: 15px; font-weight: bold; text-align: right; line-height: 1.6;">
            كود العامل الصحي: ${hWId}<br/>
            اسم العامل الصحي: ${hWName}<br/>
            دورة المتابعة: ${cycle} - ${month}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildDataPagesHTML(hwGroups: any, logoBase64: string, cycle: number, month: string, config: any) {
  let html = "";
  const hwKeys = Object.keys(hwGroups);

  hwKeys.forEach((hw, hwIndex) => {
    const edGroups = hwGroups[hw];
    const edKeys = Object.keys(edGroups);

    edKeys.forEach((ed, edIndex) => {
      const bnfs = edGroups[ed];
      const chunks = chunkArray(bnfs, ROWS_PER_PAGE);
      
      const g = {
        educatorName: bnfs[0].ed_name || "",
        educatorCode: bnfs[0].ed_id || "",
        hwname: bnfs[0].hw_name || "",
        hwid: bnfs[0].hw_id || "",
        hcname: bnfs[0].hc_name || "",
        hcid: bnfs[0].hc_id || "",
        location: [bnfs[0].gov_name, bnfs[0].mud_name, bnfs[0].ozla_name].filter(Boolean).join(" - ")
      };

      chunks.forEach((chunk, pageIndex) => {
        const isLastPage = pageIndex === chunks.length - 1;

        html += `
          <div class="pdf-page">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
              <div style="text-align: right; font-weight: bold; font-size: 12px; width: 150px;">
                الجمهورية اليمنية<br/>الصندوق الاجتماعي للتنمية<br/>فرع صنعاء<br/>
                <span style="font-weight: normal;">صفحة ${pageIndex + 1} من ${chunks.length}</span>
              </div>
              <div style="text-align: center; flex: 1;">
                 <div style="font-size: 18px; font-weight: bold;">برنامج التحويلات النقدية المشروطة في التغذية</div>
                 <div style="font-size: 15px;">كشف امتثال الأطفال  الصحي</div>
                 <div style="font-size: 14px; font-weight: bold; margin-top: 5px;">(${config.measType})</div>
              </div>
              <div style="text-align: left; width: 150px; display: flex; justify-content: flex-end;">
                <img src="${logoBase64}" style="width: 70px; margin-bottom: 3px;" />
              </div>
            </div>

            <table class="header-table">
              <tr>
                <th>الموقع</th>
                <th>كود المرفق</th>
                <th>اسم المرفق الصحي</th>
                <th>كود العامل الصحي</th>
                <th>اسم العامل الصحي</th>
                <th>كود المثقفة</th>
                <th>اسم المثقفة</th>
                <th>دورة المتابعة / الشهر</th>
              </tr>
              <tr>
                <td>${g.location}</td>
                <td>${g.hcid}</td>
                <td>${g.hcname}</td>
                <td>${g.hwid}</td>
                <td>${g.hwname}</td>
                <td>${g.educatorCode}</td>
                <td>${g.educatorName}</td>
                <td>${cycle} - ${month}</td>
              </tr>
            </table>

            <table class="data-table">
              <tr>
                <th style="width: 30px;">م</th>
                ${config.headers.map((h: string) => `<th>${h}</th>`).join("")}
              </tr>
              ${chunk.map((r: any, idx: number) => `
                <tr>
                  <td>${pageIndex * ROWS_PER_PAGE + idx + 1}</td>
                  ${config.columns.map((c: string) => `<td>${r[c] ?? ""}</td>`).join("")}
                </tr>
              `).join("")}
            </table>
        `;

        if (isLastPage) {
          const discovered = bnfs.filter((b: any) => b.child_cmam_cond && b.child_cmam_cond !== "").length;
          html += `
            <table class="header-table" style="width: 50%; margin: 15px auto 0;">
              <tr>
                <th>اجمالي الأطفال</th>
                <td>${bnfs.length}</td>
                <th>عدد الحالات الممتثلة</th>
                <td>.......</td>
              </tr>
            </table>
          `;
        }

        html += `
            <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px;">
              <div style="font-size: 14px; font-weight: bold;">
                اسم العامل الصحي: ${g.hwname}
              </div>
              <div style="font-size: 14px; text-align: center;">
                التوقيع ................................
              </div>
              <div style="text-align: center;">
                 <div style="border: 1px solid black; width: 120px; height: 60px; line-height: 60px; font-weight: bold; vertical-align: top;">ختم المركز</div>
              </div>
            </div>
          </div>
        `;

        const isLastGroup = hwIndex === hwKeys.length - 1 && edIndex === edKeys.length - 1;
        if (!isLastPage || !isLastGroup) {
          html += `<div class="html2pdf__page-break"></div>`;
        }
      });
    });
  });

  return html;
}