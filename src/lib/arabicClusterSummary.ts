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
  const similarityScores: SimilarityScores[] = [];

  if (Array.isArray(cluster.pairScores)) {
    for (const s of cluster.pairScores) {
      similarityScores.push({
        womanName: s.womanNameScore,
        husbandName: s.husbandNameScore,
        overall: s.finalScore,
      });
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const avgWomanScore = avg(
    similarityScores.map(s => s.womanName ?? 0)
  );
  const avgHusbandScore = avg(
    similarityScores.map(s => s.husbandName ?? 0)
  );
  const avgOverallScore = avg(
    similarityScores.map(s => s.overall ?? 0)
  );

  /* --------------------------------------------------
     3️⃣ CONFIDENCE SCORE (0–100)
  -------------------------------------------------- */
  let confidenceScore = Math.round(avgOverallScore * 100);

  if (reasons.includes("DUPLICATED_HUSBAND_LINEAGE")) confidenceScore += 5;
  if (reasons.includes("WOMAN_LINEAGE_MATCH")) confidenceScore += 5;
  if (reasons.includes("TOKEN_REORDER")) confidenceScore += 3;

  confidenceScore = Math.min(confidenceScore, 100);

  /* --------------------------------------------------
     4️⃣ RECORD EXAMPLES (UNCHANGED + SAFE)
  -------------------------------------------------- */
  const examples: string[] = [];
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const r = rows[i];
    const parts = [];
    if (r.womanName) parts.push(`المرأة: ${r.womanName}`);
    if (r.husbandName) parts.push(`الزوج: ${r.husbandName}`);
    if (r.idNumber) parts.push(`الهوية: ${r.idNumber}`);
    if (r.phone) parts.push(`الهاتف: ${r.phone}`);
    examples.push(parts.join("، "));
  }

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
  return `
<strong>النتيجة العامة:</strong><br/>
تم تجميع <strong>${size}</strong> سجلات يُحتمل أنها تمثل نفس المستفيد أو نفس الأسرة.<br/><br/>

<strong>أسباب التجميع:</strong><br/>
${explanations.length ? explanations.map(e => `• ${e}`).join("<br/>") : "• لا توجد أسباب مسجلة"}<br/><br/>

<strong>تحليل درجات التشابه:</strong><br/>
• متوسط تشابه اسم المرأة: <strong>${Math.round(avgWomanScore * 100)}%</strong><br/>
• متوسط تشابه اسم الزوج: <strong>${Math.round(avgHusbandScore * 100)}%</strong><br/>
• الدرجة النهائية للتشابه: <strong>${Math.round(avgOverallScore * 100)}%</strong><br/><br/>

<strong>مستوى الثقة:</strong> <strong>${confidenceScore}%</strong><br/><br/>

<strong>تقييم خبير:</strong><br/>
${expertNote}<br/><br/>

<strong>أمثلة على السجلات:</strong><br/>
${examples.map(e => `• ${e}`).join("<br/>")}<br/><br/>

<strong>القرار النهائي:</strong> ${decision}
`;
}
