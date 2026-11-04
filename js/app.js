import * as db from './db.js';
import { h, blobURL, revokeURLs, takeURLs, toast, pickFiles, renderCues } from './ui.js';
import { compressImage, captureFrame } from './images.js';
import { parseStrong } from './strong.js';
import { STARTER, STARTER_ROUTINES, RENAMED, SWAPS, DEFAULTS_VERSION, LEGACY_CUES, cueHash } from './seed.js';
import { exportBackup, importBackup } from './backup.js';

const app = document.getElementById('app');

// ---------- data helpers ----------

const byName = (a, b) => a.name.localeCompare(b.name);

const starterByName = new Map(STARTER.map((s) => [s.name.toLowerCase(), s]));

// Known lifts start from the built-in default cues; the user adds their own notes/photos on top.
function newExercise(name) {
  const s = starterByName.get(name.trim().toLowerCase());
  return { id: db.uid(), name, muscles: s?.muscles || '', cues: s?.cues || '', notes: '', links: [...(s?.links || [])], photoIds: [], updatedAt: Date.now() };
}

// Default reference photos for a known lift that has no photos yet. Adds the new ids to
// ex.photoIds and returns the photo writes. If any download fails (offline), nothing is added.
async function defaultPhotoOps(ex, starter = starterByName.get(ex.name.trim().toLowerCase())) {
  if (!starter || ex.photoIds.length) return [];
  const ops = [];
  try {
    for (const p of starter.photos) {
      const res = await fetch(p.src);
      if (!res.ok) return [];
      ops.push({ store: 'photos', value: { id: db.uid(), blob: await res.blob(), caption: p.caption } });
    }
  } catch {
    return []; // offline: all or nothing, so it can be retried later from Settings
  }
  ex.photoIds.push(...ops.map((o) => o.value.id));
  return ops;
}

// Bring existing exercises up to date with the defaults: fill empty cues or replace untouched
// older default cues, add missing links and missing photos. User-edited content is kept.
// complete=false means some default photos couldn't be downloaded (offline).
async function applyDefaultsToAll() {
  let updated = 0, complete = true;
  for (const { id, name } of await db.all('exercises')) {
    const s = starterByName.get(name.trim().toLowerCase());
    if (!s) continue;
    const before = await db.get('exercises', id);
    const photoOps = await defaultPhotoOps({ name, photoIds: before.photoIds.slice() }, s);
    if (!before.photoIds.length && !photoOps.length) complete = false;
    // Re-read after the (slow) downloads so concurrent edits aren't overwritten.
    const ex = await db.get('exercises', id);
    if (!ex) continue; // deleted meanwhile
    let changed = false, photoWrites = [];
    if (photoOps.length && !ex.photoIds.length) {
      ex.photoIds = photoOps.map((o) => o.value.id);
      photoWrites = photoOps;
      changed = true;
    }
    const oldDefault = LEGACY_CUES.has(`${s.name.toLowerCase()}:${cueHash(ex.cues)}`);
    if ((!ex.cues.trim() || oldDefault) && ex.cues !== s.cues) {
      ex.cues = s.cues;
      if (!ex.muscles) ex.muscles = s.muscles;
      changed = true;
    }
    if (!ex.links.length && s.links.length) {
      ex.links = [...s.links];
      changed = true;
    }
    if (!changed) continue;
    await db.writeMany([...photoWrites, { store: 'exercises', value: { ...ex, updatedAt: Date.now() } }]);
    updated++;
  }
  return { updated, complete };
}

const templateFor = (name) => STARTER_ROUTINES.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());

// The exercise with this name, created with its defaults if missing (writes go to ops).
// byName: Map of lowercase name → exercise.
async function exerciseFor(name, byName, ops) {
  const key = name.trim().toLowerCase();
  let ex = byName.get(key);
  if (!ex) {
    ex = newExercise(name.trim());
    byName.set(key, ex);
    ops.push(...(await defaultPhotoOps(ex)), { store: 'exercises', value: ex });
  }
  return ex;
}

// Items plus the template's extra exercises (e.g. Preacher Curl on Biceps) that are missing.
async function withExtras(items, template, byName, ops) {
  const out = [...items];
  for (const n of template?.ensure || []) {
    const ex = await exerciseFor(n, byName, ops);
    if (!out.some((i) => i.exerciseId === ex.id)) out.push({ exerciseId: ex.id, sets: '3', reps: '', note: '' });
  }
  return out;
}

// Create the template routines whose name doesn't exist yet (marked template: true until
// the user edits them), and add template extras to existing routines of the same name.
async function addTemplateRoutines() {
  const routines = await db.all('routines');
  const byName = new Map((await db.all('exercises')).map((e) => [e.name.trim().toLowerCase(), e]));
  const ops = [];
  let added = 0, extended = 0;
  for (const t of STARTER_ROUTINES) {
    const existing = routines.find((r) => r.name.trim().toLowerCase() === t.name.toLowerCase());
    if (existing) {
      const items = await withExtras(existing.items, t, byName, ops);
      if (items.length !== existing.items.length) {
        ops.push({ store: 'routines', value: { ...existing, items, updatedAt: Date.now() } });
        extended++;
      }
      continue;
    }
    const items = [];
    for (const n of t.exercises) items.push({ exerciseId: (await exerciseFor(n, byName, ops)).id, sets: '3', reps: '', note: '' });
    ops.push({ store: 'routines', value: { id: db.uid(), name: t.name, items, template: true, updatedAt: Date.now() } });
    added++;
  }
  await db.writeMany(ops);
  return { added, extended };
}

// Read-check-write work that creates routines/exercises runs one at a time across all open
// tabs: an update reloads every tab at once, and each one used to create the templates.
function exclusive(fn) {
  return navigator.locks ? navigator.locks.request('gymreference-write', fn) : fn();
}

