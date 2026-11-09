/* Menu page. Settings (name, background, how to play, start page) are in config.js */
(function () {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  // ---- title + background (same as the loading page) ----
  $("title").textContent = CONFIG.gameName;
  document.title = CONFIG.gameName;
  root.style.setProperty("--paper", CONFIG.background.color);
  if (CONFIG.background.image) {
    root.style.setProperty("--bg-image", `url("${CONFIG.background.image}")`);
    document.body.classList.add("custom-bg");
  }

  // ---- buttons ----
  const btnStart = $("btnStart"), btnHow = $("btnHow"), modal = $("howModal");

  CONFIG.howToPlay.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    $("howList").append(li);
  });

  btnStart.addEventListener("click", () => {
    if (CONFIG.startUrl) { location.href = CONFIG.startUrl; return; }
    const label = btnStart.textContent;
    btnStart.textContent = "Coming soon…";           // no game yet, so just a friendly message
    setTimeout(() => { btnStart.textContent = label; }, 1600);
  });

  function openHow() { modal.hidden = false; $("btnClose").focus(); }
  function closeHow() { modal.hidden = true; btnHow.focus(); }
  btnHow.addEventListener("click", openHow);
  $("btnClose").addEventListener("click", closeHow);
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) closeHow(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeHow(); });

  btnStart.focus({ preventScroll: true });
})();
