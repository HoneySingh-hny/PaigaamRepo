import crypto from 'node:crypto';
import db, { BOT_USERNAME } from '../db.js';
import { HttpError } from '../http/utils.js';
import { getOrCreateDirect } from './chat.js';
import { BOT_ID } from '../db.js';

const COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5'];
const SESSION_MS = 7 * 24 * 3600 * 1000;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createUser({ username, displayName, password }) {
  username = String(username || '').trim().toLowerCase();
  displayName = String(displayName || '').trim();
  password = String(password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, 'Username must be 3-20 letters, numbers or underscores.');
  if (username === BOT_USERNAME) throw new HttpError(400, 'That username is reserved.');
  if (!displayName || displayName.length > 40) throw new HttpError(400, 'Please enter your name (max 40 characters).');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) throw new HttpError(409, 'That username is already taken.');
  const color = COLORS[crypto.randomInt(COLORS.length)];
  const info = db.prepare('INSERT INTO users(username,display_name,password_hash,color,created_at) VALUES(?,?,?,?,?)')
    .run(username, displayName, hashPassword(password), color, Date.now());
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(Number(info.lastInsertRowid));
  getOrCreateDirect(user.id, BOT_ID); // every user starts with an AI assistant chat
  return user;
}

export function login(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username=? AND is_bot=0').get(String(username || '').trim().toLowerCase());
  if (!u || !verifyPassword(String(password || ''), u.password_hash)) throw new HttpError(401, 'Incorrect username or password.');
  return u;
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token, userId, Date.now() + SESSION_MS);
  return token;
}
export function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) { destroySession(token); return null; }
  return row;
}
export const destroySession = (token) => db.prepare('DELETE FROM sessions WHERE token=?').run(token);
export const SESSION_MAX_AGE = SESSION_MS / 1000;
