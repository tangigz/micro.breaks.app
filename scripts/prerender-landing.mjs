// Saves a static copy of the landing page's content into docs/index.html: node scripts/prerender-landing.mjs
//
// The landing page draws its content with JavaScript, from <template id="page">. Crawlers that
// don't run JavaScript (most search engines other than Google, link previews, AI tools) would
// only see one sentence. This renders the page in a browser and writes the result into
// <div id="app">, between two markers. With JavaScript on, the page's script empties #app and
// mounts the live version over it, so visitors see no difference.
//
// Run it again after any change to the landing page. It is safe to run twice: it replaces what
// is between the markers.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FILE = 'docs/index.html';
const START = '<!-- prerendered:start: made by scripts/prerender-landing.mjs, do not edit by hand -->';
const END = '<!-- prerendered:end -->';

let source = readFileSync(FILE, 'utf8');
// Start from an empty #app, so the copy is never rendered over an older copy
source = source.replace(new RegExp(`${START}[\\s\\S]*?${END}`), '');
writeFileSync(FILE, source);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + path.resolve(FILE));
await page.waitForTimeout(2000);
if (errors.length) throw new Error('The page has errors: ' + errors.join(' | '));

const html = await page.evaluate(() => document.getElementById('app').innerHTML);
await browser.close();
if (/\{\{[^}]+\}\}/.test(html)) throw new Error('The rendered page still has {{placeholders}}');

const before = '<div id="app"></div>';
if (!source.includes(before)) throw new Error('Could not find <div id="app"></div> in ' + FILE);
source = source.replace(before, `<div id="app">${START}${html}${END}</div>`);
writeFileSync(FILE, source);
console.log(`✔ ${FILE}: ${Math.round(html.length / 1024)} KB of static content written into #app`);
