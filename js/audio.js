// Tiny synthesized sound effects (no audio files needed).
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }
export function unlockAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx?.state === 'suspended') ctx.resume();
}

function tone(freq, { dur = 0.12, type = 'sine', vol = 0.18, slide = 0, delay = 0 } = {}) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, { dur: 0.06, type: 'triangle', vol: 0.12 }),
  crate: () => { tone(520, { dur: 0.09, type: 'triangle' }); tone(780, { dur: 0.1, type: 'triangle', delay: 0.06 }); },
  advance: () => [523, 659, 784].forEach((f, i) => tone(f, { dur: 0.16, type: 'triangle', delay: i * 0.08, vol: 0.16 })),
  done: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.22, type: 'square', delay: i * 0.09, vol: 0.08 })),
  hit: () => { tone(140, { dur: 0.3, type: 'sawtooth', vol: 0.16, slide: -80 }); tone(90, { dur: 0.25, type: 'square', vol: 0.08 }); },
  orb: () => [880, 1175, 1568].forEach((f, i) => tone(f, { dur: 0.18, type: 'sine', delay: i * 0.05, vol: 0.12 })),
  miss: () => tone(300, { dur: 0.12, type: 'sine', vol: 0.06, slide: -120 }),
  remote: () => { tone(740, { dur: 0.1, type: 'sine', vol: 0.1 }); tone(988, { dur: 0.14, type: 'sine', delay: 0.1, vol: 0.1 }); },
  win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, { dur: 0.25, type: 'triangle', delay: i * 0.12, vol: 0.14 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, { dur: 0.3, type: 'triangle', delay: i * 0.16, vol: 0.12 })),
};
