// src/app/meal-system/monitoring/implementation/enrollment/create-sheets/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, FileText, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface Project {
    projectId: string;
    projectName: string;
}

function createEnrollmentWorkerScript() {
    return `
        importScripts("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");

        const { jsPDF } = self.jspdf;

        // --- TYPES ---
        const EnrollmentData = {};

        // --- CONSTANTS ---
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN_X = 10;
        const MARGIN_Y = 10;
        const CONTENT_W = PAGE_W - (MARGIN_X * 2);
        const COLOR_BLUE_HEADER = "#4a6fa5";
        const COLOR_TEXT = "#000000";

        // --- HELPERS ---
        function drawText(doc, text, x, y, size, align = "right", isBold = false) {
            doc.setFont("Amiri", isBold ? "bold" : "normal");
            doc.setFontSize(size);
            doc.setTextColor(0, 0, 0);
            doc.text(String(text || ""), x, y, { align, baseline: "middle" });
        }
        
        function drawDottedLine(doc, x, y, w) {
            doc.setLineWidth(0.5);
            doc.setDrawColor(0);
            doc.setLineDash([1, 1], 0);
            doc.line(x, y, x + w, y);
            doc.setLineDash([], 0);
        }

        function drawBox(doc, x, y, w, h, fillColor) {
            doc.setLineWidth(0.5);
            doc.setDrawColor(0);
            if (fillColor) {
                doc.setFillColor(fillColor);
                doc.rect(x, y, w, h, "FD");
            } else {
                doc.rect(x, y, w, h);
            }
        }
        
        function drawCircle(doc, x, y, r, fill = false) {
            doc.setLineWidth(0.5);
            doc.setDrawColor(0);
            if (fill) {
                doc.setFillColor(0);
                doc.circle(x, y, r, "FD");
            } else {
                doc.circle(x, y, r);
            }
        }
        
        function drawSFDLogo(doc, x, y) {
          const boxSize = 25;
          const gap = 2;
          doc.setFillColor(44, 62, 80);
          doc.rect(x, y, boxSize, boxSize, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18);
          doc.setFont("Arial", "bold");
          doc.text("S", x + boxSize/2, y + boxSize/2, { align: "center", baseline: "middle" });

          doc.setFillColor(44, 62, 80);
          doc.rect(x + boxSize + gap, y, boxSize, boxSize, "F");
          doc.text("F", x + boxSize + gap + boxSize/2, y + boxSize/2, { align: "center", baseline: "middle" });

          doc.setFillColor(44, 62, 80);
          doc.rect(x + 2*(boxSize + gap), y, boxSize, boxSize, "F");
          doc.text("D", x + 2*(boxSize + gap) + boxSize/2, y + boxSize/2, { align: "center", baseline: "middle" });

          doc.setTextColor(0);
          doc.setFont("Amiri", "bold");
          doc.setFontSize(18);
          doc.text("الصندوق", x + 3*(boxSize + gap) + 5, y + 5);
          doc.text("الاجتماعي", x + 3*(boxSize + gap) + 5, y + 15);
          doc.text("للتنمية", x + 3*(boxSize + gap) + 5, y + 25);
        }

        function drawEnrollmentForm(doc, data) {
            let y = MARGIN_Y;

            // 1. HEADER SECTION
            drawSFDLogo(doc, MARGIN_X, y);

            // Title Box - Exact position and styling
            doc.setFillColor(184, 201, 224); // #b8c9e0
            doc.roundedRect(PAGE_W / 2 - 70, y, 140, 30, 8, 8, "F");
            doc.setLineWidth(1);
            doc.setDrawColor(119, 138, 163); // Border color
            doc.roundedRect(PAGE_W / 2 - 70, y, 140, 30, 8, 8);
            drawText(doc, "استمارة التحاق بمشروع التحويلات النقدية المشروطة في التغذية", PAGE_W / 2, y + 10, 14, "center", true);
            drawText(doc, \`المحافظة: \${data.governorate} المديرية: \${data.district}\`, PAGE_W / 2, y + 25, 12, "center");

            // State Info - Right side
            drawText(doc, "الجمهورية اليمنية", PAGE_W - MARGIN_X, y + 5, 12, "right", true);
            drawText(doc, "رئاسة مجلس الوزراء", PAGE_W - MARGIN_X, y + 15, 12, "right", true);
            drawText(doc, "الصندوق الاجتماعي للتنمية", PAGE_W - MARGIN_X, y + 25, 12, "right", true);

            y += 40;

            drawText(doc, \`رقم المستهدفة: \${data.beneficiaryId}\`, PAGE_W - MARGIN_X, y, 12, "right", true);
            y += 10;

            doc.setFillColor(COLOR_BLUE_HEADER);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 8, 5, 5, "F");
            doc.setTextColor(255, 255, 255);
            drawText(doc, "أولاً: بيانات المرأة المستهدفة حسب قاعدة البيانات:", PAGE_W - MARGIN_X - 2, y + 4, 11, "right", true);
            doc.setTextColor(0);
            y += 12;

            drawText(doc, "الاسم خماسياً:", PAGE_W - MARGIN_X, y, 11, "right");
            drawDottedLine(doc, PAGE_W - MARGIN_X - 80, y, 70);
            drawText(doc, data.fullName, PAGE_W - MARGIN_X - 5, y, 11, "right", true);
            drawText(doc, "رقم التلفون:", PAGE_W - 100, y, 11, "right");
            drawDottedLine(doc, PAGE_W - 160, y, 50);
            drawText(doc, data.phone, PAGE_W - 105, y, 11, "right", true);
            y += 8;

            drawText(doc, \`العزلة: \${data.uzla}\`, PAGE_W - MARGIN_X, y, 11, "right");
            drawText(doc, \`القرية/المحلة: \${data.village}/\`, PAGE_W - 80, y, 11, "right");
            drawText(doc, \`نوع الهوية: \${data.idType}\`, PAGE_W - 140, y, 11, "right");
            drawDottedLine(doc, PAGE_W - 180, y, 30);
            drawText(doc, \`رقمها: \${data.idNumber}\`, PAGE_W - 145, y, 11, "right");
            y += 8;

            drawText(doc, "اسم زوج المستهدفة:", PAGE_W - MARGIN_X, y, 11, "right");
            drawDottedLine(doc, PAGE_W - MARGIN_X - 50, y, 40);
            drawText(doc, data.husbandName, PAGE_W - MARGIN_X - 5, y, 11, "right", true);
            drawDottedLine(doc, PAGE_W - 120, y, 30);
            drawText(doc, \`الحالة الاجتماعية: \${data.maritalStatus}\`, PAGE_W - 80, y, 11, "right");
            y += 8;

            drawText(doc, \`حالة تأهل المرأة المستهدفة: \${data.qualificationCriteria}\`, PAGE_W - MARGIN_X, y, 11, "right");
            drawText(doc, \`شهر الحمل [\${data.pregnancyMonth}]\`, PAGE_W - 120, y, 11, "right");
            drawText(doc, \`عدد الاطفال ذكور: \${data.childCountMale}\`, PAGE_W - 180, y, 11, "right");
            drawText(doc, \`إناث: \${data.childCountFemale}\`, PAGE_W - 210, y, 11, "right");
            y += 8;

            drawText(doc, "أسماء أطفال المستهدفة الأقل من 5 سنوات وذوي الاعاقة من 5-17 سنة:", PAGE_W - MARGIN_X, y, 11, "right");
            y += 5;
            drawDottedLine(doc, MARGIN_X, y, CONTENT_W);
            drawText(doc, data.childNames, PAGE_W - MARGIN_X - 2, y, 10, "right");
            y += 10;

            drawText(doc, "المستوى التعليمي للمرأة المستهدفة", PAGE_W - MARGIN_X, y, 11, "right", true);
            const eduOptions = ["أساسي", "تقرأ وتكتب", "ثانوي", "جامعي", "لا تقرأ ولا تكتب"];
            let eduX = PAGE_W - 80;
            for (let i = 0; i < eduOptions.length; i++) {
                drawCircle(doc, eduX, y + 1, 5);
                doc.setFontSize(10);
                doc.text((i+1).toString(), eduX, y + 1, { align: "center", baseline: "middle" });
                drawText(doc, eduOptions[i], eduX - 8, y, 10, "right");
                eduX -= 40;
            }
            if (data.educationLevel >= 1 && data.educationLevel <= 5) {
                let fillX = PAGE_W - 80 - (data.educationLevel - 1) * 40;
                drawCircle(doc, fillX, y + 1, 4, true);
            }
            y += 10;

            doc.setFillColor(COLOR_BLUE_HEADER);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 8, 5, 5, "F");
            doc.setTextColor(255, 255, 255);
            drawText(doc, "ثانياً: المنافع التي ستحصل عليها المرأة المستهدفة من المشروع", PAGE_W - MARGIN_X - 2, y + 4, 11, "right", true);
            doc.setTextColor(0);
            y += 12;

            const benefitText = "تحصل كل امرأة مستهدفة استوفت المعايير (حامل أو أم لطفل أقل من خمس سنوات أو أم لطفل ذو إعاقة من 5-17 سنة) والتزمت بالشروط، على مساعدة نقدية بواقع عشرون ألف ريال يمنياً ولمدة ستة أشهر.";
            const splitBenefit = doc.splitTextToSize(benefitText, CONTENT_W);
            doc.text(splitBenefit, PAGE_W - MARGIN_X, y, { align: "right" });
            y += 25;
            
            doc.setFillColor(COLOR_BLUE_HEADER);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 8, 5, 5, "F");
            doc.setTextColor(255, 255, 255);
            drawText(doc, "ثالثاً: حرمان المرأة المستهدفة من المنافع", PAGE_W - MARGIN_X - 2, y + 4, 11, "right", true);
            doc.setTextColor(0);
            y += 12;

            const rules = ["1. إذا انتقلت خارج منطقة المشروع", "2. إذا ثبت أنها أدلت ببيانات مضللة أو قدمت وثائق مزورة", "3. إذا ثبت انتحالها لشخصية امرأة أخرى", "4. في حال الوفاة (لا سمح الله)"];
            let ruleY = y;
            drawText(doc, rules[0], PAGE_W - MARGIN_X, ruleY, 10, "right");
            drawText(doc, rules[1], PAGE_W / 2 - 10, ruleY, 10, "right");
            ruleY += 8;
            drawText(doc, rules[2], PAGE_W - MARGIN_X, ruleY, 10, "right");
            drawText(doc, rules[3], PAGE_W / 2 - 10, ruleY, 10, "right");
            y += 25;
            
            doc.setFillColor(COLOR_BLUE_HEADER);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 8, 5, 5, "F");
            doc.setTextColor(255, 255, 255);
            drawText(doc, "رابعاً: توقيع أو بصمة المرأة المؤهلة بالعلم والموافقة وصحة البيانات", PAGE_W - MARGIN_X - 2, y + 4, 11, "right", true);
            doc.setTextColor(0);
            y += 12;

            const disclaimer = "أقر أنا الموقعة أدناه بأن البيانات الواردة في الاستمارة صحيحة وأني موافقة على شروط المشروع والالتحاق به وأن رقم التلفون المدون هو ملكية خاصة لي أو لأحد أفراد الأسرة المقربين، وأنه يمكن أن أتلقى أي رسالة أو تعليمات أو رمز يخص صرف المساعدات عليه.";
            const splitDisc = doc.splitTextToSize(disclaimer, CONTENT_W);
            doc.text(splitDisc, PAGE_W - MARGIN_X, y, { align: "right" });
            y += 20;

            drawText(doc, "اليوم: ....................................... التاريخ: / / 202", PAGE_W - MARGIN_X, y, 10, "right");
            y += 5;
            drawText(doc, "اسم وتوقيع المثقفة المجتمعية المسئولة عن تعبئة البيانات", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, \`اسم المثقفة: \${data.educatorName}\`, PAGE_W - MARGIN_X, y + 8, 11, "right");
            drawText(doc, "التوقيع: ..........................................", PAGE_W / 2, y + 8, 10, "center");
            drawBox(doc, PAGE_W - 70, y - 5, 50, 20);
            y += 25;
            
            doc.setFillColor(COLOR_BLUE_HEADER);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 8, 5, 5, "F");
            doc.setTextColor(255, 255, 255);
            drawText(doc, "خامساً: في حال عدم أخذ البصمة أو التوقيع (يذكر السبب)", PAGE_W - MARGIN_X - 2, y + 4, 11, "right", true);
            doc.setTextColor(0);
            y += 12;

            const reasons = ["1. انتقال دائم لمحل السكن خارج المديرية", "2. سفر مؤقت", "3. الوفاة (لا سمح الله)", "4. عدم القبول بمنافع المشروع", "5. عدم العثور على المرأة", "6. أخرى (تذكر): ..............................."];
            let rX = PAGE_W - MARGIN_X;
            reasons.forEach(reason => {
                drawText(doc, reason, rX, y, 9, "right");
                rX -= 50;
                if (rX < MARGIN_X + 50) { y += 8; rX = PAGE_W - MARGIN_X; }
            });
            y += 8;
            
            doc.setFillColor(COLOR_BLUE_HEADER);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 8, 5, 5, "F");
            doc.setTextColor(255, 255, 255);
            drawText(doc, "سادساً: تصحيح البيانات:", PAGE_W - MARGIN_X - 2, y + 4, 11, "right", true);
            doc.setTextColor(0);
            y += 12;

            drawText(doc, "يجب تصحيح اسم المرأة المستهدفة أو زوجها في حال كان هناك خطأ في الاسم الأول أو الاب أو الجد أو اللقب (صحح الجزء الذي فيه خطأ فقط وتترك الأسماء الصحيحة فارغة)", PAGE_W - MARGIN_X, y, 9, "right", true);
            y += 10;
            
            drawText(doc, "تصحيح الاسم الأول: ...........................", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, "اسم الأب: ...........................", PAGE_W - 120, y, 10, "right");
            y += 8;
            drawText(doc, "اسم الجد: ...........................", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, "الاسم الرابع: ...........................", PAGE_W - 120, y, 10, "right");
            drawText(doc, "اللقب: ...........................", PAGE_W - 200, y, 10, "right");
            y += 8;
            drawText(doc, "مرجعية التصحيح التي تم بموجبها التصحيح: ...............................", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, "رقم التلفون: ...............................", PAGE_W - 150, y, 10, "right");
            y += 8;
            drawText(doc, "تصحيح اسم زوج المستهدفة الاسم الأول: ...........................", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, "اسم الأب: ...........................", PAGE_W - 120, y, 10, "right");
            y += 8;
            drawText(doc, "اسم الجد: ...........................", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, "الاسم الرابع: ...........................", PAGE_W - 120, y, 10, "right");
            drawText(doc, "اللقب: ...........................", PAGE_W - 200, y, 10, "right");
            y += 8;
            drawText(doc, "مرجعية التصحيح التي تم بموجبها التصحيح: ...............................", PAGE_W - MARGIN_X, y, 10, "right");
            drawText(doc, "توقيع المثقفة على التصحيح: ...............................", PAGE_W - 150, y, 10, "right");
            
            doc.setFontSize(10);
            doc.setLineWidth(1);
            doc.line(MARGIN_X, PAGE_H - 15, PAGE_W - MARGIN_X, PAGE_H - 15);
            doc.text("1 يتم تدوين شهر الحمل لكل مستفيدة حالة تأهلها أثناء الالتحاق حامل", PAGE_W - MARGIN_X, PAGE_H - 10, { align: "right" });
            doc.text("يحق للصندوق الاجتماعي للتنمية مشاركة البيانات مع الجهات ذات العلاقة لأغراض التحقق والتأكد من استلام المساعدات", PAGE_W / 2, PAGE_H - 5, { align: "center" });
        }


        self.onmessage = async (event) => {
            const { beneficiaries, fontBase64, sample } = event.data;

            if (!beneficiaries || !fontBase64) {
                postMessage({ type: 'error', error: 'Missing beneficiaries data or font.' });
                return;
            }

            try {
                const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
                doc.addFileToVFS("Amiri-Regular.ttf", fontBase64);
                doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
                doc.addFont("Amiri-Regular.ttf", "Amiri", "bold");

                if (sample) {
                    const bnf = beneficiaries[0]; // Just use the first one for the sample
                    const data = {
                        beneficiaryId: String(bnf.l_id || ''), phone: String(bnf.l_phone_no || ''), idNumber: String(bnf.l_id_card_no || ''),
                        idType: String(bnf.id_card_type || ''), governorate: String(bnf.gov_name || ''), district: String(bnf.mud_name || ''),
                        uzla: String(bnf.hh_ozla_name || ''), village: String(bnf.hh_vill_name || ''), fullName: String(bnf.l_benef_name || ''),
                        husbandName: String(bnf.l_hsbnd_name || ''), maritalStatus: String(bnf.bnf_social_status || ''),
                        qualificationCriteria: String(bnf.bnf_qual_status_desc || ''),
                        childCountMale: Number(bnf.child_m_cnt) || 0, childCountFemale: Number(bnf.child_f_cnt) || 0,
                        childNames: String(bnf.l_child_list || ''), educatorName: bnf.ED_NAME || 'Unassigned',
                        educationLevel: Number(bnf.educational_level_of_the_targeted_woman) || 0,
                        pregnancyMonth: String(bnf.pregnancy_month || '')
                    };
                    drawEnrollmentForm(doc, data);
                    const pdfBuffer = doc.output("arraybuffer");
                    self.postMessage({ type: 'done-sample', data: pdfBuffer }, [pdfBuffer]);
                    return;
                }
                
                const grouped = {};
                beneficiaries.forEach(row => {
                    const edu = row.ED_NAME || "Unassigned_Educator";
                    if (!grouped[edu]) grouped[edu] = [];
                    grouped[edu].push(row);
                });

                const zip = new self.JSZip();
                const totalEducators = Object.keys(grouped).length;
                let educatorsProcessed = 0;

                for (const [educator, bnfs] of Object.entries(grouped)) {
                    const educatorDoc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
                    educatorDoc.addFileToVFS("Amiri-Regular.ttf", fontBase64);
                    educatorDoc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
                    educatorDoc.addFont("Amiri-Regular.ttf", "Amiri", "bold");

                    bnfs.forEach((bnf, index) => {
                        if (index > 0) educatorDoc.addPage();
                        const data = {
                            beneficiaryId: String(bnf.l_id || ''), phone: String(bnf.l_phone_no || ''), idNumber: String(bnf.l_id_card_no || ''),
                            idType: String(bnf.id_card_type || ''), governorate: String(bnf.gov_name || ''), district: String(bnf.mud_name || ''),
                            uzla: String(bnf.hh_ozla_name || ''), village: String(bnf.hh_vill_name || ''), fullName: String(bnf.l_benef_name || ''),
                            husbandName: String(bnf.l_hsbnd_name || ''), maritalStatus: String(bnf.bnf_social_status || ''),
                            qualificationCriteria: String(bnf.bnf_qual_status_desc || ''),
                            childCountMale: Number(bnf.child_m_cnt) || 0, childCountFemale: Number(bnf.child_f_cnt) || 0,
                            childNames: String(bnf.l_child_list || ''), educatorName: educator,
                            educationLevel: Number(bnf.educational_level_of_the_targeted_woman) || 0,
                            pregnancyMonth: String(bnf.pregnancy_month || '')
                        };
                        drawEnrollmentForm(educatorDoc, data);
                    });

                    const safeName = educator.replace(/[^a-zA-Z0-9\\u0600-\\u06FF \\-_]/g, "_").trim();
                    zip.file(\`\${safeName}_Enrollment_Forms.pdf\`, educatorDoc.output("arraybuffer"));
                    
                    educatorsProcessed++;
                    postMessage({
                        type: 'progress',
                        status: \`Generating PDF for \${safeName}...\`,
                        progress: Math.round((educatorsProcessed / totalEducators) * 100),
                        current: educatorsProcessed,
                        total: totalEducators
                    });
                }
                
                postMessage({ type: 'progress', status: 'Zipping files...', progress: 99 });
                const zipContent = await zip.generateAsync({ type: "arraybuffer" });

                self.postMessage({ type: 'done-all', data: zipContent }, [zipContent]);

            } catch (error) {
                postMessage({ type: 'error', error: error.message });
            }
        };
    `;
}

export default function CreateEnrollmentSheetsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState(0);
  const [sheetsGenerated, setSheetsGenerated] = useState(0);
  const [totalSheets, setTotalSheets] = useState(0);

  useEffect(() => {
    async function fetchProjects() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error("Failed to fetch projects");
            setProjects(await res.json());
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    }
    fetchProjects();
  }, [toast]);
  
  const handleGenerate = async (isSample: boolean) => {
    if (!selectedProjectId) {
      toast({ title: "No Project Selected", description: "Please select a project.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStatus("Initializing...");
    setProgress(0);
    setSheetsGenerated(0);
    setTotalSheets(0);

    try {
        const res = await fetch('/api/bnf-assessed');
        if (!res.ok) throw new Error("Failed to fetch beneficiary data.");
        let allBeneficiaries = await res.json();
        
        const projectBeneficiaries = allBeneficiaries.filter((bnf: any) => bnf.project_id === selectedProjectId);

        if (projectBeneficiaries.length === 0) {
          toast({ title: "No Data", description: "No beneficiaries found for the selected project.", variant: 'default' });
          setLoading(false);
          return;
        }

        const worker = new Worker(URL.createObjectURL(new Blob([createEnrollmentWorkerScript()], { type: 'application/javascript' })));
        
        worker.onmessage = (event) => {
            const { type, status: workerStatus, progress: workerProgress, current, total, data, error } = event.data;

            if (type === 'progress') {
                setStatus(workerStatus);
                setProgress(workerProgress);
                if (current && total) {
                    setSheetsGenerated(current);
                    setTotalSheets(total);
                }
            } else if (type === 'done-sample' || type === 'done-all') {
                const blob = new Blob([data], { type: isSample ? "application/pdf" : "application/zip" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = isSample 
                    ? \`Enrollment_Sample_\${selectedProjectId}.pdf\` 
                    : \`Enrollment_Forms_\${selectedProjectId}.zip\`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast({ title: "Success", description: "File downloaded." });
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

        const fontRes = await fetch('/fonts/Amiri-Regular.ttf');
        const fontBuffer = await fontRes.arrayBuffer();
        const fontBase64 = btoa(new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        setStatus("Starting generation...");
        setProgress(10);
        
        let beneficiariesToSend = projectBeneficiaries;
        if (isSample) {
            beneficiariesToSend = [projectBeneficiaries[Math.floor(Math.random() * projectBeneficiaries.length)]];
        }

        worker.postMessage({ beneficiaries: beneficiariesToSend, fontBase64, sample: isSample });

    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-xl">Export Enrollment Forms</CardTitle>
          <CardDescription className="text-center">
            Generate PDF enrollment forms for all beneficiaries in a project, grouped by educator.
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

            <div className="flex gap-2">
                <Button
                    size="lg"
                    onClick={() => handleGenerate(false)}
                    disabled={loading || !selectedProjectId}
                    className="w-full"
                >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {loading ? "Generating..." : "Download All Forms (ZIP)"}
                </Button>
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => handleGenerate(true)}
                    disabled={loading || !selectedProjectId}
                >
                    <File className="mr-2 h-4 w-4" />
                    Download Sample
                </Button>
            </div>

            {loading && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{status}</span>
                        <span>{sheetsGenerated} / {totalSheets} sheets</span>
                    </div>
                    <Progress value={progress} />
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
