// Pose evaluation for motion files (docs/MOTION-FORMAT.md): keyframe interpolation,
// forward kinematics, two-bone IK for planted feet and gripping hands, props, measures
// and checks. Pure and deterministic, no DOM or three.js, so node tests can run it.
import { LEN, OFFSET, CHANNELS, SIDED, GROUPS, SIDED_LANDMARKS } from './skeleton.js';

// ---------- vectors and 3×3 rotations (row-major arrays) ----------

const RAD = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0]; };
const mid = (a, b) => scale(add(a, b), 0.5);
const deg = (r) => r / RAD;
const angleBetween = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))));

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function rx(a) { const c = Math.cos(a * RAD), s = Math.sin(a * RAD); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function ry(a) { const c = Math.cos(a * RAD), s = Math.sin(a * RAD); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rz(a) { const c = Math.cos(a * RAD), s = Math.sin(a * RAD); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function mul(A, B) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return o;
}
const mv = (R, p) => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];
const col = (R, i) => [R[i], R[3 + i], R[6 + i]];
const chain = (...Rs) => Rs.reduce(mul);
// Mirror left ↔ right (x → -x): points flip x, rotations are conjugated by diag(-1, 1, 1).
const mirrorP = (p) => [-p[0], p[1], p[2]];
const mirrorR = (R) => [R[0], -R[1], -R[2], -R[3], R[4], R[5], -R[6], R[7], R[8]];
// Pitch (+ tips forward), yaw (+ turns left), roll (+ tilts to the left).
const pyr = (p, y, r) => chain(ry(y), rx(p), rz(-r));
// Frame with its Y axis along y and Z as close as possible to zHint.
function frameYZ(y, zHint) {
  y = norm(y);
  let x = cross(y, zHint);
  if (len(x) < 1e-6) x = cross(y, Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]);
  x = norm(x);
  const z = cross(x, y);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}
// Rotate v about unit axis k by a degrees (Rodrigues).
function rotAbout(v, k, a) {
  const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}
const at = (seg, p) => add(seg.o, mv(seg.R, p)); // point in a segment frame → world

// ---------- keyframe interpolation ----------

const SIDE_RE = /^(.+)([LR])$/;
export const PROP_RE = /^([A-Za-z][\w-]*)\.(x|y|z|pitch|yaw|roll)$/;

export function channelDefault(name) {
  if (CHANNELS[name]) return CHANNELS[name][2];
  const m = name.match(SIDE_RE);
  if (m && SIDED[m[1]]) return SIDED[m[1]][2];
  return 0;
}

// Expand one keyframe into concrete channel → value (sided shorthand fills L and R;
// explicit L/R keys win). Unknown keys are left for the validator to report.
export function expandKeys(kf) {
  const out = {};
  for (const [k, v] of Object.entries(kf)) {
    if (k === 't' || k === 'ease' || typeof v !== 'number') continue;
    if (SIDED[k]) {
      if (!(k + 'L' in kf)) out[k + 'L'] = v;
      if (!(k + 'R' in kf)) out[k + 'R'] = v;
    } else out[k] = v;
  }
  return out;
}

// Monotone cubic (Fritsch–Carlson) slopes; zero at both ends because a rep starts and
// ends at rest. No overshoot past the keyframe values.
function slopes(ts, vs) {
  const n = ts.length, m = new Array(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    const h0 = ts[k] - ts[k - 1], h1 = ts[k + 1] - ts[k];
    const d0 = (vs[k] - vs[k - 1]) / h0, d1 = (vs[k + 1] - vs[k]) / h1;
    if (d0 * d1 <= 0) continue;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    m[k] = (w1 + w2) / (w1 / d0 + w2 / d1);
  }
  return m;
}

