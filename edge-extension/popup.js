const statusElement = document.querySelector('#status');

document.querySelector('#capture').addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'CAPTURE_ACTIVE_TAB' });
  if (result?.ok) window.close();
  else showStatus(result?.message || '没有读取到选中的单词', 'error');
});

document.querySelector('#settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.querySelector('#open-wordbook').addEventListener('click', async () => {
  const { serverUrl } = await chrome.storage.local.get('serverUrl');
  if (!serverUrl) {
    showStatus('请先配置服务器地址', 'info');
    return;
  }
  await chrome.tabs.create({ url: serverUrl });
  window.close();
});

function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = `status visible ${type}`;
}
