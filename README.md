# Prompt Quest

A free, hands-on game for learning to get great results from AI.

**Play free:** open this site. All 6 worlds (30 stages) plus the **Power User Pack** (4 more worlds) are included.

On a phone, use your browser's "Add to Home Screen" to install it like an app. It works offline after the first visit.

Enjoying it? You can [buy me a coffee](https://ko-fi.com/akratechnologies).

---

## For Andrew: how this repo works
- The game is free, so the full game and the Power User Pack are both published here.
- Visitor stats (no cookies, no personal data): https://akratech.goatcounter.com
- To update after changing the master file and pack file:
  `node tools/build-free.mjs "path/to/Prompt Quest.html" "path/to/pack1-master.html"`
  Then copy everything in `dist/free/` to the top of this repo.
- `tools/build.mjs` is the old paid-trial builder. It is kept for reference only.

© 2026 Akra Technologies LLC. All rights reserved.