// Mistake deltas (complete = true): a channel missing from a delta keyframe is 0 there.
function buildTracks(frames, { complete = false } = {}) {
  const tracks = {};
  const all = complete ? Object.fromEntries(frames.flatMap((kf) => Object.keys(expandKeys(kf))).map((ch) => [ch, 0])) : {};
  for (const kf of frames) {
    for (const [ch, v] of Object.entries({ ...all, ...expandKeys(kf) })) {
      (tracks[ch] ||= { ts: [], vs: [], eases: [] });
      tracks[ch].ts.push(kf.t);
      tracks[ch].vs.push(v);
      tracks[ch].eases.push(kf.ease || 'smooth');
    }
  }
  for (const tr of Object.values(tracks)) {
    // Mistake deltas fade in from and out to zero unless given at t = 0 / t = 1.
    if (complete && tr.ts[0] > 0) { tr.ts.unshift(0); tr.vs.unshift(0); tr.eases.unshift('smooth'); }
    if (complete && tr.ts[tr.ts.length - 1] < 1) { tr.ts.push(1); tr.vs.push(0); tr.eases.push('smooth'); }
    tr.ms = slopes(tr.ts, tr.vs);
  }
  return tracks;
}

function sample(tr, t) {
  const { ts, vs, ms, eases } = tr, n = ts.length;
  if (n === 1 || t <= ts[0]) return vs[0];
  if (t >= ts[n - 1]) return vs[n - 1];
  let i = 0;
  while (t > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
  const ease = eases[i + 1];
  if (ease === 'linear') return vs[i] + (vs[i + 1] - vs[i]) * s;
  const m0 = ease === 'easeInOut' ? 0 : ms[i], m1 = ease === 'easeInOut' ? 0 : ms[i + 1];
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m1;
}

const compiled = new WeakMap();
function compile(motion) {
  let c = compiled.get(motion);
  if (!c) {
    c = { base: buildTracks(motion.keyframes || []), mistakes: {} };
    for (const m of motion.mistakes || []) c.mistakes[m.id] = buildTracks(m.delta || [], { complete: true });
    compiled.set(motion, c);
  }
  return c;
}

// All channel values at time t (0..1), with the mistake's deltas added.
export function channelsAt(motion, t, mistakeId = null) {
  const c = compile(motion), out = {};
  for (const [ch, tr] of Object.entries(c.base)) out[ch] = sample(tr, t);
  const delta = mistakeId && c.mistakes[mistakeId];
  if (delta) for (const [ch, tr] of Object.entries(delta)) out[ch] = (out[ch] ?? channelDefault(ch)) + sample(tr, t);
  return out;
}

export function phaseAt(motion, t) {
  const ps = motion.phases || [];
  return ps.find((p) => t >= p.start && t < p.end) || ps[ps.length - 1] || null;
}

// ---------- props ----------

// Named points of a prop in its own frame, plus the axis a hand closes around.
function propLocal(prop, name) {
  const g = (prop.grip ?? 0.6) / 2;
  switch (prop.type) {
    case 'barbell':
    case 'rod':
      return { center: [0, 0, 0], gripL: [g, 0, 0], gripR: [-g, 0, 0], axis: [1, 0, 0] }[name] ?? null;
    case 'dumbbell':
      return { center: [0, 0, 0], grip: [0, 0, 0], axis: [0, 0, 1] }[name] ?? null;
    case 'handle': {
      const w = (prop.width ?? (prop.neutral ? 0.12 : 0.15)) / 2;
      return { center: [0, 0, 0], grip: [0, 0, 0], gripL: [w, 0, 0], gripR: [-w, 0, 0], axis: prop.neutral ? [0, 1, 0] : [1, 0, 0] }[name] ?? null;
    }
    case 'rope':
      return { center: [0, 0, 0], gripL: [0.06, -0.3, 0], gripR: [-0.06, -0.3, 0], axis: [0, 1, 0] }[name] ?? null;
    case 'bench': {
      const hgt = prop.height ?? 0.43;
      if (prop.incline) {
        const a = prop.incline * RAD, L = prop.backLength ?? 0.8;
        return { center: [0, hgt, 0], top: [0, hgt, 0.2], backTop: [0, hgt + Math.sin(a) * L, -Math.cos(a) * L], axis: [1, 0, 0] }[name] ?? null;
      }
      const l = (prop.length ?? 1.2) / 2;
      return { center: [0, hgt, 0], top: [0, hgt, 0], head: [0, hgt, -l], foot: [0, hgt, l], axis: [1, 0, 0] }[name] ?? null;
    }
    case 'box': {
      const s = prop.size || [0.4, 0.4, 0.4];
      return { center: [0, 0, 0], top: [0, s[1] / 2, 0], axis: [1, 0, 0] }[name] ?? null;
    }
    case 'roller':
      return { center: [0, 0, 0], axis: [1, 0, 0] }[name] ?? null;
    default:
      return null;
  }
}

function propFrame(prop, c, base) {
  const ch = (a) => c[`${prop.id}.${a}`] ?? 0;
  const r = prop.rot || [0, 0, 0];
  const R = mul(base.R, pyr(r[0] + ch('pitch'), r[1] + ch('yaw'), r[2] + ch('roll')));
  const o = add(base.o, mv(base.R, add(prop.attach ? prop.attach.offset || [0, 0, 0] : prop.pos || [0, 0, 0], [ch('x'), ch('y'), ch('z')])));
  return { o, R };
}

// ---------- the pose ----------

const TRUNK = ['pelvis', 'lumbar', 'thorax', 'neck', 'head'];
const spineRot = (flex, side, twist) => chain(rx(flex), rz(-side), ry(twist));

function twoBone(S, T, a, b, pole) {
  const d = sub(T, S), dist = len(d);
  const u = dist > 1e-9 ? scale(d, 1 / dist) : [0, -1, 0];
  const reach = Math.min(Math.max(dist, Math.abs(a - b) + 1e-6), a + b - 1e-9);
  const cosA = (a * a + reach * reach - b * b) / (2 * a * reach);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let q = sub(pole, scale(u, dot(pole, u)));
  if (len(q) < 1e-6) q = cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  q = norm(q);
  return { mid: add(S, add(scale(u, a * cosA), scale(q, a * sinA))), end: add(S, scale(u, reach)), err: Math.abs(dist - reach), u };
}

// Rotate a bend direction (pole) about the limb axis by a degrees, + = toward `lateral`.
function turnPole(pole, axis, lateral, a) {
  if (!a) return pole;
  return rotAbout(pole, axis, dot(cross(axis, pole), lateral) >= 0 ? a : -a);
}

// Evaluate the motion at t (0..1). Returns world points, segment frames, props,
// measures and check results. mistakeId = null for the correct rep.
export function evaluate(motion, t, mistakeId = null) {
  const c = channelsAt(motion, t, mistakeId);
  const val = (k) => c[k] ?? channelDefault(k);
  const P = {}, S = {}, props = {}, reach = [];
  const propList = motion.props || [];
  const byId = Object.fromEntries(propList.map((p) => [p.id, p]));
  const world = { o: [0, 0, 0], R: I3 };

  const placeProps = (pred) => {
    for (const p of propList) if (p.type !== 'cable' && !props[p.id] && pred(p)) props[p.id] = propFrame(p, c, p.attach ? attachFrame(p.attach.to) : world);
  };
  // "id" or "id.point" → world point and grip axis.
  const resolve = (ref) => {
    if (Array.isArray(ref)) return { p: ref, axis: [1, 0, 0] };
    const [id, name = 'center'] = String(ref).split('.');
    const prop = byId[id], f = props[id];
    const local = prop && f && propLocal(prop, name);
    if (!local) return null;
    return { p: at(f, local), axis: mv(f.R, propLocal(prop, 'axis') || [1, 0, 0]) };
  };
  function attachFrame(to) {
    if (to === 'hands') {
      // X from the right grip to the left one, Z as close as possible to the chest's forward.
      const x = norm(sub(P.gripL, P.gripR));
      const chest = S.thorax.R;
      const o = mid(P.gripL, P.gripR);
      if (!len(x)) return { o, R: chest };
      let y = cross(col(chest, 2), x);
      if (len(y) < 1e-6) {
        const up = col(chest, 1);
        y = sub(up, scale(x, dot(up, x)));
      }
      y = norm(y);
      const z = cross(x, y);
      return { o, R: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]] };
    }
    if (to === 'handL' || to === 'handR') return { o: P['grip' + to.slice(-1)], R: S[to].R };
    return S[to] || world;
  }

  // Trunk: root → pelvis → lumbar → thorax → neck → head.
  const root = [val('rootX'), val('rootY'), val('rootZ')];
  S.pelvis = { o: root, R: pyr(val('rootPitch'), val('rootYaw'), val('rootRoll')) };
  P.root = root;
  P.seat = at(S.pelvis, OFFSET.seat);
  P.l5 = at(S.pelvis, OFFSET.l5);
  S.lumbar = { o: P.l5, R: mul(S.pelvis.R, spineRot(val('lumbarFlex'), val('lumbarSide'), val('lumbarTwist'))) };
  P.t12 = at(S.lumbar, [0, LEN.lumbar, 0]);
  S.thorax = { o: P.t12, R: mul(S.lumbar.R, spineRot(val('thoracicFlex'), val('thoracicSide'), val('thoracicTwist'))) };
  P.c7 = at(S.thorax, [0, LEN.thoracic, 0]);
  P.upperBack = at(S.thorax, [0, 0.19, -0.05]);
  S.neck = { o: P.c7, R: mul(S.thorax.R, spineRot(val('neckFlex'), val('neckSide'), val('neckTwist'))) };
  S.head = { o: at(S.neck, [0, LEN.neck, 0]), R: S.neck.R };
  P.head = at(S.head, [0, 0.06, 0.02]);
  for (const s of ['L', 'R']) P['hip' + s] = at(S.pelvis, s === 'R' ? mirrorP(OFFSET.hip) : OFFSET.hip);

  placeProps((p) => !p.attach || TRUNK.includes(p.attach.to));

  const contacts = expandContacts(motion.contacts || {});
  for (const s of ['L', 'R']) {
    const R = s === 'R';
    const lateralT = mv(S.thorax.R, [R ? -1 : 1, 0, 0]);
    const lateralP = mv(S.pelvis.R, [R ? -1 : 1, 0, 0]);
    // Thorax-local, left-canonical → world (mirrored for the right side).
    const tP = (p) => at(S.thorax, R ? mirrorP(p) : p);
    const tR = (M) => mul(S.thorax.R, R ? mirrorR(M) : M);
    const pR = (M) => mul(S.pelvis.R, R ? mirrorR(M) : M);

    // Arm. The shoulder joint moves with the shoulder blade (clavicle about the sternum).
    const clav = mul(ry(-val('scapProt' + s)), rz(val('scapElev' + s)));
    const sh = tP(add(OFFSET.sc, mv(clav, sub(OFFSET.shoulder, OFFSET.sc))));
    P['shoulder' + s] = sh;
    const hand = contacts['hand' + s];
    const target = hand && resolve(hand.at);
    if (target) {
      const pole0 = mv(S.thorax.R, R ? mirrorP(hand.elbowPole || [0.3, -1, -0.3]) : hand.elbowPole || [0.3, -1, -0.3]);
      const axis = norm(sub(target.p, sh));
      const ik = twoBone(sh, target.p, LEN.upperArm, LEN.forearm + LEN.grip, turnPole(pole0, axis, lateralT, val('elbowOut' + s)));
      const fdir = norm(sub(ik.end, ik.mid));
      P['elbow' + s] = ik.mid;
      P['wrist' + s] = add(ik.mid, scale(fdir, LEN.forearm));
      P['grip' + s] = ik.end;
      const bend = sub(ik.mid, add(sh, scale(axis, dot(sub(ik.mid, sh), axis))));
      S['upperArm' + s] = { o: sh, R: frameYZ(sub(sh, ik.mid), scale(bend, -1)) };
      S['forearm' + s] = { o: ik.mid, R: frameYZ(scale(fdir, -1), target.axis) };
      S['hand' + s] = { o: P['wrist' + s], R: frameYZ(scale(fdir, -1), target.axis) };
      reach.push({ limb: 'hand' + s, err: ik.err });
    } else {
      const ua = chain(rx(-val('shFlex' + s)), rz(val('shAbd' + s)), ry(val('shRot' + s)));
      const fa = chain(ua, rx(-val('elbowFlex' + s)), ry(-val('forearmPro' + s)));
      const hd = mul(fa, rz(-val('wristFlex' + s)));
      S['upperArm' + s] = { o: sh, R: tR(ua) };
      P['elbow' + s] = at(S['upperArm' + s], [0, -LEN.upperArm, 0]);
      S['forearm' + s] = { o: P['elbow' + s], R: tR(fa) };
      P['wrist' + s] = at(S['forearm' + s], [0, -LEN.forearm, 0]);
      S['hand' + s] = { o: P['wrist' + s], R: tR(hd) };
      P['grip' + s] = at(S['hand' + s], [0, -LEN.grip, 0]);
    }

    // Leg. A planted foot is placed first, then the knee is solved.
    const hip = P['hip' + s];
    const foot = contacts['foot' + s];
    const plant = foot && resolve(foot.at);
    if (plant) {
      const base = typeof foot.at === 'string' ? props[foot.at.split('.')[0]].R : I3;
      const yawR = mul(base, ry(R ? -(foot.toeOut || 0) : foot.toeOut || 0));
      const Rf = mul(yawR, rx(val('heelRaise' + s)));
      const ball = add(plant.p, mv(yawR, [0, 0, LEN.ball]));
      const ankle = add(ball, mv(Rf, [0, LEN.ankleH, -LEN.ball]));
      const axis = norm(sub(ankle, hip));
      const ik = twoBone(hip, ankle, LEN.thigh, LEN.shin, turnPole(col(yawR, 2), axis, lateralP, val('kneeOut' + s)));
      P['knee' + s] = ik.mid;
      P['ankle' + s] = ik.end;
      const fwd = col(Rf, 2);
      S['thigh' + s] = { o: hip, R: frameYZ(sub(hip, ik.mid), fwd) };
      S['shin' + s] = { o: ik.mid, R: frameYZ(sub(ik.mid, ik.end), fwd) };
      S['foot' + s] = { o: ik.end, R: Rf };
      reach.push({ limb: 'foot' + s, err: ik.err });
    } else {
      const th = chain(rx(-val('hipFlex' + s)), rz(val('hipAbd' + s)), ry(val('hipRot' + s)));
      const shn = mul(th, rx(val('kneeFlex' + s)));
      const ft = chain(shn, rx(-val('ankleFlex' + s)), rz(-val('ankleInv' + s)));
      S['thigh' + s] = { o: hip, R: pR(th) };
      P['knee' + s] = at(S['thigh' + s], [0, -LEN.thigh, 0]);
      S['shin' + s] = { o: P['knee' + s], R: pR(shn) };
      P['ankle' + s] = at(S['shin' + s], [0, -LEN.shin, 0]);
      S['foot' + s] = { o: P['ankle' + s], R: pR(ft) };
    }
    const f = S['foot' + s];
    P['heel' + s] = at(f, [0, -LEN.ankleH, -LEN.heel]);
    P['midfoot' + s] = at(f, [0, -LEN.ankleH, (LEN.toe - LEN.heel) / 2]);
    P['ball' + s] = at(f, [0, -LEN.ankleH, LEN.ball]);
    P['toe' + s] = at(f, [0, -LEN.ankleH, LEN.toe]);
  }

  placeProps(() => true);
  const propPoints = {};
  for (const p of propList) {
    if (p.type === 'cable') continue;
    for (const name of ['center', 'grip', 'gripL', 'gripR', 'top', 'backTop', 'head', 'foot']) {
      const l = propLocal(p, name);
      if (l) propPoints[`${p.id}.${name}`] = at(props[p.id], l);
    }
    propPoints[p.id] = props[p.id].o;
  }
  for (const p of propList) {
    if (p.type !== 'cable') continue;
    const to = resolve(p.to);
    props[p.id] = { o: p.from || [0, 2, 0], R: I3, to: to ? to.p : p.from || [0, 2, 0] };
    propPoints[p.id] = props[p.id].o;
  }

  const pose = { t, phase: phaseAt(motion, t), points: P, segments: S, props, propPoints, channels: c, reach };
  pose.measures = measure(pose);
  pose.checks = (motion.checks || []).map((ch) => checkResult(motion, pose, ch));
  pose.parts = partStatus(motion, pose.checks);
  return pose;
}

