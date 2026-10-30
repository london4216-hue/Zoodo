# Zoo no-stop dispatch and independent audit contract

Status: DESIGN / IMPLEMENTATION REQUIRED. This document is not evidence of running agents.

## Invariants
- No failed ticket may idle the entire queue. A NO-GO blocks only the unsafe artifact.
- Never replace a judge merely to obtain approval. Independent reviewers must see the same evidence and pass the same gates.
- No agent may claim running without a provider-confirmed job ID, start timestamp, lease and heartbeat.
- Never mark a deployment live without an HTTP probe and build provenance. Never claim work completed from a scheduled automation trigger alone.
- On worker failure, expire its lease, atomically requeue its ticket, assign a compatible available worker, and let unrelated tickets proceed. Avoid concurrent duplicate execution with fencing tokens and idempotency keys.
- If no compatible provider is available, move ticket to BLOCKED_CAPACITY, assign a separate provider-provisioning task, and keep other tickets running. Escalate an honest capacity alarm; do not fake an active worker.

## Parallel lanes / roles
| Lane | Role | Concurrency | Fallback |
| --- | --- | --- | --- |
| A | Product UI/assets MyBlock and YB3 | bounded by provider quotas | alternate builder |
| B | Platform and real-time dispatcher | bounded by provider quotas | alternate builder |
| C | Tests, CI, and reliability | bounded by provider quotas | alternate builder |
| D | Security and release validation | bounded by provider quotas | alternate builder |
| E | Independent architecture and root cause | distinct from builder | independent qualified reviewer |
| F | Independent judge | one hourly audit plus event-driven review | qualified independent reviewer; no judge-shopping |

Providers (Copilot, Claude, DeepSeek, Grok, Perplexity) are candidates only, NOT connected or running unless credentials, API support and job IDs are verified. An API provider may be research-only and not a coding agent. No paid API calls without authorized budget.

## NO-GO state machine
1. NO_GO_1: preserve failing evidence, dispatch repair to different qualified builder.
2. NO_GO_2: independent architecture/root-cause review and alternate plan, assign distinct builder.
3. NO_GO_3: decide bounded disposition automatically: split/redesign when safe, otherwise quarantine artifact. Reassign available workers immediately to eligible work. If owner approval needed, hold that artifact only.
4. Count by canonical root-cause fingerprint to prevent reset by PR rename. Repeated no-progress retries trip a circuit breaker; do not retry endlessly.

## Durable telemetry and proof
For each ticket: ticket ID, project, priority, provider, provider job ID, worker ID, lease token, last heartbeat, attempt, root cause, judge verdict, CI run URL, commit SHA, test results, deployment probe, timestamps and event-to-dispatch latency. Dashboard must render UNKNOWN when telemetry absent, STALE when heartbeat expired, and VERIFIED only for individually supported facts.

## Required acceptance tests
- Two independent tickets in parallel; A fails, B continues.
- Simulate worker crash, lease expiry and exactly one reassignment.
- Three NO-GO decisions reach bounded disposition, not infinite retry.
- No compatible workers: blocked-capacity alert but other lanes continue.
- Independent judge rejects self-review; invalid approval never merges.
- Evidence dashboard shows UNKNOWN on missing API/expired heartbeat; never converts scheduled runs into agent uptime.
- Capture actual GitHub workflow run IDs and real deployment probe results before claiming operational.

## Independent external audit
Invite Perplexity or Grok only through an authenticated available connector/API; none should be claimed consulted until a request and answer are recorded. Alternative independent reviewers may be used if verified available and separate from implementation lineage.
