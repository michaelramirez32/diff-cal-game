/* Menu effects: drips under the title + floating particles.
   (Fog, glitch, button glow are pure CSS in menu-fx.css) */
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---- drips under the title ---- */
  const dripBox = document.querySelector(".drips");
  if (dripBox) {
    for (let i = 0; i < 16; i++) {
      const d = document.createElement("span");
      d.className = "drip";
      d.style.left = rnd(20, 76).toFixed(2) + "%";
      d.style.height = rnd(25, 100).toFixed(0) + "%";
      d.style.width = rnd(3, 6).toFixed(1) + "px";
      d.style.setProperty("--t", rnd(4, 8).toFixed(2) + "s");
      d.style.setProperty("--d", (-rnd(0, 8)).toFixed(2) + "s");
      dripBox.appendChild(d);
    }
  }

  /* ---- floating particles (canvas uses the picture's 1920x1080 coordinates) ---- */
  const cv = document.querySelector(".particles");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  cv.width = 1920; cv.height = 1080;

  function spawn(first) {
    return {
      x: rnd(0, 1920),
      y: first ? rnd(0, 1080) : 1080 + rnd(0, 40),
      r: rnd(1, 2.6),
      vy: rnd(8, 26),
      vx: rnd(-6, 6),
      a: rnd(0.25, 0.8),
      ph: rnd(0, 6.283)
    };
  }
  const motes = Array.from({ length: 42 }, () => spawn(true));

  let last = performance.now();
  (function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.fillStyle = "#bff3ff";
    ctx.shadowColor = "#7ee8ff";
    ctx.shadowBlur = 10;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.y -= m.vy * dt;
      m.x += (m.vx + Math.sin(now / 900 + m.ph) * 8) * dt;
      if (m.y < -10) motes[i] = spawn(false);
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(now / 500 + m.ph));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  })(last);
})();
