// 🎃🎄 Seasonal themes: on between two dates (Swedish calendar days, like the Daily).
// Sets <body data-season="…">: style.css (look) and sfx.js (sounds) follow it.
// Testing: …/?season=halloween turns one on any day, …/?season=none turns them all off.
import { todayKey } from './game.js';

// from/to as 'MM-DD', both days included. A season must start and end in the same year.
// startsAt (optional): the exact premiere moment on the first day. Before it, the title screen counts down (splash.js).
const SEASONS = [
  { id: 'halloween', from: '10-26', to: '11-01', startsAt: '2026-10-26T21:15:00+01:00' }, // premiere 21:15 Swedish time
];

let upcoming = null; // the season premiering later today: { id, startsAt }

function pick() {
  const forced = new URLSearchParams(location.search).get('season');
  if (forced) return SEASONS.some((s) => s.id === forced) ? forced : null;
  const day = todayKey().slice(5); // '2026-10-27' → '10-27'
  const s = SEASONS.find((x) => day >= x.from && day <= x.to);
  if (s?.startsAt && Date.now() < Date.parse(s.startsAt)) {
    upcoming = s;
    return null;
  }
  return s?.id ?? null;
}

const season = pick();
if (season) document.body.dataset.season = season;

export const getSeason = () => season;
export const getUpcomingSeason = () => upcoming;
