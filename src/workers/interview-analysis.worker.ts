// src/workers/interview-analysis.worker.ts
import dayjs from 'dayjs';

// --- START: Copied Normalization Logic ---
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
// --- END: Copied Normalization Logic ---


self.onmessage = async (event) => {
    const { educators, uploadedData, mapping, absentees } = event.data;

    try {
        const absenteeSet = new Set(absentees);

        // Find which column name corresponds to 'applicant_id'
        const mappingMap = new Map(Object.entries(mapping));
        let applicantIdColumn: string | undefined;
        for (const [key, value] of mappingMap.entries()) {
            if (value === 'applicant_id') {
                applicantIdColumn = key;
                break;
            }
        }
        
        if (!applicantIdColumn) {
            throw new Error("Mapping for 'applicant_id' is missing.");
        }
        
        // Create a map from applicant_id -> row data from the uploaded file
        const mappedUploadedData = new Map(uploadedData.map((row: any) => [String(row[applicantIdColumn!]), row]));

        let processedEducators = educators.map((edu: any) => {
            if (edu.interview_qualification !== 'مؤهلة للمقابلة') {
                return edu;
            }
            
            const attended = !absenteeSet.has(edu.applicant_id);
            edu.interview_attendance = attended ? 'حظرت المقابلة' : 'غائبة من المقابلة';
            
            if (attended) {
                const interviewData = mappedUploadedData.get(String(edu.applicant_id));
                if (interviewData) {
                     mappingMap.forEach((dbCol: string, fileCol: string) => {
                        if(dbCol !== 'applicant_id') {
                            edu[dbCol] = interviewData[fileCol];
                        }
                    });
                }
                
                edu.sfd_marks = Number(edu.sfd_marks) || 0;
                edu.health_marks = Number(edu.health_marks) || 0;
                edu.local_community_marks = Number(edu.local_community_marks) || 0;
                
                edu.interview_total_marks = edu.sfd_marks + edu.health_marks + edu.local_community_marks;
                edu.grand_total_score = edu.interview_total_marks + (Number(edu.total_score) || 0);
                edu.training_qualification = undefined;

                if (edu.interview_total_marks < 15) {
                    edu.grand_total_score = 0;
                    edu.training_qualification = 'غير مؤهلة للتدريب';
                    edu.disqualified_reasons = 'رسوب في المقابلة';
                }
            } else {
                // If absent, reset scores
                edu.sfd_marks = 0;
                edu.health_marks = 0;
                edu.local_community_marks = 0;
                edu.interview_total_marks = 0;
                edu.grand_total_score = 0;
                edu.grand_score_rank = 0;
                edu.training_qualification = 'غير مؤهلة للتدريب';
                edu.disqualified_reasons = 'غائبة من المقابلة';
            }
            return edu;
        });
        
        // Relationship clustering and Ranking
        const attendedApplicants = processedEducators.filter((edu: any) => edu.interview_attendance === 'حظرت المقابلة');
        
        // Relationship Clustering
        const applicantNameParts = new Map(attendedApplicants.map(app => [app.applicant_id, normalizeArabicWithCompounds(app.applicant_name).split(' ')]));
        
        // sisters
        const sisterGroups = new Map<string, any[]>();
        attendedApplicants.forEach(app => {
            const parts = applicantNameParts.get(app.applicant_id);
            if (parts && parts.length >= 4) {
                const key = `${parts[1]}|${parts[2]}|${parts[3]}`;
                if (!sisterGroups.has(key)) sisterGroups.set(key, []);
                sisterGroups.get(key)!.push(app);
            }
        });
        
        sisterGroups.forEach(group => {
            if (group.length > 1) {
                const names = group.map((app, i) => `${i + 1}- ${app.applicant_name}`).join(', ');
                const sameLoc = new Set(group.map(app => app.loc_id)).size === 1;
                const reason = sameLoc ? `هنالك علاقة اسرية (خوات) بين المتقدمات في نفس القرية: ${names}` : `هنالك علاقة اسرية (خوات) بين المتقدمات في قرى مختلفة: ${names}`;
                group.forEach(app => app.applcants_relationship = reason);
            }
        });

        // cousins
        const cousinGroups = new Map<string, any[]>();
         attendedApplicants.forEach(app => {
            const parts = applicantNameParts.get(app.applicant_id);
             if (parts && parts.length >= 4) {
                const key = `${parts[2]}|${parts[3]}`;
                if (!cousinGroups.has(key)) cousinGroups.set(key, []);
                cousinGroups.get(key)!.push(app);
            }
        });
        
        cousinGroups.forEach(group => {
             if (group.length > 1) {
                const fatherNames = new Set(group.map(app => applicantNameParts.get(app.applicant_id)![1]));
                if(fatherNames.size > 1) { // They are not sisters
                    const sameLoc = new Set(group.map(app => app.loc_id)).size === 1;
                    const names = group.map((app, i) => `${i + 1}- ${app.applicant_name}`).join(', ');
                    const reason = sameLoc ? `هنالك علاقة اسرية (بنات عم) بين المتقدمات في نفس القرية: ${names}` : `هنالك علاقة اسرية (بنات عم) بين المتقدمات في قرى مختلفة: ${names}`;
                    group.forEach(app => {
                        if(!app.applcants_relationship) { // Don't overwrite sister relationship
                             app.applcants_relationship = reason;
                        }
                    });
                }
             }
        });

        // Ranking
        const locationGroups: Record<string, any[]> = {};
        attendedApplicants.forEach(app => {
            const locId = app.loc_id || 'UNKNOWN';
            if (!locationGroups[locId]) locationGroups[locId] = [];
            locationGroups[locId].push(app);
        });

        Object.values(locationGroups).forEach(group => {
            group.sort((a, b) => (b.grand_total_score || 0) - (a.grand_total_score || 0));
            group.forEach((app, index) => {
                if(app.interview_total_marks < 15) {
                    app.grand_score_rank = 0;
                } else {
                    app.grand_score_rank = index + 1;
                }
            });
        });
        
        const totalAttended = attendedApplicants.length;
        const totalAbsent = absenteeSet.size;
        const totalPassed = processedEducators.filter(e => e.training_qualification === 'مؤهلة للتدريب').length;
        const totalFailed = processedEducators.filter(e => e.training_qualification === 'غير مؤهلة للتدريب').length;


        postMessage({ type: 'done', data: {
            results: processedEducators,
            totalAttended,
            totalAbsent,
            totalPassed,
            totalFailed,
        }});
    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};
