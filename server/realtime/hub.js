// Wires WebSocket upgrades to authenticated sessions, presence and event handlers.
import db from '../db.js';
import { parseCookies } from '../http/utils.js';
import { userFromToken } from '../services/auth.js';
import { acceptUpgrade } from './websocket.js';
import { addSocket, removeSocket, broadcast, onlineIds } from './presence.js';
import { handleEvent } from './handlers.js';

export function attachRealtime(server) {
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://localhost');
    const origin = req.headers.origin;
    if (url.pathname !== '/ws' || (origin && new URL(origin).host !== req.headers.host)) { socket.destroy(); return; }
    const user = userFromToken(parseCookies(req.headers.cookie).sid);
    if (!user) { socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    const ws = acceptUpgrade(req, socket);
    if (!ws) return;

    if (addSocket(user.id, ws)) broadcast({ type: 'presence', userId: user.id, online: true });
    ws.send({ type: 'ready', online: onlineIds() });

    ws.on('message', (raw) => {
      let ev; try { ev = JSON.parse(raw); } catch { return; }
      try { handleEvent(user, ev); } catch (e) { console.error('[ws]', e); }
    });
    ws.on('close', () => {
      if (removeSocket(user.id, ws)) {
        const lastSeen = Date.now();
        db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(lastSeen, user.id);
        broadcast({ type: 'presence', userId: user.id, online: false, lastSeen });
      }
    });
  });

}
