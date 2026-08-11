const form = document.querySelector('#settings-form');
const serverInput = document.querySelector('#serverUrl');
const tokenInput = document.querySelector('#apiToken');
const testButton = document.querySelector('#test');
const statusElement = document.querySelector('#status');

restore().catch((error) => showStatus(WordBookShared.errorMessage(error), 'error'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const config = await readAndAuthorize();
    await chrome.storage.local.set(config);
    showStatus('设置已保存', 'success');
  } catch (error) {
    showStatus(WordBookShared.errorMessage(error), 'error');
  }
});

testButton.addEventListener('click', async () => {
  testButton.disabled = true;
  showStatus('正在连接服务器……', 'info');
  try {
    const config = await readAndAuthorize();
    const result = await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
      serverUrl: config.serverUrl,
    });
    if (!result?.ok) throw new Error(result?.message || '连接失败');
    await chrome.storage.local.set(config);
    showStatus(`${result.message}，设置已保存`, 'success');
  } catch (error) {
    showStatus(WordBookShared.errorMessage(error), 'error');
  } finally {
    testButton.disabled = false;
  }
});

async function restore() {
  const config = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  serverInput.value = config.serverUrl || '';
  tokenInput.value = config.apiToken || '';
}

async function readAndAuthorize() {
  const serverUrl = WordBookShared.normalizeServerUrl(serverInput.value);
  const apiToken = tokenInput.value.trim();
  if (!apiToken) throw new Error('请输入扩展访问令牌');

  const pattern = WordBookShared.permissionPattern(serverUrl);
  // Request immediately inside the click/submit handler so Edge retains the user gesture.
  // Requesting an already granted origin simply resolves to true.
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error('需要允许访问该服务器，插件才能上传单词');

  return { serverUrl, apiToken };
}

function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = `status visible ${type}`;
}
