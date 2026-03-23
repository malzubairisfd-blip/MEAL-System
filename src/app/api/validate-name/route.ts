// app/api/validate-name/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fullValidation } from "@/lib/fullValidation";
import fs from 'fs/promises';
import path from "path";

async function ensureDataDir() {
    const dataPath = path.join(process.cwd(), 'src', 'data');
    try {
        await fs.access(dataPath);
    } catch {
        await fs.mkdir(dataPath, { recursive: true });
    }
}

export async function POST(req: NextRequest) {
  try {
      await ensureDataDir();
      const body = await req.json();
      const { name, gender, benef_id } = body;

      if (!name || !gender || !benef_id) {
          return NextResponse.json({ error: "Missing required fields: name, gender, benef_id" }, { status: 400 });
      }

      const result = fullValidation({
        child_first_name: name,
        child_gender: gender, // "ذكر" | "أنثى"
        benef_id,
      });

      return NextResponse.json({ result });
  } catch (error: any) {
      console.error("[VALIDATE_NAME_API_ERROR]", error);
      return NextResponse.json({ error: "Failed to validate name.", details: error.message }, { status: 500 });
  }
}
