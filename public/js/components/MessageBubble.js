import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { clock } from '../utils/format.js';
import { state, isMine, isRead, memberOf } from '../state.js';
import { VoiceMessage } from './VoiceMessage.js';
import { openLightbox } from './Lightbox.js';
import { deleteMessage } from '../services/chats.js';

// Returns { el, updateReceipt() }.
export function MessageBubble(m, chat) {
  const mine = isMine(m);
  const tick = h('span', { class: 'tick' });
  const updateReceipt = () => {
    if (!mine || m.deleted) return;
    const read = isRead(state.chats.get(m.chatId) || chat, m);
    tick.className = 'tick' + (read ? ' read' : '');
    tick.replaceChildren(icon(read ? 'checks' : 'check'));
    tick.title = read ? 'Read' : 'Sent';
  };

  let content;
  if (m.deleted) content = h('div', { class: 'bubble deleted' }, 'This message was deleted');
  else if (m.type === 'image') {
    const img = h('img', { class: 'photo', src: m.fileUrl, alt: m.fileName || 'Photo', loading: 'lazy', onclick: () => openLightbox(m.fileUrl) });
    content = h('div', { class: 'bubble media' }, img);
  } else if (m.type === 'audio') content = h('div', { class: 'bubble voice-bubble' }, VoiceMessage(m));
  else if (m.type === 'file') {
    content = h('a', { class: 'bubble file', href: m.fileUrl, download: m.fileName || 'file' },
      h('span', { class: 'file-ico' }, icon('file')), h('span', { class: 'file-name' }, m.fileName || 'File'), icon('download'));
  } else content = h('div', { class: 'bubble' }, m.body);

  const senderInfo = memberOf(chat, m.senderId);
  const sender = !mine && (chat.type === 'group' || senderInfo?.isBot)
    ? h('div', { class: 'sender', style: { color: senderInfo?.color } }, senderInfo?.displayName || '')
    : null;
  const del = mine && !m.deleted
    ? h('button', { class: 'del-btn', title: 'Delete message', onclick: () => confirm('Delete this message for everyone?') && deleteMessage(m.id) }, icon('trash'))
    : null;
  const meta = h('div', { class: 'meta' }, clock(m.createdAt), mine && !m.deleted ? tick : null);
  const el = h('div', { class: 'row ' + (mine ? 'mine' : 'theirs'), 'data-id': m.id }, h('div', { class: 'stack' }, sender, h('div', { class: 'bubble-line' }, del, content), meta));
  updateReceipt();
  return { el, updateReceipt };
}
