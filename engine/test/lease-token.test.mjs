import test from 'node:test';
import assert from 'node:assert/strict';
import {validLeaseToken} from '../ops/relay/lease-token.mjs';

test('accepts canonical UUID lease tokens regardless of hex case', () => {
  assert.equal(validLeaseToken('00000001-0000-4000-8000-000000000001'), true);
  assert.equal(validLeaseToken('AABBCCDD-1234-ABCD-0000-1234567890EF'), true);
});
test('rejects malformed 36-character tokens that loose hyphen regex accepts', () => {
  for (const token of ['-'.repeat(36), 'a'.repeat(36), '00000001000040008000000000000001', '00000001-0000-4000-8000-00000000000g', '', null]) {
    assert.equal(validLeaseToken(token), false, String(token));
  }
});
