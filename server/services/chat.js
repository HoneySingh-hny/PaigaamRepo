import db, { transaction, BOT_ID } from '../db.js';
import { encrypt, decrypt } from './crypto.js';
import { getUser, publicUser } from './users.js';

export const isMember = (chatId, userId) => !!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, userId);
export const memberIds = (chatId) => db.prepare('SELECT user_id FROM chat_members WHERE chat_id=?').all(chatId).map((r) => r.user_id);
export const hasBot = (chatId) => memberIds(chatId).includes(BOT_ID);

export function serializeMessage(r) {
  return {
    id: r.id, chatId: r.chat_id, senderId: r.sender_id, type: r.type,
    body: r.deleted ? '' : decrypt(r.body), fileName: r.deleted ? null : r.file_name,
    fileUrl: r.deleted ? null : r.file_url, mime: r.mime, createdAt: r.created_at, deleted: !!r.deleted,
  };
}
export const getMessage = (id) => { const r = db.prepare('SELECT * FROM messages WHERE id=?').get(id); return r && serializeMessage(r); };

export function addMessage(m) {
  const info = db.prepare('INSERT INTO messages(chat_id,sender_id,type,body,file_name,file_url,mime,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(m.chatId, m.senderId, m.type || 'text', encrypt(m.body || ''), m.fileName || null, m.fileUrl || null, m.mime || null, Date.now());
  const id = Number(info.lastInsertRowid);
  markRead(m.chatId, m.senderId, id);
  return getMessage(id);
}

export function markRead(chatId, userId, messageId) {
  db.prepare('UPDATE chat_members SET last_read=MAX(last_read,?) WHERE chat_id=? AND user_id=?').run(messageId, chatId, userId);
}

export function deleteMessage(messageId, userId) {
  const r = db.prepare('SELECT * FROM messages WHERE id=?').get(messageId);
  if (!r || r.sender_id !== userId || r.deleted) return null;
  db.prepare("UPDATE messages SET deleted=1, body='', file_name=NULL, file_url=NULL WHERE id=?").run(messageId);
  return { chatId: r.chat_id, messageId, fileUrl: r.file_url };
}

export function getOrCreateDirect(a, b) {
  const key = [a, b].sort((x, y) => x - y).join(':');
  const found = db.prepare('SELECT id FROM chats WHERE direct_key=?').get(key);
  if (found) return found.id;
  return transaction(() => {
    const now = Date.now();
    const id = Number(db.prepare("INSERT INTO chats(type,direct_key,created_by,created_at) VALUES('direct',?,?,?)").run(key, a, now).lastInsertRowid);
    for (const u of [a, b]) db.prepare('INSERT INTO chat_members(chat_id,user_id,joined_at) VALUES(?,?,?)').run(id, u, now);
    return id;
  });
}

export function createGroup(creatorId, name, userIds) {
  const members = [...new Set([creatorId, ...userIds])].filter((id) => getUser(id) && id !== BOT_ID);
  return transaction(() => {
    const now = Date.now();
    const id = Number(db.prepare("INSERT INTO chats(type,name,created_by,created_at) VALUES('group',?,?,?)").run(name, creatorId, now).lastInsertRowid);
    for (const u of members) db.prepare('INSERT INTO chat_members(chat_id,user_id,joined_at) VALUES(?,?,?)').run(id, u, now);
    return id;
  });
}

export function chatPayload(chatId, userId) {
  const c = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!c) return null;
  const members = db.prepare('SELECT user_id,last_read FROM chat_members WHERE chat_id=?').all(chatId)
    .map((m) => ({ ...publicUser(getUser(m.user_id)), lastRead: m.last_read }));
  const mine = members.find((m) => m.id === userId);
  const last = db.prepare('SELECT * FROM messages WHERE chat_id=? ORDER BY id DESC LIMIT 1').get(chatId);
  const unread = db.prepare('SELECT COUNT(*) n FROM messages WHERE chat_id=? AND id>? AND sender_id!=? AND deleted=0')
    .get(chatId, mine?.lastRead || 0, userId).n;
  return {
    id: c.id, type: c.type, name: c.name, createdBy: c.created_by, members, unread,
    lastMessage: last ? serializeMessage(last) : null, updatedAt: last ? last.created_at : c.created_at,
  };
}

export function listChats(userId) {
  return db.prepare('SELECT chat_id FROM chat_members WHERE user_id=?').all(userId)
    .map((r) => chatPayload(r.chat_id, userId)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listMessages(chatId, before, limit = 50) {
  const rows = before
    ? db.prepare('SELECT * FROM messages WHERE chat_id=? AND id<? ORDER BY id DESC LIMIT ?').all(chatId, before, limit)
    : db.prepare('SELECT * FROM messages WHERE chat_id=? ORDER BY id DESC LIMIT ?').all(chatId, limit);
  return rows.reverse().map(serializeMessage);
}

// Message search: bodies are encrypted, so we decrypt the user's recent text messages and filter in memory.
export function searchMessages(userId, q) {
  const needle = q.toLowerCase();
  const rows = db.prepare(`SELECT m.* FROM messages m JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=?
    WHERE m.type='text' AND m.deleted=0 ORDER BY m.id DESC LIMIT 3000`).all(userId);
  const out = [];
  for (const r of rows) {
    const msg = serializeMessage(r);
    if (msg.body.toLowerCase().includes(needle)) { out.push(msg); if (out.length >= 30) break; }
  }
  return out;
}
