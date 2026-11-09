/* =========================================================
   Loading page engine. You normally don’t need to touch it.
   (Settings are in config.js)
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const hero = $("hero"), walker = $("walker");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const C = CONFIG.character;

  let target = 0, shown = 0, done = false, manual = false, simT = 0;
  let phase = "loading";                   // "loading" -> "exit" (runs off screen) -> "menu"

  // ---- title + background ----
  $("title").textContent = CONFIG.gameName;
  document.title = CONFIG.gameName + " — Loading";
  root.style.setProperty("--paper", CONFIG.background.color);
  if (CONFIG.background.image) {
    root.style.setProperty("--bg-image", `url("${CONFIG.background.image}")`);
    document.body.classList.add("custom-bg");
  }
  root.style.setProperty("--hero-h", C.height + "px");

  /* =========================================================
     CHARACTER A: animated stickman (legs + arms move)
     ========================================================= */
  const CYCLE = 1.1;                       // seconds for one full walk cycle (2 steps)
  let animate = null;                      // function(dt) that poses the stickman
  let stepsPerSecondPx = null;             // how fast the ground should slide

  if (C.type === "stickman") {
    // Drawing space = the trimmed image (196 x 464). Pivots measured from your drawing.
    const VB_W = 196, VB_H = 464;
    const HIP = { x: 96, y: 311 }, SHO = { x: 99, y: 176 };
    const LEG = 72, ARM = 56;              // each leg = 2 x 72, each arm = 2 x 56
    const SWING = 0.5, KNEE = 0.75;        // leg swing + knee bend (radians)
    const ARM_SWING = 0.55, ELBOW = 0.35;
    const GROUND_Y = HIP.y + LEG * 2;
    const NS = "http://www.w3.org/2000/svg";

    root.style.setProperty("--ratio", VB_W / VB_H);
    hero.classList.add("svg");

    const el = (name, attrs) => {
      const e = document.createElementNS(NS, name);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };
    const line = () => el("path", {
      fill: "none", stroke: "#030303", "stroke-width": 11,
      "stroke-linecap": "round", "stroke-linejoin": "round"
    });

    const svg = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}` });
    const figure = el("g", {});
    const legBack = line(), legFront = line();
    const upper = el("g", {});
    const armBack = line(), armFront = line();
    const body = el("image", { width: 314 * VB_W / 196, height: 314 });
    body.setAttribute("width", VB_W);
    body.setAttribute("href", "stickman-body.png");
    upper.append(armBack, body, armFront);
    figure.append(legBack, legFront, upper);
    svg.append(figure);
    hero.append(svg);

    // Swing a 2-bone limb. angle 0 = straight down, positive = toward the right (forward).
    const limb = (ox, oy, len, a, bend) => {
      const kx = ox + len * Math.sin(a), ky = oy + len * Math.cos(a);
      const s = a - bend;                  // lower bone trails behind
      return { kx, ky, ex: kx + len * Math.sin(s), ey: ky + len * Math.cos(s) };
    };
    const path = (p, ox, oy) => `M${ox} ${oy} L${p.kx.toFixed(1)} ${p.ky.toFixed(1)} L${p.ex.toFixed(1)} ${p.ey.toFixed(1)}`;

    let walkPhase = 0, amp = 0;
    animate = function (dt) {
      const goal = phase === "menu" || reduce ? 0 : 1;
      amp += (goal - amp) * Math.min(1, dt * 7);
      walkPhase += dt * (Math.PI * 2 / CYCLE) * C.walkSpeed * (amp > 0.02 ? 1 : 0);

      // legs (opposite phases). Knee bends only while the leg swings forward.
      const pose = (ph) => limb(HIP.x, HIP.y, LEG, SWING * Math.sin(ph) * amp,
                                KNEE * Math.max(0, Math.cos(ph)) * amp);
      const lf = pose(walkPhase), lb = pose(walkPhase + Math.PI);

      // keep the planted foot on the ground -> body naturally bobs as legs spread
      const dy = GROUND_Y - Math.max(lf.ey, lb.ey);
      figure.setAttribute("transform", `translate(0 ${dy.toFixed(2)})`);
      legFront.setAttribute("d", path(lf, HIP.x, HIP.y));
      legBack.setAttribute("d", path(lb, HIP.x, HIP.y));

      // arms swing opposite to the leg on the same side; slightly out when standing still
      const rest = (1 - amp) * 0.28;
      const arm = (ph, side) => limb(SHO.x, SHO.y, ARM,
        ARM_SWING * Math.sin(ph) * amp + rest * side,
        -(ELBOW + 0.35 * Math.max(0, Math.cos(ph))) * amp);
      const af = arm(walkPhase + Math.PI, 1), ab = arm(walkPhase, -1);
      armFront.setAttribute("d", path(af, SHO.x, SHO.y));
      armBack.setAttribute("d", path(ab, SHO.x, SHO.y));

      // slight lean + sway of head and torso
      const sway = (2 + 1.6 * Math.sin(walkPhase * 2)) * amp;
      upper.setAttribute("transform", `rotate(${sway.toFixed(2)} ${HIP.x} ${HIP.y})`);
    };

    // ground speed that matches the feet (so the feet don’t "skate")
    stepsPerSecondPx = () => {
      const scale = hero.clientHeight / VB_H;
      const stride = 2 * (LEG * 2) * Math.sin(SWING);          // distance covered by one step
      return (stride / (CYCLE / 2 / C.walkSpeed)) * scale;
    };
  }

  /* =========================================================
     CHARACTER B: your own image / sprite sheet
     ========================================================= */
  if (C.type === "image") {
    const I = C.image;
    hero.style.backgroundImage = `url("${I.src}")`;        // set the picture directly on the character
    const img = new Image();
    img.onload = () => root.style.setProperty("--ratio", (img.naturalWidth / I.frames) / img.naturalHeight);
    img.onerror = () => {                                   // wrong path? show a clear message on screen
      hero.classList.add("missing");
      hero.textContent = "Image not found: " + I.src;
      console.error("Loading screen: cannot find image at", I.src);
    };
    img.src = I.src;
    if (I.frames > 1) {
      hero.classList.add("sheet");
      hero.style.backgroundSize = `${I.frames * 100}% 100%`;
      hero.style.imageRendering = "pixelated";            // keep pixel art sharp
      document.querySelector(".shadow").style.display = "none";
      const show = (i) => { hero.style.backgroundPosition = `${(i / (I.frames - 1)) * 100}% 100%`; };
      let f = 0;
      show(0);
      setInterval(() => {
        if (reduce) return;
        if (phase === "menu") { show(I.idleFrame || 0); return; }
        f = (f + 1) % I.frames;
        show(f);
      }, 1000 / I.fps);
    }
  }

  // ---- ground + shadow speed ----
  function syncGround() {
    const dashes = document.querySelector(".dashes"), shadow = document.querySelector(".shadow");
    if (stepsPerSecondPx) {
      const speed = stepsPerSecondPx();
      if (speed > 0) dashes.style.animationDuration = (64 / speed).toFixed(3) + "s";
      shadow.style.animationDuration = (CYCLE / 2 / C.walkSpeed).toFixed(3) + "s";
    } else if (C.type === "image" && C.image.groundSeconds) {
      dashes.style.animationDuration = C.image.groundSeconds + "s";
    }
  }
  addEventListener("resize", syncGround);

  // ---- progress ----
  // Call this from your game while assets load: setLoadProgress(0..100)
  window.setLoadProgress = (v) => { manual = true; target = Math.max(0, Math.min(100, v)); };

  function stageText(p) {
    let text = CONFIG.stages[0][1];
    CONFIG.stages.forEach(([from, t]) => { if (p >= from) text = t; });
    return text;
  }

  let exitX = 0, exitT = 0, exitFrom = 0;
  function place(dt) {
    dt = dt || 0;
    const pad = CONFIG.edgePadding;
    if (phase === "exit") {                          // keep running to the right, faster and faster
      exitT += dt;
      exitX += (220 + exitT * 1100) * dt;
      const x = exitFrom + exitX;
      walker.style.left = x + "px";
      if (x > innerWidth + 30) enterMenu();
      return;
    }
    if (phase === "menu") return;                    // already leaving for the menu page
    const room = Math.max(0, innerWidth - walker.offsetWidth - pad * 2);
    walker.style.left = pad + room * (shown / 100) + "px";
  }
  addEventListener("resize", () => place(0));

  function update(dt) {
    if (!manual && !done) {
      simT += dt;
      const k = Math.min(1, simT / CONFIG.fakeLoadSeconds);
      target = 100 * (0.6 * k * k * (3 - 2 * k) + 0.4 * k);
    }
    shown += (target - shown) * Math.min(1, dt * 5);
    const p = shown >= 99.6 && target >= 100 ? 100 : shown;
    if (p === 100) shown = 100;

    $("fill").style.width = p + "%";
    $("pct").textContent = Math.floor(p) + "%";
    $("bar").setAttribute("aria-valuenow", Math.floor(p));
    const msg = stageText(p);
    if ($("status").textContent !== msg) $("status").textContent = msg;
    place(dt);

    if (p >= 100 && !done) {
      done = true;
      setTimeout(startExit, 500);          // short pause on "Ready!", then run off to the next screen
    }
  }

  // ---- next page: menu.html ----
  function startExit() {
    if (phase !== "loading") return;
    if (reduce) { enterMenu(); return; }
    exitFrom = parseFloat(walker.style.left) || 0;
    phase = "exit";
    document.body.classList.add("leaving");          // fades the loading bar away
  }
  function enterMenu() {
    if (phase === "menu") return;
    phase = "menu";
    location.href = CONFIG.menuUrl;                  // go to the menu page
  }

  // ---- loop ----
  let last = performance.now();
  syncGround();
  (function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    if (animate) animate(dt);
    requestAnimationFrame(frame);
  })(last);
})();
