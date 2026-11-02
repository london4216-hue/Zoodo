import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

function fixture(workerIds) {
  const controller = new AbortController();
  const seen=[];
  const store={claimOutbox:async()=>null,ackOutbox:async()=>true,recoverOutbox:async()=>0};
  const relay={next:async()=>({state:'dispatched'})};
  const drainOne=async ({workerIds: roster})=>{
    seen.push([...roster]);
    if(seen.length===1) workerIds.splice(0,workerIds.length,'rogue');
    if(seen.length===2) controller.abort();
    return {state:'empty'};
  };
  return {store,relay,drainOne,workerIds,signal:controller.signal,sleep:async()=>{},seen};
}

test('supervisor snapshots worker roster across external mutations',async()=>{
  const f=fixture(['adler','aider']);
  await runSupervisorContingent(f);
  assert.deepEqual(f.seen,[['adler','aider'],['adler','aider']]);
});

test('supervisor rejects sparse, duplicate and nonstring worker rosters',async()=>{
  for(const ids of [Array(1),['adler','adler'],['adler',null],['adler',''],['adler',' rogue'],Array.from({length:65},(_,i)=>`w${i}`)]){
    const f=fixture(ids);
    await assert.rejects(runSupervisorContingent(f),/Qualified shared store/);
    assert.deepEqual(f.seen,[]);
  }
});