// "feet" / "hands" shorthand → footL/footR, handL/handR (x mirrored, or L/R appended to a prop point).
export function expandContacts(contacts) {
  const out = {};
  for (const [k, v] of Object.entries(contacts)) {
    if (k === 'feet' || k === 'hands') {
      const one = k === 'feet' ? 'foot' : 'hand';
      for (const s of ['L', 'R']) {
        if (contacts[one + s]) continue;
        const atS = Array.isArray(v.at) ? (s === 'R' ? mirrorP(v.at) : v.at) : `${v.at}${s}`;
        out[one + s] = { ...v, at: atS };
      }
    } else out[k] = v;
  }
  return out;
}

// ---------- measures and checks ----------

function measure({ points: P, segments: S, channels }) {
  const m = {};
  const fwd = mv(ry(channels.rootYaw ?? 0), [0, 0, 1]);
  const lean = (u) => deg(Math.atan2(dot(u, fwd), u[1]));
  m.trunkLean = lean(col(S.thorax.R, 1));
  m.pelvisTilt = lean(col(S.pelvis.R, 1));
  m.lumbarFlex = channels.lumbarFlex ?? 0;
  m.thoracicFlex = channels.thoracicFlex ?? 0;
  m.spineFlex = m.lumbarFlex + m.thoracicFlex;
  m.neckFlex = channels.neckFlex ?? 0;
  for (const s of ['L', 'R']) {
    const R = s === 'R';
    // Limb direction in the parent frame, left-canonical: x out, y up, z forward.
    const local = (seg, d) => { const v = mv(transpose(S[seg].R), d); return R ? mirrorP(v) : v; };
    const sag = (d) => (Math.hypot(d[1], d[2]) < 0.2 * len(d) ? 0 : deg(Math.atan2(d[2], -d[1])));
    const thigh = local('pelvis', sub(P['knee' + s], P['hip' + s]));
    m['hipFlex' + s] = sag(thigh);
    m['hipAbd' + s] = deg(Math.asin(Math.max(-1, Math.min(1, thigh[0] / len(thigh)))));
    m['kneeFlex' + s] = angleBetween(sub(P['knee' + s], P['hip' + s]), sub(P['ankle' + s], P['knee' + s]));
    const footFwd = col(S['foot' + s].R, 2);
    m['ankleFlex' + s] = 90 - angleBetween(sub(P['knee' + s], P['ankle' + s]), footFwd);
    m['shinLean' + s] = lean(norm(sub(P['knee' + s], P['ankle' + s])));
    m['heelRaise' + s] = deg(Math.asin(Math.max(-1, Math.min(1, -footFwd[1]))));
    // Which way the knee bends vs where the toes point, about the hip–ankle axis:
    // + = knee outside the toes, - = caving in. 0 while the leg is nearly straight.
    const u = norm(sub(P['ankle' + s], P['hip' + s]));
    const perp = (v) => sub(v, scale(u, dot(v, u)));
    const kb = perp(sub(P['knee' + s], P['hip' + s])), fb = perp(footFwd);
    const around = (a, b) => deg(Math.atan2(dot(u, cross(a, b)), dot(a, b)));
    const out = around(fb, mv(S.pelvis.R, [R ? -1 : 1, 0, 0])) >= 0 ? 1 : -1;
    m['kneeTrack' + s] = len(kb) < 0.02 ? 0 : out * around(fb, kb);
    const arm = local('thorax', sub(P['elbow' + s], P['shoulder' + s]));
    m['shFlex' + s] = sag(arm);
    m['shAbd' + s] = deg(Math.asin(Math.max(-1, Math.min(1, arm[0] / len(arm)))));
    m['elbowFlex' + s] = angleBetween(sub(P['elbow' + s], P['shoulder' + s]), sub(P['wrist' + s], P['elbow' + s]));
  }
  return m;
}
const transpose = (R) => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

