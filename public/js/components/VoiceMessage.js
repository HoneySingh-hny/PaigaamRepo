import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { mmss } from '../utils/format.js';

let playing = null; // only one voice note plays at a time
const BARS = 26;

export function VoiceMessage(m) {
  const total = Number(m.body) || 0;
  const audio = new Audio(m.fileUrl); audio.preload = 'metadata';
  const btn = h('button', { class: 'play-btn', 'aria-label': 'Play voice message' }, icon('play'));
  const time = h('span', { class: 'voice-time' }, mmss(total));
  // Deterministic pseudo-random "waveform" per message
  let seed = m.id * 9301 + 49297;
  const bars = Array.from({ length: BARS }, () => {
    seed = (seed * 9301 + 49297) % 233280;
    return h('i', { style: { height: 6 + Math.round((seed / 233280) * 18) + 'px' } });
  });
  const wave = h('div', { class: 'wave' }, bars);
  const setIcon = (name) => btn.replaceChildren(icon(name));
  const reset = () => { setIcon('play'); bars.forEach((b) => b.classList.remove('on')); time.textContent = mmss(total); };

  btn.addEventListener('click', () => {
    if (audio.paused) {
      if (playing && playing !== audio) playing.pause();
      playing = audio; audio.play().catch(() => {}); setIcon('pause');
    } else { audio.pause(); setIcon('play'); }
  });
  audio.addEventListener('timeupdate', () => {
    const dur = total || audio.duration || 1;
    const n = Math.round((audio.currentTime / dur) * BARS);
    bars.forEach((b, i) => b.classList.toggle('on', i < n));
    time.textContent = mmss(audio.currentTime);
  });
  audio.addEventListener('ended', reset);
  audio.addEventListener('pause', () => audio.ended || setIcon('play'));
  return h('div', { class: 'voice' }, btn, wave, time);
}
