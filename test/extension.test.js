const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const shared = require('../edge-extension/shared');

const extensionDirectory = path.join(__dirname, '../edge-extension');

test('extension normalizes selected words without damaging apostrophes', () => {
  assert.equal(shared.normalizeSelection('  “gradient,”  '), 'gradient');
  assert.equal(shared.normalizeSelection("  don't  "), "don't");
  assert.equal(shared.normalizeSelection('state-of-the-art.'), 'state-of-the-art');
  assert.equal(shared.normalizeSelection('multiple\n\twords'), 'multiple words');
});

test('extension validates and normalizes server URLs', () => {
  assert.equal(shared.normalizeServerUrl('http://example.com:16040/'), 'http://example.com:16040');
  assert.equal(shared.normalizeServerUrl('https://example.com/wordbook/'), 'https://example.com/wordbook');
  assert.equal(shared.permissionPattern('http://example.com:16040'), 'http://example.com:16040/*');
  assert.throws(() => shared.normalizeServerUrl('ftp://example.com'), /http/);
});

test('extension parses examples line by line', () => {
  assert.deepEqual(shared.parseLines('First.\n\nSecond.'), ['First.', 'Second.']);
});

test('extension editor submits only the four supported fields', () => {
  const html = fs.readFileSync(path.join(extensionDirectory, 'editor.html'), 'utf8');
  const script = fs.readFileSync(path.join(extensionDirectory, 'editor.js'), 'utf8');
  const formStart = html.indexOf('<form id="word-form"');
  const formEnd = html.indexOf('</form>', formStart);
  const formMarkup = html.slice(formStart, formEnd);
  const names = [...formMarkup.matchAll(/\sname="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(names, ['word', 'meaning', 'examples', 'notes']);
  assert.doesNotMatch(formMarkup, /sourcePdf|name="page"|name="tags"/);
  assert.doesNotMatch(script, /sourcePdf|pageInput|parseTags/);
});
