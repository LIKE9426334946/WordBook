const {
  DATA_VERSION,
  DEFAULT_DIRECTORY_ID,
  beijingDate,
  loadWordData,
  makeDirectory,
  writeWordData,
} = require('./word-data');

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
    const { state, legacyIds } = loadWordData(filePath);
    this.state = state;
    this.legacyIds = legacyIds;
  }

  #persist(changes) {
    const nextState = { ...this.state, ...changes };
    if (!Number.isSafeInteger(nextState.nextId)) throw new Error('单词本编号已超出范围');
    writeWordData(this.filePath, nextState);
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

  #checkDirectoryName(directories, name, ignoredId = null) {
    const normalized = this.#normalizedDirectoryName(name);
    const duplicate = directories.find(
      (directory) => directory.id !== ignoredId
        && this.#normalizedDirectoryName(directory.name) === normalized,
    );
    if (duplicate) {
      throw new StoreError('DIRECTORY_EXISTS', `“${duplicate.name}”目录已存在`, duplicate);
    }
  }

  #getDirectory(id) {
    const directory = this.state.directories.find((item) => item.id === id);
    if (!directory) throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到这个目录');
    return directory;
  }

  #getSubdirectory(directory, id) {
    const subdirectory = directory.subdirectories.find((item) => item.id === id);
    if (!subdirectory) throw new StoreError('SUBDIRECTORY_NOT_FOUND', '没有在所选目录下找到这个子目录');
    return subdirectory;
  }

  #resolveWordLocation(payload, previousWord) {
    const directoryId = payload.directoryId || previousWord?.directoryId || DEFAULT_DIRECTORY_ID;
    const directory = this.#getDirectory(directoryId);
    const previousSubdirectoryId = directoryId === previousWord?.directoryId
      ? previousWord.subdirectoryId : '';
    const subdirectoryId = payload.subdirectoryId || previousSubdirectoryId || directory.subdirectories[0].id;
    this.#getSubdirectory(directory, subdirectoryId);
    return { directoryId, subdirectoryId };
  }

  list({ query = '', sort = 'updated-desc', directoryId = '', subdirectoryId = '' } = {}) {
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
      const matchesSubdirectory = !subdirectoryId || item.subdirectoryId === subdirectoryId;
      return matchesQuery && matchesDirectory && matchesSubdirectory;
    });

    if (sort === 'created-desc') return filtered.sort((a, b) => Number(b.id) - Number(a.id));
    if (sort === 'word-asc') return filtered.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
    return filtered;
  }

  getById(id) {
    return this.state.words.find((item) => item.id === id) || null;
  }

  listDirectories() {
    const directoryCounts = new Map();
    const subdirectoryCounts = new Map();
    this.state.words.forEach((word) => {
      directoryCounts.set(word.directoryId, (directoryCounts.get(word.directoryId) || 0) + 1);
      subdirectoryCounts.set(word.subdirectoryId, (subdirectoryCounts.get(word.subdirectoryId) || 0) + 1);
    });

    return this.state.directories
      .map((directory) => ({
        ...directory,
        wordCount: directoryCounts.get(directory.id) || 0,
        defaultSubdirectoryId: directory.subdirectories[0].id,
        subdirectories: directory.subdirectories.map((subdirectory) => ({
          ...subdirectory,
          wordCount: subdirectoryCounts.get(subdirectory.id) || 0,
        })),
      }));
  }

  createDirectory(payload) {
    this.#checkDirectoryName(this.state.directories, payload.name);

    const directory = makeDirectory(this.state.nextId, payload.name);
    this.#persist({
      nextId: this.state.nextId + 2,
      directories: [...this.state.directories, directory],
    });
    return { ...directory, wordCount: 0 };
  }

  updateDirectory(id, payload) {
    const index = this.state.directories.findIndex((directory) => directory.id === id);
    if (index === -1) throw new StoreError('DIRECTORY_NOT_FOUND', '没有找到这个目录');

    this.#checkDirectoryName(this.state.directories, payload.name, id);

    const directories = [...this.state.directories];
    directories[index] = { ...directories[index], name: payload.name };
    this.#persist({ directories });
    return {
      ...directories[index],
      wordCount: this.state.words.filter((word) => word.directoryId === id).length,
    };
  }

  #updateSubdirectories(directory, subdirectories, changes = {}) {
    const directories = this.state.directories.map((item) => (
      item.id === directory.id ? { ...item, subdirectories } : item
    ));
    this.#persist({ ...changes, directories });
  }

  createSubdirectory(directoryId, { name }) {
    const directory = this.#getDirectory(directoryId);
    this.#checkDirectoryName(directory.subdirectories, name);
    const subdirectory = { id: String(this.state.nextId), name };
    this.#updateSubdirectories(directory, [...directory.subdirectories, subdirectory], { nextId: this.state.nextId + 1 });
    return { ...subdirectory, wordCount: 0 };
  }

  updateSubdirectory(directoryId, subdirectoryId, { name }) {
    const directory = this.#getDirectory(directoryId);
    const subdirectory = this.#getSubdirectory(directory, subdirectoryId);
    this.#checkDirectoryName(directory.subdirectories, name, subdirectoryId);
    const updated = { ...subdirectory, name };
    this.#updateSubdirectories(directory, directory.subdirectories.map((item) => (
      item.id === subdirectoryId ? updated : item
    )));
    return updated;
  }

  deleteSubdirectory(directoryId, subdirectoryId) {
    const directory = this.#getDirectory(directoryId);
    const subdirectory = this.#getSubdirectory(directory, subdirectoryId);
    const fallbackId = directory.subdirectories[0].id;
    if (subdirectoryId === fallbackId) {
      throw new StoreError('DEFAULT_SUBDIRECTORY', '默认子目录不能删除');
    }

    const words = this.state.words.map((word) => (
      word.directoryId === directoryId && word.subdirectoryId === subdirectoryId
        ? { ...word, subdirectoryId: fallbackId } : word
    ));
    const subdirectories = directory.subdirectories.filter((item) => item.id !== subdirectoryId);
    this.#updateSubdirectories(directory, subdirectories, { words });
    return subdirectory;
  }

  #moveMatchingWords(location, matches) {
    const moved = [];
    const remaining = [];
    for (const word of this.state.words) {
      if (matches(word) && word.subdirectoryId !== location.subdirectoryId) moved.push({ ...word, ...location });
      else remaining.push(word);
    }

    if (moved.length) this.#persist({ words: [...moved, ...remaining] });
    return moved.length;
  }

  moveDirectoryWords(sourceId, targetId, { sourceSubdirectoryId, targetSubdirectoryId } = {}) {
    const sourceDirectory = this.#getDirectory(sourceId);
    const targetDirectory = this.#getDirectory(targetId);
    const source = sourceSubdirectoryId
      ? this.#getSubdirectory(sourceDirectory, sourceSubdirectoryId) : sourceDirectory;
    const destinationId = targetSubdirectoryId || targetDirectory.subdirectories[0].id;
    const target = targetSubdirectoryId
      ? this.#getSubdirectory(targetDirectory, targetSubdirectoryId) : targetDirectory;

    if (sourceId === targetId && (sourceSubdirectoryId === destinationId
        || (!sourceSubdirectoryId && !targetSubdirectoryId))) {
      throw new StoreError('SAME_DIRECTORY', '来源目录和目标目录不能相同');
    }

    const movedCount = this.#moveMatchingWords({ directoryId: targetId, subdirectoryId: destinationId }, (word) => (
      word.directoryId === sourceId && (!sourceSubdirectoryId || word.subdirectoryId === sourceSubdirectoryId)
    ));
    return { source, target, movedCount };
  }

  moveWords(wordIds, targetId, targetSubdirectoryId) {
    const directory = this.#getDirectory(targetId);
    const target = targetSubdirectoryId ? this.#getSubdirectory(directory, targetSubdirectoryId) : directory;

    const selectedIds = new Set(wordIds);
    const existingIds = new Set(this.state.words.map((word) => word.id));
    if ([...selectedIds].some((id) => !existingIds.has(id))) {
      throw new StoreError('NOT_FOUND', '部分单词已不存在，请刷新列表后重新选择');
    }

    const location = { directoryId: targetId, subdirectoryId: targetSubdirectoryId || directory.subdirectories[0].id };
    const movedCount = this.#moveMatchingWords(location, (word) => selectedIds.has(word.id));
    return { target, movedCount };
  }

  deleteDirectory(id) {
    if (id === DEFAULT_DIRECTORY_ID) {
      throw new StoreError('DEFAULT_DIRECTORY', '默认目录不能删除');
    }
    const directory = this.#getDirectory(id);

    const fallback = {
      directoryId: DEFAULT_DIRECTORY_ID,
      subdirectoryId: this.#getDirectory(DEFAULT_DIRECTORY_ID).subdirectories[0].id,
    };
    const words = this.state.words.map((word) => (word.directoryId === id ? { ...word, ...fallback } : word));
    const directories = this.state.directories.filter((item) => item.id !== id);
    this.#persist({ words, directories });
    return directory;
  }

  create(payload) {
    const duplicate = this.#findDuplicate(payload.word);
    if (duplicate) {
      throw new StoreError('WORD_EXISTS', `“${duplicate.word}”已经收录`, duplicate);
    }

    const word = {
      id: String(this.state.nextId),
      word: payload.word,
      meaning: payload.meaning,
      examples: payload.examples,
      notes: payload.notes,
      ...this.#resolveWordLocation(payload),
    };

    const date = beijingDate();
    const todayIds = this.state.today?.date === date ? this.state.today.wordIds : [];
    this.#persist({
      nextId: this.state.nextId + 1,
      words: [word, ...this.state.words],
      today: { date, wordIds: [...todayIds, word.id] },
    });
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
      ...this.#resolveWordLocation(payload, this.state.words[index]),
    };
    this.#persist({ words: [updated, ...this.state.words.filter((word) => word.id !== id)] });
    return updated;
  }

  delete(id) {
    const word = this.getById(id);
    if (!word) {
      throw new StoreError('NOT_FOUND', '没有找到这个单词');
    }

    const words = this.state.words.filter((item) => item.id !== id);
    const today = this.state.today;
    this.#persist({
      words,
      ...(today && { today: { ...today, wordIds: today.wordIds.filter((wordId) => wordId !== id) } }),
    });
    return word;
  }

  stats() {
    const today = this.state.today;
    return {
      total: this.state.words.length,
      addedToday: today?.date === beijingDate() ? today.wordIds.length : 0,
    };
  }
}

module.exports = { DATA_VERSION, DEFAULT_DIRECTORY_ID, StoreError, WordStore };
