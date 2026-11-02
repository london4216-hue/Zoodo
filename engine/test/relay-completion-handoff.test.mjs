import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRelay, makeStore} from '../ops/relay/portable-relay.mjs';

const SECRET = 'synthetic-worker-secret-not-a-credential';
const SHA = 'a'.repeat(40);
const token = n => `${String(n).padStart(8,'0')}-0000-4000-8000-000000000001`;

// Test-only store. No hosted database, provider, scheduler or Adler runtime is used.
function setup(workerIds = ['adler', 'free-worker']) {
  let sequence = 0;
  const tickets = ['A','B','C'].map(id => ({id,asset:'synthetic',intent:id,state:'queued'}));
  const dispatches = [];
  const completions = [];
  const store = {
    async claim(worker) {
      if (tickets.some(t => t.state === 'leased' && t.lease_owner === worker)) return null;
      const ticket = tickets.find(t => t.state === 'queued');
      if (!ticket) return null;
      Object.assign(ticket,{state:'leased',lease_owner:worker,lease_token:token(++sequence)});
      return {...ticket};
    },
    async record() { return true; },
    async complete(receipt) {
      const ticket = tickets.find(t => t.id === receipt.ticket_id);
      if (!ticket || ticket.state !== 'leased' || ticket.lease_owner !== receipt.worker ||
          ticket.lease_token !== receipt.lease_token) return false;
      ticket.state = 'done';
      completions.push(receipt);
      return true;
    }
  };
  const relay = makeRelay({store,
    workers:workerIds.map(id => ({id,url:`https://synthetic.example/${id}`,token:SECRET})),
    fetchImpl:async (_url, options) => {
      const job = JSON.parse(options.body);
      dispatches.push(job);
      return new Response(JSON.stringify({accepted:true,ticket_id:job.ticket_id,
        idempotency_key:job.idempotency_key,
        receipt_url:`https://synthetic.example/receipts/${job.ticket_id}`}),{status:202});
    }
  });
  const completion = (job, extra = {}) => relay.completed({
    ticket_id:job.ticket_id,worker:job.worker,lease_token:job.lease_token,
    commit_sha:SHA,test_url:'https://synthetic.example/test',...extra
  });
  return {relay,completion,tickets,dispatches,completions};
}

test('completion hands A to a different worker for B and rotates back for C',async () => {
  const f = setup();
  await f.relay.next('adler');
  assert.equal((await f.completion(f.dispatches[0])).next.worker,'free-worker');
  assert.equal((await f.completion(f.dispatches[1])).next.worker,'adler');
  assert.deepEqual(f.dispatches.map(j => [j.ticket_id,j.worker]),
    [['A','adler'],['B','free-worker'],['C','adler']]);
});

test('handoff skips a busy successor and selects the next eligible different worker',async () => {
  const f = setup(['adler','busy','free-worker']);
  await f.relay.next('adler');
  await f.relay.next('busy');
  const result = await f.completion(f.dispatches[0]);
  assert.equal(result.next.worker,'free-worker');
  assert.equal(result.next.ticket,'C');
});

test('one registered worker can continue instead of stalling',async () => {
  const f = setup(['adler']);
  await f.relay.next('adler');
  assert.equal((await f.completion(f.dispatches[0])).next.ticket,'B');
});

test('a committed change continues without a separate test-evidence URL',async () => {
  const f = setup();
  await f.relay.next('adler');
  const result = await f.completion(f.dispatches[0],{test_url:undefined});
  assert.equal(result.state,'completed');
  assert.equal(result.next.worker,'free-worker');
});

test('optional completion URL, when supplied, must still be HTTPS',async () => {
  const f = setup();
  await f.relay.next('adler');
  await assert.rejects(f.completion(f.dispatches[0],{test_url:'http://unsafe.example'}),
    /Invalid completion/);
  assert.equal(f.completions.length,0);
});

test('a refused completion cannot activate a successor',async () => {
  const f = setup();
  await f.relay.next('adler');
  await assert.rejects(f.completion(f.dispatches[0],{lease_token:token(999)}),
    /Completion not durably confirmed/);
  assert.equal(f.dispatches.length,1);
});

test('RPC completion includes explicit null when optional test URL is absent',async () => {
  let payload;
  const store = makeStore({origin:'https://synthetic.example',serviceRoleKey:SECRET,
    fetchImpl:async (_url, options) => {
      payload = JSON.parse(options.body);
      return new Response('true');
    }});
  await store.complete({ticket_id:'A',worker:'adler',lease_token:token(1),commit_sha:SHA});
  assert.equal(payload.p_test_url,null);
});
