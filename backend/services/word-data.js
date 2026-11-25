const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_VERSION = 4;
const DEFAULT_DIRECTORY_ID = '1';
const DEFAULT_DIRECTORY_NAME = '默认目录';
const DEFAULT_SUBDIRECTORY_NAME = '未分类';
const LEGACY_DEFAULT_DIRECTORY_ID = 'default';
const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});

function beijingDate(value = new Date()) {
  return dateFormat.format(value);
}

function makeDirectory(firstId, name) {
  return {
    id: String(firstId),
    name,
    subdirectories: [{ id: String(firstId + 1), name: DEFAULT_SUBDIRECTORY_NAME }],
  };
}

function initialState() {
  return {
    version: DATA_VERSION,
    nextId: 3,
    directories: [makeDirectory(Number(DEFAULT_DIRECTORY_ID), DEFAULT_DIRECTORY_NAME)],
    words: [],
  };
}

function writeAtomically(filePath, content) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function writeWordData(filePath, state) {
  const words = state.words.map(({ directoryId, ...word }) => word);
  writeAtomically(filePath, `${JSON.stringify({ ...state, words }, null, 2)}\n`);
}

function isLegacyDirectory(directory) {
  return directory && typeof directory.id === 'string' && typeof directory.name === 'string';
}

function timestamp(value) {
  return Date.parse(value) || 0;
}

function contentFields({ word, meaning, examples, notes }) {
  return {
    word,
    meaning,
    examples: Array.isArray(examples) ? examples : [],
    notes: typeof notes === 'string' ? notes : '',
  };
}

function migrateLegacyData(parsed) {
  const oldDirectories = parsed.version === 3 ? parsed.directories : [];
  if (!Array.isArray(oldDirectories) || !Array.isArray(parsed.words)) {
    throw new Error('words 或 directories 字段不是数组');
  }

  let nextId = 1;
  const directoryAliases = Object.create(null);
  const wordAliases = Object.create(null);
  const locations = new Map();
  const sourceDirectories = oldDirectories.filter(isLegacyDirectory);
  const defaultDirectory = sourceDirectories.find((directory) => directory.id === LEGACY_DEFAULT_DIRECTORY_ID)
    || { id: LEGACY_DEFAULT_DIRECTORY_ID, name: DEFAULT_DIRECTORY_NAME };
  const customDirectories = sourceDirectories.filter((directory) => directory.id !== LEGACY_DEFAULT_DIRECTORY_ID)
    .sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));

  const directories = [defaultDirectory, ...customDirectories].map((directory) => {
    const id = String(nextId++);
    const oldSubdirectories = Array.isArray(directory.subdirectories)
      ? directory.subdirectories.filter(isLegacyDirectory) : [];
    const oldDefaultId = `${directory.id}:default`;
    const oldDefault = oldSubdirectories.find((subdirectory) => subdirectory.id === oldDefaultId)
      || { id: oldDefaultId, name: DEFAULT_SUBDIRECTORY_NAME };
    const subdirectoryIds = new Map();
    const subdirectories = [oldDefault, ...oldSubdirectories.filter((item) => item.id !== oldDefaultId)]
      .map((subdirectory) => {
        const subdirectoryId = String(nextId++);
        subdirectoryIds.set(subdirectory.id, subdirectoryId);
        directoryAliases[subdirectory.id] = subdirectoryId;
        return { id: subdirectoryId, name: subdirectory.name };
      });
    locations.set(directory.id, { id, defaultSubdirectoryId: subdirectories[0].id, subdirectoryIds });
    directoryAliases[directory.id] = id;
    return { id, name: directory.name, subdirectories };
  });

  const date = beijingDate();
  const todayIds = [];
  const importedWords = new Map();
  const byCreation = [...parsed.words].reverse().sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));
  for (const word of byCreation) {
    const location = locations.get(word.directoryId) || locations.get(LEGACY_DEFAULT_DIRECTORY_ID);
    const id = String(nextId++);
    importedWords.set(word, {
      id,
      subdirectoryId: location.subdirectoryIds.get(word.subdirectoryId) || location.defaultSubdirectoryId,
      ...contentFields(word),
      directoryId: location.id,
    });
    if (typeof word.id === 'string') wordAliases[word.id] = id;
    const addedAt = timestamp(word.createdAt);
    if (addedAt && beijingDate(addedAt) === date) todayIds.push(id);
  }

  const words = [...parsed.words].sort((a, b) => (
    timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt)
  )).map((word) => importedWords.get(word));

  const state = { version: DATA_VERSION, nextId, directories, words };
  if (todayIds.length) state.today = { date, wordIds: todayIds };
  return { state, legacyIds: { words: wordAliases, directories: directoryAliases } };
}

