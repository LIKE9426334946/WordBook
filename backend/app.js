const crypto = require('node:crypto');
const path = require('node:path');
const cors = require('cors');
const express = require('express');
const { StoreError, WordStore } = require('./services/word-store');

const MAX_TEXT_LENGTH = {
  word: 100,
  meaning: 1000,
  notes: 2000,
};

function cleanText(value, maximumLength) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maximumLength);
}

function cleanList(value, { maximumItems, maximumLength, splitLines = false }) {
  let values = value;
  if (typeof values === 'string') {
    values = values.split(splitLines ? /\r?\n/ : /[,，]/);
  }
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values
    .map((item) => cleanText(item, maximumLength))
    .filter((item) => {
      const key = item.toLocaleLowerCase('zh-CN');
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maximumItems);
}

function validateWordPayload(body = {}) {
  const word = cleanText(body.word, MAX_TEXT_LENGTH.word);
  const meaning = cleanText(body.meaning, MAX_TEXT_LENGTH.meaning);
  const notes = cleanText(body.notes, MAX_TEXT_LENGTH.notes);
  const examples = cleanList(body.examples ?? body.example, {
    maximumItems: 10,
    maximumLength: 500,
    splitLines: true,
  });

  const errors = [];
  if (!word) errors.push({ field: 'word', message: '请输入单词' });
  if (!meaning) errors.push({ field: 'meaning', message: '请输入释义' });

  if (errors.length) {
    const error = new Error('提交内容有误');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }

  return { word, meaning, examples, notes };
}

function safeTokenEquals(providedToken, expectedToken) {
  if (!providedToken || !expectedToken) return false;
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function createApp({
  dataFile = path.join(__dirname, '../data/words.json'),
  extensionToken = process.env.EXTENSION_API_TOKEN || '',
} = {}) {
  const app = express();
  const store = new WordStore(dataFile);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use(
    '/api/extension',
    cors({
      origin: '*',
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Extension-Token'],
      maxAge: 86400,
    }),
  );

  app.get('/api/health', (request, response) => {
    response.json({ ok: true, service: 'WordBook', time: new Date().toISOString() });
  });

  app.get('/api/words/stats', (request, response) => {
    response.json({ data: store.stats() });
  });

  app.get('/api/words', (request, response) => {
    const query = cleanText(request.query.q, 200);
    const sort = cleanText(request.query.sort, 30);
    const words = store.list({ query, sort });
    response.json({ data: words, meta: { total: words.length, query, sort } });
  });

  app.get('/api/words/:id', (request, response) => {
    const word = store.getById(request.params.id);
    if (!word) {
      return response.status(404).json({ error: { code: 'NOT_FOUND', message: '没有找到这个单词' } });
    }
    return response.json({ data: word });
  });

  app.post('/api/words', (request, response, next) => {
    try {
      const word = store.create(validateWordPayload(request.body));
      response.status(201).json({ data: word, message: '单词已添加' });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/words/:id', (request, response, next) => {
    try {
      const word = store.update(request.params.id, validateWordPayload(request.body));
      response.json({ data: word, message: '单词已更新' });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/words/:id', (request, response, next) => {
    try {
      const word = store.delete(request.params.id);
      response.json({ data: word, message: '单词已删除' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/extension/words', (request, response, next) => {
    try {
      if (!extensionToken) {
        return response.status(503).json({
          error: { code: 'TOKEN_NOT_CONFIGURED', message: '服务器尚未配置扩展访问令牌' },
        });
      }

      const authorization = request.get('authorization') || '';
      const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
      const providedToken = bearerToken || request.get('x-extension-token') || '';

      if (!safeTokenEquals(providedToken, extensionToken)) {
        return response.status(401).json({
          error: { code: 'UNAUTHORIZED', message: '扩展访问令牌无效' },
        });
      }

      const word = store.create(validateWordPayload(request.body));
      return response.status(201).json({ data: word, message: '已添加到单词本' });
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api', (request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
  });

  app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);

    if (error instanceof StoreError) {
      const status = error.code === 'WORD_EXISTS' ? 409 : 404;
      return response.status(status).json({
        error: { code: error.code, message: error.message, existing: error.details },
      });
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return response.status(400).json({
        error: { code: 'INVALID_JSON', message: '请求内容不是有效的 JSON' },
      });
    }

    const status = error.status || 500;
    if (status >= 500) console.error(error);
    return response.status(status).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: status >= 500 ? '服务器暂时无法处理请求' : error.message,
        details: error.details || undefined,
      },
    });
  });

  return app;
}

module.exports = { createApp, validateWordPayload };
