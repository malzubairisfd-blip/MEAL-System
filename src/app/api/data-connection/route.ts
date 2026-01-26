
// src/app/api/data-connection/route.ts
import { NextResponse } from "next/server";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src', 'data');
const getEducatorsDbPath = () => path.join(getDataPath(), 'educators.db');
const getEcPcDbPath = () => path.join(getDataPath(), 'ec_pc.db');
const getBnfDbPath = () => path.join(getDataPath(), 'bnf-assessed.db');
const getProjectsDbPath = () => path.join(getDataPath(), 'projects.db');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'generate-ed-codes':
                return await generateEdCodes(body);
            case 'connect-ed-to-ec':
                return await connectEdToEc(body);
            case 'enrich-ec-pc':
                return await enrichEcPc();
            case 'balance-bnf-counts':
                return await balanceBnfCounts(body);
            case 'connect-bnf-to-ed':
                return await connectBnfToEd(body);
            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: any) {
        console.error(`[API_DATA_CONNECTION_ERROR] Action failed:`, error);
        return NextResponse.json({ error: "An unexpected error occurred.", details: error.message }, { status: 500 });
    }
}

async function generateEdCodes({ projectId, startCode }: { projectId: string; startCode: string }) {
    const db = new Database(getEducatorsDbPath());
    try {
        const educators = db.prepare(`
            SELECT applicant_id, applicant_name, loc_id 
            FROM educators 
            WHERE project_id = ? AND contract_type = 'مثقفة مجتمعية' AND ed_id IS NULL
        `).all(projectId);

        const educatorsByLoc = educators.reduce((acc: any, edu: any) => {
            const locId = edu.loc_id || 'UNKNOWN';
            if (!acc[locId]) acc[locId] = [];
            acc[locId].push(edu);
            return acc;
        }, {});

        let currentCode = parseInt(startCode.split('-')[1], 10);
        const updateStmt = db.prepare('UPDATE educators SET ed_id = ? WHERE applicant_id = ?');
        
        db.transaction(() => {
            Object.keys(educatorsByLoc).forEach(locId => {
                const locEducators = educatorsByLoc[locId].sort((a: any, b: any) => a.applicant_name.localeCompare(b.applicant_name, 'ar'));
                locEducators.forEach((edu: any) => {
                    updateStmt.run(`2-${currentCode}`, edu.applicant_id);
                    currentCode++;
                });
            });
        })();

        return NextResponse.json({ message: "Educator codes generated successfully." });
    } finally {
        db.close();
    }
}


async function connectEdToEc({ educatorIds, ecFacId }: { educatorIds: number[]; ecFacId: string }) {
    if (!educatorIds || educatorIds.length === 0 || !ecFacId) {
        return NextResponse.json({ error: "Missing educator IDs or EC Facility ID." }, { status: 400 });
    }
    
    const edDb = new Database(getEducatorsDbPath());
    const ecDb = new Database(getEcPcDbPath());
    
    try {
        const ecRecord = ecDb.prepare('SELECT * FROM ec_pc_data WHERE fac_id = ?').get(ecFacId);
        if (!ecRecord) return NextResponse.json({ error: "Education Center not found." }, { status: 404 });
        
        const updateStmt = edDb.prepare(`
            UPDATE educators 
            SET ec_id = ?, ec_name = ?, ec_name2 = ?, ec_loc_id = ?, ec_loc_name = ?, pc_id = ?, pc_name = ?, row_no = ?
            WHERE applicant_id = ?
        `);
        
        const pcRecord = ecDb.prepare('SELECT fac_name FROM ec_pc_data WHERE fac_id = ?').get(ecRecord.pc_id);

        edDb.transaction(() => {
            educatorIds.forEach(id => {
                updateStmt.run(
                    ecRecord.fac_id, ecRecord.fac_name, ecRecord.fac_name, ecRecord.loc_id, ecRecord.vill_name,
                    ecRecord.pc_id, pcRecord?.fac_name || '', ecRecord.id, id
                );
            });
        })();

        return NextResponse.json({ message: `${educatorIds.length} educators connected to EC ${ecRecord.fac_name}.` });
    } finally {
        edDb.close();
        ecDb.close();
    }
}

async function enrichEcPc() {
    const ecDb = new Database(getEcPcDbPath());
    const edDb = new Database(getEducatorsDbPath());
    const bnfDb = new Database(getBnfDbPath());
    
    try {
        const allEcs = ecDb.prepare('SELECT * FROM ec_pc_data').all();
        const allEducators = edDb.prepare('SELECT ed_id, pc_id, ec_id, ed_bnf_cnt FROM educators').all();
        const allBnfs = bnfDb.prepare('SELECT PC_ID, EC_ID FROM assessed_data').all();

        const ecMap = new Map(allEcs.map(ec => [ec.fac_id, ec]));

        const updateStmt = ecDb.prepare(`
            UPDATE ec_pc_data SET
            is_pc2 = ?, pc_loc2 = ?, same_ozla = ?, same_ec_pc = ?,
            pc_ed_cnt = ?, ec_ed_cnt = ?, pc_bnf_cnt = ?, ec_bnf_cnt = ?
            WHERE fac_id = ?
        `);

        ecDb.transaction(() => {
            allEcs.forEach(ec => {
                const pcRecord = ecMap.get(ec.pc_id);
                const is_pc2 = ec.is_pc;
                const pc_loc2 = pcRecord ? pcRecord.loc_id : null;
                const same_ozla = (pc_loc2 && ec.loc_id) ? (String(pc_loc2).substring(0, 6) === String(ec.loc_id).substring(0, 6) ? 1 : 0) : 0;
                const same_ec_pc = (ec.is_ec === 1 && ec.is_pc === 1) ? 1 : 0;

                const pc_ed_cnt = allEducators.filter(ed => ed.pc_id === ec.fac_id).length;
                const ec_ed_cnt = allEducators.filter(ed => ed.ec_id === ec.fac_id).length;

                const pc_bnf_cnt = allBnfs.filter(bnf => bnf.PC_ID === ec.pc_id).length;
                const ec_bnf_cnt = allBnfs.filter(bnf => bnf.EC_ID === ec.fac_id).length;

                updateStmt.run(is_pc2, pc_loc2, same_ozla, same_ec_pc, pc_ed_cnt, ec_ed_cnt, pc_bnf_cnt, ec_bnf_cnt, ec.fac_id);
            });
        })();
        
        return NextResponse.json({ message: "Education/Payment Center data enriched successfully." });
    } finally {
        ecDb.close(); edDb.close(); bnfDb.close();
    }
}

