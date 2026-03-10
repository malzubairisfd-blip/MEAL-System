import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "src");

/* ================= SAFETY ================= */

function safePath(relativePath?: string) {
  if (!relativePath) throw new Error("Invalid file path");

    const resolved = path.resolve(BASE_DIR, relativePath);

      if (!resolved.startsWith(BASE_DIR)) {
          throw new Error("Access denied");
            }

              return resolved;
              }

              async function isFile(p: string) {
                try {
                    const stat = await fs.stat(p);
                        return stat.isFile();
                          } catch {
                              return false;
                                }
                                }

/* ================= TREE ================= */

// This function recursively gets file sizes and folder total sizes
async function listTree(dir: string): Promise<any[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const nodes = await Promise.all(
        entries.map(async (e) => {
            const full = path.join(dir, e.name);
            const rel = full.replace(BASE_DIR + path.sep, "");

            if (e.isDirectory()) {
                const children = await listTree(full);
                const size = children.reduce((acc, child) => acc + (child.size || 0), 0);
                return {
                    type: "folder",
                    name: e.name,
                    path: rel,
                    size,
                    children,
                };
            }

            try {
                const stats = await fs.stat(full);
                return {
                    type: "file",
                    name: e.name,
                    path: rel,
                    size: stats.size,
                };
            } catch {
                // If stat fails, return with size 0
                return {
                    type: "file",
                    name: e.name,
                    path: rel,
                    size: 0,
                };
            }
        })
    );
    // Sort so folders appear before files
    return nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
}


/* ================= SEARCH ================= */

async function searchFiles(dir: string, q: string, out: any[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      await searchFiles(full, q, out);
    } else {
      const txt = await fs.readFile(full, "utf8");
      txt.split("\n").forEach((l, i) => {
        if (l.includes(q)) {
          out.push({
            file: full.replace(BASE_DIR + path.sep, ""),
            line: i + 1,
            text: l.trim(),
          });
        }
      });
    }
  }
  return out;
}

/* ================= API ================= */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, filePath, content, name } = body;

    switch (action) {
      case "tree":
        return NextResponse.json(await listTree(BASE_DIR));

      case "read": {
        const abs = safePath(filePath);
        if (!(await isFile(abs))) throw new Error("Not a file");
        return NextResponse.json({
          content: await fs.readFile(abs, "utf8"),
        });
      }

      case "save": {
        const abs = safePath(filePath);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content ?? "", "utf8");
        return NextResponse.json({ ok: true });
      }

      case "empty": {
        const abs = safePath(filePath);
        await fs.writeFile(abs, "", "utf8");
        return NextResponse.json({ ok: true });
      }

      case "delete": {
        const abs = safePath(filePath);
        await fs.rm(abs, { recursive: true, force: true });
        return NextResponse.json({ ok: true });
      }

      case "createFile": {
        const dir = safePath(filePath);
        await fs.writeFile(path.join(dir, name), content ?? "", "utf8");
        return NextResponse.json({ ok: true });
      }

      case "createFolder": {
        const dir = safePath(filePath);
        await fs.mkdir(path.join(dir, name), { recursive: true });
        return NextResponse.json({ ok: true });
      }

      case "search":
        return NextResponse.json(await searchFiles(BASE_DIR, content));

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("FILE API ERROR:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
