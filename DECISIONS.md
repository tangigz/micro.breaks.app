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

## Smaller rules, agreed as defaults

- A prompt due or open when lunch starts is dismissed; the battery recharges.
- A prompt open and not started at the end of the day is dismissed. A running mission can finish.
- Quitting and reopening Chrome during a lock reopens the prompt.
- "Did you step away?" is asked only for gaps inside the same working day and not covered by lunch.
- "While you were away" plays once on the next new tab. No tab is forced open.
- A third or later skip in a day uses the second-skip rules. Maths answers accept "42,5" and "42.5".
- Meetings: primary Google calendar, any busy block holds the prompt and the heads-up.
- macOS only for V1.
