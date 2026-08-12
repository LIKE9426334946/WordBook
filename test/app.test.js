const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('../backend/app');
const { WordStore } = require('../backend/services/word-store');

async function withServer(run) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-test-'));
  const app = createApp({
    dataFile: path.join(temporaryDirectory, 'words.json'),
    extensionToken: 'test-extension-token',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

test('health endpoint reports service status', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'WordBook');
  });
});

test('web API supports create, search, update, stats and delete', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/words`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        word: 'gradient',
        meaning: '梯度',
        examples: ['The gradient points uphill.'],
        notes: '优化算法中的常用概念',
        sourcePdf: 'deep-learning.pdf',
        page: 42,
        tags: ['论文', '数学'],
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()).data;
    assert.equal(created.notes, '优化算法中的常用概念');
    assert.equal(created.directoryId, 'default');
    assert.equal(Object.hasOwn(created, 'sourcePdf'), false);
    assert.equal(Object.hasOwn(created, 'page'), false);
    assert.equal(Object.hasOwn(created, 'tags'), false);

    const listResponse = await fetch(`${baseUrl}/api/words?q=梯度`);
    const list = await listResponse.json();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].word, 'gradient');

    const updateResponse = await fetch(`${baseUrl}/api/words/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...created, meaning: '梯度；变化率' }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.meaning, '梯度；变化率');

    const statsResponse = await fetch(`${baseUrl}/api/words/stats`);
    const stats = (await statsResponse.json()).data;
    assert.equal(stats.total, 1);
    assert.equal(stats.addedToday, 1);

    const deleteResponse = await fetch(`${baseUrl}/api/words/${created.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.equal((await deleteResponse.json()).data.word, 'gradient');
  });
});

test('directory API organizes words and safely moves them when a directory is deleted', async () => {
  await withServer(async (baseUrl) => {
    const initialDirectories = (await (await fetch(`${baseUrl}/api/directories`)).json()).data;
    assert.deepEqual(initialDirectories.map((directory) => directory.name), ['默认目录']);

    const createDirectoryResponse = await fetch(`${baseUrl}/api/directories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '神经网络' }),
    });
    assert.equal(createDirectoryResponse.status, 201);
    const directory = (await createDirectoryResponse.json()).data;

    const createWordResponse = await fetch(`${baseUrl}/api/words`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        word: 'backpropagation',
        meaning: '反向传播',
        directoryId: directory.id,
      }),
    });
    const word = (await createWordResponse.json()).data;
    assert.equal(word.directoryId, directory.id);

    const filtered = await fetch(`${baseUrl}/api/words?directoryId=${directory.id}`);
    const filteredBody = await filtered.json();
    assert.equal(filteredBody.data.length, 1);
    assert.equal(
      filteredBody.meta.directories.find((item) => item.id === directory.id).wordCount,
      1,
    );

    const renameResponse = await fetch(`${baseUrl}/api/directories/${directory.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '深度学习' }),
    });
    assert.equal(renameResponse.status, 200);
    assert.equal((await renameResponse.json()).data.name, '深度学习');

    const deleteResponse = await fetch(`${baseUrl}/api/directories/${directory.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 200);

    const movedWord = (await (await fetch(`${baseUrl}/api/words/${word.id}`)).json()).data;
    assert.equal(movedWord.directoryId, 'default');
    const remainingDirectories = (await (await fetch(`${baseUrl}/api/directories`)).json()).data;
    assert.deepEqual(remainingDirectories.map((item) => item.id), ['default']);

    const deleteDefaultResponse = await fetch(`${baseUrl}/api/directories/default`, {
      method: 'DELETE',
    });
    assert.equal(deleteDefaultResponse.status, 400);
  });
});

test('extension API verifies token and rejects duplicate words', async () => {
  await withServer(async (baseUrl) => {
    const preflight = await fetch(`${baseUrl}/api/extension/words`, {
      method: 'OPTIONS',
      headers: {
        origin: 'chrome-extension://example-extension-id',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');

    const payload = {
      word: 'neuron',
      meaning: '神经元',
      examples: ['A neuron receives signals.'],
      notes: '神经网络的基本单元',
    };
    const unauthorized = await fetch(`${baseUrl}/api/extension/words`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(unauthorized.status, 401);

    const create = () =>
      fetch(`${baseUrl}/api/extension/words`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-extension-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

    const created = await create();
    assert.equal(created.status, 201);
    assert.equal((await created.json()).data.notes, '神经网络的基本单元');

    const duplicate = await fetch(`${baseUrl}/api/extension/words`, {
      method: 'POST',
      headers: {
        'x-extension-token': 'test-extension-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...payload, word: ' NEURON ' }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'WORD_EXISTS');
  });
});

test('API returns useful validation errors', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/words`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: '', meaning: '' }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.details.length, 2);
  });
});

test('version 1 data is discarded and replaced by an empty directory-aware store', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-store-test-'));
  const dataFile = path.join(temporaryDirectory, 'words.json');
  fs.writeFileSync(dataFile, JSON.stringify({
    version: 1,
    words: [{
      id: 'legacy',
      word: 'legacy',
      meaning: '旧数据',
      sourcePdf: 'old.pdf',
      tags: ['旧标签'],
    }],
  }));

  try {
    const store = new WordStore(dataFile);
    assert.deepEqual(store.list(), []);
    const stored = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(stored.version, 3);
    assert.deepEqual(stored.words, []);
    assert.deepEqual(stored.directories.map((directory) => directory.id), ['default']);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('version 2 words migrate into the default directory without data loss', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-migration-test-'));
  const dataFile = path.join(temporaryDirectory, 'words.json');
  const legacyWord = {
    id: 'kept-word',
    word: 'preserve',
    meaning: '保留',
    examples: ['Preserve existing words.'],
    notes: '迁移测试',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  fs.writeFileSync(dataFile, JSON.stringify({ version: 2, words: [legacyWord] }));

  try {
    const store = new WordStore(dataFile);
    const words = store.list();
    assert.equal(words.length, 1);
    assert.deepEqual(words[0], { ...legacyWord, directoryId: 'default' });
    assert.equal(JSON.parse(fs.readFileSync(dataFile, 'utf8')).version, 3);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
