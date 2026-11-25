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

    const targetDirectoryResponse = await fetch(`${baseUrl}/api/directories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '已整理' }),
    });
    const targetDirectory = (await targetDirectoryResponse.json()).data;

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

    const moveResponse = await fetch(`${baseUrl}/api/directories/${directory.id}/move-words`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetDirectoryId: targetDirectory.id }),
    });
    assert.equal(moveResponse.status, 200);
    const moveResult = await moveResponse.json();
    assert.equal(moveResult.data.movedCount, 1);
    assert.equal(moveResult.data.target.id, targetDirectory.id);
    assert.equal(
      (await (await fetch(`${baseUrl}/api/words/${word.id}`)).json()).data.directoryId,
      targetDirectory.id,
    );

    const sameDirectoryMove = await fetch(
      `${baseUrl}/api/directories/${targetDirectory.id}/move-words`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetDirectoryId: targetDirectory.id }),
      },
    );
    assert.equal(sameDirectoryMove.status, 400);

    const renameResponse = await fetch(`${baseUrl}/api/directories/${directory.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '深度学习' }),
    });
    assert.equal(renameResponse.status, 200);
    assert.equal((await renameResponse.json()).data.name, '深度学习');

    const deleteResponse = await fetch(`${baseUrl}/api/directories/${targetDirectory.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 200);

    const movedWord = (await (await fetch(`${baseUrl}/api/words/${word.id}`)).json()).data;
    assert.equal(movedWord.directoryId, 'default');
    const remainingDirectories = (await (await fetch(`${baseUrl}/api/directories`)).json()).data;
    assert.deepEqual(
      remainingDirectories.map((item) => item.id),
      ['default', directory.id],
    );

    const deleteDefaultResponse = await fetch(`${baseUrl}/api/directories/default`, {
      method: 'DELETE',
    });
    assert.equal(deleteDefaultResponse.status, 400);
  });
});

test('selected-word move changes only selected words and preserves their content', async () => {
  await withServer(async (baseUrl) => {
    const post = (url, body) => fetch(`${baseUrl}${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const source = (await (await post('/api/directories', { name: '待整理' })).json()).data;
    const target = (await (await post('/api/directories', { name: '已整理' })).json()).data;
    const words = [];
    for (const [word, directoryId] of [
      ['alpha', 'default'], ['beta', source.id], ['gamma', source.id], ['delta', target.id],
    ]) {
      words.push((await (await post('/api/words', {
        word, directoryId, meaning: '测试释义', examples: ['Keep this example.'], notes: '保留备注',
      })).json()).data);
    }
    const response = await post('/api/words/move', {
      wordIds: [words[0].id, words[1].id, words[1].id, words[3].id],
      targetDirectoryId: target.id,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.movedCount, 2);
    for (const [index, before] of words.entries()) {
      const after = (await (await fetch(`${baseUrl}/api/words/${before.id}`)).json()).data;
      if (index < 2) {
        assert.deepEqual(after, {
          ...before,
          directoryId: target.id,
          subdirectoryId: target.subdirectories[0].id,
          updatedAt: after.updatedAt,
        });
      } else {
        assert.deepEqual(after, before);
      }
    }
    const directories = (await (await fetch(`${baseUrl}/api/directories`)).json()).data;
    assert.equal(directories.find((item) => item.id === 'default').wordCount, 0);
    assert.equal(directories.find((item) => item.id === source.id).wordCount, 1);
    assert.equal(directories.find((item) => item.id === target.id).wordCount, 3);
    const repeated = await post('/api/words/move', {
      wordIds: [words[0].id, words[1].id], targetDirectoryId: target.id,
    });
    assert.equal((await repeated.json()).data.movedCount, 0);
    const single = await post('/api/words/move', {
      wordIds: [words[0].id], targetDirectoryId: 'default',
    });
    assert.equal((await single.json()).data.movedCount, 1);
  });
});

