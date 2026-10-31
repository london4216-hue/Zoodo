-- ZOO private operations database only. Apply AFTER 002_outbox_idle_settlement.sql.
-- An idle ACK must not accept an expired lease because now() is frozen at the
-- transaction start. Use the actual clock after row-lock waits, preserving the
-- original no-runnable-ticket condition. No worker or scheduler is deployed.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_settle_idle(p_id bigint, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_id IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  UPDATE public.zoo_ops_outbox AS o
     SET state='acked', lease_token=NULL, lease_until=NULL
   WHERE o.id=p_id AND o.state='leased' AND o.lease_token=p_token
     AND o.lease_until>clock_timestamp()
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
