import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshState, normalizeState, toggleFeature, toggleLicence, joinBlock, memberAccess, chronologicalPosts, deedRecord, inviteUrl, INVITE_CODE } from './logic.mjs';

test('synthetic baseline is creator-first and uses no real accounts', () => {
  const s=freshState(); assert.equal(s.creator.slug,'nova-vale'); assert.deepEqual(s.members,[]);
  assert.equal(s.features.posts,true); assert.equal(s.features.notes,true);
  assert.equal(s.stats.joins,0); assert.equal(s.posts.length,2);
});
test('creator can disable a feature without mutating original state', () => {
  const initial=freshState(), next=toggleFeature(initial,'posts');
  assert.equal(initial.features.posts,true); assert.equal(memberAccess(next).posts,false);
  assert.equal(memberAccess(next).notes,true);
  assert.equal(toggleFeature(next,'posts').features.posts,true);
  assert.throws(()=>toggleFeature(next,'payments'),/Unknown feature/);
});
test('licence revocation is reflected in export without claiming a signature', () => {
  const initial=freshState(), next=toggleLicence(initial,'name');
  assert.equal(initial.licences.name,true); assert.equal(deedRecord(next).licences.name,false);
  assert.match(deedRecord(next).status,/UNSIGNED DEMO/);
  assert.throws(()=>toggleLicence(next,'wallet'),/Unknown licence/);
});
test('joining requires the demo invite and cannot increment joins twice', () => {
  const initial=freshState(); assert.throws(()=>joinBlock(initial,'wrong'),/Invite not recognized/);
  const joined=joinBlock(initial,INVITE_CODE);assert.equal(joined.stats.joins,1);
  assert.equal(memberAccess(joined).joined,true);assert.equal(initial.stats.joins,0);
  assert.equal(joinBlock(joined,INVITE_CODE),joined);
});
test('chronological feed is newest first without changing stored order', () => {
  const s=freshState(), before=s.posts.map(p=>p.id), sorted=chronologicalPosts(s);
  assert.deepEqual(sorted.map(p=>p.id),['p2','p1']);assert.deepEqual(s.posts.map(p=>p.id),before);
});
test('state restoration discards foreign creator identity and clamps synthetic counters', () => {
  const s=freshState(); assert.deepEqual(normalizeState(null),s);
  assert.deepEqual(normalizeState({...s,version:99}),s);
  assert.deepEqual(normalizeState({...s,creator:{slug:'other'}}),s);
  const restored=normalizeState({...s,stats:{visits:1000000000},members:['sample-member','someone-else']});
  assert.equal(restored.stats.visits,999999);assert.equal(restored.stats.joins,1);
  assert.deepEqual(restored.members,['sample-member']);
});
test('invite link is same-origin and carries no credential beyond a synthetic demo code', () => {
  const u=new URL(inviteUrl({href:'https://example.test/labs/myblock/?old=secret'}));
  assert.equal(u.origin,'https://example.test');assert.equal(u.pathname,'/labs/myblock/');
  assert.equal(u.searchParams.get('invite'),INVITE_CODE);
  assert.equal(u.searchParams.get('mode'),'visitor');assert.equal(u.searchParams.has('old'),false);
});
test('mobile page contains accessible role buttons, explicit disclaimers and no remote scripts', () => {
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  assert.match(html,/name="viewport"/);assert.match(html,/@media\(max-width:720px\)/);
  assert.match(html,/aria-pressed/);assert.match(html,/SYNTHETIC LAB/);
  assert.match(html,/not a blockchain transaction or legal instrument/);
  assert.doesNotMatch(html,/<script[^>]+src="https?:/i);
  assert.match(html,/\.\/logic\.mjs/);
});
