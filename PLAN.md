# Morse Daily: Project Plan

> A daily Morse code word game (Morsle-style) with unique 1–4 character callsigns and a leaderboard.
> Hosted on GitHub Pages, backend on Supabase.
>
> **Working from several PCs:** `git pull` before you start, `git push` when you're done.
> Claude keeps this file up to date and ticks `[x]` when a step is verified.
> **New Claude chat?** Say: *"Read Morse-web/PLAN.md and continue."*

## Tech stack
- Vanilla HTML / CSS / JS (ES modules, no build step)
- Audio: [jscwlib](https://fkurz.net/ham/jscwlib.html) (MIT)
- Backend: Supabase (Postgres + RPC functions). The browser calls them with `fetch` through `js/api.js`.
- Hosting: GitHub Pages

## How players work (callsign + Morse password)
- **New player:** `register(callsign, password)`. The callsign is `UNIQUE`; the password is 4 dits/dahs (e.g. `.-.-`), stored as a bcrypt hash.
- **Log in:** `login(callsign, password)` from any device.
- Both return a **session token** (only its hash is stored in `sessions`). One player can be logged in on several devices.
- The token is kept in localStorage. Every score submission sends it, so nobody else can post as your callsign.
- 4 dits/dahs = only 16 combinations, so **5 wrong logins lock the callsign for 15 minutes**.
- Log out (tap your callsign badge) deletes this device's session.

## Run locally
From inside `Morse-web/` (the plain `python -m http.server` serves .js as text/plain on Windows):
```
python -c "import http.server as h, mimetypes as m; m.add_type('text/javascript', '.js'); h.test(HandlerClass=h.SimpleHTTPRequestHandler, port=8000)"
```
Open http://localhost:8000. **Keep DevTools open with Network → "Disable cache" ticked** while developing; otherwise the browser runs old JS after changes (this caused several "bugs" that weren't).

## Files
| File | Purpose |
|---|---|
| `index.html` | All screens (start, saved code, game) |
| `style.css` | Styles, light/dark |
| `js/config.js` | Supabase project URL + publishable key (public) |
| `js/api.js` | `rpc()` helper + claimName, verifyPlayer, submitScore, leaderboards |
| `js/player.js` | localStorage for name + token |
| `js/ui.js` | Screen logic (entry point) |
| `js/words.js` | Daily answer list (add new words at the END only) |
| `js/game.js` | Pure game logic: daily word, evaluate guess, saved state, timer math |
| `js/morse.js` | jscwlib wrapper (play at a given WPM) + Morse table |
| `js/results.js` | Results popup + leaderboards + next-word countdown |
| `js/sfx.js` | Win / fail sound effects (`sounds/*.mp3`) |
| `js/confetti.js` | Canvas confetti burst on a win |
| `js/gameView.js` | Game screen: squares, tries meter, Play button, history, keyboard |
| `supabase/schema.sql` | Tables, RLS, RPC functions. Run once in the Supabase SQL Editor. |

---

## Database workflow (since 2026-10-14)
Claude is connected to Supabase (project `csmbbzeobtrywxbknukn`, "Morse Project") and applies migrations directly.
Rule: every change is still saved as `supabase/migrations/00N_*.sql` + `schema.sql` (committed), then applied, then verified.
Security advisor findings "RLS enabled, no policy" + "public SECURITY DEFINER function" are by design (tables locked, functions = the API).

## Steps

### 1. Supabase backend
- [x] Create Supabase project
- [x] Run `supabase/schema.sql`
- [x] Test `claim_name` / `verify_player` in SQL Editor
- [x] Add project URL + publishable key to `js/config.js`

### 2. Start screen + name claim
- [x] Start screen with callsign input (A–Z, 0–9, max 4)
- [x] Claim → show recovery code once
- [x] Same name in private window → "taken"
- [x] Restore with recovery code works

### 2.5 Git + GitHub
- [x] `git init`, first commit
- [x] Create GitHub repo, push: https://github.com/Pikksel/morse-app
- [x] Re-add MIT LICENSE (lost to a force-push of the first commit)
- [ ] Clone on second PC

### 2.6 Login with Morse password (2026-10-12)
- [x] `supabase/migrations/002_morse_password.sql`: password hash, lockout, sessions, `register` / `login` / `logout`
- [x] `schema.sql` updated to the same state (fresh setup)
- [x] Start screen: tabs *New player* / *Log in*, callsign + 4-slot password with • / — pad (beeps), keyboard `.` `-`
- [x] After registering: shows the password to write down
- [x] Session check on load (logged out elsewhere → back to Log in)
- [x] jscwlib loads `async` so the page doesn't wait for fkurz.net
- [x] Ran `002_morse_password.sql` in Supabase
- [x] Test: register + log out (works)
- [x] Test: log in on another browser / private window
- [x] Test: wrong password ×5 → "Too many wrong tries"

### 3. Game core (redesigned 2026-10-10: morsle rules, mobile first)
Rules: **25 tries** (was 21, changed 2026-10-13). Each Play = 1 try = 1 guess. Speed 35 WPM, −5 every 4 tries, down to 10 (35 ×4, 30 ×4, 25 ×4, 20 ×4, 15 ×4, 10 ×5).
Guessing again without Play ("blind guess") also costs a try. Keyboard stays active after the first Play.
Blanks allowed. Correct letters turn green and stay locked; no other hints.
Score = tries used (1–25), 26 = failed; tie-break on time.
- [x] `js/words.js`: 250 answers
- [x] Daily word: same for everyone, changes 00:00 UTC
- [x] `js/game.js`: tries, WPM schedule, green-only evaluation, saved state (tested in Node)
- [x] `js/morse.js`: jscwlib wrapper (play at given WPM)
- [x] Sound confirmed on PC (phone: see step 5)
- [x] Typing a letter plays its Morse once (20 WPM), but not while the word itself is playing
- [x] Mobile layout: 5 squares, 21-dot tries meter, big Play button, guess history, keyboard pinned at bottom
- [x] Play disabled while the current try's sound plays; after guessing, Play starts the next try
- [x] Green letters locked (can't select, type over or delete)
- [x] Last guess carries over to the next try; wrong letters stay gray until typed over
- [x] Tap a square (or ← →) to choose where the next letter goes; orange underline = cursor
- [x] Keyboard never grays out after a guess; player chooses Play (listen) or Guess (blind), both cost a try
- [x] Timer starts on first Play; refresh keeps progress
- [x] 0.4 s lead-in before the sound (audio devices waking up cut off the first letter)
- [x] Square highlights while its letter's Morse is playing (jscwlib `onCharacterPlay`)
- [x] Ran `supabase/migrations/001_21_tries.sql` in Supabase (score range 1–22, verified)

### 4. Scores + leaderboard
- [x] Submit score on finish (`submit_score`), once per day (`submitted` flag in saved state; retries if offline)
- [x] Results popup (`js/results.js`, `<dialog>`): answer + its Morse, tries, time, rank today
- [x] Today's Top 10 + All-time tab (3+ games, miss = 22), own row highlighted
- [x] Countdown to the next word (00:00 UTC)
- [x] Already played today → results open directly
- [x] 🏆 button in header opens the leaderboard (no answer shown mid-game)
- [x] Tested with faked server responses (temp test page, deleted)
- [x] Real database works (today's leaderboard has a real score, read from the live site)

### 4.5 Win / fail effects (2026-10-12)
- [x] `sounds/win.mp3` on solve, `sounds/fail.mp3` when out of tries (`js/sfx.js`)
- [x] Confetti burst from the squares on a win (`js/confetti.js`, own canvas code, respects reduced motion)
- [x] Effects only play at the moment it happens, not when reopening a finished game
- [x] Results popup waits 2.2 s on a win so the confetti is visible

### 4.6 Testing without waiting a day
- Debug reset button: built, then dropped (2026-10-12). Test with a new callsign instead.
- [x] Saved game per callsign (`morse-web:game:<CALL>`), so a new account in the same browser gets a fresh game

### Before sharing: purge test data
- [ ] Beta test (play on phone + PC with a few accounts)
- [ ] Purge test players + scores in Supabase SQL Editor: `delete from players;` (sessions + scores go with them via `on delete cascade`)

### 4.7 Badges (2026-10-12)
- [x] `supabase/migrations/003_badges.sql`: `player_badges` table, `_badges_earned` (rules), `award_badges` (returns only new ones), `get_badges` (public)
- [x] `schema.sql` updated. SQL tested locally in PGlite: fresh setup AND 001→002→003 migration path
- [x] 11 badges (`js/badges.js`): First Contact, Regular (10), Veteran (50), Old Timer (100), Speed Demon (try 1–3), QRQ (try 1), Never Give Up (try 19–21), Streak 7/30, Top of the Band (#1 of a finished day), Week Champion (#1 seven finished days in a row)
- [x] Results popup: word + list first, then "New badge!" cards pop in (bounce, glow, shine) + `sounds/badge.mp3`
- [x] Shown once: reopening the popup doesn't show them again
- [ ] **User: run `003_badges.sql`** in Supabase
- [x] Per-badge sounds: First Contact plays `sounds/first-time.mp3`, others `badge.mp3` (`sound` field in `js/badges.js`)
- [ ] User: find an alien/UFO sound for First Contact (replace `sounds/first-time.mp3`, same name)
- Later: show badges next to callsigns on the leaderboard (`get_badges` is ready)

### 4.8 Beta feedback round 1 (2026-10-13)
0. [x] Yesterday's work committed + pushed
1. **25 tries** (was 21)
   - [x] `MAX_TRIES` 25 (loss scores 26). Speed: 4 tries per level, 35 ×4, 30 ×4, 25 ×4, 20 ×4, 15 ×4, 10 ×5
   - [x] Dot meter groups by speed level automatically (`.speed-end` gap)
   - [x] Migration `004_25_tries.sql`: scores 1–26, old losses 22 → 26, Speed Demon = try 1–4, Never Give Up = try 23–25 (tested in PGlite, both paths)
   - [x] Texts updated (intro, badge descs, all-time note, schema.sql)
   - [x] Ran `004_25_tries.sql` in Supabase
2. **Guess button**
   - [x] [▶ Play] [Guess] side by side under the squares; Guess key removed from keyboard (Enter still works)
3. **Clearer Morse password**
   - [x] Numbered steps ① ②, labels change per tab, hint with example on both tabs
   - [x] Pad buttons labelled "dit" / "dah"
   - [x] Submitting without a password pulses the pad + "Tap • dit and — dah 4 times…"
4. **Android silent mode: no Morse audio**
   - [x] jscwlib output routed through a hidden `<audio>` (MediaStreamDestination), falls back to direct output; AudioContext resumed on each play; Safari `audioSession = 'playback'`
   - [ ] Testers: retest on Android (silent) + iPhone (silent switch)
   - [ ] (Optional) testers' answers: browser? did win/fail MP3s play on silent?

### 4.9 Live rank fix (2026-10-13)
- Bug: "Rank today" froze at the rank from submit time (first finisher stayed #1 forever)
- [x] Migration `005_get_rank.sql`: `get_rank(name, day)` = current rank, works outside the top 10 too (tested in PGlite)
- [x] Results popup fetches the live rank every time it opens
- [x] Ran `005_get_rank.sql` in Supabase

### 4.10 Badges page (2026-10-13)
- [x] 🏅 button in the header (next to 🏆) opens a "Badges" popup, same card style as the leaderboard (`js/badgesView.js`)
- [x] Grid: 3 per row on phones, 4 on wider screens, wrapping down
- [x] Each square: icon, name, faint "Unlocked MM/DD" (e.g. "Unlocked 10/13", player's own time zone)
- [x] Locked badges shown too: grayed-out emoji + faint "LOCKED"
- [x] "3 of 11 unlocked" counter; tap a badge to see how to earn it
- [x] Icons: phone emoji (decided). Font: unchanged for now
- [x] Data from `get_badges(name)` (no DB change needed)

### 4.11 Badge rule changes (2026-10-13)
- [x] Regular 5 games, Veteran 14, Old Timer 30 (were 10 / 50 / 100)
- [x] New badge 🐢 Turtle: solved a word after more than 5 minutes. Never Give Up icon changed to 💪
- [x] Migration `006_badge_rules.sql` + `schema.sql` (tested in PGlite: 4 vs 5 games, 5:01 win / 4:59 win / slow loss)
- [ ] **User: run `006_badge_rules.sql`** in Supabase
- How to change badges: text/icon only → `js/badges.js`. Rules → new migration with the whole `_badges_earned` function (never re-run old migrations)

### 4.12 Title screen (2026-10-13)
- [x] Full-screen drifting gradient, "PLAY" in Orbitron (Google Fonts), "MORSE DAILY" under it (`js/splash.js`)
- [x] Ring around PLAY = "PLAY" in real Morse (dots/dashes via SVG stroke-dasharray, 3× around, slowly rotating)
- [x] Tap: `sounds/enter.mp3`, ring flies out + word fades (0.65 s), then login/game eases in over 1 s
- [x] The tap also unlocks the Morse audio (helps phones)
- [x] Returning players: results popup now waits until after PLAY + the entrance animation
- [x] Popups fade/slide in
- [x] `sounds/enter.mp3` added
- [x] VIP sounds: USSR → `sounds/USSR.mp3`, RM1 → `sounds/RM1.mp3` on the PLAY tap (`PLAYER_SOUNDS` in `js/sfx.js`; loaded only for that player). Add more players/sounds (win, fail, badge…) in the same list

### 4.13 Fixes (2026-10-14)
- [x] Badges page: tapped badge gets a clear "selected" style (tint + glow) that moves to the next tapped badge; browser's sticky tap/focus highlight turned off (keyboard focus ring kept)
- [x] Daily leaderboard shows everyone who played that day (was top 10, DB max 100). Migration `007_full_daily_leaderboard.sql` (tested in PGlite with 120 players)
- [x] Table scrolls in its own box with a sticky header and jumps to your own row
- [x] Applied `007_full_daily_leaderboard.sql` to Supabase (by Claude via the Supabase connection). Verified: 11 of 11 players today returned, public API OK, security advisor: no new issues

### 5. Polish
- [ ] Share button (emoji grid)
- [ ] Help modal (how to play + Morse chart)
- [ ] Favicon
- [ ] Mobile check (375px), audio works on phone
- [ ] README with screenshots

### 6. Deploy
- [x] Enable GitHub Pages (Settings → Pages → main / root). **Live: https://pikksel.github.io/morse-app/**
- [x] Live site: all files load (JS, CSS, MP3), jscwlib loads, Supabase reachable, no console errors
- [ ] User: play on phone (login, sound, confetti) and PC on the live URL
- Every `git push` to `main` redeploys automatically (takes ~1 min)
- [ ] Add to portfolio

## Known limitations / later ideas
- The daily word and scoring run in the browser, so a determined cheater could fake a score. Fix later: validate guesses on the server in a Supabase Edge Function.
- Lost recovery code means the name is lost.
- Any 5 letters count as a guess. Later: add a valid-word list so random letter combos are rejected.
- jscwlib is hotlinked from fkurz.net. Later: vendor a copy into `js/vendor/` so the game doesn't depend on that site.

## Ideas (after beta test / polish)
- ~~Badges~~: done, see step 4.7.
- **Avatar**: Morse-pattern avatar generated from the callsign (on-theme, automatic), or an emoji picker. Avoid photo uploads (storage + moderation).
- **Streak + stats**: current/best streak, chart of how many tries you usually need.
- **Practice mode**: random words, no score, unlimited.
- **Settings**: tone pitch, volume, Farnsworth spacing (jscwlib `eff`).
- **PWA**: installable on phones (manifest + icon), full screen.
