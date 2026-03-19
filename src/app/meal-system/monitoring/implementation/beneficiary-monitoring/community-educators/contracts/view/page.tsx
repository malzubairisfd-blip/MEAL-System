// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/view/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import jsPDF from 'jspdf';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Eye, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  projectId: string;
  projectName: string;
}

interface Educator {
  applicant_id: number;
  ed_id: string;
  applicant_name: string;
  contract_type: string;
  contract_starting_date: string;
  contract_end_date: string;
  contract_duration_months: number;
  project_id: string;
  id_card_type: string;
  id_card_no: string;
  id_issue_loc: string;
  id_issue_date: string;
  working_village: string;
  mud_name: string;
}

const funderOptions = [
    "منحةالبنك الدولي الاضافية لتعزيز الحماية الاجتماعية والاستجابة لجائحة كورونا عبر برنامج الأمم المتحدة الانمائي",
    "منحة الحكومة البريطانية (شبكة الامان والامن الغذائي)"
];

const drawSFDLogo = (doc: jsPDF) => {
    const logoX = 15;
    const logoY = 8;
    doc.setFillColor(40, 60, 80); // SFD Blue
    doc.rect(logoX, logoY, 6, 15, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("S", logoX + 3, logoY + 4, { align: "center", baseline: "middle" });
    doc.text("F", logoX + 3, logoY + 8, { align: "center", baseline: "middle" });
    doc.text("D", logoX + 3, logoY + 12, { align: "center", baseline: "middle" });
    
    doc.setFont("NotoNaskhArabic", "normal");
    doc.setTextColor(40, 60, 80);
    doc.setFontSize(10);
    doc.text("الصندوق", logoX + 8, logoY + 4);
    doc.text("الاجتماعي", logoX + 8, logoY + 9);
    doc.text("للتنمية", logoX + 8, logoY + 14);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Social Fund for Development", logoX, logoY + 17);
}

const drawPageBorder = (doc: jsPDF) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
}


