import { h } from '../utils/dom.js';
export function openLightbox(src) {
  const close = () => { overlay.remove(); removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  const overlay = h('div', { class: 'overlay lightbox', onclick: close }, h('img', { src, alt: 'Photo' }));
  addEventListener('keydown', onKey);
  document.body.append(overlay);
}
