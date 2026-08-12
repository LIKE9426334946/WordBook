const MOBILE_FAVORITES_KEY = 'wordbook.mobile.favorites.v1';
const MOBILE_REVIEWED_DIRECTORIES_KEY = 'wordbook.mobile.reviewed-directories.v1';
const MOBILE_LAYOUT_QUERY = '(max-width: 700px), (max-width: 950px) and (pointer: coarse)';

function isMobileLayout() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

function loadMobileFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(MOBILE_FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function loadMobileReviewedDirectories() {
  try {
    const value = JSON.parse(localStorage.getItem(MOBILE_REVIEWED_DIRECTORIES_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

const state = {
  words: [],
  directories: [],
  desktopDirectoryId: '',
  editingDirectoryId: '',
  deletingWord: null,
  searchTimer: null,
  mobileIndex: 0,
  mobileExpanded: false,
  mobileView: 'study',
  mobileFavoriteIds: loadMobileFavorites(),
  mobileReviewedDirectoryIds: loadMobileReviewedDirectories(),
  mobileOpenDirectoryId: '',
  mobileStudyDirectoryId: '',
  mobileDirectoryDirty: true,
  mobileFavoritesDirty: true,
};

const elements = {
  addWordButton: document.querySelector('#addWordButton'),
  emptyAddButton: document.querySelector('#emptyAddButton'),
  wordGrid: document.querySelector('#wordGrid'),
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
  directoryId: document.querySelector('#directoryId'),
  directoryFormLabel: document.querySelector('#directoryFormLabel'),
  directoryNameInput: document.querySelector('#directoryNameInput'),
  directoryNameError: document.querySelector('#directoryNameError'),
  submitDirectoryButton: document.querySelector('#submitDirectoryButton'),
  cancelDirectoryEditButton: document.querySelector('#cancelDirectoryEditButton'),
  directoryManagerList: document.querySelector('#directoryManagerList'),
  deleteDialog: document.querySelector('#deleteDialog'),
  deleteWordName: document.querySelector('#deleteWordName'),
  cancelDeleteButton: document.querySelector('#cancelDeleteButton'),
  confirmDeleteButton: document.querySelector('#confirmDeleteButton'),
  toast: document.querySelector('#toast'),
  toastMessage: document.querySelector('#toastMessage'),
  mobileHeaderTotal: document.querySelector('#mobileHeaderTotal'),
  mobileLearningLoading: document.querySelector('#mobileLearningLoading'),
  mobileLearningEmpty: document.querySelector('#mobileLearningEmpty'),
  mobileStudyContent: document.querySelector('#mobileStudyContent'),
  mobileHeaderTitle: document.querySelector('#mobileHeaderTitle'),
  mobileHeaderSubtitle: document.querySelector('#mobileHeaderSubtitle'),
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
  mobileDirectoryEyebrow: document.querySelector('#mobileDirectoryEyebrow'),
  mobileDirectoryTitle: document.querySelector('#mobileDirectoryTitle'),
  mobileDirectoryDescription: document.querySelector('#mobileDirectoryDescription'),
  mobileRefreshButton: document.querySelector('#mobileRefreshButton'),
  mobileRefreshLabel: document.querySelector('#mobileRefreshLabel'),
  mobileFavoritesView: document.querySelector('#mobileFavoritesView'),
  mobileFavoritesList: document.querySelector('#mobileFavoritesList'),
  mobileFavoritesEmpty: document.querySelector('#mobileFavoritesEmpty'),
  mobileFavoritesSummary: document.querySelector('#mobileFavoritesSummary'),
  mobileDirectoryTab: document.querySelector('#mobileDirectoryTab'),
  mobileStudyTab: document.querySelector('#mobileStudyTab'),
  mobileFavoritesTab: document.querySelector('#mobileFavoritesTab'),
};

const icons = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.2 2.8 2.8"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h6l2 2h8v10H4V7Z"/></svg>',
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

function saveMobileFavorites() {
  localStorage.setItem(MOBILE_FAVORITES_KEY, JSON.stringify([...state.mobileFavoriteIds]));
}

function saveMobileReviewedDirectories() {
  localStorage.setItem(
    MOBILE_REVIEWED_DIRECTORIES_KEY,
    JSON.stringify([...state.mobileReviewedDirectoryIds]),
  );
}

function getMobileFavorites() {
  return state.words.filter((word) => state.mobileFavoriteIds.has(word.id));
}

function getMobileStudyWords() {
  if (!state.mobileStudyDirectoryId) return state.words;
  return state.words.filter((word) => word.directoryId === state.mobileStudyDirectoryId);
}

function getOpenMobileDirectory() {
  return state.directories.find((directory) => directory.id === state.mobileOpenDirectoryId) || null;
}

function updateMobileNavigation() {
  const viewDetails = {
    directory: ['单词目录', 'WordBook'],
    study: ['单词学习', 'WordBook'],
    favorites: ['我的收藏', 'WordBook'],
  };
  const [title, subtitle] = viewDetails[state.mobileView];
  elements.mobileHeaderTitle.textContent = title;
  elements.mobileHeaderSubtitle.textContent = subtitle;

  const favoriteCount = getMobileFavorites().length;
  const openDirectory = getOpenMobileDirectory();
  elements.mobileHeaderTotal.textContent = state.mobileView === 'favorites'
    ? `${favoriteCount} 收藏`
    : state.mobileView === 'directory' && !openDirectory
      ? `${state.directories.length} 目录`
      : state.mobileView === 'directory'
        ? `${openDirectory.wordCount} 词`
        : `${getMobileStudyWords().length} 词`;

  for (const button of [elements.mobileDirectoryTab, elements.mobileStudyTab, elements.mobileFavoritesTab]) {
    const active = button.dataset.mobileView === state.mobileView;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

function createMobileListItem(word, index, favoriteList = false) {
  const item = createElement('li', 'mobile-word-list-item');
  const openButton = createElement('button', 'mobile-word-list-open');
  openButton.type = 'button';
  openButton.dataset.wordId = word.id;
  openButton.setAttribute('aria-label', `学习 ${word.word}`);

  const number = createElement('span', 'mobile-word-list-number', String(index + 1).padStart(2, '0'));
  const copy = createElement('span', 'mobile-word-list-copy');
  copy.append(
    createElement('strong', '', word.word),
    createElement('small', '', word.meaning || '暂时没有释义'),
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

function createMobileDirectoryItem(directory, index) {
  const item = createElement('li', 'mobile-directory-card');
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
  openButton.dataset.directoryId = directory.id;
  openButton.setAttribute('aria-label', `打开目录 ${directory.name}`);
  const copy = createElement('span', 'mobile-directory-copy');
  copy.append(
    createElement('strong', '', directory.name),
    createElement('small', '', `${directory.wordCount} 个单词`),
  );
  openButton.append(copy, createElement('span', 'mobile-directory-arrow', '›'));
  item.append(reviewButton, openButton);
  return item;
}

function renderMobileDirectory() {
  if (!state.mobileDirectoryDirty) return;

  const fragment = document.createDocumentFragment();
  const openDirectory = getOpenMobileDirectory();
  const items = openDirectory
    ? state.words.filter((word) => word.directoryId === openDirectory.id)
    : state.directories;

  if (openDirectory) {
    items.forEach((word, index) => fragment.append(createMobileListItem(word, index)));
    elements.mobileDirectoryBack.hidden = false;
    elements.mobileDirectoryEyebrow.textContent = 'DIRECTORY WORDS';
    elements.mobileDirectoryTitle.textContent = openDirectory.name;
    elements.mobileDirectoryDescription.textContent = `共 ${items.length} 个单词，选择一个开始学习`;
  } else {
    items.forEach((directory, index) => fragment.append(createMobileDirectoryItem(directory, index)));
    elements.mobileDirectoryBack.hidden = true;
    elements.mobileDirectoryEyebrow.textContent = 'WORD DIRECTORIES';
    elements.mobileDirectoryTitle.textContent = '单词目录';
    elements.mobileDirectoryDescription.textContent = '点击编号标记已复习，点击目录查看单词';
  }

  elements.mobileDirectoryList.replaceChildren(fragment);
  elements.mobileDirectoryEmpty.hidden = items.length > 0;
  elements.mobileDirectoryList.hidden = items.length === 0;
  if (!items.length) {
    const title = elements.mobileDirectoryEmpty.querySelector('h2');
    const description = elements.mobileDirectoryEmpty.querySelector('p');
    title.textContent = openDirectory ? '这个目录还是空的' : '目录还是空的';
    description.textContent = openDirectory
      ? '请在电脑端把单词移动到这个目录。'
      : '请先在电脑端创建目录并录入学习内容。';
  }
  state.mobileDirectoryDirty = false;
}

function renderMobileFavorites() {
  if (!state.mobileFavoritesDirty) return;

  const favorites = getMobileFavorites();
  const fragment = document.createDocumentFragment();
  favorites.forEach((word, index) => {
    fragment.append(createMobileListItem(word, index, true));
  });
  elements.mobileFavoritesList.replaceChildren(fragment);
  elements.mobileFavoritesEmpty.hidden = favorites.length > 0;
  elements.mobileFavoritesList.hidden = favorites.length === 0;
  elements.mobileFavoritesSummary.textContent = favorites.length
    ? `已收藏 ${favorites.length} 个单词，点击即可继续学习`
    : '收藏的单词会出现在这里';
  state.mobileFavoritesDirty = false;
}

function updateMobileViewVisibility() {
  const total = getMobileStudyWords().length;
  elements.mobileLearningLoading.hidden = true;
  const showingStudy = state.mobileView === 'study';
  elements.mobileLearningEmpty.hidden = !showingStudy || total > 0;
  elements.mobileStudyContent.hidden = !showingStudy || total === 0;
  elements.mobileDirectoryView.hidden = state.mobileView !== 'directory';
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

  if (!total) return;

  state.mobileIndex = Math.min(Math.max(state.mobileIndex, 0), total - 1);
  const word = studyWords[state.mobileIndex];
  const examples = word.examples || [];

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
  else if (state.mobileView === 'favorites') renderMobileFavorites();
  else renderCurrentMobileWord();
}

function applyMobileWords(words, directories = state.directories) {
  const currentWordId = getMobileStudyWords()[state.mobileIndex]?.id;
  state.words = words;
  state.directories = directories;
  if (state.mobileOpenDirectoryId
      && !directories.some((directory) => directory.id === state.mobileOpenDirectoryId)) {
    state.mobileOpenDirectoryId = '';
  }
  if (state.mobileStudyDirectoryId
      && !directories.some((directory) => directory.id === state.mobileStudyDirectoryId)) {
    state.mobileStudyDirectoryId = '';
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
  renderActiveMobileView();
}

function setMobileView(view) {
  if (view === 'directory') {
    state.mobileOpenDirectoryId = '';
    state.mobileDirectoryDirty = true;
  }
  state.mobileView = view;
  state.mobileExpanded = false;
  renderActiveMobileView();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function openMobileWord(wordId) {
  if (state.mobileOpenDirectoryId) state.mobileStudyDirectoryId = state.mobileOpenDirectoryId;
  else state.mobileStudyDirectoryId = '';
  const wordIndex = getMobileStudyWords().findIndex((word) => word.id === wordId);
  if (wordIndex < 0) return;
  state.mobileIndex = wordIndex;
  setMobileView('study');
}

function openMobileDirectory(directoryId) {
  if (!state.directories.some((directory) => directory.id === directoryId)) return;
  state.mobileOpenDirectoryId = directoryId;
  state.mobileDirectoryDirty = true;
  renderActiveMobileView();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function closeMobileDirectory() {
  state.mobileOpenDirectoryId = '';
  state.mobileDirectoryDirty = true;
  renderActiveMobileView();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function toggleMobileDirectoryReviewed(directoryId) {
  if (state.mobileReviewedDirectoryIds.has(directoryId)) {
    state.mobileReviewedDirectoryIds.delete(directoryId);
  } else {
    state.mobileReviewedDirectoryIds.add(directoryId);
  }
  saveMobileReviewedDirectories();
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
  saveMobileFavorites();
  state.mobileFavoritesDirty = true;
  updateMobileNavigation();

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
  renderCurrentMobileWord();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderDirectoryOptions(selectedId = '') {
  const currentValue = selectedId || elements.directorySelect.value;
  const fragment = document.createDocumentFragment();
  state.directories.forEach((directory) => {
    const option = createElement('option', '', directory.name);
    option.value = directory.id;
    fragment.append(option);
  });
  elements.directorySelect.replaceChildren(fragment);
  elements.directorySelect.value = state.directories.some((directory) => directory.id === currentValue)
    ? currentValue
    : state.directories[0]?.id || '';
}

function renderDesktopDirectoryNavigation() {
  elements.allWordsNav.classList.toggle('active', !state.desktopDirectoryId);
  const fragment = document.createDocumentFragment();
  state.directories.forEach((directory) => {
    const button = createElement('button', 'desktop-directory-item');
    button.type = 'button';
    button.dataset.directoryId = directory.id;
    button.classList.toggle('active', state.desktopDirectoryId === directory.id);
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
  state.directories.forEach((directory) => {
    const item = createElement('div', 'directory-manager-item');
    const copy = createElement('div', 'directory-manager-copy');
    copy.append(
      createElement('strong', '', directory.name),
      createElement('small', '', `${directory.wordCount} 个单词`),
    );
    const actions = createElement('div', 'directory-manager-actions');

    const editButton = createElement('button', 'card-action');
    editButton.type = 'button';
    editButton.dataset.directoryAction = 'edit';
    editButton.dataset.directoryId = directory.id;
    editButton.setAttribute('aria-label', `重命名 ${directory.name}`);
    editButton.innerHTML = icons.edit;
    actions.append(editButton);

    if (directory.id === 'default') {
      actions.append(createElement('span', 'directory-manager-default', '默认'));
    } else {
      const deleteButton = createElement('button', 'card-action delete');
      deleteButton.type = 'button';
      deleteButton.dataset.directoryAction = 'delete';
      deleteButton.dataset.directoryId = directory.id;
      deleteButton.setAttribute('aria-label', `删除 ${directory.name}`);
      deleteButton.innerHTML = icons.delete;
      actions.append(deleteButton);
    }

    item.append(copy, actions);
    fragment.append(item);
  });
  elements.directoryManagerList.replaceChildren(fragment);
}

function applyDirectories(directories) {
  state.directories = directories;
  if (state.desktopDirectoryId
      && !directories.some((directory) => directory.id === state.desktopDirectoryId)) {
    state.desktopDirectoryId = '';
  }
  renderDesktopDirectoryNavigation();
  if (elements.directoryDialog.open) renderDirectoryManager();
}

function setDesktopDirectory(directoryId) {
  if (state.desktopDirectoryId === directoryId) return;
  state.desktopDirectoryId = directoryId;
  loadWords();
}

function resetDirectoryForm() {
  state.editingDirectoryId = '';
  elements.directoryId.value = '';
  elements.directoryNameInput.value = '';
  elements.directoryNameError.textContent = '';
  elements.directoryFormLabel.textContent = '新建目录';
  elements.submitDirectoryButton.textContent = '添加';
  elements.cancelDirectoryEditButton.hidden = true;
}

function openDirectoryDialog() {
  resetDirectoryForm();
  renderDirectoryManager();
  elements.directoryDialog.showModal();
  requestAnimationFrame(() => elements.directoryNameInput.focus());
}

function startDirectoryEdit(directoryId) {
  const directory = state.directories.find((item) => item.id === directoryId);
  if (!directory) return;
  state.editingDirectoryId = directory.id;
  elements.directoryId.value = directory.id;
  elements.directoryNameInput.value = directory.name;
  elements.directoryNameError.textContent = '';
  elements.directoryFormLabel.textContent = '重命名目录';
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
  elements.submitDirectoryButton.disabled = true;
  try {
    const result = await apiFetch(id ? `/api/directories/${id}` : '/api/directories', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name }),
    });
    showToast(result.message);
    resetDirectoryForm();
    await loadWords();
  } catch (error) {
    elements.directoryNameError.textContent = error.message;
  } finally {
    elements.submitDirectoryButton.disabled = false;
  }
}

async function deleteDirectory(directoryId) {
  const directory = state.directories.find((item) => item.id === directoryId);
  if (!directory || directory.id === 'default') return;
  if (!window.confirm(`删除“${directory.name}”目录？其中单词会移入默认目录。`)) return;

  try {
    const result = await apiFetch(`/api/directories/${directory.id}`, { method: 'DELETE' });
    showToast(result.message);
    if (state.desktopDirectoryId === directory.id) state.desktopDirectoryId = '';
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleDirectoryManagerClick(event) {
  const button = event.target.closest('[data-directory-action]');
  if (!button) return;
  if (button.dataset.directoryAction === 'edit') startDirectoryEdit(button.dataset.directoryId);
  else if (button.dataset.directoryAction === 'delete') deleteDirectory(button.dataset.directoryId);
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

  state.words.forEach((word, index) => {
    const card = createElement('article', 'word-card');
    card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;

    const header = createElement('div', 'word-card-header');
    const title = createElement('h3', '', word.word);
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

    const directory = state.directories.find((item) => item.id === word.directoryId);
    if (directory) card.append(createElement('span', 'word-directory-badge', directory.name));

    if (word.examples?.length) {
      card.append(createElement('p', 'example', `“${word.examples[0]}”`));
    }

    if (word.notes) {
      card.append(createElement('p', 'notes-preview', word.notes));
    }

    elements.wordGrid.append(card);
  });
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

async function loadWords() {
  try {
    const mobileLayout = isMobileLayout();
    const params = new URLSearchParams(mobileLayout
      ? { sort: 'updated-desc' }
      : {
          q: elements.searchInput.value.trim(),
          sort: elements.sortSelect.value,
          ...(state.desktopDirectoryId ? { directoryId: state.desktopDirectoryId } : {}),
        });
    const { data, meta } = await apiFetch(`/api/words?${params}`);
    if (mobileLayout) applyMobileWords(data, meta.directories || []);
    else {
      state.words = data;
      applyDirectories(meta.directories || []);
      renderDesktopWords();
    }
  } catch (error) {
    elements.resultSummary.textContent = '载入失败，请稍后刷新页面';
    if (isMobileLayout()) elements.mobileLearningLoading.hidden = true;
    showToast(error.message, 'error');
  }
}

async function refreshMobileWords() {
  if (elements.mobileRefreshButton.disabled) return;

  elements.mobileRefreshButton.disabled = true;
  elements.mobileRefreshButton.classList.add('refreshing');
  elements.mobileRefreshButton.setAttribute('aria-busy', 'true');
  elements.mobileRefreshLabel.textContent = '刷新中';

  try {
    const params = new URLSearchParams({
      sort: 'updated-desc',
      refresh: Date.now().toString(),
    });
    const { data, meta } = await apiFetch(`/api/words?${params}`, { cache: 'no-store' });
    applyMobileWords(data, meta.directories || []);
    showToast(`已加载最新内容，共 ${data.length} 个单词`);
  } catch (error) {
    showToast(`刷新失败，仍显示原有内容：${error.message}`, 'error');
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
      openMobileDirectory(directoryAction.dataset.directoryId);
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
  renderDirectoryOptions(word?.directoryId || state.desktopDirectoryId || 'default');
  elements.wordDialog.showModal();
  requestAnimationFrame(() => elements.wordInput.focus());
}

function closeWordDialog() {
  if (elements.wordDialog.open) elements.wordDialog.close();
}

function formPayload() {
  return {
    word: elements.wordInput.value,
    meaning: elements.meaningInput.value,
    examples: elements.examplesInput.value,
    notes: elements.notesInput.value,
    directoryId: elements.directorySelect.value,
  };
}

async function submitWord(event) {
  event.preventDefault();
  resetFormErrors();
  const id = elements.wordId.value;
  elements.submitWordButton.disabled = true;
  elements.submitWordButton.querySelector('span').textContent = '正在保存……';

  try {
    const result = await apiFetch(id ? `/api/words/${id}` : '/api/words', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(formPayload()),
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
  if (button) setDesktopDirectory(button.dataset.directoryId);
});
elements.manageDirectoriesButton.addEventListener('click', openDirectoryDialog);
elements.closeDirectoryDialogButton.addEventListener('click', () => elements.directoryDialog.close());
elements.directoryForm.addEventListener('submit', submitDirectory);
elements.cancelDirectoryEditButton.addEventListener('click', resetDirectoryForm);
elements.directoryManagerList.addEventListener('click', handleDirectoryManagerClick);
elements.closeDialogButton.addEventListener('click', closeWordDialog);
elements.cancelDialogButton.addEventListener('click', closeWordDialog);
elements.wordForm.addEventListener('submit', submitWord);
elements.cancelDeleteButton.addEventListener('click', () => elements.deleteDialog.close());
elements.confirmDeleteButton.addEventListener('click', deleteWord);
elements.searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => loadWords(), 220);
});
elements.sortSelect.addEventListener('change', () => loadWords());
elements.mobileExpandButton.addEventListener('click', () => setMobileExpanded(!state.mobileExpanded));
elements.mobileNextButton.addEventListener('click', showNextMobileWord);
elements.mobileFavoriteButton.addEventListener('click', () => {
  const word = getMobileStudyWords()[state.mobileIndex];
  if (word) toggleMobileFavorite(word.id);
});
elements.mobileDirectoryTab.addEventListener('click', () => setMobileView('directory'));
elements.mobileStudyTab.addEventListener('click', () => setMobileView('study'));
elements.mobileFavoritesTab.addEventListener('click', () => setMobileView('favorites'));
elements.mobileRefreshButton.addEventListener('click', refreshMobileWords);
elements.mobileDirectoryBack.addEventListener('click', closeMobileDirectory);
elements.mobileDirectoryList.addEventListener('click', handleMobileListClick);
elements.mobileFavoritesList.addEventListener('click', handleMobileListClick);

for (const dialog of [elements.wordDialog, elements.directoryDialog, elements.deleteDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    if (isMobileLayout()) return;
    event.preventDefault();
    elements.searchInput.focus();
  }
});

setTodayLabel();
if (!isMobileLayout()) {
  elements.wordGrid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
}
Promise.all(isMobileLayout() ? [loadWords()] : [loadWords(), loadStats()]);
