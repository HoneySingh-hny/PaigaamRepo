import { createUser, login, createSession, destroySession, SESSION_MAX_AGE } from '../services/auth.js';
import { publicUser, usernameTaken } from '../services/users.js';
import { HttpError } from '../http/utils.js';

const attempts = new Map(); // ip -> {n, reset}
function throttle(ip) {
  const now = Date.now(); let a = attempts.get(ip);
  if (!a || a.reset < now) a = { n: 0, reset: now + 5 * 60 * 1000 };
  a.n++; attempts.set(ip, a);
  if (a.n > 20) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
}

function setSession(ctx, userId) {
  const secure = ctx.req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  ctx.res.setHeader('Set-Cookie', `sid=${createSession(userId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`);
}

export default function authRoutes(r) {
  r.post('/api/auth/register', async (ctx) => {
    throttle(ctx.req.socket.remoteAddress);
    const user = createUser(await ctx.body());
    setSession(ctx, user.id); ctx.status = 201;
    return { user: publicUser(user) };
  }, { auth: false });

  r.post('/api/auth/login', async (ctx) => {
    throttle(ctx.req.socket.remoteAddress);
    const { username, password } = await ctx.body();
    const user = login(username, password);
    setSession(ctx, user.id);
    return { user: publicUser(user) };
  }, { auth: false });

  r.post('/api/auth/logout', (ctx) => {
    if (ctx.token) destroySession(ctx.token);
    ctx.res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { ok: true };
  }, { auth: false });

  r.get('/api/auth/me', (ctx) => {
    if (!ctx.user) throw new HttpError(401, 'Not signed in.');
    return { user: publicUser(ctx.user) };
  }, { auth: false });

  r.get('/api/auth/check', (ctx) => ({ available: !usernameTaken(ctx.url.searchParams.get('username') || '') }), { auth: false });
}
