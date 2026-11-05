import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/004_queue_integrity_constraints.sql', import.meta.url), 'utf8');
const normalized = sql.replace(/--[^\n]*/g, '');
const constraint = normalized.indexOf('ADD CONSTRAINT zoo_ops_outbox_lease_integrity_v1');

test('preflight repairs tokenless NULL-expiry legacy outbox before CHECK is installed', () => {
  const repair = normalized.indexOf('UPDATE public.zoo_ops_outbox');
  assert.ok(repair > 0 && repair < constraint, 'repair must precede outbox constraint');
  const body = normalized.slice(repair, constraint);
  assert.match(body, /state\s*=\s*'pending'/);
  assert.match(body, /o\.state\s*=\s*'leased'/);
  assert.match(body, /o\.lease_until\s+IS\s+NULL/);
  assert.match(body, /o\.lease_token\s+IS\s+NULL/);
  assert.match(body, /next_at\s*=\s*clock_timestamp\(\)/);
});

test('preflight writes durable wall-clock audit without resetting attempts', () => {
  const repair = normalized.slice(0, constraint);
  assert.match(repair, /INSERT INTO public\.zoo_ops_events\s*\(ticket_id,event,at\)/);
  assert.match(repair, /outbox_legacy_null_lease_recovered/);
  assert.match(repair, /clock_timestamp\(\)/);
  assert.doesNotMatch(repair, /SET\s+attempts\s*=/i);
});

test('token-bearing unknown-expiry rows still fail closed at validated constraint', () => {
  assert.match(normalized, /ADD CONSTRAINT zoo_ops_outbox_lease_integrity_v1\s+CHECK/);
  assert.match(normalized, /lease_token IS NOT NULL AND lease_until IS NOT NULL/);
  assert.doesNotMatch(normalized, /NOT VALID/);
  assert.match(normalized, /LOCK TABLE public\.zoo_ops_tickets, public\.zoo_ops_events, public\.zoo_ops_outbox/);
  assert.match(normalized, /BEGIN;[\s\S]*COMMIT;/);
});
