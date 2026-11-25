const DEFAULT_DIRECTORY_ID = '1';
const MOBILE_FAVORITES_KEY = 'wordbook.mobile.favorites.v2';
const MOBILE_REVIEWED_DIRECTORIES_KEY = 'wordbook.mobile.reviewed-directories.v2';
const MOBILE_LAYOUT_QUERY = '(max-width: 700px), (max-width: 950px) and (pointer: coarse)';
const mobileLayoutMedia = window.matchMedia(MOBILE_LAYOUT_QUERY);

function isMobileLayout() {
  return mobileLayoutMedia.matches;
}

function loadMobileIds(key) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return null;
    const value = JSON.parse(stored);
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  } catch {
    return null;
  }
}

const storedFavorites = loadMobileIds(MOBILE_FAVORITES_KEY);
const storedReviews = loadMobileIds(MOBILE_REVIEWED_DIRECTORIES_KEY);
const pendingLegacyIds = {
  words: storedFavorites ? null : loadMobileIds('wordbook.mobile.favorites.v1'),
  directories: storedReviews ? null : loadMobileIds('wordbook.mobile.reviewed-directories.v1'),
};

const state = {
  words: [],
  directories: [],
  desktopDirectoryId: '',
  desktopSubdirectoryId: '',
  selectedWordIds: new Set(),
  movingSelectedWords: false,
  desktopLoading: true,
  wordsRequestId: 0,
  editingDirectoryId: '',
  editingSubdirectoryId: '',
  deletingWord: null,
  searchTimer: null,
  mobileIndex: 0,
  mobileExpanded: false,
  mobileView: 'study',
  mobileFavoriteIds: storedFavorites || new Set(),
  mobileReviewedDirectoryIds: storedReviews || new Set(),
  mobileOpenDirectoryId: '',
  mobileOpenSubdirectoryId: '',
  mobileDirectoryQuery: '',
  mobileDirectorySearchOpen: false,
  mobileStudySubdirectoryId: '',
  mobileDirectoryDirty: true,
  mobileFavoritesDirty: true,
};

const elements = {
  addWordButton: document.querySelector('#addWordButton'),
  emptyAddButton: document.querySelector('#emptyAddButton'),
  wordGrid: document.querySelector('#wordGrid'),
  selectedWordsMoveForm: document.querySelector('#selectedWordsMoveForm'),
  selectAllWords: document.querySelector('#selectAllWords'),
  selectedWordsSummary: document.querySelector('#selectedWordsSummary'),
  clearWordSelectionButton: document.querySelector('#clearWordSelectionButton'),
  selectedWordsTarget: document.querySelector('#selectedWordsTarget'),
  moveSelectedWordsButton: document.querySelector('#moveSelectedWordsButton'),
  emptyState: document.querySelector('#emptyState'),
  emptyTitle: document.querySelector('#emptyTitle'),
  emptyDescription: document.querySelector('#emptyDescription'),
  resultSummary: document.querySelector('#resultSummary'),
  totalStat: document.querySelector('#totalStat'),
  todayStat: document.querySelector('#todayStat'),
  todayLabel: document.querySelector('#todayLabel'),
  searchInput: document.querySelector('#searchInput'),
  sortSelect: document.querySelector('#sortSelect'),
  wordDialog: document.querySelector('#wordDialog'),
  wordForm: document.querySelector('#wordForm'),
  dialogTitle: document.querySelector('#dialogTitle'),
  closeDialogButton: document.querySelector('#closeDialogButton'),
  cancelDialogButton: document.querySelector('#cancelDialogButton'),
  submitWordButton: document.querySelector('#submitWordButton'),
  wordId: document.querySelector('#wordId'),
  wordInput: document.querySelector('#wordInput'),
  meaningInput: document.querySelector('#meaningInput'),
  examplesInput: document.querySelector('#examplesInput'),
  notesInput: document.querySelector('#notesInput'),
  directorySelect: document.querySelector('#directorySelect'),
  allWordsNav: document.querySelector('#allWordsNav'),
  desktopDirectoryList: document.querySelector('#desktopDirectoryList'),
  manageDirectoriesButton: document.querySelector('#manageDirectoriesButton'),
  directoryDialog: document.querySelector('#directoryDialog'),
  closeDirectoryDialogButton: document.querySelector('#closeDirectoryDialogButton'),
  directoryForm: document.querySelector('#directoryForm'),
  directoryParentField: document.querySelector('#directoryParentField'),
  directoryParentSelect: document.querySelector('#directoryParentSelect'),
  directoryFormLabel: document.querySelector('#directoryFormLabel'),
  directoryNameInput: document.querySelector('#directoryNameInput'),
  directoryNameError: document.querySelector('#directoryNameError'),
  submitDirectoryButton: document.querySelector('#submitDirectoryButton'),
  cancelDirectoryEditButton: document.querySelector('#cancelDirectoryEditButton'),
  directoryMoveForm: document.querySelector('#directoryMoveForm'),
  moveSourceSelect: document.querySelector('#moveSourceSelect'),
  moveTargetSelect: document.querySelector('#moveTargetSelect'),
  directoryMoveSummary: document.querySelector('#directoryMoveSummary'),
  moveDirectoryWordsButton: document.querySelector('#moveDirectoryWordsButton'),
  directoryManagerList: document.querySelector('#directoryManagerList'),
  deleteDialog: document.querySelector('#deleteDialog'),
  deleteWordName: document.querySelector('#deleteWordName'),
  cancelDeleteButton: document.querySelector('#cancelDeleteButton'),
  confirmDeleteButton: document.querySelector('#confirmDeleteButton'),
  toast: document.querySelector('#toast'),
  toastMessage: document.querySelector('#toastMessage'),
  mobilePageContent: document.querySelector('#mobilePageContent'),
  mobileStudyBack: document.querySelector('#mobileStudyBack'),
  mobileEmptyDirectoryButton: document.querySelector('#mobileEmptyDirectoryButton'),
  mobileLearningLoading: document.querySelector('#mobileLearningLoading'),
  mobileLearningEmpty: document.querySelector('#mobileLearningEmpty'),
  mobileStudyContent: document.querySelector('#mobileStudyContent'),
  mobileHeaderTitle: document.querySelector('#mobileHeaderTitle'),
  mobileWord: document.querySelector('#mobileWord'),
  mobileFavoriteButton: document.querySelector('#mobileFavoriteButton'),
  mobileExpandButton: document.querySelector('#mobileExpandButton'),
  mobileProgress: document.querySelector('#mobileProgress'),
  mobileNextButton: document.querySelector('#mobileNextButton'),
  mobileRevealHint: document.querySelector('#mobileRevealHint'),
  mobileWordDetails: document.querySelector('#mobileWordDetails'),
  mobileMeaning: document.querySelector('#mobileMeaning'),
  mobileExamplesSection: document.querySelector('#mobileExamplesSection'),
  mobileExampleList: document.querySelector('#mobileExampleList'),
  mobileNotesSection: document.querySelector('#mobileNotesSection'),
  mobileNotes: document.querySelector('#mobileNotes'),
  mobileDirectoryView: document.querySelector('#mobileDirectoryView'),
  mobileDirectoryList: document.querySelector('#mobileDirectoryList'),
  mobileDirectoryEmpty: document.querySelector('#mobileDirectoryEmpty'),
  mobileDirectoryBack: document.querySelector('#mobileDirectoryBack'),
  mobileDirectoryDone: document.querySelector('#mobileDirectoryDone'),
  mobileDirectoryContext: document.querySelector('#mobileDirectoryContext'),
  mobileDirectoryTitle: document.querySelector('#mobileDirectoryTitle'),
  mobileDirectoryDescription: document.querySelector('#mobileDirectoryDescription'),
  mobileDirectorySearchForm: document.querySelector('#mobileDirectorySearchForm'),
  mobileDirectorySearchToggle: document.querySelector('#mobileDirectorySearchToggle'),
  mobileDirectorySearchInput: document.querySelector('#mobileDirectorySearchInput'),
  mobileDirectorySearchClear: document.querySelector('#mobileDirectorySearchClear'),
  mobileRefreshButton: document.querySelector('#mobileRefreshButton'),
  mobileRefreshLabel: document.querySelector('#mobileRefreshLabel'),
  mobileRefreshTime: document.querySelector('#mobileRefreshTime'),
  mobileFavoritesView: document.querySelector('#mobileFavoritesView'),
  mobileFavoritesList: document.querySelector('#mobileFavoritesList'),
  mobileFavoritesEmpty: document.querySelector('#mobileFavoritesEmpty'),
  mobileDirectoryTab: document.querySelector('#mobileDirectoryTab'),
  mobileStudyTab: document.querySelector('#mobileStudyTab'),
  mobileFavoritesTab: document.querySelector('#mobileFavoritesTab'),
};

