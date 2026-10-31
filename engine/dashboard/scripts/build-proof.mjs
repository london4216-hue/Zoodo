#!/usr/bin/env node
/** ZOO Netlify build gate. Source tests are NOT hosted worker or dashboard proof. */
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ownPath=fileURLToPath(import.meta.url);
const defaultDashboard=resolve(dirname(ownPath),'..');

export function runBuild({dashboardDir=defaultDashboard,testsDir=resolve(defaultDashboard,'..','test'),env=process.env}={}) {
  // Do not publish a green receipt when provider identities conflict.
  const candidates=[env.COMMIT_REF,env.VERCEL_GIT_COMMIT_SHA,env.RENDER_GIT_COMMIT,env.CF_PAGES_COMMIT_SHA]
    .filter(x=>/^[a-f0-9]{40}$/.test(x||''));
  const distinct=[...new Set(candidates)];
  if(distinct.length>1)throw Error('conflicting provider commit SHAs');
  const files=readdirSync(testsDir,{withFileTypes:true})
    .filter(x=>x.isFile()&&x.name.endsWith('.test.mjs')).map(x=>join(testsDir,x.name)).sort();
  if(!files.length)throw Error('no source tests registered');
  const result=spawnSync(process.execPath,['--test',...files],{
    cwd:dirname(testsDir),stdio:'inherit',timeout:180000,env
  });
  if(result.error||result.status!==0)throw Error('contract tests failed, timed out, or could not run');
  const context=['production','deploy-preview','branch-deploy'].includes(env.CONTEXT)?env.CONTEXT:'unknown';
  const receipt={
    schema_version:1,
    build_tests:'PASSED',
    test_suite:files.map(x=>x.slice(testsDir.length+1)),
    source_commit:distinct[0]||null,
    deployment_context:context,
    branch:String(env.BRANCH||'unknown').slice(0,130),
    verified_at:new Date().toISOString(),
    verified_scope:'Zoodo build-time Node source tests only',
    browser_functionality_verified:false,
    independent_worker_heartbeat_verified:false,
    hosted_two_ticket_recovery_verified:false,
    production_release_verified:false
  };
  writeFileSync(join(dashboardDir,'build-proof.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log('ZOO SOURCE BUILD RECEIPT '+JSON.stringify(receipt));
  return receipt;
}

if(process.argv[1]&&resolve(process.argv[1])===ownPath){
  try{runBuild()}catch(e){console.error('ZOO BUILD BLOCKED: '+String(e.message||e));process.exitCode=1;}
}
