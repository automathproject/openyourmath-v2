// Chaque figure de content/animations s'affiche dans Chromium, dans la page que
// sert /animation/<nom> (même HTML, même CSP, KaTeX compris), et survit à un clic
// sur chacun de ses boutons et aux bornes de chacun de ses curseurs. Une
// modification du kit qui casse une figure échoue ici.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import playwright from '@playwright/test';
import { WIDGET_CSP, widgetPage } from '../../src/lib/widgets/page.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ORIGIN = 'http://oym.test';
const KATEX = path.join(path.dirname(createRequire(import.meta.url).resolve('katex/package.json')), 'dist');
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };

const kitScript = fs.readFileSync(path.join(ROOT, 'src/lib/widgets/kit.js'), 'utf8');
const kitStyle = fs.readFileSync(path.join(ROOT, 'src/lib/widgets/kit.css'), 'utf8');
const animationsRoot = path.join(ROOT, 'content/animations');
const widgets = fs.readdirSync(animationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((source) => fs.readdirSync(path.join(animationsRoot, source.name))
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({ name: path.basename(file, '.js'), file: path.join(animationsRoot, source.name, file) })));

let browser;
beforeAll(async () => { browser = await playwright.chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe.each(widgets)('figure $name', ({ name, file }) => {
  it('s’affiche et réagit sans erreur', async () => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.route(`${ORIGIN}/**`, async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === `/animation/${name}`) {
        const body = widgetPage({ name, kitScript, kitStyle, widgetScript: fs.readFileSync(file, 'utf8') });
        return route.fulfill({ body, contentType: 'text/html', headers: { 'content-security-policy': WIDGET_CSP } });
      }
      const vendor = pathname.match(/^\/animation-vendor\/katex\/(.+)$/);
      if (vendor) {
        return route.fulfill({
          body: fs.readFileSync(path.join(KATEX, vendor[1])),
          contentType: TYPES[path.extname(vendor[1])],
          headers: { 'access-control-allow-origin': '*' },
        });
      }
      return route.fulfill({ status: 404 });
    });

    await page.goto(`${ORIGIN}/animation/${name}`, { waitUntil: 'networkidle' });
    const widget = page.locator(`[data-widget="${name}"]`);
    expect(await widget.evaluate((el) => el.classList.contains('oym-widget')), 'figure non affichée').toBe(true);
    expect(await widget.locator('.oym-body > *').count(), 'corps de la figure vide').toBeGreaterThan(0);
    // KaTeX chargé : aucune formule ne doit rester en LaTeX.
    expect(await widget.innerText()).not.toMatch(/\\\(|\\\[/);

    for (const button of await widget.locator('button:visible').all()) await button.click();
    for (const slider of await widget.locator('input[type="range"]').all()) {
      for (const bound of ['min', 'max']) {
        await slider.evaluate((input, key) => {
          input.value = input[key];
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, bound);
      }
    }
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);
});
