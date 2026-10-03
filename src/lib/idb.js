// Tiny IndexedDB key-value store (no dependency). Used for things too big for localStorage:
// uploaded files on the client side, and every client record on the admin side.
const DB = 'bkcg-kickoff';
const STORE = 'kv';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot store data (private mode?).')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open browser storage.'));
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage write was aborted (disk full?).'));
  }));
}

export const idbGet = (key) => tx('readonly', (s) => s.get(key));
export const idbSet = (key, val) => tx('readwrite', (s) => { s.put(val, key); });
export const idbDel = (key) => tx('readwrite', (s) => { s.delete(key); });
export const idbKeys = () => tx('readonly', (s) => s.getAllKeys());

// localStorage helpers that never throw.
export function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
