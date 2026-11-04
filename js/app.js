import * as db from './db.js';
import { h, blobURL, revokeURLs, toast, pickFiles, renderCues } from './ui.js';
import { compressImage, captureFrame } from './images.js';
import { parseStrong } from './strong.js';
import { STARTER, DEFAULTS_VERSION, LEGACY_CUES, cueHash } from './seed.js';
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

// Once per DEFAULTS_VERSION (retried while offline), refresh defaults on existing exercises.
async function upgradeDefaults() {
  if (Number(localStorage.getItem('defaultsVersion')) >= DEFAULTS_VERSION) return;
  const { updated, complete } = await applyDefaultsToAll();
  if (complete) localStorage.setItem('defaultsVersion', String(DEFAULTS_VERSION));
  if (updated) {
    toast(`Updated default cues & photos for ${updated} exercise${updated > 1 ? 's' : ''}.`);
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
  return photo ? h('img', { class: cls, src: blobURL(photo.blob), alt: '' }) : h('div', { class: `${cls} empty` }, '🏋️');
}

function exerciseRow(ex, photo, { href, meta }) {
  return h('a', { class: 'row', href },
    thumb(photo),
    h('div', { class: 'row-text' }, h('strong', {}, ex.name), meta ? h('span', { class: 'muted' }, meta) : null),
    h('span', { class: 'chev' }, '›'));
}

// ---------- screens ----------

async function homeScreen() {
  const routines = (await db.all('routines')).sort(byName);
  const exercises = await db.all('exercises');
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const showInstall = isIOS && !standalone && !localStorage.getItem('hideInstall');

  return screen({ title: 'GymReference', action: h('a', { class: 'bar-btn', href: '#/settings', 'aria-label': 'Settings' }, '⚙︎') },
    showInstall && h('div', { class: 'card hint' },
      h('p', {}, 'Tip: tap ', h('b', {}, 'Share → Add to Home Screen'), ' so it works offline and your photos are kept safe.'),
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
        h('span', { class: 'chev' }, '›'))));
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
    await db.put('routines', { ...r, name: name.value.trim() || 'Untitled routine', items, updatedAt: Date.now() });
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
    // iOS only renders a frame after playback has started once; nudge it.
    video.addEventListener('loadedmetadata', () => { seek(0.001); }, { once: true });
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
      return it ? h('a', { class: 'btn small', href: `#/exercise/${it.exerciseId}?r=${routine.id}&i=${i}` }, label) : h('span');
    };
    nav = h('div', { class: 'routine-nav' },
      link(idx - 1, '‹ Prev'),
      h('span', { class: 'muted' }, `${idx + 1}/${routine.items.length}${item?.sets ? ` · ${item.sets} × ${item.reps || '?'}` : ''}`),
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
    } }, photos.map((p) =>
      h('figure', {},
        h('img', { src: blobURL(p.blob), alt: p.caption || ex.name, onclick: (e) => openLightbox(e.target.src, p.caption) }),
        p.caption ? h('figcaption', {}, p.caption) : null)));
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

  return screen({ title: ex.name, back, action: h('a', { class: 'bar-btn', href: `#/exercise/${ex.id}/edit${routine ? `?r=${routine.id}&i=${params.get('i') ?? ''}` : ''}` }, 'Edit') },
    nav,
    galleryArea,
    h('div', { class: 'quick-add' },
      h('button', { class: 'btn small', onclick: addPhotos }, '🖼 Photos'),
      h('button', { class: 'btn small', onclick: grabFromVideo }, '🎬 Video frame'),
      h('button', { class: 'btn small', onclick: openNoteForm }, '📝 Note')),
    grabber,
    noteForm,
    item?.note && h('div', { class: 'card note' }, item.note),
    ex.muscles && h('p', { class: 'muted' }, ex.muscles),
    ex.cues && h('section', { class: 'cues' }, renderCues(ex.cues)),
    notesSection,
    ex.links.length > 0 && h('section', {}, h('h2', {}, 'Videos & links'),
      h('ul', { class: 'links' }, ex.links.map((l) => h('li', {}, h('a', { href: l, target: '_blank', rel: 'noopener' }, l.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')))))),
    !ex.cues && h('p', { class: 'muted' }, 'No technique cues yet. Tap Edit to write some.'));
}

function openLightbox(src, caption) {
  const box = h('div', { class: 'lightbox', onclick: () => box.remove() },
    h('img', { src, alt: caption || '' }),
    caption ? h('p', {}, caption) : null);
  document.body.append(box);
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
      const existing = await db.all('exercises');
      const idByName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));
      const existingRoutines = new Set((await db.all('routines')).map((r) => r.name.trim().toLowerCase()));
      const ops = [];
      let newEx = 0, newR = 0;
      for (const n of exerciseNames) {
        if (idByName.has(n.toLowerCase())) continue;
        const ex = newExercise(n);
        idByName.set(n.toLowerCase(), ex.id);
        ops.push(...(await defaultPhotoOps(ex)), { store: 'exercises', value: ex });
        newEx++;
      }
      for (const r of routines) {
        if (existingRoutines.has(r.name.toLowerCase())) continue;
        ops.push({ store: 'routines', value: {
          id: db.uid(), name: r.name, updatedAt: Date.now(),
          items: r.items.map((i) => ({ exerciseId: idByName.get(i.name.toLowerCase()), sets: i.sets ? String(i.sets) : '', reps: i.reps, note: '' })),
        } });
        newR++;
      }
      await db.writeMany(ops);
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

  return screen({ title: 'Settings', back: '#/' },
    h('h2', {}, 'Import'),
    h('div', { class: 'card' },
      h('p', {}, 'In Strong: Settings → Export Strong Data. Save the CSV to Files, then pick it here. Each workout becomes a routine (from its latest session).'),
      h('button', { class: 'btn', onclick: importStrong }, 'Import Strong CSV')),
    h('div', { class: 'card' },
      h('p', {}, `New exercises with a known name (e.g. "Squat (Barbell)") get default cues and 2 reference photos automatically (${STARTER.length} lifts). This fills them in for existing exercises that have no cues or no photos yet.`),
      h('button', { class: 'btn', onclick: applyDefaults }, 'Apply default cues & photos')),
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

let renderId = 0;
async function render() {
  const id = ++renderId;
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  revokeURLs();
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
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render().then(upgradeDefaults).catch((err) => console.error(err));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js');
}
