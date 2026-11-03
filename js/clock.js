// The big ASCII clock. Every pixel of the 5x7 font is a <span> holding two
// characters. When a digit changes, only the pixels that differ animate:
// they "heat up" through a character ramp, flash hot, then settle.

const RAMP = ' .:-=+*#%@';
const ASCII_ON = '#@%&$8B';
const SCRAMBLE = '!<>-_\\/[]{}=+*^?#%&@$01';
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function rnd(str) { return str[(Math.random() * str.length) | 0]; }

class AsciiClock {
  constructor(el, opts = {}) {
    this.el = el;
    this.style = opts.style || 'ascii';
    this.unlit = opts.unlit !== false;
    this.text = '';
    this.shapeKey = '';
    this.cols = [];
    this.grid = [];
    this.active = new Set();
    this.raf = 0;
    this.lastShimmer = 0;
    this.charRatio = this.measure();
    this.loop = this.loop.bind(this);
  }

  measure() {
    const probe = document.createElement('span');
    probe.textContent = 'MMMMMMMMMM';
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;line-height:1;white-space:pre;font-family:inherit';
    this.el.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 1000 || 0.6;
    probe.remove();
    return w;
  }

  setOptions({ style, unlit }) {
    if (style) this.style = style;
    if (unlit !== undefined) this.unlit = unlit;
    for (const row of this.grid) for (const cell of row) if (!cell.anim) this.paint(cell);
    this.kick();
  }

  onChar() {
    switch (this.style) {
      case 'block': return '██';
      case 'shade': return '▓▓';
      case 'binary': return rnd('01') + rnd('01');
      default: return rnd(ASCII_ON) + rnd(ASCII_ON);
    }
  }

  offChar() {
    if (!this.unlit) return '  ';
    return this.style === 'block' || this.style === 'shade' ? '░░' : '· ';
  }

  paint(cell) {
    const el = cell.el;
    el.style.opacity = '';
    el.textContent = cell.on ? this.onChar() : this.offChar();
    el.className = (cell.on ? 'on' : 'off') + (cell.colon ? ' colon' : '');
  }

  build(text) {
    this.active.clear();
    this.cols = [];
    [...text].forEach((ch, i) => {
      if (i > 0) this.cols.push(null); // one-pixel gap between glyphs
      for (let x = 0; x < FONT[ch][0].length; x++) this.cols.push({ i, x });
    });
    this.el.textContent = '';
    this.grid = [];
    const frag = document.createDocumentFragment();
    for (let r = 0; r < FONT_ROWS; r++) {
      const row = [];
      for (const col of this.cols) {
        const span = document.createElement('span');
        const cell = { el: span, on: false, anim: null, col, r, colon: !!col && text[col.i] === ':' };
        this.paint(cell);
        row.push(cell);
        frag.appendChild(span);
      }
      this.grid.push(row);
      if (r < FONT_ROWS - 1) frag.appendChild(document.createTextNode('\n'));
    }
    this.el.appendChild(frag);
    this.text = ' '.repeat(text.length);
    this.fit();
  }

  fit() {
    const chars = this.cols.length * 2;
    if (!chars) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const availW = vw * (vw < 600 ? 0.94 : 0.86);
    const availH = vh * 0.42;
    const size = Math.max(6, Math.min(availW / (chars * this.charRatio), availH / FONT_ROWS, 64));
    this.el.style.fontSize = size.toFixed(2) + 'px';
  }

