import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNetlifyRelayHandler } from '../netlify/functions/zoo-relay.mjs';
const env = {
  ZOO_SUPABASE_URL: 'https://example.invalid',
  ZOO_SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(32),
  ZOO_CALLBACK_SECRET: 'y'.repeat(32),
  ZOO_WORKERS_JSON: JSON.stringify([{id:'worker',url:'https://example.invalid/worker',token:'z'.repeat(32)}]),
};
const event = {httpMethod:'POST',headers:{authorization:'Bearer '+env.ZOO_CALLBACK_SECRET},body:'{"type":"kick","worker":"worker"}'};
const factory = () => {
  const calls = [];
  return {calls, storeFactory:x=>(calls.push('store'),x),relayFactory:x=>(calls.push('relay'),x),handlerFactory:()=>async()=>({statusCode:200,headers:{},body:'{"state":"synthetic"}'})};
};
test('unconfigured relay fails closed',async()=>{
  const f=factory(),r=await makeNetlifyRelayHandler({env:{},...f})(event);
  assert.equal(r.statusCode,503);assert.equal(f.calls.length,0);
});
test('GET and encoded requests are rejected before store access',async()=>{
  const f=factory(),h=makeNetlifyRelayHandler({env,...f});
  assert.equal((await h({...event,httpMethod:'GET'})).statusCode,405);
  assert.equal((await h({...event,isBase64Encoded:true})).statusCode,400);
  assert.equal(f.calls.length,0);
});
test('malformed or empty worker pool cannot dispatch',async()=>{
  for(const value of ['{','[]']){
    const f=factory(),r=await makeNetlifyRelayHandler({env:{...env,ZOO_WORKERS_JSON:value},...f})(event);
    assert.equal(r.statusCode,503);assert.equal(f.calls.length,0);
  }
});
test('configured adapter wires store and relay without caching responses',async()=>{
  const f=factory(),r=await makeNetlifyRelayHandler({env,...f})(event);
  assert.equal(r.statusCode,200);
  assert.deepEqual(f.calls,['store','relay']);
  assert.equal(r.headers['cache-control'],'no-store');
});
test('upstream failure is not a successful dispatch',async()=>{
  const r=await makeNetlifyRelayHandler({env,storeFactory:()=>{throw Error('synthetic failure');}})(event);
  assert.equal(r.statusCode,503);
  assert.equal(JSON.parse(r.body).error,'relay_unavailable');
});
