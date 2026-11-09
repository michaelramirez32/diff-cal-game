/* Shared settings panel + helpers.
   Page needs:  <link rel="stylesheet" href="settings.css">  and  <script src="settings.js"></script>  (BEFORE pause.js / game scripts). */
(function () {
  const KEY = 'cc_settings', D = { sfx: .5, music: .6, vibration: .7, mute: false };
  const CC = window.CC = window.CC || {};
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  CC.settings = Object.assign({}, D, saved);
  CC.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(CC.settings)); } catch (e) {}
    document.querySelectorAll('audio,video').forEach(a => a.volume = CC.settings.mute ? 0 : CC.settings.music);
    window.dispatchEvent(new CustomEvent('cc:settings', { detail: CC.settings }));
  };
  CC.vibrate = (ms = 30) => { const v = CC.settings.vibration; if (v > 0 && navigator.vibrate) navigator.vibrate(Math.round(ms * v)); };
  let ac;
  CC.click = () => {
    CC.vibrate(); const s = CC.settings; if (s.mute || !s.sfx) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = 520; g.gain.value = .08 * s.sfx;
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .07);
    } catch (e) {}
  };
  // positions below are in 1920x1080 reference pixels -> converted to %
  const place = (el, [x1, y1, x2, y2]) => Object.assign(el.style, {
    left: x1 / 19.2 + '%', top: y1 / 10.8 + '%', width: (x2 - x1) / 19.2 + '%', height: (y2 - y1) / 10.8 + '%' });
  CC.settingsPanel = function (root, onExit, base = 'assets/') {
    root.innerHTML = `<div class="ccs-stage"><img src="${base}tomb.png" alt=""><button class="ccs-exit" aria-label="Exit"><img src="${base}exit.png" alt="EXIT"></button></div>`;
    const stage = root.firstChild;
    stage.querySelector('.ccs-exit').onclick = () => { CC.click(); onExit && onExit(); };
    const rows = { sfx: [914, 336, 1450, 446], music: [969, 483, 1505, 591], vibration: [1131, 628, 1582, 723] };
    Object.entries(rows).forEach(([k, box]) => {
      const sl = document.createElement('div'); sl.className = 'ccs-sl'; sl.tabIndex = 0;
      sl.setAttribute('role', 'slider'); sl.setAttribute('aria-label', k);
      sl.innerHTML = '<div class="ccs-line"></div><div class="ccs-h"></div>'; place(sl, box); stage.appendChild(sl);
      const h = sl.querySelector('.ccs-h');
      const draw = () => { h.style.left = CC.settings[k] * 89.2 + '%'; sl.setAttribute('aria-valuenow', Math.round(CC.settings[k] * 100)); };
      const set = e => { const r = sl.getBoundingClientRect(); CC.settings[k] = Math.min(1, Math.max(0, (e.clientX - r.left - r.width * .054) / (r.width * .892))); draw(); CC.save(); };
      sl.onpointerdown = e => { sl.setPointerCapture(e.pointerId); set(e); sl.onpointermove = set; };
      sl.onpointerup = () => { sl.onpointermove = null; if (k === 'sfx') CC.click(); if (k === 'vibration') CC.vibrate(60); };
      sl.onkeydown = e => { const d = e.key === 'ArrowRight' ? .05 : e.key === 'ArrowLeft' ? -.05 : 0;
        if (d) { CC.settings[k] = Math.min(1, Math.max(0, CC.settings[k] + d)); draw(); CC.save(); } };
      draw();
    });
    const tg = document.createElement('button'); tg.className = 'ccs-tg'; tg.innerHTML = '<i></i>'; tg.setAttribute('aria-label', 'Mute');
    place(tg, [905, 781, 1118, 877]); stage.appendChild(tg);
    const t = () => tg.classList.toggle('on', CC.settings.mute);
    tg.onclick = () => { CC.settings.mute = !CC.settings.mute; t(); CC.save(); CC.click(); }; t();
  };
  CC.save();
})();
