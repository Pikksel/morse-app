// 🧪 Demo Turbo for testing on this computer: http://localhost:5174/?demo
// No login, no server, nothing saved. Only works on localhost, so the live site never uses it.
// Same rules as turbo_* in schema.sql, minus the ⚡ fast-streak bonus.
import { isEasy } from './mode.js';

export const isDemo = () =>
  ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('demo');

export const DEMO_PLAYER = { name: 'DEMO', token: '' };

const randomLetter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
const wpm = (score) => (isEasy() ? Math.min(30, 6 + Math.floor(score / 5)) : Math.min(40, 10 + Math.max(0, score - 2)));

function nextLetter(prev, score) {
  let letter;
  do letter = randomLetter(); while (letter === prev);
  const options = [letter];
  while (options.length < (isEasy() ? 2 : 3)) {
    const c = randomLetter();
    if (!options.includes(c)) options.push(c);
  }
  options.sort(() => Math.random() - 0.5);
  return { letter, wpm: wpm(score), options };
}

let run = null;

export async function turboStart() {
  run = { score: 0, halves: 6, next: nextLetter(null, 0) };
  return { run_id: 'demo', score: 0, halves: 6, next: run.next };
}

export async function turboAnswer(_name, _token, _runId, choice) {
  const answer = run.next.letter;
  const correct = choice === answer;
  if (correct) run.score += 1;
  else run.halves -= 2;
  const over = run.halves <= 0;
  run.next = over ? null : nextLetter(answer, run.score);
  return { correct, answer, late: false, bonus: false, capped: false, score: run.score,
           halves: Math.max(0, run.halves), streak: 0, over, next: run.next };
}

export const getTurboBest = async () => ({ today: 0, alltime: 0 });
export const awardBadges = async () => [];
