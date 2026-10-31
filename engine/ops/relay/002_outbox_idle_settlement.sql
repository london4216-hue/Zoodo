-- ZOO P0 additive repair: makeStore.settleIdleOutbox calls this RPC.
-- Apply only to the private ZOO operations Supabase project AFTER 001_ticket_directory.sql.
-- This migration does not deploy or invoke a worker.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_settle_idle(p_id bigint, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_id IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  -- Atomic, lease-fenced ACK. An idle worker alone is insufficient: another
  -- worker may be busy while runnable tickets remain in the shared queue.
  UPDATE public.zoo_ops_outbox AS o
     SET state='acked', lease_token=NULL, lease_until=NULL
   WHERE o.id=p_id AND o.state='leased' AND o.lease_token=p_token
     AND o.lease_until>now()
     AND NOT EXISTS (
       SELECT 1 FROM public.zoo_ops_tickets AS q
        WHERE q.state='queued' AND q.attempts<q.max_attempts
          AND NOT EXISTS (
            SELECT 1 FROM unnest(q.dependencies) AS dep
              LEFT JOIN public.zoo_ops_tickets AS d ON d.id=dep
             WHERE d.id IS NULL OR d.state<>'done'
          )
     );
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.zoo_ops_outbox_settle_idle(bigint,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_outbox_settle_idle(bigint,uuid)
  TO service_role;
COMMIT;
