// Parse a Strong app CSV export (Settings > Export Strong Data) into routines.
// Each distinct "Workout Name" becomes a routine, using the exercise order,
// working-set count and reps from its most recent session.

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export function parseStrong(text) {
  const [header, ...rows] = parseCSV(text);
  if (!header) throw new Error('The file is empty.');
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const iDate = col('date'), iWorkout = col('workout name'), iExercise = col('exercise name');
  const iSet = col('set order'), iReps = col('reps');
  if (iDate < 0 || iWorkout < 0 || iExercise < 0) {
    throw new Error('This does not look like a Strong export (missing Date / Workout Name / Exercise Name columns).');
  }

  // Latest session date per workout name.
  const latest = new Map();
  for (const r of rows) {
    const w = (r[iWorkout] || '').trim();
    if (w && (!latest.has(w) || r[iDate] > latest.get(w))) latest.set(w, r[iDate]);
  }

  const routines = new Map();
  const exerciseNames = new Set();
  for (const r of rows) {
    const w = (r[iWorkout] || '').trim();
    const ex = (r[iExercise] || '').trim();
    if (!w || !ex) continue;
    exerciseNames.add(ex);
    if (r[iDate] !== latest.get(w)) continue;
    if (!routines.has(w)) routines.set(w, new Map());
    const items = routines.get(w);
    if (!items.has(ex)) items.set(ex, { name: ex, sets: 0, reps: '' });
    const item = items.get(ex);
    // Only numbered rows are working sets (Strong uses W/D/F for warm-up, drop, failure).
    if (iSet < 0 || /^\d+$/.test((r[iSet] || '').trim())) {
      item.sets++;
      if (!item.reps && iReps >= 0) item.reps = (r[iReps] || '').trim().replace(/\.0+$/, '');
    }
  }

  return {
    exerciseNames: [...exerciseNames],
    routines: [...routines].map(([name, items]) => ({ name, items: [...items.values()] })),
  };
}
