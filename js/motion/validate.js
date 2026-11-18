// Validation of a motion file against docs/MOTION-FORMAT.md: structure, names, ranges,
// then a 30 fps simulation of the correct rep and every mistake (IK reach, joint limits,
// floor, checks green on the correct rep, declared failures really red).
import { CHANNELS, SIDED, PROP_AXES, PARTS, GROUPS, MEASURES, SIDED_MEASURES, LANDMARKS, SIDED_LANDMARKS, PROP_TYPES, MEASURE_LIMITS } from './skeleton.js';
import { evaluate, frameTimes, expandContacts, PROP_RE } from './pose.js';

const TOP_KEYS = ['version', 'exercise', 'durationMs', 'props', 'contacts', 'phases', 'keyframes', 'checks', 'mistakes', 'notes'];
const SEGMENTS = PARTS;
const ATTACH_TO = [...SEGMENTS, 'hands'];
const EASES = ['smooth', 'linear', 'easeInOut'];
const POINTS = {
  barbell: ['center', 'gripL', 'gripR'], rod: ['center', 'gripL', 'gripR'], dumbbell: ['center', 'grip'],
  handle: ['center', 'grip', 'gripL', 'gripR'], rope: ['center', 'gripL', 'gripR'],
  box: ['center', 'top'], roller: ['center'], cable: [],
};
const PROP_SIZES = {
  barbell: ['length', 'plateRadius'], rod: ['length', 'radius'], dumbbell: ['headRadius'],
  handle: ['width'], bench: ['height', 'length', 'width', 'backLength'], roller: ['length', 'radius'],
};
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const fmt = (v) => (Array.isArray(v) ? v.map(fmt).join('/') : isNum(v) ? +v.toFixed(3) : String(v));

// Range of a channel name, or null if unknown.
export function channelRange(name, propIds = []) {
  if (CHANNELS[name]) return CHANNELS[name];
  if (SIDED[name]) return SIDED[name];
  const m = name.match(/^(.+)[LR]$/);
  if (m && SIDED[m[1]]) return SIDED[m[1]];
  const p = name.match(PROP_RE);
  if (p && propIds.includes(p[1]) && PROP_AXES.includes(p[2])) return p[2].length === 1 ? [-3, 3] : [-180, 180];
  return null;
}

