-- Additive fail-closed ZOO queue integrity migration, PRIVATE operations DB only.
-- Apply AFTER 001_ticket_directory.sql, 002_outbox_idle_settlement.sql,
-- and 003_uncertain_worker_fencing.sql. Never apply to a product database.
-- Existing invalid rows cause this transaction to fail rather than silently
-- accepting phantom leases or unverifiable task completions.
BEGIN;
LOCK TABLE public.zoo_ops_tickets, public.zoo_ops_events, public.zoo_ops_outbox
  IN SHARE ROW EXCLUSIVE MODE;

-- The SQL claim RPC previously let a NULL worker bypass a regex check because
-- PostgreSQL IF treats NULL as not-true. A leased/uncertain ticket must always
-- have a valid worker identity, lease token and expiry; no ghost ownership.
ALTER TABLE public.zoo_ops_tickets
  ADD CONSTRAINT zoo_ops_active_lease_integrity_v1
  CHECK (state NOT IN ('leased','uncertain') OR
    (lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL
     AND lease_owner ~ '^[A-Za-z0-9_-]{1,64}$'));

-- A direct service-role RPC with NULL p_commit/p_test_url could otherwise
-- mark a ticket done: SQL's `IF NULL !~ regex` does not raise an error.
ALTER TABLE public.zoo_ops_tickets
  ADD CONSTRAINT zoo_ops_done_evidence_integrity_v1
  CHECK (state <> 'done' OR
    (commit_sha IS NOT NULL AND commit_sha ~ '^[a-f0-9]{40}$'
     AND test_url IS NOT NULL AND test_url ~ '^https://[^ ]{1,1000}$'));

-- Native non-execution, completion and dispatch acceptance are only durable
-- evidence when the event contains a non-null HTTPS receipt.
ALTER TABLE public.zoo_ops_events
  ADD CONSTRAINT zoo_ops_event_receipt_integrity_v1
  CHECK (event NOT IN ('completed','not_started','dispatch_accepted') OR
    (receipt_url IS NOT NULL AND receipt_url ~ '^https://[^ ]{1,1000}$'));

-- A leased wake-up without a token/expiry cannot be safely acknowledged or
-- recovered by an independent worker.
ALTER TABLE public.zoo_ops_outbox
  ADD CONSTRAINT zoo_ops_outbox_lease_integrity_v1
  CHECK (state <> 'leased' OR
    (lease_token IS NOT NULL AND lease_until IS NOT NULL));
COMMIT;
