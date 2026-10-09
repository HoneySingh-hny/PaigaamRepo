// SQLite persistence (built into Node 22 as node:sqlite - nothing to install).
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const db = new DatabaseSync(path.join(DATA_DIR, 'paigaam.db'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, color TEXT NOT NULL, is_bot INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, last_seen INTEGER);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chats(
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT, direct_key TEXT UNIQUE,
  created_by INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chat_members(
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read INTEGER NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL, PRIMARY KEY(chat_id, user_id));
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id), type TEXT NOT NULL DEFAULT 'text', body TEXT NOT NULL DEFAULT '',
  file_name TEXT, file_url TEXT, mime TEXT, deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);
`);

// Built-in assistant account (cannot log in: its password hash is invalid on purpose).
export const BOT_USERNAME = 'paigaam-ai';
export const BOT_ID = (() => {
  const row = db.prepare('SELECT id FROM users WHERE username=?').get(BOT_USERNAME);
  if (row) return row.id;
  const info = db.prepare("INSERT INTO users(username,display_name,password_hash,color,is_bot,created_at) VALUES(?,?,?,?,1,?)")
    .run(BOT_USERNAME, 'Paigaam AI', '!', '#2563eb', Date.now());
  return Number(info.lastInsertRowid);
})();

export function transaction(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
export default db;
