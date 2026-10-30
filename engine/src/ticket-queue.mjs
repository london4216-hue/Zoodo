// Pure, non-dispatching Zoo ticket lifecycle. Durable callers must persist each returned record.
// This module never treats a simulated worker, a heartbeat or a URL as verified execution.
const SHA = /^[0-9a-f]{7,40}$/i;
const ACTIVE = new Set(['assigned', 'running', 'independent_review', 'test', 'awaiting_authorization', 'merge_deploy']);
const stamp = (at) => {
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) throw Error('Invalid timestamp');
  return d.toISOString();
};
const requireState = (t, ...states) => {
  if (!states.includes(t.state)) throw Error(`Invalid transition from ${t.state}`);
};
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label} required`);
  return value.trim();
};
const add = (t, kind, at, detail = {}) => {
  const time = stamp(at);
  return { ...t, updatedAt: time, events: [...t.events, {kind, at: time, ...detail}] };
};
export function createTicket({id, company, acceptance, maxAttempts = 3, at = new Date().toISOString()}) {
  requireText(id, 'Ticket ID'); requireText(company, 'Company');
  if (!Array.isArray(acceptance) || !acceptance.length || acceptance.some(x => typeof x !== 'string' || !x.trim())) throw Error('Acceptance criteria required');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw Error('Invalid attempt limit');
  return {id, company, acceptance: [...acceptance], maxAttempts, attempts: 0, state: 'queued', worker: null, builderProvider: null,
    commit: null, reviewer: null, reviewReceipt: null, testReceipt: null, authorizationReceipt: null, verificationReceipt: null,
    attemptedProviders: [], reviewerOutages: [], failures: [], heartbeatAt: null, updatedAt: stamp(at),
    events: [{kind: 'queued', at: stamp(at)}], costUsd: null};
}
export function chooseBuilder(ticket, workers) {
  requireState(ticket, 'queued');
  return workers.find(w => w?.available === true && w?.id && w?.provider &&
    Array.isArray(w.companies) && w.companies.includes(ticket.company) &&
    !ticket.attemptedProviders.includes(w.provider)) ?? null;
}
export function assign(ticket, worker, at = new Date().toISOString()) {
  requireState(ticket, 'queued');
  if (ticket.attempts >= ticket.maxAttempts) throw Error('Attempt limit reached');
  if (!worker || !worker.id || !worker.provider || worker.available !== true || !worker.companies?.includes(ticket.company)) throw Error('Worker not eligible for company');
  if (ticket.attemptedProviders.includes(worker.provider)) throw Error('Provider already failed this ticket');
  const t = add(ticket, 'assigned', at, {workerId: worker.id, provider: worker.provider});
  return {...t, state: 'assigned', attempts: ticket.attempts + 1, worker: {id: worker.id, provider: worker.provider},
    builderProvider: worker.provider, attemptedProviders: [...ticket.attemptedProviders, worker.provider], heartbeatAt: stamp(at)};
}
export function start(ticket, at = new Date().toISOString()) {
  requireState(ticket, 'assigned');
  return {...add(ticket, 'running', at, {workerId: ticket.worker.id}), state: 'running', heartbeatAt: stamp(at)};
}
export function heartbeat(ticket, workerId, at = new Date().toISOString()) {
  if (!ACTIVE.has(ticket.state)) throw Error('No active job');
  if (ticket.worker?.id !== workerId) throw Error('Heartbeat from wrong worker');
  // A heartbeat is liveness only, not a substantive code-change receipt.
  return {...add(ticket, 'heartbeat', at, {workerId}), heartbeatAt: stamp(at)};
}
export function built(ticket, {commit, evidence}, at = new Date().toISOString()) {
  requireState(ticket, 'running');
  if (!SHA.test(commit ?? '')) throw Error('Exact commit SHA required');
  requireText(evidence, 'Build evidence');
  return {...add(ticket, 'built', at, {commit, evidence, workerId: ticket.worker.id}), state: 'independent_review', commit};
}
export function review(ticket, reviewer, {commit, decision, receipt}, at = new Date().toISOString()) {
  requireState(ticket, 'independent_review');
  if (!reviewer?.id || !reviewer.provider || reviewer.provider === ticket.builderProvider) throw Error('Independent provider required');
  if (commit !== ticket.commit) throw Error('Review must bind exact commit');
  requireText(receipt, 'Review receipt');
  if (!['approved', 'rejected', 'unavailable'].includes(decision)) throw Error('Invalid verdict');
  if (decision === 'unavailable') {
    const t = add(ticket, 'reviewer_unavailable', at, {reviewerId: reviewer.id, provider: reviewer.provider, receipt});
    return {...t, reviewerOutages: [...ticket.reviewerOutages, {reviewerId: reviewer.id, provider: reviewer.provider, at: stamp(at), receipt}]};
  }
  const t = add(ticket, 'reviewed', at, {reviewerId: reviewer.id, provider: reviewer.provider, decision, commit, receipt});
  return {...t, state: decision === 'approved' ? 'test' : 'blocked', reviewer: {id: reviewer.id, provider: reviewer.provider}, reviewReceipt: receipt};
}
export function tested(ticket, {passed, receipt}, at = new Date().toISOString()) {
  requireState(ticket, 'test');
  requireText(receipt, 'Test receipt');
  if (typeof passed !== 'boolean') throw Error('Test result required');
  if (!passed) return fail(ticket, {cause: 'Test failure', failingTest: receipt, retryable: true}, at);
  return {...add(ticket, 'tests_passed', at, {commit: ticket.commit, receipt}), state: 'awaiting_authorization', testReceipt: receipt};
}
export function authorize(ticket, {approved, receipt}, at = new Date().toISOString()) {
  requireState(ticket, 'awaiting_authorization');
  requireText(receipt, 'Authorization receipt');
  if (approved !== true) return {...add(ticket, 'authorization_pending', at, {receipt}), authorizationReceipt: null};
  return {...add(ticket, 'authorized', at, {receipt}), state: 'merge_deploy', authorizationReceipt: receipt};
}
export function verified(ticket, {commit, receipt}, at = new Date().toISOString()) {
  requireState(ticket, 'merge_deploy');
  if (commit !== ticket.commit) throw Error('Verification must bind exact commit');
  requireText(receipt, 'Verification receipt');
  return {...add(ticket, 'verified', at, {commit, receipt}), state: 'verified', verificationReceipt: receipt};
}
export function complete(ticket, at = new Date().toISOString()) {
  requireState(ticket, 'verified');
  return {...add(ticket, 'done', at), state: 'done'};
}
export function fail(ticket, {cause, failingTest = null, retryable = true, costUsd = null}, at = new Date().toISOString()) {
  if (ticket.state === 'done' || ticket.state === 'blocked') throw Error('Cannot fail a terminal ticket');
  requireText(cause, 'Failure cause');
  if (costUsd !== null && (!Number.isFinite(costUsd) || costUsd < 0)) throw Error('Invalid cost');
  const failure = {at: stamp(at), state: ticket.state, cause, failingTest, workerId: ticket.worker?.id ?? null, provider: ticket.worker?.provider ?? null, costUsd};
  const blocked = !retryable || ticket.attempts >= ticket.maxAttempts;
  const t = add(ticket, blocked ? 'blocked' : 'requeued', at, failure);
  return {...t, state: blocked ? 'blocked' : 'queued', worker: null, builderProvider: null, commit: null, reviewer: null,
    reviewReceipt: null, testReceipt: null, authorizationReceipt: null, verificationReceipt: null, heartbeatAt: null,
    failures: [...ticket.failures, failure]};
}
export function queueEvidence(tickets, now = new Date().toISOString(), staleMs = 300000) {
  const time = new Date(stamp(now)).getTime();
  if (!Number.isFinite(staleMs) || staleMs < 1) throw Error('Invalid stale threshold');
  return tickets.map(t => ({id: t.id, company: t.company, state: t.state, attempts: t.attempts,
    workerId: t.worker?.id ?? null, provider: t.worker?.provider ?? null, lastHeartbeat: t.heartbeatAt,
    lastVerifiedCommit: t.events.filter(e => e.kind === 'verified').at(-1)?.commit ?? null,
    escalationDue: ACTIVE.has(t.state) && (!t.heartbeatAt || time - new Date(t.heartbeatAt).getTime() >= staleMs),
    failureCount: t.failures.length, costUsd: t.costUsd}));
}
