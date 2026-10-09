// Everything the UI does with chats: REST calls + WebSocket actions + local state updates.
import { api } from './api.js';
import * as sock from './socket.js';
import { state, emit, isMine } from '../state.js';
import { toast } from '../utils/toast.js';

export async function loadChats() {
  const { chats } = await api.get('/api/chats');
  state.chats = new Map(chats.map((c) => [c.id, c]));
  emit('chats');
}
export async function loadMessages(chatId) {
  const pending = state.messages.get(chatId) || [];
  state.messages.set(chatId, pending);
  const { messages } = await api.get(`/api/chats/${chatId}/messages`);
  const merged = new Map(messages.map((message) => [message.id, message]));
  for (const message of state.messages.get(chatId) || pending) merged.set(message.id, message);
  const loaded = [...merged.values()].sort((a, b) => a.id - b.id);
  state.messages.set(chatId, loaded);
  return loaded;
}
export async function openDirect(userId) {
  const { chat } = await api.post('/api/chats', { type: 'direct', userId });
  state.chats.set(chat.id, chat); emit('chats');
  return chat;
}
export async function createGroup(name, memberIds) {
  const { chat } = await api.post('/api/chats', { type: 'group', name, memberIds });
  state.chats.set(chat.id, chat); emit('chats');
  return chat;
}
export const searchUsers = (q) => api.get('/api/users?q=' + encodeURIComponent(q)).then((r) => r.users);
export const searchMessages = (q) => api.get('/api/search?q=' + encodeURIComponent(q)).then((r) => r.messages);

export function sendText(chatId, body) {
  if (!sock.send({ type: 'send', chatId, body })) { toast('Reconnecting\u2026 try again in a moment.', 'error'); return false; }
  return true;
}
export const sendTyping = (chatId, on) => sock.send({ type: 'typing', chatId, on });
export const deleteMessage = (messageId) => sock.send({ type: 'delete', messageId });

export function markRead(chat, messageId) {
  const me = chat.members.find((m) => m.id === state.me.id);
  if (!me || messageId <= me.lastRead) return;
  me.lastRead = messageId; chat.unread = 0;
  sock.send({ type: 'read', chatId: chat.id, messageId });
  emit('chats');
}

export async function uploadFile(chatId, blob, { kind, filename, duration = 0 }) {
  const note = toast(kind === 'voice' ? 'Sending voice note\u2026' : 'Uploading\u2026', '', 60000);
  try {
    await api.post(`/api/chats/${chatId}/upload`, blob, {
      'x-kind': kind, 'x-filename': encodeURIComponent(filename), 'x-duration': String(Math.round(duration)),
      'content-type': blob.type || 'application/octet-stream',
    });
  } catch (e) { toast(e.message, 'error'); }
  finally { note.remove(); }
}
export { isMine };