// A landmark, prop point, or midpoint of a sided landmark ("knee" = between kneeL and kneeR).
export function pointOf(pose, name) {
  if (pose.points[name]) return pose.points[name];
  if (SIDED_LANDMARKS.includes(name) && pose.points[name + 'L']) return mid(pose.points[name + 'L'], pose.points[name + 'R']);
  return pose.propPoints[name] || null;
}

export function measureValue(pose, spec) {
  if (typeof spec === 'string') return pose.measures[spec] ?? null;
  if (spec && Array.isArray(spec.delta)) {
    const a = pointOf(pose, spec.delta[0]), b = pointOf(pose, spec.delta[1]);
    if (!a || !b) return null;
    if (spec.axis === 'dist') return len(sub(a, b));
    const i = { x: 0, y: 1, z: 2 }[spec.axis];
    return i == null ? null : a[i] - b[i];
  }
  return null;
}

// good: inside [min, max]; warn: within tol outside it; bad: further out. off: not in its phases.
export function grade(v, ch) {
  if (v == null || Number.isNaN(v)) return 'bad';
  const lo = ch.min ?? -Infinity, hi = ch.max ?? Infinity;
  if (v >= lo && v <= hi) return 'good';
  return (v < lo ? lo - v : v - hi) <= (ch.tol ?? 0) ? 'warn' : 'bad';
}

