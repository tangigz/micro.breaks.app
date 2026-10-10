import { chromium } from '@playwright/test';
let b; try { b = await chromium.connectOverCDP('http://localhost:9333'); } catch (e) { console.log('attach failed:', e.message.split('\n')[0]); process.exit(0); }
const ctx = b.contexts()[0];
const id = new URL(ctx.serviceWorkers()[0].url()).host;
let page = ctx.pages().find(x => x.url().endsWith('/setup.html'));
if (!page) { page = await ctx.newPage(); await page.goto(`chrome-extension://${id}/newtab.html`); await page.waitForTimeout(1500); }
await page.bringToFront();
console.log('tabs:', ctx.pages().map(p => p.url().split('/').pop() || 'blank').join(', '));
console.log('shows:', await page.locator('h1').innerText(), '| email field:', await page.getByLabel('Your email').count(), '| consent:', (await page.getByText('By starting, you agree').innerText()).replace(/\s+/g, ' '));
await b.close();
