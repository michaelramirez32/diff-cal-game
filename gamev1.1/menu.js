/* Menu page. Button positions are set in style.css (.hit-start, .hit-settings, .hit-quit).
   Other settings (how-to-play text, start page) are in config.js */
(function () {
  const $ = (id) => document.getElementById(id);
  document.title = CONFIG.gameName;

  const popup = $("popup");

  // one popup used for both Settings and Quit
  function openPopup(title, items, note) {
    $("popupTitle").textContent = title;
    const list = $("popupList");
    list.innerHTML = "";
    items.forEach((t) => { const li = document.createElement("li"); li.textContent = t; list.append(li); });
    list.hidden = items.length === 0;
    $("popupNote").textContent = note || "";
    $("popupNote").hidden = !note;
    popup.hidden = false;
    $("popupClose").focus();
  }
  function closePopup() { popup.hidden = true; $("btnSettings").focus(); }

  // START -> the game (or a friendly message if no game page is set)
  $("btnStart").addEventListener("click", () => {
    if (CONFIG.startUrl) { location.href = CONFIG.startUrl; return; }
    openPopup("Coming soon", [], "Wala pa ang laro. Lalabas ito dito kapag nalagay na.");
  });

  // SETTINGS -> for now it shows the how-to-play instructions
  $("btnSettings").addEventListener("click", () => {
    openPopup("Settings", CONFIG.howToPlay, "");
  });

  // QUIT -> browsers usually don't let a page close itself, so show a message if it stays open
  $("btnQuit").addEventListener("click", () => {
    window.close();
    setTimeout(() => {
      openPopup("Quit", [], "Pwede mo nang isara ang tab na ito.");
    }, 200);
  });

  $("popupClose").addEventListener("click", closePopup);
  popup.addEventListener("pointerdown", (e) => { if (e.target === popup) closePopup(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !popup.hidden) closePopup(); });

  $("btnStart").focus({ preventScroll: true });
})();
