#!/usr/bin/env node
// Contact sheets of motion files for visual review, rendered by the real in-app
// renderer in headless Chromium (Playwright). One PNG per variant (correct + each
// mistake): 8 frames per row, one row per view.
//
//   node scripts/contact-sheet.mjs [slug …] [--out dir] [--frames 8] [--views side,front] [--query 't=0,0.5&w=480&h=600']
//
// Playwright is not a dependency of the repo: set PLAYWRIGHT=/path/to/node_modules/playwright
// (default /tmp/smoke/node_modules/playwright). BASE_URL=http://… uses a running server;
// otherwise one is started with `python3 -m http.server` and stopped at the end.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const out = resolve(opt('out', join(root, 'contact-sheets')));
const frames = opt('frames', '8');
const views = opt('views', 'side,front');
const extra = opt('query', ''); // e.g. "t=0,0.5&w=480&h=600" for a close-up
const slugs = args.length ? args : readdirSync(join(root, 'motions')).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5));

const pwPath = process.env.PLAYWRIGHT || '/tmp/smoke/node_modules/playwright';
const { chromium } = await import(pathToFileURL(join(pwPath, 'index.mjs')).href);

let server = null;
let browser = null;
try {
  let base = process.env.BASE_URL;
  if (!base) {
    const port = 8700 + Math.floor(Math.random() * 200);
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
    base = `http://127.0.0.1:${port}`;
    for (let i = 0; ; i++) {
      try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ }
      if (i > 50) throw new Error('http server did not start');
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  mkdirSync(out, { recursive: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const slug of slugs) {
    await page.goto(`${base}/scripts/contact-sheet.html?motion=${slug}.json&frames=${frames}&views=${views}${extra ? `&${extra}` : ''}`);
    await page.waitForFunction(() => window.__sheets || null, null, { timeout: 60000 }).catch(() => {});
    const sheets = await page.evaluate(() => window.__sheets);
    if (!sheets) throw new Error(`${slug}: no sheets rendered. ${errors.join(' | ')}`);
    for (const [variant, url] of Object.entries(sheets)) {
      const file = join(out, `${slug}-${variant}.png`);
      writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file);
    }
  }
  if (errors.length) console.error('Page errors:\n' + errors.join('\n'));
} finally {
  server?.kill();
  await browser?.close();
}
