# Morse Daily: Project Plan

> A daily Morse code word game (Morsle-style) with unique 1–4 character callsigns and a leaderboard.
> Hosted on GitHub Pages, backend on Supabase.
>
> **Working from several PCs:** `git pull` before you start, `git push` when you're done.
> Claude keeps this file up to date and ticks `[x]` when a step is verified.
> **New Claude chat?** Say: *"Read Morse-web/PLAN.md and continue."*

## ▶ Where we left off (2026-10-15)
Live: https://pikksel.github.io/morse-app/ (GitHub Pages, repo Pikksel/morse-app). DB: Supabase, migrations 001–013 applied (Claude applies them via the Supabase connection; 011 = pg_cron debug job, not in schema.sql).
Built: Daily (25 tries, 35→10 WPM), Turbo mode (#turbo, server-checked, half-heart fast bonus), callsign + Morse-password login, leaderboards (Daily / Turbo separate), 14 badges + badges page, title screen (Morse ring, ripples, shimmer, floating dits/dahs, parallax, shark easter egg, fun facts), calm background when not playing, pause timer when page hidden.
**New 2026-10-15: 🐣 Easy mode + 🎀 cute Morse sound (step 4.21)**, built and tested locally, not pushed yet. The user should test it on the phone (a real game in Easy Daily + Easy Turbo, 🎀 sound on/off).
Open:
- Decide: keep or remove Turtle for DAW1 / SHYT (earned under old 5-min rule)
- 2026-10-15: badge backfill (players who qualified but hadn't finished a game since badges launched): 9 badges to ABC, ASDF, FIRS, SNOM, TAGG. 0 badges still owed
- ⏰ Debug rule (migration 011, pg_cron): on **2026-10-16 05:01 UTC** ABC and ASDF are deleted if they haven't played (Daily or Turbo) since 2026-10-15 05:00 UTC; the job then removes itself. Tested in rolled-back transactions (delete path + keep-if-played path). Check the result: `select * from cron.job_run_details order by start_time desc limit 5;` and whether ABC/ASDF still exist. Cancel before then: `select cron.unschedule('delete-test-accounts-abc-asdf');`
- Idea: also check for owed badges when the app opens (prevents this for future badges)
- 2026-10-15: test accounts PSPS + COOP deleted (with their 16 Turbo runs, 1 badge, 1 session). 28 players left
- Shark: `sounds/shark.mp3` is 9.5 s (audible to ~9.1 s, loudest 6–7 s), code assumes 7 s → decide: match code to clip, or trim clip
- Unused files to delete before commit: `sounds/badge.mp3`, `sounds/enter_old.mp3` (`sounds/sonar.mp3` kept for later)
- Phone retest (silent mode audio, Android + iPhone)
- Step 5 polish: share button, help popup, favicon, README with screenshots
- Optional: shorter URL (rename repo), purge test players before sharing widely

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

### 4.14 Pause when away (2026-10-14)
- [x] Timer pauses while the page is hidden (phone locked, other tab/app) via `visibilitychange`; resumes when visible
- [x] Away-time saved in the game state (`pausedMs`, `pausedAt`), so it also works if the browser closes the page while away
- [x] Saved time / leaderboard time = active playing time only
- [x] Tested: fake-clock unit test in Node (10 s + 60 s away + 5 s = 15 s; 1 h closed = 0 s) + browser event test
- Trade-off: players could step away to think (they can't hear the word while away; time is only the tie-breaker)

### 4.15 Turbo mode (built 2026-10-14)
**Gameplay**
- Start → 3 lives ❤️❤️❤️. One letter plays once (no replay), 3 big answer buttons below.
- Correct: +1 score, green flash, next letter plays. Wrong: −1 life, red flash shows the right letter, next letter.
- Answer timer: 5 s per letter with a shrinking bar, starting *after* the letter finished playing. Timeout = miss.
- 0 lives → game over: score, personal best, rank, Turbo leaderboard, "Play again". Unlimited runs per day.
- Letters A–Z.

**Speed**: letters 1–3 at 10 WPM, then +1 WPM per correct answer (11, 12, 13…); misses don't speed up. Cap 40 WPM.
→ wpm = min(40, 10 + max(0, score − 2)), score = correct answers so far.

**Wrong options**: random letters until score 10, then similar-sounding letters (Morse patterns that differ by one symbol, e.g. A .- / R .-. / W .--).

**Placement**: same app. Daily / Turbo switch in the header + link `…/morse-app/#turbo`. Shared login, sounds, title screen.

**Leaderboard**: new "Turbo" tab in the 🏆 popup: today's best runs + all-time best (best score per player; tie → whoever reached it first). Also shown at game over.

**Anti-cheat: server-checked** (the database picks letters, checks answers, counts the score)
- Table `turbo_runs` (player, score, lives, current letter, when it was sent, started/ended).
- `turbo_start(name, token)` → run id + first letter, options, wpm (starting a new run ends any open run).
- `turbo_answer(name, token, run_id, choice)` → correct?, right answer, score, lives, game over?, next letter + options + wpm. `choice = null` = timeout.
- Server enforces the timer: answer later than letter duration + 5 s + ~2 s network slack = miss.
- `get_turbo_leaderboard(scope 'today' | 'alltime')`, `get_turbo_best(name)`.
- Known limit: the browser has to receive the letter to play it, so a scripted bot could still read it. Server-checking stops simply *submitting* fake scores.
- Hiding the page mid-letter most likely costs that letter (the server clock keeps running). Fine for a fast mode.

**Files**: `js/turbo.js` (game + view), Turbo section in `index.html`, header switch, Turbo tab in `js/results.js`, migration `008_turbo.sql` + `schema.sql`.
**Sounds**: short built-in correct beep / wrong buzz; can be replaced later with `sounds/correct.mp3` / `sounds/wrong.mp3`.
**Later**: Turbo badges (e.g. score 25 / 50 / 100).

**Build order**: 1) DB migration + PGlite tests (timer, scoring, lives, cheating attempts) → apply to Supabase → verify. 2) Turbo screen + game loop. 3) Header switch + `#turbo` link. 4) Leaderboard tab. 5) Phone-size test.
- [x] 1. Database: `008_turbo.sql` + `009_turbo_search_path.sql` (advisor fix), tested in PGlite (both paths), applied to Supabase, verified with a rolled-back test run (no test data left)
- [x] 2. Turbo screen + game loop (`js/turbo.js`): orb, 5 s timer bar (starts after the letter), feedback, lives, game over, personal best + confetti
- [x] 3. Shared header with Daily / Turbo switch + `#turbo` link (also opens Turbo straight from the title screen)
- [x] 4. Turbo leaderboard popup (from 🏁 and the game-over screen). Each mode shows only its own board: Turbo = "🏁 Turbo leaderboard" + Today / All-time; Daily = Today / All-time + next-word countdown (2026-10-14)
- [x] 5. Tested at phone size, dark + light mode, with a fake server: right/wrong/timeout, game over, new best, mode switching
- [x] Per-run look: random hue + one of 5 patterns (dots, stripes, rings, grid, cross), light + dark
- [x] Generated correct/wrong blips (`blip()` in `js/sfx.js`)
- [x] Turbo game over (no new best): random one of `sounds/turbo-fail.mp3` … `turbo-fail8.mp3` (8 files, never twice in a row), picked + preloaded at run start. Add more in `RANDOM_SOUNDS` in `js/sfx.js`
- [x] Header follows the mode: Turbo hides 🏅 badges (Daily-only) and shows 🏁 for the Turbo leaderboard (also on the game-over button)
- Leaving Turbo mid-run ends the run (score so far counts). Daily results popup now opens only once per session
- [ ] User: play it on the phone

