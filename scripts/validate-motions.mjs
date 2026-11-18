#!/usr/bin/env node
// Validate every motions/*.json against docs/MOTION-FORMAT.md and regenerate
// motions/index.json (the list the app uses to find an exercise's animation).
//
//   node scripts/validate-motions.mjs [--check]   (--check: don't write index.json)
//
// Exits 1 if any file has errors; only valid files are listed in the index.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STARTER } from '../js/seed.js';
import { validateMotion } from '../js/motion/validate.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function validateDir(dir = join(root, 'motions'), { write = true, log = console.log } = {}) {
  const names = STARTER.map((s) => s.name);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  const index = [], seen = new Map();
  let failed = 0;
  for (const file of files) {
    let motion, result;
    try {
      motion = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      result = validateMotion(motion, { exerciseNames: names });
    } catch (e) {
      result = { errors: [`cannot read: ${e.message}`], warnings: [] };
    }
    if (motion?.exercise && seen.has(motion.exercise)) result.errors.push(`"${motion.exercise}" is already animated by ${seen.get(motion.exercise)}`);
    const expected = `${slug(motion?.exercise || '')}.json`;
    if (motion?.exercise && file !== expected) result.warnings.push(`file name should be ${expected}`);
    for (const w of result.warnings) log(`warn  ${file}: ${w}`);
    for (const e of result.errors) log(`ERROR ${file}: ${e}`);
    if (result.errors.length) failed++;
    else {
      seen.set(motion.exercise, file);
      index.push({ exercise: motion.exercise, file });
      log(`ok    ${file} (${motion.exercise})`);
    }
  }
  index.sort((a, b) => a.exercise.localeCompare(b.exercise));
  if (write) writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return { failed, index, files: files.length };
}

// "Squat (Barbell)" → "squat-barbell"
export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { failed, index, files } = validateDir(undefined, { write: !process.argv.includes('--check') });
  console.log(`${files - failed}/${files} motion files valid; index lists ${index.length}.`);
  process.exit(failed ? 1 : 0);
}
