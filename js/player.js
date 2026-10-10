// The claimed name + secret token, kept in this browser only.
const KEY = 'morse-web:player';

export function loadPlayer() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function savePlayer(name, token) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name, token }));
  } catch {
    // Private mode etc. The player can still play this session.
  }
}

export function clearPlayer() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export const NAME_PATTERN = /^[A-Z0-9]{1,4}$/;
