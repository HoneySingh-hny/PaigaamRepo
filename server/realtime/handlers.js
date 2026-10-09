// Handlers for events sent by the browser over the WebSocket.
import { BOT_ID } from '../db.js';
import { isMember, memberIds, addMessage, markRead, deleteMessage, hasBot } from '../services/chat.js';
import { aiReply } from '../services/ai.js';
import { sendToUsers } from './presence.js';
import { removeStored } from '../services/files.js';

export function handleEvent(user, ev) {
  const chatId = Number(ev.chatId);
  switch (ev.type) {
    case 'send': {
      const body = String(ev.body || '').trim().slice(0, 4000);
      if (!body || !isMember(chatId, user.id)) return;
      const message = addMessage({ chatId, senderId: user.id, body });
      const bot = hasBot(chatId);
      if (bot) markRead(chatId, BOT_ID, message.id);
      for (const id of memberIds(chatId)) {
        if (id !== BOT_ID) sendToUsers([id], { type: 'message', message, tempId: id === user.id ? ev.tempId : undefined });
      }
      if (bot || /^@ai\b/i.test(body)) aiReply(chatId).catch((e) => console.error('[ai]', e.message));
      return;
    }
    case 'typing': {
      if (!isMember(chatId, user.id)) return;
      sendToUsers(memberIds(chatId).filter((id) => id !== user.id), { type: 'typing', chatId, userId: user.id, on: !!ev.on });
      return;
    }
    case 'read': {
      const messageId = Number(ev.messageId);
      if (!isMember(chatId, user.id) || !messageId) return;
      markRead(chatId, user.id, messageId);
      sendToUsers(memberIds(chatId), { type: 'read', chatId, userId: user.id, messageId });
      return;
    }
    case 'delete': {
      const r = deleteMessage(Number(ev.messageId), user.id);
      if (!r) return;
      removeStored(r.fileUrl);
      sendToUsers(memberIds(r.chatId), { type: 'deleted', chatId: r.chatId, messageId: r.messageId });
    }
  }
}
