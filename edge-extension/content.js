(function startSelectionCapture() {
  if (globalThis.__wordBookSelectionCaptureInstalled) return;
  globalThis.__wordBookSelectionCaptureInstalled = true;

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.code !== 'Backquote' || event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditable(event.target)) return;

      const selection = WordBookShared.normalizeSelection(window.getSelection()?.toString());
      if (!selection) return;

      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'OPEN_EDITOR',
        selection,
        method: 'backquote',
      });
    },
    true,
  );

  function isEditable(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }
})();