const icons = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.2 2.8 2.8"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
};

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || '请求失败，请稍后重试');
    error.code = body.error?.code;
    error.details = body.error?.details;
    error.existing = body.error?.existing;
    throw error;
  }
  return body;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getDirectory(id) {
  return state.directories.find((directory) => directory.id === id);
}

function getDirectoryEntries({ includeParents = false } = {}) {
  return state.directories.flatMap((directory) => {
    const subdirectories = directory.subdirectories.map((subdirectory) => ({
      ...subdirectory,
      directoryId: directory.id,
      label: `${directory.name} / ${subdirectory.name}`,
    }));
    return includeParents ? [{ ...directory, label: directory.name }, ...subdirectories] : subdirectories;
  });
}

function saveMobileIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // The current page keeps the marks if browser storage is unavailable.
  }
}

function migrateMobileIds(legacyIds) {
  if (!legacyIds) return;
  const groups = [
    ['words', MOBILE_FAVORITES_KEY, state.mobileFavoriteIds],
    ['directories', MOBILE_REVIEWED_DIRECTORIES_KEY, state.mobileReviewedDirectoryIds],
  ];
  for (const [group, key, ids] of groups) {
    if (!pendingLegacyIds[group]?.size) continue;
    for (const oldId of pendingLegacyIds[group]) {
      const id = legacyIds[group]?.[oldId];
      if (typeof id === 'string') ids.add(id);
    }
    saveMobileIds(key, ids);
    pendingLegacyIds[group] = null;
  }
}

function getMobileFavorites() {
  return state.words.filter((word) => state.mobileFavoriteIds.has(word.id));
}

function getMobileStudyWords() {
  if (!state.mobileStudySubdirectoryId) return state.words;
  return state.words.filter((word) => word.subdirectoryId === state.mobileStudySubdirectoryId);
}

function getOpenMobileDirectory() {
  return getDirectory(state.mobileOpenDirectoryId);
}

