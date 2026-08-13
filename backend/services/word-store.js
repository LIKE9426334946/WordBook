const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_VERSION = 3;
const DEFAULT_DIRECTORY_ID = 'default';
const DEFAULT_DIRECTORY_NAME = '默认目录';

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
      const initialState = this.#initialState();
      this.#write(initialState);
      return initialState;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));

      if (parsed.version === 2 && Array.isArray(parsed.words)) {
        const migratedState = {
          version: DATA_VERSION,
          directories: [this.#defaultDirectory()],
          words: parsed.words.map((word) => ({ ...word, directoryId: DEFAULT_DIRECTORY_ID })),
        };
        this.#write(migratedState);
        return migratedState;
      }

      if (parsed.version !== DATA_VERSION) {
        const initialState = this.#initialState();
        this.#write(initialState);
        return initialState;
      }

      const words = parsed.words;
      const parsedDirectories = parsed.directories;

      if (!Array.isArray(words) || !Array.isArray(parsedDirectories)) {
        throw new Error('words 或 directories 字段不是数组');
      }

      const directories = parsedDirectories.filter(
        (directory) => directory && typeof directory.id === 'string' && typeof directory.name === 'string',
      );
      if (!directories.some((directory) => directory.id === DEFAULT_DIRECTORY_ID)) {
        directories.unshift(this.#defaultDirectory());
      }

      const directoryIds = new Set(directories.map((directory) => directory.id));
      const normalizedWords = words.map((word) => ({
        ...word,
        directoryId: directoryIds.has(word.directoryId) ? word.directoryId : DEFAULT_DIRECTORY_ID,
      }));
      const normalizedState = { version: DATA_VERSION, directories, words: normalizedWords };

      if (JSON.stringify(normalizedState) !== JSON.stringify(parsed)) this.#write(normalizedState);
      return normalizedState;
    } catch (error) {
      throw new Error(`无法读取单词数据文件 ${this.filePath}: ${error.message}`);
    }
  }

  #initialState() {
    return { version: DATA_VERSION, directories: [this.#defaultDirectory()], words: [] };
  }

  #defaultDirectory() {
    return {
      id: DEFAULT_DIRECTORY_ID,
      name: DEFAULT_DIRECTORY_NAME,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }

  #write(nextState) {
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  #persist(words = this.state.words, directories = this.state.directories) {
    const nextState = { version: DATA_VERSION, directories, words };
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

  #normalizedDirectoryName(name) {
    return name.trim().toLocaleLowerCase('zh-CN');
  }

  #findDirectoryDuplicate(name, ignoredId = null) {
    const normalized = this.#normalizedDirectoryName(name);
    return this.state.directories.find(
      (directory) => directory.id !== ignoredId
        && this.#normalizedDirectoryName(directory.name) === normalized,
    );
  }

  #resolveDirectoryId(directoryId, fallbackId = DEFAULT_DIRECTORY_ID) {
    const resolvedId = directoryId || fallbackId;
    if (!this.state.directories.some((directory) => directory.id === resolvedId)) {
      throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到这个目录');
    }
    return resolvedId;
  }

  list({ query = '', sort = 'updated-desc', directoryId = '' } = {}) {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');

    const filtered = this.state.words.filter((item) => {
      const searchable = [
        item.word,
        item.meaning,
        item.notes,
        ...(item.examples || []),
      ]
        .join(' ')
        .toLocaleLowerCase('zh-CN');

      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesDirectory = !directoryId || item.directoryId === directoryId;
      return matchesQuery && matchesDirectory;
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

  listDirectories() {
    const counts = new Map();
    this.state.words.forEach((word) => {
      counts.set(word.directoryId, (counts.get(word.directoryId) || 0) + 1);
    });

    return this.state.directories
      .map((directory) => ({ ...directory, wordCount: counts.get(directory.id) || 0 }))
      .sort((a, b) => {
        if (a.id === DEFAULT_DIRECTORY_ID) return -1;
        if (b.id === DEFAULT_DIRECTORY_ID) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }

  createDirectory(payload) {
    const duplicate = this.#findDirectoryDuplicate(payload.name);
    if (duplicate) {
      throw new StoreError('DIRECTORY_EXISTS', `“${duplicate.name}”目录已存在`, duplicate);
    }

    const now = new Date().toISOString();
    const directory = {
      id: crypto.randomUUID(),
      name: payload.name,
      createdAt: now,
      updatedAt: now,
    };
    this.#persist(this.state.words, [...this.state.directories, directory]);
    return { ...directory, wordCount: 0 };
  }

  updateDirectory(id, payload) {
    const index = this.state.directories.findIndex((directory) => directory.id === id);
    if (index === -1) throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到这个目录');

    const duplicate = this.#findDirectoryDuplicate(payload.name, id);
    if (duplicate) {
      throw new StoreError('DIRECTORY_EXISTS', `“${duplicate.name}”目录已存在`, duplicate);
    }

    const directories = [...this.state.directories];
    directories[index] = {
      ...directories[index],
      name: payload.name,
      updatedAt: new Date().toISOString(),
    };
    this.#persist(this.state.words, directories);
    return {
      ...directories[index],
      wordCount: this.state.words.filter((word) => word.directoryId === id).length,
    };
  }

  moveDirectoryWords(sourceId, targetId) {
    const source = this.state.directories.find((directory) => directory.id === sourceId);
    if (!source) throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到来源目录');

    const target = this.state.directories.find((directory) => directory.id === targetId);
    if (!target) throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到目标目录');

    if (sourceId === targetId) {
      throw new StoreError('SAME_DIRECTORY', '来源目录和目标目录不能相同');
    }

    const movedAt = new Date().toISOString();
    let movedCount = 0;
    const words = this.state.words.map((word) => {
      if (word.directoryId !== sourceId) return word;
      movedCount += 1;
      return { ...word, directoryId: targetId, updatedAt: movedAt };
    });

    if (movedCount > 0) this.#persist(words);
    return { source, target, movedCount };
  }

  deleteDirectory(id) {
    if (id === DEFAULT_DIRECTORY_ID) {
      throw new StoreError('DEFAULT_DIRECTORY', '默认目录不能删除');
    }
    const directory = this.state.directories.find((item) => item.id === id);
    if (!directory) throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到这个目录');

    const words = this.state.words.map((word) => (
      word.directoryId === id ? { ...word, directoryId: DEFAULT_DIRECTORY_ID } : word
    ));
    const directories = this.state.directories.filter((item) => item.id !== id);
    this.#persist(words, directories);
    return directory;
  }

  create(payload) {
    const duplicate = this.#findDuplicate(payload.word);
    if (duplicate) {
      throw new StoreError('WORD_EXISTS', `“${duplicate.word}”已经收录`, duplicate);
    }

    const now = new Date().toISOString();
    const word = {
      id: crypto.randomUUID(),
      word: payload.word,
      meaning: payload.meaning,
      examples: payload.examples,
      notes: payload.notes,
      directoryId: this.#resolveDirectoryId(payload.directoryId),
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
      id,
      word: payload.word,
      meaning: payload.meaning,
      examples: payload.examples,
      notes: payload.notes,
      directoryId: this.#resolveDirectoryId(
        payload.directoryId,
        this.state.words[index].directoryId || DEFAULT_DIRECTORY_ID,
      ),
      createdAt: this.state.words[index].createdAt,
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

    return {
      total: this.state.words.length,
      addedToday: this.state.words.filter((item) => beijingDate(item.createdAt) === today).length,
    };
  }
}

module.exports = { DATA_VERSION, DEFAULT_DIRECTORY_ID, StoreError, WordStore };
