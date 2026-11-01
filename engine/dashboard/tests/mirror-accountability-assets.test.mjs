import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const builder = readFileSync(resolve(root, 'scripts/prepare-mirror.mjs'), 'utf8');
const list = builder.match(/const allowedFiles = \[([\s\S]*?)\];/)?.[1];
assert.ok(list, 'explicit mirror allowlist must exist');
const allowed = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
const localLinks = [...html.matchAll(/\b(?:href|src)=["']\.\/([^"'?#]+)["']/g)].map(match => match[1]);

test('mirror includes existing accountability iframe and source-linked handoff ledger', () => {
  for (const file of ['accountability.html', 'handoff-ledger.json']) {
    assert.ok(localLinks.includes(file), file + ' is an original dashboard link');
    assert.ok(existsSync(resolve(root, file)), file + ' exists in canonical source');
    assert.ok(allowed.includes(file), file + ' must ship to every static mirror');
  }
});

test('mirror remains an explicit public asset allowlist, not a repository copy', () => {
  assert.ok(allowed.includes('index.html'));
  assert.ok(allowed.includes('automation-proof.json'));
  assert.ok(allowed.includes('hosting-mirrors.json'));
  assert.equal(allowed.length, new Set(allowed).size);
  assert.ok(allowed.every(file => !file.startsWith('/') && !file.includes('..') && !file.startsWith('.')));
  assert.ok(!allowed.some(file => /(?:\.env|secrets?|service.role|private)/i.test(file)));
});
