import fs from "fs/promises";
import path from "path";

export async function analyzeAPIs() {
  const apiDir = path.join(process.cwd(), "src/app/api");
  const endpoints: any[] = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.name === "route.ts") {
          const content = await fs.readFile(full, "utf8");

          endpoints.push({
            route: full.replace(apiDir, "/api").replace(/\\/g, '/').replace('/route.ts',''),
            methods: [
              content.includes("GET") && "GET",
              content.includes("POST") && "POST",
              content.includes("PUT") && "PUT",
              content.includes("DELETE") && "DELETE",
            ].filter(Boolean),
          });
        }
      }
    } catch (error) {
      // Ignore errors from directories that might not exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error walking directory ${dir}:`, error);
      }
    }
  }

  await walk(apiDir);
  return endpoints;
}