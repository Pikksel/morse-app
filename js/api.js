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

export const claimName = (name) =>
  rpc('claim_name', { p_name: name });

export const verifyPlayer = (name, token) =>
  rpc('verify_player', { p_name: name, p_token: token });

export const submitScore = (name, token, day, guesses, timeMs) =>
  rpc('submit_score', { p_name: name, p_token: token, p_day: day, p_guesses: guesses, p_time_ms: timeMs });

export const getDailyLeaderboard = (day, limit = 10) =>
  rpc('get_daily_leaderboard', { p_day: day, p_limit: limit });

export const getAlltimeLeaderboard = (limit = 10) =>
  rpc('get_alltime_leaderboard', { p_limit: limit });
