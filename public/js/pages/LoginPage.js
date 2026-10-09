import { h, ripple } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Field } from '../components/Field.js';
import { AuthShell } from '../components/AuthShell.js';
import { api } from '../services/api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';

export function LoginPage(root) {
  const username = Field({ label: 'Username', name: 'username', autocomplete: 'username', leading: 'user', maxlength: 20 });
  const password = Field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'current-password', leading: 'lock' });
  const greeting = h('span', {}, 'Welcome back');
  const error = h('div', { class: 'form-error hidden', role: 'alert' });
  const submit = h('button', { class: 'btn wide', type: 'submit' }, 'Sign in');
  ripple(submit);

  try { username.input.value = localStorage.getItem('paigaam:last-user') || ''; } catch { /* storage unavailable */ }

  const form = h('form', { class: 'auth-form', novalidate: true },
    h('h1', {}, greeting, h('span', { class: 'wave-hand' }, ' 👋')),
    h('p', { class: 'sub' }, 'Sign in to continue your conversations.'),
    error, username.el, password.el, submit,
    h('p', { class: 'switch' }, 'New to Paigaam? ', h('a', { href: '#/register' }, 'Create an account')));

  // Live, friendly feedback while typing
  const greet = () => { const v = username.input.value.trim(); greeting.textContent = v ? `Welcome back, ${v}` : 'Welcome back'; };
  username.input.addEventListener('input', greet); greet();
  password.input.addEventListener('keyup', (e) => {
    password.setHint(e.getModifierState?.('CapsLock') ? 'Caps Lock is on' : '', e.getModifierState?.('CapsLock') ? 'warn' : '');
  });

  const showError = (msg) => {
    error.textContent = msg; error.classList.remove('hidden');
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); error.classList.add('hidden');
    if (!username.input.value.trim() || !password.input.value) return showError('Enter your username and password.');
    submit.disabled = true; submit.replaceChildren(h('span', { class: 'spinner' }), 'Signing in\u2026');
    try {
      const { user } = await api.post('/api/auth/login', { username: username.input.value, password: password.input.value });
      state.me = user;
      try { localStorage.setItem('paigaam:last-user', user.username); } catch { /* ignore */ }
      submit.replaceChildren(icon('check'), 'Welcome!');
      navigate('/chat');
    } catch (err) {
      showError(err.message); submit.disabled = false; submit.replaceChildren('Sign in'); password.input.select();
    }
  });

  const shell = AuthShell(form);
  root.replaceChildren(shell.el);
  (username.input.value ? password.input : username.input).focus();
  return { unmount: shell.destroy };
}
