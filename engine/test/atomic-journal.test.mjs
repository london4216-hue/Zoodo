import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendJournalEvent} from '../src/atomic-journal.mjs';
const withFile = fn => {const dir=mkdtempSync(join(tmpdir(),'zoo-atomic-'));try{return fn(join(dir,'queue.jsonl'))}finally{rmSync(dir,{recursive:true,force:true})}};
test('writes append-only events and checks exact checkpoint',()=>withFile(file=>{
  appendJournalEvent(file,{eventId:'one',type:'create'},0);
  appendJournalEvent(file,{eventId:'two',type:'claim'},1,'one');
  assert.deepEqual(readFileSync(file,'utf8').trim().split('\n').map(JSON.parse).map(x=>x.eventId),['one','two']);
}));
test('two stale queue instances cannot both claim the same ticket',()=>withFile(file=>{
  appendJournalEvent(file,{eventId:'create',type:'create'},0);
  appendJournalEvent(file,{eventId:'first-claim',type:'claim'},1,'create');
  assert.throws(()=>appendJournalEvent(file,{eventId:'second-claim',type:'claim'},1,'create'),/Stale queue snapshot/);
  assert.equal(readFileSync(file,'utf8').trim().split('\n').length,2);
}));
test('live lock refuses concurrent writer without modifying journal',()=>withFile(file=>{
  const fd=openSync(file+'.lock','wx');
  try{assert.throws(()=>appendJournalEvent(file,{eventId:'x'},0),/Journal busy/)}finally{closeSync(fd);unlinkSync(file+'.lock')}
  assert.throws(()=>readFileSync(file,'utf8'),{code:'ENOENT'});
}));
test('torn journal fails closed',()=>withFile(file=>{
  writeFileSync(file,'{"eventId":"one"}');
  assert.throws(()=>appendJournalEvent(file,{eventId:'two'},1,'one'),/Incomplete journal record/);
}));
test('same event count but wrong tail is rejected',()=>withFile(file=>{
  appendJournalEvent(file,{eventId:'one'},0);
  assert.throws(()=>appendJournalEvent(file,{eventId:'two'},1,'wrong'),/checkpoint mismatch/);
}));
