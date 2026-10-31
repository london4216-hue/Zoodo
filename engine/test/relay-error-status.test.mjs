import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRelayError} from '../ops/relay/relay-error-status.mjs';

test('transient Supabase 5xx, throttling, and timeout errors request HTTP retry', () => {
  for (const error of [Error('RPC complete HTTP 500'),Error('RPC claim HTTP 503'),Error('RPC outbox_recover HTTP 429'),Object.assign(Error('deadline'),{name:'TimeoutError'}),Object.assign(Error('aborted'),{name:'AbortError'}),Error('fetch failed')]) {
    assert.equal(classifyRelayError(error).statusCode,503,error.message);
  }
});

test('invalid or conflicting durable transitions do not trigger blind retry', () => {
  for (const error of [Error('Invalid completion'),Error('RPC complete HTTP 400'),Error('Transition not durably confirmed'),Error('Invalid atomic lease')]) {
    assert.equal(classifyRelayError(error).statusCode,409,error.message);
  }
});

test('error text is bounded and does not leak arbitrary exception object fields', () => {
  const result=classifyRelayError(Object.assign(Error('x'.repeat(500)),{secret:'do-not-leak'}));
  assert.equal(result.statusCode,409);
  assert.equal(result.message.length,160);
  assert.ok(!JSON.stringify(result).includes('do-not-leak'));
});
