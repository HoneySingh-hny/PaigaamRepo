import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { initials } from '../utils/format.js';

// size in px; online: show green dot; ring: blue story ring
export function Avatar(user, { size = 44, online = false, ring = false, group = false } = {}) {
  const el = h('div', {
    class: 'avatar' + (ring ? ' ring' : ''),
    style: { width: size + 'px', height: size + 'px', fontSize: size * 0.38 + 'px', background: group ? '#6366f1' : user?.color || '#2563eb' },
  });
  if (group) el.append(icon('users'));
  else if (user?.isBot) el.append(icon('sparkle'));
  else el.append(initials(user?.displayName));
  if (online) el.append(h('span', { class: 'dot' }));
  return el;
}
