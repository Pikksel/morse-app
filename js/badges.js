// Badge names, icons and descriptions. The rules live in the database (_badges_earned in schema.sql);
// ids here must match the ids it returns. `sound` (optional) = a key in sfx.js, else the default badge sound.
export const BADGES = {
  first_contact: { icon: '📡', name: 'First Contact',   desc: 'Played your first game', sound: 'firstContact' },
  regular:       { icon: '🎧', name: 'Regular',         desc: '5 games played' },
  veteran:       { icon: '🎖️', name: 'Veteran',         desc: '14 games played' },
  old_timer:     { icon: '📻', name: 'Old Timer',       desc: '30 games played' },
  speed_demon:   { icon: '⚡', name: 'Speed Demon',     desc: 'Solved at full speed (try 1–4)' },
  qrq:           { icon: '🚀', name: 'QRQ',             desc: 'Solved on the very first try' },
  never_give_up: { icon: '💪', name: 'Never Give Up',   desc: 'Solved in the last 3 tries' },
  turtle:        { icon: '🐢', name: 'Turtle',          desc: 'Solved a word after over 8 minutes' },
  streak_5:      { icon: '🔥', name: 'Streak 5',        desc: 'Played 5 days in a row' },
  streak_30:     { icon: '☄️', name: 'Streak 30',       desc: 'Played 30 days in a row' },
  top_band:      { icon: '🥇', name: 'Top of the Band', desc: '#1 of the day' },
  week_champion: { icon: '👑', name: 'Week Champion',   desc: '#1 five days in a row' },
  time_to_go_home: { icon: '🏠', name: 'Time to Go Home', desc: 'Missed the word 2 days in a row' },
  turbocharged:  { icon: '🏎️', name: 'Turbocharged',    desc: 'Played a Turbo run' },
};
