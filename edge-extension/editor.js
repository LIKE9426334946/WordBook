const form = document.querySelector('#word-form');
const wordInput = document.querySelector('#word');
const meaningInput = document.querySelector('#meaning');
const statusElement = document.querySelector('#status');
const saveButton = document.querySelector('#save');
const captureId = new URLSearchParams(location.search).get('capture');

initialize().catch((error) => showStatus(WordBookShared.errorMessage(error), 'error'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  setSaving(true);
  showStatus('正在保存……', 'info');
  const payload = {
    word: WordBookShared.normalizeSelection(wordInput.value),
    meaning: document.querySelector('#meaning').value.trim(),
    examples: WordBookShared.parseLines(document.querySelector('#examples').value),
    notes: document.querySelector('#notes').value.trim(),
  };

  try {
    const result = await chrome.runtime.sendMessage({ type: 'SAVE_WORD', payload });
    if (!result?.ok) {
      if (result?.code === 'NOT_CONFIGURED') {
        showStatus(`${result.message}，请点击下方“设置”`, 'error');
      } else if (result?.code === 'WORD_EXISTS') {
        showStatus(result.message || '这个单词已经收录', 'info');
      } else {
        showStatus(result?.message || '保存失败', 'error');
      }
      return;
    }

    if (captureId) await chrome.storage.session.remove(`capture:${captureId}`);
    showStatus('保存成功，窗口即将关闭', 'success');
    setTimeout(() => window.close(), 650);
  } catch (error) {
    showStatus(WordBookShared.errorMessage(error), 'error');
  } finally {
    setSaving(false);
  }
});

document.querySelector('#cancel').addEventListener('click', () => window.close());
document.querySelector('#settings').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.close();
  if (event.ctrlKey && event.key === 'Enter') form.requestSubmit();
});

async function initialize() {
  if (captureId) {
    const key = `capture:${captureId}`;
    const stored = await chrome.storage.session.get(key);
    const capture = stored[key];
    if (capture) {
      wordInput.value = capture.word || '';
    }
  }

  const config = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  if (!config.serverUrl || !config.apiToken) {
    showStatus('首次使用请先在设置中填写服务器地址和扩展令牌', 'info');
  }

  if (wordInput.value) meaningInput.focus();
  else wordInput.focus();
}

function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = `status visible ${type}`;
}

function setSaving(saving) {
  saveButton.disabled = saving;
  saveButton.textContent = saving ? '保存中…' : '保存';
}
