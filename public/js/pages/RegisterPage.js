import { h, ripple, debounce } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Field } from '../components/Field.js';
import { AuthShell } from '../components/AuthShell.js';
import { api } from '../services/api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';

const LEVELS = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
function strength(pw) {
  if (pw.length < 6) return 0;
  let s = 1 + (pw.length >= 10) + (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) + (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw));
  return Math.min(4, s);
}

export function RegisterPage(root) {
  const name = Field({ label: 'Your name', name: 'name', autocomplete: 'name', leading: 'user', maxlength: 40 });
  const username = Field({ label: 'Choose a username', name: 'username', autocomplete: 'username', leading: 'chat', maxlength: 20 });
  const password = Field({ label: 'Password (6+ characters)', name: 'password', type: 'password', autocomplete: 'new-password', leading: 'lock' });
  const meter = h('div', { class: 'meter' }, [0, 1, 2, 3].map(() => h('i')));
  const meterText = h('span', { class: 'meter-text' }, '');
  const error = h('div', { class: 'form-error hidden', role: 'alert' });
  const submit = h('button', { class: 'btn wide', type: 'submit' }, 'Create account');
  ripple(submit);
  let nameOk = false;

  const check = debounce(async () => {
    const v = username.input.value.trim().toLowerCase();
    if (!v) return username.setHint('');
    if (!/^[a-z0-9_]{3,20}$/.test(v)) { nameOk = false; return username.setHint('Use 3-20 letters, numbers or underscores', 'bad'); }
    try {
      const { available } = await api.get('/api/auth/check?username=' + encodeURIComponent(v));
      if (username.input.value.trim().toLowerCase() !== v) return;
      nameOk = available; username.setHint(available ? `@${v} is available` : `@${v} is already taken`, available ? 'good' : 'bad');
    } catch { /* offline: server will validate */ }
  }, 350);
  username.input.addEventListener('input', () => { nameOk = false; username.setHint('Checking\u2026'); check(); });

  password.input.addEventListener('input', () => {
    const s = strength(password.input.value);
    [...meter.children].forEach((b, i) => { b.className = i < s ? 'on l' + s : ''; });
    meterText.textContent = password.input.value ? LEVELS[s] : '';
  });

  const form = h('form', { class: 'auth-form', novalidate: true },
    h('h1', {}, 'Create your account'),
    h('p', { class: 'sub' }, 'It takes less than a minute. No email needed.'),
    error, name.el, username.el, password.el, h('div', { class: 'meter-row' }, meter, meterText), submit,
    h('p', { class: 'switch' }, 'Already have an account? ', h('a', { href: '#/login' }, 'Sign in')));

  const showError = (msg) => {
    error.textContent = msg; error.classList.remove('hidden');
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); error.classList.add('hidden');
    if (!name.input.value.trim() || !username.input.value.trim() || !password.input.value) return showError('Please fill in every field.');
    if (nameOk === false && username.el.classList.contains('bad')) return showError('Please pick a different username.');
    submit.disabled = true; submit.replaceChildren(h('span', { class: 'spinner' }), 'Creating account\u2026');
    try {
      const { user } = await api.post('/api/auth/register', { displayName: name.input.value, username: username.input.value, password: password.input.value });
      state.me = user;
      submit.replaceChildren(icon('check'), 'All set!');
      navigate('/chat');
    } catch (err) {
      showError(err.message); submit.disabled = false; submit.replaceChildren('Create account');
    }
  });

  const shell = AuthShell(form);
  root.replaceChildren(shell.el);
  name.input.focus();
  return { unmount: shell.destroy };
}
