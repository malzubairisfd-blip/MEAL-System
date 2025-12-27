
import { openDB, IDBPDatabase } from 'idb';
import type { RecordRow } from './types';
import type { AuditFinding } from './auditEngine';

const DB_NAME = 'beneficiary-insights-cache';
const DB_VERSION = 1;

// Define a type for the full result structure
interface FullResult {
  rows: RecordRow[];
  clusters: any[]; // Consider defining a proper type for clusters
  edgesUsed: any[];
  originalHeaders: string[];
  auditFindings?: AuditFinding[];
  chartImages?: Record<string, string>;
  processedDataForReport?: any;
}


async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results');
      }
    },
  });
}

export async function cacheFinalResult(payload: any, originalHeaders: string[]): Promise<void> {
    const db = await getDb();
    const resultToCache: FullResult = {
        rows: payload.rows || [],
        clusters: payload.clusters || [],
        edgesUsed: payload.edgesUsed || [],
        originalHeaders: originalHeaders
    };
    const tx = db.transaction('results', 'readwrite');
    await tx.objectStore('results').put(resultToCache, 'FULL_RESULT');
    await tx.done;
}

export async function loadCachedResult(): Promise<FullResult | null> {
  try {
    const db = await getDb();
    const result = await db.transaction('results').objectStore('results').get('FULL_RESULT');
    return result as FullResult | null;
  } catch (error) {
     console.error("Failed to load cached result:", error);
     return null;
  }
}
