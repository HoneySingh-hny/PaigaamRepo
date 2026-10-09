const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
export const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export function dayLabel(ts) {
  const now = Date.now();
  if (sameDay(ts, now)) return 'Today';
  if (sameDay(ts, now - 864e5)) return 'Yesterday';
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}
export function listTime(ts) {
  const now = Date.now();
  if (now - ts < 60e3) return 'now';
  if (sameDay(ts, now)) return clock(ts);
  if (sameDay(ts, now - 864e5)) return 'Yesterday';
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
export const dayKey = (ts) => new Date(ts).toDateString();
export const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function lastSeenText(ts) {
  if (!ts) return 'Offline';
  return 'Last seen ' + (sameDay(ts, Date.now()) ? 'today at ' + clock(ts) : new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' }));
}
