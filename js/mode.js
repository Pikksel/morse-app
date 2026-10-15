// Difficulty: 'normal' or 'easy' (🐣). Picked on the title screen and fixed for the session:
// changing it means going back to the title screen (refresh or ⟵ Exit).
const KEY = 'morse-web:mode';

function load() {
  try { return localStorage.getItem(KEY) === 'easy' ? 'easy' : 'normal'; } catch { return 'normal'; }
}

let mode = load();
document.body.classList.toggle('easy', mode === 'easy');

export const getMode = () => mode;
export const isEasy = () => mode === 'easy';

export function setGameMode(next) {
  mode = next === 'easy' ? 'easy' : 'normal';
  document.body.classList.toggle('easy', mode === 'easy'); // cute look (style.css: body.easy)
  try { localStorage.setItem(KEY, mode); } catch {}
}
