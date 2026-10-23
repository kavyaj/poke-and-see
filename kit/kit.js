/* Poke & See shared toy code: sound engine, speech and the sound button.
   Load after tokens.css and kit.css. Nothing makes a sound before the first touch. */
(function () {
'use strict';
const PS = window.PS = window.PS || {};
const KEY = 'ps-muted';

PS.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Read a token from tokens.css, for drawing on a canvas.
PS.token = name => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();

/* ---------- sound ---------- */
let AC = null, master = null, noiseBuf = null, muted = false;
const readyFns = [];
try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}

function init() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
  const len = AC.sampleRate * 2; noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  readyFns.forEach(fn => { try { fn(AC, master, noiseBuf); } catch (e) {} });
}
const ok = () => AC && !muted;

function tone(f, dur, o = {}) {
  if (!ok()) return;
  const t0 = AC.currentTime + (o.delay || 0), os = AC.createOscillator(), g = AC.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t0);
  if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  const v = o.vol || 0.15;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  os.connect(g); g.connect(master); os.start(t0); os.stop(t0 + dur + 0.05);
}
function noise(dur, o = {}) {
  if (!ok()) return;
  const t0 = AC.currentTime + (o.delay || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2000, t0); f.Q.value = o.q || 1;
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  const v = o.vol || 0.2;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + (o.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}

function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? '1' : '0'); } catch (e) {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, AC.currentTime, 0.05);
  if (m && 'speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) {}
  if (!m) { init(); tone(660, 0.12, { vol: 0.12 }); tone(990, 0.15, { vol: 0.12, delay: 0.1 }); }
}

PS.sound = {
  tone, noise,
  muted: () => muted,
  // A soft wooden "tok" for taps.
  tok() { tone(190, 0.09, { vol: 0.18, to: 140 }); noise(0.03, { f: 1400, q: 2, vol: 0.06 }); },
  // Slider tick; frac is 0..1 along the scale, and the pitch rises with it.
  tick(frac) { tone(330 * Math.pow(2, frac * 2.3), 0.07, { type: 'triangle', vol: 0.07 }); },
  // fn(context, output, noiseBuffer) runs once audio exists, for a toy's own ambient loops.
  onReady(fn) { readyFns.push(fn); if (AC) fn(AC, master, noiseBuf); },
  // Wire a .ps-round sound button: aria-pressed="true" means sound on. Remembered across toys.
  button(el) {
    const show = () => el.setAttribute('aria-pressed', muted ? 'false' : 'true');
    show();
    el.addEventListener('click', () => { setMuted(!muted); show(); });
  }
};

/* ---------- speech ---------- */
let sayTimer = 0;
PS.say = function (text, delay = 0) {
  if (muted || !('speechSynthesis' in window)) return;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => {
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.85; u.pitch = 1; u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
  }, delay);
};

/* ---------- first touch unlocks audio and speech ---------- */
let unlocked = false;
function unlock() {
  init();
  if (!unlocked) {
    unlocked = true;
    try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
  }
}
document.addEventListener('pointerdown', unlock, true);
document.addEventListener('keydown', unlock, true);
document.addEventListener('visibilitychange', () => { if (!AC) return; document.hidden ? AC.suspend() : AC.resume(); });
})();
