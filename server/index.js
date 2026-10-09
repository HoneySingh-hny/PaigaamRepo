import http from 'node:http';
import { PORT } from './config.js';
import './db.js';
import { Router } from './http/router.js';
import { parseCookies, serveStatic } from './http/utils.js';
import { userFromToken } from './services/auth.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import uploadRoutes from './routes/uploads.js';
import { attachRealtime } from './realtime/hub.js';

const router = new Router();
authRoutes(router); chatRoutes(router); uploadRoutes(router);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  const token = parseCookies(req.headers.cookie).sid;
  const ctx = { req, res, url, pathname: url.pathname, token, user: userFromToken(token) };
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    if (!(await router.handle(ctx))) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"Not found"}'); }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname);
});

attachRealtime(server);
server.listen(PORT, () => console.log(`Paigaam is running at http://localhost:${PORT}`));
