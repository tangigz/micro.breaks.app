# micro.breaks · Toolbar icon, popup, menu and tooltip

Brief for Claude Code. Build this in the existing Manifest V3 extension. The designs are the PNGs in this folder: `1-toolbar-icon-tooltip-menu.png`, `2-popup-states-dark.png`, `3-popup-states-light.png` and `4-popup-states-added.png`. Where the brief and an image disagree, follow the brief. Decisions taken while building: `DECISIONS.md`, "Toolbar icon, popup, menu and tooltip".

Goal: people see their battery without clicking, and clicking the icon gives them a mini new tab.

## 1. Toolbar icon: a live battery

The toolbar icon is the Glow icon, with its pill acting as the battery. It drains while the user sits, like the new tab battery.

**Drawing** (64-unit artwork, scaled to 16 and 32 px with `OffscreenCanvas` in the service worker, then `chrome.action.setIcon({ imageData: { 16, 32 } })`):

- Tile: 64 × 64, corner radius 15, fill `#0B0B0C`.
- Glow: radial gradient over the tile, centre 50% / 55%, radius 50%, the battery colour at 75% opacity fading to 0.
- Pill track: rect (17, 5), 30 × 54, radius 15, fill `#48484A` (larger than the Glow icon's 22 × 42, so the battery reads at 16 px).
- Charge: same pill, clipped, filled from the bottom to `height = 54 × level`. Vertical gradient from the battery colour lightened 55% toward white (top) to the battery colour (bottom).

**Level and colour** (same rule as the new tab battery):

- `level = 1 − secondsSeated / interval`, clamped 0 to 1.
- Colour: green `#6FCF7A` at full → amber `#FFC56B` at half → coral `#FF8A5B` at empty, linear between the stops.

**States:**

| State | Icon |
|---|---|
| Seated, tracking | Level and colour as above |
| Last 5 minutes before the break | Coral, low level, glow pulses (see below). **No badge.** |
| Break due (Chrome locked) | Empty: a 4-unit coral sliver at the bottom of the pill, coral glow |
| Lunch | Green, refilling |
| Before hours, done for today, weekend | Grey `#8E8E93`, full, no glow |

**Pulse in the last 5 minutes:** one beat every 1.6 s, eased in and out over 20 frames: the glow swells from dim (20%) to full and wider, the charge brightens about 45%, and the pill's track takes on 45% of the battery colour at the peak, so the whole battery lights up at 16 px. Run it with `setInterval` in the service worker only during those 5 minutes; each `setIcon` call keeps the worker alive. Stop it when the break prompt opens. If the worker still gets suspended, fall back to a static, brighter glow for those 5 minutes. Never use `setBadgeText`.

**Update cadence:** redraw the icon once a minute (`chrome.alarms`, period 1 min) and on every state change (break started, completed, skipped, meeting start or end, lunch, end of day).

## 2. Popup: a mini new tab

`action.default_popup: "popup.html"`. Width 320 px, height fits the content. It follows the micro.breaks theme setting and uses the same tokens as the new tab. It reads the current state from the same source as the new tab; do not duplicate the timing logic.

**Layout, top to bottom** (padding 18 px top, 20 px sides, 18 px between blocks):

1. Wordmark "micro.breaks", 15 px / 700, the dot in green.
2. Status row: mini battery (48 × 88 body, 3 px ink border, radius 14, 22 × 6 cap, fill radius 8 with a soft halo in the battery colour) + an eyebrow (12 px / 500, caps, 0.08em tracking, ink-2) + a headline (44 px for "23 min", 30 to 34 px for the others, 700, −0.035em).
3. One line, 15 / 20 px, ink-2, numbers in ink.
4. One primary pill, full width, 44 px, ink fill. Hidden in some states.
5. Schedule chip, 36 px, 1 px outline: timer icon + "Every 60 min · 9:00–18:00" (from the user's settings). Opens the settings. It is the only way to the settings: the designs' "Settings" footer is left out, as a duplicate of the chip.

**States:**

| State | Eyebrow | Headline | Line | Primary pill |
|---|---|---|---|---|
| Seated | NEXT BREAK IN | 23 min | **42 min** since your last active break | Start a break now |
| Last 5 minutes | NEXT BREAK IN | 4 min | **56 min** since your last active break | Start a break now |
| In a meeting | IN A MEETING | Until 11:30 | Your break waits until it ends. | Start a break now |
| Break due | BREAK DUE (coral) | Time to move. | Chrome is locked until you move. | Go to your mission |
| Lunch | LUNCH | Until 13:30 | Tracking paused. Your battery will be full. | none |
| Done for today | FRIDAY · 18:00 | Done for today. | See you tomorrow at 9:00. | none |
| Weekend | SATURDAY | Weekend. | See you Monday at 9:00. | none |
| First run | WELCOME | You're set. | First break at **10:12**. | How it works |
| Before working hours | BEFORE WORKING HOURS | 9:00 | Your day starts at 9:00, at your first activity. | none |
| Break skipped | SKIPPED · NEXT BREAK IN (coral) | 52 min | **1 h 08** since your last active break | Start a break now |
| Break waiting for a meeting | BREAK DUE AT 11:05 (amber) | Until 11:30 | Your break is waiting. It opens when the meeting ends. | Start a break now |
| Chrome was closed | CHROME CLOSED · 40 MIN (amber) | Did you step away? | No answer counts as seated. | Yes, I moved + No, I kept working |
| Mission running, popup opened | MISSION · PAUSED (amber) | 3:12 left | Step away to continue. | Go to your mission |

Battery in the popup: same level and colour as the icon; grey and full for before hours, done and weekend; green and full for lunch and first run; empty for break due, skipped and waiting for a meeting; green and refilling during a mission.

**Actions:**

- Start a break now: opens the break prompt tab, same as the new tab button, and closes the popup.
- Go to your mission: focuses the locked mission tab.
- How it works: opens the site, https://tangigz.github.io/micro.breaks.app/.
- Yes, I moved / No, I kept working: answer the "Did you step away?" question, as on the new tab.
- Chip: opens the movement timer settings.

**First run:** show it from install until the first break prompt fires (keep a `firstRunDone` flag in storage). It is what people see when they click the icon right after installing, so it must work before any tracking data exists. "First break at" = first activity time + interval, or 9:00 + interval if the user hasn't started yet.

## 3. Right-click menu

In `runtime.onInstalled`, create three items with `chrome.contextMenus.create({ contexts: ["action"] })`. Add the `contextMenus` permission.

1. Start a break now
2. Movement timer settings
3. How it works

Same targets as the popup actions. Chrome lists its own items (Remove from Chrome, Unpin, Manage extension) below ours; leave them.

## 4. Tooltip

`chrome.action.setTitle`, updated with the icon:

- micro.breaks · Next break in 23 min
- micro.breaks · In a meeting until 11:30
- micro.breaks · Lunch until 13:30
- micro.breaks · Break due, Chrome is locked
- micro.breaks · Done for today

## Done when

- The icon changes colour and level over a 60-minute interval and matches the new tab battery.
- In the last 5 minutes the icon pulses and no badge ever appears.
- The popup shows the right state in each case above, in light and dark.
- A fresh install shows the first-run popup.
- The three right-click items and the tooltip work.
- The static store icon (`icon-128.png`) and the manifest `icons` entries stay as they are; only the toolbar icon is drawn at runtime.
