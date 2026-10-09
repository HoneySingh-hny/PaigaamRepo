// Single WebSocket connection with automatic reconnect and a tiny event bus.
const handlers = new Map();
let ws = null, retry = 0, stopped = true, timer = null;

const fire = (type, data) => handlers.get(type)?.forEach((fn) => fn(data));
export function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(fn);
  return () => handlers.get(type).delete(fn);
}
function open() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => { retry = 0; fire('open'); };
  ws.onmessage = (e) => { try { const d = JSON.parse(e.data); fire(d.type, d); } catch { /* ignore bad frame */ } };
  ws.onclose = () => { fire('close'); if (!stopped) timer = setTimeout(open, Math.min(1000 * 2 ** retry++, 10000)); };
}
export function connect() { if (!stopped) return; stopped = false; open(); }
export function disconnect() { stopped = true; clearTimeout(timer); ws?.close(); handlers.clear(); }
export const isOpen = () => ws?.readyState === 1;
export function send(obj) { if (!isOpen()) return false; ws.send(JSON.stringify(obj)); return true; }
