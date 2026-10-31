import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';

const SECRET = 'zoo-synthetic-callback-secret-1234567890';
const invoke = (relay,type) => makeHandler({relay,callbackSecret:SECRET})({
  method:'POST',
  headers:{authorization:'Bearer '+SECRET},
  body:JSON.stringify({type})
});

test('callback with missing durable completion receipt cannot return HTTP 200', async () => {
  for (const result of [null,undefined,{}, {state:'uncertain'}]) {
    assert.equal((await invoke({completed:async()=>result},'completed')).statusCode,503);
    assert.equal((await invoke({notStarted:async()=>result},'not_started')).statusCode,503);
  }
});

test('committed completion and requeue stay HTTP 200 even when NEXT is unconfirmed', async () => {
  const completed={state:'completed',next:{state:'next-unconfirmed'}};
  const requeued={state:'requeued',next:{state:'recovery_required'}};
  assert.equal((await invoke({completed:async()=>completed},'completed')).statusCode,200);
  assert.equal((await invoke({notStarted:async()=>requeued},'not_started')).statusCode,200);
});

test('unauthenticated callback cannot reach worker', async () => {
  let called=false;
  const handler=makeHandler({callbackSecret:SECRET,relay:{completed:async()=>{called=true;return {state:'completed'};}}});
  const result=await handler({method:'POST',headers:{},body:'{"type":"completed"}'});
  assert.equal(result.statusCode,401);
  assert.equal(called,false);
});
