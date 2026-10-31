-- Additive migration: safely settle a wake-up after the last eligible ticket.
-- Run only in the private ZOO operations database, never a product database.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_settle_idle(p_id bigint,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 -- A worker reporting idle is insufficient: it may have an active lease.
 -- Only settle if no dependency-ready, retry-eligible ticket remains queued.
 -- A concurrent enqueue writes its own durable outbox event.
 UPDATE public.zoo_ops_outbox o SET state='acked',lease_token=NULL,lease_until=NULL
 WHERE o.id=p_id AND o.state='leased' AND o.lease_token=p_token
 AND NOT EXISTS (
   SELECT 1 FROM public.zoo_ops_tickets q
   WHERE q.state='queued' AND q.attempts<q.max_attempts
   AND NOT EXISTS (
     SELECT 1 FROM unnest(q.dependencies) dep
     LEFT JOIN public.zoo_ops_tickets d ON d.id=dep
     WHERE d.id IS NULL OR d.state<>'done'
   )
 );
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.zoo_ops_outbox_settle_idle(bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_outbox_settle_idle(bigint,uuid) TO service_role;
COMMIT;
