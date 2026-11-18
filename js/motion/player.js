// "Animation" section of the exercise screen. Shown only when motions/index.json lists
// the exercise. three.js (js/motion/view3d.js) is imported once the section scrolls
// into view, and the WebGL context is released when the screen is left.
import { h, onLeave } from '../ui.js';
import { evaluate, FPS } from './pose.js';

const ICON = { good: '✓', warn: '⚠', bad: '✕', off: '–' };
const WORD = { good: 'good', warn: 'near the limit', bad: 'wrong', off: 'not checked now' };
const SPEEDS = [[0.25, '¼×'], [0.5, '½×'], [1, '1×']];
const VIEW_LABELS = [['side', 'Side'], ['front', 'Front'], ['45', '45°']];

let indexPromise = null;
function motionIndex() {
  indexPromise ||= fetch('motions/index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => { indexPromise = null; return []; });
  return indexPromise;
}

export function animationSection(exerciseName) {
  const section = h('section', { class: 'anim', hidden: true });
  const key = exerciseName.trim().toLowerCase();
  motionIndex()
    .then((list) => list.find((e) => e.exercise.toLowerCase() === key))
    .then((entry) => entry && fetch(`motions/${entry.file}`).then((r) => (r.ok ? r.json() : null)))
    .then((motion) => { if (motion) buildPlayer(section, motion); })
    .catch((err) => console.warn('Animation unavailable:', err));
  return section;
}

// Segmented buttons; onPick(value) is called on tap. Returns the element and a setter.
function segmented(label, options, value, onPick) {
  const buttons = options.map(([v, text]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { set(v); onPick(v); } }, text));
  const set = (v) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === v)));
  return [h('div', { class: 'seg', role: 'group', 'aria-label': label }, buttons), set];
}

