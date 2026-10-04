import { chromium } from '@playwright/test';
const b = await chromium.connectOverCDP('http://localhost:9333');
const page = b.contexts()[0].pages().find(p => p.url().includes('/setup.html'));
if (page) { const r = await page.evaluate(() => { const h = document.querySelector('h1'); const c = h.parentElement.parentElement; return [h.innerText, Math.round(h.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().width), getComputedStyle(h).fontSize]; }); console.log(r); }
await b.close();
