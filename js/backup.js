// Full backup (including photos as data URLs) to a single JSON file, and restore.
import * as db from './db.js';
import { blobToDataURL, dataURLToBlob } from './images.js';

export async function exportBackup() {
  const [exercises, routines, photos] = await Promise.all(db.STORES.map((s) => db.all(s)));
  const photoData = [];
  for (const p of photos) photoData.push({ id: p.id, caption: p.caption || '', data: await blobToDataURL(p.blob) });
  const json = JSON.stringify({ app: 'gymreference', version: 1, exportedAt: new Date().toISOString(), exercises, routines, photos: photoData });
  return new Blob([json], { type: 'application/json' });
}

// Replaces all current data with the backup's contents.
export async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a valid backup.');
  }
  if (data.app !== 'gymreference') throw new Error('That file is not a GymReference backup.');
  const ops = [];
  for (const e of data.exercises || []) ops.push({ store: 'exercises', value: e });
  for (const r of data.routines || []) ops.push({ store: 'routines', value: r });
  for (const p of data.photos || []) {
    ops.push({ store: 'photos', value: { id: p.id, caption: p.caption || '', blob: await dataURLToBlob(p.data) } });
  }
  await db.writeMany(ops, { clear: true });
}