function buildPlayer(section, motion) {
  if (!section.isConnected) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const frames = Math.max(2, Math.round((motion.durationMs / 1000) * FPS));
  let t = 0, playing = !reduced, loop = true, stopAtPhase = false, speed = 1, mistake = null, viewName = 'side';
  let view = null, raf = 0, last = 0, visible = false, loading = false, disposed = false, ro = null;

  const canvas = h('canvas', { class: 'anim-canvas', role: 'img', 'aria-label': `3D model of one rep of ${motion.exercise}. Drag sideways to rotate.` });
  const status = h('p', { class: 'anim-loading muted' }, 'Loading 3D model…');
  const phaseEl = h('span', { class: 'anim-badge' });
  const timeEl = h('span', { class: 'anim-badge anim-time' });
  const stage = h('div', { class: 'anim-stage' }, canvas, status, phaseEl, timeEl);

  const scrub = h('input', { class: 'anim-scrub', type: 'range', min: 0, max: frames, step: 1, value: 0, 'aria-label': 'Position in the rep',
    oninput: () => { setPlaying(false); t = Number(scrub.value) / frames; show(); } });
  const playBtn = h('button', { type: 'button', class: 'icon', onclick: () => setPlaying(!playing) });
  const step = (d) => {
    setPlaying(false);
    let f = Math.round(t * frames) + d;
    if (loop) f = (f + frames) % frames;
    t = Math.min(frames, Math.max(0, f)) / frames;
    show();
  };
  const loopBtn = h('button', { type: 'button', class: 'icon', 'aria-label': 'Loop', 'aria-pressed': 'true', onclick: () => {
    loop = !loop;
    loopBtn.setAttribute('aria-pressed', String(loop));
  } }, '↻');
  const phaseBtn = h('button', { type: 'button', class: 'icon', 'aria-label': 'Stop at each phase', 'aria-pressed': 'false', onclick: () => {
    stopAtPhase = !stopAtPhase;
    phaseBtn.setAttribute('aria-pressed', String(stopAtPhase));
  } }, 'Phase');
  const [speedSeg] = segmented('Speed', SPEEDS, speed, (v) => { speed = v; });
  const [viewSeg, setViewPressed] = segmented('View', VIEW_LABELS, viewName, (v) => { viewName = v; view?.setView(v); show(); });

  // Correct / mistake chips, and the cue of the selected mistake.
  const cue = h('p', { class: 'anim-cue', hidden: true, 'aria-live': 'polite' });
  const chips = [null, ...(motion.mistakes || [])].map((m) => h('button', {
    type: 'button', class: m ? 'chip mistake' : 'chip', 'aria-pressed': String(!m),
    onclick: () => {
      mistake = m;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chipFor(m))));
      cue.hidden = !m;
      cue.replaceChildren(...(m ? [h('strong', {}, `✕ ${m.label}. `), m.cue] : []));
      show();
    },
  }, m ? m.label : '✓ Correct'));
  const chipFor = (m) => chips[m ? motion.mistakes.indexOf(m) + 1 : 0];

  // Checks with ✓ / ⚠ / ✕ icons, so status is never color alone.
  const rows = (motion.checks || []).map((c) => {
    const icon = h('span', { class: 'ic', 'aria-hidden': 'true' });
    const word = h('span', { class: 'sr' });
    const li = h('li', {}, icon, h('span', {}, c.label, c.phases ? h('small', { class: 'muted' }, ` · ${c.phases.join(', ')}`) : null), word);
    return { li, icon, word, status: null };
  });

  section.replaceChildren(
    h('h2', {}, 'Animation'),
    stage,
    scrub,
    h('div', { class: 'anim-controls' },
      h('button', { type: 'button', class: 'icon', 'aria-label': 'Previous frame', onclick: () => step(-1) }, '⏮︎'),
      playBtn,
      h('button', { type: 'button', class: 'icon', 'aria-label': 'Next frame', onclick: () => step(1) }, '⏭︎'),
      loopBtn,
      phaseBtn),
    h('div', { class: 'anim-controls' }, speedSeg, viewSeg),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Show the correct rep or a mistake' }, chips),
    cue,
    h('ul', { class: 'anim-checks' }, rows.map((r) => r.li)),
    h('p', { class: 'legend' },
      h('span', { class: 'good' }, h('b', {}, '✓'), ' good'),
      h('span', { class: 'warn' }, h('b', {}, '⚠'), ' near the limit'),
      h('span', { class: 'bad' }, h('b', {}, '✕'), ' wrong'),
      h('span', {}, 'grey: not checked now')),
    h('p', { class: 'muted small' }, 'Illustrative model, not motion capture. Your own photos and notes win.'));
  section.hidden = false;

  function show() {
    const pose = evaluate(motion, t, mistake?.id ?? null);
    view?.draw(pose);
    scrub.value = String(Math.round(t * frames));
    phaseEl.textContent = pose.phase?.name ?? '';
    timeEl.textContent = `${((t * motion.durationMs) / 1000).toFixed(2)} s`;
    pose.checks.forEach((c, i) => {
      const r = rows[i];
      if (r.status === c.status) return;
      r.status = c.status;
      r.li.className = c.status;
      r.icon.textContent = ICON[c.status];
      r.word.textContent = `: ${WORD[c.status]}`;
    });
  }

  function frame(now) {
    raf = 0;
    if (disposed || !visible || !section.isConnected) return;
    if (playing) {
      const next = last ? t + ((now - last) * speed) / motion.durationMs : t;
      const boundary = stopAtPhase && motion.phases.find((p) => p.end > t && p.end <= next);
      last = now;
      t = next;
      if (boundary) {
        t = boundary.end;
        setPlaying(false);
      } else if (t >= 1) {
        if (loop) t %= 1;
        else { t = 1; setPlaying(false); }
      }
    }
    show();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && !disposed && visible) raf = requestAnimationFrame(frame);
  }
  function setPlaying(p) {
    if (p && t === 1) t = 0;
    playing = p;
    last = 0;
    playBtn.textContent = p ? '⏸︎' : '▶︎';
    playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
    kick();
  }

  // Drag sideways to orbit (vertical drags keep scrolling the page on touch screens).
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || !view) return;
    view.orbit(-(e.clientX - drag.x) * 0.5, (e.clientY - drag.y) * 0.3);
    drag = { x: e.clientX, y: e.clientY };
    setViewPressed(null);
    if (!playing) show();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  async function load() {
    loading = true;
    try {
      const { createView, motionBounds } = await import('./view3d.js');
      if (disposed) return;
      view = createView(canvas, motion, { bounds: motionBounds(motion) });
      view.setView(viewName);
      ro = new ResizeObserver(() => {
        const w = stage.clientWidth, hgt = stage.clientHeight;
        if (w && hgt && view) { view.resize(w, hgt); show(); }
      });
      ro.observe(stage);
      status.remove();
      show();
    } catch (err) {
      console.warn('3D view failed:', err);
      status.textContent = '3D view is not available on this device.';
    }
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && section.isConnected;
    if (visible && !loading) load();
    if (visible) kick();
    else last = 0;
  }, { rootMargin: '200px 0px' });
  io.observe(stage);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro?.disconnect();
    view?.dispose();
    view = null;
  }
  onLeave(section, dispose);
  setPlaying(playing);
}
