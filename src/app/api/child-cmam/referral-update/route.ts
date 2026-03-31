
import { NextResponse } from "next/server";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "child-CMAM.db");

// --- Helper Functions & Constants ---
const MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, أغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

function computeAgeDiff(confDate: Date, followUpMonthNumber: number) {
  if (!confDate || isNaN(confDate.getTime())) return 0;
  const followUpDate = new Date(confDate.getFullYear(), followUpMonthNumber - 1, 1);
  const diffMs = followUpDate.getTime() - confDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const rawMonths = Math.max(diffDays / 30, 0);
  const integerPart = Math.floor(rawMonths);
  const decimalPart = rawMonths - integerPart;
  return decimalPart >= 0.7 ? integerPart + 1 : integerPart;
}

function computeCureRate(record: any, prevCycle: number, currentCycle: number) {
  const measType = record[`meas_type_c${currentCycle}`] || record.meas_type;
  const prevMuac = Number(record[`muac_c${prevCycle}`] || 0);
  const currentMuac = Number(record[`muac_c${currentCycle}`] || 0);
  const prevZ = Number(record[`zscore_c${prevCycle}`] || 0);
  const currentZ = Number(record[`zscore_c${currentCycle}`] || 0);

  if (measType === "المواك") {
    if (currentMuac < prevMuac) return { cure: "Negative", negative: Number((prevMuac - currentMuac).toFixed(1)), positive: null };
    if (currentMuac === prevMuac) return { cure: "No Improvement", negative: null, positive: null };
    return { cure: "Positive", negative: null, positive: Number((currentMuac - prevMuac).toFixed(1)) };
  }

  if (measType === "الزد اسكور") {
    if (prevZ === -3 && currentZ === -2) return { cure: "Negative", negative: -1, positive: null };
    if ((prevZ === -2 && currentZ === -2) || (prevZ === -3 && currentZ === -3)) return { cure: "No Improvement", negative: null, positive: null };
    
    const map: Record<string, number> = {
      "-1:-2": 1, "-1:-3": 2, "-2:-3": 1, "0:-3": 3, "2:-3": 5,
      "3:-3": 6, "0:-2": 2, "2:-2": 4, "3:-2": 5,
    };
    const positiveScore = map[`${prevZ}:${currentZ}`] ?? null;
    if (positiveScore !== null) return { cure: "Positive", negative: null, positive: positiveScore };
  }
  return { cure: "", negative: null, positive: null };
}

function determineNextCycle(record: any, cycle: number, options: { prevNextCycle?: string; cureField: string }) {
  const prevNext = options.prevNextCycle;
  const meas = record[`meas_type_c${cycle}`] || record.meas_type;
  const age = Number(record[`child_age_c${cycle}`] || 0);
  const muac = Number(record[`muac_c${cycle - 1}`] || 0);
  const zscore = Number(record[`zscore_c${cycle - 1}`] || 0);
  const cmamResult = record[`cmam_result_c${cycle - 1}`];
  const cureField = record[`cure_rate_c${cycle}`];

  if (muac >= 12.5) return "Disqualified";
  if (meas === "الزد اسكور" && [-1, 0, 1, 2, 3].includes(zscore)) return "Disqualified";
  if (age >= 60) return "Disqualified";
  if (["شفاء", "الوفاة", "انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"].includes(cmamResult)) return "Disqualified";

  if (prevNext === "Last Month Qualification") return "Disqualified";
  if (prevNext === "Disqualified") return "Disqualified";

  if (cureField && (cureField === "Negative" || cureField === "No Improvement") && 
      (record[`cure_rate_c${cycle - 1}`] === "Negative" || record[`cure_rate_c${cycle - 1}`] === "No Improvement")) {
    return "Disqualified";
  }

  if (age === 59) return "Last Month Qualification";
  return null;
}

