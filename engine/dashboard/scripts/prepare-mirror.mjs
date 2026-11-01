#!/usr/bin/env node
// Single-source portable static build: Netlify stays primary; Render/Vercel/Cloudflare mirror EXACT SAME vetted files.
// Never copy .env, .git, the app root, GitHub credentials or private source into a public host.
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'mirror-dist');
const allowedFiles = [
  'index.html',
  'accountability.html',
  'handoff-ledger.json',
  'evidence-clock.mjs',
  'automation-proof.mjs',
  'automation-proof.json',
  'verified-links.json',
  'hosting-mirrors.json',
  'build-proof.json',
  'labs/myblock/index.html',
  'labs/myblock/logic.mjs',
  'labs/yearbook3/index.html',
  'labs/yearbook3/logic.mjs',
];
const proofFile = join(root, 'build-proof.json');
if (!existsSync(proofFile)) throw Error('missing_build_proof: run node scripts/build-proof.mjs first');
const proof = JSON.parse(readFileSync(proofFile, 'utf8'));
if (proof.build_tests !== 'PASSED' || proof.schema_version !== 1 || !Array.isArray(proof.test_suite) || !proof.test_suite.length) {
  throw Error('untrusted_build_receipt');
}
if (!existsSync(join(root, 'index.html'))) throw Error('missing_dashboard_index');
const sourceHtml=readFileSync(join(root,'index.html'),'utf8');
if(sourceHtml.includes('EVIDENCE UNKNOWN · ESCALATION REQUIRED')) throw Error('old_escalation_label_in_build');
if(!sourceHtml.includes('id="accountability"')) throw Error('missing_accountability_panel');
rmSync(out,{recursive:true,force:true});
mkdirSync(out,{recursive:true});
for (const relative of allowedFiles) {
  const from=join(root,relative);
  if (!existsSync(from)) throw Error('missing_allowlisted_asset:'+relative);
  const dest=join(out,relative);
  mkdirSync(dirname(dest),{recursive:true});
  copyFileSync(from,dest);
}
const manifest={
  schema_version:1,
  file_count:allowedFiles.length,
  allowlisted_files:allowedFiles,
  source_commit:proof.source_commit,
  build_verified_at:proof.verified_at,
  source_repo:'london4216-hue/Zoodo',
  verified_scope:'source contract tests and static artifact inventory',
  browser_verified:false,
  provider_failover_verified:false,
  agent_heartbeat_verified:false
};
writeFileSync(join(out,'mirror-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
// The primary dashboard checks public mirror HTML/JS from another origin before
// showing a link. Only explicitly allowlisted PUBLIC static files reach this folder.
writeFileSync(join(out,'_headers'),[
  '/*',
  '  Access-Control-Allow-Origin: *',
  '  Cache-Control: no-store',
  '  X-Content-Type-Options: nosniff',
  ''
].join('\n'));
console.log('ZOO MIRROR ARTIFACT '+JSON.stringify(manifest));
