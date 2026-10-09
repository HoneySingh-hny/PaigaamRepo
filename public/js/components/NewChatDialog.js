import { h, debounce } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { searchUsers, openDirect, createGroup } from '../services/chats.js';
import { toast } from '../utils/toast.js';

export function openNewChatDialog({ onCreated }) {
  let mode = 'direct', users = [], selected = new Map();

  const close = () => { overlay.remove(); removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();

  const search = h('input', { class: 'dlg-input', type: 'search', placeholder: 'Search people by name or username', autocomplete: 'off' });
  const groupName = h('input', { class: 'dlg-input', type: 'text', placeholder: 'Group name', maxlength: '60' });
  const chips = h('div', { class: 'chips' });
  const results = h('div', { class: 'dlg-list' });
  const createBtn = h('button', { class: 'btn', onclick: makeGroup }, 'Create group');
  const seg = h('div', { class: 'seg' });
  const groupBox = h('div', { class: 'group-box hidden' }, groupName, chips);

  function renderSeg() {
    seg.replaceChildren(...[['direct', 'New chat'], ['group', 'New group']].map(([id, label]) =>
      h('button', { class: mode === id ? 'active' : '', onclick: () => { mode = id; renderSeg(); renderAll(); } }, label)));
  }
  function renderAll() {
    groupBox.classList.toggle('hidden', mode !== 'group');
    createBtn.classList.toggle('hidden', mode !== 'group');
    chips.replaceChildren(...[...selected.values()].map((u) =>
      h('span', { class: 'chip', onclick: () => { selected.delete(u.id); renderAll(); } }, u.displayName, icon('x'))));
    results.replaceChildren(...(users.length ? users.map((u) => {
      const on = selected.has(u.id);
      return h('button', { class: 'dlg-user' + (on ? ' on' : ''), onclick: () => pick(u) },
        Avatar(u, { size: 40, online: u.online }),
        h('div', { class: 'u-text' }, h('b', {}, u.displayName), h('span', {}, '@' + u.username)),
        mode === 'group' ? h('span', { class: 'check-box' }, on ? icon('check') : null) : null);
    }) : [h('div', { class: 'list-empty' }, 'No people found. Ask a friend to create an account!')]));
  }
  async function pick(u) {
    if (mode === 'group') { selected.has(u.id) ? selected.delete(u.id) : selected.set(u.id, u); return renderAll(); }
    try { const chat = await openDirect(u.id); close(); onCreated(chat); } catch (e) { toast(e.message, 'error'); }
  }
  async function makeGroup() {
    try { const chat = await createGroup(groupName.value, [...selected.keys()]); close(); onCreated(chat); }
    catch (e) { toast(e.message, 'error'); }
  }
  const load = debounce(async () => { users = await searchUsers(search.value.trim()).catch(() => []); renderAll(); }, 220);
  search.addEventListener('input', load);

  const overlay = h('div', { class: 'overlay', onmousedown: (e) => e.target === overlay && close() },
    h('div', { class: 'dialog' },
      h('div', { class: 'dlg-head' }, h('h2', {}, 'Start a conversation'), h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Close' }, icon('x'))),
      seg, groupBox, search, results, h('div', { class: 'dlg-foot' }, createBtn)));
  addEventListener('keydown', onKey);
  document.body.append(overlay);
  renderSeg(); renderAll(); load(); search.focus();
}
