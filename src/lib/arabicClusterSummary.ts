
// src/lib/arabicClusterSummary.ts
export function generateArabicClusterSummary(cluster: any, rows: any[]) {
  const reasons: string[] = cluster.reasons || [];
  const size = rows.length;

  const explanations: string[] = [];

  // تحليل كل سبب
  if (reasons.includes("DUPLICATED_HUSBAND_LINEAGE")) {
    explanations.push(
      "تشابه واضح في أسماء الأزواج (الاسم الأول، الأب، والجد) مع اختلافات إملائية بسيطة."
    );
  }

  if (reasons.includes("WOMAN_LINEAGE_MATCH")) {
    explanations.push(
      "تشابه في نسب المرأة (اسم الأب واسم الجد واسم العائلة) مع اختلاف بسيط في الاسم الأول."
    );
  }

  if (reasons.includes("TOKEN_REORDER")) {
    explanations.push(
      "اختلافات في ترتيب أجزاء الاسم أو وجود أجزاء مكررة بسبب أخطاء إدخال البيانات."
    );
  }

  if (reasons.includes("POLYGAMY_PATTERN")) {
    explanations.push(
      "نمط تعدد زوجات محتمل ضمن الحدود المسموح بها، مع احتمال تسجيل الأسرة أكثر من مرة."
    );
  }
  
  if (reasons.length === 0 && size > 1) {
    explanations.push("تشابه عام في تفاصيل السجلات بدون وجود قاعدة محددة قوية.");
  }


  // تحليل إضافي: الأرقام والهوية
  const examples: string[] = [];
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const r = rows[i];
    const parts = [];
    if (r.womanName) parts.push(`المرأة: ${r.womanName}`);
    if (r.husbandName) parts.push(`الزوج: ${r.husbandName}`);
    if (r.nationalId) parts.push(`الهوية: ${r.nationalId}`);
    if (r.phone) parts.push(`الهاتف: ${r.phone}`);
    examples.push(parts.join("، "));
  }

  // القرار النهائي
  let decision = "غير مكرر";
  if (reasons.includes("DUPLICATED_HUSBAND_LINEAGE") || reasons.includes("WOMAN_LINEAGE_MATCH") || reasons.includes("EXACT_ID")) {
    if (size > 1) {
      decision = "اشتباه تكرار";
      if (size > 2 || reasons.includes("TOKEN_REORDER")) {
        decision = "تكرار مؤكد";
      }
    }
  }

  return `
    <strong>النتيجة:</strong><br/>
    تم تجميع <strong>${size}</strong> سجلات تمثل على الأرجح نفس المستفيد أو نفس الأسرة.<br/><br/>
    <strong>الأسباب الرئيسية:</strong><br/>
    ${explanations.map(e => `• ${e}`).join("<br/>")}<br/><br/>
    <strong>أمثلة على السجلات:</strong><br/>
    ${examples.map(e => `• ${e}`).join("<br/>")}<br/><br/>
    <strong>القرار المبدئي:</strong> ${decision}
  `;
}
