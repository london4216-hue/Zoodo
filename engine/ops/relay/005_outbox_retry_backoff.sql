-- ZOO operations-only migration. Apply solely to the private ZOO control-plane database.
-- Outbox wake-ups are not terminal work failures: a four-attempt dead-letter leaves
-- otherwise eligible tickets stranded if no new event is created. Preserve bounded
-- retry pressure with capped backoff and durable audit events, without tight polling.
-- This migration does not install a scheduler, enable pg_net, or deploy a worker.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_recover()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
  WITH recovered AS (
    UPDATE public.zoo_ops_outbox o
       SET state='pending',
           next_at=now() + LEAST(3600, 30 * (1 << LEAST(GREATEST(o.attempts-1,0),7))) * interval '1 second',
           lease_token=NULL,
           lease_until=NULL
     WHERE (o.state='leased' AND o.lease_until<now())
        OR (o.state='dead' AND o.next_at<=now())
     RETURNING o.ticket_id,o.attempts
  )
  INSERT INTO public.zoo_ops_events(ticket_id,event)
  SELECT ticket_id,
         CASE WHEN attempts>=4 THEN 'outbox_retry_budget_exceeded'
              ELSE 'outbox_lease_recovered' END
    FROM recovered;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.zoo_ops_outbox_recover() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_outbox_recover() TO service_role;
COMMIT;
