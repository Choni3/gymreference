import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, readFileSync as read } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate, channelsAt, grade, frameTimes } from '../js/motion/pose.js';
import { validateMotion } from '../js/motion/validate.js';
import { STAND_Y, LEN } from '../js/motion/skeleton.js';
import { STARTER } from '../js/seed.js';
import { validateDir, slug } from '../scripts/validate-motions.mjs';

const squat = () => JSON.parse(readFileSync(new URL('../motions/squat-barbell.json', import.meta.url), 'utf8'));
const names = STARTER.map((s) => s.name);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const base = (extra = {}) => ({
  version: 1, exercise: 'Squat (Barbell)', durationMs: 2000,
  phases: [{ name: 'All', start: 0, end: 1 }],
  keyframes: [{ t: 0 }, { t: 1 }],
  checks: [], mistakes: [], ...extra,
});

test('keyframes: exact at knots, no overshoot between, sided shorthand and overrides', () => {
  const m = base({ keyframes: [{ t: 0, kneeFlex: 0 }, { t: 0.5, kneeFlex: 90, kneeFlexR: 80 }, { t: 1, kneeFlex: 0 }] });
  near(channelsAt(m, 0.5).kneeFlexL, 90);
  near(channelsAt(m, 0.5).kneeFlexR, 80);
  for (let t = 0; t <= 1; t += 0.01) {
    const v = channelsAt(m, t).kneeFlexL;
    assert.ok(v >= -1e-9 && v <= 90 + 1e-9, `no overshoot at ${t}: ${v}`);
  }
  const lin = base({ keyframes: [{ t: 0, rootY: 0 }, { t: 1, rootY: 1, ease: 'linear' }] });
  near(channelsAt(lin, 0.25).rootY, 0.25);
});

test('mistake deltas: zero at the ends, and channels missing from a delta keyframe are 0 there', () => {
  const m = base({ keyframes: [{ t: 0, rootY: 0.9 }, { t: 1, rootY: 0.9 }],
    mistakes: [{ id: 'x', delta: [{ t: 0.4 }, { t: 0.6, rootPitch: 20 }] }] });
  near(channelsAt(m, 0, 'x').rootPitch ?? 0, 0);
  near(channelsAt(m, 0.3, 'x').rootPitch, 0);
  near(channelsAt(m, 0.6, 'x').rootPitch, 20);
  near(channelsAt(m, 1, 'x').rootPitch, 0);
  near(channelsAt(m, 0.5, 'x').rootY, 0.9);
});

test('standing default pose has metric proportions and mirrored sides', () => {
  const p = evaluate(base(), 0);
  near(p.points.hipL[1], STAND_Y);
  near(p.points.ankleL[1], LEN.ankleH, 1e-9);
  near(p.points.heelL[1], 0, 1e-9);
  assert.ok(p.points.head[1] > 1.6 && p.points.head[1] < 1.7, `head centre ${p.points.head[1]}`);
  assert.ok(p.points.shoulderL[1] > 1.4 && p.points.shoulderL[1] < 1.46);
  for (const k of ['hip', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'wrist', 'grip']) {
    const [l, r] = [p.points[k + 'L'], p.points[k + 'R']];
    near(l[0], -r[0]); near(l[1], r[1]); near(l[2], r[2]);
    assert.ok(l[0] > 0, `${k}L is on +x (the left)`);
  }
});

