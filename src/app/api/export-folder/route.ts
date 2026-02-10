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

                        if (e.isDirectory()) {
                              await collectFiles(full, out);
                                  } else {
                                        const content = await fs.readFile(full, "utf8");
                                              out.push({
                                                      path: full.replace(BASE_DIR + path.sep, ""),
                                                              content,
                                                                    });
                                                                        }
                                                                          }
                                                                            return out;
                                                                            }

                                                                            /* ---------- API ---------- */
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

                                                                                                                                                return NextResponse.json({
                                                                                                                                                      totalFiles: files.length,
                                                                                                                                                            content: output,
                                                                                                                                                                });
                                                                                                                                                                  } catch (e: any) {
                                                                                                                                                                      return NextResponse.json(
                                                                                                                                                                            { error: e.message },
                                                                                                                                                                                  { status: 500 }
                                                                                                                                                                                      );
                                                                                                                                                                                        }
                                                                                                                                                                                        }