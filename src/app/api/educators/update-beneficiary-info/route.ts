// src/app/api/educators/update-beneficiary-info/route.ts
import { NextResponse } from "next/server";
import path from "path";
import Database from 'better-sqlite3';

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

export async function POST(req: Request) {
  try {
    const { applicant_id, beneficiaryData } = await req.json();

    if (!applicant_id || !beneficiaryData) {
      return NextResponse.json({ error: "Missing applicant_id or beneficiaryData" }, { status: 400 });
    }

    const db = new Database(getDbPath());

    const stmt = db.prepare(`
      UPDATE educators
      SET
        bnf_full_name = ?,
        bnf_age = ?,
        bnf_id_type = ?,
        bnf_id_no = ?,
        bnf_ozla_name = ?,
        bnf_vill_name = ?,
        qual_status = ?,
        bnf_husband = ?,
        male_cnt = ?,
        female_cnt = ?,
        child_names = ?,
        bnf_id = ?
      WHERE
        applicant_id = ?
    `);

    const info = stmt.run(
      beneficiaryData.l_benef_name,
      beneficiaryData.l_age_years,
      beneficiaryData.id_card_type,
      beneficiaryData.l_id_card_no,
      beneficiaryData.hh_ozla_name,
      beneficiaryData.hh_vill_name,
      beneficiaryData.bnf_qual_status_desc,
      beneficiaryData.l_hsbnd_name,
      beneficiaryData.bnf_child_m_cnt,
      beneficiaryData.bnf_child_f_cnt,
      Array.isArray(beneficiaryData.l_child_list) ? beneficiaryData.l_child_list.join(', ') : beneficiaryData.l_child_list,
      beneficiaryData.l_id,
      applicant_id
    );

    db.close();

    if (info.changes === 0) {
        return NextResponse.json({ error: "Applicant not found or no changes made." }, { status: 404 });
    }

    return NextResponse.json({ message: "Educator record updated successfully." });

  } catch (error: any) {
    console.error("[UPDATE_EDUCATOR_API_ERROR]", error);
    return NextResponse.json({ error: "Failed to update educator record.", details: error.message }, { status: 500 });
  }
}
