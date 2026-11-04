// Tiny DOM helpers. Build elements with h() so user text is never parsed as HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// Object URLs for photo blobs, revoked whenever the screen changes.
let urls = [];
export function blobURL(blob) {
  const u = URL.createObjectURL(blob);
  urls.push(u);
  return u;
}
export function revokeURLs() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Hidden file input, resolves with the chosen files (empty array if cancelled).
export function pickFiles({ accept, multiple = false }) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, style: 'display:none' });
    input.addEventListener('change', () => {
      resolve([...input.files]);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

// Render technique cues: "- item" lines become bullets, other lines headings.
export function renderCues(text) {
  const out = [];
  let list = null;
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim();
    if (!line) { list = null; continue; }
    const m = line.match(/^[-*•]\s*(.*)$/);
    if (m) {
      if (!list) out.push((list = h('ul')));
      list.append(h('li', {}, m[1]));
    } else {
      list = null;
      out.push(h('h3', { class: /mistake/i.test(line) ? 'warn' : null }, line));
    }
  }
  return out;
}
