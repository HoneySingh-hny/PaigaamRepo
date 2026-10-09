import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

// Floating-label input with optional show/hide password button and a live hint line.
export function Field({ label, name, type = 'text', autocomplete, leading, maxlength }) {
  const input = h('input', { class: 'f-input', name, type, autocomplete, placeholder: ' ', required: true, maxlength, spellcheck: 'false' });
  const hint = h('div', { class: 'f-hint' });
  let toggle = null;
  if (type === 'password') {
    toggle = h('button', { type: 'button', class: 'f-eye', 'aria-label': 'Show password', tabindex: '-1' }, icon('eye'));
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.replaceChildren(icon(show ? 'eyeoff' : 'eye'));
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }
  const box = h('div', { class: 'f-box' }, leading ? h('span', { class: 'f-lead' }, icon(leading)) : null, input, h('label', { class: 'f-label' }, label), toggle);
  const el = h('div', { class: 'field' }, box, hint);
  input.addEventListener('focus', () => el.classList.add('focus'));
  input.addEventListener('blur', () => el.classList.remove('focus'));
  return {
    el, input,
    setHint(text, kind = '') { hint.textContent = text || ''; hint.className = 'f-hint ' + kind; el.classList.toggle('bad', kind === 'bad'); el.classList.toggle('good', kind === 'good'); },
  };
}
