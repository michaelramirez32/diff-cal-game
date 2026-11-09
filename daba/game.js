/* =========================================================
   The game. Tweak the numbers in TUNING to change how it feels.
   ========================================================= */
const TUNING = {
  playerHP: 100,
  playerSpeed: 250,       // walking speed (px/second)
  jumpPower: 650,
  attackDamage: 10,
  attackReach: 130,       // how far the sword reaches in front of the king
  enemyHP: 30,
  enemyDamage: 10,
  enemySpeed: [55, 95],   // min and max walking speed of monsters
  spawnEvery: [2, 3.5],   // seconds between new monsters
  coinsPerKill: [1, 3]    // min and max coins dropped
};

(function () {
  const W = 960, H = 540;                      // game size
  let GROUND = 500;                            // y of the floor (each map sets its own in config.js)
  const S = 2, CELL = 160, CH = 111, AX = 80, AY = 105;   // sprite scale, frame size, feet anchor
  const ANIM = { run: { n: 7, fps: 12 }, attack: { n: 4, fps: 14 }, hit: { n: 4, fps: 10 } };
  const $ = (id) => document.getElementById(id);
  const cv = $("game"), ctx = cv.getContext("2d");
  cv.width = W; cv.height = H;
  document.title = CONFIG.gameName;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- load pictures ---------- */
  // maps come from config.js (CONFIG.maps). Fallback = one map, in case it is missing.
  const MAPS = CONFIG.maps && CONFIG.maps.length ? CONFIG.maps : [{ name: "Night Forest", bg: "bg.jpg", ground: 500, enemies: 12 }];
  const FILES = { run: "p-run.png", jump: "p-jump.png", attack1: "p-attack1.png", attack2: "p-attack2.png", hit: "p-hit.png", enemy: "enemy.png" };
  MAPS.forEach((m, i) => { FILES["map" + i] = m.bg; });
  const IMG = {}, missing = [];
  Promise.all(Object.entries(FILES).map(([k, src]) => new Promise((res) => {
    const i = new Image();
    i.onload = () => { IMG[k] = i; res(); };
    i.onerror = () => { missing.push(src); res(); };
    i.src = src;
  }))).then(() => (missing.length ? fail() : begin()));

  function fail() {                                   // wrong file name/location? say so on screen
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ff5a4f"; ctx.font = "28px sans-serif";
    ctx.fillText("Missing files (put them next to game.html):", 40, 70);
    missing.forEach((m, i) => ctx.fillText(m, 40, 120 + i * 38));
  }

  /* ---------- controls ---------- */
  const keys = {}, touch = {};
  let jumpReq = false, atkReq = false;
  const left = () => keys.ArrowLeft || keys.KeyA || touch.left;
  const right = () => keys.ArrowRight || keys.KeyD || touch.right;
  addEventListener("keydown", (e) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) && $("over").hidden && $("clear").hidden) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (["Space", "ArrowUp", "KeyW"].includes(e.code)) jumpReq = true;
    if (["KeyJ", "KeyX", "KeyK"].includes(e.code)) atkReq = true;
  });
  addEventListener("keyup", (e) => { keys[e.code] = false; });
  cv.addEventListener("pointerdown", () => { atkReq = true; });
  document.querySelectorAll(".pad button").forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); touch[k] = true;
      if (k === "jump") jumpReq = true;
      if (k === "attack") atkReq = true;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { touch[k] = false; }));
  });

  /* ---------- game state ---------- */
  let P, enemies, coins, parts, coinCount, kills, spawnT, bump, over, t = 0;
  let mapIdx = 0, toSpawn = 0, clearT = 0, banner = 0, coinsAtStart = 0;   // map progress

  // start (or restart) a map. coins0 = coins the king brings in from before
  function loadMap(i, coins0) {
    mapIdx = i;
    const m = MAPS[i];
    GROUND = m.ground;
    P = { x: W / 2, y: GROUND, vx: 0, vy: 0, face: 1, hp: TUNING.playerHP, st: "idle", at: 0, rt: 0, anim: 0, inv: 0, hitT: 0, hitSet: new Set() };
    enemies = []; coins = []; parts = [];
    coinCount = coinsAtStart = coins0;
    toSpawn = m.enemies || 10;            // monsters this map still has to send
    kills = 0; spawnT = 1; bump = 0; clearT = 0; banner = 2.5; over = false;
    $("over").hidden = true; $("clear").hidden = true;
  }

  // the map ends ONLY when every monster has appeared and been defeated
  function mapCleared() {
    over = true;                          // freeze the game behind the window
    coinCount += coins.length; coins = [];   // leftover coins are collected automatically
    const last = mapIdx + 1 >= MAPS.length;
    $("clearTitle").textContent = last ? "You win!" : "Map cleared!";
    $("clearInfo").textContent = "Coins: " + coinCount;
    $("nextBtn").textContent = last ? "Play again" : "Next: " + MAPS[mapIdx + 1].name;
    $("clear").hidden = false; $("nextBtn").focus();
  }

  function spark(x, y, color, n) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-180, 180), vy: rnd(-300, -40), l: rnd(0.3, 0.6), c: color });
  }

  function damagePlayer(n, dir) {
    P.hp -= n; P.st = "hit"; P.hitT = 0.4; P.anim = 0; P.inv = 1.2;
    P.vx = dir * 260; P.vy = -260;
    spark(P.x, P.y - 60, "#ff5a4f", 8);
    if (P.hp <= 0) { P.hp = 0; over = true; $("finalCoins").textContent = coinCount; $("over").hidden = false; $("again").focus(); }
  }

  function hurtEnemy(e, n) {
    e.hp -= n; e.kb = 0.25; e.kd = P.face; e.flash = 0.15;
    spark(e.x, e.y - 60, "#ffd23a", 7);
    if (e.hp > 0) return;
    e.dead = true; kills++;
    spark(e.x, e.y - 50, "#fff", 14);
    const n2 = Math.round(rnd(TUNING.coinsPerKill[0], TUNING.coinsPerKill[1]));
    for (let i = 0; i < n2; i++) coins.push({ x: e.x, y: e.y - 50, vx: rnd(-130, 130), vy: rnd(-520, -380), gy: rnd(0, 22), ph: rnd(0, 6), life: 0, rest: false });
  }

  /* ---------- update ---------- */
  function update(dt) {
    t += dt; banner = Math.max(0, banner - dt);
    const onGround = P.y >= GROUND;
    P.inv = Math.max(0, P.inv - dt);

    if (P.st === "hit") {
      P.hitT -= dt; P.anim += dt; P.vx *= 0.92;
      if (P.hitT <= 0) P.st = "idle";
    } else {
      const dir = (right() ? 1 : 0) - (left() ? 1 : 0);
      if (atkReq && P.st !== "attack") { P.st = "attack"; P.at = 0; P.hitSet.clear(); P.atk = !P.atk; }
      atkReq = false;
      if (P.st === "attack") {
        P.at += dt;
        if (P.at >= ANIM.attack.n / ANIM.attack.fps) P.st = "idle";
      }
      P.vx = dir * (P.st === "attack" ? TUNING.playerSpeed * 0.35 : TUNING.playerSpeed);
      if (dir && P.st !== "attack") P.face = dir;
      if (jumpReq && onGround) P.vy = -TUNING.jumpPower;
      jumpReq = false;
      if (P.st !== "attack") {
        P.st = !onGround ? "jump" : dir ? "run" : "idle";
        if (P.st === "run") P.rt += dt;
      }
    }
    P.x = Math.max(50, Math.min(W - 50, P.x + P.vx * dt));
    P.vy += 1800 * dt; P.y += P.vy * dt;
    if (P.y >= GROUND) { P.y = GROUND; P.vy = 0; }

    // sword hits on the slash frames
    if (P.st === "attack" && Math.floor(P.at * ANIM.attack.fps) >= 2) {
      enemies.forEach((e) => {
        const rel = (e.x - P.x) * P.face;
        if (!P.hitSet.has(e) && rel > -30 && rel < TUNING.attackReach && P.y > GROUND - 120) {
          P.hitSet.add(e); hurtEnemy(e, TUNING.attackDamage);
        }
      });
    }

    // monsters
    enemies.forEach((e) => {
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      if (e.kb > 0) { e.kb -= dt; e.x += e.kd * 220 * dt; }
      else { e.dir = Math.sign(P.x - e.x) || 1; e.x += e.dir * e.sp * dt; }
      if (Math.abs(e.x - P.x) < 42 && P.y > GROUND - 70 && P.inv <= 0 && !over) damagePlayer(TUNING.enemyDamage, Math.sign(P.x - e.x) || 1);
    });
    enemies = enemies.filter((e) => !e.dead);

    const M = MAPS[mapIdx], hpE = M.enemyHP || TUNING.enemyHP, spd = M.enemySpeed || TUNING.enemySpeed, every = M.spawnEvery || TUNING.spawnEvery;
    spawnT -= dt;
    if (spawnT <= 0 && toSpawn > 0 && enemies.length < (M.maxAtOnce || 3)) {
      toSpawn--;
      enemies.push({ x: Math.random() < 0.5 ? -40 : W + 40, y: GROUND, hp: hpE, max: hpE, sp: rnd(spd[0], spd[1]), kb: 0, kd: 1, flash: 0, t: rnd(0, 6), dir: 1 });
      spawnT = rnd(every[0], every[1]);
    }
    if (toSpawn === 0 && enemies.length === 0) { clearT += dt; if (clearT > 1.2) mapCleared(); } else clearT = 0;

    // coins: bounce, then get pulled to the king when he is close
    coins.forEach((c) => {
      c.ph += dt * 8; c.life += dt;
      if (!c.rest) {
        c.vy += 1500 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y >= GROUND + c.gy) { c.y = GROUND + c.gy; c.vy *= -0.4; c.vx *= 0.6; if (Math.abs(c.vy) < 80) c.rest = true; }
      }
      const dx = P.x - c.x, dy = P.y - 40 - c.y, d = Math.hypot(dx, dy) || 1;
      if (c.life > 0.4 && d < 150) { c.rest = true; c.x += (dx / d) * 420 * dt; c.y += (dy / d) * 420 * dt; }
      if (c.life > 0.25 && d < 45) { c.dead = true; coinCount++; bump = 0.25; }
    });
    coins = coins.filter((c) => !c.dead);
    bump = Math.max(0, bump - dt);

    parts.forEach((p) => { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; });
    parts = parts.filter((p) => p.l > 0);
  }

  /* ---------- draw ---------- */
  function drawPlayer() {
    let key = "hit", i = 0;                              // idle = first "hit" pose (standing)
    if (P.st === "run") { key = "run"; i = Math.floor(P.rt * ANIM.run.fps) % ANIM.run.n; }
    else if (P.st === "jump") { key = "jump"; i = P.vy < 0 ? 0 : 1; }
    else if (P.st === "attack") { key = P.atk ? "attack2" : "attack1"; i = Math.min(3, Math.floor(P.at * ANIM.attack.fps)); }
    else if (P.st === "hit") { key = "hit"; i = Math.min(3, Math.floor(P.anim * ANIM.hit.fps)); }
    const air = Math.max(0, GROUND - P.y);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(P.x, GROUND + 3, Math.max(14, 34 - air / 8), 7, 0, 0, 7); ctx.fill();
    if (P.inv > 0 && P.st !== "hit" && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.4;
    ctx.save();
    ctx.translate(Math.round(P.x), Math.round(P.y)); ctx.scale(P.face, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(IMG[key], i * CELL, 0, CELL, CH, -AX * S, -AY * S, CELL * S, CH * S);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, frac, color) {
    ctx.fillStyle = "#000"; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = "#3a1216"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, w * frac), h);
  }

  function drawEnemy(e) {
    const im = IMG.enemy, h = 112, w = (h * im.width) / im.height;
    const bob = Math.abs(Math.sin(e.t * 7)) * 6;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(e.x, GROUND + 3, 26, 6, 0, 0, 7); ctx.fill();
    ctx.save();
    ctx.translate(Math.round(e.x + (e.flash > 0 ? rnd(-3, 3) : 0)), GROUND);
    ctx.rotate(Math.sin(e.t * 7) * 0.07);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im, -w / 2, -h - bob, w, h);
    ctx.restore();
    bar(e.x - 28, GROUND - h - 22, 56, 7, e.hp / e.max, "#ff4a4a");     // monster health bar
  }

  function drawCoin(x, y, ph) {
    const w = Math.abs(Math.cos(ph)) * 8 + 3;
    ctx.fillStyle = "#7a5200"; ctx.beginPath(); ctx.ellipse(x, y, w + 2, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd23a"; ctx.beginPath(); ctx.ellipse(x, y, w, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff3a8"; ctx.fillRect(x - 1, y - 5, 2, 5);
  }

  function hud() {
    bar(24, 24, 260, 24, P.hp / TUNING.playerHP, "#e8453c");
    ctx.font = "22px 'Patrick Hand', sans-serif"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeStyle = "#000";
    const label = "HP " + P.hp + "/" + TUNING.playerHP;
    ctx.strokeText(label, 34, 37); ctx.fillText(label, 34, 37);
    ctx.save();                                           // coin counter (pops a little when you collect)
    ctx.translate(W - 40, 38); ctx.scale(1 + bump * 2, 1 + bump * 2);
    ctx.textAlign = "right"; ctx.font = "34px 'Patrick Hand', sans-serif";
    ctx.strokeText("x " + coinCount, -28, 0); ctx.fillText("x " + coinCount, -28, 0);
    drawCoin(-14, 0, 0);
    ctx.restore();
    ctx.textAlign = "center"; ctx.font = "26px 'Patrick Hand', sans-serif";
    const remaining = toSpawn + enemies.length;           // monsters left on this map
    const info = MAPS[mapIdx].name + "  -  Monsters left: " + remaining;
    ctx.strokeText(info, W / 2, 37); ctx.fillText(info, W / 2, 37);
    if (banner > 0) {                                     // "Map 1: ..." title when a map starts
      ctx.globalAlpha = Math.min(1, banner); ctx.font = "64px 'Patrick Hand', sans-serif"; ctx.lineWidth = 7;
      const title = "Map " + (mapIdx + 1) + ": " + MAPS[mapIdx].name;
      ctx.strokeText(title, W / 2, 130); ctx.fillText(title, W / 2, 130);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
  }

  function draw() {
    const b = IMG["map" + mapIdx], sc = Math.max(W / b.width, H / b.height), dw = b.width * sc, dh = b.height * sc;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, (W - dw) / 2, H - dh, dw, dh);
    coins.forEach((c) => drawCoin(c.x, c.y, c.ph));
    enemies.forEach(drawEnemy);
    drawPlayer();
    parts.forEach((p) => { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4); });
    hud();
  }

  /* ---------- go ---------- */
  function begin() {
    loadMap(0, 0);
    $("again").addEventListener("click", () => loadMap(mapIdx, coinsAtStart));       // retry this map
    $("nextBtn").addEventListener("click", () => {
      const more = mapIdx + 1 < MAPS.length;
      loadMap(more ? mapIdx + 1 : 0, more ? coinCount : 0);                           // next map, or start over
    });
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!over) update(dt);
      draw();
      requestAnimationFrame(loop);
    })(last);
  }
})();
