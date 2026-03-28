// src/app/api/bnf-cmam/referral-update/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-CMAM.db");

export async function POST(req: Request) {
    const { projectId, cycle } = await req.json();

    if (!projectId || !cycle) {
        return NextResponse.json({ error: "Missing projectId or cycle" }, { status: 400 });
    }

    let db: Database.Database | null = null;
    try {
        db = new Database(getDbPath());
        const records = db.prepare("SELECT * FROM bnf_cmam WHERE project_id = ?").all(projectId);

        const transaction = db.transaction((recordsToUpdate) => {
            recordsToUpdate.forEach((record) => {
                let updates: any = {};
                
                if (cycle === 1) {
                    if (record.attend_hc === 'نعم' && record.bnf_has_cmam_hc === 'نعم') {
                        updates.bnf_isprev_ref_c1 = 'نعم';
                        if (record.bnf_cmam_cond === 'حامل') {
                            const pregMonth = parseInt(record.bnf_preg_mon, 10);
                            if (!isNaN(pregMonth) && pregMonth >= 1 && pregMonth <= 8) {
                                updates.bnf_cmam_cond_c1 = 'حامل';
                                updates.bnf_preg_mon_c1 = pregMonth + 1;
                            } else if (pregMonth === 9) {
                                updates.bnf_cmam_cond_c1 = 'مرضع';
                                updates.bnf_child_age_c1 = 1;
                            }
                        } else if (record.bnf_cmam_cond === 'مرضع') {
                            const childAge = parseInt(record.bnf_child_age, 10);
                            if (!isNaN(childAge) && childAge >= 1 && childAge <= 5) {
                                updates.bnf_cmam_cond_c1 = 'مرضع';
                                updates.bnf_child_age_c1 = childAge + 1;
                            }
                        }
                    }
                    if (updates.bnf_cmam_cond_c1 === 'مرضع' && updates.bnf_child_age_c1 === 6) {
                        updates.next_cycle_c1 = 'Last Month Qualification';
                    } else if (parseFloat(record.hc_muac) >= 23 || parseInt(record.bnf_child_age, 10) === 6) {
                        updates.next_cycle_c1 = 'Disqualified';
                    } else {
                        updates.next_cycle_c1 = 'Qualified';
                    }

                } else if (cycle === 2) {
                     if (record.bnf_isprev_ref_c1 === 'نعم' && record.next_cycle_c1 === 'Qualified') {
                        updates.bnf_isprev_ref_c2 = 'نعم';
                        if (record.bnf_cmam_cond_c1 === 'حامل') {
                            const pregMonth = parseInt(record.bnf_preg_mon_c1, 10);
                             if (!isNaN(pregMonth) && pregMonth >= 1 && pregMonth <= 8) {
                                updates.bnf_cmam_cond_c2 = 'حامل';
                                updates.bnf_preg_mon_c2 = pregMonth + 1;
                            } else if (pregMonth === 9) {
                                updates.bnf_cmam_cond_c2 = 'مرضع';
                                updates.bnf_child_age_c2 = 1;
                            }
                        } else if (record.bnf_cmam_cond_c1 === 'مرضع') {
                             const childAge = parseInt(record.bnf_child_age_c1, 10);
                            if (!isNaN(childAge) && childAge >= 1 && childAge <= 5) {
                                updates.bnf_cmam_cond_c2 = 'مرضع';
                                updates.bnf_child_age_c2 = childAge + 1;
                            }
                        }

                        const muac1 = parseFloat(record.hc_muac_c1);
                        const muac2 = parseFloat(record.hc_muac_c2);
                        if (!isNaN(muac1) && !isNaN(muac2)) {
                            const diff = muac2 - muac1;
                            if (diff < 0) {
                                updates.cure_rate_c2 = 'Negative';
                                updates.negative_c2 = diff;
                            } else if (diff === 0) {
                                updates.cure_rate_c2 = 'No Improvement';
                            } else {
                                updates.cure_rate_c2 = 'Positive';
                                updates.positive_c2 = diff;
                            }
                        }
                    }

                    if (parseFloat(record.hc_muac_c1) >= 23 || parseInt(record.bnf_child_age_c1, 10) === 6 || record.next_cycle_c1 === 'Last Month Qualification' || record.next_cycle_c1 === 'Disqualified' || ['شفاء', 'الوفاة', 'انتهاء فترة الدعم / تخريج من برنامج سوء التغذية'].includes(record.cmam_result_c1)) {
                        updates.next_cycle_c2 = 'Disqualified';
                    } else {
                        updates.next_cycle_c2 = 'Qualified';
                    }
                } else if (cycle === 3) {
                     if (record.bnf_isprev_ref_c2 === 'نعم' && record.next_cycle_c2 === 'Qualified') {
                        updates.bnf_isprev_ref_c3 = 'نعم';
                         if (record.bnf_cmam_cond_c2 === 'حامل') {
                            const pregMonth = parseInt(record.bnf_preg_mon_c2, 10);
                             if (!isNaN(pregMonth) && pregMonth >= 1 && pregMonth <= 8) {
                                updates.bnf_cmam_cond_c3 = 'حامل';
                                updates.bnf_preg_mon_c3 = pregMonth + 1;
                            } else if (pregMonth === 9) {
                                updates.bnf_cmam_cond_c3 = 'مرضع';
                                updates.bnf_child_age_c3 = 1;
                            }
                        } else if (record.bnf_cmam_cond_c2 === 'مرضع') {
                             const childAge = parseInt(record.bnf_child_age_c2, 10);
                            if (!isNaN(childAge) && childAge >= 1 && childAge <= 5) {
                                updates.bnf_cmam_cond_c3 = 'مرضع';
                                updates.bnf_child_age_c3 = childAge + 1;
                            }
                        }

                        const muac2 = parseFloat(record.hc_muac_c2);
                        const muac3 = parseFloat(record.hc_muac_c3);
                        if (!isNaN(muac2) && !isNaN(muac3)) {
                            const diff = muac3 - muac2;
                            if (diff < 0) {
                                updates.cure_rate_c3 = 'Negative';
                                updates.negative_c3 = diff;
                            } else if (diff === 0) {
                                updates.cure_rate_c3 = 'No Improvement';
                            } else {
                                updates.cure_rate_c3 = 'Positive';
                                updates.positive_c3 = diff;
                            }
                        }
                    }

                    if (parseFloat(record.hc_muac_c2) >= 23 || parseInt(record.bnf_child_age_c2, 10) === 6 || record.next_cycle_c2 === 'Last Month Qualification' || record.next_cycle_c2 === 'Disqualified' || ['شفاء', 'الوفاة', 'انتهاء فترة الدعم / تخريج من برنامج سوء التغذية'].includes(record.cmam_result_c2) || record.cure_rate_c2 === 'Negative' || record.cure_rate_c2 === 'No Improvement' ) {
                        updates.next_cycle_c3 = 'Disqualified';
                    } else {
                        updates.next_cycle_c3 = 'Qualified';
                    }
                }
                
                if (Object.keys(updates).length > 0) {
                    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                    db.prepare(`UPDATE bnf_cmam SET ${setClause} WHERE id = ?`).run(...Object.values(updates), record.id);
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
