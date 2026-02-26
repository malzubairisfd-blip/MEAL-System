// src/workers/enrollment-export.worker.ts
import ExcelJS from 'exceljs';
import { openDB, IDBPDatabase } from 'idb';

// --- Types ---
interface EnrollmentRecord {
    [key: string]: any;
}

// --- IDB Functions ---
const DB_NAME = 'beneficiary-insights-cache';
const STORE_NAME = 'results';
const FULL_RESULT_KEY = 'FULL_RESULT';

async function getDb(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, 2);
}

async function loadCachedResult(): Promise<any | null> {
  try {
    const db = await getDb();
    const result = await db.get(STORE_NAME, FULL_RESULT_KEY);
    return result;
  } catch (error) {
     console.error("Failed to load cached result from worker:", error);
     return null;
  }
}

// --- Worker Logic ---

self.onmessage = async (event: MessageEvent) => {
    const { projectId } = event.data;

    if (!projectId) {
        postMessage({ type: 'error', error: 'Project ID is required.' });
        return;
    }

    try {
        postMessage({ type: 'progress', status: 'Fetching data...', progress: 10 });
        const res = await fetch(`/api/enrollment-review?projectId=${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch enrollment data.');
        const records: EnrollmentRecord[] = await res.json();
        
        postMessage({ type: 'progress', status: 'Creating workbook...', progress: 30 });
        const workbook = new ExcelJS.Workbook();
        
        // --- Sheet 1: Enrollment Review Results ---
        postMessage({ type: 'progress', status: 'Creating main sheet...', progress: 40 });
        const mainSheet = workbook.addWorksheet('Enrollment Review Results');
        if (records.length > 0) {
            mainSheet.columns = Object.keys(records[0]).map(key => ({
                header: key,
                key,
                width: 20
            }));
            mainSheet.addRows(records);
        }

        // --- Sheet 2: Disqualified ---
        postMessage({ type: 'progress', status: 'Creating disqualified sheet...', progress: 60 });
        const disqualifiedSheet = workbook.addWorksheet('Disqualified');
        createDisqualifiedSheet(disqualifiedSheet, records);

        // --- Sheet 3: Dashboard ---
        postMessage({ type: 'progress', status: 'Loading dashboard images...', progress: 80 });
        const cachedDashboard = await loadCachedResult();
        if (cachedDashboard?.chartImages) {
            createDashboardSheet(workbook, cachedDashboard.chartImages);
        }

        postMessage({ type: 'progress', status: 'Finalizing file...', progress: 95 });
        const buffer = await workbook.xlsx.writeBuffer();
        
        postMessage({ type: 'done', data: buffer }, [buffer]);

    } catch (error: any) {
        postMessage({ type: 'error', error: error.message || 'An unknown error occurred.' });
    }
};

function createDisqualifiedSheet(worksheet: ExcelJS.Worksheet, records: EnrollmentRecord[]) {
    const codeMap: Record<string, number> = {
        'ازدواج في الاستفادة (مثقفة /مستفيدة)': 2, 'ازدواج في الاستفادة مثقفة و مستفيدة': 2,
        'التكرار': 3, 'مستفيدة مكررة': 3,
        'عدم القبول بمنافع واشتراطات المشروع': 4,
        'غياب لاكثر من ثلاث جلسات عامة': 5,
        'الوفاه لاسمح الله': 6, 'الوفاة': 6,
        'لا تنطبق عليها المعايير': 7,
        'عدم استيفاء شروط الالتحاق بالمشروع': 9,
        'خطأ في الإدخال': 10,
        'ازدواج/مثقفة': 12,
        'انتحال شخصية': 13,
        'تزوير وثائق': 14,
        'انتقال دائم لسكن وإقامة المستفيدة خارج المديرية': 15,
        'عدم الاستدلال على عنوانها': 51,
        'مغادرة المنطقة مؤقتا': 52,
        'رفضت الحضور': 53,
        'نازحة': 54,
        'لم تحضر/غائبة': 55,
        'سفر مؤقت': 56,
        'أخرى': 99, 'اخرى تذكر': 99,
    };
    
    worksheet.columns = [
        { header: 'م', key: 'serial', width: 5 },
        { header: 'كود المستفيدة', key: 'benef_id', width: 15 },
        { header: 'اسم المستفيدة', key: 'benef_name', width: 30 },
        { header: 'كود الاستبعاد', key: 'code', width: 15 },
        { header: 'مبرر الاستبعاد', key: 'reason', width: 40 },
        { header: 'كود المثقفة', key: 'ed_id', width: 15 },
        { header: 'اسم المثقفة', key: 'ed_name', width: 30 },
        { header: 'ملاحظات', key: 'notes', width: 40 },
        { header: 'مقترح وتوصية الفرع', key: 'recommendation', width: 30 },
        { header: 'ملاحظات الوحدة', key: 'hq_notes', width: 30 },
        { header: 'توصية الوحدة', key: 'hq_recommendation', width: 30 },
    ];

    const disqualifiedRecords = records.filter(r => r.the_reason_for_not_joining_the_project_is_stated);
    
    disqualifiedRecords.forEach((record, index) => {
        const reason = record.the_reason_for_not_joining_the_project_is_stated;
        const code = codeMap[reason] || 99; // Default to 'أخرى'
        
        let recommendation = '';
        if ([2, 3, 12].includes(code)) recommendation = 'تصنف إلى تكرار/ازدواج';
        else if ([6, 7, 9, 13, 10, 14].includes(code)) recommendation = 'تصنف إلى مستبعدة';
        else if ([4, 5, 15, 51, 52, 53, 54, 55, 99].includes(code)) recommendation = 'تبقى مرشحة';

        worksheet.addRow({
            serial: index + 1,
            benef_id: record.benef_id,
            benef_name: record.bnf_name,
            code: code,
            reason: reason,
            ed_id: record.ed_id,
            ed_name: record.ed_name,
            notes: record.other_things_to_mention,
            recommendation: recommendation,
            hq_notes: '',
            hq_recommendation: ''
        });
    });
}

function createDashboardSheet(workbook: ExcelJS.Workbook, images: Record<string, string>) {
    const ws = workbook.addWorksheet("Enrollment Dashboard");
    
    const addImage = (base64: string, tl: { col: number, row: number }, ext: { width: number, height: number }) => {
        if (!base64 || !base64.startsWith('data:image/png;base64,')) return;

        const imageId = workbook.addImage({
            base64: base64.split(',')[1],
            extension: 'png',
        });
        
        ws.addImage(imageId, { tl, ext });
    };

    let currentRow = 1;

    const addImageToSheet = (key: string, width: number, height: number, col: number) => {
        if (images[key]) {
            addImage(images[key], { col, row: currentRow }, { width, height });
        }
    };
    
    addImageToSheet('keyFigures', 900, 200, 1);
    currentRow += 14; 
    
    addImageToSheet('signingDays', 450, 400, 1);
    addImageToSheet('ozlaChart', 450, 400, 6);
    currentRow += 28;

    addImageToSheet('bubbleChart', 900, 400, 1);
    currentRow += 28;

    addImageToSheet('namePartsTable', 450, 250, 1);
    addImageToSheet('pieCharts', 450, 250, 6);
    currentRow += 18;

    addImageToSheet('nonSigningChart', 900, 300, 1);
    currentRow += 21;

    addImageToSheet('recommendationsTable', 900, 250, 1);
}