### 4.16 Title screen: underwater effects (2026-10-14)
- [x] Tap outside the PLAY ring: 3 CSS ripple rings (thick → thin → faint), steady speed
- [x] Ripple hits the PLAY ring → reacts at the exact moment (timing from distance; tested: predicted 895 ms, fired 896 ms)
- [x] Floating dits & dahs drifting up: 8 ambient, +2 per tap, max 40; removed at the top
- [x] Two depth layers: front = small + bright, deep = bigger, darker, blurred, slower ("under the water")
- [x] Parallax: layers shift with mouse (desktop) / tilt (Android; iPhone needs a permission prompt, so it stays still)
- [x] Everything stops after PLAY (no background work); reduced-motion users get no particles
- [x] Tap sound `sounds/enter-tap.mp3`: one per tap, random pitch ±12%, always ≥5% away from the previous tap, 4 players so quick taps overlap, 50% volume (`PITCHED_SOUNDS` in `js/sfx.js`)
- [x] Ring hit sound: `sounds/play-shimmer.mp3` on every hit (min 0.3 s apart), pitch ±8%, 35% volume. (Sonar ping tried and dropped; `sounds/sonar.mp3` kept for later)
- [x] Ring hit animation: smaller bump (1.5%) + a band of light and shadow sweeps through the Morse dashes, entering from the side the ripple came from (SVG gradient `#ring-shine` + `animateTransform`, overlay circle with the same dashes)
- [x] 🦈 Easter egg: 15 taps within 6 s → a blurred shark silhouette swims across the deep layer (SVG, swaying tail, bobbing path, random direction), plays `sounds/shark.mp3`, scatters nearby dits/dahs, and drains the scene's colors (saturation 20% at the 5 s peak, back by 7 s = sound length; swim 7 s). Cooldown 1 min. Tune: SHARK_TAPS, SHARK_WINDOW_MS, SHARK_COOLDOWN_MS, SHARK_SWIM_MS in `js/splash.js`
- [x] `sounds/shark.mp3` added (9.5 s; timing to be matched, see top of plan)
- [x] 💡 Fun Morse facts: tap exactly 5 times + pause 1.5 s → a small dark card slides in near the bottom, stays 10 s, then dissolves into a cloud (blur + puffs). 15 facts in `js/facts.js` (own words; Britannica + well-known basics), no repeats until all seen
- [x] A 1.5 s pause also resets the shark counter: shark = one continuous frenzy, facts never summon it (tested both ways)
- Tune in `js/splash.js`: RIPPLE_RADIUS, RIPPLE_MS (must match `.ripple` 1.5s in style.css), RIPPLE_RINGS, AMBIENT, MAX_PARTICLES, PER_TAP

