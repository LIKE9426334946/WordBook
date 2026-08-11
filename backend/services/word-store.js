const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class StoreError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.details = details;
  }
}

class WordStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = this.#load();
  }

  #load() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      const initialState = { version: 1, words: [] };
      this.#write(initialState);
      return initialState;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const words = Array.isArray(parsed) ? parsed : parsed.words;

      if (!Array.isArray(words)) {
        throw new Error('words 字段不是数组');
      }

      return { version: 1, words };
    } catch (error) {
      throw new Error(`无法读取单词数据文件 ${this.filePath}: ${error.message}`);
    }
  }

  #write(nextState) {
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  #persist(words) {
    const nextState = { version: 1, words };
    this.#write(nextState);
    this.state = nextState;
  }

  #normalizedWord(word) {
    return word.trim().toLocaleLowerCase('en-US');
  }

  #findDuplicate(word, ignoredId = null) {
    const normalized = this.#normalizedWord(word);
    return this.state.words.find(
      (item) => item.id !== ignoredId && this.#normalizedWord(item.word) === normalized,
    );
  }

  list({ query = '', tag = '', sort = 'updated-desc' } = {}) {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    const normalizedTag = tag.trim().toLocaleLowerCase('zh-CN');

    const filtered = this.state.words.filter((item) => {
      const searchable = [
        item.word,
        item.meaning,
        item.notes,
        item.sourcePdf,
        ...(item.examples || []),
        ...(item.tags || []),
      ]
        .join(' ')
        .toLocaleLowerCase('zh-CN');

      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesTag =
        !normalizedTag ||
        (item.tags || []).some((itemTag) => itemTag.toLocaleLowerCase('zh-CN') === normalizedTag);
      return matchesQuery && matchesTag;
    });

    const sorters = {
      'created-desc': (a, b) => b.createdAt.localeCompare(a.createdAt),
      'updated-desc': (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      'word-asc': (a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }),
    };

    return filtered.sort(sorters[sort] || sorters['updated-desc']);
  }

  getById(id) {
    return this.state.words.find((item) => item.id === id) || null;
  }

  create(payload) {
    const duplicate = this.#findDuplicate(payload.word);
    if (duplicate) {
      throw new StoreError('WORD_EXISTS', `“${duplicate.word}”已经收录`, duplicate);
    }

    const now = new Date().toISOString();
    const word = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };

    this.#persist([word, ...this.state.words]);
    return word;
  }

  update(id, payload) {
    const index = this.state.words.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new StoreError('NOT_FOUND', '没有找到这个单词');
    }

    const duplicate = this.#findDuplicate(payload.word, id);
    if (duplicate) {
      throw new StoreError('WORD_EXISTS', `“${duplicate.word}”已经收录`, duplicate);
    }

    const updated = {
      ...this.state.words[index],
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
    };
    const words = [...this.state.words];
    words[index] = updated;
    this.#persist(words);
    return updated;
  }

  delete(id) {
    const word = this.getById(id);
    if (!word) {
      throw new StoreError('NOT_FOUND', '没有找到这个单词');
    }

    this.#persist(this.state.words.filter((item) => item.id !== id));
    return word;
  }

  stats() {
    const beijingDate = (value) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value));
    const today = beijingDate(new Date());
    const tags = new Set();
    const sources = new Set();

    for (const item of this.state.words) {
      for (const tag of item.tags || []) tags.add(tag.toLocaleLowerCase('zh-CN'));
      if (item.sourcePdf) sources.add(item.sourcePdf.toLocaleLowerCase('zh-CN'));
    }

    return {
      total: this.state.words.length,
      addedToday: this.state.words.filter((item) => beijingDate(item.createdAt) === today).length,
      tagCount: tags.size,
      sourceCount: sources.size,
    };
  }
}

module.exports = { StoreError, WordStore };
