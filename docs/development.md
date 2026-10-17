# Development

- Product, design and tech spec: [docs/spec.html](spec.html)
- Decisions taken since the spec: [DECISIONS.md](../DECISIONS.md)

## Releasing a version to testers

```bash
npm run package
```

This builds `.output/micro.breaks.zip`, holding one `micro.breaks` folder. Attach it to a GitHub release, to keep GitHub in step with the store. The README sends people to the Chrome Web Store, not to this zip.

It also builds `.output/micro.breaks-store.zip` for the Chrome Web Store. What to paste into the store's dashboard is in `docs/store/listing.md`.

## Testing a pull request

```bash
npm run pr -- 12
```

This checks out pull request 12, installs dependencies and opens the test browser (Chrome for Testing) with the extension loaded and hot reload on. Stop it with Ctrl+C.

- The test browser keeps its own profile in `.dev-profile`, separate from your Chrome.
- A **Test mode** bar at the bottom of every micro.breaks page plays time forward (+1, +5, +25, +55 min), fakes stepping away and coming back, and resets everything. It only exists in `npm run dev`, never in the built extension.
- First time on a machine: `npx playwright install chromium`.

`npm run dev` does the same for the branch you are on.

## Known tooling vulnerabilities

`npm audit` reports 4 high-severity findings, all from `node-forge`, which `web-ext` (the tool that launches the test browser) pulls in. No fixed version of `node-forge` exists yet. It runs only on the developer's machine and is not part of the extension: `npm audit --omit=dev` reports none. `shell-quote`, from the same tool, is pinned to a fixed version in `package.json` under `overrides`.

## The landing page and search engines

`docs/index.html` draws its content with JavaScript. So that crawlers which don't run JavaScript still read the whole page, it also holds a static copy of the rendered page inside `<div id="app">`, which the page's script replaces with the live version on load.

After any change to the landing page, refresh that copy:

```bash
node scripts/prerender-landing.mjs
```

It needs the Playwright browser (`npx playwright install chromium`) and is safe to run more than once.
