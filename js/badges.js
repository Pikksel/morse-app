// Badge names, icons and descriptions. The rules live in the database (_badges_earned in schema.sql);
// ids here must match the ids it returns. `sound` (optional) = a key in sfx.js, else the default badge sound.
export const BADGES = {
  first_contact: { icon: '📡', name: 'First Contact',   desc: 'Played your first game', sound: 'firstContact' },
  regular:       { icon: '🎧', name: 'Regular',         desc: '10 games played' },
  veteran:       { icon: '🎖️', name: 'Veteran',         desc: '50 games played' },
  old_timer:     { icon: '📻', name: 'Old Timer',       desc: '100 games played' },
  speed_demon:   { icon: '⚡', name: 'Speed Demon',     desc: 'Solved at full speed (try 1–3)' },
  qrq:           { icon: '🚀', name: 'QRQ',             desc: 'Solved on the very first try' },
  never_give_up: { icon: '🐢', name: 'Never Give Up',   desc: 'Solved on try 19–21' },
  streak_7:      { icon: '🔥', name: 'Streak 7',        desc: 'Played 7 days in a row' },
  streak_30:     { icon: '☄️', name: 'Streak 30',       desc: 'Played 30 days in a row' },
  top_band:      { icon: '🥇', name: 'Top of the Band', desc: '#1 of the day' },
  week_champion: { icon: '👑', name: 'Week Champion',   desc: '#1 seven days in a row' },
};