test('forward kinematics sign conventions', () => {
  const pose = (kf) => evaluate(base({ keyframes: [{ t: 0, ...kf }, { t: 1, ...kf }] }), 0);
  const p1 = pose({ shFlex: 90 });
  near(p1.points.elbowL[1], p1.points.shoulderL[1], 1e-9); // arm forward, horizontal
  assert.ok(p1.points.elbowL[2] > p1.points.shoulderL[2] + 0.29);
  const p2 = pose({ shAbd: 90, elbowFlex: 90, shRot: 90 }); // press position: forearm up
  assert.ok(p2.points.elbowL[0] > p2.points.shoulderL[0] + 0.29);
  assert.ok(p2.points.wristL[1] > p2.points.elbowL[1] + 0.25);
  const p3 = pose({ hipFlex: 90, kneeFlex: 90 }); // seated: thigh forward, shin down
  near(p3.measures.kneeFlexL, 90, 1e-6);
  near(p3.measures.hipFlexL, 90, 1e-6);
  assert.ok(p3.points.ankleL[1] < p3.points.kneeL[1] - 0.42);
  const p4 = pose({ rootPitch: 30 });
  near(p4.measures.trunkLean, 30, 1e-6);
  assert.ok(p4.points.c7[2] > 0.2, 'pitch + tips the trunk forward');
  const p5 = pose({ rootPitch: -90, rootY: 0.55 }); // lying on the back
  assert.ok(p5.points.head[2] < -0.65 && Math.abs(p5.points.head[1] - 0.55) < 0.05, 'head toward -z, level with the hips');
});

test('arm IK preserves upper arm length when the target and pole both point along X', () => {
  const [x, y, z] = evaluate(base(), 0).points.shoulderL;
  const at = [x + 0.4, y, z];
  const { points } = evaluate(base({ contacts: { handL: { at, elbowPole: [1, 0, 0] } } }), 0);
  near(Math.hypot(...points.elbowL.map((v, i) => v - points.shoulderL[i])), LEN.upperArm);
});

test('hands attachment keeps a rotation for staggered and coincident grips', () => {
  const props = [{ id: 'bar', type: 'barbell', attach: { to: 'hands' } }];
  const pose = (z) => evaluate(base({ props, contacts: {
    handL: { at: [0, 1.1, z] }, handR: { at: [0, 1.1, 0.2] },
  } }), 0);
  const staggered = pose(0.4);
  const R = staggered.props.bar.R;
  [0, 0, -1, 0, 1, 0, 1, 0, 0].forEach((v, i) => near(R[i], v));
  staggered.props.bar.o.forEach((v, i) => near(v, [0, 1.1, 0.3][i]));
  const coincident = pose(0.2);
  assert.deepEqual(coincident.props.bar.R, coincident.segments.thorax.R);
});

test('squat: feet stay planted, hands stay on the bar, IK limbs reach', () => {
  const m = squat();
  const p0 = evaluate(m, 0);
  for (const t of frameTimes(m)) {
    for (const id of [null, ...m.mistakes.map((x) => x.id)]) {
      const p = evaluate(m, t, id);
      for (const r of p.reach) assert.ok(r.err < 1e-6, `${r.limb} reaches at ${t} (${id})`);
      if (id !== 'toes') for (const k of ['ballL', 'ballR', 'heelL']) for (let i = 0; i < 3; i++) near(p.points[k][i], p0.points[k][i], 1e-9);
      for (const s of ['L', 'R']) {
        const d = Math.hypot(...p.points['grip' + s].map((v, i) => v - p.propPoints['bar.grip' + s][i]));
        assert.ok(d < 1e-6, `grip${s} on the bar`);
      }
    }
  }
  const bottom = evaluate(m, 0.5);
  assert.ok(bottom.points.hipL[1] < bottom.points.kneeL[1], 'hip below knee at the bottom');
  assert.ok(bottom.measures.kneeFlexL > 110 && bottom.measures.kneeFlexL < 145);
  assert.ok(bottom.measures.trunkLean > 25 && bottom.measures.trunkLean < 45);
});

test('check grading: inside, within tolerance, outside', () => {
  const ch = { min: 0, max: 10, tol: 2 };
  assert.equal(grade(5, ch), 'good');
  assert.equal(grade(11.5, ch), 'warn');
  assert.equal(grade(-3, ch), 'bad');
  assert.equal(grade(null, ch), 'bad');
});

