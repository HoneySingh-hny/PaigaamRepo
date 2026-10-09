// Hash router: #/login, #/register, #/chat, #/chat/:id
import { state } from './state.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { ChatPage } from './pages/ChatPage.js';

const pages = { login: LoginPage, register: RegisterPage, chat: ChatPage };
let current = null; // { name, page }

export function navigate(path) {
  if (location.hash === '#' + path) render(); else location.hash = path;
}
export function start() {
  addEventListener('hashchange', render);
  render();
}
function render() {
  let [, name, id] = location.hash.slice(1).split('/');
  if (!pages[name]) name = state.me ? 'chat' : 'login';
  if (!state.me && name === 'chat') name = 'login';
  if (state.me && name !== 'chat') name = 'chat';
  const wanted = '#/' + name + (name === 'chat' && id ? '/' + id : '');
  if (location.hash !== wanted) { history.replaceState(null, '', wanted); }

  if (current?.name === name && current.page.update) { current.page.update({ id }); return; }
  current?.page.unmount?.();
  const root = document.getElementById('app');
  root.replaceChildren();
  current = { name, page: pages[name](root, { id }) || {} };
}
