// Tiny synthesized sound effects with the Web Audio API: no audio files, no
// network, nothing to load. Everything is guarded: a browser without audio, or
// one that has not had a user gesture yet, simply stays silent.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** A short tone: frequency in Hz, seconds long, shaped like a pluck. */
  function tone(freq, seconds, type, volume, when = 0) {
    const ctx = ensure();
    if (ctx === null) return;
    try {
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call once from a user gesture so the browser unlocks audio. */
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    pickup() {
      tone(660, 0.07, 'square', 0.05);
    },
    place() {
      tone(330, 0.09, 'triangle', 0.08);
    },
    sizzle() {
      tone(180, 0.12, 'sawtooth', 0.03);
    },
    cooked() {
      tone(880, 0.08, 'sine', 0.06);
      tone(1174, 0.1, 'sine', 0.05, 0.07);
    },
    serve() {
      tone(523, 0.1, 'sine', 0.08);
      tone(659, 0.1, 'sine', 0.08, 0.08);
      tone(784, 0.16, 'sine', 0.08, 0.16);
    },
    wrong() {
      tone(160, 0.18, 'sawtooth', 0.07);
    },
    miss() {
      tone(392, 0.14, 'triangle', 0.07);
      tone(262, 0.22, 'triangle', 0.07, 0.12);
    },
    tick() {
      tone(980, 0.05, 'square', 0.04);
    },
    over() {
      tone(523, 0.16, 'sine', 0.07);
      tone(392, 0.16, 'sine', 0.07, 0.14);
      tone(330, 0.3, 'sine', 0.07, 0.28);
    },
  };
}
