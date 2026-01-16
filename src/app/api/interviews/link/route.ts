import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getInterviewsDbPath = () => path.join(process.cwd(), 'src', 'data', 'interviews.json');
const getDataPath = () => path.join(process.cwd(), 'src', 'data');


async function readDb() {
    try {
        const content = await fs.readFile(getInterviewsDbPath(), 'utf8');
        return JSON.parse(content);
    } catch(e) {
        // if file does not exist or is empty
        return {};
    }
}

async function writeDb(data: any) {
    await fs.mkdir(getDataPath(), { recursive: true });
    await fs.writeFile(getInterviewsDbPath(), JSON.stringify(data, null, 2));
}


export async function POST(req: Request) {
  try {
      const body = await req.json();
      const { projectId, hallNumber, hallName, applicants } = body;

      if (!projectId || !hallNumber || !Array.isArray(applicants)) {
          return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }

      const db = await readDb();

      db[projectId] ??= { halls: [] };

      let hall = db[projectId].halls.find(
        (h: any) => h.hallNumber === hallNumber
      );

      if (!hall) {
        hall = { hallName: hallName || `Hall ${hallNumber}`, hallNumber: hallNumber, applicants: [] };
        db[projectId].halls.push(hall);
      }
      
      const existingApplicants = new Set(hall.applicants);
      applicants.forEach(appId => existingApplicants.add(appId));
      hall.applicants = Array.from(existingApplicants);
      
      await writeDb(db);
      return NextResponse.json({ ok: true });
  } catch (error: any) {
      console.error("Link API Error:", error);
      return NextResponse.json({ error: "Failed to link applicants." }, { status: 500 });
  }
}
