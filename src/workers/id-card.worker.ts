// src/workers/id-card.worker.ts
import { jsPDF } from "jspdf";
import JSZip from "jszip";

// --- TYPES & INTERFACES ---

export interface IDCardData {
  beneficiaryName: string;
  governorate: string;
  district: string;
  uzla: string;
  village: string;
  beneficiaryId: string;
  cardExpiry: string;
  educatorName?: string;
  branchName?: string; 
}

// --- CONSTANTS & CONFIGURATION ---

// Standard CR80 ID Card dimensions (mm)
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;

// Colors extracted from reference image
const COLORS = {
  primaryBrown: "#6F3B35", // The dark maroon/brown
  primaryGold: "#C8AA68",  // The tan/gold accent
  textBlack: "#000000",
  textWhite: "#FFFFFF",
  photoPlaceholder: "#F0F0F0",
  borderGold: "#8B6F3E",   // Darker gold for borders
};

// Layout constants
const MARGIN = 4;

// --- HELPER FUNCTIONS ---

/**
 * Draws a dotted line for form fields
 */
const drawDottedLine = (doc: jsPDF, x1: number, y1: number, x2: number) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([0.5, 0.5], 0); // Dotted pattern
    doc.line(x1, y1, x2, y1);
    doc.setLineDashPattern([], 0); // Reset to solid
};

/**
 * Draws the specific SFD Logo (Simulated geometric representation)
 * Ideally, replace this with doc.addImage if you have the PNG/JPG
 */
const drawLogo = (doc: jsPDF, x: number, y: number, size: number) => {
  const blue = "#2C5F79";
    const gray = "#555555";
      
        // Draw Logo Box (Placeholder simulation of the SFD logo structure)
          doc.setFillColor(blue);
            doc.rect(x, y, 4, size, "F"); // S
              doc.setFillColor(gray);
                doc.rect(x + 4.5, y, 4, size, "F"); // F
                  doc.setFillColor(blue);
                    doc.rect(x + 9, y, 4, size, "F"); // D
                      
                        // Text below logo
                          doc.setFontSize(4);
                            doc.setTextColor(blue);
                              doc.text("الصندوق الاجتماعي", x + 13, y + size + 2, { align: "right" });
                                doc.text("للتنمية", x + 13, y + size + 4, { align: "right" });
                                  
                                    // English text
                                      doc.setFontSize(3);
                                        doc.text("Social Fund For Development", x, y + size + 6, { align: "left" });
};

// --- CORE DRAWING FUNCTIONS ---

/**
 * Draws the Front Side of the ID Card
 */
