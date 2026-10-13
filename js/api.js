import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

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
  rpc('submit_score', { p_name: name, p_token: token, p_day: day, p_guesses: guesses, p_time_ms: timeMs });

// After submit_score: stores newly earned badges, returns their ids (empty if none are new).
export const awardBadges = async (name, token) =>
  (await rpc('award_badges', { p_name: name, p_token: token })).map((r) => r.new_badge);

// Current rank for a day (others may have finished after you). null = no score that day.
export const getRank = (name, day) =>
  rpc('get_rank', { p_name: name, p_day: day });

export const getDailyLeaderboard =(day, limit = 10) =>
  rpc('get_daily_leaderboard', { p_day: day, p_limit: limit });

export const getAlltimeLeaderboard = (limit = 10) =>
  rpc('get_alltime_leaderboard', { p_limit: limit });
