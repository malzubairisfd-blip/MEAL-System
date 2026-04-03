import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

const BASE_DIR = process.cwd();

function safePath(relativePath?: string) {
  // Allow empty string for root directory
  if (relativePath === undefined || relativePath === null) throw new Error("Invalid file path");
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

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listTree(dir: string): Promise<any[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes = await Promise.all(
    entries.map(async (e) => {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.next') {
        return null;
      }
      const full = path.join(dir, e.name);
      const rel = path.relative(BASE_DIR, full);
      if (e.isDirectory()) {
        const children = await listTree(full);
        const size = children.reduce((acc, child) => acc + (child?.size || 0), 0);
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
        return {
          type: "file",
          name: e.name,
          path: rel,
          size: 0,
        };
      }
    })
  );
  return (nodes.filter(Boolean) as any[]).sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

async function searchFiles(dir: string, q: string, out: any[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.next') {
        continue;
      }
      await searchFiles(full, q, out);
    } else {
      const txt = await fs.readFile(full, "utf8");
      txt.split("\n").forEach((l, i) => {
        if (l.includes(q)) {
          out.push({
            file: path.relative(BASE_DIR, full),
            line: i + 1,
            text: l.trim(),
          });
        }
      });
    }
  }
  return out;
}


/* ---------- EXPORT HELPERS ---------- */
async function collectFilesRecursive(dir: string, out: any[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    // Skip system folders
    if (
      e.name.startsWith('.') ||
      e.name === 'node_modules' ||
      e.name === '.next'
    ) {
      continue;
    }

    if (e.isDirectory()) {
      await collectFilesRecursive(full, out);
    } else {
      // ✅ Skip binary files
      const ext = path.extname(e.name).toLowerCase();
      const skipExt = [
        ".png",".jpg",".jpeg",".gif",".webp",
        ".ico",".svg",
        ".mp4",".mp3",
        ".woff",".woff2",".ttf",
        ".zip",".exe"
      ];

      if (skipExt.includes(ext)) continue;

      let content = "";

      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        content = "[[BINARY OR UNREADABLE FILE]]";
      }

      out.push({
        path: path.relative(BASE_DIR, full),
        content,
      });
    }
  }

  return out;
}

