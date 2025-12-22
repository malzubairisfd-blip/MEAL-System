

const DB_NAME = "clustering-db";
const DB_VERSION = 3; // 🔴 MUST BE INCREMENTED

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("rows")) {
        db.createObjectStore("rows");
      }

      if (!db.objectStoreNames.contains("clusters")) {
        db.createObjectStore("clusters");
      }

      if (!db.objectStoreNames.contains("edges")) {
        db.createObjectStore("edges");
      }

      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function isCacheReady(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise<boolean>(resolve => {
      const tx = db.transaction("meta", "readonly");
      const store = tx.objectStore("meta");
      const req = store.get("ready");
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false); // Resolve false on error
    });
  } catch (error) {
    console.error("Failed to check cache readiness:", error);
    return false;
  }
}

export async function loadCachedResult() {
  const ready = await isCacheReady();

  if (!ready) {
    return { status: "LOADING" };
  }

  try {
    const db = await openDB();

    const readAll = (storeName: string): Promise<any[]> =>
      new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.flat());
        req.onerror = () => reject(req.error);
      });
    
    const readHeaders = (): Promise<string[]> =>
      new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction("meta", "readonly");
        const store = tx.objectStore("meta");
        const req = store.get("originalHeaders");
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
    
    const readSingle = (storeName: string, key: string): Promise<any> =>
      new Promise<any>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

    const rows = await readSingle("rows", "all");
    const clusters = await readAll("clusters");
    const edgesUsed = await readAll("edges");
    const originalHeaders = await readHeaders();

    if (!rows || !rows.length) {
      return { status: "CORRUPTED", error: "Cache corrupted: rows missing." };
    }

    return {
      status: "READY",
      data: {
        rows,
        clusters,
        edgesUsed,
        originalHeaders
      }
    };
  } catch (error) {
     console.error("Cache load failed:", error);
     return { status: "ERROR" };
  }
}

    
