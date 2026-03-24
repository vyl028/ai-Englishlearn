import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonFromText } from '../src/ai/json.ts';
import { hashAiCachePayload } from '../src/lib/ai-cache.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.resolve(root, file));
}

function readText(file) {
  return fs.readFileSync(path.resolve(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.resolve(root, file));
}

function pngSize(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(buf.subarray(0, 8).equals(sig), 'Not a PNG file');
  const type = buf.toString('ascii', 12, 16);
  assert.equal(type, 'IHDR', 'Missing IHDR chunk');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function testPwaAssets() {
  assert.ok(exists('public/manifest.json'), 'Missing public/manifest.json');
  assert.ok(exists('public/sw.js'), 'Missing public/sw.js');
  assert.ok(exists('public/icon-192x192.png'), 'Missing public/icon-192x192.png');
  assert.ok(exists('public/icon-512x512.png'), 'Missing public/icon-512x512.png');

  const icon192 = read('public/icon-192x192.png');
  const icon512 = read('public/icon-512x512.png');
  assert.deepEqual(pngSize(icon192), { width: 192, height: 192 }, 'icon-192x192.png size mismatch');
  assert.deepEqual(pngSize(icon512), { width: 512, height: 512 }, 'icon-512x512.png size mismatch');

  const manifest = JSON.parse(readText('public/manifest.json'));
  const iconSrcs = (manifest.icons || []).map((i) => i && i.src).filter(Boolean);
  assert.ok(iconSrcs.includes('/icon-192x192.png'), 'manifest.json missing /icon-192x192.png');
  assert.ok(iconSrcs.includes('/icon-512x512.png'), 'manifest.json missing /icon-512x512.png');

  const sw = readText('public/sw.js');
  assert.ok(sw.includes('lexicapture-static-'), 'sw.js missing cache name prefix');
}

function testJsonParsing() {
  assert.deepEqual(parseJsonFromText('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonFromText('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonFromText('noise\n[{"a":1}]\nmore'), [{ a: 1 }]);
  assert.deepEqual(parseJsonFromText('text {"a":1, "b":[2,3]} end'), { a: 1, b: [2, 3] });
}

function testAiCacheHash() {
  const h1 = hashAiCachePayload({ a: 1, b: [2, 3] });
  const h2 = hashAiCachePayload({ a: 1, b: [2, 3] });
  const h3 = hashAiCachePayload({ a: 1, b: [2, 4] });
  assert.equal(h1, h2, 'hash should be stable');
  assert.notEqual(h1, h3, 'hash should change when payload changes');
}

function main() {
  testPwaAssets();
  testJsonParsing();
  testAiCacheHash();
  // eslint-disable-next-line no-console
  console.log('smoke ok');
}

main();

