# micro.breaks

Chrome MV3 extension (WXT, React, TypeScript, Tailwind). A battery on every new tab drains while you sit; when empty, Chrome locks onto one mission.

## Sources of truth

- Rules: `docs/spec.html` (PRD tab), then `DECISIONS.md`, which wins where they differ.
- Look: `docs/design/screens.html` (59 frames, 1440 × 900).
- Rules change in the spec or `DECISIONS.md` first, then in code.

- How to run the test browser, test a pull request and build a release: `docs/development.md`. The README is for people installing the extension, not for developers.

## Layout

- `src/engine/` — pure rules engine, `step(state, input, now) → { state, effects }`. No `chrome.*`, no `Date.now()`. Every product rule lives here, with tests.
- `src/background/` — service worker glue: idle, alarms, notifications, tabs. Feeds the engine, executes effects, saves state after every step.
- `src/entrypoints/` — WXT entrypoints. Screens read state and send actions; no rule logic.
- `src/ui/` — design-system components and `tokens.css`.
- `src/data/` — Dexie event log and storage.
- `content/missions.json` — the 7 missions as data.

## Commands

- `npm run dev` — opens the test browser (Chrome for Testing, profile in `.dev-profile`) with hot reload and the Test mode bar
- `npm run pr -- <number>` — checks out a pull request and opens it in the test browser
- `npm run build` — unpacked build in `.output/chrome-mv3`
- `npm test` — Vitest (rules engine)
- `npm run e2e` — builds, then runs the extension in Chromium with Playwright
- `npm run typecheck`

## Conventions

- One slice per GitHub issue, one pull request.
- Colours only through the tokens in `src/ui/tokens.css`. The battery is the only live colour.
- Copy is short, calm, second person. Take it from the spec word for word.
