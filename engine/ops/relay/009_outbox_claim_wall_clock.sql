-- ZOO private operations database only. Apply AFTER 001_ticket_directory.sql.
-- A long-lived transaction may begin before an outbox wake-up becomes ready;
-- now() is fixed at transaction start and can skip eligible work. Worse, a
-- claim created after a long wait gets a lease anchored in the past and can
-- expire immediately. Use actual wall-clock time at selection and assignment.
-- This is an additive RPC replacement, not a deployed scheduler or worker.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_claim()
RETURNS TABLE(id bigint,ticket_id text,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.zoo_ops_outbox%ROWTYPE;
BEGIN
  SELECT x.* INTO o FROM public.zoo_ops_outbox x
   WHERE x.state='pending' AND x.next_at<=clock_timestamp()
   ORDER BY x.id FOR UPDATE OF x SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.zoo_ops_outbox x
     SET state='leased',attempts=x.attempts+1,
         lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '30 seconds'
   WHERE x.id=o.id AND x.state='pending' RETURNING x.* INTO o;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT o.id,o.ticket_id,o.lease_token;
END $$;
REVOKE ALL ON FUNCTION public.zoo_ops_outbox_claim() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_outbox_claim() TO service_role;
COMMIT;
