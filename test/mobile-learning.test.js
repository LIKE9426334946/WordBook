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

  assert.match(script, /function renderMobileLearning\(\)/);
  assert.match(script, /state\.mobileIndex = \(state\.mobileIndex \+ 1\) % state\.words\.length/);
  assert.match(script, /setMobileExpanded\(!state\.mobileExpanded\)/);
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