test('invalid selected-word moves never partially move valid words', async () => {
  await withServer(async (baseUrl) => {
    const post = (url, body) => fetch(`${baseUrl}${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const target = (await (await post('/api/directories', { name: '目标' })).json()).data;
    const word = (await (await post('/api/words', { word: 'stay', meaning: '保留' })).json()).data;
    for (const [body, status] of [
      [{ wordIds: [], targetDirectoryId: target.id }, 400],
      [{ wordIds: word.id, targetDirectoryId: target.id }, 400],
      [{ wordIds: [word.id, null], targetDirectoryId: target.id }, 400],
      [{ wordIds: [word.id] }, 400],
      [{ wordIds: [word.id], targetDirectoryId: 'missing-directory' }, 404],
      [{ wordIds: [word.id, 'deleted-word'], targetDirectoryId: target.id }, 404],
    ]) {
      assert.equal((await post('/api/words/move', body)).status, status);
      const unchanged = (await (await fetch(`${baseUrl}/api/words/${word.id}`)).json()).data;
      assert.deepEqual(unchanged, word);
    }
  });
});

test('selected-word moves persist after reopening the store', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-move-test-'));
  const dataFile = path.join(temporaryDirectory, 'words.json');
  try {
    const store = new WordStore(dataFile);
    const target = store.createDirectory({ name: '目标' });
    const selected = store.create({ word: 'move', meaning: '移动', examples: [], notes: '' });
    const untouched = store.create({ word: 'stay', meaning: '保留', examples: [], notes: '' });
    store.moveWords([selected.id], target.id);
    const reopened = new WordStore(dataFile);
    assert.equal(reopened.getById(selected.id).directoryId, target.id);
    assert.deepEqual(reopened.getById(untouched.id), untouched);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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
      directoryId: 'extension-must-not-choose-a-directory',
      subdirectoryId: 'extension-must-not-choose-a-subdirectory',
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
    const createdWord = (await created.json()).data;
    assert.equal(createdWord.notes, '神经网络的基本单元');
    assert.equal(createdWord.directoryId, 'default');
    assert.equal(createdWord.subdirectoryId, 'default:default');

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
    assert.deepEqual(words[0], { ...legacyWord, directoryId: 'default', subdirectoryId: 'default:default' });
    assert.equal(JSON.parse(fs.readFileSync(dataFile, 'utf8')).version, 3);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('existing directories gain a default subdirectory while old word IDs and content are preserved', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-subdirectory-migration-'));
  const dataFile = path.join(temporaryDirectory, 'words.json');
  const time = '2026-11-03T10:00:00.000Z';
  const directory = { id: 'papers', name: '论文', createdAt: time, updatedAt: time };
  const word = {
    id: 'sample-word', directoryId: directory.id, word: 'sample', meaning: '样本',
    examples: ['A sample.'], notes: '原备注', createdAt: time, updatedAt: time,
  };
  fs.writeFileSync(dataFile, JSON.stringify({ version: 3, directories: [directory], words: [word] }));

  try {
    const store = new WordStore(dataFile);
    const migrated = store.listDirectories().find((item) => item.id === directory.id);
    const fallback = migrated.subdirectories[0];
    assert.equal(fallback.name, '未分类');
    assert.equal(fallback.wordCount, 1);
    assert.deepEqual(store.list({ subdirectoryId: fallback.id }), [{ ...word, subdirectoryId: fallback.id }]);
    assert.deepEqual(new WordStore(dataFile).getById(word.id), store.getById(word.id));

    const methods = store.createSubdirectory(directory.id, { name: '方法' });
    store.moveWords([word.id], directory.id, methods.id);
    const reopened = new WordStore(dataFile);
    assert.deepEqual(reopened.list({ subdirectoryId: methods.id }), [store.getById(word.id)]);
    assert.equal(reopened.listDirectories().find((item) => item.id === directory.id)
      .subdirectories.find((item) => item.id === methods.id).wordCount, 1);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('subdirectory API groups words, enforces the parent, and keeps words when folders are removed', async () => {
  await withServer(async (baseUrl) => {
    const request = async (route, method = 'GET', body) => {
      const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body && JSON.stringify(body),
      });
      return { status: response.status, ...(await response.json()) };
    };
    const { data: papers } = await request('/api/directories', 'POST', { name: '论文' });
    const { data: notes } = await request('/api/directories', 'POST', { name: '笔记' });
    const pathOf = (directory) => `/api/directories/${directory.id}/subdirectories`;
    const { data: methods } = await request(pathOf(papers), 'POST', { name: '方法' });
    const { data: results } = await request(pathOf(papers), 'POST', { name: '结果' });
    assert.equal((await request(pathOf(papers), 'POST', { name: '方法' })).status, 409);
    const { status, data: otherMethods } = await request(pathOf(notes), 'POST', { name: '方法' });
    assert.equal(status, 201);

    const methodPath = `${pathOf(papers)}/${methods.id}`;
    assert.equal((await request(`${pathOf(notes)}/${methods.id}`, 'PUT', { name: '改名' })).status, 404);
    assert.equal((await request(methodPath, 'PUT', { name: '模型方法' })).data.name, '模型方法');

    const { data: model } = await request('/api/words', 'POST', {
      word: 'model', meaning: '模型', directoryId: papers.id, subdirectoryId: methods.id,
    });
    const { data: accuracy } = await request('/api/words', 'POST', {
      word: 'accuracy', meaning: '准确率', directoryId: papers.id, subdirectoryId: results.id,
    });
    assert.equal((await request('/api/words', 'POST', {
      word: 'invalid', meaning: '无效', directoryId: notes.id, subdirectoryId: methods.id,
    })).status, 404);
    const directoryWords = await request(`/api/words?directoryId=${papers.id}`);
    assert.equal(directoryWords.data.length, 2);
    const papersSummary = directoryWords.meta.directories.find((item) => item.id === papers.id);
    assert.equal(papersSummary.wordCount, 2);
    assert.equal(papersSummary.subdirectories.find((item) => item.id === methods.id).wordCount, 1);
    assert.deepEqual((await request(`/api/words?subdirectoryId=${methods.id}`)).data, [model]);

    const updated = await request(`/api/words/${model.id}`, 'PUT', { word: 'model', meaning: '模型结构' });
    assert.equal(updated.data.subdirectoryId, methods.id);
    assert.equal((await request('/api/words/move', 'POST', {
      wordIds: [accuracy.id], targetDirectoryId: papers.id, targetSubdirectoryId: otherMethods.id,
    })).status, 404);
    assert.equal((await request(`/api/words/${accuracy.id}`)).data.subdirectoryId, results.id);
    assert.equal((await request('/api/words/move', 'POST', {
      wordIds: [accuracy.id], targetDirectoryId: papers.id, targetSubdirectoryId: methods.id,
    })).data.movedCount, 1);
    assert.equal((await request(`/api/directories/${papers.id}/move-words`, 'POST', {
      sourceSubdirectoryId: methods.id, targetDirectoryId: notes.id, targetSubdirectoryId: otherMethods.id,
    })).data.movedCount, 2);

    assert.equal((await request(`${pathOf(notes)}/${otherMethods.id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/api/words/${model.id}`)).data.subdirectoryId, notes.subdirectories[0].id);
    assert.equal((await request(`${pathOf(notes)}/${notes.subdirectories[0].id}`, 'DELETE')).status, 400);
    assert.equal((await request(`/api/directories/${notes.id}`, 'DELETE')).status, 200);
    const finalWords = (await request('/api/words')).data;
    assert.equal(finalWords.length, 2);
    assert.ok(finalWords.every((word) => word.directoryId === 'default' && word.subdirectoryId === 'default:default'));
  });
});
