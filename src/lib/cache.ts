import { openDB } from "idb";

export async function loadCachedResult() {
  const cacheId = sessionStorage.getItem('cacheId');
  if (!cacheId) {
    return { status: "NO_DATA" };
  }

  try {
    const db = await openDB('beneficiary-insights-cache', 1);
    const result = await db.transaction('results').objectStore('results').get('FULL_RESULT');
    
    if (!result || !result.rows || result.rows.length === 0) {
      return { status: "NO_DATA", error: "Cache is empty or corrupted." };
    }

    return {
      status: "READY",
      data: result
    };
  } catch (error) {
     console.error("Cache load failed:", error);
     return { status: "ERROR" };
  }
}