function cleanFolders(folders: string[]) {
  return folders
    .sort()
    .filter((p, i, arr) => {
      return !arr.some(
        (other) => other !== p && p.startsWith(other + "/")
      );
    });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = formData.get("action");
      
      if (action === "analyzeZip") {
        const zipFile = formData.get("file") as File;
        const targetFolder = formData.get("targetFolder") as string || "";
        const absTarget = safePath(targetFolder);

        if (!zipFile) throw new Error("No zip file provided");
        
        const buffer = Buffer.from(await zipFile.arrayBuffer());
        const zip = new AdmZip(buffer);
        const conflicts: string[] = [];
        
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const resolvedEntry = path.resolve(absTarget, entry.entryName);
          if (await exists(resolvedEntry)) {
             conflicts.push(entry.entryName);
          }
        }
        return NextResponse.json({ conflicts });
      }

      if (action === "uploadZip") {
        const zipFile = formData.get("file") as File;
        const targetFolder = formData.get("targetFolder") as string || "";
        const skipFilesStr = formData.get("skipFiles") as string || "[]";
        const skipFiles = JSON.parse(skipFilesStr) as string[];
        const absTarget = safePath(targetFolder);

        if (!zipFile) throw new Error("No zip file provided");
        
        const buffer = Buffer.from(await zipFile.arrayBuffer());
        const zip = new AdmZip(buffer);
        
        for (const entry of zip.getEntries()) {
          if (skipFiles.includes(entry.entryName)) continue;

          const entryPath = entry.entryName;
          const resolvedEntry = path.resolve(absTarget, entryPath);
          if (!resolvedEntry.startsWith(absTarget)) {
            throw new Error(`Invalid path in zip: ${entryPath}`);
          }

          if (entry.isDirectory) {
            await fs.mkdir(resolvedEntry, { recursive: true });
          } else {
            await fs.mkdir(path.dirname(resolvedEntry), { recursive: true });
            await fs.writeFile(resolvedEntry, entry.getData());
          }
        }
        return NextResponse.json({ ok: true });
      }

      if (action === "uploadFile") {
        const file = formData.get("file") as File;
        const targetFolder = formData.get("targetFolder") as string || "";
        const absTarget = safePath(targetFolder);

        if (!file) throw new Error("No file provided");
        
        const buffer = Buffer.from(await file.arrayBuffer());
        const targetPath = path.join(absTarget, file.name);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, buffer);
        
        return NextResponse.json({ ok: true });
      }
    }

    const body = await req.json();
    const { action, filePath, content, name, oldPath, newName, sourcePath, destinationDir, items, force } = body;

    switch (action) {
      case "tree": {
        const fullTree = await listTree(BASE_DIR);
        return NextResponse.json(fullTree);
      }
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
      case "rename": {
        if (!oldPath || !newName) throw new Error("Missing old path or new name");
        const absOldPath = safePath(oldPath);
        const sanitizedNewName = path.basename(newName);
        if (sanitizedNewName !== newName) throw new Error("Invalid name");
        const absNewPath = path.join(path.dirname(absOldPath), sanitizedNewName);
        await fs.rename(absOldPath, absNewPath);
        return NextResponse.json({ ok: true });
      }
      case "checkConflicts": {
        if (!Array.isArray(items)) throw new Error("Invalid items list");
        const conflicts: string[] = [];
        for (const item of items) {
          const fileName = path.basename(item.source);
          const destDir = safePath(item.destination);
          const targetPath = path.join(destDir, fileName);
          if (await exists(targetPath)) {
            conflicts.push(item.source);
          }
        }
        return NextResponse.json({ conflicts });
      }
      case "move": {
        if (sourcePath !== undefined && destinationDir !== undefined) {
          const absSource = safePath(sourcePath);
          const absDestDir = safePath(destinationDir);
          const fileName = path.basename(absSource);
          const absNewPath = path.join(absDestDir, fileName);
          
          if (absSource === absNewPath) {
              throw new Error("Source and destination are the same");
          }

          if (await exists(absNewPath)) {
            if (force) {
              await fs.rm(absNewPath, { recursive: true, force: true });
            } else {
              return NextResponse.json({ conflict: true, path: sourcePath });
            }
          }
          
          await fs.rename(absSource, absNewPath);
          return NextResponse.json({ ok: true });
        }
        throw new Error("Missing source or destination");
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
      case "exportFolders": {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No folders selected");
  }

  const cleaned = cleanFolders(items);
  const seen = new Set<string>();

  let output = "PROJECT EXPORT\n=====================\n";

  for (const folder of cleaned) {
    const abs = safePath(folder);
    const files = await collectFilesRecursive(abs);

    output +=
      "\n\n############################################\n" +
      `FOLDER: ${folder}\n` +
      "############################################\n\n";

    for (const f of files) {
      if (seen.has(f.path)) continue;
      seen.add(f.path);

      output +=
        "\n════════════════════════════════════════════\n" +
        `FILE: ${f.path}\n` +
        "════════════════════════════════════════════\n\n" +
        (f.content || "[EMPTY FILE]") +
        "\n";
    }
  }

  return NextResponse.json({
    content: output,
    totalFiles: seen.size,
  });
}

      case "downloadZip": {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error("No items selected for download.");
        }
        const zip = new AdmZip();
        
        for (const itemPath of items) {
            const absolutePath = safePath(itemPath);
            const stats = await fs.stat(absolutePath);

            if (stats.isDirectory()) {
                zip.addLocalFolder(absolutePath, itemPath);
            } else {
                const zipDir = path.dirname(itemPath);
                zip.addLocalFile(absolutePath, zipDir === '.' ? '' : zipDir);
            }
        }
    
        const zipBuffer = zip.toBuffer();
    
        return new NextResponse(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="file-export.zip"`,
            },
        });
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
