# ZOO independent shared ticket registry (source-only draft)

This registry lives in **Zoodo**, not TransendIQ. It inventories 10 authenticated open Zoodo issues and 11 open PRs as observed 2026-10-30T23:30:37.622Z. Each issue is one individual ticket; PRs are tracked separately and associated only when evidence supports a relationship. No private issue bodies, credentials, or model outputs are published.

## Atomic claim protocol (NOT YET HOSTED)

1. An authenticated worker reads a ticket JSON file on the designated registry branch using GitHub Contents API and records its exact **blob SHA**. Resolve dependencies from the same snapshot. A ready ticket with no live lease is eligible. Do not treat a PR as a claimed ticket.
2. Generate a cryptographically random lease ID; write `status=claimed`, `assigned_agent`, `claim_lease={holder,lease_id,acquired_at,expires_at}` with a 15-minute TTL via Contents API PUT with the **previous blob SHA**. HTTP 409/422 is a lost race: re-fetch and choose another eligible ticket, never overwrite blindly.
3. The claim is **not verified** until authenticated readback confirms the exact lease ID and new blob SHA. The host must serialize conflicting writes or use a database CAS transaction for stronger atomicity; GitHub per-file SHA alone is NOT a proven distributed lease under all concurrency races. Prove a simultaneous two-worker claim test before enabling unattended dispatch.
4. Heartbeat and renew by compare-and-swap with bounded retries. On expiry, mark recovering and require a fresh lease token. Builder works on its own branch; Keeper integrates tested PRs. Never infer a working builder/model from a scheduler event.
5. Every transition records attributable UTC action, source SHA, tests, provider request ID, and link to immutable receipt. Missing fields remain null/UNKNOWN. Completion webhook claims the next ticket only after idempotent acknowledgement; an hourly automation is a watchdog, not a 24/7 execution host.
6. Production publication, Netlify site mapping, third-party credentials, and private repository access remain protected. No hosted runner, external AI model, or two-ticket test has yet been demonstrated by this source commit.

## Sources and next proof

- [Canonical dashboard draft PR #16](https://github.com/london4216-hue/Zoodo/pull/16), [unattended watchdog #18](https://github.com/london4216-hue/Zoodo/issues/18), [source mapping #17](https://github.com/london4216-hue/Zoodo/issues/17), [relay architecture #8](https://github.com/london4216-hue/Zoodo/issues/8).
- Next: connect an authorized external event-driven host to a durable atomic store; run two concurrent claims, lease expiry/recovery, two-ticket NEXT handoff, hosted test receipts, and verify live dashboard publication. These remain UNKNOWN.
