import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const start=html.indexOf(" $('dashboardEvidenceRefresh').textContent=");
const end=html.indexOf("\n if(commits.status==='fulfilled'){",start);
assert.ok(start>=0&&end>start,'expected exact GitHub API status assignment');
const assignment=html.slice(start,end).trim();

function render(commitsStatus,actionsStatus){
 let displayed='PREVIOUS SUCCESS';
 const $=id=>({set textContent(value){if(id==='dashboardEvidenceRefresh')displayed=value;}});
 vm.runInNewContext(assignment,{
  commits:{status:commitsStatus},
  runs:{status:actionsStatus},
  $
 },{timeout:1000});
 return displayed;
}

for(const [commits,actions] of [
 ['fulfilled','fulfilled'],
 ['fulfilled','rejected'],
 ['rejected','fulfilled'],
 ['rejected','rejected']
]){
 test('GitHub API status displays fresh result: commits '+commits+', Actions '+actions,()=>{
  const result=render(commits,actions);
  assert.match(result,/^Dashboard evidence check attempted: /);
  assert.ok(result.includes('commits '+(commits==='fulfilled'?'OK':'UNAVAILABLE')));
  assert.ok(result.includes('Actions '+(actions==='fulfilled'?'OK':'UNAVAILABLE')));
  assert.notEqual(result,'PREVIOUS SUCCESS');
 });
}
test('dashboard retains owner evidence, scheduler and original source navigation',()=>{
 assert.match(html,/id="accountabilityStatus"/);
 assert.match(html,/id="proofChecked"/);
 assert.match(html,/href="https:\/\/github.com\/london4216-hue\/Zoodo\/issues\/18"/);
 assert.match(html,/owner='london4216-hue'/);
});
