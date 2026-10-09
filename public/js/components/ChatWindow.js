import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { Composer } from './Composer.js';
import { MessageBubble } from './MessageBubble.js';
import { state, on, chatTitle, peer, userOnline, typingUsers } from '../state.js';
import { loadMessages, markRead } from '../services/chats.js';
import { dayKey, dayLabel, lastSeenText } from '../utils/format.js';
import { toast } from '../utils/toast.js';

export function ChatWindow({ onBack }) {
  let chat = null, bubbles = new Map(), lastDay = '', pinned = true, token = 0;

  const empty = h('div', { class: 'empty-state' },
    h('div', { class: 'empty-ico' }, icon('chat')),
    h('h2', {}, 'Your messages'),
    h('p', {}, 'Pick a conversation on the left, or start a new one with the pencil button.'));

  const headAvatar = h('div', { class: 'head-avatar' });
  const headName = h('div', { class: 'head-name' });
  const headSub = h('div', { class: 'head-sub' });
  const header = h('header', { class: 'chat-head' },
    h('button', { class: 'icon-btn back', 'aria-label': 'Back', onclick: onBack }, icon('back')),
    headAvatar, h('div', { class: 'head-text' }, headName, headSub));

  const list = h('div', { class: 'messages' });
  const typingRow = h('div', { class: 'row theirs typing-row hidden' }, h('div', { class: 'bubble typing' }, h('i'), h('i'), h('i')));
  const scroller = h('div', { class: 'scroller' }, list, typingRow);
  const composer = Composer({ getChat: () => chat });
  const convo = h('div', { class: 'convo hidden' }, header, scroller, composer.el);
  const el = h('main', { class: 'chat' }, empty, convo);

  const scrollBottom = () => { scroller.scrollTop = scroller.scrollHeight; };
  scroller.addEventListener('scroll', () => { pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140; });
  scroller.addEventListener('load', () => pinned && scrollBottom(), true); // images finishing loading

  function renderHeader() {
    if (!chat) return;
    chat = state.chats.get(chat.id) || chat;
    const p = peer(chat);
    headAvatar.replaceChildren(Avatar(p, { size: 42, online: chat.type === 'direct' && userOnline(p), group: chat.type === 'group' }));
    headName.textContent = chatTitle(chat);
    const typers = typingUsers(chat.id);
    headSub.className = 'head-sub';
    if (typers.length) { headSub.textContent = chat.type === 'group' ? `${typers.map((t) => t.displayName).join(', ')} typing\u2026` : 'typing\u2026'; headSub.classList.add('typing-txt'); }
    else if (chat.type === 'group') headSub.textContent = chat.members.map((m) => m.displayName).join(', ');
    else if (userOnline(p)) { headSub.textContent = p.isBot ? 'AI assistant \u00b7 ask me anything' : 'Online'; headSub.classList.add('online-txt'); }
    else headSub.textContent = lastSeenText(p?.lastSeen);
  }
  function renderTyping() {
    if (!chat) return;
    const typing = typingUsers(chat.id).length > 0;
    typingRow.classList.toggle('hidden', !typing);
    if (typing && pinned) scrollBottom();
    renderHeader();
  }

  function append(m) {
    if (bubbles.has(m.id)) return;
    const key = dayKey(m.createdAt);
    if (key !== lastDay) { list.append(h('div', { class: 'day-sep' }, h('span', {}, dayLabel(m.createdAt)))); lastDay = key; }
    const b = MessageBubble(m, chat);
    bubbles.set(m.id, b); list.append(b.el);
  }
  function renderAll(messages) {
    list.replaceChildren(); bubbles = new Map(); lastDay = '';
    messages.forEach(append);
    pinned = true; scrollBottom();
  }
  const markLatestRead = () => {
    const msgs = state.messages.get(chat?.id);
    if (chat && msgs?.length && document.visibilityState === 'visible') markRead(chat, msgs.at(-1).id);
  };

  async function show(c) {
    const myToken = ++token;
    if (!c) { chat = null; empty.classList.remove('hidden'); convo.classList.add('hidden'); return; }
    const changed = chat?.id !== c.id;
    chat = c;
    empty.classList.add('hidden'); convo.classList.remove('hidden');
    renderHeader(); renderTyping();
    if (!changed) return;
    composer.reset(); list.replaceChildren(); bubbles = new Map(); lastDay = '';
    try {
      const msgs = state.messages.get(c.id) || await loadMessages(c.id);
      if (myToken !== token) return; // user switched chats while loading
      renderAll(msgs); markLatestRead();
    } catch (e) { toast(e.message, 'error'); }
    if (window.matchMedia('(hover: hover)').matches) composer.focus();
  }

  const subs = [
    on('message', (m) => {
      if (!chat || m.chatId !== chat.id) return;
      const mine = m.senderId === state.me.id;
      append(m); if (pinned || mine) scrollBottom();
    }),
    on('read', (d) => { if (chat && d.chatId === chat.id) bubbles.forEach((b) => b.updateReceipt()); }),
    on('typing', (id) => { if (chat && id === chat.id) renderTyping(); }),
    on('presence', renderHeader),
    on('deleted', (d) => {
      if (!chat || d.chatId !== chat.id) return;
      const old = bubbles.get(d.messageId); const m = state.messages.get(chat.id)?.find((x) => x.id === d.messageId);
      if (old && m) { const nb = MessageBubble(m, chat); old.el.replaceWith(nb.el); bubbles.set(m.id, nb); }
    }),
    on('reload', (id) => { if (chat && id === chat.id) { renderAll(state.messages.get(id) || []); markLatestRead(); } }),
  ];
  document.addEventListener('visibilitychange', markLatestRead);

  return { el, show, destroy: () => { subs.forEach((f) => f()); composer.destroy(); document.removeEventListener('visibilitychange', markLatestRead); } };
}
