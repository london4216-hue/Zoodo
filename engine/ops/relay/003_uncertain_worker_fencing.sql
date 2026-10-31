-- Additive fail-closed migration for ZOO's PRIVATE operations database only.
-- A timed-out worker may still be executing. An 'uncertain' ticket must reserve
-- its worker until a native non-execution receipt resolves the ticket.
-- Apply AFTER 001_ticket_directory.sql and 002_outbox_idle_settlement.sql.
BEGIN;

-- Prevent a concurrent claim/quarantine transition between preflight and index.
LOCK TABLE public.zoo_ops_tickets IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.zoo_ops_tickets
    WHERE state IN ('leased','uncertain') AND lease_owner IS NOT NULL
    GROUP BY lease_owner HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'zoo_ops worker has multiple active/uncertain tickets; resolve with authenticated native receipts before migration';
  END IF;
END $$;

-- Keep the old partial index for backward compatibility; this stronger index
-- fences BOTH leased and quarantined uncertain work at the database boundary.
CREATE UNIQUE INDEX IF NOT EXISTS zoo_ops_worker_active_uncertain_v1
ON public.zoo_ops_tickets (lease_owner)
WHERE state IN ('leased','uncertain') AND lease_owner IS NOT NULL;

CREATE OR REPLACE FUNCTION public.zoo_ops_claim(p_worker text)
RETURNS TABLE(id text,asset text,intent text,lease_owner text,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.zoo_ops_tickets%ROWTYPE;
BEGIN
  IF p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9_-]{1,64} THEN RAISE EXCEPTION 'invalid worker'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('zoo-ops:'||p_worker));
  -- A timeout/quarantine is NOT evidence the original worker stopped.
  IF EXISTS (
    SELECT 1 FROM public.zoo_ops_tickets q
    WHERE q.state IN ('leased','uncertain') AND q.lease_owner=p_worker
  ) THEN RETURN; END IF;
  SELECT q.* INTO t FROM public.zoo_ops_tickets q
  WHERE q.state='queued' AND q.attempts<q.max_attempts
    AND NOT EXISTS (
      SELECT 1 FROM unnest(q.dependencies) dep
      LEFT JOIN public.zoo_ops_tickets d ON d.id=dep
      WHERE d.id IS NULL OR d.state<>'done'
    )
  ORDER BY q.priority DESC,q.created_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.zoo_ops_tickets q SET state='leased',lease_owner=p_worker,
    lease_token=gen_random_uuid(),lease_until=now()+interval '45 seconds',
    attempts=q.attempts+1,updated_at=now() WHERE q.id=t.id RETURNING q.* INTO t;
  INSERT INTO public.zoo_ops_events(ticket_id,event,worker) VALUES(t.id,'claimed',p_worker);
  RETURN QUERY SELECT t.id,t.asset,t.intent,t.lease_owner,t.lease_token;
END $$;

REVOKE ALL ON FUNCTION public.zoo_ops_claim(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_claim(text) TO service_role;
COMMIT;
 THEN RAISE EXCEPTION 'invalid worker'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('zoo-ops:'||p_worker));
  -- A timeout/quarantine is NOT evidence the original worker stopped.
  IF EXISTS (
    SELECT 1 FROM public.zoo_ops_tickets q
    WHERE q.state IN ('leased','uncertain') AND q.lease_owner=p_worker
  ) THEN RETURN; END IF;
  SELECT q.* INTO t FROM public.zoo_ops_tickets q
  WHERE q.state='queued' AND q.attempts<q.max_attempts
    AND NOT EXISTS (
      SELECT 1 FROM unnest(q.dependencies) dep
      LEFT JOIN public.zoo_ops_tickets d ON d.id=dep
      WHERE d.id IS NULL OR d.state<>'done'
    )
  ORDER BY q.priority DESC,q.created_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.zoo_ops_tickets q SET state='leased',lease_owner=p_worker,
    lease_token=gen_random_uuid(),lease_until=now()+interval '45 seconds',
    attempts=q.attempts+1,updated_at=now() WHERE q.id=t.id RETURNING q.* INTO t;
  INSERT INTO public.zoo_ops_events(ticket_id,event,worker) VALUES(t.id,'claimed',p_worker);
  RETURN QUERY SELECT t.id,t.asset,t.intent,t.lease_owner,t.lease_token;
END $$;

REVOKE ALL ON FUNCTION public.zoo_ops_claim(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_claim(text) TO service_role;
COMMIT;