### 4.17 Daily keyboard readability (2026-10-14)
- [x] Letters bigger (1.4rem) and white; keys a bit taller (62 px)
- [x] Morse drawn as shapes (round dot, pill dash, fixed gap) instead of `.`/`-` text, so dashes never merge (O = 3 separate dashes)
- [x] Fits the narrowest keys: widest code (Q/Y) 27.6 px in a 30.7 px key at 375 px width
- [x] Light mode keys darker (`--key: #6f6a61`) so white text is readable there too

### 4.18 Calm background when not playing (2026-10-14)
- [x] `js/ambient.js`: two faint orange glows slowly drifting + up to 12 slow, dim dits/dahs floating up
- [x] On: login screens, Daily before first Play / finished, Turbo start + game over, any popup (leaderboard, badges)
- [x] Off (fades out ~1 s): title screen (has its own effects), a Daily word in progress, a Turbo run in progress
- [x] Games signal play start/stop with a `morse:state` event; `updateAmbient()` in `js/ui.js` decides (also watches screens + popups)
- [x] No work while off (glows paused, no new particles); reduced-motion: no movement
- [x] Tested: all 8 on/off transitions through a full session

### 4.19 Badge updates (2026-10-14)
- [x] Badges page: explanation line shows only the description (square already shows icon + name)
- [x] Migration `010_badge_updates.sql` (applied by Claude, tested in PGlite on both paths):
  - Week Champion: #1 on 5 finished days in a row (was 7)
  - Turtle 🐢: solved after > 8 minutes (was 5)
  - Streak 7 → Streak 5 🔥 (new id `streak_5`; existing streak_7 badges moved; none existed live)
  - New 🏠 Time to Go Home: missed the word 2 days in a row
  - New 🏎️ Turbocharged: played a Turbo run
- [x] Badges are now also awarded at Turbo game over (new-badge card in the game-over screen)
- [x] Fixed `schema.sql` order: `turbo_runs` table moved to the top (badge rules reference it; a fresh setup failed before)
- [ ] User decision: DAW1 (7:03) and SHYT (5:30) earned Turtle under the old 5-min rule. Keep (default) or remove?
- [x] New badges revealed one at a time, 2 s apart, each with its pop-in animation and `sounds/new-badge.mp3` (First Contact keeps `first-time.mp3`). Shared `js/badgeReveal.js` for Daily popup + Turbo game over; stops if the screen closes. `badge.mp3` retired (too big)

### 4.20 Turbo fast bonus (2026-10-15)
- [x] 3 fast correct answers in a row (within 2 s after the letter finished) = +½ heart; max 5 hearts. Slow / wrong / timeout resets the streak. Wrong still costs a whole heart
- [x] Server-checked: migration `012_turbo_fast_hearts.sql` (lives → `halves`, 6 = 3 hearts, max 10; `fast_streak`; +0.6 s network slack). Tested in PGlite (both paths) + rolled-back run on Supabase; applied
- [x] UI: half hearts (left half red), extra heart slots above 3, ⚡ streak pips under the hearts, "⚡ Fast streak! +½ ❤️" + sparkle on the heart that grew; intro text explains it
- Note: responses still include `lives` (= halves / 2) so an old open tab doesn't break

