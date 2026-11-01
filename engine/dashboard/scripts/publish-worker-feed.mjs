#!/usr/bin/env node
// Off-GitHub/local runner adapter: export only allowlisted Aider receipt fields.
// Publishing to the live dashboard still requires the existing authorized deploy pipeline.
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {normalizeAiderReceipt} from '../worker-feed.mjs';

const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:null};
const input=value('--receipt'),output=value('--out');
if(!input||!output||args.length!==4){console.error('Usage: node scripts/publish-worker-feed.mjs --receipt /path/to/local-receipt.json --out /path/to/dashboard/worker-feed.json');process.exit(2)}
try{
  const record=normalizeAiderReceipt(JSON.parse(readFileSync(resolve(input),'utf8')));
  if(Date.parse(record.observed_at)>Date.now()+60000)throw Error('Future-dated receipt refused');
  const destination=resolve(output);
  let workers=[];
  let previousObserved=0;
  if(existsSync(destination)){
    const previous=JSON.parse(readFileSync(destination,'utf8'));
    if(previous?.schema_version!==1||previous?.source!=='zoo-worker-receipts'||!Array.isArray(previous.workers))
      throw Error('Existing worker feed invalid; refusing overwrite');
    if(previous.observed_at!==null){
      previousObserved=Date.parse(previous.observed_at);
      if(!Number.isFinite(previousObserved))throw Error('Existing worker feed timestamp invalid');
    }
    const ids=new Set();
    for(const worker of previous.workers){
      if(!worker||typeof worker.worker_id!=='string'||ids.has(worker.worker_id)||!Number.isFinite(Date.parse(worker.observed_at)))
        throw Error('Existing worker roster invalid; refusing overwrite');
      ids.add(worker.worker_id);
    }
    const oldAider=previous.workers.find(w=>w.worker_id===record.worker_id);
    if(oldAider&&Date.parse(oldAider.observed_at)>=Date.parse(record.observed_at))
      throw Error('Aider receipt is replayed or older than published worker receipt');
    workers=previous.workers.filter(w=>w.worker_id!==record.worker_id);
  }
  workers.push(record);
  const observed_at=new Date(Math.max(previousObserved,Date.parse(record.observed_at))).toISOString();
  const feed={schema_version:1,source:'zoo-worker-receipts',observed_at,workers,publication_scope:'Sanitized local Aider receipt and previously published provider claims; not authenticated native invocation or deploy proof.'};
  mkdirSync(dirname(destination),{recursive:true});
  const tmp=destination+'.'+process.pid+'.tmp';writeFileSync(tmp,JSON.stringify(feed,null,2)+'\n',{mode:0o600});renameSync(tmp,destination);
  console.log(JSON.stringify({status:'exported_local_receipt',worker_id:record.worker_id,observed_at:record.observed_at,output:destination}));
}catch(e){console.error('Receipt export failed: '+e.message);process.exit(1)}
