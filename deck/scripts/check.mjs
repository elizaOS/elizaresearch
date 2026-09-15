import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const sections = [...html.matchAll(/<section\b([^>]+)>/g)].map(match => match[1]);
assert.equal(sections.length, 7, 'The reference has seven slides');
assert.equal(sections.filter(attrs => /class="[^"]*\bactive\b/.test(attrs)).length, 1);
const ids = sections.map(attrs => attrs.match(/\bid="([^"]+)"/)?.[1]);
assert(ids.every(Boolean), 'All slides need stable IDs');
assert.equal(new Set(ids).size, sections.length);

assert(!/<script\b[^>]*>\s*[^<\s]/.test(html), 'No inline or third-party scripts');
assert(!/\b(?:style|onload|onclick)=/.test(html), 'Use external CSS and event handlers');
for (const [, asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^[a-z]+:/i.test(asset)) continue;
  assert(!asset.startsWith('/'), 'Local assets must use relative paths');
  await access(resolve(root, asset));
}
for (const id of ['slide-status']) assert(html.includes(`id="${id}"`));
for (const text of ['product concept, being validated in research', 'Sources on request:', 'mailto:camilla@elizaresearch.ai']) assert(html.includes(text));
console.log('Deck check passed: seven slides, unique URLs, navigation, source labels, and local assets.');
