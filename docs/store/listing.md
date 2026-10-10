# Chrome Web Store listing

Everything to paste into the developer dashboard. The texts must stay in line with `docs/privacy.html`: if what the extension collects changes, change both.

## Package

The item's ID on the store is `fmdmmobegbmccnkioajjlcfjcfjmkgck`. The Google client for that ID is set in `wxt.config.ts`.

Upload `.output/micro.breaks-store.zip`, built by `npm run package`. It has no fixed ID: the store assigns one.

## Store listing tab

**Name**

    micro.breaks

**Summary** (132 characters at most; the dashboard reads it from the zip's manifest, set in `wxt.config.ts`)

    Move a little, every hour you sit. A battery drains on your new tab; when it's empty, Chrome locks until you take a short break.

**Category:** Well-being (under Lifestyle). If it is not offered, Workflow & Planning.

**Language:** English

**Description**

    micro.breaks gets you out of your chair once an hour.

    A battery on every new tab drains while you sit. When it is empty, Chrome locks onto one short mission that takes you away from your desk. Do the mission and the battery recharges.

    WHAT IT DOES

    • Replaces your new tab page with a battery and the time to your next break.
    • At break time, opens a "Time to move." tab with one mission: a walk, a glass of water, the stairs, a short stretch video.
    • Locks Chrome onto that tab until the mission is done. If you switch to another tab or window in Chrome, you are brought back. Your other apps are not blocked.
    • The mission timer only counts down while you are away from your keyboard and mouse.
    • Really can't right now? A skip challenge lets you out: a few sums, or a sentence to type exactly.

    YOU STAY IN CONTROL

    • You choose how often (every 30 to 90 minutes), your working hours, your days, and your lunch break.
    • Nothing happens outside those hours, at lunch, or on days off.
    • Optional: connect Google Calendar and you are never prompted during a meeting.
    • To pause, switch the extension off in chrome://extensions. To stop, remove it: your new tab is back to normal at once.

    WHAT IT ASKS FOR, AND WHY

    • Your email, on the welcome screen, only to recognise your installation and to contact you about your feedback.
    • A few usage events (setup finished, missions started, completed or skipped, timer changes), to improve it.
    • It never reads the sites you visit, your tabs or your history.
    • If you connect Google Calendar, it reads only when you are busy, never titles or guests, and that stays on your computer.

    Privacy policy: https://tangigz.github.io/micro.breaks.app/privacy.html

**Images**

| Image | File |
|---|---|
| Store icon, 128 × 128 | `docs/store/icon-128.png` (also inside the zip) |
| Screenshots, 1280 × 800 | `docs/store/screenshot-1-new-tab.png` to `screenshot-5-skip.png` |
| Small promo tile, 440 × 280 | `docs/store/promo-440x280.png` |

Regenerate them with `npm run build && node scripts/store-screens.mjs`.

**Homepage URL:** https://tangigz.github.io/micro.breaks.app/

**Support URL:** https://github.com/tangigz/micro.breaks.app/issues

## Privacy tab

**Single purpose**

    micro.breaks reminds people who work at a computer to take a short movement break at a regular interval. It shows the time to the next break on the new tab page and, at break time, keeps Chrome on one "mission" tab until the break is taken or deliberately skipped.

**Permission justifications**

| Permission | Justification |
|---|---|
| `idle` | Detects whether the user is at the keyboard and mouse. This is how the seated timer knows when the user sat down, how a 5-minute absence counts as a break, and how the mission timer only counts down while the user is away. The idle state is used on the device only and is never sent anywhere. |
| `alarms` | Runs a one-minute tick so the seated timer and break prompts keep working when the service worker is asleep, and a 5-minute poll of calendar busy times when the user connected a calendar. |
| `notifications` | Shows three notifications: 5 minutes before a break, when the break is due, and when the mission is completed. They reach the user when Chrome is behind another window. |
| `storage` | Stores the user's timer settings, the current state of the timer and break, and a short queue of usage events waiting to be sent. |
| `declarativeNetRequestWithHostAccess` | Two missions play a YouTube video inside an extension page. YouTube refuses embedded playback when the request has no Referer header, and extension pages send none. One session rule adds a Referer header (the extension's public source URL) to requests for `youtube-nocookie.com/embed/` frames that are opened by this extension itself. No other request, tab or site is touched. |
| `identity` | Used only if the user clicks "Connect Google Calendar": obtains a Google OAuth token for the read-only `calendar.freebusy` scope. |
| Host `https://www.youtube-nocookie.com/*` | Needed for the rule above to apply to the embedded video frame. |
| Host `https://www.googleapis.com/calendar/*` | Calls the Calendar free/busy endpoint to learn when the user is in a meeting, so that no break prompt is shown during it. Only busy time ranges are requested: no titles, attendees or descriptions. |
| Host `https://eu.i.posthog.com/*` | Sends the usage events described in the privacy policy to the extension's analytics project, after the user has agreed on the welcome screen. |
| New tab override (`chrome_url_overrides`) | The new tab page is where the battery and the countdown to the next break are shown. It contains no search box and changes no search setting. |

**Remote code:** No, I am not using remote code. All scripts are in the package. The YouTube player runs in an iframe isolated from the extension.

**Data usage: what is collected**

- [x] Personally identifiable information (the email address, used only to recognise the installation and to contact the user about their feedback)
- [x] User activity (which missions were started, completed or skipped inside the extension; no clicks, keystrokes or browsing activity)
- [ ] Health information, financial information, authentication information, personal communications, location, web history, website content: none

**Certifications:** tick all three (no sale to third parties, no use unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL:** https://tangigz.github.io/micro.breaks.app/privacy.html

## Test instructions tab

Username and password: empty, there is no login. The field for instructions takes 500 characters at most. Pasted:

    No login needed.
    1. Welcome page: enter any email, click Let's start, Continue, Allow, Send a test, Yes it stayed, Done, Start moving.
    2. Open a new tab: battery and countdown. If it says "Done for today", click the timer chip and move the end of day later (breaks only run in working hours, 9:00-18:00 by default).
    3. Click "Start a break now": Chrome is kept on the mission tab.
    4. Click Start mission, then stay idle 5 min, or click "Skip (it'll cost you)".
    Google Calendar is optional.

## Distribution tab

**Visibility:** Public. **Regions:** all. **Pricing:** free.

## Status

Submitted for review on 10 October 2026, as version 0.1.4. Uploading a new package while it is in review restarts the review.

## Known review risks

- **The required email.** It is used only to recognise the installation and to contact the user about their feedback, which is tied to improving the extension, and this is said on the welcome screen and in the privacy policy. A reviewer may still ask why it is required to use the product. Making it optional would remove the question.
- **The lock.** It is the product, and it is described first in the listing. A reviewer may still read "minimal distractions" strictly.
- **The Referer header for YouTube.** Disclosed in the justification above.
