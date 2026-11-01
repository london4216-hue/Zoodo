-- ZOO PRIVATE operations database only. Apply AFTER 004_queue_integrity_constraints.sql.
-- A long transaction can outlive a 45-second worker lease while now() remains
-- fixed at transaction start. Completion and dispatch evidence must not revive
-- that lease before the quarantine sweep runs. This is a source-only repair;
-- it does not apply migrations, deploy a worker, or qualify an external host.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_complete(
  p_id text,p_worker text,p_token uuid,p_commit text,p_test_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_commit IS NULL OR p_commit !~ '^[a-f0-9]{40}$'
     OR p_test_url IS NULL OR p_test_url !~ '^https://[^ ]{1,1000}$'
  THEN RAISE EXCEPTION 'exact SHA and HTTPS test receipt required'; END IF;
  UPDATE public.zoo_ops_tickets SET state='done',commit_sha=p_commit,test_url=p_test_url,
    completed_at=clock_timestamp(),updated_at=clock_timestamp(),
    lease_owner=NULL,lease_token=NULL,lease_until=NULL
  WHERE id=p_id AND state='leased' AND lease_owner=p_worker AND lease_token=p_token
    AND lease_until>clock_timestamp();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.zoo_ops_events(ticket_id,event,worker,receipt_url)
    VALUES(p_id,'completed',p_worker,p_test_url);
  INSERT INTO public.zoo_ops_outbox(ticket_id) VALUES(p_id);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.zoo_ops_dispatch_recorded(
  p_id text,p_worker text,p_token uuid,p_receipt text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_receipt IS NULL OR p_receipt !~ '^https://[^ ]{1,1000}$'
  THEN RAISE EXCEPTION 'native dispatch receipt required'; END IF;
  UPDATE public.zoo_ops_tickets SET dispatch_receipt=p_receipt,updated_at=clock_timestamp()
  WHERE id=p_id AND state='leased' AND lease_owner=p_worker AND lease_token=p_token
    AND lease_until>clock_timestamp();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.zoo_ops_events(ticket_id,event,worker,receipt_url)
    VALUES(p_id,'dispatch_accepted',p_worker,p_receipt);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.zoo_ops_quarantine_expired()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
  WITH moved AS (
    UPDATE public.zoo_ops_tickets SET state='uncertain',updated_at=clock_timestamp()
    WHERE state='leased' AND lease_until<clock_timestamp()
    RETURNING id,lease_owner
  )
  INSERT INTO public.zoo_ops_events(ticket_id,event,worker)
    SELECT id,'lease_expired_uncertain',lease_owner FROM moved;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.zoo_ops_complete(text,text,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_complete(text,text,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.zoo_ops_dispatch_recorded(text,text,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_dispatch_recorded(text,text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.zoo_ops_quarantine_expired()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_quarantine_expired() TO service_role;
COMMIT;
