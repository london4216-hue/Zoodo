import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, normalizeState, toggleFeature, toggleLicence, joinBlock, memberAccess, chronologicalPosts, deedRecord, inviteUrl } from '../dashboard/labs/myblock/logic.mjs';

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