test('mistakes turn their checks red; the correct rep is all green', () => {
  const m = squat();
  const red = (id) => new Set(frameTimes(m).flatMap((t) => evaluate(m, t, id).checks.filter((c) => c.status === 'bad').map((c) => c.id)));
  assert.equal(red(null).size, 0);
  for (const mis of m.mistakes) for (const f of mis.fails) assert.ok(red(mis.id).has(f), `${mis.id} fails ${f}`);
});

test('validator accepts the squat and pinpoints common authoring errors', () => {
  assert.deepEqual(validateMotion(squat(), { exerciseNames: names }).errors, []);
  const errs = (patch) => validateMotion({ ...squat(), ...patch(squat()) }, { exerciseNames: names }).errors.join('\n');
  assert.match(errs(() => ({ exercise: 'Squat' })), /not an exercise name/);
  assert.match(errs((m) => ({ keyframes: [...m.keyframes.slice(0, -1), { t: 1, kneeBend: 3 }] })), /unknown channel "kneeBend"/);
  assert.match(errs((m) => ({ phases: [m.phases[0], { ...m.phases[1], start: 0.1 }, ...m.phases.slice(2)] })), /must equal the previous end/);
  assert.match(errs((m) => ({ keyframes: [m.keyframes[1], m.keyframes[0], ...m.keyframes.slice(2)] })), /must be after the previous keyframe|first keyframe/);
  assert.match(errs((m) => ({ keyframes: m.keyframes.map((k) => ({ ...k, rootY: 1.2 })) })), /misses its contact/);
  assert.match(errs((m) => ({ mistakes: [{ ...m.mistakes[0], delta: [{ t: 0.5, kneeOut: -2 }] }] })), /never goes red/);
  assert.match(errs((m) => ({ checks: m.checks.map((c) => (c.id === 'depth' ? { ...c, max: -0.2 } : c)) })), /"depth" is red on the correct rep/);
  assert.match(errs((m) => ({ checks: [{ ...m.checks[0], parts: ['kneecap'] }] })), /unknown part "kneecap"/);
  assert.match(errs((m) => ({ props: [{ ...m.props[0], attach: { to: 'hands' } }] })), /attached to hands/);
});

test('validate-motions writes an index of valid files only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'motions-'));
  writeFileSync(join(dir, 'squat-barbell.json'), JSON.stringify(squat()));
  writeFileSync(join(dir, 'bad.json'), JSON.stringify({ ...squat(), exercise: 'Nope' }));
  writeFileSync(join(dir, 'bad-type.json'), JSON.stringify({ ...squat(), exercise: 123 }));
  const logs = [];
  const r = validateDir(dir, { log: (l) => logs.push(l) });
  assert.equal(r.failed, 2);
  assert.ok(logs.includes('ERROR bad-type.json: exercise is required'));
  assert.deepEqual(JSON.parse(read(join(dir, 'index.json'), 'utf8')), [{ exercise: 'Squat (Barbell)', file: 'squat-barbell.json' }]);
  assert.equal(slug('Triceps Pushdown (Cable - Straight Bar)'), 'triceps-pushdown-cable-straight-bar');
});

test('validator samples off-grid base and mistake delta keyframes', () => {
  const checks = [{ id: 'lean', label: 'Stay upright', measure: 'trunkLean', max: 0, parts: ['thorax'] }];
  const peak = [{ t: 0.504 }, { t: 0.505, rootPitch: 10 }, { t: 0.506 }];
  const keyframes = [{ t: 0, rootPitch: 0 }, ...peak.map((kf) => ({ rootPitch: 0, ...kf })), { t: 1, rootPitch: 0 }];
  assert.match(validateMotion(base({ checks, keyframes })).errors.join('\n'), /correct rep t=0\.505: check "lean" is red/);
  const mistakes = [{ id: 'lean', label: 'Lean', cue: 'Stay upright', fails: ['lean'], delta: peak }];
  assert.deepEqual(validateMotion(base({ checks, mistakes })).errors, []);
});

test('motions/index.json is up to date', () => {
  const r = validateDir(undefined, { write: false, log: () => {} });
  assert.equal(r.failed, 0);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../motions/index.json', import.meta.url), 'utf8')), r.index);
});
