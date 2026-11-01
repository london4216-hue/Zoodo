// ZOO single-writer durable pilot queue. Journal is local, append-only JSONL.
// A production multi-runner deployment MUST add transactional storage / distributed locking.
import {appendFileSync,existsSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

const valid = s => typeof s === 'string' && s.length > 0 && s.length <= 256;
// Worker, provider and reviewer IDs must have one canonical spelling.
// Reject invisible controls, Unicode normalization aliases and padded identities.
const validIdentity = s => valid(s) && s === s.trim() && s.normalize('NFC') === s && !/[\p{Cc}\p{Cf}]/u.test(s);
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
      const lines=readFileSync(file,'utf8').split('\n').filter(Boolean);
      for(const line of lines){const event=JSON.parse(line);this.#apply(event);this.events.push(event)}
    }
  }
  #apply(e){
    if(e.type==='create'){
      if(this.items.has(e.id))fail('Duplicate journal ticket');
      this.items.set(e.id,{id:e.id,repo:e.repo,description:e.description,status:'queued',attempts:0,worker:null,provider:null,leaseUntil:null,commit:null,reviewer:null,reviewProvider:null,tests:null,releaseRequired:e.releaseRequired,releaseProof:null,history:[e]});
      return;
    }
    const t=this.items.get(e.id);if(!t)fail('Unknown journal ticket');
    if(e.type==='claim'){t.status='assigned';t.attempts++;t.worker=e.worker;t.provider=e.provider;t.leaseUntil=e.leaseUntil;t.commit=null;t.reviewer=null;t.reviewProvider=null;t.tests=null;t.releaseProof=null}
    if(e.type==='start')t.status='running';
    if(e.type==='heartbeat')t.leaseUntil=e.leaseUntil;
    if(e.type==='submit'){t.status='review';t.commit=e.commit;t.leaseUntil=null}
    if(e.type==='approve'){t.status='test';t.reviewer=e.reviewer;t.reviewProvider=e.reviewProvider}
    if(e.type==='tested'){t.tests={passed:e.passed,evidence:e.evidence};if(!e.passed)t.status='queued';}
    if(e.type==='release')t.releaseProof=e.evidence;
    if(e.type==='verify')t.status='verified';
    if(e.type==='done')t.status='done';
    if(e.type==='requeue'){t.status=e.dead?'blocked':'queued';t.worker=null;t.provider=null;t.leaseUntil=null;t.reviewer=null;t.reviewProvider=null;t.tests=null}
    t.history.push(e);
  }
  #record(type,id,fields={}){
    const e={eventId:randomUUID(),type,id,at:new Date(this.now()).toISOString(),...fields};
    mkdirSync(dirname(this.file),{recursive:true});
    appendFileSync(this.file,JSON.stringify(e)+'\n',{encoding:'utf8',mode:0o600,flag:'a'});
    this.#apply(e);this.events.push(e);return snapshot(this.items.get(id));
  }
  get(id){const t=this.items.get(id);return t?snapshot(t):null}
  list(){return [...this.items.values()].map(snapshot)}
  create({id,repo,description,releaseRequired=false}){
    if(!valid(id)||!valid(repo)||!valid(description))fail('Ticket needs id, repo and bounded description');
    const t=this.get(id);
    if(t){if(t.repo!==repo||t.description!==description||t.releaseRequired!==releaseRequired)fail('Idempotency collision');return t}
    return this.#record('create',id,{repo,description,releaseRequired:Boolean(releaseRequired)});
  }
  claim(id,{worker,provider}){
    const t=this.get(id);if(!t||t.status!=='queued')fail('Ticket not queued');
    if(!validIdentity(worker)||!validIdentity(provider))fail('Real worker identity and provider required');
    if(t.attempts>=this.maxAttempts)fail('Retry budget exhausted');
    // This journal is single-writer: preserve worker identity across active leases.
    // Expiry alone is not recovery; recover() must release the old claim first.
    if([...this.items.values()].some(other => other.id!==id && other.worker===worker &&
      ['assigned','running','blocked'].includes(other.status)))fail('Worker already has active ticket');
    // Validate the clock and bounded deadline before journaling a lease.
    // A string/NaN clock or safe-integer overflow must never persist an invalid claim.
    const now=this.now(),leaseUntil=now+this.leaseMs;
    if(!Number.isSafeInteger(now)||!Number.isSafeInteger(leaseUntil))fail('Invalid lease deadline');
    return this.#record('claim',id,{worker,provider,leaseUntil});
  }
  #active(id,worker,now=this.now()){const t=this.get(id);if(!Number.isSafeInteger(now)||!t||t.worker!==worker||!['assigned','running'].includes(t.status)||!Number.isSafeInteger(t.leaseUntil)||t.leaseUntil<=now)fail('No active lease');return t}
  start(id,worker){const t=this.#active(id,worker);if(t.status!=='assigned')fail('Not assigned');return this.#record('start',id)}
  heartbeat(id,worker){
    // One validated time sample controls both lease eligibility and renewal.
    const now=this.now(),t=this.#active(id,worker,now);
    const leaseUntil=Math.max(t.leaseUntil,now+this.leaseMs);
    if(!Number.isSafeInteger(leaseUntil))fail('Invalid lease deadline');
    return this.#record('heartbeat',id,{leaseUntil});
  }
  submit(id,worker,{commit,evidence}){const t=this.#active(id,worker);if(t.status!=='running')fail('Not running');if(!/^[a-f0-9]{40}$/.test(commit)||!valid(evidence))fail('Exact commit SHA and evidence required');return this.#record('submit',id,{commit,evidence})}
  approve(id,{reviewer,provider,commit,evidence,approved}){
    const t=this.get(id);if(!t||t.status!=='review')fail('Not awaiting review');
    if(!validIdentity(reviewer)||!validIdentity(provider)||!valid(evidence)||provider===t.provider||reviewer===t.worker||commit!==t.commit)fail('Independent exact-commit review required');
    if(approved!==true)return this.#record('requeue',id,{reason:'Independent reviewer rejected',reviewer,reviewProvider:provider,evidence,dead:t.attempts>=this.maxAttempts});
    return this.#record('approve',id,{reviewer,reviewProvider:provider,commit,evidence});
  }
  tested(id,{passed,evidence}){const t=this.get(id);if(!t||t.status!=='test')fail('Not awaiting tests');if(typeof passed!=='boolean'||!valid(evidence))fail('Test verdict and evidence required');return this.#record('tested',id,{passed,evidence})}
  release(id,{authorized,evidence}){const t=this.get(id);if(!t||t.status!=='test'||!t.tests?.passed||!t.releaseRequired)fail('Release not eligible');if(authorized!==true||!valid(evidence))fail('Explicit release authorization and proof required');return this.#record('release',id,{evidence})}
  verify(id,{evidence}){const t=this.get(id);if(!t||t.status!=='test'||!t.tests?.passed||!valid(evidence)||t.releaseRequired&&!t.releaseProof)fail('Tests and authorized release evidence required');return this.#record('verify',id,{evidence})}
  done(id){const t=this.get(id);if(!t||t.status!=='verified')fail('Not verified');return this.#record('done',id)}
  fail(id,{worker,reason}){const t=this.get(id);if(!t||!['assigned','running'].includes(t.status)||t.worker!==worker||!valid(reason))fail('Active worker failure evidence required');return this.#record('requeue',id,{reason,worker,provider:t.provider,dead:t.attempts>=this.maxAttempts})}
  recover(){const recovered=[];for(const t of this.items.values())if(['assigned','running'].includes(t.status)&&t.leaseUntil<=this.now())recovered.push(this.#record('requeue',t.id,{reason:'Lease expired',worker:t.worker,provider:t.provider,dead:t.attempts>=this.maxAttempts}));return recovered}
}
