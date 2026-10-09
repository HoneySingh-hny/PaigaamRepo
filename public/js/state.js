// Shared client state + a small pub/sub so components can react to changes.
export const state = {
  me: null,
  chats: new Map(),      // chatId -> chat
  messages: new Map(),   // chatId -> message[] (only for chats that were opened)
  online: new Set(),     // ids of users with a live connection
  typing: new Map(),     // chatId -> Map(userId -> timeoutId)
  activeId: null,
  connected: false,
};
const listeners = new Map();
export const on = (evt, fn) => {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
};
export const emit = (evt, data) => listeners.get(evt)?.forEach((fn) => fn(data));

export const sortedChats = () => [...state.chats.values()].sort((a, b) => b.updatedAt - a.updatedAt);
export const peer = (chat) => (chat.type === 'direct' ? chat.members.find((m) => m.id !== state.me.id) : null);
export const chatTitle = (chat) => (chat.type === 'group' ? chat.name : peer(chat)?.displayName || 'Chat');
export const isMine = (m) => m.senderId === state.me.id;
export const userOnline = (u) => !!u && (u.isBot || state.online.has(u.id));
export const memberOf = (chat, id) => chat.members.find((m) => m.id === id);
export const isRead = (chat, msg) => {
  const others = chat.members.filter((m) => m.id !== state.me.id);
  return others.length > 0 && others.every((o) => o.lastRead >= msg.id);
};
export function typingUsers(chatId) {
  const chat = state.chats.get(chatId);
  const map = state.typing.get(chatId);
  if (!chat || !map) return [];
  return [...map.keys()].map((id) => memberOf(chat, id)).filter(Boolean);
}
export function previewText(m) {
  if (!m) return 'No messages yet';
  if (m.deleted) return 'Message deleted';
  if (m.type === 'image') return 'Photo';
  if (m.type === 'audio') return `Voice message \u00b7 ${Math.floor(Number(m.body) / 60)}:${String(Number(m.body) % 60).padStart(2, '0')}`;
  if (m.type === 'file') return m.fileName || 'File';
  return m.body;
}
