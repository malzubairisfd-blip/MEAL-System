import fs from "fs/promises";
import path from "path";

const BASE = path.join(process.cwd(), "src");

export async function scanFiles(dir = BASE, result: any[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await scanFiles(full, result);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      const content = await fs.readFile(full, "utf8");

      const functions = [...content.matchAll(/function\s+(\w+)/g)].map(m => m[1]);
      const exports = [...content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m => m[1]);
      const imports = [...content.matchAll(/from\s+['"](.*?)['"]/g)].map(m => m[1]);

      result.push({
        file: full.replace(process.cwd(), ""),
        functions,
        exports,
        imports,
      });
    }
  }

  return result;
}
