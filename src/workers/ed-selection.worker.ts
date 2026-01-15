
// src/workers/ed-selection.worker.ts
import dayjs from 'dayjs';

// --- Normalization & Similarity (same as cluster worker) ---
function baseArabicNormalize(value: any): string {
    if (!value) return "";
    let s = String(value).normalize("NFKC").replace(/يحيي/g, "يحي").replace(/يحيى/g, "يحي").replace(/عبد /g, "عبد").replace(/[ًٌٍَُِّْـء]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه").replace(/گ/g, "ك").replace(/\s+/g, " ").replace(/[^ء-ي0-9a-zA-Z\s]/g, " ").trim().toLowerCase();
    return s;
}

const FIXED_COMPOUND_NAMES = ["عبد الله", "عبد الرحمن", "عبد الرحيم", "عبد الكريم", "عبد العزيز", "عبد الملك", "عبد السلام", "عبد القادر", "عبد الجليل", "عبد الرزاق", "عبد الغني", "عبد الوهاب", "عبد الاله", "عبد الواحد", "عبد الماجد", "امه الله", "امه الرحمن", "امه الرحيم", "امه الكريم", "صنع الله", "عطاء الله", "نور الله", "فتح الله", "نصر الله", "فضل الله", "رحمه الله", "حسب الله", "جود الله", "نور الدين", "شمس الدين", "سيف الدين", "زين الدين", "جمال الدين", "كمال الدين", "صلاح الدين", "علاء الدين", "تقي الدين", "نجم الدين", "ابو بكر", "ابو طالب", "ابو هريره", "ام كلثوم", "ام سلمه", "ام حبيبه", "ابن تيميه", "ابن سينا", "ابن خلدون", "ابن رشد", "بنت الشاطئ"];
const PREFIX_COMPOUND_RULES: RegExp[] = [/^امه\s+[ء-ي]{3,}$/, /^ابو\s+[ء-ي]{3,}$/, /^ام\s+[ء-ي]{3,}$/, /^ابن\s+[ء-ي]{3,}$/, /^بنت\s+[ء-ي]{3,}$/, /^[ء-ي]{3,}\s+الدين$/, /^[ء-ي]{3,}\s+الله$/];

function normalizeArabicWithCompounds(value: any): string {
    let s = baseArabicNormalize(value);
    for (const name of FIXED_COMPOUND_NAMES) {
        const normalized = baseArabicNormalize(name);
        const re = new RegExp(normalized.replace(" ", "\\s*"), "g");
        s = s.replace(re, normalized.replace(" ", "_"));
    }
    const parts = s.split(" ");
    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1) {
            const pair = `${parts[i]} ${parts[i + 1]}`;
            if (PREFIX_COMPOUND_RULES.some((r) => r.test(pair))) {
                result.push(pair.replace(" ", "_"));
                i++;
                continue;
            }
        }
        result.push(parts[i]);
    }
    return result.join(" ");
}

