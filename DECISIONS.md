# Decisions

Decisions taken after `docs/spec.html` (v3, 3 October 2026). Where they differ from the spec, this file wins.

## 4 October 2026

- **Mission length is 5 min. No choice.** The 5 / 10 / 15 switch on the prompt is removed. One mission, one length.
- **Video missions last the video.** Not 5 min. Each video is trimmed to the routine itself (`start` and `end` seconds in `content/missions.json`); the trim points are still to be set.
- **One video per break**, rotating through the mission's videos.
- **Walking away from the prompt counts.** 5+ min away with the prompt open and no click on Start mission recharges the battery and unlocks Chrome.
- **"Start a break now" runs the same flow and lock**, with a free cancel until Start mission is clicked.
- **"Mission done" notification has no minutes.** Body: "Battery recharged."
- **The micro.breaks tab opens on every Chrome start**, not once a day.
- **Stale style-guide content is ignored**: intent cards, moves rail, "Break logged.", "+N min", today's dot, the overdue time on the prompt.
- **Measuring the test week**: product analytics (PostHog) is being considered. To be discussed; nothing is built yet.

## Welcome screen copy (4 October 2026)

- No "WELCOME" eyebrow. "Stay charged all day." sits on one line, at 72 px.
- "Sharper focus": "Until the work is done."
- Button: "Let's start". Next to it: "Three steps to set your daily movement timer."

## Setup on one screen (4 October 2026)

Replaces the design's step screens (one step per screen, big pastel tile, 88 px headline on three lines, progress cells).

- After the welcome screen, the three steps sit on one screen: the battery on the left, the steps as a list on the right.
- The battery fills as steps are completed: empty and coral at 0 of 3, amber, full and green at 3 of 3.
- One step is open at a time, the first still to do. A done step shows a green tick and a one-line summary, and can be reopened.
- Step 1 holds the editable timer sentence itself. One button, "Continue". No "Keep these" / "Edit".
- Headline "Charge your battery." / "Three steps and micro.breaks is ready.", then "All set." with Start moving on the same screen.

## Mission timer and video missions (4 October 2026)

- "Paused" (amber ring, "Step away to continue.") only shows once some time has run and the user came back. Right after Start mission the ring is green and says "Leave the computer.": nothing is paused yet.
- YouTube refuses embeds without a Referer, and extension pages send none. The extension adds one to its own player frames only (`src/background/youtube.ts`). This needs the `declarativeNetRequestWithHostAccess` permission and access to `www.youtube-nocookie.com`.
- Until trim points are set, a video mission lasts the full length the player reports.
- **Video missions run on the clock, not on being away.** The user is watching the screen, so touching the keyboard pauses nothing. When the video's length has passed, the countdown gives way to a button, "I've done the routine", which recharges the battery. Chrome stays locked until it is clicked.
- Trim points (in `content/missions.json`):
  - Seated stretch 1, "5 min SEATED STRETCH": not trimmed, plays in full (5:29)
  - Seated stretch 2, "5 Minute Reset [OFFICE STRETCH]": 0:05 to 5:20
  - Seated stretch 3, "5 Stretches At Your Desk": 0:47 to 5:10
  - Energy boost 1, "Sedentary Lifestyle? Daily Follow Along": 0:40 to 2:50
  - Energy boost 2, "5 MIN MIDDAY ENERGY BOOST": 0:40 to 6:11
- "Back to work" closes the mission tab, so the user lands on what they had before. If it is the only tab, it becomes the new tab.

## Google Calendar (4 October 2026)

- The extension now has a fixed ID, `hkgliedfglkhagpbpljdbfabimefocak`, set by the `key` in `wxt.config.ts`. The Google OAuth client is tied to it.
- Access is through `chrome.identity.getAuthToken`, with one scope, `calendar.freebusy`: busy times only, no titles or attendees. It works in Google Chrome signed in to a Google account; it does not work in Chrome for Testing.
- Busy blocks for the next 12 hours are fetched every 5 min and kept, so a meeting that starts between two polls is still known. Each tick derives "in a meeting until" from them. Back-to-back and overlapping meetings count as one.
- The OAuth client (type "Chrome extension", Google Cloud project in testing mode) is set in `GOOGLE_CLIENT_ID` in `wxt.config.ts`. Only Google accounts listed as test users can connect.

