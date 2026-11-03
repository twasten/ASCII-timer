(() => {
  const $ = (s) => document.querySelector(s);

  const DEFAULTS = {
    focus: 25, short: 5, long: 15, longEvery: 4,
    autoBreak: true, autoFocus: false,
    sound: true, volume: 6, tick: false, notify: false,
    theme: 'amber', glyphs: 'ascii', unlit: true, crt: true, zen: true,
  };
  const MODES = { focus: 'focus', short: 'short break', long: 'long break' };
  const PRESETS = { focus: [15, 25, 45, 60, 90], short: [3, 5, 10], long: [15, 20, 30] };
  const THEMES = ['amber', 'green', 'ice', 'white', 'rose'];
  const GLYPHS = ['ascii', 'block', 'shade', 'binary'];

  const settings = Object.assign({}, DEFAULTS, Store.get('settings', {}));
  const dur = (mode) => settings[mode] * 60000;
  const state = Object.assign(
    { mode: 'focus', running: false, endAt: 0, remaining: dur('focus'), total: dur('focus'), done: 0 },
    Store.get('state', {})
  );
  let log = Store.get('log', []);

  const saveState = () => Store.set('state', state);
  const saveSettings = () => Store.set('settings', settings);

  // ---------- elements ----------
  const clockEl = $('#clock');
  const clock = new AsciiClock(clockEl, { style: settings.glyphs, unlit: settings.unlit });
  const labelEl = $('#label');
  const progressEl = $('#progress');
  const presetsEl = $('#presets');
  const taskEl = $('#task');
  const startBtn = $('#btn-start');
  const todayEl = $('#today');
  const cycleEl = $('#cycle');
  const srEl = $('#sr');

  // ---------- time ----------
  const remainingNow = () => state.running ? Math.max(0, state.endAt - Date.now()) : state.remaining;
  const isIdle = () => !state.running && state.remaining === state.total;

  function fmt(ms) {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
  }

  function fmtDur(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }

  // ---------- actions ----------
  function start() {
    if (state.running) return;
    Sound.ensure();
    if (state.remaining <= 0) state.remaining = state.total;
    state.endAt = Date.now() + state.remaining;
    state.running = true;
    if (settings.sound) Sound.blip(true);
    saveState();
    render();
  }

  function pause() {
    if (!state.running) return;
    state.remaining = Math.max(0, state.endAt - Date.now());
    state.running = false;
    if (settings.sound) Sound.blip(false);
    saveState();
    render();
  }

  const toggle = () => (state.running ? pause() : start());

  function reset() {
    state.running = false;
    state.total = state.remaining = dur(state.mode);
    saveState();
    render();
  }

  function setMode(mode, autostart = false) {
    state.mode = mode;
    state.running = false;
    state.total = state.remaining = dur(mode);
    saveState();
    render();
    if (autostart) start();
  }

  function complete(record = true, silent = false) {
    const finished = state.mode;
    if (finished === 'focus' && record) {
      log.push({ t: Date.now(), min: Math.round(state.total / 60000), task: taskEl.value.trim() });
      if (log.length > 5000) log = log.slice(-5000);
      Store.set('log', log);
      state.done++;
    }
    let next;
    if (finished === 'focus') next = state.done > 0 && state.done % settings.longEvery === 0 ? 'long' : 'short';
    else { next = 'focus'; if (finished === 'long') state.done = 0; }

    if (record && !silent) {
      if (settings.sound) Sound.chime(finished === 'focus' ? 'break' : 'focus');
      notify(finished);
      clock.flare();
      srEl.textContent = `${MODES[finished]} complete`;
    }
    const auto = record && (next === 'focus' ? settings.autoFocus : settings.autoBreak);
    setMode(next, auto);
  }

  function skip() { complete(false); }

  function adjust(delta) {
    if (state.running) return;
    const m = state.mode;
    const max = m === 'focus' ? 240 : 90;
    settings[m] = Math.max(1, Math.min(max, settings[m] + delta));
    saveSettings();
    state.total = state.remaining = dur(m);
    saveState();
    render();
  }

  function setDuration(min) {
    if (state.running) return;
    settings[state.mode] = min;
    saveSettings();
    state.total = state.remaining = dur(state.mode);
    saveState();
    render();
  }

  function notify(finished) {
    if (!settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    try {
      new Notification(finished === 'focus' ? 'focus complete' : 'break is over', {
        body: finished === 'focus' ? 'step away for a moment.' : 'back to it.',
        icon: 'icons/icon-192.png',
      });
    } catch (e) { /* some platforms only allow notifications from a service worker */ }
  }

  // ---------- render ----------
  let lastShown = '';
  let lastSecond = -1;

  function renderClock() {
    const rem = remainingNow();
    const txt = fmt(rem);
    if (txt !== lastShown) { clock.set(txt); lastShown = txt; }
    // progress line
    const N = progressEl._n || 48;
    const frac = state.total ? 1 - rem / state.total : 0;
    const exact = frac * N;
    const full = Math.floor(exact);
    const head = full < N ? (exact - full > 0.5 ? '╸' : '') : '';
    const lit = '━'.repeat(full) + head;
    progressEl.innerHTML = `<span class="lit">${lit}</span><span class="unlit">${'─'.repeat(Math.max(0, N - lit.length))}</span>`;
    document.title = state.running || !isIdle() ? `${txt} · ${MODES[state.mode]}` : 'phosphor';
    return rem;
  }

  function render() {
    renderClock();
    document.body.classList.toggle('running', state.running);
    clockEl.classList.toggle('paused', !state.running && !isIdle());
    document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('sel', b.dataset.mode === state.mode));
    startBtn.textContent = state.running ? 'pause' : (isIdle() ? 'start' : 'resume');

    let label = MODES[state.mode];
    if (state.mode === 'focus') label += ` · ${(state.done % settings.longEvery) + 1}/${settings.longEvery}`;
    if (!state.running && !isIdle()) label += ' · paused';
    scrambleText(labelEl, label);

    // presets only while idle
    presetsEl.classList.toggle('hidden', !isIdle());
    const want = PRESETS[state.mode].join(',') + '|' + settings[state.mode];
    if (presetsEl._key !== want) {
      presetsEl._key = want;
      presetsEl.innerHTML = PRESETS[state.mode]
        .map((m) => `<button data-min="${m}" class="${m === settings[state.mode] ? 'sel' : ''}">${m}</button>`)
        .join('');
    }

    renderToday();
  }

  function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  function renderToday() {
    const k = dayKey(Date.now());
    const today = log.filter((s) => dayKey(s.t) === k);
    const min = today.reduce((a, s) => a + s.min, 0);
    todayEl.textContent = today.length
      ? `today  ${fmtDur(min)}  ·  ${today.length} session${today.length === 1 ? '' : 's'}`
      : 'today  nothing yet';
    const dots = [];
    for (let i = 0; i < settings.longEvery; i++) dots.push(i < state.done % settings.longEvery || (state.mode === 'long' && i < settings.longEvery) ? '●' : '○');
    cycleEl.textContent = dots.join(' ');
  }

  function sizeProgress() {
    const w = Math.min(clockEl.getBoundingClientRect().width || 400, window.innerWidth * 0.9);
    const cw = 0.6 * parseFloat(getComputedStyle(progressEl).fontSize);
    progressEl._n = Math.max(12, Math.min(96, Math.floor(w / cw)));
  }

  // ---------- main loop ----------
  // A worker keeps ticking reliably in background tabs, where page timers get throttled.
  function onTick() {
    if (!state.running) return;
    const rem = renderClock();
    const sec = Math.ceil(rem / 1000);
    if (sec !== lastSecond) {
      if (settings.tick && settings.sound && lastSecond !== -1) Sound.tick();
      lastSecond = sec;
    }
    if (rem <= 0) complete(true);
  }
  try {
    const src = 'setInterval(() => postMessage(0), 200);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = onTick;
  } catch (e) {
    setInterval(onTick, 200);
  }

  // ---------- settings ----------
  function applySettings() {
    document.documentElement.dataset.theme = settings.theme;
    document.body.classList.toggle('crt', settings.crt);
    document.body.classList.toggle('zen-ok', settings.zen);
    clock.setOptions({ style: settings.glyphs, unlit: settings.unlit });
    Sound.volume = settings.volume / 10;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = '#000000';
  }

  const SCHEMA = [
    { k: 'focus', label: 'focus', type: 'num', min: 1, max: 240, unit: 'min' },
    { k: 'short', label: 'short break', type: 'num', min: 1, max: 90, unit: 'min' },
    { k: 'long', label: 'long break', type: 'num', min: 1, max: 90, unit: 'min' },
    { k: 'longEvery', label: 'long break every', type: 'num', min: 2, max: 12, unit: 'sessions' },
    { k: 'autoBreak', label: 'auto-start breaks', type: 'bool' },
    { k: 'autoFocus', label: 'auto-start focus', type: 'bool' },
    { sep: true },
    { k: 'sound', label: 'chime', type: 'bool' },
    { k: 'volume', label: 'volume', type: 'num', min: 1, max: 10, bar: true },
    { k: 'tick', label: 'ticking', type: 'bool' },
    { k: 'notify', label: 'notifications', type: 'bool' },
    { sep: true },
    { k: 'theme', label: 'phosphor', type: 'enum', options: THEMES },
    { k: 'glyphs', label: 'glyphs', type: 'enum', options: GLYPHS },
    { k: 'unlit', label: 'unlit pixels', type: 'bool' },
    { k: 'crt', label: 'scanlines', type: 'bool' },
    { k: 'zen', label: 'hide ui while running', type: 'bool' },
  ];
  const rows = SCHEMA.filter((r) => !r.sep);
  let cursor = 0;

  function valueHTML(row) {
    const v = settings[row.k];
    if (row.type === 'bool') return `<button class="chk" data-act="toggle">${v ? '[x]' : '[ ]'}</button>`;
    if (row.type === 'enum') return `<button class="arr" data-act="-1">‹</button> <span class="val">${v.padEnd(6)}</span> <button class="arr" data-act="1">›</button>`;
    const shown = row.bar ? '▮'.repeat(v) + '<span class="dim">' + '▯'.repeat(row.max - v) + '</span>' : String(v).padStart(3);
    return `<button class="arr" data-act="-1">-</button> <span class="val">${shown}</span> <button class="arr" data-act="1">+</button> <span class="dim">${row.unit || ''}</span>`;
  }

  function renderSettings() {
    let i = 0;
    $('#settings-rows').innerHTML = SCHEMA.map((row) => {
      if (row.sep) return '<div class="sep"></div>';
      const idx = i++;
      return `<div class="row${idx === cursor ? ' cur' : ''}" data-i="${idx}"><span class="ptr">${idx === cursor ? '›' : ' '}</span><span class="k">${row.label}</span><span class="v">${valueHTML(row)}</span></div>`;
    }).join('');
  }

  function changeSetting(row, act, big) {
    const k = row.k;
    if (row.type === 'bool') settings[k] = !settings[k];
    else if (row.type === 'enum') {
      const o = row.options;
      settings[k] = o[(o.indexOf(settings[k]) + (act > 0 ? 1 : -1) + o.length) % o.length];
    } else {
      settings[k] = Math.max(row.min, Math.min(row.max, settings[k] + act * (big ? 5 : 1)));
    }
    if (k === 'notify' && settings.notify && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (k === state.mode && isIdle()) { state.total = state.remaining = dur(k); saveState(); }
    if (k === 'volume' && settings.sound) { Sound.volume = settings.volume / 10; Sound.blip(true); }
    saveSettings();
    applySettings();
    renderSettings();
    render();
  }

  $('#settings-rows').addEventListener('click', (e) => {
    const rowEl = e.target.closest('.row');
    if (!rowEl) return;
    cursor = +rowEl.dataset.i;
    const btn = e.target.closest('button');
    if (btn) changeSetting(rows[cursor], btn.dataset.act === 'toggle' ? 1 : +btn.dataset.act, e.shiftKey);
    else renderSettings();
  });

  // ---------- log ----------
  function renderLog() {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const k = dayKey(d);
      days.push({ d, min: log.filter((s) => dayKey(s.t) === k).reduce((a, s) => a + s.min, 0) });
    }
    const max = Math.max(60, ...days.map((x) => x.min));
    const W = 26;
    const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const bars = days.map(({ d, min }) => {
      const n = Math.round((min / max) * W);
      const isToday = d.toDateString() === now.toDateString();
      return `<div class="${isToday ? 'today' : ''}">${names[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}  <span class="lit">${'█'.repeat(n)}</span><span class="dim">${'·'.repeat(W - n)}</span>  ${min ? fmtDur(min) : '<span class="dim">—</span>'}</div>`;
    }).join('');

    const week = days.reduce((a, x) => a + x.min, 0);
    const total = log.reduce((a, s) => a + s.min, 0);
    let streak = 0;
    for (let i = 0; ; i++) {
      const k = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      if (log.some((s) => dayKey(s.t) === k)) streak++;
      else if (i > 0) break;
      if (i > 3650) break;
    }
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const recent = log.slice(-8).reverse().map((s) => {
      const d = new Date(s.t);
      const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<div><span class="dim">${d.toDateString() === now.toDateString() ? 'today' : names[d.getDay()] + '  '} ${t}</span>  ${String(s.min).padStart(3)}m  ${s.task ? esc(s.task) : '<span class="dim">untitled</span>'}</div>`;
    }).join('') || '<div class="dim">no sessions yet. start one.</div>';

    $('#log-body').innerHTML =
      `<div class="bars">${bars}</div>` +
      `<div class="totals">week ${fmtDur(week)}  ·  all time ${fmtDur(total)}  ·  streak ${streak} day${streak === 1 ? '' : 's'}</div>` +
      `<div class="sub">recent</div><div class="recent">${recent}</div>`;
  }

  $('#btn-clear').addEventListener('click', () => {
    if (!log.length) return;
    if (confirm('clear the whole session log?')) { log = []; Store.set('log', log); renderLog(); render(); }
  });

  // ---------- overlays ----------
  let overlay = null;
  function openOverlay(name) {
    closeOverlay();
    overlay = name;
    if (name === 'settings') renderSettings();
    if (name === 'log') renderLog();
    const el = $('#ov-' + name);
    el.hidden = false;
    scrambleText(el.querySelector('.title'), el.querySelector('.title').dataset.t);
  }
  function closeOverlay() {
    if (!overlay) return;
    $('#ov-' + overlay).hidden = true;
    overlay = null;
  }
  document.querySelectorAll('.overlay').forEach((ov) => ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) closeOverlay();
  }));

  // ---------- input ----------
  $('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.mode !== state.mode) setMode(b.dataset.mode);
  });
  presetsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setDuration(+b.dataset.min);
  });
  startBtn.addEventListener('click', toggle);
  $('#btn-reset').addEventListener('click', reset);
  $('#btn-skip').addEventListener('click', skip);
  $('#btn-settings').addEventListener('click', () => openOverlay('settings'));
  $('#btn-log').addEventListener('click', () => openOverlay('log'));
  $('#btn-help').addEventListener('click', () => openOverlay('help'));
  clockEl.addEventListener('click', toggle);
  clockEl.addEventListener('wheel', (e) => {
    if (state.running) return;
    e.preventDefault();
    adjust(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  taskEl.value = Store.get('task', '');
  taskEl.addEventListener('input', () => Store.set('task', taskEl.value));
  taskEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') { taskEl.blur(); e.stopPropagation(); }
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }

  function cycle(key, list) {
    settings[key] = list[(list.indexOf(settings[key]) + 1) % list.length];
    saveSettings();
    applySettings();
    flash(`${key === 'theme' ? 'phosphor' : 'glyphs'}: ${settings[key]}`);
  }

  let flashTimer = 0;
  function flash(msg) {
    const el = $('#toast');
    el.classList.add('show');
    scrambleText(el, msg);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.activeElement === taskEl) return;
    const k = e.key;

    if (overlay) {
      if (k === 'Escape' || (k === 's' && overlay === 'settings') || (k === 'l' && overlay === 'log') || (k === '?' && overlay === 'help')) {
        closeOverlay(); e.preventDefault(); return;
      }
      if (overlay === 'settings') {
        if (k === 'ArrowDown' || k === 'j') { cursor = (cursor + 1) % rows.length; renderSettings(); }
        else if (k === 'ArrowUp' || k === 'k') { cursor = (cursor - 1 + rows.length) % rows.length; renderSettings(); }
        else if (k === 'ArrowRight' || k === 'l' || k === '+' || k === '=') changeSetting(rows[cursor], 1, e.shiftKey);
        else if (k === 'ArrowLeft' || k === 'h' || k === '-') changeSetting(rows[cursor], -1, e.shiftKey);
        else if (k === ' ' || k === 'Enter') changeSetting(rows[cursor], 1, false);
        else return;
        e.preventDefault();
      }
      return;
    }

    switch (k) {
      case ' ': case 'Enter': toggle(); break;
      case 'r': reset(); break;
      case 'n': skip(); break;
      case 'ArrowUp': adjust(e.shiftKey ? 5 : 1); break;
      case 'ArrowDown': adjust(e.shiftKey ? -5 : -1); break;
      case '1': setMode('focus'); break;
      case '2': setMode('short'); break;
      case '3': setMode('long'); break;
      case 'f': toggleFullscreen(); break;
      case 'm': settings.sound = !settings.sound; saveSettings(); flash(settings.sound ? 'sound on' : 'sound off'); break;
      case 't': taskEl.focus(); break;
      case 'c': cycle('theme', THEMES); break;
      case 'g': cycle('glyphs', GLYPHS); break;
      case 's': openOverlay('settings'); break;
      case 'l': openOverlay('log'); break;
      case '?': openOverlay('help'); break;
      default: return;
    }
    e.preventDefault();
    showUI();
  });

  // zen: fade the interface when the mouse rests while running
  let zenTimer = 0;
  function showUI() {
    document.body.classList.remove('zen');
    clearTimeout(zenTimer);
    zenTimer = setTimeout(() => {
      if (state.running && !overlay && document.activeElement !== taskEl) document.body.classList.add('zen');
    }, 3500);
  }
  ['mousemove', 'mousedown', 'touchstart'].forEach((ev) => document.addEventListener(ev, showUI, { passive: true }));

  window.addEventListener('resize', () => { clock.fit(); sizeProgress(); renderClock(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // ---------- boot ----------
  applySettings();
  if (state.running && state.endAt <= Date.now()) {
    // finished while the app was closed
    complete(true, true);
  }
  clock.set(fmt(remainingNow()), { instant: false });
  lastShown = fmt(remainingNow());
  sizeProgress();
  render();
  showUI();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
