import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutboxStore, drainOutboxOnce} from '../ops/relay/outbox-store.mjs';
const origin = 'https://zoo-private.example/';
const key = 'private-server-only-test-key-123456';
const lease = {id: 17, ticket_id: 'ZOO:77', lease_token: '12345678-1234-4234-8234-123456789012'};
function fake(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const name = new URL(url).pathname.split('/').at(-1);
    calls.push({name, body: JSON.parse(options.body), options});
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.apikey, key);
    assert.equal(options.headers.authorization, 'Bearer ' + key);
    const item = responses[name];
    if (item instanceof Error) throw item;
    if (item?.status) return new Response('unavailable', {status: item.status});
    return new Response(JSON.stringify(item), {status: 200});
  };
  return {fetchImpl, calls};
}
test('outbox claim reads exact leased ticket via authenticated server-side RPC', async () => {
  const f = fake({zoo_ops_outbox_claim: [lease]});
  const store = makeOutboxStore({origin, serviceRoleKey: key, fetchImpl: f.fetchImpl});
  assert.deepEqual(await store.claimOutbox(), lease);
  assert.deepEqual(f.calls[0].body, {});
  assert.equal(f.calls[0].name, 'zoo_ops_outbox_claim');
});
test('empty claim remains idle, and malformed or multiple claims fail closed', async () => {
  for (const [reply, pattern] of [[[], null], [[{...lease, lease_token:'invalid'}], /Malformed outbox lease/], [[lease, lease], /Malformed outbox claim/], [{id:17}, /Malformed outbox claim/]]) {
    const f = fake({zoo_ops_outbox_claim: reply});
    const store = makeOutboxStore({origin, serviceRoleKey:key, fetchImpl:f.fetchImpl});
    if (pattern) await assert.rejects(store.claimOutbox(), pattern);
    else assert.equal(await store.claimOutbox(), null);
  }
});
test('ACK and idle settlement use lease fencing; false is not success', async () => {
  const f = fake({zoo_ops_outbox_ack:false, zoo_ops_outbox_settle_idle:true});
  const store = makeOutboxStore({origin, serviceRoleKey:key, fetchImpl:f.fetchImpl});
  assert.equal(await store.ackOutbox(lease.id, lease.lease_token), false);
  assert.equal(await store.settleIdleOutbox(lease.id, lease.lease_token), true);
  assert.deepEqual(f.calls.map(x=>x.body), [
    {p_id:lease.id, p_token:lease.lease_token}, {p_id:lease.id, p_token:lease.lease_token}
  ]);
  await assert.rejects(store.ackOutbox(0, lease.lease_token), /Valid outbox lease/);
  assert.equal(f.calls.length, 2);
});
test('recovery returns exact integer, rejects malformed response and HTTP failures', async () => {
  const f = fake({zoo_ops_outbox_recover:2});
  assert.equal(await makeOutboxStore({origin,serviceRoleKey:key,fetchImpl:f.fetchImpl}).recoverOutbox(),2);
  for (const reply of ['2', -1, null]) {
    const x=fake({zoo_ops_outbox_recover:reply});
    await assert.rejects(makeOutboxStore({origin,serviceRoleKey:key,fetchImpl:x.fetchImpl}).recoverOutbox(),/Malformed/);
  }
  const y=fake({zoo_ops_outbox_recover:{status:503}});
  await assert.rejects(makeOutboxStore({origin,serviceRoleKey:key,fetchImpl:y.fetchImpl}).recoverOutbox(),/HTTP 503/);
});
test('rejects non-HTTPS origins and short credentials before any network call', () => {
  assert.throws(()=>makeOutboxStore({origin:'http://zoo-private.example/',serviceRoleKey:key}),/HTTPS/);
  assert.throws(()=>makeOutboxStore({origin:'https://user:pass@zoo-private.example/',serviceRoleKey:key}),/HTTPS/);
  assert.throws(()=>makeOutboxStore({origin,serviceRoleKey:'short'}),/service role/);
});
test('bounded outbox drain ACKs only after a concrete dispatch receipt', async () => {
  const f=fake({zoo_ops_outbox_claim:[lease],zoo_ops_outbox_ack:true});
  const relay={next:async(worker)=>({state:'dispatched',ticket:lease.ticket_id,worker,receipt_url:'https://worker.example/receipt/17'})};
  const r=await drainOutboxOnce({origin,serviceRoleKey:key,fetchImpl:f.fetchImpl,relay,workerIds:['workerA']});
  assert.equal(r.state,'acknowledged');
  assert.deepEqual(f.calls.map(x=>x.name),['zoo_ops_outbox_claim','zoo_ops_outbox_ack']);
});
test('unconfirmed dispatch never ACKs the durable wake-up', async () => {
  const f=fake({zoo_ops_outbox_claim:[lease],zoo_ops_outbox_ack:true});
  const relay={next:async()=>({state:'uncertain',ticket:lease.ticket_id})};
  const r=await drainOutboxOnce({origin,serviceRoleKey:key,fetchImpl:f.fetchImpl,relay,workerIds:['workerA']});
  assert.equal(r.state,'recovery_required');
  assert.deepEqual(f.calls.map(x=>x.name),['zoo_ops_outbox_claim']);
});
