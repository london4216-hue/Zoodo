// Single-process adapter for the Zoo durable queue. It does not invoke providers.
// A caller must independently verify invocation receipts before setting verified=true.
// Queue events are durable; worker availability is an ephemeral input, never proof of uptime.
const valid = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 256;
const evidence = s => typeof s === 'string' && /^https:\/\/[^\s]+$/.test(s) && s.length <= 200;
const seekerId = worker => `seeker:${worker}`;
const seekerDescription = worker => `Bounded research: verify one compatible replacement for ${worker} with license, security, cost, and invocation evidence`;
const isSeeker = id => id.startsWith('seeker:');

export function handoffCount(queue, worker) {
  if (!valid(worker)) throw Error('Worker required');
  let emptyHandoffs = 0;
  for (const ticket of queue.list().filter(t => !isSeeker(t.id))) {
    let assignedWorker = null, submitted = false;
    for (const event of ticket.history) {
      if (event.type === 'claim') { assignedWorker = event.worker; submitted = false; }
      if (event.type === 'submit' && assignedWorker === worker) submitted = true;
      if (event.type === 'requeue') {
        if (event.worker === worker && !submitted) emptyHandoffs++;
        assignedWorker = null; submitted = false;
      }
    }
  }
  return emptyHandoffs;
}

export function eligibleReplacement(queue, ticket, workers, formerWorker) {
  if (!Array.isArray(workers)) throw Error('Worker inventory required');
  return workers.find(w => w && valid(w.id) && valid(w.provider) && w.id !== formerWorker &&
    w.available === true && w.verified === true && evidence(w.invocationReceipt) &&
    Array.isArray(w.repos) && w.repos.includes(ticket.repo) &&
    handoffCount(queue, w.id) < 2 && !isSeeker(ticket.id)) ?? null;
}

function createSeekerIfDue(queue, worker, repo) {
  const count = handoffCount(queue, worker);
  if (count < 2) return null;
  const id = seekerId(worker);
  queue.create({id, repo, description: seekerDescription(worker)});
  return id; // queued, NOT running or assigned; actual availability must be checked separately
}

function reassign(queue, id, workers, formerWorker) {
  const ticket = queue.get(id);
  const seeker = createSeekerIfDue(queue, formerWorker, ticket.repo);
  if (ticket.status !== 'queued') return {id, status:ticket.status, replacement:null, seeker};
  const candidate = eligibleReplacement(queue, ticket, workers, formerWorker);
  if (!candidate) return {id, status:'queued-no-verified-capacity', replacement:null, seeker};
  const claimed = queue.claim(id,{worker:candidate.id,provider:candidate.provider});
  return {id,status:claimed.status,replacement:candidate.id,seeker};
}

export function handoffAndReassign(queue, id, {worker, reason, receipt}, workers) {
  if (!valid(reason) || !evidence(receipt)) throw Error('Bounded reason and HTTPS evidence required');
  const ticket = queue.get(id);
  if (!ticket || isSeeker(id) || ticket.worker !== worker || !['assigned','running'].includes(ticket.status))
    throw Error('Only active normal-ticket owner can hand off');
  if (handoffCount(queue, worker) >= 2) throw Error('Worker already in seeker mode');
  const failure = `${reason.trim().slice(0,30)} | ${receipt}`;
  if (failure.length > 256) throw Error('Failure evidence too long');
  queue.fail(id,{worker,reason:failure});
  return reassign(queue,id,workers,worker);
}

export function recoverAndReassign(queue, workers) {
  const recovered = queue.recover();
  return recovered.map(t => {
    const last = t.history.at(-1);
    return reassign(queue,t.id,workers,last.worker);
  });
}

// Pure panel intake validation: a prompt or issue comment is not a provider response.
// The caller must set verified=true ONLY after checking a genuine provider invocation.
export function acceptPanelResponse({provider,verified,invocationReceipt,proposals}) {
  if (!valid(provider) || verified !== true || !evidence(invocationReceipt)) throw Error('Verified provider invocation required');
  if (!Array.isArray(proposals) || proposals.length !== 3) throw Error('Exactly three proposals required');
  const ids = new Set();
  for (const p of proposals) {
    if (!p || !valid(p.id) || !valid(p.change) || !valid(p.acceptanceTest) ||
        !valid(p.cost) || !valid(p.security) || ids.has(p.id)) throw Error('Three distinct testable proposals required');
    ids.add(p.id);
  }
  return {provider,invocationReceipt,proposals:structuredClone(proposals),status:'response-receipt-supplied-needs-independent-audit'};
}
