// All sounds are synthesized with WebAudio: no audio files.
const Sound = {
  ctx: null,
  volume: 0.6,

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // A soft bell: a sine fundamental with a few inharmonic partials.
  bell(freq, t, dur, gain) {
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    master.connect(ctx.destination);
    [[1, 1], [2.01, 0.32], [3.02, 0.11], [4.23, 0.05]].forEach(([mult, amp]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.value = amp;
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  },

  chime(kind) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.03;
    const v = 0.22 * this.volume;
    // rising after a break (back to work), falling after focus (rest)
    const notes = kind === 'focus'
      ? [523.25, 659.25, 783.99, 1046.5]
      : [987.77, 783.99, 659.25, 493.88];
    notes.forEach((f, i) => this.bell(f, t + i * 0.24, 2.6, v));
  },

  tick() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 2200;
    g.gain.setValueAtTime(0.03 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.03);
  },

  blip(up) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(up ? 520 : 780, t);
    o.frequency.exponentialRampToValueAtTime(up ? 780 : 520, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * this.volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.16);
  },
};
