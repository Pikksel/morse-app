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
Open http://localhost:8000. If you see a MIME error after a server change, use DevTools → Empty cache and hard reload.

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
| `js/gameView.js` | Game screen: squares, tries meter, Play button, history, keyboard |
| `supabase/schema.sql` | Tables, RLS, RPC functions. Run once in the Supabase SQL Editor. |

---

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
- [ ] Test: log in on another browser / private window
- [ ] Test: wrong password ×5 → "Too many wrong tries"

### 3. Game core (redesigned 2026-10-10: morsle rules, mobile first)
Rules: 21 tries. Each Play = 1 try = 1 guess. Speed 40 WPM, −5 every 3 tries, down to 10.
Guessing again without Play ("blind guess") also costs a try. Keyboard stays active after the first Play.
Blanks allowed. Correct letters turn green and stay locked; no other hints.
Score = tries used (1–21), 22 = failed; tie-break on time.
- [x] `js/words.js`: 250 answers
- [x] Daily word: same for everyone, changes 00:00 UTC
- [x] `js/game.js`: tries, WPM schedule, green-only evaluation, saved state (tested in Node)
- [x] `js/morse.js`: jscwlib wrapper (play at given WPM)
- [ ] **User: confirm sound is heard** on PC + phone
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
- [ ] Submit score on finish (`submit_score`)
- [ ] Results modal: result, time, your rank
- [ ] Today's Top 10 + All-time tab
- [ ] Already played today → open results directly
- [ ] 🏆 button in header opens the leaderboard

### 5. Polish
- [ ] Share button (emoji grid)
- [ ] Help modal (how to play + Morse chart)
- [ ] Favicon
- [ ] Mobile check (375px), audio works on phone
- [ ] README with screenshots

### 6. Deploy
- [ ] Enable GitHub Pages (Settings → Pages → main / root)
- [ ] Test the live URL end to end
- [ ] Add to portfolio

## Known limitations / later ideas
- The daily word and scoring run in the browser, so a determined cheater could fake a score. Fix later: validate guesses on the server in a Supabase Edge Function.
- Lost recovery code means the name is lost.
- Any 5 letters count as a guess. Later: add a valid-word list so random letter combos are rejected.
- jscwlib is hotlinked from fkurz.net. Later: vendor a copy into `js/vendor/` so the game doesn't depend on that site.
