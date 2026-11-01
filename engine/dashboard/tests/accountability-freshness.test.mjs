import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../accountability.html', import.meta.url), 'utf8');

test('historical counters default to UNKNOWN', () => {
  for (const id of ['open', 'active', 'completed', 'races', 'blocks']) {
    assert.ok(html.includes('id="' + id + '">UNKNOWN</b>'), id);
  }
  assert.ok(!html.includes('id="open">477</b>'));
});

test('historical agent status is not presented as current', () => {
  assert.ok(html.includes('Historical · current UNKNOWN'));
  assert.ok(!html.includes('<td>idle</td>'));
});

test('board feed requires credible source freshness', () => {
  assert.ok(html.includes("Date.parse(d.observed_at??'')"));
  assert.ok(html.includes('observed>Date.now()+60000'));
  assert.ok(html.includes('Date.now()-observed>75*60000'));
  assert.ok(html.includes('board feed lacks count or agent data'));
});

test('page repaint does not masquerade as board observation', () => {
  assert.ok(html.includes("Board snapshot observed '+d.observed_at"));
  assert.ok(!html.includes('Ledger data loaded from /board.json at'));
});

test('all original navigation and receipt links remain', () => {
  for (const href of [
    './index.html',
    'https://github.com/london4216-hue/Zoodo/issues',
    'https://github.com/london4216-hue/TransendIQ/issues/871',
    '/board.json'
  ]) assert.ok(html.includes('href="' + href + '"'), href);
});
