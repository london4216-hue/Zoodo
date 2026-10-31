import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmDispatchReceipt} from '../ops/relay/dispatch-receipt-fence.mjs';
const TICKET='T2', WORKER='backup', LEASE='11111111-1111-4111-8111-111111111111', RECEIPT='https://example.org/receipts/T2';
const input={ticket:TICKET,worker:WORKER,leaseToken:LEASE,receiptUrl:RECEIPT};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('receipt persisted before deadline returns dispatched',async()=>{
 let recorded;
 const result=await confirmDispatchReceipt({...input,record:async data=>(recorded=data,true)});
 assert.deepEqual(recorded,{ticket_id:TICKET,worker:WORKER,lease_token:LEASE,receipt_url:RECEIPT});
 assert.deepEqual(result,{state:'dispatched',ticket:TICKET,worker:WORKER,receipt_url:RECEIPT});
});
test('external deadline during durable record never returns a false dispatched state',async()=>{
 const gate=deferred(),ctrl=new AbortController();let calls=0;
 const pending=confirmDispatchReceipt({...input,signal:ctrl.signal,record:async()=>{calls++;return gate.promise}});
 ctrl.abort();gate.resolve(true);
 const result=await pending;
 assert.equal(calls,1);assert.equal(result.state,'next-unconfirmed');assert.equal(result.ticket,TICKET);
 assert.ok(!JSON.stringify(result).includes(RECEIPT));
});
test('failed durable receipt never becomes dispatch success',async()=>{
 await assert.rejects(()=>confirmDispatchReceipt({...input,record:async()=>false}),/durably recorded/);
});
test('store exception is not a successful dispatch',async()=>{
 await assert.rejects(()=>confirmDispatchReceipt({...input,record:async()=>{throw Error('database unavailable')}}),/database unavailable/);
});
