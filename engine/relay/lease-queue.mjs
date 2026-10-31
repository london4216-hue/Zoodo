// Durable on a persistent SQLite volume only; not safe on ephemeral serverless disks.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export class LeaseQueue {
  constructor(path, clock = () => Date.now()) {
    this.clock = clock;
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, source TEXT NOT NULL, priority INTEGER NOT NULL, deps TEXT NOT NULL, status TEXT NOT NULL, owner TEXT, token TEXT, deadline INTEGER, attempts INTEGER NOT NULL, max_attempts INTEGER NOT NULL, sha TEXT, test TEXT, updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS receipts (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, event TEXT NOT NULL, owner TEXT, at INTEGER NOT NULL, detail TEXT NOT NULL)');
  }
  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  log(id, event, owner, detail = {}) {
    this.db.prepare('INSERT INTO receipts(id,event,owner,at,detail) VALUES(?,?,?,?,?)').run(id,event,owner,this.clock(),JSON.stringify(detail));
  }
  add({id,source,priority=0,deps=[],max_attempts=3}) {
    if (!id || !source || !Array.isArray(deps) || max_attempts < 1) throw Error('Invalid ticket');
    return this.tx(() => {
      const result=this.db.prepare('INSERT OR IGNORE INTO jobs(id,source,priority,deps,status,attempts,max_attempts,updated) VALUES(?,?,?,?,?,?,?,?)').run(id,source,priority,JSON.stringify(deps),'READY',0,max_attempts,this.clock());
      if(result.changes) this.log(id,'ADDED',null,{source});
      return result.changes===1;
    });
  }
  claim(owner,ttl=60000) {
    if (!owner || ttl<1000) throw Error('Invalid lease');
    return this.tx(() => {
      const now=this.clock();
      for(const job of this.db.prepare("SELECT id,owner FROM jobs WHERE status='CLAIMED' AND deadline<=?").all(now)) {
        this.db.prepare("UPDATE jobs SET status='READY',owner=NULL,token=NULL,deadline=NULL,updated=? WHERE id=?").run(now,job.id);
        this.log(job.id,'EXPIRED',job.owner);
      }
      for(const job of this.db.prepare("SELECT * FROM jobs WHERE status='READY' ORDER BY priority DESC,updated,id").all()) {
        if(!JSON.parse(job.deps).every(id=>this.db.prepare('SELECT status FROM jobs WHERE id=?').get(id)?.status==='DONE')) continue;
        if(job.attempts>=job.max_attempts) {
          this.db.prepare("UPDATE jobs SET status='BLOCKED',updated=? WHERE id=?").run(now,job.id);
          this.log(job.id,'BLOCKED',null,{reason:'retry budget'});
          continue;
        }
        const token=randomUUID();
        this.db.prepare("UPDATE jobs SET status='CLAIMED',owner=?,token=?,deadline=?,attempts=attempts+1,updated=? WHERE id=?").run(owner,token,now+ttl,now,job.id);
        this.log(job.id,'CLAIMED',owner,{attempt:job.attempts+1});
        return {id:job.id,owner,token,deadline:now+ttl};
      }
      return null;
    });
  }
  settle(id,token,{sha,test,reason}={}) {
    return this.tx(() => {
      const job=this.db.prepare("SELECT * FROM jobs WHERE id=? AND token=? AND status='CLAIMED' AND deadline>?").get(id,token,this.clock());
      if(!job) return false;
      if(!reason && (!sha || !test)) throw Error('Commit SHA and test receipt required');
      const status=reason?(job.attempts>=job.max_attempts?'BLOCKED':'READY'):'DONE';
      this.db.prepare('UPDATE jobs SET status=?,owner=NULL,token=NULL,deadline=NULL,sha=?,test=?,updated=? WHERE id=?').run(status,sha??null,test??null,this.clock(),id);
      this.log(id,status,job.owner,reason?{reason}:{sha,test});
      return true;
    });
  }
  jobs(){return this.db.prepare('SELECT * FROM jobs ORDER BY id').all();}
  receipts(){return this.db.prepare('SELECT * FROM receipts ORDER BY seq').all();}
  close(){this.db.close();}
}
