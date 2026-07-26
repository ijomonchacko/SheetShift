// IndexedDB session persistence: keeps the last reviewed plan (plus the
// original file) so an accidental refresh doesn't lose the review work.
// Everything stays on-device — this is browser storage, not a server.

const DB_NAME = "sheetshift";
const STORE = "session";
const KEY = "last";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save the current session (best-effort — failures are swallowed). */
export async function saveSession({ fileName, fileBlob, plan, detectMeta, settings }) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        { fileName, fileBlob, plan, detectMeta, settings, savedAt: Date.now() },
        KEY
      );
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* private browsing / quota — session restore just won't be offered */
  }
}

/** Load the last session, or null. */
export async function loadSession() {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
