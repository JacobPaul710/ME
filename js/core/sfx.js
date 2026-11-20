// Sound effects made in code (no files): level-up fanfare, gear-tier chord,
// streak horn and the rest-timer bell. Plus optional voice clips for gear tiers.
let ctx = null;

// Phones only allow sound after a tap, so unlock audio on the first touch.
export function unlockAudio() {
  const go = () => {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch { /* no audio */ }
  };
  window.addEventListener('pointerdown', go, { once: false, passive: true });
}

function tone(freq, start, dur, { type = 'triangle', gain = 0.18 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35)); tone(1047, 0.45, 0.6, { type: 'square', gain: 0.06 }); },
  tier() { [196, 247, 294, 392].forEach((f) => tone(f, 0, 1.4, { type: 'sawtooth', gain: 0.05 })); tone(784, 0.25, 1.0); },
  milestone() { tone(220, 0, 0.5, { type: 'sawtooth', gain: 0.07 }); tone(330, 0.3, 0.9, { type: 'sawtooth', gain: 0.08 }); },
  restDone() { tone(880, 0, 0.25); tone(880, 0.3, 0.4); },
  skillUp() { tone(784, 0, 0.18); tone(1047, 0.14, 0.35); },
};

// Voice clips: put files in audio/voice and list them in audio/voice/list.json,
// named after the moment they're for, e.g. "tier-steel.mp3", "level-up.mp3", "streak-30.mp3".
let voices = null;
let playing = null;
export async function voice(name) {
  if (!voices) {
    try { voices = await (await fetch('audio/voice/list.json', { cache: 'no-cache' })).json(); } catch { voices = []; }
  }
  const file = voices.find((f) => typeof f === 'string' && f.replace(/\.\w+$/, '') === name);
  if (!file) return false;
  stopAudio();
  playing = new Audio(`audio/voice/${file}`);
  try { await playing.play(); return true; } catch { return false; }
}
export function track(audio) { stopAudio(); playing = audio; }
export function stopAudio() { if (playing) { try { playing.pause(); } catch { /* ignore */ } playing = null; } }
