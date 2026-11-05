// ZOO single-writer durable pilot queue. Journal is local, append-only JSONL.
// A production multi-runner deployment MUST add transactional storage / distributed locking.
import {appendFileSync,existsSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

const valid = s => typeof s === 'string' && s.length > 0 && s.length <= 256;
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
    if(e.type==='requeue'||e.type==='handoff'){t.status=e.dead?'blocked':'queued';t.worker=null;t.provider=null;t.leaseUntil=null;t.reviewer=null;t.reviewProvider=null;t.tests=null}
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
  // Single-writer lease fencing: caller-supplied availability is not authority.
  #emptyHandoffs(worker){
    let count=0;
    for(const t of this.items.values()){
      if(t.id.startsWith('seeker:'))continue;
      let owner=null,submitted=false;
      for(const e of t.history){
        if(e.type==='claim'){owner=e.worker;submitted=false}
        else if(e.type==='submit'&&owner===worker)submitted=true;
        else if(e.type==='handoff'||e.type==='requeue'){
          if(e.worker===worker&&!submitted)count++;
          owner=null;submitted=false;
        }
      }
    }
    return count;
  }
  claim(id,{worker,provider}){
    const t=this.get(id);if(!t||t.status!=='queued')fail('Ticket not queued');
    if(!valid(worker)||!valid(provider))fail('Real worker identity and provider required');
    if([...this.items.values()].some(x=>x.worker===worker&&['assigned','running'].includes(x.status)))
      fail('Worker already holds an active lease');
    const seeker=id.startsWith('seeker:');
    if(seeker){
      // A seeker is owned by the twice-stalled worker, never another worker.
      // One lease/attempt bounds research and prevents recursive seeker work.
      if(id!==`seeker:${worker}`)fail('Replacement-seeker owner mismatch');
      if(this.#emptyHandoffs(worker)<2)fail('Replacement-seeker requires two handoffs');
      if(t.attempts>=1)fail('Replacement-seeker attempt budget exhausted');
    }else if(this.#emptyHandoffs(worker)>=2)
      fail('Worker restricted to bounded replacement-seeker after two handoffs');
    if(t.attempts>=this.maxAttempts)fail('Retry budget exhausted');
    return this.#record('claim',id,{worker,provider,leaseUntil:this.now()+this.leaseMs});
  }
  #active(id,worker){const t=this.get(id);if(!t||t.worker!==worker||!['assigned','running'].includes(t.status)||t.leaseUntil<=this.now())fail('No active lease');return t}
  start(id,worker){const t=this.#active(id,worker);if(t.status!=='assigned')fail('Not assigned');return this.#record('start',id)}
  heartbeat(id,worker){this.#active(id,worker);return this.#record('heartbeat',id,{leaseUntil:this.now()+this.leaseMs})}
  submit(id,worker,{commit,evidence}){const t=this.#active(id,worker);if(t.status!=='running')fail('Not running');if(!/^[a-f0-9]{40}$/.test(commit)||!valid(evidence))fail('Exact commit SHA and evidence required');return this.#record('submit',id,{commit,evidence})}
  approve(id,{reviewer,provider,commit,evidence,approved}){
    const t=this.get(id);if(!t||t.status!=='review')fail('Not awaiting review');
    if(!valid(reviewer)||!valid(provider)||!valid(evidence)||provider===t.provider||reviewer===t.worker||commit!==t.commit)fail('Independent exact-commit review required');
    if(approved!==true)return this.#record('requeue',id,{reason:'Independent reviewer rejected',reviewer,reviewProvider:provider,evidence,dead:t.attempts>=this.maxAttempts});
    return this.#record('approve',id,{reviewer,reviewProvider:provider,commit,evidence});
  }
  tested(id,{passed,evidence}){const t=this.get(id);if(!t||t.status!=='test')fail('Not awaiting tests');if(typeof passed!=='boolean'||!valid(evidence))fail('Test verdict and evidence required');return this.#record('tested',id,{passed,evidence})}
  release(id,{authorized,evidence}){const t=this.get(id);if(!t||t.status!=='test'||!t.tests?.passed||!t.releaseRequired)fail('Release not eligible');if(authorized!==true||!valid(evidence))fail('Explicit release authorization and proof required');return this.#record('release',id,{evidence})}
  verify(id,{evidence}){const t=this.get(id);if(!t||t.status!=='test'||!t.tests?.passed||!valid(evidence)||t.releaseRequired&&!t.releaseProof)fail('Tests and authorized release evidence required');return this.#record('verify',id,{evidence})}
  done(id){const t=this.get(id);if(!t||t.status!=='verified')fail('Not verified');return this.#record('done',id)}
  // A single journal event both ends the lease and records the handoff receipt.
  // Null means unmeasured, NEVER zero cost, zero latency, or verified code.
  #handoffFields(t,reason,receipt,disposition){
    const claim=[...t.history].reverse().find(e=>e.type==='claim'&&e.worker===t.worker);
    const elapsedMs=claim&&Number.isFinite(Date.parse(claim.at))?Math.max(0,this.now()-Date.parse(claim.at)):null;
    return {reason,worker:t.worker,provider:t.provider,attempt:t.attempts,
      startedAt:claim?.at??null,endedAt:new Date(this.now()).toISOString(),elapsedMs,
      costUsd:null,artifactReceipt:null,testReceipt:null,receipt:receipt??null,
      disposition,dead:t.id.startsWith('seeker:')||t.attempts>=this.maxAttempts};
  }
  fail(id,{worker,reason,receipt=null}){const t=this.get(id);
    if(!t||!['assigned','running'].includes(t.status)||t.worker!==worker||t.leaseUntil<=this.now()||!valid(reason)||receipt!==null&&!valid(receipt))
      fail('Active worker failure evidence required');
    return this.#record('handoff',id,this.#handoffFields(t,reason,receipt,'worker-failure'));
  }
  recover(){const recovered=[];
    for(const t of this.items.values())if(['assigned','running'].includes(t.status)&&t.leaseUntil<=this.now())
      recovered.push(this.#record('handoff',t.id,this.#handoffFields(t,'Lease expired',null,'lease-expired')));
    return recovered;
  }
}
