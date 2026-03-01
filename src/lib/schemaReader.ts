import Database from "better-sqlite3";
import path from "path";

export function readSchemas() {
  const dbPath = path.join(process.cwd(), "src/data/bnf-assessed.db");
  try {
    const db = new Database(dbPath, { fileMustExist: true });

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[];

    const schema: any = {};

    for (const t of tables) {
      if (t.name) {
        const columns = db.prepare(`PRAGMA table_info(${t.name})`).all();
        schema[t.name] = columns;
      }
    }

    db.close();
    return schema;
  } catch (error) {
    // If the database doesn't exist, return an empty schema.
    if ((error as any).code === 'SQLITE_CANTOPEN') {
      console.warn("schemaReader: bnf-assessed.db not found, returning empty schema.");
      return {};
    }
    // For other errors, re-throw.
    throw error;
  }
}
