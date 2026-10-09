import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const SCRIPT = [
  ['in', 'Hey! Did you check the new app screens? 👀'],
  ['out', 'Yes, they look amazing! Sharing my notes now.'],
  ['in', 'Can we move the call to 4?'],
  ['out', 'Sure, see you then ✨'],
  ['in', 'Voice note · 0:18'],
  ['out', 'Got it, thanks!'],
];

// Two-column layout shared by the login and register pages. The left side plays a looping chat demo.
export function AuthShell(formContent) {
  const stage = h('div', { class: 'demo' });
  let i = 0, timer = null;
  const typing = () => h('div', { class: 'demo-bubble in typing' }, h('i'), h('i'), h('i'));

  function step() {
    const [side, text] = SCRIPT[i % SCRIPT.length];
    const t = side === 'in' ? typing() : null;
    if (t) stage.append(t);
    timer = setTimeout(() => {
      t?.remove();
      stage.append(h('div', { class: 'demo-bubble ' + side }, text, side === 'out' ? h('span', { class: 'demo-tick' }, icon('checks')) : null));
      while (stage.children.length > 4) stage.firstElementChild.remove();
      i++; timer = setTimeout(step, 1500);
    }, t ? 1100 : 300);
  }
  step();

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'blob b1' }), h('div', { class: 'blob b2' }), h('div', { class: 'blob b3' }),
    h('div', { class: 'brand' }, h('span', { class: 'brand-logo' }, icon('chat')), 'Paigaam'),
    h('h2', {}, 'Real-time chat,', h('br'), h('span', {}, 'made beautifully simple.')),
    h('p', {}, 'Messages, photos, voice notes, groups and an AI assistant — all delivered instantly.'),
    stage,
    h('div', { class: 'perks' }, h('span', {}, icon('lock'), 'Encrypted at rest'), h('span', {}, icon('checks'), 'Read receipts'), h('span', {}, icon('sparkle'), 'AI assistant')));

  const card = h('section', { class: 'auth-card' }, h('div', { class: 'brand small' }, h('span', { class: 'brand-logo' }, icon('chat')), 'Paigaam'), formContent);
  return { el: h('div', { class: 'auth' }, hero, card), destroy: () => clearTimeout(timer) };
}
