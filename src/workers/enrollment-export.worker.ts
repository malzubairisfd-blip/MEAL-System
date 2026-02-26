// src/workers/enrollment-export.worker.ts
import ExcelJS from 'exceljs';
import { openDB, IDBPDatabase } from 'idb';

// --- Types ---
interface EnrollmentRecord {
    [key: string]: any;
}

// --- IDB Functions ---
const ENROLLMENT_DB_NAME = 'enrollment-review-db';
const ENROLLMENT_STORE_NAME = 'files';
const ENROLLMENT_DATA_KEY = 'enrollmentData';
const ENROLLMENT_IMAGES_KEY = 'enrollmentDashboardImages';
const ENROLLMENT_PROCESSED_KEY = 'enrollmentDashboardData';
const ENROLLMENT_DB_VERSION = 2;

async function getEnrollmentDb(): Promise<IDBPDatabase> {
  return openDB(ENROLLMENT_DB_NAME, ENROLLMENT_DB_VERSION);
}

async function loadEnrollmentDashboardData(): Promise<{ chartImages: Record<string, string>, processedDataForReport: any } | null> {
    try {
        const db = await getEnrollmentDb();
        const chartImages = await db.get(ENROLLMENT_STORE_NAME, ENROLLMENT_IMAGES_KEY);
        const processedDataForReport = await db.get(ENROLLMENT_STORE_NAME, ENROLLMENT_PROCESSED_KEY);
        if (chartImages && processedDataForReport) {
            return { chartImages, processedDataForReport };
        }
        return null;
    } catch (error) {
        console.error("Failed to load enrollment dashboard data from cache:", error);
        return null;
    }
}

// --- Worker Logic ---

self.onmessage = async (event: MessageEvent) => {
    const { projectId, projectName } = event.data;

    if (!projectId || !projectName) {
        postMessage({ type: 'error', error: 'Project ID and Project Name are required.' });
        return;
    }

    try {
        postMessage({ type: 'progress', status: 'Fetching data...', progress: 10 });
        const res = await fetch(`/api/enrollment-review?projectId=${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch enrollment data.');
        const allRecords: EnrollmentRecord[] = await res.json();
        
        // Ensure we only process records for the selected project name as a safeguard
        const records = allRecords.filter(r => r.project_name === projectName);
        
        if (records.length === 0) {
          postMessage({ type: 'error', error: 'No records found for the selected project. Please check the project selection or the database content.' });
          return;
        }
        
        postMessage({ type: 'progress', status: 'Creating workbook...', progress: 30 });
        const workbook = new ExcelJS.Workbook();
        
        // --- Sheet 1: Enrollment Review Results ---
        postMessage({ type: 'progress', status: 'Creating main sheet...', progress: 40 });
        const mainSheet = workbook.addWorksheet('Enrollment Review Results');
        if (records.length > 0) {
            const columns = Object.keys(records[0]).filter(key => key !== 'data');
            mainSheet.columns = columns.map(key => ({
                header: key,
                key,
                width: 20
            }));
            mainSheet.addRows(records.map(r => {
                const row: any = {};
                columns.forEach(col => {
                    row[col] = r[col];
                });
                return row;
            }));
        }

        // --- Sheet 2: Disqualified ---
        postMessage({ type: 'progress', status: 'Creating disqualified sheet...', progress: 60 });
        const disqualifiedSheet = workbook.addWorksheet('Disqualified');
        createDisqualifiedSheet(disqualifiedSheet, records);

        // --- Sheet 3: Dashboard ---
        postMessage({ type: 'progress', status: 'Loading dashboard images...', progress: 80 });
        const cachedDashboard = await loadEnrollmentDashboardData();
        if (cachedDashboard?.chartImages) {
            createDashboardSheet(workbook, cachedDashboard.chartImages, cachedDashboard.processedDataForReport);
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

function createDashboardSheet(workbook: ExcelJS.Workbook, images: Record<string, string>, processedData: any) {
    const ws = workbook.addWorksheet("Enrollment Dashboard");
    ws.views = [{ rightToLeft: true }];
    
    ws.columns = [
        { width: 2 },  // A
        { width: 20 }, // B
        { width: 20 }, // C
        { width: 16 },  // D
        { width: 20 }, // E
        { width: 20 }, // F
    ];


    ws.mergeCells('B2:F2');
    const titleCell = ws.getCell('B2');
    titleCell.value = "Analysis Dashboard Report";
    titleCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF002060' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 30;

    const kf = processedData.keyFigures;
    const keyFiguresData = [
        { title: 'Total Enrollments', value: processedData.total, cell: 'B4' },
        ...Object.entries(processedData.modificationTypes).map(([type, value], i) => ({ title: type, value: value as number, cell: String.fromCharCode(67+i) + '4' })),
    ];
    
    keyFiguresData.forEach(item => {
        const titleCell = ws.getCell(item.cell);
        titleCell.value = item.title;
        titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        const valueCell = ws.getCell(item.cell.replace('4', '5'));
        valueCell.value = item.value;
        valueCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF002060' } };
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(5).height = 30;


    const addImage = (base64: string, tl: { col: number, row: number }, ext: { width: number, height: number }) => {
        if (!base64 || !base64.startsWith('data:image/png;base64,')) return;

        const imageId = workbook.addImage({
            base64: base64.split(',')[1],
            extension: 'png',
        });
        
        ws.addImage(imageId, { tl, ext });
    };
    
    let currentRow = 7;
    const rowGap = 1;

    if (images.signingDays) {
      addImage(images.signingDays, { col: 1, row: currentRow }, { width: 450, height: 400 });
    }
     if (images.ozlaChart) {
      addImage(images.ozlaChart, { col: 6, row: currentRow }, { width: 450, height: 400 });
    }
    currentRow += Math.round(400 / 15) + rowGap;

    if (images.bubbleChart) {
        addImage(images.bubbleChart, { col: 1, row: currentRow }, { width: 900, height: 400 });
    }
    currentRow += Math.round(400 / 15) + rowGap;

    if (images.namePartsTable) {
        addImage(images.namePartsTable, { col: 1, row: currentRow }, { width: 450, height: 250 });
    }
    if (images.pieCharts) {
        addImage(images.pieCharts, { col: 6, row: currentRow }, { width: 450, height: 250 });
    }
    currentRow += Math.round(250 / 15) + rowGap;

    if (images.nonSigningChart) {
        addImage(images.nonSigningChart, { col: 1, row: currentRow }, { width: 900, height: 300 });
    }
    currentRow += Math.round(300 / 15) + rowGap;

    if (images.recommendationsTable) {
        addImage(images.recommendationsTable, { col: 1, row: currentRow }, { width: 900, height: 250 });
    }
}
