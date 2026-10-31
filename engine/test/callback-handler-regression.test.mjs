import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';

const secret='zoo-test-callback-secret-long-enough-2026';
function fixture() {
  const called=[];
  const relay=Object.fromEntries(['next','completed','notStarted','replay','reconcile'].map(k=>[
    k, async (...args)=>{called.push({method:k,args});return {state:'idle'};}
  ]));
  const handler=makeHandler({relay,callbackSecret:secret});
  const request=(body,auth='Bearer '+secret)=>handler({method:'POST',headers:{authorization:auth},body});
  return {called,request};
}

test('authenticated invalid JSON shapes return 400 without touching queue',async()=>{
  const {called,request}=fixture();
  for(const body of ['null','[]','true','0','"kick"','{}','{"type":0}','{"type":""}','{"type":"   "}']){
    const result=await request(body);
    assert.equal(result.statusCode,400,'expected 400 for '+body);
    assert.equal(JSON.parse(result.body).error,'invalid callback envelope');
  }
  assert.equal(called.length,0);
});

test('invalid JSON and oversized envelopes are rejected before dispatch',async()=>{
  const {called,request}=fixture();
  assert.equal((await request('{')).statusCode,400);
  assert.equal((await request('x'.repeat(8193))).statusCode,413);
  assert.equal(called.length,0);
});

test('authentication precedes envelope validation',async()=>{
  const {called,request}=fixture();
  assert.equal((await request('null','Bearer wrong')).statusCode,401);
  assert.equal(called.length,0);
});

test('valid kick envelope reaches bounded dispatcher',async()=>{
  const {called,request}=fixture();
  const result=await request(JSON.stringify({type:'kick',worker:'worker-a'}));
  assert.equal(result.statusCode,200);
  assert.equal(called.length,1);
  assert.equal(called[0].method,'next');
});
