import { h } from './dom.js';
export function toast(text, kind = '', ms = 3200) {
  const el = h('div', { class: 'toast ' + kind }, text);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), ms);
  return el;
}
