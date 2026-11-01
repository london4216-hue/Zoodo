#!/usr/bin/env node
// Off-GitHub/local runner adapter: export only allowlisted Aider receipt fields.
// Publishing to the live dashboard still requires the existing authorized deploy pipeline.
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {normalizeAiderReceipt} from '../worker-feed.mjs';

const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:null};
const input=value('--receipt'),output=value('--out');
if(!input||!output||args.length!==4){console.error('Usage: node scripts/publish-worker-feed.mjs --receipt /path/to/local-receipt.json --out /path/to/dashboard/worker-feed.json');process.exit(2)}
try{
  const record=normalizeAiderReceipt(JSON.parse(readFileSync(resolve(input),'utf8')));
  if(Date.parse(record.observed_at)>Date.now()+60000)throw Error('Future-dated receipt refused');
  const feed={schema_version:1,source:'zoo-worker-receipts',observed_at:record.observed_at,workers:[record],publication_scope:'Sanitized local Aider receipt only; not authenticated native invocation, not a deploy receipt.'};
  const destination=resolve(output);mkdirSync(dirname(destination),{recursive:true});
  const tmp=destination+'.'+process.pid+'.tmp';writeFileSync(tmp,JSON.stringify(feed,null,2)+'\n',{mode:0o600});renameSync(tmp,destination);
  console.log(JSON.stringify({status:'exported_local_receipt',worker_id:record.worker_id,observed_at:record.observed_at,output:destination}));
}catch(e){console.error('Receipt export failed: '+e.message);process.exit(1)}
