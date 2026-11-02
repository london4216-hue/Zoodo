-- ZOO private operations database only. Apply AFTER 005_outbox_retry_backoff.sql.
-- now() is frozen at transaction start: a delayed transaction can miss an
-- expired wake-up or schedule its retry in the past. Use actual wall-clock
-- time for lease expiry, dead retry eligibility, and the next retry deadline.
-- No scheduler, host, or worker is deployed by this migration.
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
     WHERE (o.state='leased' AND o.lease_until<clock_timestamp())
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
