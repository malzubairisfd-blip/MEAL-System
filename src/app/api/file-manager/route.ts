import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "src");

async function listTree(dir: string): Promise<any[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return Promise.all(
        entries.map(async (e) => {
            const full = path.join(dir, e.name);
            if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'public' || e.name.endsWith('.json')) return null;
            
            if (e.isDirectory()) {
                 const children = await listTree(full);
                 if(children.length > 0) {
                    return {
                        type: "folder",
                        name: e.name,
                        path: full.replace(BASE_DIR + path.sep, ""),
                        children: children,
                    };
                 }
            } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
                 return {
                    type: "file",
                    name: e.name,
                    path: full.replace(BASE_DIR + path.sep, ""),
                };
            }
            return null;
        })
    ).then(entries => entries.filter(e => e !== null)) as Promise<any[]>;
}

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

export async function POST(req: Request) {
    const body = await req.json();
    const { action, filePath, content, name } = body;
    const abs = filePath ? path.join(BASE_DIR, filePath) : BASE_DIR;

    try {
        switch (action) {
            case "tree":
                return NextResponse.json(await listTree(BASE_DIR));

            case "read":
                if (!abs) return NextResponse.json({ error: "File path is required" }, { status: 400 });
                return NextResponse.json({ content: await fs.readFile(abs, "utf8") });

            case "save":
                 if (!abs) return NextResponse.json({ error: "File path is required" }, { status: 400 });
                await fs.writeFile(abs, content || "");
                return NextResponse.json({ ok: true });

            case "empty":
                 if (!abs) return NextResponse.json({ error: "File path is required" }, { status: 400 });
                await fs.writeFile(abs, "");
                return NextResponse.json({ ok: true });

            case "delete":
                if (!abs) return NextResponse.json({ error: "File path is required" }, { status: 400 });
                await fs.rm(abs, { recursive: true, force: true });
                return NextResponse.json({ ok: true });

            case "createFile":
                if (!abs || !name) return NextResponse.json({ error: "Folder path and file name are required" }, { status: 400 });
                await fs.writeFile(path.join(abs, name), content || "");
                return NextResponse.json({ ok: true });

            case "createFolder":
                 if (!abs || !name) return NextResponse.json({ error: "Parent path and folder name are required" }, { status: 400 });
                await fs.mkdir(path.join(abs, name), { recursive: true });
                return NextResponse.json({ ok: true });

            case "search":
                if(!content) return NextResponse.json([]);
                return NextResponse.json(await searchFiles(BASE_DIR, content));

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