export default function ViewContractsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedFunder, setSelectedFunder] = useState('');
    const [allEducators, setAllEducators] = useState<Educator[]>([]);
    const [loading, setLoading] = useState({ projects: true, educators: false });
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const [fontCache, setFontCache] = useState<{ regular: string, bold: string } | null>(null);

    // Pre-fetch fonts
    useEffect(() => {
        const fetchFonts = async () => {
            try {
                const [fontRegularRes, fontBoldRes] = await Promise.all([
                    fetch('/fonts/NotoNaskhArabic-Regular.ttf'),
                    fetch('/fonts/NotoNaskhArabic-Bold.ttf')
                ]);
                const fontRegularBuffer = await fontRegularRes.arrayBuffer();
                const fontBoldBuffer = await fontBoldRes.arrayBuffer();
                const toBase64 = (buffer: ArrayBuffer) => btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                setFontCache({ regular: toBase64(fontRegularBuffer), bold: toBase64(fontBoldBuffer) });
            } catch (error) {
                console.error("Failed to fetch fonts:", error);
                toast({ title: "Font Loading Error", description: "Could not load required fonts for PDF generation.", variant: "destructive" });
            }
        };
        fetchFonts();
    }, [toast]);

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
    
    useEffect(() => {
        if (!selectedProjectId) {
            setAllEducators([]);
            return;
        }
        const fetchAllEducators = async () => {
            setLoading(prev => ({ ...prev, educators: true }));
            try {
                const res = await fetch('/api/ed-selection');
                if (!res.ok) throw new Error('Could not fetch educators data.');
                const allData = await res.json();
                setAllEducators(allData.filter((e: any) => e.project_id === selectedProjectId));
            } catch (error: any) {
                toast({ title: "Error loading educator data", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, educators: false }));
            }
        };
        fetchAllEducators();
    }, [selectedProjectId, toast]);

    const filteredEducators = useMemo(() => {
        return allEducators.filter(e => 
            e.contract_type === 'مثقفة مجتمعية' && 
            e.contract_starting_date && e.contract_starting_date.trim() !== ''
        );
    }, [allEducators]);

    const getArabicDay = (dateString: string) => {
        if (!dateString) return '';
        const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayIndex = dayjs(dateString).day();
        return arabicDays[dayIndex];
    };

    const generateContract = useCallback(async (educator: Educator) => {
        if (!fontCache) {
            toast({ title: "Fonts not ready", description: "Please wait a moment for fonts to load.", variant: "destructive" });
            return;
        }
        if (!selectedFunder) {
            toast({ title: "Funder Not Selected", description: "Please select a funder before generating a contract.", variant: "destructive" });
            return;
        }
        setGeneratingPdf(true);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);

        try {
            const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
            doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontCache.regular);
            doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontCache.bold);
            doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

            // --- Header ---
            drawSFDLogo(doc);
            const pageWidth = doc.internal.pageSize.getWidth();
            const right = pageWidth - 10;
            const MARGIN_X = 10;
            const CONTENT_W = pageWidth - MARGIN_X * 2;
            
            doc.setFont("NotoNaskhArabic", "bold");
            doc.setFontSize(9);
            doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
            doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
            doc.text("فرع الامانه - صنعاء - مارب - الجوف - المحويت", right, 18, { align: "right" });
            doc.text(`رقم المشروع: ${selectedProjectId}`, right, 23, { align: 'right' });
            doc.setLineWidth(0.5);
            doc.line(10, 28, pageWidth - 10, 28);


            // --- Title ---
            let y = 40;
            doc.setFont("NotoNaskhArabic", "bold");
            doc.setFontSize(16);
            doc.setLineHeightFactor(1.5);
            doc.text("عـقـد عمل مؤقت (نقد مقابل العمل في الخدمات الاجتماعية في التغذية)", pageWidth / 2, y, { align: 'center', styles: { underline: true }});
            
            // --- Body ---
            y += 20;
            doc.setFontSize(11);
            doc.setFont("NotoNaskhArabic", "normal");

            const contractDay = getArabicDay(educator.contract_starting_date);
            const startDateFormatted = dayjs(educator.contract_starting_date).format('YYYY/MM/DD');
            const endDateFormatted = dayjs(educator.contract_end_date).format('YYYY/MM/DD');
            const issueDateFormatted = dayjs(educator.id_issue_date).format('YYYY/MM/DD');

            const introText = `أنه في يوم ${contractDay}  الموافق ${startDateFormatted}  بمدينة صنعاء تم بين كلٍ من:`;
            doc.text(introText, right, y, { align: 'right' });
            y += 8;
            
            const party1Text = `1)     الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: 513821 ، فاكس513803 )  الرقم المجاني للشكاوى والبلاغات (8009800)، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أوـ (الطرف الأول ) أو الصندوق.`;
            doc.text(party1Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
            y += 12;

            const party2Text = `2)     الأخت/ ${educator.applicant_name} تحمل ${educator.id_card_type} رقم ${educator.id_card_no} صادرة من ${educator.id_issue_loc} بتاريخ  ${issueDateFormatted} ويسمى لأغراض هذا العقد بـ (الطرف الثاني) `;
            doc.text(party2Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
            y += 12;

            const clause1Title = "البند الأول: موضوع العقـد";
            doc.setFont("NotoNaskhArabic", "bold");
            doc.text(clause1Title, right, y, { align: 'right' });
            y+= 6;
            doc.setFont("NotoNaskhArabic", "normal");
            const clause1Text = `في إطار الصندوق الاجتماعي للتنمية – فرع الأمانة، صنعاء، مارب، الجوف، المحويت  -برنامج التحويلات النقدية المشروطة في التغذية  وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى ${educator.working_village} في مديرية  ${educator.mud_name}  الممول من منحة ${selectedFunder}`;
            doc.text(clause1Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
            y += 12;

            const clause2Title = "البند الثاني: وصف العمل";
            doc.setFont("NotoNaskhArabic", "bold");
            doc.text(clause2Title, right, y, { align: 'right' });
            y+= 6;
            doc.setFont("NotoNaskhArabic", "normal");
            const clause2Text = `يتعهد الطرف الثاني بالقيام بمهامه ومسئولياته وفق ما هو محددٌ ومسندٌ له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد، والذي يعتبر جزء لايتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجيه وكفاءة ممكنة وبكل أمانة وإخلاص  تجاه الطرف الأول وعمله ومصالحه، وكما هو مبينٌ تفصيلاً في البند السابع (7) من هذا العقد.`;
            doc.text(clause2Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
            y += 20;

            const clause3Title = "البند الثالث: مدة العقـد";
            doc.setFont("NotoNaskhArabic", "bold");
            doc.text(clause3Title, right, y, { align: 'right' });
            y+= 6;
            doc.setFont("NotoNaskhArabic", "normal");
            const clause3Text = `اتفق الطرفان على أن تكون مدة هذا العقد ${educator.contract_duration_months} أشهر تبدأ من تاريخ ${startDateFormatted} وتنتهي في ${endDateFormatted}، إن لم يتم الإشعار كتابيا عن إنهاء العقد من قبل أي من الطرفين، قبل انقضاء مدته ، أو لم يُنص تحديداً على تعديل أو حذف أو إضافة أي بند من بنوده. و يحق لأحد الطرفين اخطار الطرف الاخر بشكل كتابي بإنهاء العقد.`;
            doc.text(clause3Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
            y += 20;
            
            const clause4Title = "البند الرابع: الأجر الشهري: اتفق الطرفان على ما يلي:";
            doc.setFont("NotoNaskhArabic", "bold");
            doc.text(clause4Title, right, y, { align: 'right' });
            y+= 6;
            doc.setFont("NotoNaskhArabic", "normal");
            const clause4Text = `يتقاضى الطرف الثاني في نهاية كل شهر ميلادي إبتداءً من تاريخ مباشرته للعمل، و بالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول. و وفق أحكام هذا العقد أجراً شهرياً  صافيا ، مبلغ وقدره (   100دولار  ) ،  مائة دولار موضحة على النحو التالي :`;
            const clause4List = `1.      80 دولار أجور الخدمات والمهام المنجزة خلال الشهر \n2.      20 دولار  أجور انتقال ومواصلات واتصالات وانترنت`;
            doc.text(clause4Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
            y += 12;
            doc.text(clause4List, right, y, { align: 'right' });
            y += 16;
            
            const clause5Title = "البند الخامس : أيام وساعات العمل";
            doc.setFont("NotoNaskhArabic", "bold");
            doc.text(clause5Title, right, y, { align: 'right' });
            y+= 6;
            doc.setFont("NotoNaskhArabic", "normal");
            const clause5Text = `اتفق الطرفان بأن أيام العمل الرسمية هي خمس أيام عمل (من الأحد إلى الخميس ) ،أو (من السبت إلى الأربعاء)  يعقبهما يومي راحة مدفوعي الأجر، وأن  ساعات العمل اليومية هي (6) ساعات ، ما يساوي(30) ساعة عمل أسبوعياً ، باستثناء شهر رمضان والتي ستُحدد فيه ساعات العمل حسب تعليمات وتوجيهات الطرف الأول. ويمكن للمثقفة تنفيذ الأنشطة دون التقيد بالأيام الرسمية للعمل باعتبارها أنشطة مجتمعية`;
            doc.text(clause5Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });

            // --- Footer ---
            const footerY = doc.internal.pageSize.getHeight() - 20;
            doc.setTextColor(230, 230, 230);
            doc.text("التوقيع", pageWidth / 2, footerY, { align: 'center'});
            doc.setDrawColor(0,0,0);
            doc.setLineWidth(0.5);
            doc.line(10, footerY + 2, pageWidth - 10, footerY + 2);

            const project = projects.find(p => p.projectId === selectedProjectId);
            const footerBoxY = footerY + 5;
            doc.rect(10, footerBoxY, pageWidth - 20, 10);
            doc.setTextColor(0,0,0);
            doc.setFontSize(9);
            doc.text(`عقد عمل مؤقت مثقفة مجتمعية – ${project?.projectName || ''}`, pageWidth - 15, footerBoxY + 6, { align: 'right'});
            doc.text(`1/1`, 15, footerBoxY + 6, { align: 'left'});


            const blob = doc.output('blob');
            const dataUrl = URL.createObjectURL(blob);
            setPdfUrl(dataUrl);

        } catch(e: any) {
            toast({title: "PDF Generation Failed", description: e.message, variant: 'destructive'});
        } finally {
            setGeneratingPdf(false);
        }

    }, [fontCache, selectedProjectId, selectedFunder, projects, toast, pdfUrl]);

    const selectedEducatorForDisplay = useMemo(() => {
        if (!selectedProjectId) return null;
        return filteredEducators.length > 0 ? filteredEducators[0] : null;
    }, [filteredEducators, selectedProjectId]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">View Educator Contracts</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contracts Hub
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select Project and Funder</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Select onValueChange={(val) => {setSelectedProjectId(val); setPdfUrl(null);}} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger>
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                     <Select onValueChange={setSelectedFunder} value={selectedFunder}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Funder..." />
                        </SelectTrigger>
                        <SelectContent>
                           {funderOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading.educators ? (
                <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div>
            ) : selectedProjectId && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contracted Educators</CardTitle>
                            <CardDescription>
                                Showing {filteredEducators.length} educators with contracts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Applicant Name</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEducators.length > 0 ? filteredEducators.map(edu => (
                                            <TableRow key={edu.applicant_id}>
                                                <TableCell>{edu.applicant_name}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => generateContract(edu)} disabled={generatingPdf}>
                                                        <Eye className="h-4 w-4"/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                                    No contracted educators found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader><CardTitle>View Educator Contract</CardTitle></CardHeader>
                        <CardContent>
                            <div className="w-full aspect-[1/1.414] bg-slate-200 rounded-md overflow-hidden border">
                                {generatingPdf ? (
                                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
                                ) : pdfUrl ? (
                                    <iframe ref={iframeRef} src={pdfUrl} className="w-full h-full" title="Contract Preview" />
                                ) : (
                                     <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                        <FileText className="h-16 w-16 mb-2"/>
                                        <p>Select an educator to view their contract.</p>
                                     </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            )}
        </div>
    );
}
