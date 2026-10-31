import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGINAL_LIVE_LINKS, originalLinksFor} from '../original-live-links.mjs';

test('original directory restores public address records without secrets or historical grades', () => {
  assert.equal(ORIGINAL_LIVE_LINKS.length, 23);
  const urls=new Set();
  for(const entry of ORIGINAL_LIVE_LINKS) {
    const url=new URL(entry.url);
    assert.equal(url.protocol,'https:');
    assert.equal(url.username,'');
    assert.equal(url.password,'');
    assert(!/closet|READ_KEY|transend-iq-lkyx|beauty-world\.base44/.test(entry.url));
    for(const key of url.searchParams.keys())
      assert(!/token|secret|password|pin|key/i.test(key));
    assert(!urls.has(entry.url));
    urls.add(entry.url);
    assert(!Object.keys(entry).some(key=>/grade|score|verified|availability/.test(key)));
  }
});

test('original role routes remain four distinct WonUp demo addresses', () => {
  const roles=originalLinksFor('wonup').filter(link=>link.kind==='demo')
    .map(link=>new URL(link.url).searchParams.get('as')).sort();
  assert.deepEqual(roles,['pre_enrolled','school_admin','student','super_admin']);
  assert.equal(originalLinksFor('myblock')[0].kind,'design');
  assert.equal(originalLinksFor('absent').length,0);
});
