import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const base = 'https://deck.elizaresearch.ai/';
for (const asset of ['index.html', 'styles.css', 'deck.js', 'assets/mark.svg', 'assets/logo-white.svg', 'assets/senior-independence-preview.png', 'oembed.json', 'assets/geist-sans-latin.woff2']) {
  const response = await fetch(new URL(asset === 'index.html' ? '' : asset, base));
  assert.equal(response.status, 200, `${asset}: HTTP ${response.status}`);
  const served = Buffer.from(await response.arrayBuffer());
  assert(served.equals(await readFile(resolve(root, asset))), `${asset}: production differs from this checkout`);
  if (asset === 'index.html') assert(response.headers.get('content-security-policy')?.includes("default-src 'self'"));
  console.log(`Verified production bytes: ${asset}`);
}
const missing = await fetch(new URL('not-a-real-file.js', base));
assert.equal(missing.status, 404, 'Missing assets must return 404');
console.log('Production HTTPS, assets, security header, and missing-file handling verified.');
