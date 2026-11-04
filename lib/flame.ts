// Daily flame — one flame-day per day the user rang the bell,
// localStorage only, no login, no points, no leaderboard, no guilt
// language. Rule change (user, 2026-11-03 evening, after the
// dpl_62cf deploy): ONLY bell ringing counts — incense, chanting,
// sitting/kneeling and fish release no longer mark a flame day.
// Wording rules: the flame icon stays, but NEVER write 'giữ chuỗi',
// and avoid 'điểm danh', 'mất chuỗi', 'đứt chuỗi'. On a missed day
// the count simply restarts at 1 on the next bell day; nothing
// scolds, nothing is lost.

const KEY = 'chua-flame';

export type FlameState = { count: number; lastDate: string | null };

function localDateKey(d: Date): string {
  // Local YYYY-MM-DD in the browser's timezone (the user is in Vietnam).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayKey(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

export function loadFlame(): FlameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { count: 0, lastDate: null };
    const parsed = JSON.parse(raw) as FlameState;
    if (typeof parsed.count !== 'number' || parsed.count < 0) return { count: 0, lastDate: null };
    return { count: parsed.count, lastDate: parsed.lastDate ?? null };
  } catch {
    return { count: 0, lastDate: null };
  }
}

/**
 * Record one practice today. Returns the new state plus whether today
 * was newly counted (false when today was already counted).
 */
export function markFlameDay(now = new Date()): { state: FlameState; countedToday: boolean } {
  const today = localDateKey(now);
  const prev = loadFlame();
  if (prev.lastDate === today) return { state: prev, countedToday: false };
  const next: FlameState =
    prev.lastDate === yesterdayKey(today)
      ? { count: prev.count + 1, lastDate: today }
      : { count: 1, lastDate: today };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, etc.) — flame just doesn't persist.
  }
  return { state: next, countedToday: true };
}

/** Flame badge: icon + one number only, always visible, starting
 * at 0. No 'Đèn đã cháy' text (user, 2026-11-03 evening). Never
 * 'giữ chuỗi'. */
export function flameLabel(state: FlameState): string {
  return `🔥 ${Math.max(0, state.count)}`;
}

export function flameNote(state?: FlameState): string {
  // The user's own wording (2026-11-03 evening): the flame IS the
  // bell rung today. Only say 'Hôm nay đã rung chuông' when today
  // is actually counted, otherwise invite today's bell instead.
  const today = localDateKey(new Date());
  if (state && state.lastDate === today) {
    return 'Hôm nay đã rung chuông, chúc bạn rũ sạch lao xao, neo giữ sự tỉnh thức.';
  }
  return 'Rung chuông hôm nay để ngọn đèn cháy thêm một ngày. Đèn không phải điểm số, chỉ là dấu lặng của những ngày bạn đã rung chuông.';
}
