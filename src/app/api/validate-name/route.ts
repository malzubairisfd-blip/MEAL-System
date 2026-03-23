// app/api/validate-name/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fullValidation } from "@/lib/fullValidation";

export async function POST(req: NextRequest) {
  try {
      const body = await req.json();
      const { name, gender, benef_id } = body;

      const result = fullValidation({
        child_first_name: name,
        child_gender: gender, 
        benef_id,
      });

      return NextResponse.json({ result });
  } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}