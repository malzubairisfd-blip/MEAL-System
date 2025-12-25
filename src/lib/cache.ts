import { openDB } from "idb";

export async function loadCachedResult() {
  try {
    const db = await openDB('beneficiary-insights-cache', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('results')) {
            db.createObjectStore('results');
          }
        }
    });
    const result = await db.transaction('results').objectStore('results').get('FULL_RESULT');
    return result;
  } catch (error) {
     console.error("Cache load failed:", error);
     return null;
  }
}

    