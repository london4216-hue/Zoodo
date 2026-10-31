import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';

const SECRET='callback-secret-is-long-enough-123';
const call=(handler,type)=>handler({
  method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify({type})
});

test('late completion confirmation produces retryable 503, not a false HTTP success',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{
    completed:async()=>({state:'completion-unconfirmed',ticket:'T1'})
  }});
  const result=await call(handler,'completed');
  assert.equal(result.statusCode,503);
  assert.equal(JSON.parse(result.body).state,'completion-unconfirmed');
});

test('late non-execution requeue produces retryable 503',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{
    notStarted:async()=>({state:'requeue-unconfirmed',ticket:'T1'})
  }});
  const result=await call(handler,'not_started');
  assert.equal(result.statusCode,503);
});

test('durably confirmed completion retains HTTP 200',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{
    completed:async()=>({state:'completed',ticket:'T1',next:{state:'idle'}})
  }});
  const result=await call(handler,'completed');
  assert.equal(result.statusCode,200);
});
