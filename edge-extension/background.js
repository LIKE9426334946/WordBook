importScripts('shared.js');

const {
  normalizeSelection,
  normalizeServerUrl,
} = WordBookShared;

const CONTEXT_MENU_ID = 'wordbook-add-selection';

async function installContextMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '添加“%s”到 WordBook',
    contexts: ['selection'],
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  installContextMenu().catch(console.error);
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  openEditor({
    selection: info.selectionText,
    method: 'context-menu',
  }).catch(console.error);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'capture-selection') return;
  captureActiveTab().catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'OPEN_EDITOR') {
    openEditor({
      selection: message.selection,
      method: message.method || 'backquote',
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message.type === 'CAPTURE_ACTIVE_TAB') {
    captureActiveTab()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message.type === 'SAVE_WORD') {
    saveWord(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, code: 'NETWORK_ERROR', message: error.message }));
    return true;
  }

  if (message.type === 'TEST_CONNECTION') {
    testConnection(message.serverUrl)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function openEditor(capture = {}) {
  const selection = normalizeSelection(capture.selection);
  const entry = {
    word: selection,
    method: capture.method || 'unknown',
    capturedAt: new Date().toISOString(),
  };

  const captureId = crypto.randomUUID();
  await chrome.storage.session.set({ [`capture:${captureId}`]: entry });
  await chrome.windows.create({
    url: chrome.runtime.getURL(`editor.html?capture=${encodeURIComponent(captureId)}`),
    type: 'popup',
    width: 480,
    height: 640,
    focused: true,
  });
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');

  try {
    const frames = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection()?.toString() || '',
    });
    const selection = frames.map((item) => item.result).find((item) => normalizeSelection(item));
    if (!selection) {
      return { ok: false, message: '请先选中一个单词，再按快捷键' };
    }

    await openEditor({ selection, method: 'extension-command' });
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Edge PDF 阅读器阻止了快捷键读取，请右键选中的单词并选择“添加到 WordBook”',
    };
  }
}

async function getConfig() {
  const config = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  return {
    serverUrl: config.serverUrl ? normalizeServerUrl(config.serverUrl) : '',
    apiToken: String(config.apiToken || '').trim(),
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { response, body };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('连接服务器超时');
    throw new Error('无法连接 WordBook 服务器，请检查地址、网络和扩展权限');
  } finally {
    clearTimeout(timer);
  }
}

async function saveWord(payload) {
  const { serverUrl, apiToken } = await getConfig();
  if (!serverUrl || !apiToken) {
    return { ok: false, code: 'NOT_CONFIGURED', message: '请先配置服务器地址和扩展令牌' };
  }

  const { response, body } = await fetchJson(`${serverUrl}/api/extension/words`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) return { ok: true, data: body?.data, message: body?.message || '已添加到单词本' };
  return {
    ok: false,
    code: body?.error?.code || `HTTP_${response.status}`,
    message: body?.error?.message || `服务器返回错误（${response.status}）`,
    existing: body?.error?.existing || null,
  };
}

async function testConnection(value) {
  const serverUrl = normalizeServerUrl(value);
  const { response, body } = await fetchJson(`${serverUrl}/api/health`);
  if (!response.ok || !body?.ok) {
    return { ok: false, message: `服务器健康检查失败（${response.status}）` };
  }
  return { ok: true, message: `已连接 ${body.service || 'WordBook'}` };
}
