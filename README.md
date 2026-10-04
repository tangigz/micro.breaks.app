# micro.breaks

Move a little, every hour you sit.

A Chrome extension. A battery on every new tab drains while you sit. When it is empty, Chrome locks onto one simple mission that takes you away from the computer.

## Try it

micro.breaks is in a test phase. It is not on the Chrome Web Store yet, so you install it by hand. It takes about two minutes.

**You need:** a Mac and Google Chrome.

### Install

1. Download **micro.breaks.zip** from the [latest release](https://github.com/tangigz/micro.breaks.app/releases/latest).
2. Double-click the zip to unpack it. Move the **micro.breaks** folder somewhere it can stay, for example your Documents folder. Chrome runs the extension from that folder, so don't delete it afterwards.
3. In Chrome, open `chrome://extensions`.
4. Turn on **Developer mode**, top right.
5. Click **Load unpacked** and choose the **micro.breaks** folder.
6. A welcome page opens. Enter your email, follow the three steps, then click **Start moving**.

Chrome may ask whether to keep the new tab page that micro.breaks sets. Choose to keep it: the battery lives there.

### What to expect

- Every new tab shows a battery that drains while you sit.
- When it is empty, during the working hours you set, Chrome opens "Time to move." and locks onto one short mission: a walk, a glass of water, a stretch video. Other apps are not blocked.
- The lock ends when the mission is done. The only other way out is the skip challenge, a few sums or a sentence to type.
- Nothing happens outside your working hours, at lunch, or on days off.

To change your hours, click the timer chip on any new tab ("Every 60 min · 9:00–18:00").

### Notifications

In step 2 of the setup, micro.breaks sends a test notification. If it disappears by itself, open **System Settings › Notifications › Google Chrome** and set the style to **Alerts**. Otherwise you will miss the prompt when Chrome is behind another app.

### Google Calendar (optional)

Connecting your calendar makes prompts wait until your meetings end. It only reads when you are busy, never titles or guests.

Google still treats micro.breaks as an app in testing, so only invited accounts can connect. **Send your Google address to Tangi first**, then use **Connect Google Calendar**. Google will warn that the app isn't verified: click **Advanced**, then continue.

### Update

When a new version is announced: download the new zip, replace the contents of your **micro.breaks** folder with it, then click the reload arrow on the micro.breaks card in `chrome://extensions`. Your settings are kept.

### Pause or remove

- **Stuck in a lock and need Chrome now?** Use "Skip (it'll cost you)" on the mission page. If that isn't an option, open `chrome://extensions` and switch micro.breaks off.
- **Pause it:** in `chrome://extensions`, switch the micro.breaks toggle off. Switch it back on to resume.
- **Remove it:** in `chrome://extensions`, click **Remove** on the micro.breaks card. Your new tab goes back to normal straight away and everything micro.breaks stored is deleted. You can then delete the **micro.breaks** folder.
- **If you connected Google Calendar:** remove the access at [myaccount.google.com/connections](https://myaccount.google.com/connections), under micro.breaks.

### What it stores and shares

micro.breaks is in a test phase, so it shares how you use it with its author, Tangi, to learn whether it works:

- **Shared:** the email you give on the welcome screen, and what happens inside micro.breaks: setup steps, breaks shown, started, completed or skipped, time spent seated between breaks, and your timer settings. These go to [PostHog](https://posthog.com), an analytics service.
- **Never shared:** the sites you visit, your tabs, anything you type outside micro.breaks, and your calendar. If you connect Google Calendar, your busy times are read on your computer and stay there.
- Video missions play from YouTube.

Removing the extension stops all of it.

### Feedback

Tell Tangi what annoyed you, what you skipped and why, and whether you would keep it. That is what the test is for.

## For developers

- Product, design and tech spec: [docs/spec.html](docs/spec.html)
- Decisions taken since the spec: [DECISIONS.md](DECISIONS.md)

### Releasing a version to testers

```bash
npm run package
```

This builds `.output/micro.breaks.zip`, holding one `micro.breaks` folder. Attach it to a GitHub release; the guide above links to the latest one.

### Testing a pull request

```bash
npm run pr -- 12
```

This checks out pull request 12, installs dependencies and opens the test browser (Chrome for Testing) with the extension loaded and hot reload on. Stop it with Ctrl+C.

- The test browser keeps its own profile in `.dev-profile`, separate from your Chrome.
- A **Test mode** bar at the bottom of every micro.breaks page plays time forward (+1, +5, +25, +55 min), fakes stepping away and coming back, and resets everything. It only exists in `npm run dev`, never in the built extension.
- First time on a machine: `npx playwright install chromium`.

`npm run dev` does the same for the branch you are on.
