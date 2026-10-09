// Paigaam AI: answers in the built-in assistant chat, or anywhere when someone writes "@ai ...".
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config.js';
import { BOT_ID } from '../db.js';
import { addMessage, listMessages, memberIds, markRead } from './chat.js';
import { getUser } from './users.js';
import db from '../db.js';
import { sendToUsers } from '../realtime/presence.js';

const NO_KEY = "I'm not connected to an AI model yet. Add your GEMINI_API_KEY to the .env file and restart the server, then ask me again.";

async function ask(chatId) {
  if (!GEMINI_API_KEY) return NO_KEY;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  const members = memberIds(chatId);
  const withBot = members.includes(BOT_ID);
  const names = members.filter((id) => id !== BOT_ID).map((id) => getUser(id).display_name);
  const history = listMessages(chatId, null, 30).filter((m) => m.type === 'text' && !m.deleted && m.body);
  const messages = [];
  for (const m of history) {
    const role = m.senderId === BOT_ID ? 'model' : 'user';
    const text = (!withBot || chat.type === 'group') && role === 'user' ? `${getUser(m.senderId).display_name}: ${m.body}` : m.body;
    if (messages.at(-1)?.role === role) messages.at(-1).parts[0].text += '\n' + text;
    else messages.push({ role, parts: [{ text }] });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return 'Say something and I will reply!';
  const system = withBot
    ? 'You are Paigaam AI, a friendly assistant inside the Paigaam chat app. Keep replies concise and conversational.'
    : `You are Paigaam AI, invited into a chat between ${names.join(', ')} by someone writing "@ai". ` +
      'Use the recent messages as context (for example to summarize or answer questions). Be brief and helpful.';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages,
      generationConfig: { maxOutputTokens: 700 },
    }),
  });
  if (!res.ok) throw new Error('Gemini API returned ' + res.status);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.filter((part) => typeof part.text === 'string')
    .map((part) => part.text).join('\n').trim() || '...';
}

export async function aiReply(chatId) {
  const humans = memberIds(chatId).filter((id) => id !== BOT_ID);
  const typing = (on) => sendToUsers(humans, { type: 'typing', chatId, userId: BOT_ID, on });
  typing(true);
  let text;
  try { text = await ask(chatId); }
  catch (e) { console.error('[ai]', e.message); text = "Sorry, I couldn't reach the AI service right now."; }
  finally { typing(false); }
  const msg = addMessage({ chatId, senderId: BOT_ID, body: text });
  markRead(chatId, BOT_ID, msg.id);
  sendToUsers(humans, { type: 'message', message: msg });
}
