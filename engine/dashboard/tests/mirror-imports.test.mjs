import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const prep=readFileSync(new URL('../scripts/prepare-mirror.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function allowlist(){
 const body=prep.match(/const allowedFiles = \\[([\\s\\S]*?)\\];/)?.[1];
 assert.ok(body,'mirror allowlist missing');
 return [...body.matchAll(/'([^']+)'/g)].map(x=>x[1]);
}
test('mirror includes all dashboard static module imports',()=>{
 const files=allowlist();
 const imports=[...html.matchAll(/from ['"]\\.\\/([^'"]+)['"]/g)].map(x=>x[1]);
 const srcs=[...html.matchAll(/<script[^>]+src="\\.\\/([^"]+)"/g)].map(x=>x[1]);
 for(const name of [...imports,...srcs])
  assert.ok(files.includes(name),'mirror missing dashboard dependency '+name);
});
test('mirror includes priority feed and its script',()=>{
 const files=allowlist();
 for(const name of ['priority-watch.mjs','priority-watch.json','queue-counts.mjs'])
  assert.ok(files.includes(name),'mirror missing '+name);
});
