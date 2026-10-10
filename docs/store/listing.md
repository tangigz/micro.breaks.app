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

**Description** (written by Tangi; this is the text kept for the submission)

    # Sitting all day in front of your computer?

    micro.breaks helps you build regular movement breaks into your workday, at the office or at home, so you can stay energized, focused, and feel better in your body.

    Your battery drains as you sit. When it's empty, it's time to move. Complete a five-minute mission to unlock Chrome and get back to work.

    **No more snoozed reminders. Just five minutes to move, recharge, and get back to work.**

    ## MAKE YOUR BREAKS HAPPEN

    🔋 **See your sitting time add up.** Your new tab shows a battery that drains as you sit, counting down to your next movement break.

    🔒 **Your break can't be ignored.** When it's time to move, Chrome keeps you on your break mission for five minutes, so you can't simply switch tabs and carry on working.

    🚶 **Five-minute missions to get you moving.** We suggest what to do during your day: take a walk, grab some water, climb the stairs, or follow a quick stretch video.

    🧮 **Think twice before skipping.** You have to solve a few math challenges if you want to unlock Chrome instead of completing your five-minute break.

    ## FITS YOUR WORKDAY

    ⏰ **Your schedule, your rules.** Set your break frequency, working hours, days, and lunch break.

    📅 **Meeting-safe.** Connect Google Calendar to avoid interruptions during meetings.

    😴 **Off means off.** No breaks outside your working hours or on your days off.

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
