const assert = require('node:assert/strict');
const test = require('node:test');
const shared = require('../edge-extension/shared');

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

test('extension extracts PDF filename and hash page number', () => {
  assert.deepEqual(
    shared.pdfMetadata({
      title: 'Paper - Microsoft Edge',
      url: 'https://example.com/files/deep%20learning.pdf#page=42',
    }),
    { sourcePdf: 'deep learning.pdf', page: 42 },
  );
});

test('extension parses examples and unique tags', () => {
  assert.deepEqual(shared.parseLines('First.\n\nSecond.'), ['First.', 'Second.']);
  assert.deepEqual(shared.parseTags('论文, 神经网络，论文'), ['论文', '神经网络']);
});
