const MOBILE_FAVORITES_KEY = 'wordbook.mobile.favorites.v1';

function loadMobileFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(MOBILE_FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

const state = {
  words: [],
  deletingWord: null,
  searchTimer: null,
  mobileIndex: 0,
  mobileExpanded: false,
  mobileView: 'study',
  mobileFavoriteIds: loadMobileFavorites(),
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

function getMobileFavorites() {
  return state.words.filter((word) => state.mobileFavoriteIds.has(word.id));
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
  elements.mobileHeaderTotal.textContent = state.mobileView === 'favorites'
    ? `${favoriteCount} 收藏`
    : `${state.words.length} 词`;

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
  openButton.setAttribute('aria-label', `学习 ${word.word}`);

  const number = createElement('span', 'mobile-word-list-number', String(index + 1).padStart(2, '0'));
  const copy = createElement('span', 'mobile-word-list-copy');
  copy.append(
    createElement('strong', '', word.word),
    createElement('small', '', word.meaning || '暂时没有释义'),
  );
  const arrow = createElement('span', 'mobile-word-list-arrow', '›');
  openButton.append(number, copy, arrow);
  openButton.addEventListener('click', () => openMobileWord(word.id));
  item.append(openButton);

  if (favoriteList) {
    const unFavoriteButton = createElement('button', 'mobile-list-favorite active');
    unFavoriteButton.type = 'button';
    unFavoriteButton.setAttribute('aria-label', `取消收藏 ${word.word}`);
    unFavoriteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>';
    unFavoriteButton.addEventListener('click', () => toggleMobileFavorite(word.id));
    item.append(unFavoriteButton);
  }

  return item;
}

function renderMobileLists() {
  elements.mobileDirectoryList.replaceChildren();
  state.words.forEach((word, index) => {
    elements.mobileDirectoryList.append(createMobileListItem(word, index));
  });
  elements.mobileDirectoryEmpty.hidden = state.words.length > 0;
  elements.mobileDirectoryList.hidden = state.words.length === 0;

  const favorites = getMobileFavorites();
  elements.mobileFavoritesList.replaceChildren();
  favorites.forEach((word, index) => {
    elements.mobileFavoritesList.append(createMobileListItem(word, index, true));
  });
  elements.mobileFavoritesEmpty.hidden = favorites.length > 0;
  elements.mobileFavoritesList.hidden = favorites.length === 0;
  elements.mobileFavoritesSummary.textContent = favorites.length
    ? `已收藏 ${favorites.length} 个单词，点击即可继续学习`
    : '收藏的单词会出现在这里';
}

function renderMobileLearning() {
  const total = state.words.length;
  elements.mobileLearningLoading.hidden = true;
  updateMobileNavigation();
  renderMobileLists();

  const showingStudy = state.mobileView === 'study';
  elements.mobileLearningEmpty.hidden = !showingStudy || total > 0;
  elements.mobileStudyContent.hidden = !showingStudy || total === 0;
  elements.mobileDirectoryView.hidden = state.mobileView !== 'directory';
  elements.mobileFavoritesView.hidden = state.mobileView !== 'favorites';

  if (!total) return;

  state.mobileIndex = Math.min(Math.max(state.mobileIndex, 0), total - 1);
  const word = state.words[state.mobileIndex];
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

  const isFavorite = state.mobileFavoriteIds.has(word.id);
  elements.mobileFavoriteButton.classList.toggle('active', isFavorite);
  elements.mobileFavoriteButton.setAttribute('aria-pressed', String(isFavorite));
  elements.mobileFavoriteButton.setAttribute(
    'aria-label',
    isFavorite ? `取消收藏 ${word.word}` : `收藏 ${word.word}`,
  );

  setMobileExpanded(state.mobileExpanded);
}

function setMobileView(view) {
  state.mobileView = view;
  state.mobileExpanded = false;
  renderMobileLearning();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMobileWord(wordId) {
  const wordIndex = state.words.findIndex((word) => word.id === wordId);
  if (wordIndex < 0) return;
  state.mobileIndex = wordIndex;
  setMobileView('study');
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
  renderMobileLearning();
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
  if (state.words.length < 2) return;
  state.mobileIndex = (state.mobileIndex + 1) % state.words.length;
  state.mobileExpanded = false;
  renderMobileLearning();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderWords() {
  elements.wordGrid.replaceChildren();
  const hasWords = state.words.length > 0;
  elements.wordGrid.hidden = !hasWords;
  elements.emptyState.hidden = hasWords;
  renderMobileLearning();

  const hasFilters = Boolean(elements.searchInput.value.trim());
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
    const params = new URLSearchParams({
      q: elements.searchInput.value.trim(),
      sort: elements.sortSelect.value,
    });
    const { data } = await apiFetch(`/api/words?${params}`);
    state.words = data;
    renderWords();
  } catch (error) {
    elements.resultSummary.textContent = '载入失败，请稍后刷新页面';
    showToast(error.message, 'error');
  }
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
  const word = state.words[state.mobileIndex];
  if (word) toggleMobileFavorite(word.id);
});
elements.mobileDirectoryTab.addEventListener('click', () => setMobileView('directory'));
elements.mobileStudyTab.addEventListener('click', () => setMobileView('study'));
elements.mobileFavoritesTab.addEventListener('click', () => setMobileView('favorites'));

for (const dialog of [elements.wordDialog, elements.deleteDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    if (window.matchMedia('(max-width: 700px), (max-width: 950px) and (pointer: coarse)').matches) return;
    event.preventDefault();
    elements.searchInput.focus();
  }
});

setTodayLabel();
elements.wordGrid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
Promise.all([loadWords(), loadStats()]);
