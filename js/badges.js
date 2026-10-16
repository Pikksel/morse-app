// Badge names, icons and descriptions. The rules live in the database (_badges_earned in schema.sql);
// ids here must match the ids it returns. `sound` (optional) = a key in sfx.js, else the default badge sound.
// mode 'easy' = a 🐣 Easy badge (only Easy games count); the rest are Normal badges.
export const BADGES = {
  first_contact: { icon: '📡', name: 'First Contact',   desc: 'Played your first game', sound: 'firstContact' },
  regular:       { icon: '🎧', name: 'Regular',         desc: '5 games played' },
  veteran:       { icon: '🎖️', name: 'Veteran',         desc: '14 games played' },
  old_timer:     { icon: '📻', name: 'Old Timer',       desc: '30 games played' },
  speed_demon:   { icon: '⚡', name: 'Speed Demon',     desc: 'Solved at full speed (try 1–4)' },
  qrq:           { icon: '🚀', name: 'QRQ',             desc: 'Solved on the very first try' },
  never_give_up: { icon: '💪', name: 'Never Give Up',   desc: 'Solved in the last 3 tries' },
  turtle:        { icon: '🐢', name: 'Turtle',          desc: 'Solved a word after over 8 minutes' },
  // Streaks count weekdays only: Friday → Monday is "in a row", weekends don't count
  streak_3:      { icon: '🕯️', name: 'Streak 3',        desc: 'Played 3 weekdays in a row' },
  streak_5:      { icon: '🔥', name: 'Streak 5',        desc: 'Played a full week (5 weekdays in a row)' },
  streak_10:     { icon: '☄️', name: 'Streak 10',       desc: 'Played 10 weekdays in a row' },
  streak_15:     { icon: '🌋', name: 'Streak 15',       desc: 'Played 15 weekdays in a row' },
  top_band:      { icon: '🥇', name: 'Top of the Band', desc: '#1 of the day' },
  week_champion: { icon: '👑', name: 'Week Champion',   desc: '#1 five weekdays in a row' },
  time_to_go_home: { icon: '🏠', name: 'Time to Go Home', desc: 'Missed the Daily 2 weekdays in a row' },
  turbocharged:  { icon: '🏎️', name: 'Turbocharged',    desc: 'Played a Turbo run' },
  // 🐣 Easy
  easy_hatchling:   { mode: 'easy', icon: '🐣', name: 'Hatchling',     desc: 'Played your first Easy game' },
  easy_growing:     { mode: 'easy', icon: '🌱', name: 'Growing',       desc: '5 Easy games played (Daily or Turbo)' },
  easy_brave_heart: { mode: 'easy', icon: '🎈', name: 'Brave Heart',   desc: 'Kept going to the very last try' },
  easy_bright_idea: { mode: 'easy', icon: '💡', name: 'Bright Idea',   desc: 'Solved the word after the hint appeared' },
  easy_slow_steady: { mode: 'easy', icon: '🐢', name: 'Slow & Steady', desc: 'Played Easy 3 days in a row' },
  easy_little_star: { mode: 'easy', icon: '⭐', name: 'Little Star',   desc: '10 points in one Easy Turbo run' },
};

// Badges of the current mode (the 🏅 page shows only these).
export const badgeIdsFor = (mode) => Object.keys(BADGES).filter((id) => (BADGES[id].mode ?? 'normal') === mode);