async function balanceBnfCounts({ projectId }: { projectId: string }) {
    const db = new Database(getEducatorsDbPath());
    try {
        const educators = db.prepare(`SELECT applicant_id, ed_id, working_village, ed_bnf_cnt FROM educators WHERE project_id = ? AND contract_type = 'مثقفة مجتمعية'`).all(projectId);
        
        const byVillage: Record<string, any[]> = {};
        educators.forEach(e => {
            const village = e.working_village || 'UNKNOWN';
            if (!byVillage[village]) byVillage[village] = [];
            byVillage[village].push(e);
        });

        const updateStmt = db.prepare('UPDATE educators SET ed_bnf_cnt = ? WHERE applicant_id = ?');

        db.transaction(() => {
            Object.values(byVillage).forEach(group => {
                const totalBnf = group.reduce((sum, e) => sum + (e.ed_bnf_cnt || 0), 0);
                const numEducators = group.length;
                if (numEducators === 0) return;

                const baseCount = Math.floor(totalBnf / numEducators);
                let remainder = totalBnf % numEducators;

                group.forEach(edu => {
                    let newCount = baseCount;
                    if (remainder > 0) {
                        newCount++;
                        remainder--;
                    }
                    updateStmt.run(newCount, edu.applicant_id);
                });
            });
        })();
        
        return NextResponse.json({ message: "Beneficiary counts balanced successfully across educators." });
    } finally {
        db.close();
    }
}

async function connectBnfToEd({ projectId }: { projectId: string }) {
    const edDb = new Database(getEducatorsDbPath());
    const bnfDb = new Database(getBnfDbPath());
    const projectsDb = new Database(getProjectsDbPath());
    try {
        const project = projectsDb.prepare('SELECT projectName FROM projects WHERE projectId = ?').get(projectId);
        const projectName = project?.projectName;
        if (!projectName) throw new Error("Project name not found");

        const educators = edDb.prepare(`SELECT ed_id, applicant_name, working_village, ed_bnf_cnt, ec_id, pc_id, ec_name, pc_name FROM educators WHERE project_id = ? AND contract_type = 'مثقفة مجتمعية'`).all(projectId);
        const allBeneficiaries = bnfDb.prepare('SELECT srvy_hh_id, hh_vill_name FROM assessed_data WHERE project_name = ? AND ED_ID IS NULL').all(projectName);
        
        const bnfByVillage: Record<string, any[]> = {};
        allBeneficiaries.forEach(bnf => {
            const village = bnf.hh_vill_name;
            if (!bnfByVillage[village]) bnfByVillage[village] = [];
            bnfByVillage[village].push(bnf);
        });

        Object.keys(bnfByVillage).forEach(village => bnfByVillage[village].sort((a, b) => String(a.srvy_hh_id).localeCompare(String(b.srvy_hh_id))));

        const edByVillage: Record<string, any[]> = {};
        educators.forEach(edu => {
            const village = edu.working_village;
            if (!edByVillage[village]) edByVillage[village] = [];
            edByVillage[village].push(edu);
        });

        const updateBnfStmt = bnfDb.prepare('UPDATE assessed_data SET ED_ID = ?, ED_Name = ?, EC_ID = ?, PC_ID = ?, EC_NAME = ?, PC_name = ? WHERE srvy_hh_id = ?');
        
        let totalConnected = 0;
        const connectedEds = new Set();
        const connectedEcs = new Set();
        const connectedPcs = new Set();
        
        bnfDb.transaction(() => {
            Object.keys(edByVillage).forEach(village => {
                const villageBeneficiaries = bnfByVillage[village] || [];
                let bnfIndex = 0;
                edByVillage[village].forEach(edu => {
                    const numToAssign = edu.ed_bnf_cnt || 0;
                    const bnfsToAssign = villageBeneficiaries.slice(bnfIndex, bnfIndex + numToAssign);
                    
                    bnfsToAssign.forEach(bnf => {
                        updateBnfStmt.run(edu.ed_id, edu.applicant_name, edu.ec_id, edu.pc_id, edu.ec_name, edu.pc_name, bnf.srvy_hh_id);
                        totalConnected++;
                        connectedEds.add(edu.ed_id);
                        if(edu.ec_id) connectedEcs.add(edu.ec_id);
                        if(edu.pc_id) connectedPcs.add(edu.pc_id);
                    });
                    bnfIndex += numToAssign;
                });
            });
        })();

        const stats = {
            bnf_connected: totalConnected,
            ed_connected: connectedEds.size,
            ec_connected: connectedEcs.size,
            pc_connected: connectedPcs.size,
        };

        return NextResponse.json({ message: `${totalConnected} beneficiaries connected.`, stats });
    } finally {
        edDb.close();
        bnfDb.close();
        projectsDb.close();
    }
}