// --- Main API Handler ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, cycle, followUpMonth } = body;

    if (!projectId || !cycle || !followUpMonth) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const followUpMonthNumber = MONTHS[followUpMonth] || 1;
    let db: Database.Database | null = null;

    try {
      db = new Database(getDbPath());
      const records = db.prepare("SELECT * FROM child_cmam WHERE project_id = ?").all(projectId) as any[];

      const transaction = db.transaction((recordsToUpdate: any[]) => {
        recordsToUpdate.forEach((record) => {
          const updates: Record<string, any> = {};
          
          const hasCmamKey = "child_has_cmam_hc";
          const formattedAttend = record[hasCmamKey] === "نعم";

          if (cycle === 1) {
            updates["child_isprev_ref_c1"] = formattedAttend ? "نعم" : record["child_isprev_ref_c1"];

            if (formattedAttend && record["child_has_cmam_hc"] === "نعم") {
              const confDateStr = record.conf_date;
              const confDate = confDateStr ? new Date(confDateStr) : new Date();
              const ageIncrement = computeAgeDiff(confDate, followUpMonthNumber);

              const existing = Number(record.new_child_age_mon || record.child_age_mon || record.child_age || 0) || 0;
              updates["child_age_c1"] = ageIncrement + existing;

              const muac = Number(record["muac_hc"] || 0);
              const measType = record["meas_type"] || "";
              const childAge = Number(updates["child_age_c1"] || 0);

              if (measType === "المواك" && muac >= 12.5) updates["next_cycle_c1"] = "Disqualified";
              else if (measType === "الزد اسكور") {
                const zscore = Number(record["zscore"] ?? 0);
                if ([-1, 0, 1, 2, 3].includes(zscore)) updates["next_cycle_c1"] = "Disqualified";
              }
              
              if (childAge >= 60) updates["next_cycle_c1"] = "Disqualified";
              if (childAge === 59) updates["next_cycle_c1"] = "Last Month Qualification";
              if (!updates["next_cycle_c1"]) updates["next_cycle_c1"] = "Qualified";
            }
          } 
          
          else if (cycle === 2) {
            const prevQualified = record["next_cycle_c1"] === "Qualified";

            if (formattedAttend && prevQualified) {
              updates["child_isprev_ref_c2"] = "نعم";
              updates["child_age_c2"] = Number(record["child_age_c1"] || 0) + 1;

              const cure = computeCureRate(record, 1, 2);
              if (cure.cure) updates["cure_rate_c2"] = cure.cure;
              if (cure.negative !== null) updates["negative_c2"] = cure.negative;
              if (cure.positive !== null) updates["positive_c2"] = cure.positive;
            }

            const mergedRecord = { ...record, ...updates };
            const nextCycleValue = determineNextCycle(mergedRecord, 2, { prevNextCycle: record["next_cycle_c1"], cureField: "c2" });
            updates["next_cycle_c2"] = nextCycleValue;

            if (!updates["next_cycle_c2"] && updates["child_isprev_ref_c2"] === "نعم" && prevQualified) {
              updates["next_cycle_c2"] = "Qualified";
            }
          } 
          
          else if (cycle === 3) {
            const prevQualified = record["next_cycle_c2"] === "Qualified";

            if (formattedAttend && prevQualified) {
              updates["child_isprev_ref_c3"] = "نعم";
              updates["child_age_c3"] = Number(record["child_age_c2"] || 0) + 1;

              const cure = computeCureRate(record, 2, 3);
              if (cure.cure) updates["cure_rate_c3"] = cure.cure;
              if (cure.negative !== null) updates["negative_c3"] = cure.negative;
              if (cure.positive !== null) updates["positive_c3"] = cure.positive;
            }

            const mergedRecord = { ...record, ...updates };
            const nextCycleValue = determineNextCycle(mergedRecord, 3, { prevNextCycle: record["next_cycle_c2"], cureField: "c3" });
            updates["next_cycle_c3"] = nextCycleValue;

            if (!updates["next_cycle_c3"] && updates["child_isprev_ref_c3"] === "نعم" && prevQualified) {
              updates["next_cycle_c3"] = "Qualified";
            }
          }

          // Execute update if there are changes
          if (Object.keys(updates).length > 0) {
            const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
            const updateValues = [...Object.values(updates), record.id];
            db.prepare(`UPDATE child_cmam SET ${setClause} WHERE id = ?`).run(...updateValues);
          }
        });
      });

      transaction(records);

      return NextResponse.json({ message: "Update successful." });
    } finally {
      if (db) db.close();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}