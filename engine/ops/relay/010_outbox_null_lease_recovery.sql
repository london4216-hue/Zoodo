-- ZOO private operations database only. Apply AFTER 009_outbox_claim_wall_clock.sql.
-- A malformed legacy outbox row may be 'leased' with a NULL lease_until:
-- 001 permits this nullable column, while the 008 recovery comparison
-- `NULL < clock_timestamp()` is UNKNOWN. ACK and claim also cannot progress it.
-- Recover such unleased-in-practice wake-ups with the existing bounded retry
-- and event audit. No host, worker, scheduler or production DB is changed here.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_recover()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
  WITH recovered AS (
    UPDATE public.zoo_ops_outbox o
       SET state='pending',
           next_at=clock_timestamp() + LEAST(3600, 30 * (1 << LEAST(GREATEST(o.attempts-1,0),7))) * interval '1 second',
           lease_token=NULL,
           lease_until=NULL
     WHERE (o.state='leased' AND (o.lease_until IS NULL OR o.lease_until<clock_timestamp()))
        OR (o.state='dead' AND o.next_at<=clock_timestamp())
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
