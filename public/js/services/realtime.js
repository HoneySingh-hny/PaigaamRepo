// Translates WebSocket events from the server into state changes + UI events.
import * as sock from './socket.js';
import { state, emit, isMine, memberOf } from '../state.js';
import { loadChats, loadMessages, markRead } from './chats.js';
import { toast } from '../utils/toast.js';
import { chatTitle } from '../state.js';

export function startRealtime() {
  let opened = false;
  const offs = [
    sock.on('open', async () => {
      state.connected = true; emit('conn');
      if (opened) { // reconnect: catch up on anything missed
        await loadChats().catch(() => {});
        if (state.activeId) { await loadMessages(state.activeId).catch(() => {}); emit('reload', state.activeId); }
      }
      opened = true;
    }),
    sock.on('close', () => { state.connected = false; emit('conn'); }),
    sock.on('ready', (d) => { state.online = new Set(d.online); emit('presence'); }),
    sock.on('presence', (d) => {
      d.online ? state.online.add(d.userId) : state.online.delete(d.userId);
      for (const c of state.chats.values()) { const m = memberOf(c, d.userId); if (m && d.lastSeen) m.lastSeen = d.lastSeen; }
      emit('presence');
    }),
    sock.on('chat', (d) => { state.chats.set(d.chat.id, d.chat); emit('chats'); }),
    sock.on('message', ({ message: m }) => {
      const chat = state.chats.get(m.chatId);
      if (!chat) { loadChats(); return; }
      chat.lastMessage = m; chat.updatedAt = m.createdAt;
      const list = state.messages.get(m.chatId);
      if (list && !list.some((x) => x.id === m.id)) list.push(m);
      state.typing.get(m.chatId)?.delete(m.senderId);
      const viewing = state.activeId === m.chatId && document.visibilityState === 'visible';
      if (isMine(m)) { const me = memberOf(chat, state.me.id); if (me) me.lastRead = Math.max(me.lastRead, m.id); }
      else if (viewing) markRead(chat, m.id);
      else {
        chat.unread++;
        const who = memberOf(chat, m.senderId)?.displayName || 'Someone';
        const where = chat.type === 'group' ? ` in ${chatTitle(chat)}` : '';
        toast(`${who}${where}: ${m.type === 'text' ? m.body.slice(0, 60) : 'sent an attachment'}`);
      }
      emit('message', m); emit('chats');
    }),
    sock.on('typing', ({ chatId, userId, on }) => {
      if (!state.typing.has(chatId)) state.typing.set(chatId, new Map());
      const map = state.typing.get(chatId);
      clearTimeout(map.get(userId));
      if (on) map.set(userId, setTimeout(() => { map.delete(userId); emit('typing', chatId); }, 4000));
      else map.delete(userId);
      emit('typing', chatId);
    }),
    sock.on('read', (d) => {
      const chat = state.chats.get(d.chatId);
      const m = chat && memberOf(chat, d.userId);
      if (m) m.lastRead = Math.max(m.lastRead, d.messageId);
      if (chat && d.userId === state.me.id) chat.unread = 0;
      emit('read', d); emit('chats');
    }),
    sock.on('deleted', (d) => {
      const m = state.messages.get(d.chatId)?.find((x) => x.id === d.messageId);
      if (m) { m.deleted = true; m.body = ''; m.fileUrl = null; }
      const chat = state.chats.get(d.chatId);
      if (chat?.lastMessage?.id === d.messageId) { chat.lastMessage.deleted = true; emit('chats'); }
      emit('deleted', d);
    }),
  ];
  sock.connect();
  return () => { offs.forEach((f) => f()); sock.disconnect(); state.connected = false; };
}
