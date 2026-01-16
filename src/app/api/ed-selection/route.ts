// src/app/api/ed-selection/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'educators.db');


// An array of all the column names in the new schema
const DB_COLUMNS = [
  's', 'office_no', 'project_id', 'project_name', 'applicant_id', 'ed_id',
  'applicant_name', 'applicant_familyname', 'applicant_husbandname',
  'phone_no1', 'phone_no2', 'phone_no',
  'gov_loc_id', 'mud_loc_id', 'ozla_loc_id', 'loc_id',
  'gov_name', 'mud_name', 'ozla_name', 'loc_name', 'mahla_name', 'zoon_no',
  'social_status', 'birth_date', 'age_years', 'age_days', 'age_rank',
  'id_type', 'id_no', 'id_issue_date', 'id_issue_location',
  'applicant_qualification', 'qualification_major', 'graduation_date',
  'diploma_starting_date', 'diploma_end_date', 'diploma_duration_years', 'diploma_duration_days', 'institution_name',
  'duplicated_cluster_id', 'duplicated_applicants',
  'age_per_village_ranking',
  'qualification_score', 'id_score', 'previous_experience_score', 'total_score',
  'applcants_relationship', 'interview_hall_no', 'interview_hall_name',
  'acceptance_results', 'disqualification_reason',
  'interview_qualification', 'interview_attendance',
  'sfd_marks', 'health_marks', 'local_community_marks', 'interview_total_marks', 'grand_total_score',
  'training_qualification', 'training_attendance',
  'is_active', 'contract_type', 'working_village', 'contract_starting_date', 'contract_end_date', 'contract_duration_months', 'is_spare',
  'disqualified_reasons', 'is_registered_in_assessment', 'if_no_reason',
  'bnf_full_name', 'bnf_age', 'bnf_id_type', 'bnf_id_no', 'bnf_ozla_name', 'bnf_vill_name', 'qual_status', 'bnf_husband', 'male_cnt', 'female_cnt', 'child_names', 'bnf_id',
  'notes',
  'ec_id', 'ec_name', 'ec_name2', 'ec_loc_id', 'ec_loc_name',
  'pc_id', 'pc_name',
  'row_no',
  'same_ozla', 'x', 'ed_bnf_cnt', 'pc_ed_cnt', 'ec_ed_cnt', 'pc_bnf_cnt', 'ec_bnf_cnt'
];