function checkResult(motion, pose, ch) {
  const active = !ch.phases || (pose.phase && ch.phases.includes(pose.phase.name));
  const values = (ch.sides ? ['L', 'R'].map((s) => ch.measure + s) : [ch.measure]).map((spec) => measureValue(pose, spec));
  const statuses = values.map((v) => grade(v, ch));
  const status = !active ? 'off' : statuses.includes('bad') ? 'bad' : statuses.includes('warn') ? 'warn' : 'good';
  return { id: ch.id, label: ch.label, status, value: values.length === 1 ? values[0] : values };
}

export function expandParts(parts = []) {
  return parts.flatMap((p) => GROUPS[p] || [p]);
}

const RANK = { off: 0, good: 1, warn: 2, bad: 3 };
function partStatus(motion, results) {
  const out = {};
  (motion.checks || []).forEach((ch, i) => {
    const st = results[i].status;
    if (st === 'off') return;
    for (const part of expandParts(ch.parts)) if (!out[part] || RANK[st] > RANK[out[part]]) out[part] = st;
  });
  return out;
}

export const FPS = 30;
// Normalised times of every frame of a rep at 30 fps (inclusive of 0 and 1).
export function frameTimes(motion) {
  const n = Math.max(2, Math.round((motion.durationMs / 1000) * FPS));
  return Array.from({ length: n + 1 }, (_, i) => i / n);
}

