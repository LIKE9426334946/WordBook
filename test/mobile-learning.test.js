const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDirectory = path.join(__dirname, '../public');
const html = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(publicDirectory, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(publicDirectory, 'styles.css'), 'utf8');

test('mobile view is a study-only surface', () => {
  const start = html.indexOf('<section class="mobile-learning-view"');
  const end = html.indexOf('<dialog class="word-dialog"');
  const mobileMarkup = html.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(mobileMarkup, /id="mobileWord"/);
  assert.match(mobileMarkup, /id="mobileExpandButton"/);
  assert.match(mobileMarkup, /id="mobileNextButton"/);
  assert.doesNotMatch(mobileMarkup, /WORD · PHRASE/);
  assert.doesNotMatch(mobileMarkup, /添加单词|编辑|删除/);
});

test('mobile view includes directory, study and favorites navigation', () => {
  for (const id of [
    'mobileDirectoryTab',
    'mobileStudyTab',
    'mobileFavoritesTab',
    'mobileDirectoryView',
    'mobileFavoritesView',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, />目录</);
  assert.match(html, />学习</);
  assert.match(html, />收藏</);
  assert.match(styles, /\.mobile-bottom-nav\s*\{/);
  assert.match(styles, /position: fixed;/);
});

test('mobile directory uses server-managed groups with an independent local review toggle', () => {
  for (const id of [
    'mobileDirectoryBack',
    'mobileDirectoryTitle',
    'mobileDirectoryDescription',
    'directorySelect',
    'manageDirectoriesButton',
    'directoryDialog',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(script, /wordbook\.mobile\.reviewed-directories\.v1/);
  assert.match(script, /localStorage\.setItem\(\s*MOBILE_REVIEWED_DIRECTORIES_KEY/s);
  assert.match(script, /function createMobileDirectoryItem\(directory, index\)/);
  assert.match(script, /dataset\.mobileAction = 'toggle-directory-review'/);
  assert.match(script, /dataset\.mobileAction = 'open-directory'/);
  assert.match(script, /function toggleMobileDirectoryReviewed\(directoryId\)/);
  assert.match(styles, /\.mobile-directory-review\.reviewed\s*\{/);
  assert.match(styles, /background: #def3e9;/);
});

test('favorites stay local and do not add a server word field', () => {
  assert.match(html, /id="mobileFavoriteButton"/);
  assert.match(script, /wordbook\.mobile\.favorites\.v1/);
  assert.match(script, /localStorage\.setItem\(MOBILE_FAVORITES_KEY/);
  assert.match(script, /function toggleMobileFavorite\(wordId\)/);
  assert.match(script, /function getMobileFavorites\(\)/);

  const formStart = html.indexOf('<form id="wordForm"');
  const formEnd = html.indexOf('</form>', formStart);
  const formMarkup = html.slice(formStart, formEnd);
  assert.doesNotMatch(formMarkup, /favorite/i);
});

test('mobile details include only the supported learning fields', () => {
  for (const id of [
    'mobileMeaning',
    'mobileExampleList',
    'mobileNotes',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.doesNotMatch(html, /id="mobile(?:Source|TagList|AddedDate)"/);

  assert.match(script, /function renderCurrentMobileWord\(\)/);
  assert.match(script, /state\.mobileIndex = \(state\.mobileIndex \+ 1\) % studyWords\.length/);
  assert.match(script, /setMobileExpanded\(!state\.mobileExpanded\)/);
});

test('directory refresh loads fresh server data only after a manual click', () => {
  assert.match(html, /id="mobileRefreshButton"/);
  assert.match(html, /id="mobileRefreshLabel">刷新</);
  assert.match(script, /async function refreshMobileWords\(\)/);
  assert.match(script, /cache: 'no-store'/);
  assert.match(script, /refresh: Date\.now\(\)\.toString\(\)/);
  assert.match(script, /mobileRefreshButton\.addEventListener\('click', refreshMobileWords\)/);
  assert.doesNotMatch(script, /setInterval\s*\(/);
});

test('mobile rendering avoids rebuilding hidden or unchanged large lists', () => {
  const nextWordStart = script.indexOf('function showNextMobileWord()');
  const desktopRenderStart = script.indexOf('function renderDesktopWords()', nextWordStart);
  const nextWordCode = script.slice(nextWordStart, desktopRenderStart);

  assert.match(nextWordCode, /renderCurrentMobileWord\(\)/);
  assert.doesNotMatch(nextWordCode, /renderMobileDirectory|renderMobileFavorites|renderDesktopWords/);
  assert.match(script, /if \(!state\.mobileDirectoryDirty\) return;/);
  assert.match(script, /if \(!state\.mobileFavoritesDirty\) return;/);
  assert.match(script, /createDocumentFragment\(\)/);
  assert.match(script, /mobileDirectoryList\.addEventListener\('click', handleMobileListClick\)/);
  assert.match(script, /if \(mobileLayout\) applyMobileWords\(data, meta\.directories \|\| \[\]\);\s*else \{/s);
  assert.match(styles, /content-visibility: auto;/);

  const mobileStylesStart = styles.indexOf('@media (max-width: 700px)');
  const reducedMotionStart = styles.indexOf('@media (prefers-reduced-motion', mobileStylesStart);
  assert.doesNotMatch(styles.slice(mobileStylesStart, reducedMotionStart), /backdrop-filter/);
});

test('mobile detail cards keep labels quieter than learning content', () => {
  assert.match(styles, /\.mobile-detail-section h2\s*\{[^}]*font-size: 12px;/s);
  assert.match(styles, /\.mobile-detail-section h2 > span\s*\{[^}]*width: 22px;[^}]*height: 22px;/s);
  assert.match(styles, /\.mobile-detail-section p\s*\{[^}]*font-size: 15px;/s);
  assert.match(styles, /\.mobile-example-list li\s*\{[^}]*font-size: 15px;/s);
  assert.match(styles, /\.mobile-detail-section h2::after\s*\{/);
});

test('desktop editor exposes exactly word, meaning, examples and notes', () => {
  const formStart = html.indexOf('<form id="wordForm"');
  const formEnd = html.indexOf('</form>', formStart);
  const formMarkup = html.slice(formStart, formEnd);
  const names = [...formMarkup.matchAll(/\sname="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(names, ['word', 'meaning', 'examples', 'notes']);
  assert.doesNotMatch(formMarkup, /sourcePdf|name="page"|name="tags"/);
});

test('small and touch-first screens hide management and show learning', () => {
  assert.match(styles, /@media \(max-width: 700px\), \(max-width: 950px\) and \(pointer: coarse\)/);
  assert.match(styles, /\.app-shell\s*\{\s*display: none;/);
  assert.match(styles, /\.mobile-learning-view\s*\{\s*display: block;/);
});
