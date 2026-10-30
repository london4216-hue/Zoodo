-- ZOO operations control plane. Public source; PRIVATE Supabase ticket rows.
-- Do not apply to a product database. No migration has been applied by this PR.
BEGIN;
CREATE TABLE IF NOT EXISTS public.zoo_ops_tickets (
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$'),
 asset text NOT NULL, intent text NOT NULL,
 dependencies text[] NOT NULL DEFAULT '{}',
 priority int NOT NULL DEFAULT 50,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','uncertain','done','blocked')),
 lease_owner text, lease_token uuid, lease_until timestamptz,
 attempts int NOT NULL DEFAULT 0, max_attempts int NOT NULL DEFAULT 3,
 branch text, pr_url text, commit_sha text, test_url text, deployment_url text,
 dispatch_receipt text, failure_receipt text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK(NOT(id=ANY(dependencies))), CHECK(max_attempts BETWEEN 1 AND 10)
);
CREATE UNIQUE INDEX IF NOT EXISTS zoo_ops_worker_lease ON public.zoo_ops_tickets(lease_owner)
 WHERE state='leased' AND lease_owner IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.zoo_ops_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ticket_id text NOT NULL REFERENCES public.zoo_ops_tickets(id),
 event text NOT NULL, worker text, receipt_url text, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.zoo_ops_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ticket_id text NOT NULL REFERENCES public.zoo_ops_tickets(id),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','acked','dead')),
 attempts int NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
 next_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zoo_ops_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoo_ops_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoo_ops_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zoo_ops_tickets,public.zoo_ops_events,public.zoo_ops_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.zoo_ops_tickets,public.zoo_ops_events,public.zoo_ops_outbox TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE OR REPLACE FUNCTION public.zoo_ops_enqueue(p_id text,p_asset text,p_intent text,p_dependencies text[] DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 IF p_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$' OR p_id=ANY(p_dependencies)
 OR length(p_asset) NOT BETWEEN 1 AND 128 OR length(p_intent) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'invalid ticket'; END IF;
 INSERT INTO public.zoo_ops_tickets(id,asset,intent,dependencies)
 VALUES(p_id,p_asset,p_intent,p_dependencies) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=1 THEN
  INSERT INTO public.zoo_ops_events(ticket_id,event) VALUES(p_id,'enqueued');
  INSERT INTO public.zoo_ops_outbox(ticket_id) VALUES(p_id);
 END IF;
 RETURN n=1;
END $$;

CREATE OR REPLACE FUNCTION public.zoo_ops_claim(p_worker text)
RETURNS TABLE(id text,asset text,intent text,lease_owner text,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.zoo_ops_tickets%ROWTYPE;
BEGIN
 IF p_worker !~ '^[A-Za-z0-9_-]{1,64}$' THEN RAISE EXCEPTION 'invalid worker'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('zoo-ops:'||p_worker));
 IF EXISTS(SELECT 1 FROM public.zoo_ops_tickets q WHERE q.state='leased' AND q.lease_owner=p_worker) THEN RETURN; END IF;
 SELECT q.* INTO t FROM public.zoo_ops_tickets q
 WHERE q.state='queued' AND q.attempts<q.max_attempts
 AND NOT EXISTS(SELECT 1 FROM unnest(q.dependencies) dep
 LEFT JOIN public.zoo_ops_tickets d ON d.id=dep WHERE d.id IS NULL OR d.state<>'done')
 ORDER BY q.priority DESC,q.created_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.zoo_ops_tickets q SET state='leased',lease_owner=p_worker,
 lease_token=gen_random_uuid(),lease_until=now()+interval '45 seconds',
 attempts=q.attempts+1,updated_at=now() WHERE q.id=t.id RETURNING q.* INTO t;
 INSERT INTO public.zoo_ops_events(ticket_id,event,worker) VALUES(t.id,'claimed',p_worker);
 RETURN QUERY SELECT t.id,t.asset,t.intent,t.lease_owner,t.lease_token;
END $$;

CREATE OR REPLACE FUNCTION public.zoo_ops_complete(p_id text,p_worker text,p_token uuid,p_commit text,p_test_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_commit !~ '^[a-f0-9]{40}$' OR p_test_url !~ '^https://[^ ]{1,1000}$'
 THEN RAISE EXCEPTION 'exact SHA and HTTPS test receipt required'; END IF;
 UPDATE public.zoo_ops_tickets SET state='done',commit_sha=p_commit,test_url=p_test_url,
 completed_at=now(),updated_at=now(),lease_owner=NULL,lease_token=NULL,lease_until=NULL
 WHERE id=p_id AND state='leased' AND lease_owner=p_worker AND lease_token=p_token;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.zoo_ops_events(ticket_id,event,worker,receipt_url) VALUES(p_id,'completed',p_worker,p_test_url);
 INSERT INTO public.zoo_ops_outbox(ticket_id) VALUES(p_id);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.zoo_ops_not_started(p_id text,p_worker text,p_token uuid,p_evidence text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_evidence !~ '^https://[^ ]{1,1000}$' THEN RAISE EXCEPTION 'native non-execution receipt required'; END IF;
 UPDATE public.zoo_ops_tickets SET state=CASE WHEN attempts>=max_attempts THEN 'blocked' ELSE 'queued' END,
 failure_receipt=p_evidence,lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE id=p_id AND state IN ('leased','uncertain') AND lease_owner=p_worker AND lease_token=p_token;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.zoo_ops_events(ticket_id,event,worker,receipt_url) VALUES(p_id,'not_started',p_worker,p_evidence);
 INSERT INTO public.zoo_ops_outbox(ticket_id) VALUES(p_id);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.zoo_ops_quarantine_expired()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 WITH moved AS (UPDATE public.zoo_ops_tickets SET state='uncertain',updated_at=now()
 WHERE state='leased' AND lease_until<now() RETURNING id,lease_owner)
 INSERT INTO public.zoo_ops_events(ticket_id,event,worker)
 SELECT id,'lease_expired_uncertain',lease_owner FROM moved;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

-- Durable wake-up lease. The external consumer is NOT deployed by this migration.
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_claim()
RETURNS TABLE(id bigint,ticket_id text,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.zoo_ops_outbox%ROWTYPE;
BEGIN
 SELECT x.* INTO o FROM public.zoo_ops_outbox x WHERE x.state='pending' AND x.next_at<=now()
 ORDER BY x.id FOR UPDATE OF x SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.zoo_ops_outbox x SET state='leased',attempts=x.attempts+1,
 lease_token=gen_random_uuid(),lease_until=now()+interval '30 seconds'
 WHERE x.id=o.id RETURNING x.* INTO o;
 RETURN QUERY SELECT o.id,o.ticket_id,o.lease_token;
END $$;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_ack(p_id bigint,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.zoo_ops_outbox SET state='acked',lease_token=NULL,lease_until=NULL
 WHERE id=p_id AND state='leased' AND lease_token=p_token;
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.zoo_ops_outbox_recover()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 UPDATE public.zoo_ops_outbox SET state=CASE WHEN attempts>=4 THEN 'dead' ELSE 'pending' END,
 next_at=now()+interval '30 seconds',lease_token=NULL,lease_until=NULL
 WHERE state='leased' AND lease_until<now();
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

DO $$ DECLARE signature text; BEGIN
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'zoo_ops_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);
 END LOOP;
END $$;
COMMIT;
