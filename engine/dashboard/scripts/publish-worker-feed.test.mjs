import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const script=new URL('./publish-worker-feed.mjs',import.meta.url).pathname;
const base=Math.floor(Date.now()/1000)-90;
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'zoo-worker-feed-'));
 const receipt=join(dir,'receipt.json'),feed=join(dir,'feed.json');
 const publish=(time=base)=>{
  writeFileSync(receipt,JSON.stringify({route:'local-ollama',status:'TEST_PASSED',finished_at:time,task_id:'real-queue-claim-123'}));
  return spawnSync(process.execPath,[script,'--receipt',receipt,'--out',feed],{encoding:'utf8'});
 };
 const read=()=>JSON.parse(readFileSync(feed,'utf8'));
 return {receipt,feed,publish,read,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
test('publishing Aider preserves existing non-Aider native provider claims',()=>{
 const f=fixture();try{
  const other={worker_id:'copilot',provider:'github',status:'blocked',observed_at:new Date((base+5)*1000).toISOString(),native_run_id:'run-123'};
  writeFileSync(f.feed,JSON.stringify({schema_version:1,source:'zoo-worker-receipts',observed_at:other.observed_at,workers:[other]}));
  assert.equal(f.publish().status,0);
  const result=f.read();assert.equal(result.workers.length,2);assert.deepEqual(result.workers[0],other);
  assert.equal(result.workers[1].worker_id,'aider-local');assert.equal(result.observed_at,other.observed_at);
 }finally{f.cleanup()}
});
test('older or duplicate Aider receipt cannot replace a newer receipt',()=>{
 const f=fixture();try{
  assert.equal(f.publish().status,0);
  const original=readFileSync(f.feed,'utf8');
  const replay=f.publish(base);assert.equal(replay.status,1);assert.match(replay.stderr,/replayed or older/);
  assert.equal(readFileSync(f.feed,'utf8'),original);
  assert.equal(f.publish(base+1).status,0);assert.equal(f.read().workers.length,1);
 }finally{f.cleanup()}
});
test('invalid existing worker roster cannot be silently destroyed',()=>{
 const f=fixture();try{
  writeFileSync(f.feed,JSON.stringify({schema_version:1,source:'zoo-worker-receipts',observed_at:'bad',workers:[{worker_id:'copilot',observed_at:'bad'}]}));
  const original=readFileSync(f.feed,'utf8');
  assert.equal(f.publish().status,1);assert.equal(readFileSync(f.feed,'utf8'),original);
 }finally{f.cleanup()}
});
test('initial empty bootstrap feed accepts first real Aider receipt without inventing native proof',()=>{
 const f=fixture();try{
  writeFileSync(f.feed,JSON.stringify({schema_version:1,source:'zoo-worker-receipts',observed_at:null,workers:[]}));
  assert.equal(f.publish().status,0);const result=f.read();
  assert.equal(result.workers.length,1);assert.equal(result.workers[0].status,'unknown');
  assert.equal(result.workers[0].native_run_id,null);
 }finally{f.cleanup()}
});