// Repair for duplicates created by tabs running the template setup at the same time: keeps
// one routine per template name (a user-edited one wins) and merges same-name exercises into
// one (the one the kept routines use), moving over notes, links and non-default photos.
async function dedupeTemplates() {
  const ops = [];
  const kept = [];
  const names = new Set();
  const routines = (await db.all('routines')).sort((a, b) => !!a.template - !!b.template || a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
  for (const r of routines) {
    const key = r.name.trim().toLowerCase();
    if (r.template && names.has(key)) ops.push({ store: 'routines', delete: r.id });
    else kept.push(r);
    names.add(key);
  }
  const used = new Set(kept.flatMap((r) => r.items.map((i) => i.exerciseId)));
  const groups = new Map();
  for (const e of await db.all('exercises')) {
    const key = e.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  const remap = new Map();
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const keeper = group.find((e) => used.has(e.id)) || group[0];
    const defaults = new Set((starterByName.get(key)?.photos || []).map((p) => p.caption));
    const keeperPhotos = await Promise.all(keeper.photoIds.map((id) => db.get('photos', id)));
    const keeperHasDefaults = keeperPhotos.some((p) => p && defaults.has(p.caption));
    for (const dup of group) {
      if (dup === keeper) continue;
      remap.set(dup.id, keeper.id);
      for (const id of dup.photoIds) {
        const photo = await db.get('photos', id);
        if (photo && keeperHasDefaults && defaults.has(photo.caption)) ops.push({ store: 'photos', delete: id });
        else if (photo) keeper.photoIds.push(id);
      }
      const notes = dup.notes.trim();
      if (notes && !keeper.notes.includes(notes)) keeper.notes = [keeper.notes.trim(), notes].filter(Boolean).join('\n');
      // Never drop cues the user wrote: they replace default cues, else go into the notes.
      const isDefault = (c) => !c.trim() || c === starterByName.get(key)?.cues || LEGACY_CUES.has(`${key}:${cueHash(c)}`);
      if (!isDefault(dup.cues) && dup.cues !== keeper.cues) {
        if (isDefault(keeper.cues)) keeper.cues = dup.cues;
        else keeper.notes = [keeper.notes.trim(), dup.cues.trim()].filter(Boolean).join('\n');
      }
      const defaultMuscles = (m) => !m.trim() || m === starterByName.get(key)?.muscles;
      if (!defaultMuscles(dup.muscles) && dup.muscles !== keeper.muscles) {
        if (defaultMuscles(keeper.muscles)) keeper.muscles = dup.muscles;
        else keeper.notes = [keeper.notes.trim(), `Muscles: ${dup.muscles.trim()}`].filter(Boolean).join('\n');
      }
      keeper.links = [...new Set([...keeper.links, ...dup.links])];
      ops.push({ store: 'exercises', delete: dup.id });
    }
    ops.push({ store: 'exercises', value: { ...keeper, updatedAt: Date.now() } });
  }
  for (const r of kept) {
    if (r.items.some((i) => remap.has(i.exerciseId))) {
      ops.push({ store: 'routines', value: { ...r, items: r.items.map((i) => ({ ...i, exerciseId: remap.get(i.exerciseId) || i.exerciseId })) } });
    }
  }
  if (ops.length) await db.writeMany(ops);
  return ops.length > 0;
}

// Exercises renamed in the defaults (RENAMED): rename in place (routines keep pointing at
// them), swap the old default photos and links for the new ones, keep everything the user
// added. Old default cues are replaced afterwards by applyDefaultsToAll (LEGACY_CUES).
// Skipped while the new photos can't be downloaded, so it's retried next launch.
async function applyRenames() {
  let renamed = 0, complete = true;
  for (const { id, name } of await db.all('exercises')) {
    const r = RENAMED[name.trim().toLowerCase()];
    if (!r) continue;
    const starter = starterByName.get(r.name.toLowerCase());
    const fresh = await defaultPhotoOps({ name: r.name, photoIds: [] }, starter);
    if (!fresh.length) { complete = false; continue; }
    // Re-read after the downloads so edits made meanwhile are kept.
    const ex = await db.get('exercises', id);
    if (!ex || ex.name.trim().toLowerCase() !== name.trim().toLowerCase()) continue;
    const photos = await Promise.all(ex.photoIds.map((pid) => db.get('photos', pid)));
    const oldIds = photos.filter((p) => p && r.oldCaptions.includes(p.caption)).map((p) => p.id);
    await db.writeMany([
      ...oldIds.map((id) => ({ store: 'photos', delete: id })),
      ...fresh,
      { store: 'exercises', value: {
        ...ex,
        name: r.name,
        links: [...new Set([...starter.links, ...ex.links.filter((l) => !r.oldLinks.includes(l))])],
        photoIds: [...fresh.map((o) => o.value.id), ...ex.photoIds.filter((pid) => !oldIds.includes(pid))],
        updatedAt: Date.now(),
      } },
    ]);
    renamed++;
  }
  return { renamed, complete };
}

// Routine swaps (SWAPS): in the named routine, point items at the new exercise (created with
// its defaults if needed), keeping sets/reps/notes. The old exercise stays in the library.
async function applySwaps(prev) {
  let swapped = 0;
  const key = (n) => n.trim().toLowerCase();
  for (const sw of SWAPS) {
    if (prev >= sw.since) continue;
    const exercises = await db.all('exercises');
    const byName = new Map(exercises.map((e) => [key(e.name), e]));
    // Every exercise with the old name (there may be same-name duplicates).
    const fromIds = new Set(exercises.filter((e) => key(e.name) === key(sw.from)).map((e) => e.id));
    const uses = (r) => key(r.name) === key(sw.routine) && r.items.some((i) => fromIds.has(i.exerciseId));
    if (!(await db.all('routines')).some(uses)) continue;
    const ops = [];
    const to = await exerciseFor(sw.to, byName, ops);
    if (ops.length) await db.writeMany(ops);
    // Re-read after the (slow) photo downloads so routine edits made meanwhile are kept.
    const routineOps = (await db.all('routines')).filter(uses).map((r) => ({ store: 'routines', value: {
      ...r, items: r.items.map((i) => (fromIds.has(i.exerciseId) ? { ...i, exerciseId: to.id } : i)), updatedAt: Date.now(),
    } }));
    await db.writeMany(routineOps);
    swapped += routineOps.length;
  }
  return swapped;
}

// Once per DEFAULTS_VERSION (retried while offline), refresh defaults on existing exercises.
// Version 3 introduced the routine templates: create them once. Version 4 repairs duplicates.
function upgradeDefaults() {
  return exclusive(upgradeDefaultsLocked);
}
async function upgradeDefaultsLocked() {
  const prev = Number(localStorage.getItem('defaultsVersion'));
  if (prev >= DEFAULTS_VERSION) return;
  const routinesAdded = prev < 3 && !localStorage.getItem('templatesAdded') ? (await addTemplateRoutines()).added : 0;
  localStorage.setItem('templatesAdded', '1');
  const renames = await applyRenames();
  const swapped = await applySwaps(prev);
  const repaired = await dedupeTemplates();
  const { updated, complete } = await applyDefaultsToAll();
  if (complete && renames.complete) localStorage.setItem('defaultsVersion', String(DEFAULTS_VERSION));
  if (updated || routinesAdded || repaired || renames.renamed || swapped) {
    toast(repaired && !routinesAdded ? 'Removed duplicate routines and exercises.' : routinesAdded
      ? `Added ${routinesAdded} routine template${routinesAdded > 1 ? 's' : ''}.`
      : `Updated default cues & photos for ${updated} exercise${updated > 1 ? 's' : ''}.`);
    if (!location.hash.includes('/edit')) render(); // don't discard edits in progress
  }
}

async function findExerciseByName(name) {
  const key = name.trim().toLowerCase();
  return (await db.all('exercises')).find((e) => e.name.trim().toLowerCase() === key);
}

async function firstPhoto(ex) {
  return ex.photoIds.length ? db.get('photos', ex.photoIds[0]) : null;
}

async function deleteExercise(ex) {
  const routines = await db.all('routines');
  const ops = ex.photoIds.map((id) => ({ store: 'photos', delete: id }));
  ops.push({ store: 'exercises', delete: ex.id });
  for (const r of routines) {
    if (r.items.some((i) => i.exerciseId === ex.id)) {
      ops.push({ store: 'routines', value: { ...r, items: r.items.filter((i) => i.exerciseId !== ex.id) } });
    }
  }
  await db.writeMany(ops);
}

let persistAsked = false;
function askPersist() {
  if (persistAsked || !navigator.storage?.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => {});
}

// ---------- layout ----------

function screen({ title, back, action }, ...body) {
  return [
    h('header', { class: 'bar' },
      back ? h('a', { class: 'bar-btn', href: back, 'aria-label': 'Back' }, '‹ Back') : h('span', { class: 'bar-btn' }),
      h('h1', {}, title),
      action || h('span', { class: 'bar-btn' })),
    h('main', {}, ...body),
  ];
}

function thumb(photo, cls = 'thumb') {
  return photo
    ? h('img', { class: cls, src: blobURL(photo.blob), alt: '', width: 56, height: 56, loading: 'lazy', decoding: 'async' })
    : h('div', { class: `${cls} empty`, role: 'img', 'aria-label': 'No photo' }, '🏋️');
}

function exerciseRow(ex, photo, { href, meta }) {
  return h('a', { class: 'row', href },
    thumb(photo),
    h('div', { class: 'row-text' }, h('strong', {}, ex.name), meta ? h('span', { class: 'muted' }, meta) : null),
    h('span', { class: 'chev' }, '›'));
}

// ---------- screens ----------

async function homeScreen() {
  // Template routines first in their usual order (Push, Pull, Legs…), then the rest by name.
  const rank = (r) => { const i = STARTER_ROUTINES.findIndex((t) => t.name.toLowerCase() === r.name.trim().toLowerCase()); return i < 0 ? Infinity : i; };
  const routines = (await db.all('routines')).sort((a, b) => rank(a) - rank(b) || byName(a, b));
  const exercises = await db.all('exercises');
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const showInstall = isIOS && !standalone && !localStorage.getItem('hideInstall');

  return screen({ title: 'GymReference', action: h('a', { class: 'bar-btn', href: '#/settings', 'aria-label': 'Settings' }, '⚙︎') },
    showInstall && h('div', { class: 'card hint' },
      h('p', {}, 'Tip: tap ', h('b', {}, 'Share → Add to Home Screen'), ' first, and use the app from there: it works offline and your photos are kept safe. Data added here in Safari does not carry over (use Settings → Backup to move it).'),
      h('button', { class: 'link', onclick: (e) => { localStorage.setItem('hideInstall', '1'); e.target.closest('.hint').remove(); } }, 'Dismiss')),
    h('h2', {}, 'Routines'),
    routines.length
      ? h('div', { class: 'list' }, routines.map((r) =>
          h('a', { class: 'row', href: `#/routine/${r.id}` },
            h('div', { class: 'row-text' }, h('strong', {}, r.name), h('span', { class: 'muted' }, `${r.items.length} exercises`)),
            h('span', { class: 'chev' }, '›'))))
      : h('p', { class: 'muted' }, 'No routines yet. Create one, or import from Strong in Settings.'),
    h('button', { class: 'btn', onclick: async () => {
      const r = { id: db.uid(), name: 'New routine', items: [], updatedAt: Date.now() };
      await db.put('routines', r);
      location.hash = `#/routine/${r.id}/edit`;
    } }, '+ New routine'),
    h('h2', {}, 'Library'),
    h('div', { class: 'list' },
      h('a', { class: 'row', href: '#/exercises' },
        h('div', { class: 'row-text' }, h('strong', {}, 'All exercises'), h('span', { class: 'muted' }, `${exercises.length} exercises`)),
        h('span', { class: 'chev' }, '›'))),
    versionFooter());
}

// "GymReference v7 · Check for updates" at the bottom of the home screen.
function versionFooter() {
  const label = h('span', {}, 'GymReference');
  appVersion().then((v) => { label.textContent = `GymReference ${v}`; });
  return h('p', { class: 'muted app-footer' }, label, ' · ', h('button', { class: 'link', onclick: updateButtonClick }, 'Check for updates'));
}

async function exercisesScreen() {
  const exercises = (await db.all('exercises')).sort(byName);
  const rows = await Promise.all(exercises.map(async (ex) =>
    exerciseRow(ex, await firstPhoto(ex), { href: `#/exercise/${ex.id}`, meta: `${ex.photoIds.length} photos` })));
  const search = h('input', { type: 'search', placeholder: 'Search exercises', class: 'search',
    oninput: () => {
      const q = search.value.trim().toLowerCase();
      rows.forEach((row, i) => { row.hidden = q && !exercises[i].name.toLowerCase().includes(q); });
    } });
  return screen({ title: 'Exercises', back: '#/' },
    search,
    rows.length ? h('div', { class: 'list' }, rows) : h('p', { class: 'muted' }, 'No exercises yet.'),
    h('button', { class: 'btn', onclick: async () => {
      const ex = newExercise('New exercise');
      await db.put('exercises', ex);
      location.hash = `#/exercise/${ex.id}/edit`;
    } }, '+ New exercise'));
}

async function routineScreen(id) {
  const r = await db.get('routines', id);
  if (!r) return notFound();
  const rows = [];
  for (const [i, item] of r.items.entries()) {
    const ex = await db.get('exercises', item.exerciseId);
    if (!ex) continue;
    const meta = [item.sets && item.reps ? `${item.sets} × ${item.reps}` : item.sets ? `${item.sets} sets` : '', item.note].filter(Boolean).join(' · ');
    rows.push(exerciseRow(ex, await firstPhoto(ex), { href: `#/exercise/${ex.id}?r=${r.id}&i=${i}`, meta }));
  }
  return screen({ title: r.name, back: '#/', action: h('a', { class: 'bar-btn', href: `#/routine/${r.id}/edit` }, 'Edit') },
    rows.length ? h('div', { class: 'list' }, rows) : h('p', { class: 'muted' }, 'No exercises in this routine. Tap Edit to add some.'));
}

async function routineEditScreen(id) {
  const r = await db.get('routines', id);
  if (!r) return notFound();
  const exercises = (await db.all('exercises')).sort(byName);
  const exName = new Map(exercises.map((e) => [e.id, e.name]));
  const items = r.items.filter((i) => exName.has(i.exerciseId)).map((i) => ({ ...i }));

  const name = h('input', { value: r.name, placeholder: 'Routine name' });
  const list = h('div', { class: 'list' });

  function draw() {
    list.replaceChildren(...items.map((item, idx) =>
      h('div', { class: 'row edit-row' },
        h('div', { class: 'row-text' },
          h('strong', {}, exName.get(item.exerciseId)),
          h('div', { class: 'inline' },
            h('input', { value: item.sets || '', inputmode: 'numeric', placeholder: 'sets', 'aria-label': 'Sets', oninput: (e) => { item.sets = e.target.value; } }),
            h('span', {}, '×'),
            h('input', { value: item.reps || '', placeholder: 'reps', 'aria-label': 'Reps', oninput: (e) => { item.reps = e.target.value; } })),
          h('input', { value: item.note || '', placeholder: 'Note (e.g. pause at bottom)', oninput: (e) => { item.note = e.target.value; } })),
        h('div', { class: 'stack' },
          h('button', { class: 'icon', disabled: idx === 0, 'aria-label': 'Move up', onclick: () => { items.splice(idx - 1, 0, items.splice(idx, 1)[0]); draw(); } }, '↑'),
          h('button', { class: 'icon', disabled: idx === items.length - 1, 'aria-label': 'Move down', onclick: () => { items.splice(idx + 1, 0, items.splice(idx, 1)[0]); draw(); } }, '↓'),
          h('button', { class: 'icon danger', 'aria-label': 'Remove', onclick: () => { items.splice(idx, 1); draw(); } }, '✕')))));
  }
  draw();

  const suggestions = new Set([...exercises.map((e) => e.name), ...STARTER.map((s) => s.name)]);
  const options = h('datalist', { id: 'ex-options' }, [...suggestions].map((n) => h('option', { value: n })));
  const addInput = h('input', { list: 'ex-options', placeholder: 'Exercise name (existing or new)' });
  async function addExercise() {
    const n = addInput.value.trim();
    if (!n) return;
    let ex = await findExerciseByName(n);
    if (!ex) {
      ex = newExercise(n);
      await db.writeMany([...(await defaultPhotoOps(ex)), { store: 'exercises', value: ex }]);
      if (!suggestions.has(ex.name)) options.append(h('option', { value: ex.name }));
    }
    exName.set(ex.id, ex.name);
    items.push({ exerciseId: ex.id, sets: '3', reps: '', note: '' });
    addInput.value = '';
    draw();
  }

  async function save() {
    // Edited by the user: no longer a template a Strong import may replace.
    await db.put('routines', { ...r, name: name.value.trim() || 'Untitled routine', items, template: false, updatedAt: Date.now() });
    location.hash = `#/routine/${r.id}`;
  }

  return screen({ title: 'Edit routine', back: `#/routine/${r.id}`, action: h('button', { class: 'bar-btn primary', onclick: save }, 'Save') },
    h('label', {}, 'Name', name),
    h('h2', {}, 'Exercises'),
    list,
    h('div', { class: 'inline add' }, addInput, options, h('button', { class: 'btn small', onclick: addExercise }, 'Add')),
    h('button', { class: 'btn danger', onclick: async () => {
      if (!confirm(`Delete routine "${r.name}"? Exercises are kept.`)) return;
      await db.del('routines', r.id);
      location.hash = '#/';
    } }, 'Delete routine'));
}

// Photo adding shared by the exercise and edit screens. Writes go straight to the DB;
// ex is mutated in place so later writes of ex keep the new photo ids.
function photoAdder(ex, onAdded) {
  const grabber = h('div');
  async function addBlobs(blobs) {
    askPersist();
    const ops = blobs.map((blob) => ({ store: 'photos', value: { id: db.uid(), blob, caption: '' } }));
    ex.photoIds.push(...ops.map((o) => o.value.id));
    ex.updatedAt = Date.now();
    ops.push({ store: 'exercises', value: { ...ex } });
    await db.writeMany(ops);
    await onAdded();
  }

  async function addPhotos() {
    const files = await pickFiles({ accept: 'image/*', multiple: true });
    if (!files.length) return;
    toast(`Adding ${files.length} photo${files.length > 1 ? 's' : ''}…`);
    const blobs = [];
    for (const f of files) {
      try { blobs.push(await compressImage(f)); } catch (err) { toast(err.message); }
    }
    if (blobs.length) await addBlobs(blobs);
  }

  async function grabFromVideo() {
    const [file] = await pickFiles({ accept: 'video/*' });
    if (!file) return;
    const url = URL.createObjectURL(file);
    const video = h('video', { src: url, playsinline: true, muted: true, preload: 'auto', controls: true });
    video.setAttribute('playsinline', '');
    const slider = h('input', { type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': 'Scrub video' });
    const time = h('span', { class: 'muted' }, '0.0s');
    const status = h('span', { class: 'muted' });
    let captured = 0;
    const seek = (t) => { video.currentTime = Math.max(0, Math.min(video.duration || 0, t)); };
    slider.addEventListener('input', () => seek((slider.value / 1000) * (video.duration || 0)));
    video.addEventListener('timeupdate', () => {
      time.textContent = `${video.currentTime.toFixed(1)}s`;
      if (video.duration) slider.value = Math.round((video.currentTime / video.duration) * 1000);
    });
    video.addEventListener('seeked', () => { time.textContent = `${video.currentTime.toFixed(1)}s`; });
    // iOS may not paint a frame until it has seeked once; nudge it.
    video.addEventListener('loadeddata', () => { seek(0.001); }, { once: true });
    // Draw only once the seeked-to frame is actually on screen, or iOS gives a stale/black frame.
    // (requestVideoFrameCallback is not used: it never fires for a paused, settled video.)
    const frameReady = async () => {
      if (video.seeking) await new Promise((r) => video.addEventListener('seeked', r, { once: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
    const close = () => { video.pause(); URL.revokeObjectURL(url); grabber.replaceChildren(); };
    grabber.replaceChildren(h('div', { class: 'card grabber' },
      video,
      h('div', { class: 'inline' }, slider, time),
      h('div', { class: 'inline' },
        h('button', { class: 'icon', 'aria-label': 'Back 0.1 seconds', onclick: () => { video.pause(); seek(video.currentTime - 0.1); } }, '−0.1s'),
        h('button', { class: 'icon', 'aria-label': 'Forward 0.1 seconds', onclick: () => { video.pause(); seek(video.currentTime + 0.1); } }, '+0.1s'),
        h('button', { class: 'btn small primary', onclick: async () => {
          if (!video.videoWidth) return toast('Video not ready yet');
          video.pause();
          await frameReady();
          await addBlobs([await captureFrame(video)]);
          status.textContent = `${++captured} captured`;
        } }, '📸 Capture frame')),
      h('div', { class: 'inline' }, status, h('button', { class: 'btn small', onclick: close }, 'Done'))));
    grabber.scrollIntoView({ behavior: 'smooth' });
  }
  return { grabber, addPhotos, grabFromVideo };
}

async function exerciseScreen(id, params) {
  const ex = await db.get('exercises', id);
  if (!ex) return notFound();

  // Prev/next when opened from a routine, to step through it at the gym.
  let back = '#/exercises', nav = null, item;
  const routine = params.get('r') && (await db.get('routines', params.get('r')));
  if (routine) {
    back = `#/routine/${routine.id}`;
    const i = Number(params.get('i'));
    const idx = routine.items[i]?.exerciseId === id ? i : routine.items.findIndex((it) => it.exerciseId === id);
    item = routine.items[idx];
    const link = (i, label) => {
      const it = routine.items[i];
      return it ? h('a', { class: 'nav-btn', href: `#/exercise/${it.exerciseId}?r=${routine.id}&i=${i}` }, label) : h('span', { class: 'nav-btn' });
    };
    nav = h('nav', { class: 'routine-nav', 'aria-label': 'Routine' },
      link(idx - 1, '‹ Prev'),
      h('span', { class: 'muted' }, `${idx + 1} / ${routine.items.length}`),
      link(idx + 1, 'Next ›'));
  }

  // Gallery is redrawn in place when photos are added from this screen.
  const galleryArea = h('div');
  async function drawGallery() {
    const photos = (await Promise.all(ex.photoIds.map((pid) => db.get('photos', pid)))).filter(Boolean);
    if (!photos.length) {
      galleryArea.replaceChildren(h('p', { class: 'card empty-photos' }, 'No photos yet. Add screenshots, or grab frames from a tutorial video.'));
      return;
    }
    const counter = h('span', { class: 'counter' }, `1/${photos.length}`);
    const gallery = h('div', { class: 'gallery', onscroll: () => {
      const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
      counter.textContent = `${i + 1}/${photos.length}`;
    } }, photos.map((p, i) => {
      p.url = blobURL(p.blob);
      return h('figure', {},
        h('button', { class: 'photo-btn', 'aria-label': `Open photo ${i + 1} full screen`, onclick: () => openLightbox(photos, i) },
          h('img', { src: p.url, alt: p.caption || ex.name, decoding: 'async', loading: i ? 'lazy' : 'eager' })),
        p.caption ? h('figcaption', {}, p.caption) : null);
    }));
    galleryArea.replaceChildren(h('div', { class: 'gallery-wrap' }, gallery, photos.length > 1 ? counter : null));
  }
  await drawGallery();
  const { grabber, addPhotos, grabFromVideo } = photoAdder(ex, drawGallery);

  // Quick dated notes, appended to "My notes" without opening the full editor.
  const notesBody = h('p', { class: 'pre' }, ex.notes);
  const notesSection = h('section', { hidden: !ex.notes }, h('h2', {}, 'My notes'), notesBody);
  const noteForm = h('div');
  function openNoteForm() {
    const input = h('textarea', { rows: 3, placeholder: 'e.g. Elbows tucked felt much better on the shoulder' });
    noteForm.replaceChildren(h('div', { class: 'card' },
      input,
      h('div', { class: 'inline' },
        h('button', { class: 'btn small primary', onclick: async () => {
          const text = input.value.trim();
          if (!text) return;
          const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
          ex.notes = [ex.notes.trim(), `${date}: ${text}`].filter(Boolean).join('\n');
          ex.updatedAt = Date.now();
          await db.put('exercises', { ...ex });
          notesBody.textContent = ex.notes;
          notesSection.hidden = false;
          noteForm.replaceChildren();
          toast('Note added');
        } }, 'Add note'),
        h('button', { class: 'btn small', onclick: () => noteForm.replaceChildren() }, 'Cancel'))));
    input.focus();
  }

  // Order: what you need between sets first (target, photos, your notes, cues), adding last.
  const view = screen({ title: ex.name, back, action: h('a', { class: 'bar-btn', href: `#/exercise/${ex.id}/edit${routine ? `?r=${routine.id}&i=${params.get('i') ?? ''}` : ''}` }, 'Edit') },
    (item?.sets || item?.note) && h('div', { class: 'target' },
      item.sets && h('strong', {}, item.reps ? `${item.sets} × ${item.reps}` : `${item.sets} sets`),
      item.note && h('span', {}, item.note)),
    galleryArea,
    notesSection,
    ex.muscles && h('p', { class: 'muted' }, ex.muscles),
    ex.cues ? h('section', { class: 'cues' }, renderCues(ex.cues)) : h('p', { class: 'muted' }, 'No technique cues yet. Tap Edit to write some.'),
    ex.links.length > 0 && h('section', {}, h('h2', {}, 'Sources & videos'),
      h('ul', { class: 'links' }, ex.links.map((l) => h('li', {}, h('a', { href: l, target: '_blank', rel: 'noopener' }, l.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')))))),
    h('h2', {}, 'Add your own'),
    h('div', { class: 'quick-add' },
      h('button', { class: 'btn small', onclick: addPhotos }, '🖼 Photos'),
      h('button', { class: 'btn small', onclick: grabFromVideo }, '🎬 Video frame'),
      h('button', { class: 'btn small', onclick: openNoteForm }, '📝 Note')),
    grabber,
    noteForm);
  if (nav) {
    view.push(nav);
    view[1].classList.add('has-nav');
  }
  return view;
}

// Full-screen photo viewer: swipe between photos, double-tap to zoom, ✕ to close,
// and write a note (caption) on any photo.
function openLightbox(photos, index) {
  const counter = h('span', { class: 'counter' }, `${index + 1}/${photos.length}`);
  let edited = false;
  const close = () => {
    box.remove();
    document.removeEventListener('keydown', onKey);
    if (edited) render(); // show new captions in the gallery
  };
  function captionArea(p) {
    const area = h('div', { class: 'lb-caption' });
    const show = () => area.replaceChildren(
      h('button', { class: 'caption-btn', onclick: edit }, p.caption || '✎ Add a note to this photo'));
    const edit = () => {
      const input = h('textarea', { rows: 2, value: p.caption || '', placeholder: 'e.g. knees out here, bar over mid-foot' });
      area.replaceChildren(input, h('div', { class: 'inline' },
        h('button', { class: 'btn small primary', onclick: async () => {
          p.caption = input.value.trim();
          await db.put('photos', { id: p.id, blob: p.blob, caption: p.caption });
          edited = true;
          if (!box.isConnected) render(); // closed while saving
          show();
        } }, 'Save'),
        h('button', { class: 'btn small', onclick: show }, 'Cancel')));
      input.focus();
    };
    show();
    return area;
  }
  const onKey = (e) => { if (e.key === 'Escape' && e.target.tagName !== 'TEXTAREA') close(); };
  const strip = h('div', { class: 'gallery lightbox-strip', onscroll: () => {
    counter.textContent = `${Math.round(strip.scrollLeft / strip.clientWidth) + 1}/${photos.length}`;
  } }, photos.map((p) =>
    h('figure', {},
      h('div', { class: 'zoom', ondblclick: (e) => e.currentTarget.classList.toggle('zoomed') },
        h('img', { src: p.url, alt: p.caption || '' })),
      captionArea(p))));
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photos' },
    h('div', { class: 'lightbox-bar' }, photos.length > 1 ? counter : h('span'),
      h('button', { class: 'icon close', 'aria-label': 'Close', onclick: close }, '✕')),
    strip,
    h('p', { class: 'muted hint' }, 'Swipe · double-tap to zoom'));
  document.body.append(box);
  document.addEventListener('keydown', onKey);
  strip.scrollLeft = index * strip.clientWidth;
  box.querySelector('.close').focus();
}

async function exerciseEditScreen(id, params) {
  const ex = await db.get('exercises', id);
  if (!ex) return notFound();
  const viewHref = `#/exercise/${ex.id}${params.get('r') ? `?r=${params.get('r')}&i=${params.get('i') ?? ''}` : ''}`;

  const name = h('input', { value: ex.name, placeholder: 'Exercise name' });
  const muscles = h('input', { value: ex.muscles, placeholder: 'e.g. Quads, glutes' });
  const cues = h('textarea', { value: ex.cues, rows: 10, placeholder: 'Setup\n- Feet shoulder width\n\nExecution\n- Brace before each rep\n\nCommon mistakes\n- Knees caving in' });
  const notes = h('textarea', { value: ex.notes, rows: 4, placeholder: 'Personal notes, what the coach told you…' });
  const links = h('textarea', { value: ex.links.join('\n'), rows: 3, placeholder: 'One link per line (YouTube, Instagram…)' });

  // Photo edits are saved immediately so nothing is lost if you leave the page.
  const photoGrid = h('div', { class: 'photo-grid' });
  async function savePhotoIds() {
    ex.updatedAt = Date.now();
    await db.put('exercises', { ...ex, photoIds: ex.photoIds });
  }
  async function drawPhotos() {
    revokeURLs();
    const photos = await Promise.all(ex.photoIds.map((pid) => db.get('photos', pid)));
    photoGrid.replaceChildren(...photos.map((p, idx) => p &&
      h('div', { class: 'photo-tile' },
        h('img', { src: blobURL(p.blob), alt: '' }),
        h('input', { value: p.caption || '', placeholder: 'Caption', onchange: (e) => db.put('photos', { ...p, caption: e.target.value }) }),
        h('div', { class: 'inline' },
          h('button', { class: 'icon', disabled: idx === 0, 'aria-label': 'Move earlier', onclick: async () => {
            ex.photoIds.splice(idx - 1, 0, ex.photoIds.splice(idx, 1)[0]); await savePhotoIds(); drawPhotos();
          } }, '←'),
          h('button', { class: 'icon', disabled: idx === ex.photoIds.length - 1, 'aria-label': 'Move later', onclick: async () => {
            ex.photoIds.splice(idx + 1, 0, ex.photoIds.splice(idx, 1)[0]); await savePhotoIds(); drawPhotos();
          } }, '→'),
          h('button', { class: 'icon danger', 'aria-label': 'Delete photo', onclick: async () => {
            if (!confirm('Delete this photo?')) return;
            ex.photoIds.splice(idx, 1);
            await db.writeMany([{ store: 'photos', delete: p.id }, { store: 'exercises', value: { ...ex, updatedAt: Date.now() } }]);
            drawPhotos();
          } }, '🗑')))));
  }

  const { grabber, addPhotos, grabFromVideo } = photoAdder(ex, drawPhotos);

  async function save() {
    // Mutate ex in place: photo writes still in flight spread ex and must not restore old text.
    const newName = name.value.trim() || 'Untitled exercise';
    // Renamed to a known lift with no cues yet (e.g. "+ New exercise"): apply the defaults.
    const starter = !cues.value.trim() && starterByName.get(newName.toLowerCase());
    Object.assign(ex, {
      name: newName,
      muscles: muscles.value.trim() || (starter ? starter.muscles : ''),
      cues: starter ? starter.cues : cues.value,
      notes: notes.value,
      links: links.value.split('\n').map((s) => s.trim()).filter(Boolean),
      updatedAt: Date.now(),
    });
    if (starter && !ex.links.length) ex.links = [...starter.links];
    const photoOps = starter ? await defaultPhotoOps(ex, starter) : [];
    await db.writeMany([...photoOps, { store: 'exercises', value: { ...ex } }]);
    location.hash = viewHref;
  }

  const view = screen({ title: 'Edit exercise', back: viewHref, action: h('button', { class: 'bar-btn primary', onclick: save }, 'Save') },
    h('label', {}, 'Name', name),
    h('label', {}, 'Muscles', muscles),
    h('h2', {}, 'Photos'),
    h('div', { class: 'inline' },
      h('button', { class: 'btn small', onclick: addPhotos }, '🖼 Add photos'),
      h('button', { class: 'btn small', onclick: grabFromVideo }, '🎬 Grab frames from video')),
    grabber,
    photoGrid,
    h('label', {}, 'Technique cues', h('small', { class: 'muted' }, 'Plain lines become headings, lines starting with "-" become bullets.'), cues),
    h('label', {}, 'My notes', notes),
    h('label', {}, 'Videos & links', links),
    h('button', { class: 'btn primary', onclick: save }, 'Save'),
    h('button', { class: 'btn danger', onclick: async () => {
      if (!confirm(`Delete "${ex.name}" and its photos? It is also removed from routines.`)) return;
      await deleteExercise(ex);
      location.hash = '#/exercises';
    } }, 'Delete exercise'));
  await drawPhotos();
  return view;
}

async function settingsScreen() {
  const usage = h('p', { class: 'muted' });
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then(async ({ usage: u }) => {
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      usage.textContent = `Using ${(u / 1e6).toFixed(1)} MB on this device${persisted ? ' · storage is persistent' : ''}.`;
    });
  }

  async function importStrong() {
    const [file] = await pickFiles({ accept: '.csv,text/csv' });
    if (!file) return;
    try {
      const { exerciseNames, routines } = parseStrong(await file.text());
      const { newR, newEx } = await exclusive(async () => {
        const byName = new Map((await db.all('exercises')).map((e) => [e.name.trim().toLowerCase(), e]));
        const before = byName.size;
        const current = await db.all('routines');
        const ops = [];
        let newR = 0;
        for (const n of exerciseNames) await exerciseFor(n, byName, ops);
        for (const r of routines) {
          // Keep the user's own routines; replace untouched templates with the real routine.
          const existing = current.find((c) => c.name.trim().toLowerCase() === r.name.toLowerCase());
          if (existing && !existing.template) continue;
          const items = r.items.map((i) => ({ exerciseId: byName.get(i.name.toLowerCase()).id, sets: i.sets ? String(i.sets) : '', reps: i.reps, note: '' }));
          ops.push({ store: 'routines', value: {
            id: existing?.id || db.uid(), name: r.name, updatedAt: Date.now(),
            items: await withExtras(items, templateFor(r.name), byName, ops),
          } });
          newR++;
        }
        const newEx = byName.size - before;
        await db.writeMany(ops);
        return { newR, newEx };
      });
      toast(`Imported ${newR} routines and ${newEx} new exercises.`);
    } catch (err) {
      toast(err.message);
    }
  }

  async function applyDefaults() {
    toast('Applying defaults…');
    const { updated, complete } = await applyDefaultsToAll();
    if (!complete) toast('Some default photos could not be downloaded. Try again when online.');
    else toast(updated ? `Added defaults to ${updated} exercise${updated > 1 ? 's' : ''}.` : 'Nothing to add: your exercises already have cues and photos.');
  }

  async function doExport() {
    toast('Preparing backup…');
    const blob = await exportBackup();
    const fileName = `gymreference-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], fileName, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'GymReference backup' }); return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  async function doImport() {
    const [file] = await pickFiles({ accept: '.json,application/json' });
    if (!file) return;
    if (!confirm('Restoring replaces ALL current routines, exercises and photos. Continue?')) return;
    try {
      await importBackup(file);
      toast('Backup restored.');
      location.hash = '#/';
    } catch (err) {
      toast(err.message);
    }
  }

  const version = h('span', {}, '…');
  appVersion().then((v) => { version.textContent = v; });
  return screen({ title: 'Settings', back: '#/' },
    h('h2', {}, 'App'),
    h('div', { class: 'card' },
      h('p', {}, 'Installed version: ', version),
      h('button', { class: 'btn primary', onclick: updateButtonClick }, 'Check for updates')),
    h('h2', {}, 'Import'),
    h('div', { class: 'card' },
      h('p', {}, 'In Strong: Settings → Export Strong Data. Save the CSV to Files, then pick it here. Each workout becomes a routine (from its latest session).'),
      h('button', { class: 'btn', onclick: importStrong }, 'Import Strong CSV')),
    h('div', { class: 'card' },
      h('p', {}, `New exercises with a known name (e.g. "Squat (Barbell)") get default cues and 2 reference photos automatically (${STARTER.length} lifts). This fills them in for existing exercises that have no cues or no photos yet.`),
      h('button', { class: 'btn', onclick: applyDefaults }, 'Apply default cues & photos')),
    h('div', { class: 'card' },
      h('p', {}, `Routine templates: ${STARTER_ROUTINES.map((t) => t.name).join(', ')}. Adds the ones you don't have (matched by name), with default cues and photos.`),
      h('button', { class: 'btn', onclick: async () => {
        const { added, extended } = await exclusive(async () => {
          const result = await addTemplateRoutines();
          await applyDefaultsToAll(); // photos for any exercise that missed them
          return result;
        });
        toast(added || extended
          ? `Added ${added} routine${added === 1 ? '' : 's'}${extended ? `, updated ${extended}` : ''}.`
          : 'You already have all the template routines.');
      } }, 'Add routine templates')),
    h('h2', {}, 'Backup'),
    h('div', { class: 'card' },
      h('p', {}, 'Everything is stored only on this device. Export a backup now and then (save it to iCloud Drive).'),
      h('button', { class: 'btn', onclick: doExport }, 'Export backup'),
      h('button', { class: 'btn', onclick: doImport }, 'Restore backup')),
    usage);
}

function notFound() {
  return screen({ title: 'Not found', back: '#/' }, h('p', { class: 'muted' }, 'This item no longer exists.'));
}

// ---------- router ----------

const routes = [
  [/^\/?$/, homeScreen],
  [/^\/exercises$/, exercisesScreen],
  [/^\/routine\/([^/]+)$/, routineScreen],
  [/^\/routine\/([^/]+)\/edit$/, routineEditScreen],
  [/^\/exercise\/([^/]+)$/, exerciseScreen],
  [/^\/exercise\/([^/]+)\/edit$/, exerciseEditScreen],
  [/^\/settings$/, settingsScreen],
];

// iOS may kill the home-screen app between sets; reopen where you were (within 3 hours).
const RESUME_MS = 3 * 60 * 60 * 1000;
function rememberScreen(path) {
  if (!path.endsWith('/edit')) localStorage.setItem('lastScreen', JSON.stringify({ hash: location.hash, t: Date.now() }));
}
function resumeHash() {
  if (location.hash.replace(/^#\/?/, '')) return;
  try {
    const { hash, t } = JSON.parse(localStorage.getItem('lastScreen'));
    if (Date.now() - t < RESUME_MS && hash) history.replaceState(null, '', hash);
  } catch {
    // nothing saved
  }
}

let renderId = 0;
async function render() {
  const id = ++renderId;
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  rememberScreen(path);
  const params = new URLSearchParams(query);
  const stale = takeURLs(); // revoked once the new screen has replaced the old one
  document.querySelector('.lightbox')?.remove();
  let view;
  try {
    const route = routes.find(([re]) => re.test(path));
    view = route ? await route[1](...path.match(route[0]).slice(1), params) : notFound();
  } catch (err) {
    console.error(err);
    view = screen({ title: 'Error', back: '#/' }, h('p', {}, `Something went wrong: ${err.message}`));
  }
  if (id !== renderId) return; // a newer navigation won
  app.replaceChildren(...[view].flat());
  stale.forEach((u) => URL.revokeObjectURL(u));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
resumeHash();
render().then(upgradeDefaults).catch((err) => console.error(err));

// Updates: a new version installs in the background and waits. The banner, or the
// "Check for updates" buttons, activate it and the page reloads once on the new version.
let reloading = false;
function reloadOnce() {
  if (!reloading) { reloading = true; location.reload(); }
}

function activate(worker) {
  worker.addEventListener('statechange', () => { if (worker.state === 'activated') reloadOnce(); });
  worker.postMessage('skipWaiting');
}

function offerUpdate(worker) {
  if (document.querySelector('.update-banner')) return;
  document.body.append(h('div', { class: 'update-banner', role: 'status' },
    h('span', {}, 'A new version is ready.'),
    h('button', { class: 'btn small primary', onclick: () => activate(worker) }, 'Update')));
}

// Installed version, read from the service worker's cache name ("gymreference-v7" → "v7").
async function appVersion() {
  const key = 'caches' in window && (await caches.keys()).find((k) => /^gymreference-v\d+$/.test(k));
  return key ? key.slice('gymreference-'.length) : 'installing…';
}

// Fetch sw.js now; if it changed, wait for the new version to download, then switch to it.
// Resolves 'updating', 'latest' or 'failed'.
async function checkForUpdates() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return 'failed';
  if (reg.waiting) { // already downloaded (works offline too)
    activate(reg.waiting);
    return 'updating';
  }
  await reg.update();
  const w = reg.installing;
  if (w) {
    await new Promise((ok) => w.addEventListener('statechange', () => { if (w.state !== 'installing') ok(); }));
  }
  if (!reg.waiting) return w ? 'failed' : 'latest';
  activate(reg.waiting);
  return 'updating';
}

async function updateButtonClick() {
  toast('Checking for updates…');
  try {
    const result = await checkForUpdates();
    if (result === 'updating') toast('Updating…');
    else if (result === 'latest') toast(`You have the latest version (${await appVersion()}).`);
    else toast('Could not download the update. Check your connection and try again.');
  } catch {
    toast('Could not check for updates. Are you offline?');
  }
}

if ('serviceWorker' in navigator && isSecureContext) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // Offer a new version once it has downloaded. It may already be installing or waiting
    // here: 'updatefound' can fire before this callback runs, so don't rely on it alone.
    const watch = (w) => {
      if (!w) return;
      const offer = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w); };
      offer();
      w.addEventListener('statechange', offer);
    };
    watch(reg.waiting);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // Home-screen apps are often resumed rather than reloaded: check for updates on resume.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  });
  // Another tab activated a new version: reload onto it (not when the first install takes control).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reloadOnce(); });
  // Keep the default exercise photos available offline (fetched by defaultPhotoOps).
  caches.open('gymreference-defaults-v1').then(async (cache) => {
    for (const s of STARTER) for (const p of s.photos) if (!(await cache.match(p.src))) await cache.add(p.src).catch(() => {});
  });
}