## After the first real install (4 October 2026)

- **Connecting the calendar is a visible card**, "Protect my meetings" ("You will never be prompted during your meetings."), always shown under the timer sentence, in the setup step and on the movement timer screen. It replaces the "meetings" word in the sentence, which did not look clickable. Once connected, the sentence ends "…or during my Google meetings."
- **The timer chip stays on "Done for today." and "Weekend."**, so the settings are always one click away. The design hid it there.
- The build your own Chrome runs is a copy in `~/Developer/micro.breaks-extension`, refreshed on request, so work in the project does not change it.

## Test phase with friends: identity and analytics (4 October 2026)

- **No accounts.** Each install gets a random ID. The welcome screen asks for an email, required to start, which is attached to that ID so the author can tell testers apart.
- **Usage events go to PostHog** through its HTTP API, from the background (`src/background/analytics.ts`). No SDK. Events are queued in storage and sent in batches, so nothing is lost offline. Nothing is sent from dev builds or while `POSTHOG_KEY` in `src/config.ts` is empty.
- **What is sent, a shortlist of eight events:** `extension_installed`, `setup_step_done`, `setup_completed`, `mission_started`, `mission_completed`, `skip_challenge_shown`, `skip_passed`, `setting_changed` (theme changes left out). Each carries the extension version. Everything else the engine logs stays in the local event log. Never tabs, URLs or calendar content.
- `seated_streak_ended` (`seatedMin`, `endedBy`) is logged locally whenever the seated timer restarts or stops, but is **not** on the shortlist. The "longest seated streak ≤ 60 min" goal can't be read from PostHog; neither can prompts that were ignored or walked away from.
- The PostHog project is in the EU region.
- The README says what is shared. The welcome screen only asks for the email; the explanation there was removed.

## Timer values are changed in place (4 October 2026)

Replaces the design's tray of five values under the sentence, on the setup step and on the movement timer screen.

- Scrolling over a highlighted word changes it. Clicking it shows a previous and a next arrow inside the word; the arrow keys work too. Enter, Escape or a click elsewhere puts it back to rest.
- Reason: in the setup step the tray made the step taller than a small window. Shrinking the screen to fit was rejected; the layout must stay as large as the window allows.
- The steps screen was tightened instead (no subtitle until "All set.", smaller gaps), so it fits at the same scale as every other screen.

## Chrome Web Store (9 October 2026)

Decided: publish as Public, keep the video missions, keep the email, open Google Calendar to everyone.

**What the email is for (10 October 2026):** only to recognise the installation and to contact the user about their feedback. Not for news, marketing or anything else. The welcome screen, the privacy policy, the README and the store listing all say exactly this. Using the addresses for a newsletter later would break that promise and the store's Limited Use policy; it would need a new, separate opt-in first.

- **No "tabs" permission.** The extension finds its own pages with `runtime.getContexts`. Tab URLs are hidden from it, and Chrome no longer warns about browsing history at install.
- **Store item ID:** `fmdmmobegbmccnkioajjlcfjcfjmkgck`. It has its own Google client; the tester build keeps the first one.
- **Two builds.** `npm run package` makes the tester zip (fixed ID) and `micro.breaks-store.zip` (no key; the store assigns the ID). The video review page is in neither.
- **Consent before anything is sent.** The welcome screen says what is collected and links to the privacy policy. Events, the install event included, wait in the queue until the user starts.
- **Setup text by platform.** The notification and login-item instructions are written for macOS, for Windows, and generically for anything else.
- **Homepage and privacy policy** are `docs/index.html` and `docs/privacy.html`, to be served by GitHub Pages. The listing texts, permission justifications and images are in `docs/store/`.
- Known review risks are listed at the end of `docs/store/listing.md`.

## Smaller rules, agreed as defaults

- A prompt due or open when lunch starts is dismissed; the battery recharges.
- A prompt open and not started at the end of the day is dismissed. A running mission can finish.
- Quitting and reopening Chrome during a lock reopens the prompt.
- "Did you step away?" is asked only for gaps inside the same working day and not covered by lunch.
- "While you were away" plays once on the next new tab. No tab is forced open.
- A third or later skip in a day uses the second-skip rules. Maths answers accept "42,5" and "42.5".
- Meetings: primary Google calendar, any busy block holds the prompt and the heads-up.
- macOS only for V1.
