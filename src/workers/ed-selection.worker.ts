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

function excelSerialToDate(value: any): Date | null {
  if (value === null || value === undefined || value === "") return null;

  // Already a JS Date
  if (value instanceof Date) return value;

  // Excel serial number (most important case)
  if (typeof value === "number") {
    // Excel epoch: 1899-12-30
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  // String date fallback
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}


function processRecords(rows: any[], recipientsDateStr: string, projects: any[], locations: any[], selectedProjectId: string) {
  const selectedRecipientsDate = excelSerialToDate(recipientsDateStr);
  
  const selectedProject = projects.find(p => p.projectId === selectedProjectId);

  // For faster lookups
  const locationMap = new Map<string, any>();
  if (locations && Array.isArray(locations)) {
    locations.forEach(loc => {
      // Key format: gov_name|mud_name|ozla_name|vill_name
      const key = `${baseArabicNormalize(loc.gov_name)}|${baseArabicNormalize(loc.mud_name)}|${baseArabicNormalize(loc.ozla_name)}|${baseArabicNormalize(loc.vill_name)}`;
      locationMap.set(key, loc);
    });
  }

  const records = rows.map(r => {
    // Enrich with project and office data
    if (selectedProject) {
        r.project_id = selectedProject.projectId;
        r.project_name = selectedProject.projectName;
    }
    r.office_no = 2;
    
    // Enrich with location data
    const rowLocKey = `${baseArabicNormalize(r.gov_name)}|${baseArabicNormalize(r.mud_name)}|${baseArabicNormalize(r.ozla_name)}|${baseArabicNormalize(r.loc_name)}`;
    const matchedLoc = locationMap.get(rowLocKey);
    if(matchedLoc){
        r.gov_loc_id = matchedLoc.gov_loc_id;
        r.mud_loc_id = matchedLoc.mud_loc_id;
        r.ozla_loc_id = matchedLoc.ozla_loc_id;
        r.loc_id = matchedLoc.vill_loc_id;
    }
      
    r._nameNorm = normalizeArabicWithCompounds(r.applicant_name);
    return r;
  });

  // --- AGE ---
  records.forEach(r => {
    const birthDate = excelSerialToDate(r.birth_date);
    if (birthDate && selectedRecipientsDate) {
      const diffMs = selectedRecipientsDate.getTime() - birthDate.getTime();
      r.age_days = diffMs / 86400000;
      r.age_years = +(r.age_days / 365.2425).toFixed(2);
    } else {
      r.age_days = 0;
      r.age_years = 0;
    }
  });

  // --- DUPLICATES ---
  const groups: Record<string, any[]> = {};
  records.forEach(r => {
    groups[r._nameNorm] = groups[r._nameNorm] || [];
    groups[r._nameNorm].push(r);
  });

  Object.values(groups).forEach(g => {
    if (g.length > 1) {
      const minId = Math.min(...g.map(x => x.applicant_id));
      const maxId = Math.max(...g.map(x => x.applicant_id));
      g.forEach(r => {
        if (r.applicant_id !== minId) {
          r.duplicated_applicants = `متقدمة متكررة مع ${minId} ${g[0].applicant_name}`;
        }
        r.duplicated_cluster_id = maxId;
      });
    }
  });

  // --- DIPLOMA ---
  records.forEach(r => {
    const s = excelSerialToDate(r.diploma_starting_date);
    const e = excelSerialToDate(r.diploma_end_date);
    if (s && e) {
      const d = (e.getTime() - s.getTime()) / 86400000;
      r.diploma_duration_days = d;
      r.diploma_duration_years = +(d / 365.25).toFixed(2);
    }
  });

  // --- AGE RANK PER VILLAGE ---
  const villageGroups: any = {};
  records.forEach(r=>{
    if(!villageGroups[r.village]) villageGroups[r.village]=[];
    villageGroups[r.village].push(r);
  });

  Object.values(villageGroups).forEach((list:any)=>{
    list.sort((a:any,b:any)=>b.age_days-a.age_days);
    list.forEach((r:any,i:number)=>{
       if (r.age_years < 18 || r.age_years > 35 || r.applicant_qualification === "بدون" || r.duplicated_applicants) {
        r.age_per_village_ranking = 0;
       } else {
        r.age_per_village_ranking = i + 1;
       }
    });
  });

  // --- SCORING ---
  records.forEach(r=>{
    const invalid =
      r.age_years<18 ||
      r.age_years>35 ||
      r.applicant_qualification==="بدون" ||
      r.duplicated_applicants;

    r.qualification_score = invalid ? 0 :
      r.applicant_qualification==="بكالوريوس" ? 5 :
      r.applicant_qualification==="دبلوم" ?
        (r.diploma_duration_years>=1.5?3:2) :
      r.applicant_qualification==="ثانوية" ? 2 : 0;

    r.id_score = invalid ? 0 :
      ["بطاقه شخصيه","بطاقة شخصية","جواز سفر"].includes(r.id_type) ? 2 : 0;

    r.previous_experience_score = invalid ? 0 :
      ["نعم","1"].includes(r.previous_experience) ? 3 : 0;

    r.total_score =
      r.qualification_score +
      r.id_score +
      r.previous_experience_score;

    r.acceptance_results =
      r.total_score > 0 ? "مقبولة" : "غير مقبولة";
  });

  // --- DISQUALIFICATION REASON ---
  records.forEach(r => {
    const reasons: string[] = [];
    if (r.age_years < 18 && r.age_years > 0) {
      reasons.push("تم الاستبعاد بسبب العمر اقل من ١٨ سنة");
    }
    if (r.age_years > 35) {
      reasons.push("تم الاستبعاد بسبب العمر اكبر من ٣٥ سنة");
    }
    if (r.applicant_qualification === "بدون") {
      reasons.push("تم الاستبعاد بسبب عدم وجود مؤهل تعليمي");
    }
    if (r.duplicated_applicants) {
      reasons.push("تكرار في التقديم");
    }
    r.disqualification_reason = reasons.length > 0 ? reasons.join(" + ") : "";
  });

  return records;
}

self.onmessage = async (event) => {
    const { rows, recipientsDate, projects, locations, selectedProjectId } = event.data;
    try {
        postMessage({ type: 'progress', status: 'processing', progress: 10 });

        const finalResults = processRecords(rows, recipientsDate, projects, locations, selectedProjectId);

        postMessage({ type: 'progress', status: 'processing', progress: 90 });

        const totalAccepted = finalResults.filter(r => r.acceptance_results === 'مقبولة').length;
        
        const output = {
            totalApplicants: finalResults.length,
            totalAccepted,
            totalUnaccepted: finalResults.length - totalAccepted,
            results: finalResults,
        };
        
        postMessage({ type: 'done', data: { ...output, selectedProjectId } });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};
