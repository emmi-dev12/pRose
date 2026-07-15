// "Stay unlocked on this device." Convenience vs. privacy: when the writer opts in,
// we keep the passphrase in localStorage so reopening the page skips the lock screen.
// It's their own device and their choice — the "Lock" action clears it. Off by default
// keeps the strict encrypted-at-rest posture.

const KEY = 'prose:session';

export function savedPass(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberPass(pass: string): void {
  try {
    localStorage.setItem(KEY, pass);
  } catch {
    /* storage blocked — silently fall back to asking each time */
  }
}

export function forgetPass(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
