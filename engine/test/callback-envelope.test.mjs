import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeCallbackEnvelope} from '../ops/relay/callback-envelope.mjs';
test('accepts bounded typed callback',()=>assert.deepEqual(decodeCallbackEnvelope('{"type":"kick","worker":"w"}'),{value:{type:'kick',worker:'w'}}));
test('rejects JSON scalars arrays and missing type before dispatch',()=>{
 for(const input of ['null','[]','7','true','{}','{"type":0}','{"type":""}'])
  assert.deepEqual(decodeCallbackEnvelope(input),{statusCode:400,error:'invalid callback envelope'});
});
test('rejects invalid JSON and oversized/non-string input',()=>{
 assert.deepEqual(decodeCallbackEnvelope('{'),{statusCode:400,error:'invalid JSON'});
 assert.deepEqual(decodeCallbackEnvelope(null),{statusCode:413,error:'invalid payload'});
 assert.deepEqual(decodeCallbackEnvelope('x'.repeat(8193)),{statusCode:413,error:'invalid payload'});
});