function processRecords(rows: any[], mapping: any, recipientsDate: string) {
  const refDate = dayjs(recipientsDate).toDate();

  const records = rows.map(r => ({
    ...r,
    _birth: dayjs(r[mapping.birthDate]).toDate(),
    _nameNorm: normalizeArabicWithCompounds(r[mapping.applicantName]),
    _id: r[mapping.applicantId],
    _village: r[mapping.village],
    _qualification: r[mapping.qualification] || "بدون",
    _idType: (r[mapping.idType] || '').trim(),
    _experience: (r[mapping.previousExperience] || '').trim(),
  }));

  // --- AGE ---
  records.forEach(r => {
    const diffMs = refDate.getTime() - r._birth.getTime();
    r["Age in days"] = diffMs / 86400000;
    r["Age in Years"] = +(r["Age in days"] / 365.25).toFixed(2);
  });

  // --- DUPLICATES ---
  const groups: Record<string, any[]> = {};
  records.forEach(r => {
    groups[r._nameNorm] = groups[r._nameNorm] || [];
    groups[r._nameNorm].push(r);
  });

  Object.values(groups).forEach(g => {
    if (g.length > 1) {
      const minId = Math.min(...g.map(x => x._id));
      const maxId = Math.max(...g.map(x => x._id));
      g.forEach(r => {
        if (r._id !== minId) {
          r["Duplicated Applicant"] = `متقدمة متكررة مع ${minId} ${g[0][mapping.applicantName]}`;
        }
        r["Duplicated Applicant Cluster ID"] = maxId;
      });
    }
  });

  // --- DIPLOMA ---
  records.forEach(r => {
    const s = dayjs(r[mapping.diplomaStartDate]).toDate();
    const e = dayjs(r[mapping.diplomaEndDate]).toDate();
    if (s && e) {
      const d = (e.getTime() - s.getTime()) / 86400000;
      r["Diploma in days"] = d;
      r["Diploma in Years"] = +(d / 365.25).toFixed(2);
    }
  });

  // --- AGE RANK PER VILLAGE ---
  const villageGroups: any = {};
  records.forEach(r=>{
    if(!villageGroups[r._village]) villageGroups[r._village]=[];
    villageGroups[r._village].push(r);
  });

  Object.values(villageGroups).forEach((list:any)=>{
    list.sort((a:any,b:any)=>b["Age in days"]-a["Age in days"]);
    list.forEach((r:any,i:number)=>{
       if (r["Age in Years"] < 18 || r["Age in Years"] > 35 || r._qualification === "بدون" || r["Duplicated Applicant"]) {
        r["Age per village Ranking"] = 0;
       } else {
        r["Age per village Ranking"] = i + 1;
       }
    });
  });

  // --- SCORING ---
  records.forEach(r=>{
    const invalid =
      r["Age in Years"]<18 ||
      r["Age in Years"]>35 ||
      r._qualification==="بدون" ||
      r["Duplicated Applicant"];

    r["Qualification Score"] = invalid ? 0 :
      r._qualification==="بكالوريوس" ? 5 :
      r._qualification==="دبلوم" ?
        (r["Diploma in Years"]>=1.5?3:2) :
      r._qualification==="ثانوية" ? 2 : 0;

    r["Identity Score"] = invalid ? 0 :
      ["بطاقه شخصيه","بطاقة شخصية","جواز سفر"].includes(r._idType) ? 2 : 0;

    r["Previous Experience Score"] = invalid ? 0 :
      ["نعم","1"].includes(r._experience) ? 3 : 0;

    r["Applicants Total Score"] =
      r["Qualification Score"] +
      r["Identity Score"] +
      r["Previous Experience Score"];

    r["Acceptance Statement"] =
      r["Applicants Total Score"] > 0 ? "مقبولة" : "غير مقبولة";
  });

  // --- DISQUALIFICATION REASON ---
  records.forEach(r => {
    const reasons: string[] = [];
    if (r["Age in Years"] < 18) {
      reasons.push("تم الاستبعاد بسبب العمر اقل من ١٨ سنة");
    }
    if (r["Age in Years"] > 35) {
      reasons.push("تم الاستبعاد بسبب العمر اكبر من ٣٥ سنة");
    }
    if (r._qualification === "بدون") {
      reasons.push("تم الاستبعاد بسبب عدم وجود مؤهل تعليمي");
    }
    if (r["Duplicated Applicant"]) {
      reasons.push("تكرار في التقديم");
    }
    r["Disqualification Reason"] =
      reasons.length > 0 ? reasons.join(" + ") : "";
  });
  return records;
}

self.onmessage = async (event) => {
    const { rows, mapping, recipientsDate, projectName } = event.data;
    try {
        postMessage({ type: 'progress', status: 'processing', progress: 10 });

        const finalResults = processRecords(rows, mapping, recipientsDate);

        postMessage({ type: 'progress', status: 'processing', progress: 70 });

        let totalAccepted = finalResults.filter(r => r["Acceptance Statement"] === 'مقبولة').length;
        
        postMessage({ type: 'progress', status: 'saving', progress: 90 });

        const output = {
            projectName,
            processedAt: new Date().toISOString(),
            totalApplicants: finalResults.length,
            totalAccepted,
            totalUnaccepted: finalResults.length - totalAccepted,
            results: finalResults,
        };
        
        const url = new URL('/api/ed-selection', self.location.origin);
        await fetch(url.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(output)
        });

        postMessage({ type: 'done', data: output });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};