const drawCardFront = (doc: jsPDF, data: IDCardData) => {
  // 1. Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");

  // 2. Decorative Curves (Left Side)
  // Brown Swoosh (Bottom Left)
  doc.setFillColor(COLORS.primaryBrown);
  doc.setDrawColor(COLORS.primaryBrown);
  doc.lines(
      [[0, -35], [15, 10], [10, 25], [-25, 0]], // Path relative to start
      0, CARD_HEIGHT, // Start X, Y
      [1, 1], // Scale
      "F", true // Style, closed
  );
  
  // Gold Swoosh (Overlapping/Next to Brown)
  doc.setFillColor(COLORS.primaryGold);
  doc.setDrawColor(COLORS.primaryGold);
  // Drawing a custom shape to match the curve
  doc.path([
      { op: 'm', c: [0, 30] }, // Move to left edge
      { op: 'c', c: [10, 35, 25, 50, 20, 54] }, // Curve down to bottom
      { op: 'l', c: [0, 54] }, // Line to corner
      { op: 'l', c: [0, 30] }, // Close
  ]);
  doc.fill();

  // 3. Header Text
  doc.setTextColor(COLORS.textBlack);
  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(9);
  
  // Top right header
  const headerRightX = CARD_WIDTH - MARGIN;
  const headerY = 7;
  doc.text("الصندوق الاجتماعي للتنمية – فرع .................", headerRightX, headerY, { align: "right" });
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", headerRightX, headerY + 4.5, { align: "right" });

  // Header Line
  doc.setDrawColor(COLORS.primaryBrown);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, headerY + 6.5, CARD_WIDTH - MARGIN, headerY + 6.5);

  // 4. Logo (Top Left)
  drawLogo(doc, 6, 4, 8);

  // 5. Photo Area (Left)
  const photoX = 10;
  const photoY = 17;
  const photoW = 22;
  const photoH = 20;

  doc.setFillColor(COLORS.photoPlaceholder);
  doc.rect(photoX, photoY, photoW, photoH, "F"); // Gray placeholder
  
  // "Beneficiary Code" text below photo
  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.textBlack);
  doc.text("كود المستفيدة", photoX + (photoW / 2), photoY + photoH + 5, { align: "center" });

  // 6. Center/Right Content - "Beneficiary Card" Box
  const boxW = 35;
  const boxH = 8;
  const boxX = (CARD_WIDTH / 2) + 5; // Slightly right of center
  const boxY = 17;

  doc.setDrawColor(COLORS.borderGold);
  doc.setLineWidth(0.7);
  doc.rect(boxX, boxY, boxW, boxH);
  
  doc.setFontSize(10);
  doc.text("بطاقة مستفيدة", boxX + (boxW / 2), boxY + 5.5, { align: "center" });

  // 7. Form Fields
  doc.setFontSize(8);
  doc.setFont("NotoNaskhArabic", "bold");
  
  const startX = CARD_WIDTH - MARGIN; // Right aligned text
  const labelX = startX; // X position for labels
  const valueEndX = boxX - 5; // Where lines end on the left
  let currentY = 32;
  const lineHeight = 5.5;

  // Row 1: Name
  doc.text("الاسم:", labelX, currentY, { align: "right" });
  // Draw value
  doc.setFont("NotoNaskhArabic", "normal");
  doc.text(data.beneficiaryName, labelX - 12, currentY, { align: "right" }); 
  drawDottedLine(doc, valueEndX, currentY + 1, labelX - 10);
  
  currentY += lineHeight;

  // Row 2: Village & Uzla (Split row)
  doc.setFont("NotoNaskhArabic", "bold");
  
  // Right side: Village
  doc.text("القرية:", labelX, currentY, { align: "right" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.text(data.village, labelX - 12, currentY, { align: "right" });
  drawDottedLine(doc, labelX - 35, currentY + 1, labelX - 10);

  // Middle: Uzla
  const uzlaLabelX = labelX - 37;
  doc.setFont("NotoNaskhArabic", "bold");
  doc.text("العزلة:", uzlaLabelX, currentY, { align: "right" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.text(data.uzla, uzlaLabelX - 10, currentY, { align: "right" });
  drawDottedLine(doc, valueEndX, currentY + 1, uzlaLabelX - 10);

  currentY += lineHeight;

  // Row 3: District
  doc.setFont("NotoNaskhArabic", "bold");
  doc.text("المديرية:", labelX, currentY, { align: "right" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.text(data.district, labelX - 15, currentY, { align: "right" });
  drawDottedLine(doc, valueEndX + 15, currentY + 1, labelX - 13);

  currentY += lineHeight;

  // Row 4: Card Number
  doc.setFont("NotoNaskhArabic", "bold");
  doc.text("رقم البطاقة:", labelX, currentY, { align: "right" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.text(data.beneficiaryId, labelX - 20, currentY, { align: "right" });
  drawDottedLine(doc, valueEndX + 10, currentY + 1, labelX - 18);

  currentY += lineHeight;

  // Row 5: Expiry Date
  doc.setFont("NotoNaskhArabic", "bold");
  doc.text("تاريخ انتهاء البطاقة:", labelX, currentY, { align: "right" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.text(data.cardExpiry, labelX - 30, currentY, { align: "right" });
  drawDottedLine(doc, valueEndX + 5, currentY + 1, labelX - 28);
};

/**
 * Draws the Back Side of the ID Card
 */
const drawCardBack = (doc: jsPDF) => {
  // 1. Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");
  
  // 2. Decorative Curves (Inverted - Top Left)
  
  // Gold Swoosh (Top Left)
  doc.setFillColor(COLORS.primaryGold);
  // Custom path for top left curve
  doc.path([
      { op: 'm', c: [0, 0] }, 
      { op: 'l', c: [40, 0] }, 
      { op: 'c', c: [30, 10, 10, 20, 0, 30] },
      { op: 'l', c: [0, 0] },
  ]);
  doc.fill();

  // Brown Swoosh (Underneath Gold in Top Left corner)
  doc.setFillColor(COLORS.primaryBrown);
  doc.path([
      { op: 'm', c: [0, 0] },
      { op: 'l', c: [25, 0] },
      { op: 'c', c: [15, 10, 5, 15, 0, 20] },
      { op: 'l', c: [0, 0] },
  ]);
  doc.fill();

  // 3. Header "Important Instructions"
  doc.setFont("NotoNaskhArabic", "normal");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.textBlack);
  doc.text("تعليمات هامة", CARD_WIDTH - 10, 10, { align: "right" });

  // 4. Instructions List
  doc.setFontSize(7);
  const instructions = [
      "• البطاقة مخصصة لأنشطة البرنامج ولا يجوز استخدامها",
      "لأغراض أخرى",
      "• أي كشط او تعديل في بيانات البطاقة يلغيها",
      "• تحصل كل إمرأة امتثلت لشروط البرنامج على مبلغ .......... ريال شهريا خلال مدة تنفيذ",
      "المشروع ولايحق لها التنازل عنه للغير جزئيا أو كليا",
      "• عند اجبار المستفيدة على دفع أو خصم مبلغ منها يتم ابلاغ إدارة المشروع أو البرنامج فورا",
      "• للإبلاغ عن فقدان البطاقة أو تقديم شكوى أو استفسار يتم التواصل عبر أحد الوسائل",
      "المدونة أدناه"
  ];

  let textY = 16;
  const textX = CARD_WIDTH - 8;
  const bulletX = CARD_WIDTH - 5;

  instructions.forEach((line, index) => {
      // Check if line is a continuation (indented) or new point
      const isBullet = [0, 2, 3, 5, 6].includes(index); 
      
      if (isBullet) {
          doc.circle(bulletX, textY - 1, 0.5, 'F'); // Bullet point
      }
      
      doc.text(line, isBullet ? textX : textX, textY, { align: "right" });
      textY += 4;
  });

  // 5. Footer (Brown Bar)
  const footerHeight = 9;
  const footerY = CARD_HEIGHT - footerHeight;
  
  doc.setFillColor(COLORS.primaryBrown);
  doc.rect(0, footerY, CARD_WIDTH, footerHeight, "F");

  // Footer Text
  doc.setTextColor(COLORS.textWhite);
  doc.setFontSize(7);
  const footerText = "الاتصال بالرقم المجاني ............ أو الرقم الثابت ....................";
  doc.text(footerText, CARD_WIDTH / 2, footerY + 6, { align: "center" });
};

// --- WORKER LOGIC ---
self.onmessage = async (event) => {
    const { beneficiaries, fontBase64, sample } = event.data;

    if (!beneficiaries || !fontBase64 || !fontBase64.regular || !fontBase64.bold) {
        postMessage({ type: 'error', error: 'Missing beneficiaries data or font files.' });
        return;
    }
    
    try {
        if (sample) {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_WIDTH, CARD_HEIGHT] });
            doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
            doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
            doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

            const bnf = beneficiaries[0];
            const cardData: IDCardData = {
                beneficiaryName: bnf.l_benef_name || '', governorate: bnf.gov_name || '', district: bnf.mud_name || '',
                uzla: bnf.hh_ozla_name || '', village: bnf.hh_vill_name || '', beneficiaryId: String(bnf.l_id || ''),
                cardExpiry: bnf.expiry_date || "2024-01-31"
            };
            drawCardFront(doc, cardData);
            doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
            drawCardBack(doc);
            const pdfBuffer = doc.output("arraybuffer");
            self.postMessage({ type: 'done-sample', data: pdfBuffer }, [pdfBuffer]);
            return;
        }
        
        const grouped: Record<string, any[]> = {};
        beneficiaries.forEach((row: any) => {
            const edu = row.ED_NAME || "Unassigned_Educator";
            if (!grouped[edu]) grouped[edu] = [];
            grouped[edu].push(row);
        });

        const zip = new JSZip();
        const totalEducators = Object.keys(grouped).length;
        let educatorsProcessed = 0;

        for (const [educator, bnfs] of Object.entries(grouped)) {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_WIDTH, CARD_HEIGHT] });
            doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
            doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
            doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

            bnfs.forEach((bnf, index) => {
                if (index > 0) doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                
                const cardData: IDCardData = {
                    beneficiaryName: bnf.l_benef_name || '', governorate: bnf.gov_name || '', district: bnf.mud_name || '',
                    uzla: bnf.hh_ozla_name || '', village: bnf.hh_vill_name || '', beneficiaryId: String(bnf.l_id || ''),
                    cardExpiry: bnf.expiry_date || "2024-01-31",
                    educatorName: educator
                };

                drawCardFront(doc, cardData);
                doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                drawCardBack(doc);
            });

            const safeName = educator.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, "_").trim();
            zip.file(`${safeName}_ID_Cards.pdf`, doc.output("arraybuffer"));
            
            educatorsProcessed++;
            postMessage({
                type: 'progress',
                status: `Generating PDFs for ${safeName}...`,
                progress: Math.round((educatorsProcessed / totalEducators) * 100),
                current: educatorsProcessed,
                total: totalEducators
            });
        }
        
        postMessage({ type: 'progress', status: 'Zipping files...', progress: 99 });
        const zipContent = await zip.generateAsync({ type: "arraybuffer" });

        self.postMessage({ type: 'done-all', data: zipContent }, [zipContent]);

    } catch (error: any) {
        postMessage({ type: 'error', error: error.message });
    }
};
