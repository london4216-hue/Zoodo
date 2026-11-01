import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../accountability.html',import.meta.url),'utf8');

test('historical accountability totals are not shown as current',()=>{
 for(const id of ['open','active','completed','races','blocks'])
  assert.match(html,new RegExp('id="'+id+'">UNKNOWN<\\/b>'));
 assert.doesNotMatch(html,/id="open">477<\\/b>/);
});
test('historical agent rows do not claim present idle state',()=>{
 assert.doesNotMatch(html,/<td>idle<\\/td>/);
 assert.match(html,/Historical · current UNKNOWN/);
});
test('board data must carry a recent, nonfuture observation',()=>{
 assert.match(html,/Date\\.parse\\(d\\.observed_at/);
 assert.match(html,/observed>Date\\.now\\(\\)\\+60000/);
 assert.match(html,/Date\\.now\\(\\)-observed>75\\*60000/);
 assert.match(html,/board feed lacks count or agent data/);
});
test('browser repaint does not become a source timestamp',()=>{
 assert.doesNotMatch(html,/Ledger data loaded from \\/board\\.json at/);
 assert.match(html,/Board snapshot observed/);
});
test('original navigation and historical receipt links are preserved',()=>{
 for(const href of ['./index.html','https://github.com/london4216-hue/Zoodo/issues','https://github.com/london4216-hue/TransendIQ/issues/871','/board.json'])
  assert.ok(html.includes('href="'+href+'"'),href);
});
