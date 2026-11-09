/* =========================================================
   Calculus Adventure - HOME SCREEN script (home.js)
   Needs settings.js loaded first (CC.click, CC.settingsPanel).
   ========================================================= */
const GAME = 'game.html';          // the page START opens after loading
const $ = id => document.getElementById(id);

/* ---------- menu buttons ---------- */
$('start').onclick = () => {
  CC.click(); $('loading').classList.add('on');
  const t0 = performance.now(), DURATION = 2600;
  (function tick(t) {
    const p = Math.min(1, (t - t0) / DURATION);
    $('fill').style.width = p * 100 + '%';
    p < 1 ? requestAnimationFrame(tick) : setTimeout(() => location.href = GAME, 250);
  })(t0);
};
$('settings').onclick = () => {
  CC.click(); $('setov').classList.add('on');
  CC.settingsPanel($('setov'), () => $('setov').classList.remove('on'));
};
$('quitbtn').onclick = () => { CC.click(); $('quit').classList.add('on'); setTimeout(() => window.close(), 400); };   // browsers often block window.close()
$('quit').onclick = () => $('quit').classList.remove('on');
addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('setov').classList.remove('on'); $('quit').classList.remove('on'); }
});

/* ---------- animation effects (skipped if the player prefers reduced motion) ---------- */
if (!matchMedia('(prefers-reduced-motion:reduce)').matches) {

  /* castle windows: [left%, top%, width%, height%, darkColor] */
  const WINDOWS = [
  [93.073, 32.685, 0.417, 0.741, '#11123e'],
  [91.458, 33.148, 0.417, 0.741, '#11123e'],
  [94.479, 33.148, 0.417, 0.741, '#11123f'],
  [83.073, 37.222, 0.365, 0.741, '#0b1236'],
  [82.135, 39.352, 0.417, 2.037, '#0b1236'],
  [82.552, 39.352, 0.677, 1.944, '#0b1236'],
  [83.490, 39.352, 0.417, 2.037, '#0b1236'],
  [84.010, 39.352, 0.417, 2.037, '#0b1236'],
  [83.021, 43.519, 0.417, 2.037, '#2d2249'],
  [82.344, 43.889, 0.417, 1.667, '#1b193e'],
  [83.750, 43.889, 0.417, 1.667, '#0c1437'],
  [83.281, 48.519, 0.417, 1.944, '#0a1537'],
  [84.479, 48.519, 0.365, 1.944, '#0a1537'],
  [84.896, 48.519, 0.469, 1.944, '#0a1436'],
  [85.365, 48.519, 0.417, 1.944, '#0b1437'],
  [80.729, 48.889, 0.365, 1.574, '#0d193d'],
  [81.198, 48.889, 0.365, 1.574, '#2b224c'],
  [81.667, 48.889, 0.365, 1.574, '#11163d'],
  [82.812, 48.889, 0.417, 1.574, '#0b1538'],
  [80.729, 53.056, 0.417, 2.037, '#101335'],
  [81.198, 53.056, 0.365, 2.037, '#121235'],
  [81.667, 53.056, 0.365, 2.037, '#101437'],
  [82.812, 53.056, 0.417, 2.037, '#0f1537'],
  [83.281, 53.148, 0.417, 1.667, '#0d1537'],
  [92.135, 57.222, 0.469, 1.574, '#101842'],
  [85.833, 58.519, 0.677, 2.778, '#141431'],
  [87.708, 58.519, 0.677, 2.778, '#081431'],
  [83.281, 58.889, 0.417, 0.741, '#0e0e29'],
  [90.521, 58.889, 0.365, 0.741, '#081430'],
  [71.875, 61.944, 0.365, 1.389, '#14123b'],
  [77.656, 65.185, 0.469, 1.852, '#0f0d28'],
  [78.385, 65.185, 0.417, 1.852, '#0e0d28'],
  [80.260, 65.185, 0.625, 1.852, '#110f2a'],
  [93.333, 65.185, 0.365, 1.852, '#010206'],
  [80.990, 65.278, 0.365, 1.759, '#110f2a'],
  [76.302, 65.556, 0.417, 1.481, '#0d0d28'],
  [77.448, 68.426, 0.417, 0.741, '#0d0d28'],
  [78.646, 68.426, 0.365, 0.741, '#0e0e28'],
  [80.000, 68.426, 0.417, 0.741, '#0d0d28'],
  [81.406, 68.426, 0.417, 0.741, '#0e0d28'],
  [92.396, 68.426, 0.365, 0.741, '#110f2b'],
  [93.542, 68.426, 0.417, 0.741, '#0c1632'],
  [78.177, 70.556, 0.365, 0.741, '#0c0d27'],
  [80.729, 70.556, 0.365, 0.741, '#0c0d27'],
  [93.073, 70.556, 0.417, 0.741, '#0c0d27'],
  [76.302, 71.389, 0.417, 1.574, '#0c0d27']
];
  const stage = $('stage'), fogEl = document.querySelector('.fog');
  const setWin = (w, state) => {
    if (state === 'off')       { w.style.background = w.style.getPropertyValue('--d'); w.style.boxShadow = 'none'; w.style.mixBlendMode = 'normal'; w.style.opacity = .9; }
    else if (state === 'glow') { w.style.background = '#ffc27a'; w.style.mixBlendMode = 'screen'; w.style.boxShadow = '0 0 .8cqw #ff9a3c'; w.style.opacity = .85; }
    else                       { w.style.opacity = 0; w.style.boxShadow = 'none'; }
  };
  WINDOWS.forEach(([l, t, w, h, dark]) => {
    const el = document.createElement('div');
    el.className = 'fx win';
    el.style.cssText = `left:${l}%;top:${t}%;width:${w}%;height:${h}%;--d:${dark}`;
    stage.insertBefore(el, fogEl);                       // keep windows under fog/bats/buttons
    setWin(el, 'on');
    (function flicker() {
      const r = Math.random();
      setWin(el, r < .12 ? 'off' : r < .35 ? 'glow' : 'on');
      setTimeout(flicker, 700 + Math.random() * 3200);
    })();
  });

  /* bats flying across the sky */
  const BAT = '<svg viewBox="0 0 60 30"><path d="M30 14C26 6 16 2 2 4c6 4 8 10 10 16 4-6 10-6 14-2 2-2 3-3 4-2 1-1 2 0 4 2 4-4 10-4 14 2 2-6 4-12 10-16C44 2 34 6 30 14z"/></svg>';
  const batBox = $('bats');
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'fx bat'; el.innerHTML = BAT;
    el.style.width = (2.2 + Math.random() * 2.2) + 'cqw';
    batBox.appendChild(el);
    const y = 4 + Math.random() * 34, dur = 14000 + Math.random() * 12000, dy = (Math.random() - .5) * 14;
    const flip = i % 2, a = flip ? [108, -10] : [-10, 108];      // fly left or right
    el.firstChild.style.transform = flip ? 'scaleX(-1)' : '';
    el.animate([
      { transform: `translate(${a[0]}cqw,${y}cqw)` },
      { transform: `translate(${(a[0] + a[1]) / 2}cqw,${y + dy}cqw)`, offset: .5 },
      { transform: `translate(${a[1]}cqw,${y + dy * .3}cqw)` }
    ], { duration: dur, iterations: Infinity, delay: -Math.random() * dur });
  }

  /* ---- drips under the title ---- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dripBox = document.querySelector('.drips');
  if (dripBox) {
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('span');
      d.className = 'drip';
      d.style.left = rnd(20, 76).toFixed(2) + '%';
      d.style.height = rnd(25, 100).toFixed(0) + '%';
      d.style.width = rnd(3, 6).toFixed(1) + 'px';
      d.style.setProperty('--t', rnd(4, 8).toFixed(2) + 's');
      d.style.setProperty('--d', (-rnd(0, 8)).toFixed(2) + 's');
      dripBox.appendChild(d);
    }
  }

  /* ---- floating particles (canvas uses 1920x1080 coordinates) ---- */
  const cv = document.querySelector('.particles');
  if (cv) {
    const ctx = cv.getContext('2d');
    cv.width = 1920; cv.height = 1080;
    const spawn = first => ({ x: rnd(0, 1920), y: first ? rnd(0, 1080) : 1080 + rnd(0, 40),
      r: rnd(1, 2.6), vy: rnd(8, 26), vx: rnd(-6, 6), a: rnd(.25, .8), ph: rnd(0, 6.283) });
    const motes = Array.from({ length: 42 }, () => spawn(true));
    let last = performance.now();
    (function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, 1920, 1080);
      ctx.fillStyle = '#bff3ff'; ctx.shadowColor = '#7ee8ff'; ctx.shadowBlur = 10;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.y -= m.vy * dt;
        m.x += (m.vx + Math.sin(now / 900 + m.ph) * 8) * dt;
        if (m.y < -10) motes[i] = spawn(false);
        ctx.globalAlpha = m.a * (.6 + .4 * Math.sin(now / 500 + m.ph));
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      requestAnimationFrame(frame);
    })(last);
  }
}
