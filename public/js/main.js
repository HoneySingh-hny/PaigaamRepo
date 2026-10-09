import { api } from './services/api.js';
import { state } from './state.js';
import { start } from './router.js';

async function boot() {
  try { state.me = (await api.get('/api/auth/me')).user; } catch { state.me = null; }
  start();
}
boot();
