/* =========================================================
   Calculus Adventure - GAME script (game.js)
   Needs settings.js + pause.js loaded first (CC, CCPause).
   Level 1: graveyard + portal.  Canvas is 1920x1080 and is scaled by CSS.
   Hooks for later (enemies, coins...):  window.Game  (see bottom of file)
   ========================================================= */
(() => {
  'use strict';
  const W = 1920, H = 1080, A = 'assets/game/';
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  cv.width = W; cv.height = H;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;

  /* ---------------- level data ---------------- */
  const PORTAL = { cx: 300, cy: 630, rx: 68, ry: 232 };          // the swirl lives inside this ellipse
  const SOLIDS = [                                                // walkable blocks (match the artwork)
    { x: 0,   y: 873, w: 590,  h: 400 },                          // raised platform (left, under the portal)
    { x: 590, y: 972, w: 1330, h: 300 }                           // graveyard ground (right)
  ];
  const FOOT = 5;                                                 // feet sink a little into the tile top
  const SPAWN = { x: 345, y: 873 + FOOT };

  /* ---------------- HUD layout (1920x1080 design pixels, from your PLAY screenshot) ---------------- */
  const HUD = {
    health: { x: 15, y: 20 }, slotX: 156, slotY: 45, slotPitch: 72, pad: 3, maxHearts: 4,
    coin: { x: 48, y: 158 },
    map: { x: 1592, y: 172, ix: 60, iy: 62, iw: 210, ih: 214 },   // ix/iy/iw/ih = inside of the frame
    scroll: { x: 1622, y: 38 },
    gear: { x: 1752, y: 58, w: 118, h: 107 }
  };

  /* ---------------- assets ---------------- */
  const IMG = {};
  const NAMES = ['bg', 'king-run', 'hud_health', 'heart_full', 'heart_empty', 'hud_coin', 'hud_map', 'hud_scroll', 'hud_gear'];
  const loadImg = n => new Promise(res => {
    const i = new Image(); i.onload = () => res(IMG[n] = i); i.onerror = () => res(IMG[n] = null); i.src = A + n + '.png';
  });

  /* ---------------- sound (uses the Settings panel volumes) ---------------- */
  let ac;
  function beep(f0, f1, dur, vol = .12, type = 'square') {
    const s = CC.settings; if (!s || s.mute || !s.sfx) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(vol * s.sfx, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) {}
  }
  const sfx = {
    jump: () => beep(260, 620, .13, .10),
    land: () => beep(150, 60, .08, .10, 'triangle'),
    hurt: () => { beep(220, 70, .28, .16, 'sawtooth'); CC.vibrate && CC.vibrate(120); },
    heal: () => { beep(440, 880, .18, .12, 'sine'); setTimeout(() => beep(660, 1320, .18, .1, 'sine'), 90); },
    spawn: () => beep(90, 520, .6, .1, 'sine'),
    dead: () => { beep(300, 40, .8, .16, 'sawtooth'); CC.vibrate && CC.vibrate(300); }
  };

  /* ---------------- input ---------------- */
  const keys = Object.create(null);
  const held = { left: false, right: false, jump: false };       // touch buttons write here
  const isL = () => keys.ArrowLeft || keys.KeyA || held.left;
  const isR = () => keys.ArrowRight || keys.KeyD || held.right;
  const isJ = () => keys.Space || keys.ArrowUp || keys.KeyW || held.jump;
  let jumpPressedAt = -9;
  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jumpPressedAt = G.T;
      if (e.code === 'KeyH') Game.damage(1);                       // test keys until enemies exist
      if (e.code === 'KeyJ') Game.heal(1);
      if (e.code === 'Enter' && G.state === 'dead' && G.deadT > 1) Game.restart();
    }
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; held.left = held.right = held.jump = false; });

  /* ---------------- game state ---------------- */
  const G = { T: 0, state: 'spawn', paused: false, spawnT: 0, deadT: 0, shake: 0, flash: 0, lightning: 0 };
  const P = {
    x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, hw: 26, h: 150, face: 1, onGround: true, coyote: 0,
    anim: 0, frame: 0, hp: 4, maxHp: 4, invuln: 0, alpha: 0, scale: 1, wasGround: true, step: 0
  };
  const pop = [0, 0, 0, 0, 0, 0, 0, 0];                            // heart "pop" animations
  let mapAngle = Math.PI / 2;

  /* ---------------- physics ---------------- */
  const GRAV = 2900, RUN = 430, ACC = 3600, FRIC = 3000, JUMP = 1010;
  function overlapX(s) { return P.x + P.hw > s.x && P.x - P.hw < s.x + s.w; }
  function updatePlayer(dt) {
    const canMove = G.state === 'play';
    const dir = canMove ? (isR() ? 1 : 0) - (isL() ? 1 : 0) : 0;
    if (dir) { P.vx += dir * ACC * dt; P.face = dir; }
    else { const f = FRIC * dt; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f; }
    P.vx = clamp(P.vx, -RUN, RUN);

    // jump (with a little coyote time + input buffer so it feels good)
    P.coyote = P.onGround ? .1 : P.coyote - dt;
    if (canMove && G.T - jumpPressedAt < .12 && P.coyote > 0) {
      P.vy = -JUMP; P.onGround = false; P.coyote = 0; jumpPressedAt = -9; sfx.jump(); dust(P.x, P.y, 6);
    }
    if (!isJ() && P.vy < -380) P.vy *= Math.pow(.0005, dt);        // let go early = shorter hop
    P.vy = Math.min(P.vy + GRAV * dt, 1800);

    // horizontal move + wall collision
    P.x += P.vx * dt;
    for (const s of SOLIDS) {
      const top = s.y + FOOT;
      if (overlapX(s) && P.y > top && P.y - P.h < s.y + s.h) {
        if (P.vx > 0 || P.x < s.x) P.x = s.x - P.hw; else P.x = s.x + s.w + P.hw;
        P.vx = 0;
      }
    }
    P.x = clamp(P.x, P.hw, W - P.hw);

    // vertical move + floor / ceiling
    P.y += P.vy * dt; P.onGround = false;
    for (const s of SOLIDS) {
      const top = s.y + FOOT;
      if (overlapX(s) && P.y > top && P.y - P.h < s.y + s.h) {
        if (P.vy >= 0) { P.y = top; P.vy = 0; P.onGround = true; }
        else { P.y = s.y + s.h + P.h; P.vy = 0; }
      }
    }
    if (P.onGround && !P.wasGround) { sfx.land(); dust(P.x, P.y, 8); }
    P.wasGround = P.onGround;

    // animation
    const sp = Math.abs(P.vx);
    if (P.onGround && sp > 40) {
      P.anim += dt * (7 + sp / 55);
      const f = Math.floor(P.anim) % 7;
      if (f !== P.frame && (f === 0 || f === 3)) dust(P.x - P.face * 10, P.y, 2);
      P.frame = f;
    } else if (!P.onGround) P.frame = P.vy < 0 ? 2 : 5;
    else { P.frame = 0; P.anim = 0; }

    P.invuln = Math.max(0, P.invuln - dt);
  }

  /* ---------------- particles: dust, portal sparks, ash, wisps, stars, bats ---------------- */
  const dusts = [];
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) dusts.push({ x: x + rnd(-14, 14), y: y - 2, vx: rnd(-50, 50), vy: rnd(-70, -15), life: 0, max: rnd(.35, .6), r: rnd(3, 7) });
  }
  const sparks = Array.from({ length: 34 }, () => newSpark(true));
  function newSpark(first) {
    return { a: rnd(0, TAU), r: first ? rnd(.1, 1) : rnd(.85, 1.15), w: rnd(1.2, 2.6) * (Math.random() < .5 ? 1 : -1), s: rnd(.12, .3), size: rnd(1.5, 3.2),
             esc: Math.random() < .25, up: 0 };
  }
  const stars = Array.from({ length: 46 }, () => ({ x: rnd(0, W), y: rnd(0, 640), r: rnd(1, 2.6), p: rnd(0, TAU), s: rnd(.8, 2.4) }));
  const ash = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, H), vy: rnd(14, 42), vx: rnd(-10, 6), r: rnd(1, 2.4), p: rnd(0, TAU), a: rnd(.15, .5) }));
  const wisps = Array.from({ length: 14 }, () => ({ x: rnd(620, 1800), y: rnd(780, 950), p: rnd(0, TAU), s: rnd(.25, .7), r: rnd(2.5, 4.5), hue: Math.random() < .5 ? 190 : 270 }));
  const bats = Array.from({ length: 4 }, (_, i) => ({ x: rnd(0, W), y: rnd(70, 420), v: rnd(90, 160) * (i % 2 ? -1 : 1), p: rnd(0, TAU), amp: rnd(20, 60), sc: rnd(.7, 1.25) }));
  let shoot = null, nextShoot = rnd(5, 9), nextBolt = rnd(10, 20);

  /* ---------------- pre-rendered helpers: fog + vignette ---------------- */
  function makeFog() {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 400; const x = c.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const px = rnd(0, 1920), py = rnd(170, 230), r = rnd(80, 165);
      for (const o of [-1920, 0, 1920]) {
        const g = x.createRadialGradient(px + o, py, 0, px + o, py, r);
        g.addColorStop(0, 'rgba(170,160,205,.34)'); g.addColorStop(1, 'rgba(170,160,205,0)');
        x.fillStyle = g; x.fillRect(px + o - r, py - r, r * 2, r * 2);
      }
    }
    return c;
  }
  const fog = makeFog();
  const vig = (() => {
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d');
    const g = x.createRadialGradient(480, 270, 180, 480, 270, 620);
    g.addColorStop(0, 'rgba(8,3,22,0)'); g.addColorStop(1, 'rgba(8,3,22,.62)'); x.fillStyle = g; x.fillRect(0, 0, 960, 540); return c;
  })();

  /* ---------------- update ---------------- */
  function update(dt) {
    G.T += dt;
    if (G.state === 'spawn') {                                      // king steps out of the portal
      G.spawnT += dt; const k = clamp(G.spawnT / 1.1, 0, 1);
      P.alpha = k; P.scale = .55 + .45 * k;
      if (G.spawnT > 1.1) { G.state = 'play'; P.alpha = 1; P.scale = 1; }
    }
    if (G.state === 'dead') { G.deadT += dt; P.alpha = Math.max(0, 1 - G.deadT * 1.2); P.vx *= .9; }
    updatePlayer(dt);
    G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt * 1.8); G.lightning = Math.max(0, G.lightning - dt);
    for (let i = 0; i < pop.length; i++) pop[i] = Math.max(0, pop[i] - dt * 2.2);

    for (let i = dusts.length - 1; i >= 0; i--) { const d = dusts[i]; d.life += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 60 * dt; if (d.life > d.max) dusts.splice(i, 1); }
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i]; s.a += s.w * dt;
      if (s.esc) { s.up += dt * 70; s.r -= s.s * dt * .3; } else s.r -= s.s * dt;
      if (s.r < .03 || s.up > 260) sparks[i] = newSpark(false);
    }
    for (const a of ash) { a.y += a.vy * dt; a.x += (a.vx + Math.sin(G.T * .8 + a.p) * 12) * dt; if (a.y > H + 6) { a.y = -6; a.x = rnd(0, W); } if (a.x < -6) a.x = W + 6; }
    for (const b of bats) { b.x += b.v * dt; if (b.v > 0 && b.x > W + 90) { b.x = -90; b.y = rnd(70, 420); } if (b.v < 0 && b.x < -90) { b.x = W + 90; b.y = rnd(70, 420); } }
    nextShoot -= dt; if (nextShoot < 0) { shoot = { x: rnd(300, 1400), y: rnd(30, 220), t: 0 }; nextShoot = rnd(9, 18); }
    if (shoot) { shoot.t += dt; if (shoot.t > .8) shoot = null; }
    nextBolt -= dt; if (nextBolt < 0) { G.lightning = .55; nextBolt = rnd(14, 30); }
    mapAngle += (angDiff((P.face > 0 ? 1 : -1) * Math.PI / 2, mapAngle)) * Math.min(1, dt * 12);
  }
  const angDiff = (t, c) => { let d = (t - c) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  /* ---------------- drawing: world ---------------- */
  function drawStars() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = .15 + .6 * Math.max(0, Math.sin(G.T * s.s + s.p));
      ctx.fillStyle = `rgba(200,220,255,${a})`; ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
    }
    if (shoot) {
      const k = shoot.t / .8, x = shoot.x + k * 520, y = shoot.y + k * 190, a = Math.sin(k * Math.PI);
      const g = ctx.createLinearGradient(x - 120, y - 44, x, y); g.addColorStop(0, 'rgba(180,210,255,0)'); g.addColorStop(1, `rgba(230,240,255,${a})`);
      ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 120, y - 44); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBat(b) {
    const flap = Math.sin(G.T * 11 + b.p), y = b.y + Math.sin(G.T * .7 + b.p) * b.amp;
    ctx.save(); ctx.translate(b.x, y); ctx.scale(b.sc * (b.v < 0 ? -1 : 1), b.sc); ctx.fillStyle = 'rgba(10,6,20,.92)';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-6, -17); ctx.lineTo(0, -11); ctx.lineTo(6, -17); ctx.lineTo(3, -9); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.rotate(-flap * .5);
      ctx.beginPath(); ctx.moveTo(5, -4);
      ctx.quadraticCurveTo(26, -34 * (.6 + .4 * flap), 56, -14 * flap - 4);
      ctx.quadraticCurveTo(44, 0, 40, 10 + 6 * flap); ctx.quadraticCurveTo(30, 2, 24, 14); ctx.quadraticCurveTo(16, 2, 8, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function drawFog(y, alpha, speed, flip, clipGround) {
    ctx.save();
    if (clipGround) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 972); ctx.lineTo(590, 972); ctx.lineTo(590, 873); ctx.lineTo(0, 873); ctx.closePath(); ctx.clip(); }
    ctx.globalAlpha = alpha * (.85 + .15 * Math.sin(G.T * .4 + y));
    const off = ((G.T * speed) % 1920 + 1920) % 1920;
    if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(fog, -off, y - 200); ctx.drawImage(fog, 1920 - off, y - 200);
    ctx.restore();
  }
  function drawPortal() {
    const { cx, cy, rx, ry } = PORTAL, T = G.T, pulse = .78 + .22 * Math.sin(T * 2.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(cx, cy, 30, cx, cy, 400);                       // halo around the arch
    g.addColorStop(0, `rgba(150,100,255,${.20 * pulse})`); g.addColorStop(1, 'rgba(80,40,200,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 400, cy - 400, 800, 800);
    g = ctx.createRadialGradient(cx + 30, 880, 4, cx + 30, 880, 270);                  // light on the floor
    g.addColorStop(0, `rgba(160,110,255,${.34 * pulse})`); g.addColorStop(1, 'rgba(100,60,220,0)');
    ctx.save(); ctx.beginPath(); ctx.rect(0, 800, 590, 73); ctx.clip(); ctx.translate(0, 880); ctx.scale(1, .16); ctx.translate(0, -880);
    ctx.fillStyle = g; ctx.fillRect(cx - 240, 600, 540, 560); ctx.restore();
    ctx.restore();

    // ---- swirl inside the ellipse ----
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx - 3, ry - 3, 0, 0, TAU); ctx.clip();
    ctx.translate(cx, cy); ctx.scale(1, ry / rx);                                      // from here on the portal is a circle of radius rx
    let bgG = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    bgG.addColorStop(0, 'rgba(120,70,255,.38)'); bgG.addColorStop(.45, 'rgba(60,25,150,.30)'); bgG.addColorStop(1, 'rgba(20,6,70,.15)');
    ctx.fillStyle = bgG; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.globalCompositeOperation = 'lighter';
    const R = rx * 1.25, arms = 4;
    for (let a = 0; a < arms; a++) {                                                    // spiral arms
      const rot = T * 1.5 + a * TAU / arms;
      for (const [lw, al, col] of [[11, .10, '150,100,255'], [5, .28, '190,150,255'], [1.8, .7, '235,215,255']]) {
        ctx.beginPath();
        for (let i = 0; i <= 44; i++) {
          const k = i / 44, r = R * Math.pow(k, .85), th = rot + k * 5.2;
          const px = Math.cos(th) * r, py = Math.sin(th) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(${col},${al * pulse})`; ctx.stroke();
      }
    }
    for (let i = 0; i < 5; i++) {                                                       // rings being pulled in
      const f = ((T * .32 + i / 5) % 1), r = rx * (1 - f);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(200,170,255,${.35 * Math.sin(f * Math.PI)})`; ctx.stroke();
    }
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * .55);                       // glowing core
    cg.addColorStop(0, `rgba(235,220,255,${.75 * pulse})`); cg.addColorStop(.35, `rgba(170,120,255,${.35 * pulse})`); cg.addColorStop(1, 'rgba(100,50,220,0)');
    ctx.fillStyle = cg; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    for (const s of sparks) {                                                           // sparks spiraling in / floating out
      const r = s.r * rx, x = Math.cos(s.a) * r, y = Math.sin(s.a) * r - (s.esc ? s.up / (ry / rx) : 0);
      ctx.fillStyle = `rgba(235,220,255,${clamp(s.r * 1.2, 0, .9) * (s.esc ? clamp(1 - s.up / 260, 0, 1) : 1)})`; ctx.fillRect(x - s.size / 2, y - s.size / 2, s.size, s.size);
    }
    ctx.restore();

    ctx.save(); ctx.globalCompositeOperation = 'lighter';                               // glowing rim
    ctx.beginPath(); ctx.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = `rgba(150,110,255,${.45 * pulse})`;
    ctx.shadowColor = '#9a6bff'; ctx.shadowBlur = 24; ctx.stroke(); ctx.restore();
  }
  function drawWisps() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const w of wisps) {
      const x = w.x + Math.sin(G.T * w.s + w.p) * 50, y = w.y + Math.cos(G.T * w.s * 1.3 + w.p) * 28, a = .35 + .4 * Math.sin(G.T * 1.7 + w.p);
      const g = ctx.createRadialGradient(x, y, 0, x, y, w.r * 5);
      g.addColorStop(0, `hsla(${w.hue},100%,80%,${a})`); g.addColorStop(1, `hsla(${w.hue},100%,60%,0)`);
      ctx.fillStyle = g; ctx.fillRect(x - w.r * 5, y - w.r * 5, w.r * 10, w.r * 10);
    }
    ctx.restore();
  }
  function drawPlayer() {
    const img = IMG['king-run']; if (!img || P.alpha <= 0) return;
    const S = .8 * P.scale, flicker = P.invuln > 0 && G.state !== 'dead' && Math.floor(G.T * 18) % 2 === 0;
    let floor = 1e9; for (const s of SOLIDS) if (overlapX(s) && s.y + FOOT >= P.y - 1) floor = Math.min(floor, s.y + FOOT);
    if (floor > 5000) floor = P.y;
    const hgt = clamp((floor - P.y) / 300, 0, 1);
    ctx.save(); ctx.globalAlpha = P.alpha * .35 * (1 - hgt * .6);
    ctx.fillStyle = '#05020d'; ctx.beginPath(); ctx.ellipse(P.x, floor - 2, 34 * (1 - hgt * .4), 7, 0, 0, TAU); ctx.fill(); ctx.restore();

    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = P.alpha * (flicker ? .35 : 1);
    const bob = P.onGround && Math.abs(P.vx) < 40 ? Math.sin(G.T * 3) * 1.2 : 0;
    ctx.translate(P.x, P.y + bob); ctx.scale(P.face * S, S);
    ctx.drawImage(img, P.frame * 212, 0, 212, 197, -172, -197, 212, 197);
    ctx.restore();
    if (G.state === 'spawn') {                                                          // portal flash while appearing
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(P.x, P.y - 70, 0, P.x, P.y - 70, 140); g.addColorStop(0, `rgba(190,150,255,${.5 * (1 - P.alpha)})`); g.addColorStop(1, 'rgba(120,60,255,0)');
      ctx.fillStyle = g; ctx.fillRect(P.x - 140, P.y - 210, 280, 280); ctx.restore();
    }
  }
  function drawDust() {
    for (const d of dusts) { const k = d.life / d.max; ctx.fillStyle = `rgba(190,175,225,${.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1 + k), 0, TAU); ctx.fill(); }
  }
  function drawAsh() {
    ctx.save(); ctx.fillStyle = '#cfd8ff';
    for (const a of ash) { ctx.globalAlpha = a.a * (.6 + .4 * Math.sin(G.T * 2 + a.p)); ctx.fillRect(a.x, a.y, a.r, a.r); }
    ctx.restore();
  }

  /* ---------------- drawing: HUD ---------------- */
  const hov = { gear: 0, gearOn: false };
  function drawHUD() {
    const hs = HUD.health;
    IMG.hud_health && ctx.drawImage(IMG.hud_health, hs.x, hs.y);
    for (let i = 0; i < HUD.maxHearts; i++) {
      if (i >= P.maxHp) continue;
      const full = i < P.hp, im = full ? IMG.heart_full : IMG.heart_empty; if (!im) continue;
      let sc = 1 + pop[i] * .45; if (full && P.hp === 1 && i === 0) sc += .09 * Math.max(0, Math.sin(G.T * 7));  // last heart beats
      const cx = hs.x + HUD.slotX - HUD.pad + im.width / 2 + i * HUD.slotPitch, cy = hs.y + HUD.slotY - HUD.pad + im.height / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore();
    }
    IMG.hud_coin && ctx.drawImage(IMG.hud_coin, HUD.coin.x, HUD.coin.y);              // coins: not active yet (no enemies)
    drawMinimap();
    IMG.hud_scroll && ctx.drawImage(IMG.hud_scroll, HUD.scroll.x, HUD.scroll.y);
    if (IMG.hud_gear) {
      const g = HUD.gear; hov.gear += ((hov.gearOn ? 1 : 0) - hov.gear) * .25;
      ctx.save(); ctx.translate(g.x + g.w / 2, g.y + g.h / 2); ctx.rotate(hov.gear * G.T * .8); ctx.scale(1 + hov.gear * .1, 1 + hov.gear * .1);
      ctx.drawImage(IMG.hud_gear, -g.w / 2, -g.h / 2); ctx.restore();
    }
  }
  function drawMinimap() {
    const m = HUD.map, x = m.x + m.ix, y = m.y + m.iy, w = m.iw, h = m.ih;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#0d1a46'); bg.addColorStop(1, '#17306f'); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    const VIEW = 900, sc = w / VIEW, cx = x + w / 2, cy = y + h / 2;                    // minimap shows ~900 px of the world around the king
    const mx = wx => cx + (wx - P.x) * sc, my = wy => cy + (wy - (P.y - 70)) * sc;
    ctx.strokeStyle = 'rgba(90,140,255,.18)'; ctx.lineWidth = 1; ctx.beginPath();     // grid
    for (let gx = Math.floor((P.x - VIEW / 2) / 60) * 60; gx < P.x + VIEW / 2; gx += 60) { ctx.moveTo(mx(gx), y); ctx.lineTo(mx(gx), y + h); }
    for (let gy = Math.floor((P.y - 70 - VIEW / 2) / 60) * 60; gy < P.y + VIEW / 2; gy += 60) { ctx.moveTo(x, my(gy)); ctx.lineTo(x + w, my(gy)); }
    ctx.stroke();
    for (const s of SOLIDS) {                                                           // terrain
      ctx.fillStyle = 'rgba(110,160,255,.28)'; ctx.fillRect(mx(s.x), my(s.y), s.w * sc, s.h * sc);
      ctx.strokeStyle = '#7fa6ff'; ctx.lineWidth = 2; ctx.strokeRect(mx(s.x), my(s.y), s.w * sc, s.h * sc);
    }
    // portal marker (purple diamond; sticks to the edge when the portal is off the map)
    let px = mx(PORTAL.cx), py = my(PORTAL.cy), off = px < x + 10 || px > x + w - 10 || py < y + 10 || py > y + h - 10;
    px = clamp(px, x + 12, x + w - 12); py = clamp(py, y + 12, y + h - 12);
    const kx = m.x + 77, ky = m.y + 72;                                                  // compass circle covers the top-left corner
    if (Math.hypot(px - kx, py - ky) < 70) { if (px - kx > py - ky) px = kx + 70; else py = ky + 70; }
    ctx.save(); ctx.translate(px, py); ctx.rotate(off ? 0 : G.T * .8); const ds = 9 + Math.sin(G.T * 4) * 1.5;
    ctx.shadowColor = '#d34cff'; ctx.shadowBlur = 10; ctx.fillStyle = '#c24dff';
    ctx.beginPath(); ctx.moveTo(0, -ds); ctx.lineTo(ds * .7, 0); ctx.lineTo(0, ds); ctx.lineTo(-ds * .7, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -1.5, 3, 3); ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(mapAngle);   // king arrow (points the way he faces)
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 14; ctx.fillStyle = '#25e8ff'; ctx.strokeStyle = '#06303a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(13, 13); ctx.lineTo(0, 6); ctx.lineTo(-13, 13); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    ctx.restore();
    IMG.hud_map && ctx.drawImage(IMG.hud_map, m.x, m.y);                                // frame + compass on top
  }
  function drawOverlay() {
    if (G.flash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100); g.addColorStop(0, 'rgba(255,30,60,0)'); g.addColorStop(1, `rgba(255,30,60,${G.flash * .55})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (G.state === 'dead') {
      const k = clamp(G.deadT / 1.2, 0, 1); ctx.fillStyle = `rgba(8,3,20,${.72 * k})`; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.fillStyle = '#ff4d6a'; ctx.font = "96px 'Press Start 2P', monospace"; ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
      if (G.deadT > 1) { ctx.fillStyle = '#d8c8ff'; ctx.font = "26px 'Press Start 2P', monospace"; if (Math.floor(G.T * 2) % 2 === 0) ctx.fillText('PRESS ENTER OR TAP TO RETRY', W / 2, H / 2 + 90); }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
  }

  /* ---------------- frame ---------------- */
  function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (G.shake > 0) ctx.translate(rnd(-1, 1) * G.shake * 28, rnd(-1, 1) * G.shake * 28);
    IMG.bg ? ctx.drawImage(IMG.bg, 0, 0, W, H) : (ctx.fillStyle = '#2a1a3c', ctx.fillRect(0, 0, W, H));
    drawStars();
    if (G.lightning > 0) {                                                              // distant lightning flash (double pulse)
      const t = G.lightning, a = (t > .35 ? (t - .35) / .2 : t > .2 ? .2 : t / .2 * .6) * .22;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(150,130,255,${a})`; ctx.fillRect(0, 0, W, 880); ctx.restore();
    }
    bats.forEach(drawBat);
    drawFog(790, .30, 12, false, false); drawFog(870, .22, -8, true, false);
    drawPortal();
    drawWisps();
    drawPlayer();
    drawDust();
    drawFog(930, .26, 20, false, true);
    drawAsh();
    ctx.restore();
    ctx.drawImage(vig, 0, 0, W, H);
    drawHUD();
    drawOverlay();
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.033, (now - last) / 1000); last = now;
    if (!G.paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------------- pause / restart / pointer ---------------- */
  addEventListener('cc:pause', () => { G.paused = true; });
  addEventListener('cc:resume', () => { G.paused = false; last = performance.now(); });
  addEventListener('cc:restart', e => { e.preventDefault(); Game.restart(); });
  const toDesign = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const inGear = (x, y) => { const g = HUD.gear; return x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h; };
  cv.addEventListener('pointermove', e => { const [x, y] = toDesign(e); hov.gearOn = inGear(x, y); cv.style.cursor = hov.gearOn ? 'pointer' : 'default'; });
  cv.addEventListener('pointerdown', e => {
    const [x, y] = toDesign(e);
    if (inGear(x, y)) { CC.click(); window.CCPause && CCPause.toggle(); }
    else if (G.state === 'dead' && G.deadT > 1) Game.restart();
  });

  /* ---------------- touch buttons (phones/tablets) ---------------- */
  if (matchMedia('(pointer:coarse)').matches) {
    const box = document.createElement('div'); box.id = 'touch';
    box.innerHTML = '<div class="grp"><button data-k="left">&#9664;</button><button data-k="right">&#9654;</button></div><div class="grp"><button data-k="jump">JUMP</button></div>';
    document.body.appendChild(box);
    box.querySelectorAll('button').forEach(b => {
      const k = b.dataset.k;
      const on = e => { e.preventDefault(); held[k] = true; b.classList.add('down'); if (k === 'jump') jumpPressedAt = G.T; };
      const off = e => { e.preventDefault(); held[k] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    });
  }

  /* ---------------- public API (for the next steps: enemies, coins, levels) ---------------- */
  const Game = window.Game = {
    player: P, solids: SOLIDS, state: G,
    get hp() { return P.hp; }, get maxHp() { return P.maxHp; },
    damage(n = 1) {
      if (G.state !== 'play' || P.invuln > 0 || G.paused) return;
      const before = P.hp; P.hp = Math.max(0, P.hp - n);
      for (let i = P.hp; i < before; i++) pop[i] = 1;
      P.invuln = 1.2; G.shake = .25; G.flash = .6; P.vx = -P.face * 380; P.vy = -520; P.onGround = false;
      if (P.hp <= 0) { G.state = 'dead'; G.deadT = 0; sfx.dead(); } else sfx.hurt();
    },
    heal(n = 1) {
      if (G.state !== 'play' || P.hp >= P.maxHp) return;
      const before = P.hp; P.hp = Math.min(P.maxHp, P.hp + n);
      for (let i = before; i < P.hp; i++) pop[i] = 1; sfx.heal();
    },
    restart() {
      Object.assign(P, { x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, face: 1, hp: P.maxHp, invuln: 0, alpha: 0, scale: .55, onGround: true, wasGround: true, frame: 0, anim: 0 });
      Object.assign(G, { state: 'spawn', spawnT: 0, deadT: 0, shake: 0, flash: 0 }); pop.fill(0); dusts.length = 0; sfx.spawn();
    }
  };

  /* ---------------- go ---------------- */
  Promise.all([...NAMES.map(loadImg), document.fonts ? document.fonts.load("20px 'Press Start 2P'").catch(() => {}) : 0]).then(() => {
    sfx.spawn(); requestAnimationFrame(t => { last = t; frame(t); });
  });
})();
