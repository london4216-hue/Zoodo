import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutboxReplay} from '../ops/relay/outbox-replay.mjs';
const token = '00000000-0000-4000-8000-000000000001';
const event = {id: 42, ticket_id: 'T2', lease_token: token};
const store = (claim, ack = async () => true) => ({claimOutbox: claim, ackOutbox: ack});

test('empty outbox does not invoke worker', async () => {
  let called = 0;
  const replay = makeOutboxReplay({store: store(async () => null), worker: 'worker-1', dispatch: async () => {called++;}});
  assert.deepEqual(await replay(), {state: 'empty'});
  assert.equal(called, 0);
});

test('durable wake-up atomically claimed then acknowledged only after dispatch', async () => {
  const order = [];
  const replay = makeOutboxReplay({
    store: store(async () => {order.push('claim'); return event;}, async (id, lease) => {order.push('ack'); assert.equal(id, 42); assert.equal(lease, token); return true;}),
    worker: 'worker-1', dispatch: async (w) => {order.push('dispatch'); assert.equal(w, 'worker-1'); return {state: 'dispatched', ticket: 'T2'};}
  });
  assert.equal((await replay()).state, 'acked');
  assert.deepEqual(order, ['claim', 'dispatch', 'ack']);
});

test('uncertain worker does not acknowledge durable wake-up', async () => {
  let acks = 0;
  const replay = makeOutboxReplay({store: store(async () => event, async () => {acks++; return true;}), worker: 'worker-1', dispatch: async () => ({state: 'uncertain', ticket: 'T1'})});
  assert.equal((await replay()).state, 'retry-after-lease');
  assert.equal(acks, 0);
});

test('replacement dispatch is valid, but failed ack remains unconfirmed', async () => {
  const replay = makeOutboxReplay({store: store(async () => event, async () => false), worker: 'worker-1', dispatch: async () => ({state: 'uncertain', replacement: {state: 'dispatched', ticket: 'T2'}})});
  assert.equal((await replay()).state, 'ack-unconfirmed');
});

test('worker error leaves event for recovery, no ack', async () => {
  let acks = 0;
  const replay = makeOutboxReplay({store: store(async () => event, async () => {acks++; return true;}), worker: 'worker-1', dispatch: async () => {throw Error('timeout');}});
  assert.equal((await replay()).state, 'retry-after-lease');
  assert.equal(acks, 0);
});

test('invalid lease fails closed before worker invocation', async () => {
  let calls = 0;
  const replay = makeOutboxReplay({store: store(async () => ({...event, lease_token: 'forged'})), worker: 'worker-1', dispatch: async () => {calls++;}});
  await assert.rejects(replay(), /Invalid durable outbox lease/);
  assert.equal(calls, 0);
});

test('two durable wake-ups dispatch two distinct tickets over real localhost HTTP', async () => {
  const {createServer} = await import('node:http');
  const {once} = await import('node:events');
  const seen = [], acked = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const task = JSON.parse(body); seen.push(task.ticket_id);
    res.writeHead(202, {'content-type': 'application/json'});
    res.end(JSON.stringify({accepted: true, ticket_id: task.ticket_id}));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const pending = [{id: 41, ticket_id: 'T1', lease_token: token}, {id: 42, ticket_id: 'T2', lease_token: token}];
    const replay = makeOutboxReplay({
      store: {claimOutbox: async () => pending.shift() ?? null, ackOutbox: async (id) => {acked.push(id); return true;}},
      worker: 'worker-1',
      dispatch: async () => {
        const ticket = seen.length === 0 ? 'T1' : 'T2';
        const res = await fetch(`http://127.0.0.1:${server.address().port}/execute`, {
          method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ticket_id: ticket})
        });
        assert.equal(res.status, 202);
        assert.equal((await res.json()).ticket_id, ticket);
        return {state: 'dispatched', ticket};
      }
    });
    const first = await replay(), second = await replay();
    assert.equal(first.state, 'acked'); assert.equal(second.state, 'acked');
    assert.deepEqual(seen, ['T1', 'T2']); assert.deepEqual(acked, [41, 42]);
  } finally {await new Promise(resolve => server.close(resolve));}
});
