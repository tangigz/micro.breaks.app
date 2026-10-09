# Development

- Product, design and tech spec: [docs/spec.html](spec.html)
- Decisions taken since the spec: [DECISIONS.md](../DECISIONS.md)

## Releasing a version to testers

```bash
npm run package
```

This builds `.output/micro.breaks.zip`, holding one `micro.breaks` folder. Attach it to a GitHub release; the README's download button points to the latest one.

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