  set(text, { instant = false } = {}) {
    const key = text.replace(/\d/g, 'd');
    const rebuilt = key !== this.shapeKey;
    if (rebuilt) { this.shapeKey = key; this.build(text); }
    const now = performance.now();
    const quick = instant || reducedMotion;
    for (let r = 0; r < FONT_ROWS; r++) {
      const row = this.grid[r];
      for (const cell of row) {
        if (!cell.col) continue;
        const ch = text[cell.col.i];
        if (!rebuilt && ch === this.text[cell.col.i]) continue;
        const target = FONT[ch][r][cell.col.x] === '#';
        if (target === cell.on && !cell.anim) continue;
        cell.on = target;
        if (quick) {
          cell.anim = null;
          this.active.delete(cell);
          this.paint(cell);
        } else {
          const delay = r * 16 + Math.random() * 140 + (rebuilt ? cell.col.i * 40 : 0);
          cell.anim = { t0: now + delay, dur: 260 + Math.random() * 260, target };
          this.active.add(cell);
        }
      }
    }
    this.text = text;
    this.kick();
  }

  // Every lit pixel briefly flares: used when a session ends.
  flare() {
    if (reducedMotion) return;
    const now = performance.now();
    for (const row of this.grid) for (const cell of row) {
      if (!cell.on) continue;
      cell.anim = { t0: now + (cell.col ? cell.col.i * 90 : 0) + Math.random() * 300, dur: 500 + Math.random() * 400, target: true, flare: true };
      this.active.add(cell);
    }
    this.kick();
  }

  kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  loop(now) {
    this.raf = 0;
    for (const cell of this.active) {
      const a = cell.anim;
      const p = (now - a.t0) / a.dur;
      if (p < 0) continue;
      if (p >= 1) {
        cell.anim = null;
        this.active.delete(cell);
        this.paint(cell);
        continue;
      }
      // q: 0 = dark, 1 = fully lit
      const q = a.flare ? 1 - Math.sin(p * Math.PI) * 0.6 : (a.target ? p : 1 - p);
      const pick = () => {
        let k = Math.floor(q * (RAMP.length - 1) + (Math.random() * 4 - 2));
        k = Math.max(0, Math.min(RAMP.length - 1, k));
        return RAMP[k];
      };
      cell.el.textContent = pick() + pick();
      cell.el.className = 'tr' + (cell.colon ? ' colon' : '');
      cell.el.style.opacity = (0.25 + 0.75 * Math.max(q, a.target ? 0 : 0.2)).toFixed(2);
    }

    // idle shimmer: a few lit pixels quietly re-pick their characters
    const shimmers = this.style === 'ascii' || this.style === 'binary';
    if (shimmers && !reducedMotion && now - this.lastShimmer > 110) {
      this.lastShimmer = now;
      for (const row of this.grid) for (const cell of row) {
        if (cell.on && !cell.anim && Math.random() < 0.025) cell.el.textContent = this.onChar();
      }
    }

    if (this.active.size || (shimmers && !reducedMotion)) this.raf = requestAnimationFrame(this.loop);
  }
}

// Decode-style text change for labels: characters scramble, then resolve
// left to right with a little randomness.
function scrambleText(el, to) {
  if (el._scrTarget === to) return;
  el._scrTarget = to;
  cancelAnimationFrame(el._scr);
  if (reducedMotion) { el.textContent = to; return; }
  const from = el.textContent;
  const len = Math.max(from.length, to.length);
  const q = [];
  for (let i = 0; i < len; i++) {
    const start = (Math.random() * 14) | 0;
    q.push({ from: from[i] || '', to: to[i] || '', start, end: start + 6 + ((Math.random() * 18) | 0), ch: '' });
  }
  let frame = 0;
  const esc = (c) => c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c;
  const step = () => {
    let out = '', done = 0;
    for (const item of q) {
      if (frame >= item.end) { done++; out += esc(item.to); }
      else if (frame >= item.start) {
        if (!item.ch || Math.random() < 0.3) item.ch = rnd(SCRAMBLE);
        out += '<span class="scr">' + esc(item.ch) + '</span>';
      } else out += esc(item.from);
    }
    el.innerHTML = out;
    if (done === q.length) { el.textContent = to; return; }
    frame++;
    el._scr = requestAnimationFrame(step);
  };
  step();
}
