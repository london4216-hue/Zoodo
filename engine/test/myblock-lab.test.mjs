import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, normalizeState, toggleFeature, toggleLicence, joinBlock, memberAccess, chronologicalPosts, deedRecord, inviteUrl, publishPost } from '../dashboard/labs/myblock/logic.mjs';

test('creator has unique slug, initial features and synthetic posts', () => {
  const s = freshState();
  assert.equal(s.creator.slug, 'nova-vale');
  assert.equal(s.posts.length, 2);
  assert.equal(s.members.length, 0);
});
test('creator can disable a feature and member sees access removed', () => {
  const s = toggleFeature(freshState(), 'posts');
  assert.equal(memberAccess(s).posts, false);
  assert.equal(freshState().features.posts, true);
});
test('invalid feature is rejected, never silently added', () => {
  assert.throws(() => toggleFeature(freshState(), 'billing'), /Unknown feature/);
});
test('invite is required to join and a second join is idempotent', () => {
  assert.throws(() => joinBlock(freshState(), 'wrong'), /Invite/);
  const joined = joinBlock(freshState(), 'demo-nova');
  assert.equal(memberAccess(joined).joined, true);
  assert.equal(joinBlock(joined, 'demo-nova').stats.joins, 1);
});
test('chronological feed has no ranking or algorithmic sorting', () => {
  const posts = chronologicalPosts(freshState());
  assert.deepEqual(posts.map(p => p.id), ['p2', 'p1']);
  assert.equal(posts.some(p => 'rank' in p), false);
});
test('licence revocation is reflected in exported demo deed', () => {
  const s = toggleLicence(freshState(), 'name');
  assert.equal(deedRecord(s).licences.name, false);
  assert.match(deedRecord(s).status, /UNSIGNED DEMO/);
});
test('invite URL is on the same host and carries no personal data', () => {
  const url = new URL(inviteUrl({ href: 'https://example.net/labs/myblock/?old=1' }));
  assert.equal(url.origin, 'https://example.net');
  assert.equal(url.searchParams.get('invite'), 'demo-nova');
  assert.equal(url.searchParams.has('old'), false);
});
test('corrupt and foreign local state fail closed to synthetic fixture', () => {
  assert.deepEqual(normalizeState({version: 999}), freshState());
  assert.equal(normalizeState({version: 1,creator:{slug:'wrong'}}).creator.slug, 'nova-vale');
});
test('restored state accepts only known feature and licence keys', () => {
  const s = normalizeState({version:1,creator:{slug:'nova-vale'},features:{posts:false,notes:true,secret:true},licences:{name:false,image:true,likeness:false},members:['sample-member','other'],stats:{visits:44,joins:999}});
  assert.deepEqual(Object.keys(s.features), ['posts','notes']);
  assert.deepEqual(s.members, ['sample-member']);
  assert.equal(s.stats.joins, 1);
});

test('creator publishes local synthetic content and newest post appears first', () => {
  const original = freshState();
  const next = publishPost(original, {title:'  Community launch  ',body:'  Hello members  '}, '2026-10-30T04:30:00Z');
  assert.equal(original.posts.length, 2);
  assert.equal(next.posts.length, 3);
  assert.equal(next.posts[2].title, 'Community launch');
  assert.equal(next.posts[2].body, 'Hello members');
  assert.equal(chronologicalPosts(next)[0].id, 'post-1');
});
test('published post survives validated local state restoration', () => {
  const first = publishPost(freshState(), {title:'One',body:'A'}, '2026-10-30T04:30:00Z');
  const restored = normalizeState(JSON.parse(JSON.stringify(first)));
  assert.equal(restored.posts.length, 3);
  const second = publishPost(restored, {title:'Two',body:'B'}, '2026-10-30T04:31:00Z');
  assert.deepEqual(second.posts.slice(2).map(p=>p.id), ['post-1','post-2']);
});
test('invalid, oversized and blank posts cannot be published', () => {
  for(const draft of [{title:' ',body:'Text'}, {title:'A',body:' '},{title:'X'.repeat(101),body:'A'},{title:'A',body:'B'.repeat(601)}]) {
    assert.throws(()=>publishPost(freshState(),draft),/Post must/);
  }
  assert.throws(()=>publishPost(freshState(),{title:'Okay',body:'Text'},'not-a-date'),/Invalid publish time/);
});
test('restoration discards injected and malformed posts, preserves only synthetic allowed fields', () => {
  const raw = publishPost(freshState(), {title:'Safe',body:'Content'}, '2026-10-30T04:30:00Z');
  raw.posts.push({id:'foreign',title:'Attack',body:'bad',date:'2026-10-30T04:31:00Z'});
  raw.posts.push({id:'post-2',title:'',body:'bad',date:'2026-10-30T04:31:00Z'});
  raw.posts.push({id:'post-3',title:'Safe',body:'okay',date:'bad'});
  const restored=normalizeState(raw);
  assert.deepEqual(restored.posts.map(p=>p.id), ['p1','p2','post-1']);
  assert.deepEqual(Object.keys(restored.posts[2]).sort(), ['body','date','id','title']);
});
test('synthetic lab refuses more than 20 posts', () => {
  let s=freshState();
  for(let i=0;i<18;i++)s=publishPost(s,{title:'Post '+i,body:'Sample'},'2026-10-30T04:30:00Z');
  assert.equal(s.posts.length,20);
  assert.throws(()=>publishPost(s,{title:'Overflow',body:'Sample'}),/limit reached/);
});