function initializeDatabase(recreate: boolean = false) {
    const db = new Database(getDbPath());
    if (recreate) {
        db.exec('DROP TABLE IF EXISTS educators');
    }

    const createTableStmt = `
        CREATE TABLE IF NOT EXISTS educators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          -- =====================
          -- CORE IDENTIFIERS
          -- =====================
          s INTEGER,
          office_no TEXT,
          project_id TEXT,
          project_name TEXT,
          applicant_id INTEGER,
          ed_id TEXT,

          -- =====================
          -- APPLICANT NAMES
          -- =====================
          applicant_name TEXT,
          applicant_familyname TEXT,
          applicant_husbandname TEXT,

          -- =====================
          -- PHONE NUMBERS
          -- =====================
          phone_no1 TEXT,
          phone_no2 TEXT,
          phone_no TEXT,

          -- =====================
          -- LOCATION IDS
          -- =====================
          gov_loc_id INTEGER,
          mud_loc_id INTEGER,
          ozla_loc_id INTEGER,
          loc_id INTEGER,

          -- =====================
          -- LOCATION NAMES
          -- =====================
          gov_name TEXT,
          mud_name TEXT,
          ozla_name TEXT,
          loc_name TEXT,
          mahla_name TEXT,
          zoon_no TEXT,

          -- =====================
          -- SOCIAL & DEMOGRAPHICS
          -- =====================
          social_status TEXT,
          birth_date INTEGER,              -- Excel serial date
          age_years REAL,
          age_days REAL,
          age_rank INTEGER,

          -- =====================
          -- IDENTITY
          -- =====================
          id_type TEXT,
          id_no TEXT,
          id_issue_date INTEGER,
          id_issue_location TEXT,

          -- =====================
          -- EDUCATION
          -- =====================
          applicant_qualification TEXT,
          qualification_major TEXT,
          graduation_date INTEGER,

          diploma_starting_date INTEGER,
          diploma_end_date INTEGER,
          diploma_duration_years REAL,
          diploma_duration_days REAL,
          institution_name TEXT,

          -- =====================
          -- DUPLICATION
          -- =====================
          duplicated_cluster_id INTEGER,
          duplicated_applicants TEXT,

          age_per_village_ranking INTEGER,

          -- =====================
          -- SCORING
          -- =====================
          qualification_score REAL,
          id_score REAL,
          previous_experience_score REAL,
          total_score REAL,

          -- =====================
          -- RELATIONSHIP & INTERVIEW
          -- =====================
          applcants_relationship TEXT,
          interview_hall_no TEXT,
          interview_hall_name TEXT,

          acceptance_results TEXT,
          disqualification_reason TEXT,

          interview_qualification TEXT,
          interview_attendance TEXT,

          -- =====================
          -- INTERVIEW MARKS
          -- =====================
          sfd_marks REAL,
          health_marks REAL,
          local_community_marks REAL,
          interview_total_marks REAL,
          grand_total_score REAL,

          -- =====================
          -- TRAINING
          -- =====================
          training_qualification TEXT,
          training_attendance TEXT,

          -- =====================
          -- CONTRACT
          -- =====================
          is_active INTEGER,
          contract_type TEXT,
          working_village TEXT,
          contract_starting_date INTEGER,
          contract_end_date INTEGER,
          contract_duration_months REAL,
          is_spare INTEGER,

          -- =====================
          -- DISQUALIFICATION / ASSESSMENT
          -- =====================
          disqualified_reasons TEXT,
          is_registered_in_assessment TEXT,
          if_no_reason TEXT,

          -- =====================
          -- BENEFICIARY INFO
          -- =====================
          bnf_full_name TEXT,
          bnf_age REAL,
          bnf_id_type TEXT,
          bnf_id_no TEXT,
          bnf_ozla_name TEXT,
          bnf_vill_name TEXT,
          qual_status TEXT,
          bnf_husband TEXT,
          male_cnt INTEGER,
          female_cnt INTEGER,
          child_names TEXT,
          bnf_id INTEGER,

          -- =====================
          -- NOTES & EC / PC
          -- =====================
          notes TEXT,

          ec_id TEXT,
          ec_name TEXT,
          ec_name2 TEXT,
          ec_loc_id INTEGER,
          ec_loc_name TEXT,

          pc_id TEXT,
          pc_name TEXT,

          row_no INTEGER,

          -- =====================
          -- AGGREGATES
          -- =====================
          same_ozla INTEGER,
          x INTEGER,
          ed_bnf_cnt INTEGER,
          pc_ed_cnt INTEGER,
          ec_ed_cnt INTEGER,
          pc_bnf_cnt INTEGER,
          ec_bnf_cnt INTEGER
        );
    `;
    db.exec(createTableStmt);
    
    return db;
}


export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const init = searchParams.get('init') === 'true';

    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase(init);
        
        const body = await req.json();
        const { projectName, results } = body;

        if (!projectName || !Array.isArray(results)) {
            return NextResponse.json({ error: "Invalid payload: projectName and results array are required." }, { status: 400 });
        }
        
        // Prepare the insert statement dynamically
        const columns = DB_COLUMNS.join(', ');
        const placeholders = DB_COLUMNS.map(() => '?').join(', ');
        const insert = db.prepare(`INSERT INTO educators (${columns}) VALUES (${placeholders})`);

        const insertMany = db.transaction((records) => {
            for (const record of records) {
                // Map the record object to an array of values in the correct order
                const values = DB_COLUMNS.map(col => record[col] ?? null);
                insert.run(values);
            }
        });

        insertMany(results);
        
        db.close();

        return NextResponse.json({ message: "Educator selection data saved to SQLite database successfully." });

    } catch (error: any) {
        console.error("[ED_SELECTION_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to save educator selection data to SQLite.", details: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = new Database(getDbPath(), { fileMustExist: true });
        
        const stmt = db.prepare('SELECT * FROM educators');
        const rows = stmt.all();
        
        db.close();

        return NextResponse.json(rows);

    } catch (error: any) {
        if (error.code === 'SQLITE_CANTOPEN') {
            return NextResponse.json([]);
        }
        return NextResponse.json({ error: "Failed to fetch educator selection data.", details: error.message }, { status: 500 });
    }
}
