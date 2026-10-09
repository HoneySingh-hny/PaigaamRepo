import { h, debounce } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { state, on, sortedChats, peer, chatTitle, userOnline, typingUsers, previewText, isMine, isRead } from '../state.js';
import { searchMessages } from '../services/chats.js';
import { listTime } from '../utils/format.js';

export function Sidebar({ onOpen, onNew, onLogout }) {
  let tab = 'all', query = '', hits = [];

  const searchInput = h('input', { class: 'search-input', type: 'search', placeholder: 'Search chats', autocomplete: 'off' });
  const stories = h('div', { class: 'stories' });
  const tabsEl = h('div', { class: 'tabs' });
  const list = h('div', { class: 'chat-list' });
  const status = h('div', { class: 'conn hidden' }, 'Reconnecting\u2026');
  const me = state.me;

  const el = h('aside', { class: 'sidebar' },
    h('div', { class: 'side-head' }, h('h1', {}, 'Messages'),
      h('button', { class: 'icon-btn compose', 'aria-label': 'New message', title: 'New message', onclick: onNew }, icon('compose'))),
    status,
    h('label', { class: 'search' }, icon('search'), searchInput),
    stories, tabsEl, list,
    h('footer', { class: 'me' }, Avatar(me, { size: 38 }),
      h('div', { class: 'me-text' }, h('b', {}, me.displayName), h('span', {}, '@' + me.username)),
      h('button', { class: 'icon-btn', title: 'Sign out', 'aria-label': 'Sign out', onclick: onLogout }, icon('logout'))));

  const runSearch = debounce(async () => {
    hits = query.length >= 2 ? await searchMessages(query).catch(() => []) : [];
    renderList();
  }, 300);
  searchInput.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); renderList(); runSearch(); });

  function renderTabs() {
    const unread = [...state.chats.values()].reduce((n, c) => n + (c.unread ? 1 : 0), 0);
    tabsEl.replaceChildren(...[['all', 'All'], ['unread', unread ? `Unread \u00b7 ${unread}` : 'Unread'], ['groups', 'Groups']].map(([id, label]) =>
      h('button', { class: 'tab' + (tab === id ? ' active' : ''), onclick: () => { tab = id; renderTabs(); renderList(); } }, label)));
  }

  function renderStories() {
    const chats = sortedChats().filter((c) => c.type === 'direct').slice(0, 10);
    stories.classList.toggle('hidden', !chats.length);
    stories.replaceChildren(...chats.map((c) => {
      const p = peer(c);
      return h('button', { class: 'story', onclick: () => onOpen(c.id) },
        Avatar(p, { size: 54, ring: userOnline(p) || c.unread > 0, online: userOnline(p) && !p.isBot }),
        h('span', {}, p.displayName.split(' ')[0]));
    }));
  }

  function row(c) {
    const p = peer(c), typers = typingUsers(c.id), m = c.lastMessage;
    let preview;
    if (typers.length) preview = h('span', { class: 'typing-txt' }, 'typing\u2026');
    else {
      const prefix = m && !m.deleted && (isMine(m) && c.type === 'group' ? 'You: ' : '');
      preview = h('span', {}, (prefix || '') + previewText(m));
    }
    let right;
    if (c.unread > 0) right = h('span', { class: 'badge' }, c.unread > 99 ? '99+' : c.unread);
    else if (m && isMine(m) && !m.deleted) right = h('span', { class: 'tick' + (isRead(c, m) ? ' read' : '') }, icon(isRead(c, m) ? 'checks' : 'check'));
    return h('button', { class: 'chat-row' + (state.activeId === c.id ? ' active' : '') + (c.unread ? ' unread' : ''), onclick: () => onOpen(c.id) },
      Avatar(p, { size: 48, online: c.type === 'direct' && userOnline(p) && !p.isBot, group: c.type === 'group' }),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-top' }, h('b', { class: 'row-name' }, chatTitle(c)), h('time', { class: c.unread ? 'new' : '' }, m ? listTime(m.createdAt) : '')),
        h('div', { class: 'row-bottom' }, h('div', { class: 'row-preview' }, preview), right)));
  }

  function renderList() {
    let chats = sortedChats();
    if (tab === 'unread') chats = chats.filter((c) => c.unread > 0);
    if (tab === 'groups') chats = chats.filter((c) => c.type === 'group');
    if (query) chats = chats.filter((c) => chatTitle(c).toLowerCase().includes(query));
    const nodes = chats.map(row);
    if (query && hits.length) {
      nodes.push(h('div', { class: 'list-label' }, 'Messages'));
      for (const m of hits) {
        const c = state.chats.get(m.chatId); if (!c) continue;
        nodes.push(h('button', { class: 'chat-row hit', onclick: () => onOpen(c.id) },
          Avatar(peer(c), { size: 40, group: c.type === 'group' }),
          h('div', { class: 'row-main' }, h('b', { class: 'row-name' }, chatTitle(c)), h('div', { class: 'row-preview' }, m.body))));
      }
    }
    if (!nodes.length) nodes.push(h('div', { class: 'list-empty' }, query ? 'No matches found.' : tab === 'unread' ? "You're all caught up." : tab === 'groups' ? 'No groups yet. Tap the pencil to create one.' : 'No conversations yet.'));
    list.replaceChildren(...nodes);
  }

  const renderAll = () => { renderStories(); renderTabs(); renderList(); };
  const subs = [on('chats', renderAll), on('presence', renderAll), on('typing', renderList), on('active', renderList),
    on('conn', () => status.classList.toggle('hidden', state.connected))];
  renderAll();
  return { el, destroy: () => subs.forEach((f) => f()) };
}
