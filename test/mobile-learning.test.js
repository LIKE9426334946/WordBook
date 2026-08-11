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
  assert.doesNotMatch(mobileMarkup, /添加单词|编辑|删除/);
});

test('mobile details include every supported word field', () => {
  for (const id of [
    'mobileMeaning',
    'mobileExampleList',
    'mobileNotes',
    'mobileSource',
    'mobileTagList',
    'mobileAddedDate',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(script, /function renderMobileLearning\(\)/);
  assert.match(script, /state\.mobileIndex = \(state\.mobileIndex \+ 1\) % state\.words\.length/);
  assert.match(script, /setMobileExpanded\(!state\.mobileExpanded\)/);
});

test('small and touch-first screens hide management and show learning', () => {
  assert.match(styles, /@media \(max-width: 700px\), \(max-width: 950px\) and \(pointer: coarse\)/);
  assert.match(styles, /\.app-shell\s*\{\s*display: none;/);
  assert.match(styles, /\.mobile-learning-view\s*\{\s*display: block;/);
});
