import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "src");

/* ---------- SAFETY ---------- */
function safePath(rel: string) {
  const resolved = path.resolve(BASE_DIR, rel);
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error("Access denied");
  }
  return resolved;
}

/* ---------- COLLECT FILES ---------- */
async function collectFiles(dir: string, out: any[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    // Skip system folders
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".next") {
      continue;
    }

    if (e.isDirectory()) {
      await collectFiles(full, out);
    } else {
      let content = "";
      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        content = "[[BINARY OR UNREADABLE FILE]]";
      }

      out.push({
        path: full.replace(BASE_DIR + path.sep, ""),
        content,
      });
    }
  }

  return out;
}

/* ---------- API HANDLER ---------- */
export async function POST(req: Request) {
  try {
    const { folder } = await req.json();
    const abs = safePath(folder);

    const files = await collectFiles(abs);

    let output = "";
    for (const f of files) {
      output +=
        "\n\n════════════════════════════════════════════════════\n" +
        `FILE: ${f.path}\n` +
        "════════════════════════════════════════════════════\n\n" +
        f.content;
    }

    // Ensure output is always a string
    return NextResponse.json({
      totalFiles: files.length,
      content: output || "[No files in this folder]",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}