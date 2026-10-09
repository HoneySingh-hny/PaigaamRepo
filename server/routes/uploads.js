import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';
import { UPLOAD_DIR, MAX_UPLOAD } from '../config.js';
import { HttpError, readBody } from '../http/utils.js';
import { isMember, addMessage, memberIds } from '../services/chat.js';
import { validateUpload, storeFile, AUDIO_MIME, IMAGE_MIME } from '../services/files.js';
import { sendToUsers } from '../realtime/presence.js';

export default function uploadRoutes(r) {
  // Raw-body upload. Headers: x-filename, x-kind (image | voice | file), x-duration (voice, seconds)
  r.post('/api/chats/:id/upload', async (ctx) => {
    const chatId = Number(ctx.params.id);
    if (!isMember(chatId, ctx.user.id)) throw new HttpError(403, 'Not a member of this chat.');
    const h = ctx.req.headers;
    const declared = Number(h['content-length'] || 0);
    if (declared > MAX_UPLOAD) throw new HttpError(413, 'Files can be at most 10 MB.');
    const buffer = await readBody(ctx.req, MAX_UPLOAD);
    const kind = ['image', 'voice'].includes(h['x-kind']) ? h['x-kind'] : 'file';
    const filename = decodeURIComponent(String(h['x-filename'] || 'file'));
    const v = validateUpload({ kind, filename, buffer });
    if (v.error) throw new HttpError(400, v.error);
    const stored = storeFile(buffer, v.ext);
    const duration = Math.max(0, Math.min(3600, Math.round(Number(h['x-duration']) || 0)));
    const msg = addMessage({
      chatId, senderId: ctx.user.id, type: v.type, body: v.type === 'audio' ? String(duration) : '',
      fileName: v.safeName, fileUrl: '/uploads/' + stored, mime: v.mime,
    });
    sendToUsers(memberIds(chatId), { type: 'message', message: msg });
    ctx.status = 201;
    return { message: msg };
  });

  // Authenticated file download. Only members of the chat that owns the file may fetch it.
  r.get('/uploads/:name', (ctx) => {
    const name = path.basename(ctx.params.name);
    const row = db.prepare('SELECT chat_id, file_name FROM messages WHERE file_url=? AND deleted=0').get('/uploads/' + name);
    if (!row || !isMember(row.chat_id, ctx.user.id)) throw new HttpError(404, 'File not found.');
    const file = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(file)) throw new HttpError(404, 'File not found.');
    const ext = path.extname(name).slice(1);
    const inline = IMAGE_MIME[ext] || AUDIO_MIME[ext];
    const headers = {
      'content-type': inline || 'application/octet-stream', 'x-content-type-options': 'nosniff',
      'content-length': fs.statSync(file).size, 'cache-control': 'private, max-age=3600',
      'content-security-policy': "default-src 'none'; sandbox",
    };
    if (!inline) headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name || name)}`;
    ctx.res.writeHead(200, headers);
    fs.createReadStream(file).pipe(ctx.res);
  });
}