### 4.21 🐣 Easy mode — BUILT 2026-10-15
- [x] DB: migration 013 (mode column, mode-aware RPCs, Easy Turbo rules, 6 Easy badges). PGlite tests on both paths, applied, verified in a rolled-back run, advisors OK
- [x] Title screen Easy | Normal toggle (`js/mode.js`, localStorage `morse-web:mode`, body class `easy`) + ⟵ Exit (reloads to the title screen, Daily clock paused)
- [x] Easy Daily: own word (list offset by half), 20→5 WPM, Morse hint under the squares after 5 tries, own save key `…:easy`, own leaderboards
- [x] Easy Turbo: 2 options, 6 WPM +1 per 5, 10 s timer, 4 s fast window, own leaderboards
- [x] Easy badges on the 🏅 page (per mode)
- [x] Cute look: pastel tokens + Fredoka (`--display` font variable), rounder squares/buttons, soft heart pop
- [x] 🎀 Cute Morse (`js/cuteMorse.js`): header toggle in both modes, default off, Web Audio scheduling (timing checked: exact), each symbol cuts the previous one, silent-mode routing
- [x] Easy sounds: `cute-win.mp3` replaces win (Daily solved + Turbo personal best), `enter-tap-cute.mp3` replaces the title-screen tap (swap lives in sfx.js `EASY_SOUNDS`)
- [ ] User: test on phone (real Easy game, 🎀 on/off, Exit), then push

Original proposal (kept for reference):
**Choosing the mode**
- Title screen: **Easy | Normal** toggle under PLAY (remembers the last choice). Locked for the session.
- Back to the title screen: refresh, or **⟵ Exit** button top left (new). Header Daily/Turbo switch works inside the chosen mode.

**Easy Daily**
- Own daily word (same word list, different word each day) → Easy never spoils Normal; a player can play both each day.
- Speeds 20 → 17 → 14 → 11 → 8 → 5 WPM (4 tries each, last 5). 25 tries like Normal.
- Hint: after 5 failed tries the word's Morse pattern (• – • …) appears under the squares and stays.
- Own leaderboard: 🐣 Easy Today / All-time.

**Easy Turbo**
- 2 answer buttons, always random letters (never similar-sounding).
- Starts at 6 WPM, +1 WPM per 5 correct answers. 10 s per letter.
- Hearts as Normal (3, half-heart bonus up to 5). Fast window 4 s (Normal: 2 s) — proposal.
- Own leaderboard: 🐣 Easy Turbo Today / All-time.

**🐣 Easy badges (6, encouraging)** — only Easy games count; Normal badges stay Normal-only
| Badge | Earned by |
|---|---|
| 🐣 Hatchling | First Easy game |
| 🌱 Growing | 5 Easy games played |
| 🎈 Brave Heart | Finished an Easy Daily without solving it |
| 💡 Bright Idea | Solved the Easy word after the Morse hint appeared (try 6+) |
| 🐢 Slow & Steady | Played Easy 3 days in a row |
| ⭐ Little Star | 10 points in one Easy Turbo run |
- 🏅 page in an Easy session shows the Easy badges; in Normal the Normal ones (proposal).

**🎀 Cute Morse sound (toggle, for fun/testing)**
- Small 🎀 toggle in the header (Easy mode; proposal: also allowed in Normal? see questions). Remembered per device. Default off.
- Dits play `sounds/cute-ding.mp3`, dahs `sounds/cute-dash.mp3` (user adds them).
- Feasible at speed: both files are decoded once into the Web Audio API and every symbol is scheduled on the audio clock (millisecond-exact at any WPM, unlike `<audio>` which lags 20–50 ms on phones).
- Each new symbol stops the previous one (cut). Morse timing stays correct; the square highlight still follows the letters.
- Routed through the same hidden-`<audio>` trick as the normal Morse, so it also plays with the phone on silent.
- Proposal: typed letters (keyboard) also use the cute sounds when the toggle is on.

**🍬 Cute look (Easy only)**
- Pastel palette (mint, pink, lavender), rounder bubbly font (e.g. "Baloo 2" / "Fredoka" from Google Fonts), soft bouncy animations, 🐣 in the header.
- Pastel versions of the title screen ring and Turbo backgrounds; heart pop instead of shake.

**Database (Claude)**
- `mode` column ('normal' | 'easy') on `scores` (unique per player + day + mode) and `turbo_runs`.
- Leaderboards / rank / best: mode parameter. Easy Turbo rules on the server (2 options, speed steps, 10 s, 4 s fast window).
- 6 Easy badge rules; Normal badge rules limited to Normal games.
- As always: migration file + schema.sql, PGlite tests (both paths), apply, verify with rolled-back runs, advisors.

**Build order:** 1) DB → 2) title-screen toggle + Exit → 3) Easy Daily → 4) Easy Turbo → 5) Easy badges → 6) cute look → 7) 🎀 cute Morse sound.

**Decided:** fast window 4 s; 🎀 in both modes, default off; badge names as above; 🏅 page per mode.

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