function updateMobileNavigation() {
  for (const button of [elements.mobileDirectoryTab, elements.mobileStudyTab, elements.mobileFavoritesTab]) {
    const active = button.dataset.mobileView === state.mobileView;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

function createMobileListItem(word, index, { favoriteList = false, active = false, path = '' } = {}) {
  const item = createElement('li', 'mobile-word-list-item');
  item.classList.toggle('active', active);
  const openButton = createElement('button', 'mobile-word-list-open');
  openButton.type = 'button';
  openButton.dataset.wordId = word.id;
  openButton.setAttribute('aria-label', `学习 ${word.word}`);

  const number = createElement('span', 'mobile-word-list-number', String(index + 1).padStart(2, '0'));
  const copy = createElement('span', 'mobile-word-list-copy');
  copy.append(
    createElement('strong', '', word.word),
    createElement('small', '', path || word.meaning || '暂时没有释义'),
  );
  const arrow = createElement('span', 'mobile-word-list-arrow', '›');
  openButton.append(number, copy, arrow);
  item.append(openButton);

  if (favoriteList) {
    const unFavoriteButton = createElement('button', 'mobile-list-favorite active');
    unFavoriteButton.type = 'button';
    unFavoriteButton.dataset.mobileAction = 'unfavorite';
    unFavoriteButton.dataset.wordId = word.id;
    unFavoriteButton.setAttribute('aria-label', `取消收藏 ${word.word}`);
    unFavoriteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>';
    item.append(unFavoriteButton);
  }

  return item;
}

function createMobileDirectoryItem(directory, index, { parentId = '', active = false } = {}) {
  const item = createElement('li', 'mobile-directory-card');
  item.classList.toggle('active', active);
  const reviewed = state.mobileReviewedDirectoryIds.has(directory.id);
  const reviewButton = createElement(
    'button',
    `mobile-directory-review${reviewed ? ' reviewed' : ''}`,
    String(index + 1).padStart(2, '0'),
  );
  reviewButton.type = 'button';
  reviewButton.dataset.mobileAction = 'toggle-directory-review';
  reviewButton.dataset.directoryId = directory.id;
  reviewButton.setAttribute('aria-pressed', String(reviewed));
  reviewButton.setAttribute(
    'aria-label',
    reviewed ? `取消 ${directory.name} 的已复习标记` : `标记 ${directory.name} 为已复习`,
  );

  const openButton = createElement('button', 'mobile-directory-open');
  openButton.type = 'button';
  openButton.dataset.mobileAction = 'open-directory';
  openButton.dataset.directoryId = parentId || directory.id;
  if (parentId) openButton.dataset.subdirectoryId = directory.id;
  openButton.setAttribute('aria-label', `打开${parentId ? '子目录' : '目录'} ${directory.name}`);
  const copy = createElement('span', 'mobile-directory-copy');
  copy.append(
    createElement('strong', '', directory.name),
    createElement('small', '', parentId
      ? `${directory.wordCount} 个单词`
      : `${directory.subdirectories.length} 个子目录 · ${directory.wordCount} 个单词`),
  );
  openButton.append(copy, createElement('span', 'mobile-directory-arrow', '›'));
  item.append(reviewButton, openButton);
  return item;
}

function renderMobileDirectory() {
  if (!state.mobileDirectoryDirty) return;

  const fragment = document.createDocumentFragment();
  const openDirectory = getOpenMobileDirectory();
  const openSubdirectory = openDirectory?.subdirectories.find((item) => item.id === state.mobileOpenSubdirectoryId);
  const query = state.mobileDirectoryQuery.trim().toLocaleLowerCase('zh-CN');
  const showingWords = Boolean(openSubdirectory || query);
  const currentWord = getMobileStudyWords()[state.mobileIndex];
  const items = showingWords
    ? state.words.filter((word) => (!openDirectory || word.directoryId === openDirectory.id)
      && (!openSubdirectory || word.subdirectoryId === openSubdirectory.id)
      && (!query || [word.word, word.meaning].some(
        (text) => (text || '').toLocaleLowerCase('zh-CN').includes(query),
      )))
    : openDirectory?.subdirectories || state.directories;

  if (showingWords) {
    const paths = query && !openSubdirectory
      ? new Map(getDirectoryEntries().map((item) => [item.id, openDirectory ? item.name : item.label]))
      : new Map();
    items.forEach((word, index) => {
      const path = paths.get(word.subdirectoryId);
      fragment.append(createMobileListItem(word, index, {
        active: currentWord?.id === word.id,
        path: path ? `${path} · ${word.meaning}` : '',
      }));
    });
  } else {
    items.forEach((directory, index) => fragment.append(createMobileDirectoryItem(directory, index, {
      parentId: openDirectory?.id,
      active: directory.id === (openDirectory ? currentWord?.subdirectoryId : currentWord?.directoryId),
    })));
  }

  elements.mobileDirectoryBack.hidden = !openDirectory;
  elements.mobileDirectoryBack.setAttribute('aria-label', openSubdirectory ? `返回 ${openDirectory.name}` : '返回目录列表');
  elements.mobileRefreshButton.hidden = Boolean(openDirectory);
  elements.mobileRefreshTime.hidden = Boolean(openDirectory);
  elements.mobileDirectorySearchToggle.hidden = !openDirectory;
  elements.mobileDirectorySearchToggle.setAttribute('aria-expanded', String(state.mobileDirectorySearchOpen));
  elements.mobileDirectorySearchForm.hidden = Boolean(openDirectory && !state.mobileDirectorySearchOpen);
  elements.mobileDirectoryTitle.textContent = openSubdirectory?.name || openDirectory?.name || '目录';
  elements.mobileDirectoryContext.textContent = openSubdirectory
    ? openDirectory.name
    : openDirectory ? `${openDirectory.subdirectories.length} 个子目录` : `${state.directories.length} 个目录`;
  elements.mobileDirectoryDescription.textContent = showingWords ? `共 ${items.length} 个单词` : '';
  elements.mobileDirectoryList.replaceChildren(fragment);
  const scope = openSubdirectory ? '当前子目录' : openDirectory ? '当前目录' : '全部';
  elements.mobileDirectorySearchInput.placeholder = `搜索${scope}单词或释义…`;
  elements.mobileDirectorySearchClear.hidden = !elements.mobileDirectorySearchInput.value;
  elements.mobileDirectoryEmpty.hidden = items.length > 0;
  elements.mobileDirectoryList.hidden = items.length === 0;
  if (!items.length) {
    elements.mobileDirectoryEmpty.textContent = query ? '没有找到匹配的单词。'
      : openSubdirectory ? '这个子目录中还没有单词。'
        : openDirectory ? '这个目录中还没有子目录。' : '还没有目录。';
  }
  state.mobileDirectoryDirty = false;
}

function searchMobileDirectory() {
  state.mobileDirectoryQuery = elements.mobileDirectorySearchInput.value;
  state.mobileDirectoryDirty = true;
  if (state.mobileView === 'directory') renderMobileDirectory();
}

function resetMobileDirectorySearch() {
  state.mobileDirectoryQuery = '';
  elements.mobileDirectorySearchInput.value = '';
  state.mobileDirectoryDirty = true;
}

function renderMobileFavorites() {
  if (!state.mobileFavoritesDirty) return;

  const favorites = getMobileFavorites();
  const fragment = document.createDocumentFragment();
  favorites.forEach((word, index) => {
    fragment.append(createMobileListItem(word, index, { favoriteList: true }));
  });
  elements.mobileFavoritesList.replaceChildren(fragment);
  elements.mobileFavoritesEmpty.hidden = favorites.length > 0;
  elements.mobileFavoritesList.hidden = favorites.length === 0;
  state.mobileFavoritesDirty = false;
}

function updateMobileViewVisibility() {
  const total = getMobileStudyWords().length;
  elements.mobileLearningLoading.hidden = true;
  const showingStudy = state.mobileView === 'study';
  const showingDirectory = state.mobileView === 'directory';
  elements.mobileLearningEmpty.hidden = !showingStudy || total > 0;
  elements.mobileStudyContent.hidden = !showingStudy || total === 0;
  elements.mobileFavoriteButton.hidden = !showingStudy || total === 0;
  elements.mobileDirectoryView.hidden = !showingDirectory;
  elements.mobilePageContent.inert = showingDirectory;
  elements.mobileFavoritesView.hidden = state.mobileView !== 'favorites';
}

function updateMobileFavoriteButton(word) {
  const isFavorite = state.mobileFavoriteIds.has(word.id);
  elements.mobileFavoriteButton.classList.toggle('active', isFavorite);
  elements.mobileFavoriteButton.setAttribute('aria-pressed', String(isFavorite));
  elements.mobileFavoriteButton.setAttribute(
    'aria-label',
    isFavorite ? `取消收藏 ${word.word}` : `收藏 ${word.word}`,
  );
}

function renderCurrentMobileWord() {
  const studyWords = getMobileStudyWords();
  const total = studyWords.length;

  if (!total) {
    elements.mobileHeaderTitle.textContent = '单词学习';
    return;
  }

  state.mobileIndex = Math.min(Math.max(state.mobileIndex, 0), total - 1);
  const word = studyWords[state.mobileIndex];
  const examples = word.examples || [];
  const subdirectory = getDirectory(word.directoryId)?.subdirectories.find((item) => item.id === word.subdirectoryId);

  elements.mobileHeaderTitle.textContent = subdirectory?.name || '单词学习';
  elements.mobileWord.textContent = word.word;
  elements.mobileMeaning.textContent = word.meaning;
  elements.mobileProgress.textContent = `${state.mobileIndex + 1} / ${total}`;
  elements.mobileNextButton.disabled = total < 2;

  elements.mobileExampleList.replaceChildren();
  examples.forEach((example) => {
    elements.mobileExampleList.append(createElement('li', '', example));
  });
  elements.mobileExamplesSection.hidden = examples.length === 0;

  elements.mobileNotes.textContent = word.notes || '';
  elements.mobileNotesSection.hidden = !word.notes;

  updateMobileFavoriteButton(word);

  setMobileExpanded(state.mobileExpanded);
}

function renderActiveMobileView() {
  updateMobileNavigation();
  updateMobileViewVisibility();

  if (state.mobileView === 'directory') renderMobileDirectory();
  else if (state.mobileView === 'favorites') {
    elements.mobileHeaderTitle.textContent = '我的收藏';
    renderMobileFavorites();
  }
  else renderCurrentMobileWord();
}

function applyMobileWords(words, { directories = [], legacyIds } = {}) {
  migrateMobileIds(legacyIds);
  const currentWordId = getMobileStudyWords()[state.mobileIndex]?.id;
  state.words = words;
  state.directories = directories;
  const openDirectory = getOpenMobileDirectory();
  if (state.mobileOpenDirectoryId && !openDirectory) {
    state.mobileOpenDirectoryId = '';
    state.mobileOpenSubdirectoryId = '';
    state.mobileDirectorySearchOpen = false;
    resetMobileDirectorySearch();
  }
  if (state.mobileOpenSubdirectoryId
      && !openDirectory?.subdirectories.some((item) => item.id === state.mobileOpenSubdirectoryId)) {
    state.mobileOpenSubdirectoryId = '';
    state.mobileDirectorySearchOpen = false;
    resetMobileDirectorySearch();
  }
  if (state.mobileStudySubdirectoryId && !getDirectoryEntries().some((item) => item.id === state.mobileStudySubdirectoryId)) {
    state.mobileStudySubdirectoryId = words.find((word) => word.id === currentWordId)?.subdirectoryId || '';
  }
  const studyWords = getMobileStudyWords();
  const preservedIndex = currentWordId
    ? studyWords.findIndex((word) => word.id === currentWordId)
    : -1;
  state.mobileIndex = preservedIndex >= 0
    ? preservedIndex
    : Math.min(state.mobileIndex, Math.max(studyWords.length - 1, 0));
  state.mobileDirectoryDirty = true;
  state.mobileFavoritesDirty = true;
  const refreshedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  elements.mobileRefreshTime.textContent = `上次刷新：${refreshedAt}`;
  renderActiveMobileView();
}

function setMobileView(view) {
  const wasDirectory = state.mobileView === 'directory';
  state.mobileView = view;
  renderActiveMobileView();
  if (view === 'directory') {
    elements.mobileDirectoryView.scrollTop = 0;
    elements.mobileDirectoryTitle.focus({ preventScroll: true });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (wasDirectory) elements.mobileStudyBack.focus({ preventScroll: true });
}

function showMobileDirectory(reset = false) {
  if (reset) {
    state.mobileOpenDirectoryId = '';
    state.mobileOpenSubdirectoryId = '';
    state.mobileDirectorySearchOpen = false;
    resetMobileDirectorySearch();
  }
  setMobileView('directory');
}

function openMobileWord(wordId) {
  const word = state.words.find((item) => item.id === wordId);
  if (!word) return;
  state.mobileStudySubdirectoryId = state.mobileView === 'directory' ? word.subdirectoryId : '';
  state.mobileIndex = getMobileStudyWords().findIndex((item) => item.id === wordId);
  state.mobileExpanded = false;
  state.mobileDirectoryDirty = true;
  setMobileView('study');
}

function openMobileDirectory(directoryId, subdirectoryId = '') {
  const directory = getDirectory(directoryId);
  if (!directory || (subdirectoryId && !directory.subdirectories.some((item) => item.id === subdirectoryId))) return;
  resetMobileDirectorySearch();
  state.mobileOpenDirectoryId = directoryId;
  state.mobileOpenSubdirectoryId = subdirectoryId;
  state.mobileDirectorySearchOpen = false;
  setMobileView('directory');
}

function closeMobileDirectory() {
  if (state.mobileOpenSubdirectoryId) {
    openMobileDirectory(state.mobileOpenDirectoryId);
    return;
  }
  resetMobileDirectorySearch();
  state.mobileOpenDirectoryId = '';
  state.mobileDirectorySearchOpen = false;
  setMobileView('directory');
}

function toggleMobileDirectoryReviewed(directoryId) {
  if (state.mobileReviewedDirectoryIds.has(directoryId)) {
    state.mobileReviewedDirectoryIds.delete(directoryId);
  } else {
    state.mobileReviewedDirectoryIds.add(directoryId);
  }
  saveMobileIds(MOBILE_REVIEWED_DIRECTORIES_KEY, state.mobileReviewedDirectoryIds);
  state.mobileDirectoryDirty = true;
  renderMobileDirectory();
}

function toggleMobileFavorite(wordId) {
  if (state.mobileFavoriteIds.has(wordId)) {
    state.mobileFavoriteIds.delete(wordId);
    showToast('已取消收藏');
  } else {
    state.mobileFavoriteIds.add(wordId);
    showToast('已加入收藏');
  }
  saveMobileIds(MOBILE_FAVORITES_KEY, state.mobileFavoriteIds);
  state.mobileFavoritesDirty = true;

  const currentWord = getMobileStudyWords()[state.mobileIndex];
  if (currentWord?.id === wordId) updateMobileFavoriteButton(currentWord);
  if (state.mobileView === 'favorites') renderMobileFavorites();
}

function setMobileExpanded(expanded) {
  state.mobileExpanded = expanded;
  elements.mobileWordDetails.hidden = !expanded;
  elements.mobileRevealHint.hidden = expanded;
  elements.mobileExpandButton.setAttribute('aria-expanded', String(expanded));
  elements.mobileExpandButton.setAttribute('aria-label', expanded ? '隐藏单词详情' : '显示单词详情');
  elements.mobileExpandButton.classList.toggle('expanded', expanded);
  elements.mobileStudyContent.classList.toggle('details-open', expanded);
}

function showNextMobileWord() {
  const studyWords = getMobileStudyWords();
  if (studyWords.length < 2) return;
  state.mobileIndex = (state.mobileIndex + 1) % studyWords.length;
  state.mobileExpanded = false;
  state.mobileDirectoryDirty = true;
  renderCurrentMobileWord();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderDirectorySelect(select, entries, { selectedId = select.value, fallbackId = '', placeholder = '' } = {}) {
  const fragment = document.createDocumentFragment();
  if (placeholder) fragment.append(new Option(placeholder, ''));
  entries.forEach(({ id, label }) => {
    const option = new Option(label, id);
    fragment.append(option);
  });
  select.replaceChildren(fragment);
  select.value = entries.some((entry) => entry.id === selectedId) ? selectedId : fallbackId;
}

function renderDirectoryOptions(selectedId = elements.directorySelect.value) {
  const entries = getDirectoryEntries();
  renderDirectorySelect(elements.directorySelect, entries, { selectedId, fallbackId: entries[0]?.id });
}

function renderDesktopDirectoryNavigation() {
  elements.allWordsNav.classList.toggle('active', !state.desktopDirectoryId);
  const fragment = document.createDocumentFragment();
  getDirectoryEntries({ includeParents: true }).forEach((directory) => {
    const button = createElement('button', 'desktop-directory-item');
    button.type = 'button';
    button.dataset.directoryId = directory.directoryId || directory.id;
    button.dataset.subdirectoryId = directory.directoryId ? directory.id : '';
    button.classList.toggle('subdirectory', Boolean(directory.directoryId));
    button.classList.toggle('active', state.desktopDirectoryId === button.dataset.directoryId
      && state.desktopSubdirectoryId === button.dataset.subdirectoryId);
    button.append(
      createElement('span', '', directory.name),
      createElement('small', '', directory.wordCount),
    );
    fragment.append(button);
  });
  elements.desktopDirectoryList.replaceChildren(fragment);
  renderDirectoryOptions();
}

function renderDirectoryManager() {
  const fragment = document.createDocumentFragment();
  getDirectoryEntries({ includeParents: true }).forEach((directory) => {
    const item = createElement('div', 'directory-manager-item');
    item.classList.toggle('subdirectory', Boolean(directory.directoryId));
    const copy = createElement('div', 'directory-manager-copy');
    copy.append(
      createElement('strong', '', directory.name),
      createElement('small', '', `${directory.wordCount} 个单词`),
    );
    const actions = createElement('div', 'directory-manager-actions');

    if (!directory.directoryId) {
      const addButton = createElement('button', 'card-action');
      addButton.type = 'button';
      addButton.dataset.directoryAction = 'add-subdirectory';
      addButton.dataset.directoryId = directory.id;
      addButton.title = `在 ${directory.name} 下新建子目录`;
      addButton.setAttribute('aria-label', addButton.title);
      addButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>';
      actions.append(addButton);
    }

    const editButton = createElement('button', 'card-action');
    editButton.type = 'button';
    editButton.dataset.directoryAction = 'edit';
    editButton.dataset.directoryId = directory.directoryId || directory.id;
    editButton.dataset.subdirectoryId = directory.directoryId ? directory.id : '';
    editButton.setAttribute('aria-label', `重命名 ${directory.name}`);
    editButton.innerHTML = icons.edit;
    actions.append(editButton);

    const parent = getDirectory(directory.directoryId);
    if (directory.id === DEFAULT_DIRECTORY_ID || directory.id === parent?.defaultSubdirectoryId) {
      actions.append(createElement('span', 'directory-manager-default', '默认'));
    } else {
      const deleteButton = createElement('button', 'card-action delete');
      deleteButton.type = 'button';
      deleteButton.dataset.directoryAction = 'delete';
      deleteButton.dataset.directoryId = editButton.dataset.directoryId;
      deleteButton.dataset.subdirectoryId = editButton.dataset.subdirectoryId;
      deleteButton.setAttribute('aria-label', `删除 ${directory.name}`);
      deleteButton.innerHTML = icons.delete;
      actions.append(deleteButton);
    }

    item.append(copy, actions);
    fragment.append(item);
  });
  elements.directoryManagerList.replaceChildren(fragment);
}

function countMovableWords(source, target) {
  if (!source || !target || source.id === target.id) return 0;
  return source.wordCount - (source.id === target.directoryId ? target.wordCount : 0);
}

function renderDirectoryMoveOptions(preferredSourceId = '') {
  const entries = getDirectoryEntries({ includeParents: true });
  const fallbackSource = entries.find((entry) => entry.wordCount > 0) || entries[0];
  renderDirectorySelect(elements.moveSourceSelect, entries.map((entry) => ({
    ...entry, label: `${entry.label}（${entry.wordCount}）`,
  })), {
    selectedId: preferredSourceId || elements.moveSourceSelect.value,
    fallbackId: fallbackSource?.id,
  });
  const source = entries.find((entry) => entry.id === elements.moveSourceSelect.value);
  const targets = entries.filter((entry) => entry.directoryId && entry.id !== source?.id);
  const defaultTarget = targets.find((entry) => countMovableWords(source, entry) > 0) || targets[0];
  renderDirectorySelect(elements.moveTargetSelect, targets, { fallbackId: defaultTarget?.id });
  const target = targets.find((entry) => entry.id === elements.moveTargetSelect.value);
  const count = countMovableWords(source, target);
  elements.directoryMoveSummary.textContent = source
    ? `“${source.label}”当前有 ${source.wordCount} 个单词`
    : '请先创建目录';
  elements.moveDirectoryWordsButton.textContent = count ? `移动 ${count} 个` : '移动全部';
  elements.moveDirectoryWordsButton.disabled = count === 0;
}

function renderDirectoryParentOptions(selectedId = elements.directoryParentSelect.value) {
  const entries = state.directories.map((directory) => ({ id: directory.id, label: directory.name }));
  renderDirectorySelect(elements.directoryParentSelect, entries, {
    selectedId,
    placeholder: '无（新建一级目录）',
  });
}

function applyDirectories(directories) {
  state.directories = directories;
  const directory = getDirectory(state.desktopDirectoryId);
  const missingDirectory = Boolean(state.desktopDirectoryId && !directory);
  const missingSubdirectory = Boolean(state.desktopSubdirectoryId
    && !directory?.subdirectories.some((item) => item.id === state.desktopSubdirectoryId));
  if (missingDirectory) {
    state.desktopDirectoryId = '';
  }
  if (missingSubdirectory) state.desktopSubdirectoryId = '';
  renderDesktopDirectoryNavigation();
  renderSelectedWordsTargets();
  if (elements.directoryDialog.open) {
    renderDirectoryParentOptions();
    renderDirectoryManager();
    renderDirectoryMoveOptions();
  }
  return missingDirectory || missingSubdirectory;
}

function setDesktopDirectory(directoryId, subdirectoryId = '') {
  if (state.desktopDirectoryId === directoryId && state.desktopSubdirectoryId === subdirectoryId) return;
  state.desktopDirectoryId = directoryId;
  state.desktopSubdirectoryId = subdirectoryId;
  loadWords();
}

function resetDirectoryForm(parentId = '') {
  state.editingDirectoryId = '';
  state.editingSubdirectoryId = '';
  renderDirectoryParentOptions(parentId);
  elements.directoryParentField.hidden = false;
  elements.directoryNameInput.value = '';
  elements.directoryNameError.textContent = '';
  elements.directoryFormLabel.textContent = parentId ? '新建子目录' : '新建目录';
  elements.submitDirectoryButton.textContent = '添加';
  elements.cancelDirectoryEditButton.hidden = true;
}

function openDirectoryDialog() {
  resetDirectoryForm();
  renderDirectoryManager();
  renderDirectoryMoveOptions(state.desktopSubdirectoryId || state.desktopDirectoryId);
  elements.directoryDialog.showModal();
  requestAnimationFrame(() => elements.directoryNameInput.focus());
}

async function moveDirectoryWords(event) {
  event.preventDefault();
  if (elements.moveDirectoryWordsButton.disabled) return;
  const entries = getDirectoryEntries({ includeParents: true });
  const source = entries.find((entry) => entry.id === elements.moveSourceSelect.value);
  const target = entries.find((entry) => entry.id === elements.moveTargetSelect.value && entry.directoryId);
  const count = countMovableWords(source, target);
  if (!count) return;

  const confirmed = window.confirm(
    `把“${source.label}”中的 ${count} 个单词移动到“${target.label}”？`,
  );
  if (!confirmed) return;

  elements.moveDirectoryWordsButton.disabled = true;
  elements.moveDirectoryWordsButton.textContent = '移动中…';
  try {
    const result = await apiFetch(`${directoryEndpoint(source.directoryId || source.id)}/move-words`, {
      method: 'POST',
      body: JSON.stringify({
        sourceSubdirectoryId: source.directoryId ? source.id : '',
        targetDirectoryId: target.directoryId,
        targetSubdirectoryId: target.id,
      }),
    });
    showToast(result.message);
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    if (elements.directoryDialog.open) renderDirectoryMoveOptions(source.id);
  }
}

function directoryEndpoint(directoryId, subdirectoryId = '') {
  const base = directoryId ? `/api/directories/${encodeURIComponent(directoryId)}` : '/api/directories';
  return subdirectoryId ? `${base}/subdirectories/${encodeURIComponent(subdirectoryId)}` : base;
}

function startDirectoryEdit(directoryId, subdirectoryId = '') {
  const directory = getDirectory(directoryId);
  const entry = subdirectoryId ? directory?.subdirectories.find((item) => item.id === subdirectoryId) : directory;
  if (!entry) return;
  state.editingDirectoryId = directoryId;
  state.editingSubdirectoryId = subdirectoryId;
  elements.directoryParentField.hidden = true;
  elements.directoryNameInput.value = entry.name;
  elements.directoryNameError.textContent = '';
  elements.directoryFormLabel.textContent = subdirectoryId ? '重命名子目录' : '重命名目录';
  elements.submitDirectoryButton.textContent = '保存';
  elements.cancelDirectoryEditButton.hidden = false;
  elements.directoryNameInput.focus();
  elements.directoryNameInput.select();
}

async function submitDirectory(event) {
  event.preventDefault();
  const name = elements.directoryNameInput.value.trim();
  if (!name) {
    elements.directoryNameError.textContent = '请输入目录名称';
    return;
  }

  const id = state.editingDirectoryId;
  const parentId = elements.directoryParentSelect.value;
  const url = !id && parentId
    ? `${directoryEndpoint(parentId)}/subdirectories`
    : directoryEndpoint(id, state.editingSubdirectoryId);
  elements.submitDirectoryButton.disabled = true;
  try {
    const result = await apiFetch(url, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name }),
    });
    showToast(result.message);
    resetDirectoryForm(id ? '' : parentId);
    await loadWords();
  } catch (error) {
    elements.directoryNameError.textContent = error.message;
  } finally {
    elements.submitDirectoryButton.disabled = false;
  }
}

async function deleteDirectory(directoryId, subdirectoryId = '') {
  const directory = getDirectory(directoryId);
  const entry = subdirectoryId ? directory?.subdirectories.find((item) => item.id === subdirectoryId) : directory;
  if (!entry || entry.id === DEFAULT_DIRECTORY_ID || entry.id === directory.defaultSubdirectoryId) return;
  const description = subdirectoryId ? '其中的单词会移入同一目录的默认子目录。'
    : '该目录及其子目录会一起移除，单词会移入默认目录的默认子目录。';
  if (!window.confirm(`删除“${entry.name}”？${description}`)) return;

  try {
    const result = await apiFetch(directoryEndpoint(directoryId, subdirectoryId), { method: 'DELETE' });
    showToast(result.message);
    if (state.editingDirectoryId === directoryId && (!subdirectoryId || state.editingSubdirectoryId === subdirectoryId)) {
      resetDirectoryForm();
    }
    if (state.desktopDirectoryId === directoryId && (!subdirectoryId || state.desktopSubdirectoryId === subdirectoryId)) {
      if (!subdirectoryId) state.desktopDirectoryId = '';
      state.desktopSubdirectoryId = '';
    }
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleDirectoryManagerClick(event) {
  const button = event.target.closest('[data-directory-action]');
  if (!button) return;
  const { directoryAction, directoryId, subdirectoryId } = button.dataset;
  if (directoryAction === 'edit') startDirectoryEdit(directoryId, subdirectoryId);
  else if (directoryAction === 'delete') deleteDirectory(directoryId, subdirectoryId);
  else if (directoryAction === 'add-subdirectory') {
    resetDirectoryForm(directoryId);
    elements.directoryNameInput.focus();
  }
}

function renderSelectedWordsTargets() {
  const targets = getDirectoryEntries().filter((entry) => entry.id !== state.desktopSubdirectoryId);
  renderDirectorySelect(elements.selectedWordsTarget, targets, { placeholder: '选择目标子目录' });
  updateWordSelection();
}

function updateWordSelection() {
  const count = state.selectedWordIds.size;
  const busy = state.desktopLoading || state.movingSelectedWords;
  const targetId = elements.selectedWordsTarget.value;
  const canMove = state.words.some((word) => state.selectedWordIds.has(word.id)
    && word.subdirectoryId !== targetId);
  elements.selectedWordsSummary.textContent = `已选 ${count} 个`;
  elements.selectAllWords.checked = count > 0 && count === state.words.length;
  elements.selectAllWords.indeterminate = count > 0 && count < state.words.length;
  elements.selectAllWords.disabled = busy || !state.words.length;
  elements.clearWordSelectionButton.disabled = busy || !count;
  elements.selectedWordsTarget.disabled = busy || !count;
  elements.moveSelectedWordsButton.disabled = busy || !count || !targetId || !canMove;
  elements.moveSelectedWordsButton.textContent = state.movingSelectedWords ? '移动中…' : '移动所选';
  elements.wordGrid.querySelectorAll('.word-selection-checkbox').forEach((checkbox) => {
    checkbox.checked = state.selectedWordIds.has(checkbox.dataset.wordId);
    checkbox.disabled = busy;
    checkbox.closest('.word-card').classList.toggle('selected', checkbox.checked);
  });
}

function clearWordSelection() {
  state.selectedWordIds.clear();
  updateWordSelection();
}

async function moveSelectedWords(event) {
  event.preventDefault();
  if (elements.moveSelectedWordsButton.disabled) return;
  const target = getDirectoryEntries().find((entry) => entry.id === elements.selectedWordsTarget.value);
  if (!target) return;
  const wordIds = [...state.selectedWordIds];
  state.movingSelectedWords = true;
  updateWordSelection();
  try {
    const result = await apiFetch('/api/words/move', {
      method: 'POST',
      body: JSON.stringify({ wordIds, targetDirectoryId: target.directoryId, targetSubdirectoryId: target.id }),
    });
    clearWordSelection();
    showToast(result.message);
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.movingSelectedWords = false;
    updateWordSelection();
  }
}

function renderDesktopWords() {
  elements.wordGrid.replaceChildren();
  const hasWords = state.words.length > 0;
  elements.wordGrid.hidden = !hasWords;
  elements.emptyState.hidden = hasWords;

  const hasFilters = Boolean(elements.searchInput.value.trim() || state.desktopDirectoryId);
  elements.resultSummary.textContent = hasFilters
    ? `找到 ${state.words.length} 个符合条件的单词`
    : `共 ${state.words.length} 个单词，按你的阅读节奏慢慢积累`;

  if (!hasWords) {
    elements.emptyTitle.textContent = hasFilters ? '没有找到匹配的单词' : '这里还没有单词';
    elements.emptyDescription.textContent = hasFilters
      ? '换一个关键词试试看。'
      : '先手动添加第一个单词，之后也可以从 Edge 扩展快速收藏。';
    elements.emptyAddButton.hidden = hasFilters;
    return;
  }

  const directoryPaths = new Map(getDirectoryEntries().map((entry) => [entry.id, entry.label]));
  state.words.forEach((word, index) => {
    const card = createElement('article', 'word-card');
    card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;

    const header = createElement('div', 'word-card-header');
    const title = createElement('h3', '', word.word);
    const selectionLabel = createElement('label', 'word-selection-label');
    const checkbox = createElement('input', 'word-selection-checkbox');
    checkbox.type = 'checkbox';
    checkbox.dataset.wordId = word.id;
    checkbox.setAttribute('aria-label', `选择 ${word.word}`);
    selectionLabel.append(checkbox, createElement('span', '', word.word));
    title.replaceChildren(selectionLabel);
    const actions = createElement('div', 'card-actions');

    const editButton = createElement('button', 'card-action');
    editButton.type = 'button';
    editButton.title = `编辑 ${word.word}`;
    editButton.setAttribute('aria-label', `编辑 ${word.word}`);
    editButton.innerHTML = icons.edit;
    editButton.addEventListener('click', () => openWordDialog(word));

    const deleteButton = createElement('button', 'card-action delete');
    deleteButton.type = 'button';
    deleteButton.title = `删除 ${word.word}`;
    deleteButton.setAttribute('aria-label', `删除 ${word.word}`);
    deleteButton.innerHTML = icons.delete;
    deleteButton.addEventListener('click', () => openDeleteDialog(word));

    actions.append(editButton, deleteButton);
    header.append(title, actions);

    const meaning = createElement('p', 'meaning', word.meaning);
    card.append(header, meaning);

    const directoryPath = directoryPaths.get(word.subdirectoryId);
    if (directoryPath) card.append(createElement('span', 'word-directory-badge', directoryPath));

    if (word.examples?.length) {
      card.append(createElement('p', 'example', `“${word.examples[0]}”`));
    }

    if (word.notes) {
      card.append(createElement('p', 'notes-preview', word.notes));
    }

    elements.wordGrid.append(card);
  });
  updateWordSelection();
}

async function loadStats() {
  try {
    const { data } = await apiFetch('/api/words/stats');
    elements.totalStat.textContent = data.total;
    elements.todayStat.textContent = data.addedToday;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function mobileWordParams(extra = {}) {
  const params = new URLSearchParams({ sort: 'updated-desc', ...extra });
  if (pendingLegacyIds.words?.size || pendingLegacyIds.directories?.size) params.set('legacyIds', '1');
  return params;
}

async function loadWords() {
  const requestId = ++state.wordsRequestId;
  const mobileLayout = isMobileLayout();
  if (!mobileLayout) {
    state.desktopLoading = true;
    clearWordSelection();
  }
  try {
    const params = mobileLayout ? mobileWordParams() : new URLSearchParams({
      q: elements.searchInput.value.trim(),
      sort: elements.sortSelect.value,
      ...(state.desktopDirectoryId ? { directoryId: state.desktopDirectoryId } : {}),
      ...(state.desktopSubdirectoryId ? { subdirectoryId: state.desktopSubdirectoryId } : {}),
    });
    const { data, meta } = await apiFetch(`/api/words?${params}`);
    if (requestId !== state.wordsRequestId) return;
    if (mobileLayout) applyMobileWords(data, meta);
    else {
      state.words = data;
      if (applyDirectories(meta.directories || [])) return loadWords();
      renderDesktopWords();
    }
  } catch (error) {
    if (requestId !== state.wordsRequestId) return;
    elements.resultSummary.textContent = '载入失败，请稍后刷新页面';
    if (mobileLayout) renderActiveMobileView();
    showToast(error.message, 'error');
  } finally {
    if (!mobileLayout && requestId === state.wordsRequestId) {
      state.desktopLoading = false;
      updateWordSelection();
    }
  }
}

async function refreshMobileWords() {
  if (elements.mobileRefreshButton.disabled) return;

  elements.mobileRefreshButton.disabled = true;
  elements.mobileRefreshButton.classList.add('refreshing');
  elements.mobileRefreshButton.setAttribute('aria-busy', 'true');
  elements.mobileRefreshLabel.textContent = '刷新中';
  const requestId = ++state.wordsRequestId;

  try {
    const params = mobileWordParams({ refresh: Date.now().toString() });
    const { data, meta } = await apiFetch(`/api/words?${params}`, { cache: 'no-store' });
    if (requestId !== state.wordsRequestId) return;
    applyMobileWords(data, meta);
    showToast(`已加载最新内容，共 ${data.length} 个单词`);
  } catch (error) {
    if (requestId === state.wordsRequestId) {
      showToast(`刷新失败，仍显示原有内容：${error.message}`, 'error');
    }
  } finally {
    elements.mobileRefreshButton.disabled = false;
    elements.mobileRefreshButton.classList.remove('refreshing');
    elements.mobileRefreshButton.removeAttribute('aria-busy');
    elements.mobileRefreshLabel.textContent = '刷新';
  }
}

function handleMobileListClick(event) {
  const directoryAction = event.target.closest('[data-mobile-action^="toggle-directory"], [data-mobile-action="open-directory"]');
  if (directoryAction) {
    if (directoryAction.dataset.mobileAction === 'toggle-directory-review') {
      toggleMobileDirectoryReviewed(directoryAction.dataset.directoryId);
    } else {
      openMobileDirectory(directoryAction.dataset.directoryId, directoryAction.dataset.subdirectoryId);
    }
    return;
  }

  const actionButton = event.target.closest('[data-mobile-action="unfavorite"]');
  if (actionButton) {
    toggleMobileFavorite(actionButton.dataset.wordId);
    return;
  }

  const openButton = event.target.closest('.mobile-word-list-open');
  if (openButton) openMobileWord(openButton.dataset.wordId);
}

function resetFormErrors() {
  document.querySelectorAll('.field.has-error').forEach((field) => field.classList.remove('has-error'));
  document.querySelectorAll('.field-error').forEach((error) => { error.textContent = ''; });
}

function showFormErrors(details = []) {
  resetFormErrors();
  details.forEach(({ field, message }) => {
    const error = document.querySelector(`[data-error-for="${field}"]`);
    if (!error) return;
    error.textContent = message;
    error.closest('.field')?.classList.add('has-error');
  });
}

function openWordDialog(word = null) {
  elements.wordForm.reset();
  resetFormErrors();
  elements.wordId.value = word?.id || '';
  elements.dialogTitle.textContent = word ? '编辑单词' : '添加新单词';
  elements.wordInput.value = word?.word || '';
  elements.meaningInput.value = word?.meaning || '';
  elements.examplesInput.value = word?.examples?.join('\n') || '';
  elements.notesInput.value = word?.notes || '';
  const directory = getDirectory(state.desktopDirectoryId || DEFAULT_DIRECTORY_ID);
  renderDirectoryOptions(word?.subdirectoryId || state.desktopSubdirectoryId || directory?.defaultSubdirectoryId);
  elements.wordDialog.showModal();
  requestAnimationFrame(() => elements.wordInput.focus());
}

function closeWordDialog() {
  if (elements.wordDialog.open) elements.wordDialog.close();
}

function formPayload(subdirectory) {
  return {
    word: elements.wordInput.value,
    meaning: elements.meaningInput.value,
    examples: elements.examplesInput.value,
    notes: elements.notesInput.value,
    directoryId: subdirectory.directoryId,
    subdirectoryId: subdirectory.id,
  };
}

async function submitWord(event) {
  event.preventDefault();
  resetFormErrors();
  const subdirectory = getDirectoryEntries().find((entry) => entry.id === elements.directorySelect.value);
  if (!subdirectory) {
    showToast('请选择所属子目录', 'error');
    return;
  }
  const id = elements.wordId.value;
  elements.submitWordButton.disabled = true;
  elements.submitWordButton.querySelector('span').textContent = '正在保存……';

  try {
    const result = await apiFetch(id ? `/api/words/${id}` : '/api/words', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(formPayload(subdirectory)),
    });
    closeWordDialog();
    showToast(result.message);
    await Promise.all([loadWords(), loadStats()]);
  } catch (error) {
    if (error.details) showFormErrors(error.details);
    if (error.code === 'WORD_EXISTS' && error.existing) {
      elements.wordInput.closest('.field').classList.add('has-error');
      document.querySelector('[data-error-for="word"]').textContent = `“${error.existing.word}”已经在单词本中`;
    }
    showToast(error.message, 'error');
  } finally {
    elements.submitWordButton.disabled = false;
    elements.submitWordButton.querySelector('span').textContent = '保存单词';
  }
}

function openDeleteDialog(word) {
  state.deletingWord = word;
  elements.deleteWordName.textContent = word.word;
  elements.deleteDialog.showModal();
}

async function deleteWord() {
  if (!state.deletingWord) return;
  elements.confirmDeleteButton.disabled = true;
  try {
    const result = await apiFetch(`/api/words/${state.deletingWord.id}`, { method: 'DELETE' });
    elements.deleteDialog.close();
    state.deletingWord = null;
    showToast(result.message);
    await Promise.all([loadWords(), loadStats()]);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    elements.confirmDeleteButton.disabled = false;
  }
}

let toastTimer;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  elements.toastMessage.textContent = message;
  elements.toast.classList.toggle('error', type === 'error');
  elements.toast.querySelector('.toast-icon').textContent = type === 'error' ? '!' : '✓';
  elements.toast.classList.add('visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2800);
}

function setTodayLabel() {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  elements.todayLabel.textContent = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${weekdays[now.getDay()]}`;
}

elements.addWordButton.addEventListener('click', () => openWordDialog());
elements.emptyAddButton.addEventListener('click', () => openWordDialog());
elements.allWordsNav.addEventListener('click', () => setDesktopDirectory(''));
elements.desktopDirectoryList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-directory-id]');
  if (button) setDesktopDirectory(button.dataset.directoryId, button.dataset.subdirectoryId);
});
elements.manageDirectoriesButton.addEventListener('click', openDirectoryDialog);
elements.closeDirectoryDialogButton.addEventListener('click', () => elements.directoryDialog.close());
elements.directoryForm.addEventListener('submit', submitDirectory);
elements.cancelDirectoryEditButton.addEventListener('click', () => resetDirectoryForm());
elements.directoryParentSelect.addEventListener('change', () => {
  elements.directoryFormLabel.textContent = elements.directoryParentSelect.value ? '新建子目录' : '新建目录';
});
elements.directoryMoveForm.addEventListener('submit', moveDirectoryWords);
elements.moveSourceSelect.addEventListener('change', () => {
  renderDirectoryMoveOptions(elements.moveSourceSelect.value);
});
elements.moveTargetSelect.addEventListener('change', () => renderDirectoryMoveOptions());
elements.directoryManagerList.addEventListener('click', handleDirectoryManagerClick);
elements.closeDialogButton.addEventListener('click', closeWordDialog);
elements.cancelDialogButton.addEventListener('click', closeWordDialog);
elements.wordForm.addEventListener('submit', submitWord);
elements.cancelDeleteButton.addEventListener('click', () => elements.deleteDialog.close());
elements.confirmDeleteButton.addEventListener('click', deleteWord);
elements.wordGrid.addEventListener('change', (event) => {
  const checkbox = event.target.closest('.word-selection-checkbox');
  if (!checkbox || state.desktopLoading || state.movingSelectedWords) return;
  if (checkbox.checked) state.selectedWordIds.add(checkbox.dataset.wordId);
  else state.selectedWordIds.delete(checkbox.dataset.wordId);
  updateWordSelection();
});
elements.selectAllWords.addEventListener('change', () => {
  state.selectedWordIds = elements.selectAllWords.checked
    ? new Set(state.words.map((word) => word.id)) : new Set();
  updateWordSelection();
});
elements.clearWordSelectionButton.addEventListener('click', clearWordSelection);
elements.selectedWordsTarget.addEventListener('change', updateWordSelection);
elements.selectedWordsMoveForm.addEventListener('submit', moveSelectedWords);
elements.searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.wordsRequestId += 1;
  state.desktopLoading = true;
  clearWordSelection();
  state.searchTimer = setTimeout(() => loadWords(), 220);
});
elements.sortSelect.addEventListener('change', () => loadWords());
elements.mobileExpandButton.addEventListener('click', () => setMobileExpanded(!state.mobileExpanded));
elements.mobileNextButton.addEventListener('click', showNextMobileWord);
elements.mobileFavoriteButton.addEventListener('click', () => {
  const word = getMobileStudyWords()[state.mobileIndex];
  if (word) toggleMobileFavorite(word.id);
});
elements.mobileDirectoryTab.addEventListener('click', () => showMobileDirectory(true));
elements.mobileStudyBack.addEventListener('click', () => showMobileDirectory());
elements.mobileEmptyDirectoryButton.addEventListener('click', () => showMobileDirectory(true));
elements.mobileDirectoryDone.addEventListener('click', () => setMobileView('study'));
elements.mobileStudyTab.addEventListener('click', () => setMobileView('study'));
elements.mobileFavoritesTab.addEventListener('click', () => setMobileView('favorites'));
elements.mobileRefreshButton.addEventListener('click', refreshMobileWords);
elements.mobileDirectoryBack.addEventListener('click', closeMobileDirectory);
elements.mobileDirectorySearchToggle.addEventListener('click', () => {
  state.mobileDirectorySearchOpen = !state.mobileDirectorySearchOpen;
  if (!state.mobileDirectorySearchOpen) resetMobileDirectorySearch();
  state.mobileDirectoryDirty = true;
  renderMobileDirectory();
  if (state.mobileDirectorySearchOpen) elements.mobileDirectorySearchInput.focus();
});
elements.mobileDirectorySearchInput.addEventListener('input', (event) => {
  if (!event.isComposing) searchMobileDirectory();
});
elements.mobileDirectorySearchInput.addEventListener('compositionend', searchMobileDirectory);
elements.mobileDirectorySearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  searchMobileDirectory();
  elements.mobileDirectorySearchInput.blur();
});
elements.mobileDirectorySearchClear.addEventListener('click', () => {
  resetMobileDirectorySearch();
  renderMobileDirectory();
  elements.mobileDirectorySearchInput.focus();
});
elements.mobileDirectoryList.addEventListener('click', handleMobileListClick);
elements.mobileFavoritesList.addEventListener('click', handleMobileListClick);

for (const dialog of [elements.wordDialog, elements.directoryDialog, elements.deleteDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isMobileLayout() && state.mobileView === 'directory') {
    if (state.mobileOpenDirectoryId) closeMobileDirectory();
    else setMobileView('study');
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    if (isMobileLayout()) return;
    event.preventDefault();
    elements.searchInput.focus();
  }
});

mobileLayoutMedia.addEventListener('change', () => {
  loadWords();
  if (!isMobileLayout()) loadStats();
});

setTodayLabel();
if (!isMobileLayout()) {
  elements.wordGrid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
}
Promise.all(isMobileLayout() ? [loadWords()] : [loadWords(), loadStats()]);
