// End-to-end check of the core requirements: auth, 1-to-1 realtime chat, persistence, uploads, file safety.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 3900 + Math.floor(Math.random() * 90);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-'));
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, DATA_DIR, GEMINI_API_KEY: '' }, stdio: 'inherit' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, { body, cookie, headers = {} } = {}) {
  const res = await fetch(base + url, { method, headers: { ...(body && !(body instanceof Buffer) ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
function openWs(cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`, { headers: { cookie } });
    ws.events = []; ws.onmessage = (m) => ws.events.push(JSON.parse(m.data));
    ws.onopen = () => resolve(ws); ws.onerror = () => reject(new Error('ws failed'));
  });
}
const until = async (fn) => { for (let i = 0; i < 50; i++) { const v = fn(); if (v) return v; await wait(100); } throw new Error('timeout'); };

try {
  await wait(800);
  const a = await call('POST', '/api/auth/register', { body: { username: 'alice', displayName: 'Alice', password: 'secret1' } });
  const b = await call('POST', '/api/auth/register', { body: { username: 'bob', displayName: 'Bob', password: 'secret2' } });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'alice', password: 'nope' } })).status, 401);
  assert.equal((await call('GET', '/api/chats')).status, 401);
  console.log('ok  register / login / auth guard');

  const bobId = b.json.user.id;
  const chat = (await call('POST', '/api/chats', { cookie: a.cookie, body: { type: 'direct', userId: bobId } })).json.chat;
  const wsA = await openWs(a.cookie), wsB = await openWs(b.cookie);
  await until(() => wsA.events.some((e) => e.type === 'presence' && e.userId === bobId && e.online));
  wsA.send(JSON.stringify({ type: 'send', chatId: chat.id, body: 'Hello Bob!', tempId: 't1' }));
  const got = await until(() => wsB.events.find((e) => e.type === 'message'));
  assert.equal(got.message.body, 'Hello Bob!'); assert.equal(got.message.senderId, a.json.user.id);
  console.log('ok  realtime one-to-one delivery');

  wsB.send(JSON.stringify({ type: 'read', chatId: chat.id, messageId: got.message.id }));
  await until(() => wsA.events.find((e) => e.type === 'read'));
  wsB.send(JSON.stringify({ type: 'typing', chatId: chat.id, on: true }));
  await until(() => wsA.events.find((e) => e.type === 'typing' && e.on));
  console.log('ok  read receipts + typing indicator');

  const hist = (await call('GET', `/api/chats/${chat.id}/messages`, { cookie: b.cookie })).json.messages;
  assert.equal(hist.length, 1);
  const raw = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('paigaam.db')).map((f) => fs.readFileSync(path.join(DATA_DIR, f)).toString('latin1')).join('');
  assert.ok(raw.length > 0);
  assert.ok(!raw.includes('Hello Bob!'), 'message must be encrypted at rest');
  console.log('ok  persistence + encryption at rest');

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const up = await call('POST', `/api/chats/${chat.id}/upload`, { cookie: a.cookie, body: png, headers: { 'x-kind': 'image', 'x-filename': 'pic.png' } });
  assert.equal(up.status, 201);
  const url = up.json.message.fileUrl;
  assert.equal((await fetch(base + url, { headers: { cookie: b.cookie } })).status, 200);
  const carol = await call('POST', '/api/auth/register', { body: { username: 'carol', displayName: 'Carol', password: 'secret3' } });
  assert.equal((await fetch(base + url, { headers: { cookie: carol.cookie } })).status, 404);
  const bad = await call('POST', `/api/chats/${chat.id}/upload`, { cookie: a.cookie, body: Buffer.from('MZ\x90\x00fake'), headers: { 'x-kind': 'file', 'x-filename': 'notes.txt' } });
  assert.equal(bad.status, 400);
  const bad2 = await call('POST', `/api/chats/${chat.id}/upload`, { cookie: a.cookie, body: Buffer.from('hi'), headers: { 'x-kind': 'file', 'x-filename': 'run.exe' } });
  assert.equal(bad2.status, 400);
  console.log('ok  image upload, access control, unsafe file rejection');

  const ai = (await call('GET', '/api/chats', { cookie: a.cookie })).json.chats.find((c) => c.members.some((m) => m.isBot));
  wsA.send(JSON.stringify({ type: 'send', chatId: ai.id, body: 'hi ai' }));
  const botId = ai.members.find((m) => m.isBot).id;
  const reply = await until(() => wsA.events.find((e) => e.type === 'message' && e.message.senderId === botId && e.message.chatId === ai.id));
  assert.ok(reply.message.body.length > 0);
  const aiHistory = (await call('GET', `/api/chats/${ai.id}/messages`, { cookie: a.cookie })).json.messages;
  assert.ok(aiHistory.some((m) => m.id === reply.message.id && m.body === reply.message.body));
  console.log('ok  AI assistant reply delivered and visible in chat history');

  await call('POST', '/api/auth/logout', { cookie: a.cookie });
  assert.equal((await call('GET', '/api/auth/me', { cookie: a.cookie })).status, 401);
  console.log('ok  logout invalidates session');
  console.log('\nAll checks passed.');
} catch (e) { console.error('FAILED:', e); process.exitCode = 1; }
finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
