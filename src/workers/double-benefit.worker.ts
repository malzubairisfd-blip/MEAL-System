// src/workers/double-benefit.worker.ts
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';

// --- Normalization Logic ---
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

const digitsOnly = (value: any) => (value === undefined || value === null) ? "" : String(value).replace(/\D/g, "");

// --- Scoring Logic ---
function calculateSimilarity(educator: any, beneficiary: any, mapping: any) {
    const normEdName = normalizeArabicWithCompounds(educator[mapping.educatorName]);
    const normBnfName = normalizeArabicWithCompounds(beneficiary[mapping.beneficiaryName]);
    
    const edNameParts = normEdName.split(' ');
    const bnfNameParts = normBnfName.split(' ');
    
    const nameScore = nameOrderFreeScore(edNameParts, bnfNameParts);

    const edId = String(educator[mapping.educatorId] || '').trim();
    const bnfId = String(beneficiary[mapping.beneficiaryId] || '').trim();
    let idScore = 0;
    if (edId && bnfId) {
        idScore = edId === bnfId ? 1 : (edId.slice(-6) === bnfId.slice(-6) ? 0.8 : 0);
    }

    const edPhones = String(educator[mapping.educatorPhone] || '').split(/[-,]/).map(p => digitsOnly(p));
    const bnfPhone = digitsOnly(beneficiary[mapping.beneficiaryPhone]);
    let phoneScore = 0;
    if (bnfPhone) {
        for (const edPhone of edPhones) {
            if (edPhone === bnfPhone) {
                phoneScore = 1;
                break;
            }
            if (edPhone.slice(-7) === bnfPhone.slice(-7)) {
                phoneScore = Math.max(phoneScore, 0.9);
            }
        }
    }
    
    // Weighted score
    return (nameScore * 0.5) + (idScore * 0.3) + (phoneScore * 0.2);
}

self.onmessage = async (event) => {
    const { educators, beneficiaries, mapping } = event.data;
    
    try {
        const potentialDuplicates: any[] = [];

        // Filter educators to only include community educators
        const communityEducators = educators.filter((edu: any) => edu.contract_type === 'مثقفة مجتمعية');

        // Simple blocking strategy: match on first 3 chars of normalized name
        const bnfMap = new Map<string, any[]>();
        beneficiaries.forEach((bnf: any) => {
            const name = normalizeArabicWithCompounds(bnf[mapping.beneficiaryName]);
            if (name.length >= 3) {
                const key = name.substring(0, 3);
                if (!bnfMap.has(key)) bnfMap.set(key, []);
                bnfMap.get(key)!.push(bnf);
            }
        });

        // Use the filtered list of educators
        communityEducators.forEach((edu: any) => {
            const name = normalizeArabicWithCompounds(edu[mapping.educatorName]);
            if (name.length >= 3) {
                const key = name.substring(0, 3);
                if (bnfMap.has(key)) {
                    const candidates = bnfMap.get(key)!;
                    candidates.forEach(bnf => {
                        const score = calculateSimilarity(edu, bnf, mapping);
                        if (score > 0.6) { // Similarity threshold
                            potentialDuplicates.push({ score, educator: edu, beneficiary: bnf });
                        }
                    });
                }
            }
        });

        postMessage({ type: 'done', data: potentialDuplicates });
    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};
