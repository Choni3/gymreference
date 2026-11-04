// Thin promise wrapper around IndexedDB. All app data lives on the device.

const DB_NAME = 'gymreference';
const DB_VERSION = 1;
export const STORES = ['exercises', 'routines', 'photos'];

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function result(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(store, id) {
  const db = await open();
  return result(db.transaction(store).objectStore(store).get(id));
}

export async function all(store) {
  const db = await open();
  return result(db.transaction(store).objectStore(store).getAll());
}

export async function put(store, value) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
  return value;
}

export async function del(store, id) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await done(tx);
}

// Write many records across stores in one transaction. ops: [{ store, value }] or [{ store, delete: id }]
export async function writeMany(ops, { clear = false } = {}) {
  const db = await open();
  const tx = db.transaction(STORES, 'readwrite');
  try {
    if (clear) for (const s of STORES) tx.objectStore(s).clear();
    for (const op of ops) {
      const os = tx.objectStore(op.store);
      if ('delete' in op) os.delete(op.delete);
      else os.put(op.value);
    }
  } catch (err) {
    tx.abort(); // e.g. a record without an id: keep existing data instead of committing the clear
    throw err;
  }
  await done(tx);
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
