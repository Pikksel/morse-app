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

## How names work (no login)
- `claim_name` → the name is `UNIQUE` in the DB. On success the server returns a secret token, and the DB stores only its hash.
- The token is saved in localStorage and shown once as a **recovery code**.
- Every score submission sends the token, so nobody else can post as your name.

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

### 3. Game core
- [ ] `js/words.js`: answer list + valid-guess list (5 letters)
- [ ] Daily word: same for everyone, changes 00:00 UTC
- [ ] `js/morse.js`: jscwlib wrapper (play, replay, WPM slider)
- [ ] 6×5 tile grid, Wordle colors (correct / present / absent)
- [ ] On-screen keyboard with Morse patterns + physical keyboard input
- [ ] Timer starts on first Play
- [ ] Board state saved in localStorage (refresh keeps progress)

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
