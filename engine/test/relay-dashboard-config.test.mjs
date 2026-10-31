import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const toml = readFileSync(new URL('../dashboard/netlify.toml', import.meta.url), 'utf8');
const block = (heading) => {
  const lines = toml.split(/\r?\n/);
  const collected = [];
  let active = false;
  for (const line of lines) {
    if (line.trim() === `[${heading}]`) { active = true; continue; }
    if (active && line.trim().startsWith('[')) break;
    if (active) collected.push(line);
  }
  return collected.join('\n');
};

test('dashboard proof build remains active when the relay function is enabled', () => {
  assert.match(block('build'), /^\s*command\s*=\s*"node scripts\/build-proof\.mjs"\s*$/m);
  assert.match(block('build'), /^\s*publish\s*=\s*"\."\s*$/m);
});

test('portable relay function is discoverable without changing dashboard routes', () => {
  assert.match(block('functions'), /^\s*directory\s*=\s*"netlify\/functions"\s*$/m);
  assert.match(block('functions'), /^\s*node_bundler\s*=\s*"esbuild"\s*$/m);
  assert.match(toml, /from\s*=\s*"\/dashboard"[\s\S]*?to\s*=\s*"\/index\.html"/);
  assert.match(toml, /from\s*=\s*"\/dashboard\/\*"[\s\S]*?to\s*=\s*"\/index\.html"/);
});

test('the config preserves baseline browser security headers', () => {
  assert.match(toml, /X-Content-Type-Options\s*=\s*"nosniff"/);
  assert.match(toml, /Referrer-Policy\s*=\s*"no-referrer"/);
});
