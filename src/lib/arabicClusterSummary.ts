
// src/lib/arabicClusterSummary.ts

const getScoreColor = (score?: number) => {
    if (score === undefined) return "color: #4B5563"; // gray-600
    if (score >= 90) return "color: #DC2626"; // red-600
    if (score >= 75) return "color: #F97316"; // orange-500
    if (score >= 60) return "color: #2563EB"; // blue-600
    return "color: #4B5563"; // gray-600
};

export function getDecisionAndNote(confidenceScore: number) {
  let decision = "إحتمالية تكرار";
  let expertNote = "قد يكون هنالك إحتمالية لوجود تكرار نتيجة لتطابق بعض اجزاء من الاسم للمستفيدة او الزوج. يوصى بالتحقق المكتبي من المجموعة.";

  if (confidenceScore >= 85) {
    decision = "تكرار مؤكد";
    expertNote =
      "يوجد تطابق شامل في الأسماء والنسب مع احتمالية عالية أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وابقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج.";
  } else if (confidenceScore >= 70) {
    decision = "اشتباه تكرار مؤكد";
    expertNote =
      "يوجد تشابه مرتفع في الأسماء والنسب مع احتمالية مرتفعة أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وفي حال كان هنالك حالات تكرار يتم إبقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج او يتم تعليق المجموعه للتحقق الميداني.";
  } else if (confidenceScore >= 60) {
    decision = "اشتباه تكرار";
    expertNote =
      "يوجد تشابه جزئي، وقد يكون ناتجًا عن تشابه أسماء شائع في المنطقة. يوصى بالتحقق المكتبي والميداني من المجموعة.";
  }
  return { decision, expertNote };
}


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
  const avgFinal = cluster.avgFinalScore || 0;

  const womanScorePct = Math.round(avgWoman * 100);
  const husbandScorePct = Math.round(avgHusband * 100);
  const finalScorePct = Math.round(avgFinal * 100);

  const confidenceScore = cluster.confidence || 0;


  /* --------------------------------------------------
     3️⃣ EXPERT EVALUATION (HUMAN-LIKE DECISION)
  -------------------------------------------------- */
  const { decision, expertNote } = getDecisionAndNote(confidenceScore);


  /* --------------------------------------------------
     4️⃣ FINAL ARABIC SUMMARY (HTML SAFE)
  -------------------------------------------------- */
  const summaryHtml = `النتيجة العامة:<br>تم تجميع <strong>${size}</strong> سجلات يُحتمل أنها تمثل نفس المستفيد أو نفس الأسرة.<br><br>مستوى الثقة: <strong style="${getScoreColor(confidenceScore)}">${confidenceScore}%</strong><br><br>تحليل درجات التشابه:<br>• متوسط تشابه اسم المرأة: <strong style="${getScoreColor(womanScorePct)}">${womanScorePct}%</strong><br>• متوسط تشابه اسم الزوج: <strong style="${getScoreColor(husbandScorePct)}">${husbandScorePct}%</strong><br>• الدرجة النهائية للتشابه: <strong style="${getScoreColor(finalScorePct)}">${finalScorePct}%</strong><br><br>أسباب التجميع:<br>${explanations.map(e => `• ${e}`).join("<br>") || "• تحليل التشابه العام"}<br><br>تقييم خبير:<br>${expertNote}<br><br>القرار النهائي: ${decision}`;

  return summaryHtml;
}
