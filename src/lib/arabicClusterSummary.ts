
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

type ClusterSummaryData = {
  reasons?: string[];
  avgWomanNameScore?: number;
  avgHusbandNameScore?: number;
  avgFinalScore?: number;
  confidenceScore?: number;
}

const REASON_EXPLANATIONS: Record<string, string> = {
  SAME_HUSBAND_CHILDREN_OVERLAP: "تطابق تام لاسم الزوج مع وجود طفل واحد مشترك على الأقل.",
  CORE_WOMAN_AND_HUSBAND_LINEAGE_MATCH: "تطابق قوي في الأسماء الأولى والآباء والأجداد لكل من الزوجة والزوج.",
  FULL_WOMAN_AND_HUSBAND_MATCH: "تطابق شبه كامل في أسماء الزوجة والزوج وأنسابهم.",
  SAME_HUSBAND_WOMAN_VARIANT: "تطابق قوي في اسم الزوج مع تشابه في اسم الزوجة ونسبها.",
  DUPLICATED_HUSBAND_LINEAGE: "تطابق في اسم الزوج مع وجود تشابه في أسماء الأطفال.",
  WOMAN_LINEAGE_ONLY: "تشابه قوي في نسب المرأة مع اختلاف في اسم الزوج.",
  INVESTIGATION_PLACEHOLDER: "أحد السجلات يحتوي على كلمات مثل 'تحت التحقيق' مما يستدعي المراجعة.",
  POLYGAMY_SHARED_HOUSEHOLD: "نمط تعدد زوجات محتمل بناءً على تطابق اسم العائلة والزوج.",
  TOKEN_REORDER_LAST_RESORT: "تشابه كبير في الكلمات المكونة للأسماء مع اختلاف في الترتيب.",
  SHARED_HOUSEHOLD_SAME_HUSBAND: "تطابق قوي في اسم الزوج ونسبه مع تطابق في اسم العائلة للزوجة."
};


export function generateArabicClusterSummary(
  summaryData: ClusterSummaryData,
  rows: any[]
) {
  const reasons: string[] = summaryData.reasons || [];
  const size = rows.length;

  const explanations = Array.from(new Set(reasons))
        .map(reason => REASON_EXPLANATIONS[reason])
        .filter(Boolean);

  if (explanations.length === 0 && (summaryData.confidenceScore || 0) > 60) {
      explanations.push("تشابه عام في مكونات متعددة (أسماء، هوية، هاتف).");
  }

  const avgWoman = Number.isFinite(summaryData.avgWomanNameScore) ? Math.round(summaryData.avgWomanNameScore! * 100) : 0;
  const avgHusband = Number.isFinite(summaryData.avgHusbandNameScore) ? Math.round(summaryData.avgHusbandNameScore! * 100) : 0;
  const avgFinal = Number.isFinite(summaryData.avgFinalScore) ? Math.round(summaryData.avgFinalScore! * 100) : 0;
  const confidenceScore = Number.isFinite(summaryData.confidenceScore) ? Math.round(summaryData.confidenceScore!) : 0;

  const { decision, expertNote } = getDecisionAndNote(confidenceScore);

  const summaryHtml = `النتيجة العامة:<br>تم تجميع <strong>${size}</strong> سجلات يُحتمل أنها تمثل نفس المستفيد أو نفس الأسرة.<br><br>مستوى الثقة: <strong style="${getScoreColor(confidenceScore)}">${confidenceScore}%</strong><br><br>تحليل درجات التشابه:<br>• متوسط تشابه اسم المرأة: <strong style="${getScoreColor(avgWoman)}">${avgWoman}%</strong><br>• متوسط تشابه اسم الزوج: <strong style="${getScoreColor(avgHusband)}">${avgHusband}%</strong><br>• الدرجة النهائية للتشابه: <strong style="${getScoreColor(avgFinal)}">${avgFinal}%</strong><br><br>أسباب التجميع:<br>${explanations.map(e => `• ${e}`).join("<br>") || "• تحليل التشابه العام"}<br><br>تقييم خبير:<br>${expertNote}<br><br>القرار النهائي: ${decision}`;

  return summaryHtml;
}
