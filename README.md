# micro.breaks

Move a little, every hour you sit.

A Chrome extension. A battery on every new tab drains while you sit. When it is empty, Chrome locks onto one simple mission that takes you away from the computer.

- Product, design and tech spec: [docs/spec.html](docs/spec.html)
- Decisions taken since the spec: [DECISIONS.md](DECISIONS.md)

## Testing a pull request

```bash
npm run pr -- 12
```

This checks out pull request 12, installs dependencies and opens the test browser (Chrome for Testing) with the extension loaded and hot reload on. Stop it with Ctrl+C.

- The test browser keeps its own profile in `.dev-profile`, separate from your Chrome.
- A **Test mode** bar at the bottom of every micro.breaks page plays time forward (+1, +5, +25, +55 min), fakes stepping away and coming back, and resets everything. It only exists in `npm run dev`, never in the built extension.
- First time on a machine: `npx playwright install chromium`.

`npm run dev` does the same for the branch you are on.
