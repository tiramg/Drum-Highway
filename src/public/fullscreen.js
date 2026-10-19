(() => {
  const button = document.getElementById('fullscreenToggle');
  const sync = () => {
    const active = Boolean(document.fullscreenElement);
    button.textContent = active ? '⛶ Exit full screen' : '⛶ Full screen';
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Exit full screen (Esc also works)' : 'Enter full screen';
  };
  if (!document.fullscreenEnabled) {
    button.disabled = true;
    button.title = 'Full screen is unavailable in this browser';
    return;
  }
  let automaticAttempted = false;
  document.addEventListener('click', event => {
    const control = event.target.closest?.('button');
    if (automaticAttempted || !control || !['libraryToggle', 'setupToggle', 'resumeSession', 'play', 'quickSongs'].includes(control.id)) return;
    automaticAttempted = true;
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  }, true);
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      sync();
    } catch {
      sync();
      button.title = 'Full screen could not change. Try again.';
    }
  });
  document.addEventListener('fullscreenchange', sync);
  sync();
})();
