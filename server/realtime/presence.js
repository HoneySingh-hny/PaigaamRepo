// Registry of live WebSocket connections per user (also answers "is this user online?").
const sockets = new Map(); // userId -> Set<ws>

export const isOnline = (id) => (sockets.get(id)?.size || 0) > 0;
export const onlineIds = () => [...sockets.keys()];

export function addSocket(userId, ws) {
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(ws);
  return sockets.get(userId).size === 1; // first connection => user just came online
}
export function removeSocket(userId, ws) {
  const set = sockets.get(userId);
  if (!set) return false;
  set.delete(ws);
  if (set.size === 0) { sockets.delete(userId); return true; } // last connection => offline
  return false;
}
export function sendToUser(userId, event) {
  for (const ws of sockets.get(userId) || []) ws.send(event);
}
export function sendToUsers(ids, event) { for (const id of new Set(ids)) sendToUser(id, event); }
export function broadcast(event) { for (const id of sockets.keys()) sendToUser(id, event); }
