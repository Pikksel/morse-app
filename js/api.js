import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { getMode } from './mode.js';

// Scores, leaderboards and Turbo runs are kept per mode ('normal' | 'easy'): the current one is sent along.
const p_mode = () => getMode();

// Calls a Postgres function through Supabase's REST API.
// Errors raised in SQL (e.g. 'NAME_TAKEN') come back as error.message.
async function rpc(fn, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

// password: 4 symbols of '.' or '-'. Returns a session token.
export const register = (name, password) =>
  rpc('register', { p_name: name, p_password: password });

// Returns { token } or { error: 'BAD_LOGIN' | 'LOCKED', retry_after_s }.
export const login = (name, password) =>
  rpc('login', { p_name: name, p_password: password });

export const logout = (name, token) =>
  rpc('logout', { p_name: name, p_token: token });

export const verifyPlayer = (name, token) =>
  rpc('verify_player', { p_name: name, p_token: token });

export const submitScore = (name, token, day, guesses, timeMs) =>
  rpc('submit_score', { p_name: name, p_token: token, p_day: day, p_guesses: guesses, p_time_ms: timeMs, p_mode: p_mode() });

// After submit_score: stores newly earned badges, returns their ids (empty if none are new).
export const awardBadges = async (name, token) =>
  (await rpc('award_badges', { p_name: name, p_token: token })).map((r) => r.new_badge);

// All badges a player has unlocked: [{ badge_id, earned_at }].
export const getBadges = (name) =>
  rpc('get_badges', { p_name: name });

// Current rank for a day (others may have finished after you). null = no score that day.
export const getRank = (name, day) =>
  rpc('get_rank', { p_name: name, p_day: day, p_mode: p_mode() });

// Everyone who played that day (limit = null), or the top N.
export const getDailyLeaderboard = (day, limit = null) =>
  rpc('get_daily_leaderboard', { p_day: day, p_limit: limit, p_mode: p_mode() });

export const getAlltimeLeaderboard = (limit = 10) =>
  rpc('get_alltime_leaderboard', { p_limit: limit, p_mode: p_mode() });

// ---------- Turbo (server-checked: the database picks letters and keeps the score) ----------

// Returns { run_id, score, lives, next: { letter, wpm, options } }.
export const turboStart = (name, token) =>
  rpc('turbo_start', { p_name: name, p_token: token, p_mode: p_mode() });

// choice = the tapped letter, or null when the timer ran out.
// Returns { correct, answer, late, score, lives, over, next? }.
export const turboAnswer = (name, token, runId, choice) =>
  rpc('turbo_answer', { p_name: name, p_token: token, p_run: runId, p_choice: choice });

// scope 'today' | 'alltime': best score per player.
export const getTurboLeaderboard = (scope = 'today') =>
  rpc('get_turbo_leaderboard', { p_scope: scope, p_mode: p_mode() });

// { today, today_rank, alltime, alltime_rank } (null when no runs).
export const getTurboBest = (name) =>
  rpc('get_turbo_best', { p_name: name, p_mode: p_mode() });
