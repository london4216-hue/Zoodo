import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('unverified primary demo links are hidden before asynchronous receipt checks',()=>{
 assert.match(html,/\.launchlinks a:not\(\[data-zoo-verified\]\):not\(\[data-zoo-home\]\)\{display:none\}/);
 assert.match(html,/link\.dataset\.zooVerified='true';\s*nav\.appendChild\(link\)/);
 assert.match(html,/delete link\.dataset\.zooVerified;\s*let row=repairRows\.get\(link\)/);
});
test('fallback dashboard home remains visible and existing links are not deleted',()=>{
 assert.match(html,/a\.dataset\.zooHome='true'/);
 assert.match(html,/repair\.appendChild\(row\)/);
 for(const href of ['https://prestigeengage-demo.netlify.app/','https://beautypaths.io/app','https://github.com/london4216-hue/Zoodo']){
  assert.ok(html.includes('href="'+href+'"'), 'missing owner link: '+href);
 }
});
test('verification requires genuine landing receipt and expires within one hour',()=>{
 assert.match(html,/x\.expectedLandingVerified===true&&x\.independentCheck===true/);
 assert.match(html,/now-Date\.parse\(x\.checkedAt\)<3600000/);
 assert.match(html,/classifyDemoLinks\(\)\.catch/);
});
