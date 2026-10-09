// Upload validation: size, extension blocklist, and magic-byte sniffing (basic file safety).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '../config.js';

const BLOCKED_EXT = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'mjs', 'vbs', 'ps1', 'sh', 'jar', 'apk',
  'app', 'php', 'py', 'pl', 'rb', 'html', 'htm', 'svg', 'xml', 'hta', 'lnk', 'reg', 'iso', 'dmg', 'bin', 'cpl']);
const IMG = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const starts = (b, bytes, off = 0) => bytes.every((v, i) => b[off + i] === v);
const ascii = (b, s, off = 0) => b.subarray(off, off + s.length).toString('latin1') === s;

function sniffImage(b) {
  if (starts(b, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (starts(b, [0xff, 0xd8, 0xff])) return 'jpg';
  if (ascii(b, 'GIF8')) return 'gif';
  if (ascii(b, 'RIFF') && ascii(b, 'WEBP', 8)) return 'webp';
  return null;
}
function sniffAudio(b) {
  if (starts(b, [0x1a, 0x45, 0xdf, 0xa3])) return { ext: 'webm', mime: 'audio/webm' };
  if (ascii(b, 'OggS')) return { ext: 'ogg', mime: 'audio/ogg' };
  if (ascii(b, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg' };
  if (ascii(b, 'RIFF') && ascii(b, 'WAVE', 8)) return { ext: 'wav', mime: 'audio/wav' };
  if (ascii(b, 'ftyp', 4)) return { ext: 'm4a', mime: 'audio/mp4' };
  return null;
}
function looksExecutable(b) {
  return ascii(b, 'MZ') || starts(b, [0x7f, 0x45, 0x4c, 0x46]) || ascii(b, '#!') || ascii(b, '<?php') ||
    starts(b, [0xcf, 0xfa, 0xed, 0xfe]) || starts(b, [0xca, 0xfe, 0xba, 0xbe]);
}

export function validateUpload({ kind, filename, buffer }) {
  if (!buffer.length) return { error: 'The file is empty.' };
  const safeName = path.basename(filename || 'file').replace(/[^\w.\- ()]/g, '_').slice(0, 100) || 'file';
  const declared = (safeName.split('.').pop() || '').toLowerCase();
  if (kind === 'image') {
    const real = sniffImage(buffer);
    if (!real) return { error: 'That does not look like a real PNG, JPG, GIF or WebP image.' };
    return { type: 'image', ext: real, mime: IMG[real], safeName };
  }
  if (kind === 'voice') {
    const a = sniffAudio(buffer);
    if (!a) return { error: 'Unsupported or invalid audio recording.' };
    return { type: 'audio', ext: a.ext, mime: a.mime, safeName: 'voice-note.' + a.ext };
  }
  if (BLOCKED_EXT.has(declared)) return { error: `".${declared}" files are blocked for safety.` };
  if (looksExecutable(buffer)) return { error: 'Executable or script content is not allowed.' };
  if (IMG[declared] && sniffImage(buffer) !== (declared === 'jpeg' ? 'jpg' : declared)) return { error: 'File extension does not match its contents.' };
  const ext = /^[a-z0-9]{1,8}$/.test(declared) ? declared : 'bin';
  return { type: 'file', ext, mime: 'application/octet-stream', safeName };
}

export function storeFile(buffer, ext) {
  const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer, { mode: 0o640 });
  return name;
}
export function removeStored(fileUrl) {
  const name = path.basename(String(fileUrl || ''));
  if (name) fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}
export const AUDIO_MIME = { webm: 'audio/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4' };
export const IMAGE_MIME = IMG;
