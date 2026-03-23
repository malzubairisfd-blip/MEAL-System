// lib/fullValidation.ts
import Database from "better-sqlite3";
import path from "path";

/* ================= DATABASES ================= */
const getDataPath = () => path.join(process.cwd(), 'src', 'data');

const getNamesDb = () => {
    const dbPath = path.join(getDataPath(), 'names.db');
    const db = new Database(dbPath);
    db.exec("CREATE TABLE IF NOT EXISTS names (name_key TEXT PRIMARY KEY, final_flag TEXT)");
    return db;
}

const getCmamDb = () => {
    const dbPath = path.join(getDataPath(), 'child-CMAM.db');
    try {
        return new Database(dbPath, { fileMustExist: true });
    } catch (error: any) {
        if (error.code === 'SQLITE_CANTOPEN') {
            const db = new Database(dbPath);
            db.exec(`CREATE TABLE IF NOT EXISTS child_cmam (id INTEGER PRIMARY KEY AUTOINCREMENT)`);
            db.close();
            return new Database(dbPath, { fileMustExist: true });
        }
        throw error;
    }
}

/* ================= NORMALIZATION ================= */
function baseArabicNormalize(value: any): string {
  if (!value) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/يحيي|يحيى/g, "يحي")
    .replace(/عبد\s+/g, "عبد")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك")
    .replace(/ء/g, "")
    .replace(/[^ء-ي\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSpace(v: string) {
  return v ? v.trim().replace(/\s+/g, " ") : "";
}

function compareArabicNames(a: string, b: string) {
  const na = baseArabicNormalize(a);
  const nb = baseArabicNormalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const aParts = na.split(" ");
  const bParts = nb.split(" ");
  let matches = 0;
  for (const pa of aParts) {
    for (const pb of bParts) {
      if (pa === pb) matches++;
    }
  }
  return matches / Math.max(aParts.length, bParts.length);
}

/* ================= DB FUNCTIONS ================= */
function checkNameGenderInDB(name: string, gender: "M" | "F"): { valid: boolean; flag?: string } {
  const normalized = baseArabicNormalize(name);
  const namesDB = getNamesDb();
  try {
      const row: any = namesDB.prepare("SELECT final_flag FROM names WHERE name_key = ? LIMIT 1").get(normalized);
      if (row) {
        const flags = row.final_flag.split(" "); 
        const valid = flags.includes(gender);
        return { valid, flag: row.final_flag };
      } else {
        namesDB.prepare("INSERT INTO names (name_key, final_flag) VALUES (?, ?)").run(normalized, gender);
        return { valid: true, flag: gender };
      }
  } finally {
      namesDB.close();
  }
}

function checkDuplicateChild(inputName: string, benef_id: string) {
  if (!inputName || !benef_id) return null;
  const cmamDB = getCmamDb();
  try {
      // Make sure this matches your actual schema column for first name
      const rows: any[] = cmamDB.prepare("SELECT child_first_name FROM child_cmam WHERE benef_id = ?").all(benef_id);
      let bestScore = 0;
      let bestMatch = "";

      for (const row of rows) {
        if (!row.child_first_name) continue;
        const score = compareArabicNames(inputName, row.child_first_name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = row.child_first_name;
        }
      }

      if (bestScore >= 0.9)
        return `الطفل مسجل مسبقاً (${bestMatch})`;
      if (bestScore >= 0.7)
        return `يوجد اسم مشابه (${bestMatch})`;

      return null;
  } catch (error: any) {
      if (error.code === 'SQLITE_ERROR' || error.code === 'SQLITE_CANTOPEN') return null;
      throw error;
  } finally {
      cmamDB.close();
  }
}

/* ================= MAIN VALIDATION FUNCTION ================= */
export function fullValidation({
  child_first_name,
  child_gender,
  benef_id,
}: {
  child_first_name: string;
  child_gender: "ذكر" | "أنثى";
  benef_id: string;
}) {
  const errors: string[] = [];
  if (!child_first_name) return errors;

  const name = child_first_name;
  const normalized = baseArabicNormalize(name);

  // ===== BASIC NAME VALIDATIONS =====
  if (name.startsWith(" ")) errors.push("الاسم يبدأ بمسافة");
  if (name.endsWith(" ")) errors.push("الاسم ينتهي بمسافة");
  if (normalizeSpace(name) !== name) errors.push("توجد اكثر من مسافة في منتصف الاسم");
  if (!/^[ء-ي\s]+$/.test(name)) errors.push("الاسم يجب الا يحتوي على حروف غير عربية");
  if (normalized.length < 3) errors.push("الاسم يجب ان يتكون من ثلاثة حروف على الأقل");
  if (normalized.length > 11) errors.push("عدد الاحرف يجب الا يزيد عن 11 حرف");
  if (/(.)\1{2,}/.test(normalized)) errors.push("توجد حروف مكررة أكثر من ثلاث مرات");

  // ===== GENDER VALIDATION =====
  const genderMap = { ذكر: "M", أنثى: "F" } as const;
  const selectedGender = genderMap[child_gender];
  try {
    const dbCheck = checkNameGenderInDB(name, selectedGender);
    if (!dbCheck.valid) {
        if (selectedGender === "M") errors.push("الاسم ليس مذكرا");
        if (selectedGender === "F") errors.push("الاسم ليس مؤنثا");
    }
  } catch (e: any) {
    console.warn("Could not validate gender:", e.message);
  }

  // ===== DUPLICATE CHECK =====
  try {
    const duplicateMsg = checkDuplicateChild(name, benef_id);
    if (duplicateMsg) errors.push(duplicateMsg);
  } catch(e: any) {
    console.warn("Could not check for duplicates:", e.message);
  }

  return errors;
}