export function validateMotion(motion, { exerciseNames = null } = {}) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  if (!motion || typeof motion !== 'object') return { errors: ['not a JSON object'], warnings };

  for (const k of Object.keys(motion)) if (!TOP_KEYS.includes(k)) warn(`unknown top-level key "${k}"`);
  if (motion.version !== 1) err('version must be 1');
  if (typeof motion.exercise !== 'string' || !motion.exercise) err('exercise is required');
  else if (exerciseNames && !exerciseNames.includes(motion.exercise)) err(`exercise "${motion.exercise}" is not an exercise name in js/seed.js`);
  if (!isNum(motion.durationMs) || motion.durationMs < 800 || motion.durationMs > 15000) err('durationMs must be a number between 800 and 15000');

  // Props
  const props = motion.props ?? [];
  if (!Array.isArray(props)) err('props must be an array');
  const propIds = [];
  for (const [i, p] of (Array.isArray(props) ? props : []).entries()) {
    const where = `props[${i}]`;
    if (!p || typeof p.id !== 'string' || !/^[A-Za-z][\w-]*$/.test(p.id)) { err(`${where}: id must be a word (letters, digits, - or _)`); continue; }
    if (propIds.includes(p.id)) err(`${where}: duplicate id "${p.id}"`);
    propIds.push(p.id);
    if (!PROP_TYPES.includes(p.type)) err(`${where} (${p.id}): unknown type "${p.type}" (use ${PROP_TYPES.join(', ')})`);
    for (const k of Object.hasOwn(PROP_SIZES, p.type) ? PROP_SIZES[p.type] : []) {
      if (Object.hasOwn(p, k) && (!isNum(p[k]) || p[k] <= 0)) err(`${where} (${p.id}): ${k} must be a finite positive number`);
    }
    if (['barbell', 'rod'].includes(p.type) && Object.hasOwn(p, 'grip') && (!isNum(p.grip) || p.grip < 0)) err(`${where} (${p.id}): grip must be a finite non-negative number`);
    if (p.type === 'bench' && Object.hasOwn(p, 'incline') && !isNum(p.incline)) err(`${where} (${p.id}): incline must be a finite number`);
    if (p.type === 'box' && Object.hasOwn(p, 'size') && (!isVec(p.size) || p.size.some((v) => v <= 0))) err(`${where} (${p.id}): size must be [width, height, depth] with finite positive numbers`);
    if (p.type === 'barbell' && Object.hasOwn(p, 'plates') && typeof p.plates !== 'boolean') err(`${where} (${p.id}): plates must be a boolean`);
    if (p.type === 'handle' && Object.hasOwn(p, 'neutral') && typeof p.neutral !== 'boolean') err(`${where} (${p.id}): neutral must be a boolean`);
    if (p.type === 'cable') {
      if (!isVec(p.from)) err(`${where} (${p.id}): cable needs "from": [x, y, z]`);
      if (typeof p.to !== 'string') err(`${where} (${p.id}): cable needs "to": "<propId>.<point>"`);
      continue;
    }
    if (!!p.pos === !!p.attach) err(`${where} (${p.id}): give exactly one of "pos" or "attach"`);
    if (p.pos && !isVec(p.pos)) err(`${where} (${p.id}): pos must be [x, y, z]`);
    if (p.rot && !isVec(p.rot)) err(`${where} (${p.id}): rot must be [pitch, yaw, roll]`);
    if (p.attach) {
      if (!ATTACH_TO.includes(p.attach.to)) err(`${where} (${p.id}): attach.to "${p.attach.to}" must be one of ${ATTACH_TO.join(', ')}`);
      if (p.attach.offset && !isVec(p.attach.offset)) err(`${where} (${p.id}): attach.offset must be [x, y, z]`);
    }
  }
  const propById = Object.fromEntries((Array.isArray(props) ? props : []).filter((p) => p?.id).map((p) => [p.id, p]));
  const pointOk = (ref) => {
    const [id, name = 'center', extra] = String(ref).split('.');
    if (!Object.hasOwn(propById, id) || extra !== undefined) return false;
    const p = propById[id];
    const points = p.type === 'bench'
      ? (p.incline ? ['center', 'top', 'backTop'] : ['center', 'top', 'head', 'foot'])
      : (Object.hasOwn(POINTS, p.type) ? POINTS[p.type] : []);
    return points.includes(name);
  };
  for (const p of Object.values(propById)) if (p.type === 'cable' && typeof p.to === 'string' && !pointOk(p.to)) err(`cable ${p.id}: "to" "${p.to}" is not a prop point`);

  // Contacts
  const rawContacts = motion.contacts ?? {};
  for (const k of Object.keys(rawContacts)) if (!['feet', 'hands', 'footL', 'footR', 'handL', 'handR'].includes(k)) err(`contacts: unknown key "${k}"`);
  const contacts = expandContacts(rawContacts);
  for (const [k, c] of Object.entries(contacts)) {
    if (!c || (!isVec(c.at) && typeof c.at !== 'string')) { err(`contacts.${k}: "at" must be [x, y, z] or "<propId>.<point>"`); continue; }
    if (typeof c.at === 'string' && !pointOk(c.at)) err(`contacts.${k}: "${c.at}" is not a prop point`);
    if (k.startsWith('foot') && c.toeOut != null && (!isNum(c.toeOut) || c.toeOut < -30 || c.toeOut > 60)) err(`contacts.${k}: toeOut must be between -30 and 60`);
    if (k.startsWith('hand') && c.elbowPole != null && !isVec(c.elbowPole)) err(`contacts.${k}: elbowPole must be [x, y, z]`);
    // A prop carried by the hands can't also be what the hands reach for.
    const id = typeof c.at === 'string' && c.at.split('.')[0];
    const carrier = id && propById[id]?.attach?.to;
    if (carrier && (carrier === 'hands' || /^(hand|forearm|upperArm|foot|shin|thigh)[LR]$/.test(carrier))) err(`contacts.${k}: "${c.at}" is attached to ${carrier}; attach it to the trunk, give it "pos", or drop the contact`);
  }
  const ikJoints = {
    hand: ['shFlex', 'shAbd', 'shRot', 'elbowFlex', 'forearmPro', 'wristFlex'],
    foot: ['hipFlex', 'hipAbd', 'hipRot', 'kneeFlex', 'ankleFlex', 'ankleInv'],
  };

  // Phases
  const phases = motion.phases;
  const phaseNames = [];
  if (!Array.isArray(phases) || !phases.length) err('phases must be a non-empty array');
  else {
    phases.forEach((p, i) => {
      if (!p || typeof p.name !== 'string' || !p.name) err(`phases[${i}]: name is required`);
      else if (phaseNames.includes(p.name)) err(`phases[${i}]: duplicate name "${p.name}"`);
      else phaseNames.push(p.name);
      if (!isNum(p?.start) || !isNum(p?.end) || p.start >= p.end) err(`phases[${i}]: needs start < end`);
      if (i > 0 && p?.start !== phases[i - 1]?.end) err(`phases[${i}] "${p?.name}": start ${p?.start} must equal the previous end ${phases[i - 1]?.end}`);
    });
    if (phases[0]?.start !== 0) err('phases must start at 0');
    if (phases[phases.length - 1]?.end !== 1) err('phases must end at 1');
  }

  // Keyframes (and mistake deltas): times and channel names.
  const checkKeys = (frames, where, { delta = false } = {}) => {
    if (!Array.isArray(frames) || (!delta && frames.length < 2)) { err(`${where} must be an array${delta ? '' : ' of at least 2 keyframes'}`); return; }
    let prev = -Infinity;
    frames.forEach((kf, i) => {
      if (!isNum(kf?.t) || kf.t < 0 || kf.t > 1) err(`${where}[${i}]: t must be between 0 and 1`);
      else if (kf.t <= prev) err(`${where}[${i}]: t=${kf.t} must be after the previous keyframe (${prev})`);
      prev = kf?.t ?? prev;
      if (kf?.ease != null && !EASES.includes(kf.ease)) err(`${where}[${i}]: ease must be one of ${EASES.join(', ')}`);
      for (const [k, v] of Object.entries(kf || {})) {
        if (k === 't' || k === 'ease') continue;
        const range = channelRange(k, propIds);
        if (!range) { err(`${where}[${i}]: unknown channel "${k}"`); continue; }
        if (!isNum(v)) { err(`${where}[${i}]: ${k} must be a number`); continue; }
        if (!delta && (v < range[0] || v > range[1])) err(`${where}[${i}] t=${kf.t}: ${k}=${v} is outside ${range[0]}..${range[1]}`);
        for (const [limb, names] of Object.entries(ikJoints)) {
          const base = k.replace(/[LR]$/, ''), side = k.match(/[LR]$/)?.[0];
          if (names.includes(base) && (side ? contacts[limb + side] : contacts[limb + 'L'] && contacts[limb + 'R'])) warn(`${where}[${i}]: ${k} is ignored because ${limb}${side || 's'} use a contact (IK)`);
        }
      }
    });
  };
  checkKeys(motion.keyframes, 'keyframes');
  const kfs = Array.isArray(motion.keyframes) ? motion.keyframes : [];
  if (kfs.length >= 2) {
    if (kfs[0].t !== 0) err('the first keyframe must be at t=0');
    if (kfs[kfs.length - 1].t !== 1) err('the last keyframe must be at t=1');
    const first = kfs[0], last = kfs[kfs.length - 1];
    for (const k of Object.keys(first)) if (k !== 't' && k !== 'ease' && k in last && Math.abs(first[k] - last[k]) > 1e-9) warn(`${k} differs between t=0 and t=1: the loop will jump`);
    // A channel missing at t=0 or t=1 holds its nearest keyed value there, which is rarely meant.
    const used = new Set(kfs.flatMap((kf) => Object.keys(kf)).filter((k) => k !== 't' && k !== 'ease'));
    for (const k of used) if (!(k in first) || !(k in last)) warn(`${k} is not set at both t=0 and t=1; it holds its nearest keyed value there`);
  }

  // Checks
  const checks = motion.checks ?? [];
  const checkIds = [];
  const landmarkOk = (n) => LANDMARKS.includes(n) || SIDED_LANDMARKS.includes(n) || SIDED_LANDMARKS.some((s) => n === s + 'L' || n === s + 'R') || propById[n] || pointOk(n);
  (Array.isArray(checks) ? checks : []).forEach((ch, i) => {
    const where = `checks[${i}]${ch?.id ? ` (${ch.id})` : ''}`;
    if (!ch?.id || typeof ch.id !== 'string') err(`${where}: id is required`);
    else if (checkIds.includes(ch.id)) err(`${where}: duplicate id`);
    else checkIds.push(ch.id);
    if (!ch?.label) err(`${where}: label is required`);
    const m = ch?.measure;
    if (typeof m === 'string') {
      const ok = ch.sides ? SIDED_MEASURES.includes(m) : MEASURES.includes(m) || SIDED_MEASURES.some((s) => m === s + 'L' || m === s + 'R');
      if (!ok) err(`${where}: unknown measure "${m}"${ch.sides ? ' (with "sides": true use a sided measure without L/R)' : ''}`);
    } else if (m && Array.isArray(m.delta) && m.delta.length === 2) {
      for (const n of m.delta) if (!landmarkOk(n)) err(`${where}: unknown point "${n}"`);
      if (!['x', 'y', 'z', 'dist'].includes(m.axis)) err(`${where}: delta axis must be x, y, z or dist`);
      if (ch.sides) err(`${where}: "sides" only works with a named measure`);
    } else err(`${where}: measure must be a measure name or { "delta": [a, b], "axis": … }`);
    if (!isNum(ch?.min) && !isNum(ch?.max)) err(`${where}: give min, max or both`);
    if (isNum(ch?.min) && isNum(ch?.max) && ch.min > ch.max) err(`${where}: min > max`);
    if (ch?.tol != null && (!isNum(ch.tol) || ch.tol < 0)) err(`${where}: tol must be ≥ 0`);
    if (ch?.phases !== undefined) {
      if (!Array.isArray(ch.phases) || !ch.phases.length) err(`${where}: phases must be a non-empty array`);
      else for (const p of ch.phases) if (!phaseNames.includes(p)) err(`${where}: unknown phase "${p}"`);
    }
    if (!Array.isArray(ch?.parts) || !ch.parts.length) err(`${where}: parts must list the body parts (or props) to color`);
    for (const p of ch?.parts || []) if (!PARTS.includes(p) && !GROUPS[p] && !propById[p]) err(`${where}: unknown part "${p}"`);
  });

  // Mistakes
  const mistakes = motion.mistakes ?? [];
  const mistakeIds = [];
  (Array.isArray(mistakes) ? mistakes : []).forEach((m, i) => {
    const where = `mistakes[${i}]${m?.id ? ` (${m.id})` : ''}`;
    if (!m?.id || typeof m.id !== 'string') err(`${where}: id is required`);
    else if (mistakeIds.includes(m.id) || m.id === 'correct') err(`${where}: duplicate or reserved id`);
    else mistakeIds.push(m.id);
    if (!m?.label) err(`${where}: label is required`);
    if (!m?.cue) err(`${where}: cue is required`);
    if (!Array.isArray(m?.fails) || !m.fails.length) err(`${where}: fails must list at least one check id`);
    for (const f of m?.fails || []) if (!checkIds.includes(f)) err(`${where}: fails "${f}" is not a check id`);
    checkKeys(m?.delta, `${where}.delta`, { delta: true });
  });

  if (errors.length) return { errors, warnings };

  // Simulation at 30 fps, including exact phase starts and authored keyframes.
  const baseTimes = [...frameTimes(motion), ...phases.map((p) => p.start), ...kfs.map((kf) => kf.t)];
  for (const m of [null, ...mistakes]) {
    const times = [...new Set([...baseTimes, ...(m?.delta ?? []).map((kf) => kf.t)])].sort((a, b) => a - b);
    const name = m ? `mistake "${m.id}"` : 'correct rep';
    const red = new Set(), once = new Set();
    const report = (key, msg) => { if (!once.has(key)) { once.add(key); err(msg); } };
    for (const t of times) {
      const pose = evaluate(motion, t, m?.id ?? null);
      const at = `${name} t=${t.toFixed(3)}`;
      for (const r of pose.reach) if (r.err > 0.01) report(`reach-${r.limb}`, `${at}: ${r.limb} misses its contact by ${(r.err * 100).toFixed(1)} cm (move the root closer or the target)`);
      for (const [base, [lo, hi]] of Object.entries(MEASURE_LIMITS)) {
        for (const s of ['L', 'R']) {
          const v = pose.measures[base + s];
          if (v < lo || v > hi) report(`lim-${base}${s}`, `${at}: ${base}${s}=${fmt(v)}° is outside ${lo}..${hi}`);
        }
      }
      for (const [ch, v] of Object.entries(pose.channels)) {
        const range = channelRange(ch, propIds);
        if (range && (v < range[0] - 1e-6 || v > range[1] + 1e-6)) report(`ch-${ch}`, `${at}: ${ch}=${fmt(v)} is outside ${range[0]}..${range[1]}`);
      }
      for (const [k, p] of Object.entries(pose.points)) if (p[1] < -0.02) report(`floor-${k}`, `${at}: ${k} is ${(-p[1] * 100).toFixed(1)} cm below the floor`);
      for (const c of pose.checks) {
        if (!m && (c.status === 'bad' || c.status === 'warn')) report(`chk-${c.id}`, `${at}: check "${c.id}" is ${c.status === 'bad' ? 'red' : 'amber'} on the correct rep (value ${fmt(c.value)})`);
        if (c.status === 'bad') red.add(c.id);
      }
    }
    if (m) for (const f of m.fails) if (!red.has(f)) err(`${name}: check "${f}" never goes red, so the mistake doesn't show (make the delta bigger)`);
  }
  return { errors, warnings };
}
