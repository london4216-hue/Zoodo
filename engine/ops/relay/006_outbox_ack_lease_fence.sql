-- ZOO private operations database only. Apply AFTER 001_ticket_directory.sql.
-- An expired outbox claim must not ACK a wake-up even when its token still
-- matches: another worker may be recovering the same durable event.
-- Use wall-clock time, not transaction-start now(): a long transaction or lock
-- wait must not revive an expired lease. No scheduler or retry-policy change.
BEGIN;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_ack(p_id bigint,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_id IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  UPDATE public.zoo_ops_outbox AS o
     SET state='acked', lease_token=NULL, lease_until=NULL
   WHERE o.id=p_id AND o.state='leased' AND o.lease_token=p_token
     AND o.lease_until>clock_timestamp();
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.zoo_ops_outbox_ack(bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoo_ops_outbox_ack(bigint,uuid) TO service_role;
COMMIT;
