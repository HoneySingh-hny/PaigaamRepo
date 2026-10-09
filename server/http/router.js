import { HttpError, sendJson, readJson } from './utils.js';

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler, { auth = true } = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler, auth });
  }
  get(p, h, o) { this.add('GET', p, h, o); }
  post(p, h, o) { this.add('POST', p, h, o); }
  delete(p, h, o) { this.add('DELETE', p, h, o); }

  async handle(ctx) {
    const { req, res, pathname } = ctx;
    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.re);
      if (!m) continue;
      ctx.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        if (r.auth && !ctx.user) throw new HttpError(401, 'Please sign in.');
        ctx.body = () => readJson(req);
        const out = await r.handler(ctx);
        if (!res.writableEnded && !res.headersSent) sendJson(res, ctx.status || 200, out ?? { ok: true });
      } catch (e) {
        if (!(e instanceof HttpError)) console.error(e);
        if (!res.headersSent) sendJson(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Something went wrong.' });
      }
      return true;
    }
    return false;
  }
}
