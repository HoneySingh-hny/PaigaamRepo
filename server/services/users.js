import db from '../db.js';
import { isOnline } from '../realtime/presence.js';

export const getUser = (id) => db.prepare('SELECT * FROM users WHERE id=?').get(id);
export const publicUser = (u) => ({
  id: u.id, username: u.username, displayName: u.display_name, color: u.color,
  isBot: !!u.is_bot, online: u.is_bot ? true : isOnline(u.id), lastSeen: u.last_seen,
});
export function searchUsers(q, excludeId) {
  const like = '%' + String(q).replace(/[%_]/g, '') + '%';
  return db.prepare('SELECT * FROM users WHERE is_bot=0 AND id!=? AND (username LIKE ? OR display_name LIKE ?) ORDER BY display_name LIMIT 20')
    .all(excludeId, like, like).map(publicUser);
}
export const usernameTaken = (name) => !!db.prepare('SELECT 1 FROM users WHERE username=?').get(String(name).toLowerCase());
