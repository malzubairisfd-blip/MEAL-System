
// src/lib/arabicClusterSummary.ts

type SimilarityScores = {
  womanName?: number;      // 0–1
  husbandName?: number;    // 0–1
  overall?: number;        // 0–1
};

export function generateArabicClusterSummary(
  cluster: any,
  rows: any[]
) {
  const reasons: string[] = cluster.reasons || [];
  const size = rows.length;

  const explanations: string[] = [];

  /* --------------------------------------------------
     1️⃣ REASON ANALYSIS (UNCHANGED + CLEANED)
  -------------------------------------------------- */
  if (reasons.includes("DUPLICATED_HUSBAND_LINEAGE")) {
    explanations.push(
      "تشابه قوي في أسماء الأزواج (الاسم، اسم الأب، واسم الجد) مع اختلافات إملائية طفيفة."
    );
  }

  if (reasons.includes("WOMAN_LINEAGE_MATCH")) {
    explanations.push(
      "تشابه واضح في نسب المرأة (الأب، الجد، واسم العائلة) مع اختلاف بسيط في الاسم الأول."
    );
  }

  if (reasons.includes("TOKEN_REORDER")) {
    explanations.push(
      "اختلاف في ترتيب أجزاء الاسم أو تكرار بعض الأجزاء نتيجة أخطاء إدخال البيانات."
    );
  }

  if (reasons.includes("POLYGAMY_PATTERN")) {
    explanations.push(
      "نمط تعدد زوجات محتمل مع احتمال تسجيل الأسرة أكثر من مرة."
    );
  }

  /* --------------------------------------------------
     2️⃣ PAIRWISE SIMILARITY SCORE ANALYSIS
  -------------------------------------------------- */
  const avgWoman = cluster.avgWomanNameScore || 0;
  const avgHusband = cluster.avgHusbandNameScore || 0;
  const avgOverall = cluster.avgFinalScore || 0;


  /* --------------------------------------------------
     3️⃣ CONFIDENCE SCORE (0–100)
  -------------------------------------------------- */
  let confidenceScore = Math.round(avgOverall * 100);

  if (reasons.includes("DUPLICATED_HUSBAND_LINEAGE")) confidenceScore += 5;
  if (reasons.includes("WOMAN_LINEAGE_MATCH")) confidenceScore += 5;
  if (reasons.includes("TOKEN_REORDER")) confidenceScore += 3;

  confidenceScore = Math.min(confidenceScore, 100);

  /* --------------------------------------------------
     5️⃣ EXPERT EVALUATION (HUMAN-LIKE DECISION)
  -------------------------------------------------- */
  let decision = "غير مكرر";
  let expertNote = "لا توجد مؤشرات كافية على التكرار.";

  if (confidenceScore >= 90) {
    decision = "تكرار مؤكد";
    expertNote =
      "تطابق قوي جدًا في الأسماء والنسب مع احتمالية عالية أن السجلات تعود لنفس المستفيد.";
  } else if (confidenceScore >= 75) {
    decision = "اشتباه تكرار قوي";
    expertNote =
      "تشابه مرتفع في الأسماء والنسب، ويوصى بالتحقق الميداني.";
  } else if (confidenceScore >= 60) {
    decision = "اشتباه تكرار";
    expertNote =
      "يوجد تشابه جزئي، وقد يكون ناتجًا عن تشابه أسماء شائع في المنطقة.";
  }

  /* --------------------------------------------------
     6️⃣ FINAL ARABIC SUMMARY (HTML SAFE)
  -------------------------------------------------- */
  const summaryHtml = `
<strong>النتيجة العامة:</strong><br/>
تم تجميع <strong>${size}</strong> سجلات يُحتمل أنها تمثل نفس المستفيد أو نفس الأسرة.<br/><br/>

<strong>أسباب التجميع:</strong><br/>
${explanations.length ? explanations.map(e => `• ${e}`).join("<br/>") : "• لا توجد أسباب مسجلة"}<br/><br/>

<strong>تحليل درجات التشابه:</strong><br/>
• متوسط تشابه اسم المرأة: <strong>${Math.round(avgWoman * 100)}%</strong><br/>
• متوسط تشابه اسم الزوج: <strong>${Math.round(avgHusband * 100)}%</strong><br/>
• الدرجة النهائية للتشابه: <strong>${Math.round(avgOverall * 100)}%</strong><br/><br/>

<strong>مستوى الثقة:</strong> <strong>${confidenceScore}%</strong><br/><br/>

<strong>تقييم خبير:</strong><br/>
${expertNote}<br/><br/>

<strong>القرار النهائي:</strong> ${decision}
`;

  return { summaryHtml, confidenceScore, avgWoman, avgHusband };
}
