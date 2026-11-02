// ZOO single-writer durable pilot queue. Journal is local, append-only JSONL.
// A production multi-runner deployment MUST add transactional storage / distributed locking.
import {existsSync,readFileSync} from 'node:fs';
import {appendJournalEvent} from './atomic-journal.mjs';
import {randomUUID} from 'node:crypto';

const valid = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 256;
// Match the durable SQL ticket directory key contract; do not alter worker identity rules.
const validTicketId = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(s);
// Worker, provider and reviewer IDs must have one canonical spelling.
// Reject invisible controls, Unicode normalization aliases and padded identities.
const validIdentity = s => valid(s) && s === s.trim() && s.normalize('NFC') === s && !/[\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}]/u.test(s);
const fail = message => {throw new Error(message)};
const snapshot = x => structuredClone(x);
export class DurableQueue {
  constructor(file,{now=()=>Date.now(),leaseMs=60000,maxAttempts=3}={}) {
    if(!valid(file))fail('Journal path required');
    if(!Number.isSafeInteger(leaseMs)||leaseMs<1)fail('Invalid lease');
    if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1)fail('Invalid retry budget');
    this.file=file;this.now=now;this.leaseMs=leaseMs;this.maxAttempts=maxAttempts;
    this.items=new Map();this.events=[];
    if(existsSync(file)){
      const raw=readFileSync(file,'utf8');
      if(raw && !raw.endsWith('\n'))fail('Incomplete journal record; recovery required');
      const lines=raw?raw.slice(0,-1).split('\n'):[];
      if(lines.some(line=>!line))fail('Empty journal record; recovery required');
      for(const line of lines){const event=JSON.parse(line);this.#apply(event);this.events.push(event)}
    }
  }
  #apply(e){
    if(e.type==='create'){
      // Replayed tickets must satisfy the same SQL key and bounded-field contract as new tickets.
      if(!validTicketId(e.id)||!valid(e.repo)||!valid(e.description))fail('Invalid journal ticket create');
      // Persisted journal data must not silently weaken or change release authorization.
      if(e.releaseRequired!==undefined && typeof e.releaseRequired!=='boolean')fail('Invalid journal release requirement');
      if(this.items.has(e.id))fail('Duplicate journal ticket');
      this.items.set(e.id,{id:e.id,repo:e.repo,description:e.description,status:'queued',attempts:0,worker:null,provider:null,leaseUntil:null,commit:null,reviewer:null,reviewProvider:null,tests:null,releaseRequired:e.releaseRequired,releaseProof:null,history:[e]});
      return;
    }
    // Fail closed on unknown persisted event kinds: accepting a typo or injected
    // journal operation as inert history can hide corrupt execution evidence.
    if(!new Set(['claim','start','heartbeat','submit','approve','tested','release','verify','done','requeue','quarantine']).has(e.type))
      fail('Unknown journal event type');
    const t=this.items.get(e.id);if(!t)fail('Unknown journal ticket');
    if(e.type==='claim'){t.status='assigned';t.attempts++;t.worker=e.worker;t.provider=e.provider;t.leaseUntil=e.leaseUntil;t.commit=null;t.reviewer=null;t.reviewProvider=null;t.tests=null;t.releaseProof=null}
    if(e.type==='start')t.status='running';
    if(e.type==='heartbeat')t.leaseUntil=e.leaseUntil;
    if(e.type==='submit'){t.status='review';t.commit=e.commit;t.leaseUntil=null}
    if(e.type==='approve'){t.status='test';t.reviewer=e.reviewer;t.reviewProvider=e.reviewProvider}
    if(e.type==='tested'){t.tests={passed:e.passed,evidence:e.evidence};if(!e.passed){
      // A failed final attempt is terminal, not an unclaimable READY ticket.
      // Clear stale invocation/review fields; history retains failure evidence.
      t.status=e.dead===true||(e.dead===undefined&&t.attempts>=this.maxAttempts)?'blocked':'queued';
      t.worker=null;t.provider=null;t.leaseUntil=null;t.commit=null;
      t.reviewer=null;t.reviewProvider=null;t.releaseProof=null;
    }}
    if(e.type==='release')t.releaseProof=e.evidence;
    if(e.type==='verify')t.status='verified';
    if(e.type==='done')t.status='done';
    if(e.type==='requeue'){t.status=e.dead?'blocked':'queued';t.worker=null;t.provider=null;t.leaseUntil=null;t.reviewer=null;t.reviewProvider=null;t.tests=null;t.commit=null;t.releaseProof=null}
    // Preserve the invocation identity when a replayed lease is malformed.
    // This ticket must not be dispatched again without explicit resolution.
    if(e.type==='quarantine'){t.status='blocked';t.leaseUntil=null}
    t.history.push(e);
  }
  #record(type,id,fields={},atMs=this.now()){
    // All journal transitions require a numeric clock; Date() coerces strings such as '0'.
    // Reject before append so replay timestamps cannot silently change meaning.
    if(!Number.isSafeInteger(atMs))fail('Invalid journal clock');
    const e={eventId:randomUUID(),type,id,at:new Date(atMs).toISOString(),...fields};
    // Compare against the durable tail while holding an exclusive local filesystem lock.
    // A stale queue instance must not append a competing claim or heartbeat.
    appendJournalEvent(this.file,e,this.events.length,this.events.at(-1)?.eventId??null);
    this.#apply(e);this.events.push(e);return snapshot(this.items.get(id));
  }
  get(id){const t=this.items.get(id);return t?snapshot(t):null}
  list(){return [...this.items.values()].map(snapshot)}
  create({id,repo,description,releaseRequired=false}){
    if(!validTicketId(id)||!valid(repo)||!valid(description))fail('Ticket needs id, repo and bounded description');
    // Fail closed: truthy strings and null must not silently change release policy.
    if(typeof releaseRequired!=='boolean')fail('Release requirement must be boolean');
    const t=this.get(id);
    if(t){if(t.repo!==repo||t.description!==description||t.releaseRequired!==releaseRequired)fail('Idempotency collision');return t}
    return this.#record('create',id,{repo,description,releaseRequired:Boolean(releaseRequired)});
  }
  claim(id,{worker,provider}){
    const t=this.get(id);if(!t||t.status!=='queued')fail('Ticket not queued');
    if(!validIdentity(worker)||!validIdentity(provider))fail('Real worker identity and provider required');
    if(t.attempts>=this.maxAttempts)fail('Retry budget exhausted');
    // A recovered or rejected ticket must use a new invocation identity.
    // Otherwise a delayed callback from the prior attempt could impersonate NEXT.
    if(t.history.some(e=>e.type==='claim' && e.worker===worker))
      fail('Fresh worker invocation required for retry');
    // This journal is single-writer: preserve worker identity across active leases.
    // Expiry alone is not recovery; recover() must release the old claim first.
    if([...this.items.values()].some(other => other.id!==id && other.worker===worker &&
      ['assigned','running','blocked'].includes(other.status)))fail('Worker already has active ticket');
    // Validate the clock and bounded deadline before journaling a lease.
    // A string/NaN clock or safe-integer overflow must never persist an invalid claim.
    const now=this.now(),leaseUntil=now+this.leaseMs;
    if(!Number.isSafeInteger(now)||!Number.isSafeInteger(leaseUntil))fail('Invalid lease deadline');
    return this.#record('claim',id,{worker,provider,leaseUntil},now);
  }
  #active(id,worker,now=this.now()){const t=this.get(id);if(!Number.isSafeInteger(now)||!t||t.worker!==worker||!['assigned','running'].includes(t.status)||!Number.isSafeInteger(t.leaseUntil)||t.leaseUntil<=now)fail('No active lease');return t}
  start(id,worker){const now=this.now(),t=this.#active(id,worker,now);if(t.status!=='assigned')fail('Not assigned');return this.#record('start',id,{},now)}
  heartbeat(id,worker){
    // One validated time sample controls both lease eligibility and renewal.
    const now=this.now(),t=this.#active(id,worker,now);
    const leaseUntil=Math.max(t.leaseUntil,now+this.leaseMs);
    if(!Number.isSafeInteger(leaseUntil))fail('Invalid lease deadline');
    return this.#record('heartbeat',id,{leaseUntil},now);
  }
  submit(id,worker,{commit,evidence}){const now=this.now(),t=this.#active(id,worker,now);if(t.status!=='running')fail('Not running');if(typeof commit!=='string'||!/^[a-f0-9]{40}$/.test(commit)||!valid(evidence))fail('Exact commit SHA and evidence required');return this.#record('submit',id,{commit,evidence},now)}
  approve(id,{reviewer,provider,commit,evidence,approved}){
    const t=this.get(id);if(!t||t.status!=='review')fail('Not awaiting review');
    if(!validIdentity(reviewer)||!validIdentity(provider)||!valid(evidence)||provider===t.provider||reviewer===t.worker||commit!==t.commit)fail('Independent exact-commit review required');
    // A prior builder or provider on this ticket cannot review replacement work.
    // Preserve independence across retries and durable journal replay.
    if(t.history.some(e=>e.type==='claim' && (e.worker===reviewer || e.provider===provider)))
      fail('Independent exact-commit review required');
    if(typeof approved!=='boolean')fail('Boolean review verdict required');
    if(approved!==true)return this.#record('requeue',id,{reason:'Independent reviewer rejected',reviewer,reviewProvider:provider,evidence,dead:t.attempts>=this.maxAttempts});
    return this.#record('approve',id,{reviewer,reviewProvider:provider,commit,evidence});
  }
  tested(id,{passed,evidence}){const t=this.get(id);if(!t||t.status!=='test')fail('Not awaiting tests');if(typeof passed!=='boolean'||!valid(evidence))fail('Test verdict and evidence required');return this.#record('tested',id,{passed,evidence,dead:!passed&&t.attempts>=this.maxAttempts})}
  release(id,{authorized,evidence}){const t=this.get(id);if(!t||t.status!=='test'||!t.tests?.passed||!t.releaseRequired)fail('Release not eligible');if(authorized!==true||!valid(evidence))fail('Explicit release authorization and proof required');return this.#record('release',id,{evidence})}
  verify(id,{evidence}){const t=this.get(id);if(!t||t.status!=='test'||!t.tests?.passed||!valid(evidence)||t.releaseRequired&&!t.releaseProof)fail('Tests and authorized release evidence required');return this.#record('verify',id,{evidence})}
  done(id){const t=this.get(id);if(!t||t.status!=='verified')fail('Not verified');return this.#record('done',id)}
  fail(id,{worker,reason}){const t=this.get(id);if(!t||!['assigned','running'].includes(t.status)||t.worker!==worker||!valid(reason))fail('Active worker failure evidence required');const now=this.now();this.#active(id,worker,now);return this.#record('requeue',id,{reason,worker,provider:t.provider,dead:t.attempts>=this.maxAttempts},now)}
  recover(){
    // One validated clock snapshot governs the entire recovery pass.
    // An invalid or advancing clock must not prematurely reassign a live lease.
    const now=this.now();
    if(!Number.isSafeInteger(now))fail('Invalid recovery clock');
    const recovered=[];
    for(const t of this.items.values()){
      if(!['assigned','running'].includes(t.status))continue;
      if(!Number.isSafeInteger(t.leaseUntil)){
        // An unknown deadline is not proof of worker expiry. Quarantine only
        // this ticket, preserving its worker identity and unrelated progress.
        recovered.push(this.#record('quarantine',t.id,{reason:'Malformed lease deadline; execution uncertain',worker:t.worker,provider:t.provider},now));
      }else if(t.leaseUntil<=now){
        recovered.push(this.#record('requeue',t.id,{reason:'Lease expired',worker:t.worker,provider:t.provider,dead:t.attempts>=this.maxAttempts},now));
      }
    }
    return recovered;
  }
}