function readCompactState(parsed) {
  if (!Array.isArray(parsed.directories) || !Array.isArray(parsed.words)) {
    throw new Error('words 或 directories 字段不是数组');
  }

  const ids = new Set();
  let largestId = 0;
  function registerId(id) {
    const number = Number(id);
    if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(number) || ids.has(id)) {
      throw new Error(`数据中存在无效或重复的编号 ${id}`);
    }
    largestId = Math.max(largestId, number);
    ids.add(id);
  }

  const parentBySubdirectory = new Map();
  const directories = parsed.directories.map(({ id, name, subdirectories }) => {
    registerId(id);
    if (!Array.isArray(subdirectories) || !subdirectories.length) throw new Error(`目录 ${id} 缺少默认子目录`);
    return {
      id,
      name,
      subdirectories: subdirectories.map((subdirectory) => {
        registerId(subdirectory.id);
        parentBySubdirectory.set(subdirectory.id, id);
        return { id: subdirectory.id, name: subdirectory.name };
      }),
    };
  });
  if (!directories.some((directory) => directory.id === DEFAULT_DIRECTORY_ID)) {
    throw new Error('缺少默认目录');
  }

  const words = parsed.words.map((word) => {
    registerId(word.id);
    const directoryId = parentBySubdirectory.get(word.subdirectoryId);
    if (!directoryId) throw new Error(`单词 ${word.id} 的子目录不存在`);
    return { id: word.id, subdirectoryId: word.subdirectoryId, ...contentFields(word), directoryId };
  });
  if (!Number.isSafeInteger(parsed.nextId) || parsed.nextId <= largestId) {
    throw new Error('nextId 必须大于已用编号');
  }

  const state = { version: DATA_VERSION, nextId: parsed.nextId, directories, words };
  if (typeof parsed.today?.date === 'string' && Array.isArray(parsed.today.wordIds)) {
    state.today = parsed.today;
  }
  if (parsed.migrationBackup) state.migrationBackup = parsed.migrationBackup;
  return state;
}

function backupKey(source) {
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
}

function backupPath(filePath, key) {
  return `${filePath}.pre-v4-${key}.bak`;
}

function readLegacyIds(filePath, key) {
  if (typeof key !== 'string' || !/^[a-f0-9]{12}$/.test(key)) return null;
  try {
    const source = fs.readFileSync(backupPath(filePath, key), 'utf8');
    return backupKey(source) === key ? migrateLegacyData(JSON.parse(source)).legacyIds : null;
  } catch {
    return null;
  }
}

function loadWordData(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      const state = initialState();
      writeWordData(filePath, state);
      return { state, legacyIds: null };
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(source);
    if (parsed.version === DATA_VERSION) {
      return { state: readCompactState(parsed), legacyIds: readLegacyIds(filePath, parsed.migrationBackup) };
    }
    if (![1, 2, 3].includes(parsed.version)) throw new Error(`不支持的数据版本 ${parsed.version}`);
    if (parsed.version === 1 && Array.isArray(parsed.words) && !parsed.words.length) {
      const state = initialState();
      writeWordData(filePath, state);
      return { state, legacyIds: null };
    }

    const { state, legacyIds } = migrateLegacyData(parsed);
    const key = backupKey(source);
    const backup = backupPath(filePath, key);
    if (!fs.existsSync(backup)) writeAtomically(backup, source);
    state.migrationBackup = key;
    writeWordData(filePath, state);
    return { state, legacyIds };
  } catch (error) {
    throw new Error(`无法读取单词数据文件 ${filePath}: ${error.message}`);
  }
}

module.exports = { DATA_VERSION, DEFAULT_DIRECTORY_ID, beijingDate, loadWordData, makeDirectory, writeWordData };
