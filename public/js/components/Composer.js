import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { sendText, sendTyping, uploadFile } from '../services/chats.js';
import { startRecording } from '../services/recorder.js';
import { toast } from '../utils/toast.js';
import { mmss } from '../utils/format.js';

const EMOJI = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👏', '🙏', '🔥', '🎉', '❤️', '💙', '✨', '👀', '💯', '🤝', '😅', '🙌', '🥳', '😴', '🤯'];

export function Composer({ getChat }) {
  let typingSince = 0, typingTimer = null, recorder = null, recTimer = null, recStart = 0;

  const input = h('input', { class: 'msg-input', type: 'text', placeholder: 'Type a message...', autocomplete: 'off', maxlength: '4000' });
  const sendBtn = h('button', { class: 'send-btn', 'aria-label': 'Send' }, icon('send'));
  const micBtn = h('button', { class: 'send-btn mic', 'aria-label': 'Record voice message' }, icon('mic'));
  const photoInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', class: 'hidden' });
  const fileInput = h('input', { type: 'file', class: 'hidden' });
  const menu = h('div', { class: 'pop menu hidden' },
    h('button', { onclick: () => { closePops(); photoInput.click(); } }, icon('image'), 'Photo'),
    h('button', { onclick: () => { closePops(); fileInput.click(); } }, icon('file'), 'File'));
  const emojiPop = h('div', { class: 'pop emoji hidden' }, EMOJI.map((e) => h('button', { onclick: () => { input.value += e; input.focus(); sync(); } }, e)));
  const plusBtn = h('button', { class: 'icon-btn plus', 'aria-label': 'Attach', onclick: (e) => { e.stopPropagation(); toggle(menu); } }, icon('plus'));
  const emojiBtn = h('button', { class: 'icon-btn', 'aria-label': 'Emoji', onclick: (e) => { e.stopPropagation(); toggle(emojiPop); } }, icon('smile'));

  const recTime = h('span', {}, '0:00');
  const recBar = h('div', { class: 'rec-bar hidden' },
    h('button', { class: 'icon-btn', 'aria-label': 'Cancel recording', onclick: () => stopRecording(false) }, icon('x')),
    h('span', { class: 'rec-dot' }), recTime, h('span', { class: 'rec-label' }, 'Recording\u2026'),
    h('button', { class: 'send-btn', 'aria-label': 'Send voice message', onclick: () => stopRecording(true) }, icon('send')));

  const field = h('div', { class: 'field-wrap' }, input, emojiBtn);
  const row = h('div', { class: 'composer-row' }, plusBtn, field, sendBtn, micBtn);
  const el = h('div', { class: 'composer' }, menu, emojiPop, row, recBar, photoInput, fileInput);

  const closePops = () => { menu.classList.add('hidden'); emojiPop.classList.add('hidden'); };
  const toggle = (pop) => { const wasHidden = pop.classList.contains('hidden'); closePops(); pop.classList.toggle('hidden', !wasHidden); };
  const onDocClick = (e) => { if (!el.contains(e.target) || (!menu.contains(e.target) && !emojiPop.contains(e.target) && !e.target.closest('.icon-btn'))) closePops(); };
  document.addEventListener('click', onDocClick);

  function sync() {
    const has = input.value.trim().length > 0;
    sendBtn.classList.toggle('hidden', !has);
    micBtn.classList.toggle('hidden', has);
  }
  function stopTyping() {
    clearTimeout(typingTimer);
    if (typingSince) { typingSince = 0; const c = getChat(); if (c) sendTyping(c.id, false); }
  }
  function submit() {
    const chat = getChat(), body = input.value.trim();
    if (!chat || !body) return;
    if (sendText(chat.id, body)) { input.value = ''; stopTyping(); sync(); }
  }
  input.addEventListener('input', () => {
    sync();
    const chat = getChat(); if (!chat) return;
    if (Date.now() - typingSince > 2500) { typingSince = Date.now(); sendTyping(chat.id, true); }
    clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 3000);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
  sendBtn.addEventListener('click', submit);

  async function pick(file, kind) {
    const chat = getChat(); if (!chat || !file) return;
    if (file.size > 10 * 1024 * 1024) return toast('Files can be at most 10 MB.', 'error');
    await uploadFile(chat.id, file, { kind, filename: file.name });
  }
  photoInput.addEventListener('change', () => { pick(photoInput.files[0], 'image'); photoInput.value = ''; });
  fileInput.addEventListener('change', () => { pick(fileInput.files[0], 'file'); fileInput.value = ''; });

  micBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Voice notes are not supported in this browser.', 'error');
    try { recorder = await startRecording(); } catch { return toast('Microphone permission was denied.', 'error'); }
    recStart = Date.now(); recTime.textContent = '0:00';
    recTimer = setInterval(() => { recTime.textContent = mmss((Date.now() - recStart) / 1000); }, 250);
    row.classList.add('hidden'); recBar.classList.remove('hidden');
  });
  async function stopRecording(send) {
    clearInterval(recTimer);
    row.classList.remove('hidden'); recBar.classList.add('hidden');
    const rec = recorder; recorder = null; if (!rec) return;
    if (!send) return rec.cancel();
    const { blob, duration } = await rec.stop();
    if (duration < 0.6) return toast('Hold on a little longer to record a voice note.');
    const chat = getChat();
    if (chat) uploadFile(chat.id, blob, { kind: 'voice', filename: 'voice-note', duration });
  }

  sync();
  return { el, destroy: () => document.removeEventListener('click', onDocClick), focus: () => input.focus(), reset: () => { input.value = ''; stopTyping(); sync(); closePops(); if (recorder) stopRecording(false); } };
}
