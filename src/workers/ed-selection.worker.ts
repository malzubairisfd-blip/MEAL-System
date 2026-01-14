"use client";
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

self.onmessage = async (event) => {
    const { rows, mapping, recipientsDate, projectName } = event.data;
    try {
        postMessage({ type: 'progress', status: 'processing', progress: 10 });

        const processedRows = rows.map((row: any, index: number) => {
            let ageInYears = 0;
            let ageInDays = 0;
            const birthDate = dayjs(row[mapping.birthDate]);
            const recipientDateObj = dayjs(recipientsDate);
            if (birthDate.isValid() && recipientDateObj.isValid()) {
                ageInYears = recipientDateObj.diff(birthDate, 'year', true);
                ageInDays = recipientDateObj.diff(birthDate, 'day');
            }

            let diplomaInDays = 0;
            let diplomaInYears = 0;
            const diplomaStart = dayjs(row[mapping.diplomaStartDate]);
            const diplomaEnd = dayjs(row[mapping.diplomaEndDate]);
            if (diplomaStart.isValid() && diplomaEnd.isValid()) {
                diplomaInDays = diplomaEnd.diff(diplomaStart, 'day');
                diplomaInYears = diplomaEnd.diff(diplomaStart, 'year', true);
            }
            
            return {
                ...row,
                _internalId: `applicant_${index}`,
                'Age in Years': ageInYears,
                'Age in days': ageInDays,
                'Diploma in days': diplomaInDays,
                'Diploma in Years': diplomaInYears,
                'Normalized Applicant Name': normalizeArabicWithCompounds(row[mapping.applicantName])
            };
        });

        postMessage({ type: 'progress', status: 'processing', progress: 30 });
        
        // Duplicate Analysis
        const nameToApplicants = new Map<string, any[]>();
        processedRows.forEach(row => {
            const name = row['Normalized Applicant Name'];
            if (!nameToApplicants.has(name)) {
                nameToApplicants.set(name, []);
            }
            nameToApplicants.get(name)!.push(row);
        });

        nameToApplicants.forEach(applicants => {
            if (applicants.length > 1) {
                applicants.sort((a, b) => (a[mapping.applicantId] || 0) - (b[mapping.applicantId] || 0));
                const masterApplicant = applicants[0];
                const clusterId = Math.max(...applicants.map(a => a[mapping.applicantId]));
                applicants.forEach(applicant => {
                    applicant['Duplicated Applicant Cluster ID'] = clusterId;
                    if (applicant._internalId !== masterApplicant._internalId) {
                         applicant['Duplicated Applicant'] = `متقدمة متكررة مع ${masterApplicant[mapping.applicantId]} ${masterApplicant[mapping.applicantName]}`;
                    }
                });
            }
        });
        
        postMessage({ type: 'progress', status: 'processing', progress: 50 });

        // Scoring and Ranking
        const villageGroups = new Map<string, any[]>();
        processedRows.forEach(row => {
            const village = row[mapping.village];
            if (!villageGroups.has(village)) {
                villageGroups.set(village, []);
            }
            villageGroups.get(village)!.push(row);
        });

        villageGroups.forEach(applicants => {
            applicants.sort((a, b) => b['Age in days'] - a['Age in days']);
            applicants.forEach((applicant, index) => {
                const isDisqualifiedByAge = applicant['Age in Years'] < 18.0 || applicant['Age in Years'] > 35.0;
                const isDisqualifiedByQualification = (applicant[mapping.qualification] || '').trim() === 'بدون';
                const isDisqualifiedByDuplication = !!applicant['Duplicated Applicant'];

                if (isDisqualifiedByAge || isDisqualifiedByQualification || isDisqualifiedByDuplication) {
                    applicant['Age per village Ranking'] = 0;
                } else {
                    applicant['Age per village Ranking'] = index + 1;
                }
            });
        });

        postMessage({ type: 'progress', status: 'processing', progress: 70 });

        let totalAccepted = 0;
        const finalResults = processedRows.map(row => {
             const isDisqualifiedByAge = row['Age in Years'] < 18.0 || row['Age in Years'] > 35.0;
             const isDisqualifiedByQualification = (row[mapping.qualification] || '').trim() === 'بدون';
             const isDisqualifiedByDuplication = !!row['Duplicated Applicant'];

             let qualificationScore = 0;
             let identityScore = 0;
             let experienceScore = 0;
             
             if (!isDisqualifiedByAge && !isDisqualifiedByQualification && !isDisqualifiedByDuplication) {
                const qual = (row[mapping.qualification] || '').trim();
                if (qual === 'بكالوريوس') {
                    qualificationScore = 5;
                } else if (qual === 'دبلوم') {
                    qualificationScore = row['Diploma in Years'] >= 1.5 ? 3 : 2;
                } else if (qual === 'ثانوية') {
                    qualificationScore = 2;
                }

                const idType = (row[mapping.idType] || '').trim();
                if (['بطاقه شخصيه', 'بطاقة شخصية', 'جواز سفر'].includes(idType)) {
                    identityScore = 2;
                }
                
                const exp = (row[mapping.previousExperience] || '').trim();
                if (exp === 'نعم' || exp === '1') {
                    experienceScore = 3;
                }
             }

             const totalScore = qualificationScore + identityScore + experienceScore;
             const acceptance = totalScore > 0 ? 'مقبولة' : 'غير مقبولة';
             if (acceptance === 'مقبولة') totalAccepted++;

             let disqualificationReasons = [];
             if (row['Age in Years'] < 18.0) disqualificationReasons.push('تم الاستبعاد بسبب العمر اقل من ١٨ سنة');
             if (row['Age in Years'] > 35.0) disqualificationReasons.push('تم الاستبعاد بسبب العمر اكبر من ٣٥ سنة');
             if (isDisqualifiedByQualification) disqualificationReasons.push('تم الاستبعاد بسبب عدم وجود مؤهل تعليمي');
             if (isDisqualifiedByDuplication) disqualificationReasons.push('تكرار في التقديم');


            return {
                ...row,
                'Qualification Score': qualificationScore,
                'Identity Score': identityScore,
                'Previous Experience Score': experienceScore,
                'Applicants Total Score': totalScore,
                'Acceptance Statement': acceptance,
                'Disqualification Reason': disqualificationReasons.join(' + ')
            };
        });
        
        postMessage({ type: 'progress', status: 'saving', progress: 90 });

        const output = {
            projectName,
            processedAt: new Date().toISOString(),
            totalApplicants: finalResults.length,
            totalAccepted,
            totalUnaccepted: finalResults.length - totalAccepted,
            results: finalResults,
        };

        // This is where you would typically post to an API
        // For now we'll just return the data to the main thread
        await fetch('/api/ed-selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(output)
        });

        postMessage({ type: 'done', data: output });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};
