// Central configuration. Reads .env without any third-party dependency.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const PORT = Number(process.env.PORT || 3000);
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const MAX_UPLOAD = 10 * 1024 * 1024; // 10 MB
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Key used to encrypt message bodies at rest (AES-256-GCM).
let keyHex = process.env.MESSAGE_KEY;
if (!keyHex) {
  const keyFile = path.join(DATA_DIR, 'message.key');
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  keyHex = fs.readFileSync(keyFile, 'utf8').trim();
}
export const MESSAGE_KEY = Buffer.from(keyHex, 'hex');
