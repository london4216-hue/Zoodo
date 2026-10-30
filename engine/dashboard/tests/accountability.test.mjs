import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.resolve(dir,'../index.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]||'';

test('accountability appears before owner directory, never hides existing navigation',()=>{
 assert.ok(html.indexOf('id="accountability"')>0);
 assert.ok(html.indexOf('id="accountability"')<html.indexOf('YOUR HOME / QUICK LINKS'));
 assert.ok(html.includes('id="labs"'));
 assert.ok(html.includes('id="queue-panel"'));
 assert.ok(html.includes('id="commits"'));
 assert.ok(html.includes('id="runs"'));
});
test('four KPIs are distinct and never claim unverified agent or score values',()=>{
 for(const id of ['kpiActive','kpiProjects','kpiToday','kpiLast'])
   assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.ok(html.includes('Not measured'));
 assert.ok(html.includes('No dated report'));
 assert.ok(html.includes('Not retrieved'));
});
test('owner, independent backup and integration authority are named',()=>{
 assert.match(html,/Owner:<\/b> ZOO Dashboard Worker/);
 assert.match(html,/Independent backup:<\/b> ZOO Agent Hunter/);
 assert.match(html,/Integration authority:<\/b> Sole ZOO Keeper/);
 assert.match(html,/Next automatic step:/);
});
test('historical EVIDENCE UNKNOWN · ESCALATION REQUIRED is never displayed',()=>{
 assert.ok(!html.includes('EVIDENCE UNKNOWN · ESCALATION REQUIRED'));
 assert.match(html,/WORK IN PROGRESS · SOURCE RECOVERY/);
 assert.match(html,/GitHub source receipt unavailable/);
});
test('every already advertised essential demo and owner link remains available',()=>{
 const required=[
  'https://prestigeengage-demo.netlify.app/',
  'https://transcendiq-control-panel.netlify.app/pitch/control-panel.html',
  'https://ez-move-transcendiq.netlify.app/demo',
  'https://app.netlify.com/projects/zoo-live-dashboard/overview',
  'https://github.com/london4216-hue/TransendIQ',
  'https://github.com/london4216-hue/Zoodo',
  'https://beautypaths.io/tour',
  'https://wonup2.transendtiq2.com/demo?as=student',
  'https://wonup2.transendtiq2.com/demo?as=school_admin'
 ];
 for(const url of required)assert.ok(html.includes('href="'+url+'"'),url);
});
test('source refresh is distinguished from worker heartbeat and verification',()=>{
 assert.match(script,/Last successful GitHub API source response:/);
 assert.match(script,/source receipt is not proof of active worker/);
 assert.match(script,/review \/ active worker heartbeat NOT established/);
 assert.match(script,/Automatic retry every 30 seconds/);
 assert.match(script,/setInterval\(update,30000\)/);
});

test('GitHub commit-source success is not inferred from an unrelated Actions response',()=>{
 assert.match(script,/if\(commits\.status==='fulfilled'\)\{\s*\$\('sourceSuccess'\)/);
 assert.match(script,/GitHub commit endpoint response/);
});
