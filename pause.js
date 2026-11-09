/* Pause menu for game.html. Add in <head>: <link rel="stylesheet" href="settings.css"><link rel="stylesheet" href="pause.css">
   and before your game script: <script src="settings.js"></script><script src="pause.js"></script>
   Game hooks:  window.addEventListener('cc:pause', ...)  'cc:resume'  'cc:restart' (call e.preventDefault() to handle restart yourself)
   Open it manually with CCPause.toggle(). Esc or P also toggles. */
(function () {
  const root = document.createElement('div'); root.id = 'ccp';
  root.innerHTML = `<div class="m"><h1>PAUSE</h1><div class="bars"><b></b><b></b></div>
    <button class="b" data-a="resume">RESUME</button><button class="b" data-a="restart">RESTART</button>
    <button class="b" data-a="settings">SETTINGS</button><button class="b q" data-a="quit">QUIT</button></div><div class="s"></div>`;
  const btn = document.createElement('button'); btn.id = 'ccPauseBtn'; btn.setAttribute('aria-label', 'Pause'); btn.innerHTML = '<i></i><i></i>';
  document.body.append(root, btn);
  const open = () => { root.classList.add('open'); root.classList.remove('set'); window.dispatchEvent(new Event('cc:pause')); };
  const close = () => { root.classList.remove('open', 'set'); window.dispatchEvent(new Event('cc:resume')); };
  const api = window.CCPause = { open, close, toggle: () => root.classList.contains('open') ? close() : open(), home: 'index.html' };
  btn.onclick = () => { window.CC && CC.click(); api.toggle(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { if (root.classList.contains('set')) root.classList.remove('set'); else api.toggle(); } });
  root.addEventListener('click', e => {
    const a = e.target.closest('.b')?.dataset.a; if (!a) return; window.CC && CC.click();
    if (a === 'resume') close();
    if (a === 'settings') { root.classList.add('set'); CC.settingsPanel(root.querySelector('.s'), () => root.classList.remove('set')); }
    if (a === 'restart') { const ev = new Event('cc:restart', { cancelable: true }); window.dispatchEvent(ev); if (!ev.defaultPrevented) location.reload(); else close(); }
    if (a === 'quit') location.href = api.home;
  });
})();
