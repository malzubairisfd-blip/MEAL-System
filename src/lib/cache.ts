
import { openDB, IDBPDatabase } from 'idb';
import type { RecordRow } from './types';
import type { AuditFinding } from './auditEngine';

const DB_NAME = 'beneficiary-insights-cache';
const DB_VERSION = 1;
const STORE_NAME = 'results';
const FULL_RESULT_KEY = 'FULL_RESULT';

interface FullResult {
  rows: RecordRow[];
  clusters: any[]; 
  originalHeaders: string[];
  auditFindings?: AuditFinding[];
  chartImages?: Record<string, string>;
  processedDataForReport?: any;
}


async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

/**
 * Caches the initial raw data immediately after upload and ID generation.
 * This overwrites any existing data.
 */
export async function cacheRawData(payload: { rows: RecordRow[], originalHeaders: string[] }): Promise<void> {
    const db = await getDb();
    const resultToCache: FullResult = {
        rows: payload.rows || [],
        originalHeaders: payload.originalHeaders || [],
        clusters: [], // Initialize clusters as empty
    };
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).put(resultToCache, FULL_RESULT_KEY);
    await tx.done;
}

/**
 * Updates the cached result with final cluster information.
 * This assumes raw data has already been cached.
 */
export async function cacheFinalResult(payload: { clusters: any[] }): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const currentData = await store.get(FULL_RESULT_KEY) as FullResult | undefined;

    if (!currentData) {
        throw new Error("Cannot cache final results because raw data was not found. Please re-upload the file.");
    }
    
    const updatedData: FullResult = {
        ...currentData,
        clusters: payload.clusters || [],
    };
    
    await store.put(updatedData, FULL_RESULT_KEY);
    await tx.done;
}


export async function loadCachedResult(): Promise<FullResult | null> {
  try {
    const db = await getDb();
    const result = await db.transaction(STORE_NAME).objectStore(STORE_NAME).get(FULL_RESULT_KEY);
    return result as FullResult | null;
  } catch (error) {
     console.error("Failed to load cached result:", error);
     return null;
  }
}

  