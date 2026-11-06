/**
 * Remembers, per browser, that someone has seen the opening. Returning
 * visitors get the lamp lit immediately. Storage can be unavailable (private
 * mode, blocked cookies), so every access is guarded and failure is silent.
 */

const KEY = 'diwali-house:intro-seen';

export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberIntroSeen(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Not worth surfacing: the only cost is replaying the slow opening.
  }
}
