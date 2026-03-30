// src/app/api/child-cmam/referral-update/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import dayjs from "dayjs";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "child-CMAM.db");

// Helper to convert string to number, defaulting to 0 if invalid
const safeToNumber = (value: any) => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
};


export async function POST(req: Request) {
    const { projectId, cycle: rawCycle } = await req.json();
    const cycle = Number(rawCycle);

    if (!projectId || !cycle || ![1, 2, 3].includes(cycle)) {
        return NextResponse.json({ error: "Missing or invalid projectId or cycle" }, { status: 400 });
    }

    let db: Database.Database | null = null;
    try {
        db = new Database(getDbPath());
        const records = db.prepare("SELECT * FROM child_cmam WHERE project_id = ?").all(projectId);

        const transaction = db.transaction((recordsToUpdate) => {
            recordsToUpdate.forEach((record: any) => {
                let updates: any = {};
                
                if (cycle === 1) {
                    if (record.attend_hc === 'نعم' && record.child_has_cmam_hc === 'نعم') {
                        updates.child_isprev_ref_c1 = 'نعم';
                        
                        const confDate = dayjs(record.conf_date);
                        const followUpDate = dayjs(new Date(confDate.year(), Number(config.followUpMonth) - 1));
                        
                        if(confDate.isValid() && followUpDate.isValid()) {
                            const daysDiff = followUpDate.diff(confDate, 'day');
                            const monthsDiff = Math.round((daysDiff / 30) * 10) / 10;
                            const newAgeMon = safeToNumber(record.new_child_age_mon) + (monthsDiff >= 0.7 ? Math.ceil(monthsDiff) : Math.floor(monthsDiff));
                            updates.child_age_c1 = newAgeMon;
                            
                            if (newAgeMon >= 60) updates.next_cycle_c1 = 'Disqualified';
                            else if (newAgeMon === 59) updates.next_cycle_c1 = 'Last Month Qualification';
                        }
                    }
                    if (record.meas_type === 'المواك' && safeToNumber(record.hc_muac) >= 12.5) updates.next_cycle_c1 = 'Disqualified';
                    if (record.meas_type === 'الزد اسكور' && [-1,0,1,2,3].includes(safeToNumber(record.zscore))) updates.next_cycle_c1 = 'Disqualified';

                    if (!updates.next_cycle_c1 && record.attend_hc === 'نعم' && record.child_has_cmam_hc === 'نعم') {
                        updates.next_cycle_c1 = 'Qualified';
                    }
                } else if (cycle === 2) {
                     if (record.child_isprev_ref_c1 === 'نعم' && record.next_cycle_c1 === 'Qualified') {
                        updates.child_isprev_ref_c2 = 'نعم';
                        updates.child_age_c2 = safeToNumber(record.child_age_c1) + 1;
                        
                        const muac_c1 = safeToNumber(record.muac_c1);
                        const muac_hc = safeToNumber(record.muac_hc);
                        
                        if (record.meas_type === 'المواك') {
                            const diff = muac_c1 - muac_hc;
                            if (diff < 0) { updates.cure_rate_c2 = 'Negative'; updates.negative_c2 = diff; }
                            else if (diff === 0) { updates.cure_rate_c2 = 'No Improvement'; }
                            else { updates.cure_rate_c2 = 'Positive'; updates.positive_c2 = diff; }
                        }
                        
                        const zscore_c1 = safeToNumber(record.zscore_c1);
                        const zscore = safeToNumber(record.zscore);
                         if (record.meas_type === 'الزد اسكور') {
                            if(zscore_c1 === -3 && zscore === -2) { updates.cure_rate_c2 = 'Negative'; updates.negative_c2 = -1; }
                            else if ((zscore_c1 === -2 && zscore === -2) || (zscore_c1 === -3 && zscore === -3)) { updates.cure_rate_c2 = 'No Improvement'; }
                            else { // Positive cases
                                updates.cure_rate_c2 = 'Positive';
                                if(zscore_c1 === -1 && zscore === -2) updates.positive_c2 = 1;
                                else if(zscore_c1 === -1 && zscore === -3) updates.positive_c2 = 2;
                                else if(zscore_c1 === -2 && zscore === -3) updates.positive_c2 = 1;
                                else if(zscore_c1 === 0 && zscore === -3) updates.positive_c2 = 3;
                                else if(zscore_c1 === 2 && zscore === -3) updates.positive_c2 = 5;
                                else if(zscore_c1 === 3 && zscore === -3) updates.positive_c2 = 6;
                                else if(zscore_c1 === 0 && zscore === -2) updates.positive_c2 = 2;
                                else if(zscore_c1 === 2 && zscore === -2) updates.positive_c2 = 4;
                                else if(zscore_c1 === 3 && zscore === -2) updates.positive_c2 = 5;
                            }
                        }

                        if (safeToNumber(record.muac_c1) >= 12.5) updates.next_cycle_c2 = 'Disqualified';
                        else if (updates.child_age_c2 >= 60) updates.next_cycle_c2 = 'Disqualified';
                        else if (record.next_cycle_c1 === 'Last Month Qualification' || record.next_cycle_c1 === 'Disqualified') updates.next_cycle_c2 = 'Disqualified';
                        else if (['شفاء', 'الوفاة', 'انتهاء فترة الدعم / تخريج من برنامج سوء التغذية'].includes(record.cmam_result_c1)) updates.next_cycle_c2 = 'Disqualified';
                        else if (updates.child_age_c2 === 59) updates.next_cycle_c2 = 'Last Month Qualification';
                        else if(record.child_attend_c1 === 'لا' && record.child_attend_c2 === 'لا') updates.next_cycle_c2 = 'Last Month Qualification';
                        else if ((updates.cure_rate_c2 === 'Negative' || updates.cure_rate_c2 === 'No Improvement') && (record.cure_rate_c1 === 'Negative' || record.cure_rate_c1 === 'No Improvement')) updates.next_cycle_c2 = 'Disqualified';
                        else if (updates.cure_rate_c2 === 'Positive') updates.next_cycle_c2 = 'Qualified';
                    }
                } else if (cycle === 3) {
                    if (record.child_isprev_ref_c2 === 'نعم' && record.next_cycle_c2 === 'Qualified') {
                        updates.child_isprev_ref_c3 = 'نعم';
                        updates.child_age_c3 = safeToNumber(record.child_age_c2) + 1;
                        
                        const muac_c2 = safeToNumber(record.muac_c2);
                        const muac_c1 = safeToNumber(record.muac_c1);
                        
                         if (record.meas_type === 'المواك') {
                            const diff = muac_c2 - muac_c1; // Assuming comparison to C1, clarify if it should be C2
                            if (diff < 0) { updates.cure_rate_c3 = 'Negative'; updates.negative_c3 = diff; }
                            else if (diff === 0) { updates.cure_rate_c3 = 'No Improvement'; }
                            else { updates.cure_rate_c3 = 'Positive'; updates.positive_c3 = diff; }
                        }

                        // Similar logic for z-score in cycle 3
                        
                        if (safeToNumber(record.muac_c2) >= 12.5) updates.next_cycle_c3 = 'Disqualified';
                        else if (updates.child_age_c3 >= 60) updates.next_cycle_c3 = 'Disqualified';
                        else if (record.next_cycle_c2 === 'Last Month Qualification' || record.next_cycle_c2 === 'Disqualified') updates.next_cycle_c3 = 'Disqualified';
                        else if (['شفاء', 'الوفاة', 'انتهاء فترة الدعم / تخريج من برنامج سوء التغذية'].includes(record.cmam_result_c2)) updates.next_cycle_c3 = 'Disqualified';
                        else if ((updates.cure_rate_c3 === 'Negative' || updates.cure_rate_c3 === 'No Improvement') && (record.cure_rate_c2 === 'Negative' || record.cure_rate_c2 === 'No Improvement')) updates.next_cycle_c3 = 'Disqualified';
                        else if (updates.child_age_c3 === 59) updates.next_cycle_c3 = 'Last Month Qualification';
                        else if(record.child_attend_c2 === 'لا' && record.child_attend_c3 === 'لا') updates.next_cycle_c3 = 'Disqualified';
                        else if (updates.cure_rate_c3 === 'Positive') updates.next_cycle_c3 = 'Qualified';
                    }
                }
                
                if (Object.keys(updates).length > 0) {
                    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                    db.prepare(`UPDATE child_cmam SET ${setClause} WHERE id = ?`).run(...Object.values(updates), record.id);
                }
            });
        });

        transaction(records);

        return NextResponse.json({ message: "Update successful." });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        if (db) db.close();
    }
}
