(function exposeShared(globalScope) {
  function normalizeSelection(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’\-]+$/gu, '')
      .slice(0, 100);
  }

  function normalizeServerUrl(value) {
    const text = String(value || '').trim().replace(/\/+$/, '');
    if (!text) throw new Error('请输入 WordBook 服务器地址');

    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error('服务器地址格式不正确');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('服务器地址必须以 http:// 或 https:// 开头');
    }

    if (url.username || url.password) {
      throw new Error('服务器地址中不能包含用户名或密码');
    }

    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  }

  function permissionPattern(serverUrl) {
    const url = new URL(normalizeServerUrl(serverUrl));
    return `${url.origin}/*`;
  }

  function pdfMetadata({ title = '', url = '' } = {}) {
    let sourcePdf = String(title || '').trim();
    let page = null;

    try {
      const parsed = new URL(url);
      const filename = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
      if (/\.pdf$/i.test(filename)) sourcePdf = filename;

      const pageMatch = parsed.hash.match(/(?:^#|[&#])page=(\d+)/i);
      if (pageMatch) page = Number(pageMatch[1]);
    } catch {
      // The title is still useful when a tab URL is unavailable or non-standard.
    }

    sourcePdf = sourcePdf.replace(/\s*[-–—]\s*Microsoft Edge\s*$/i, '').trim();
    return { sourcePdf: sourcePdf.slice(0, 300), page };
  }

  function parseLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  function parseTags(value) {
    const seen = new Set();
    return String(value || '')
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter((item) => {
        const key = item.toLocaleLowerCase('zh-CN');
        if (!item || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }

  function errorMessage(error, fallback = '操作失败，请稍后重试') {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const api = {
    errorMessage,
    normalizeSelection,
    normalizeServerUrl,
    parseLines,
    parseTags,
    pdfMetadata,
    permissionPattern,
  };

  globalScope.WordBookShared = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
