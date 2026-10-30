# Autonomous engine baseline scorecard
Baseline date: 2026-10-29 UTC. This is an initial evidence-coverage baseline, not proof of a running autonomous engine.

## Operating intent
Send the owner **only** the current autonomy scoreboard, outstanding actionable tickets, speed KPIs, and a per-agent/tool scorecard. Track every current and future agent/tool independently; preserve dated snapshots so performance and cost improve over time. Never use claims as verification. Never read, display, copy or change secrets. Original TransendIQ governance remains untouched.

## Autonomy milestones
| Metric | Baseline status | Evidence |
|---|---|---|
| GitHub write | VERIFIED | Branch and engine source commits |
| Engine scaffold | VERIFIED | engine/src/engine.mjs |
| Builder fallback | IMPLEMENTED, LIVE UNVERIFIED | engine source |
| Independent provider approval | IMPLEMENTED, LIVE UNVERIFIED | engine source |
| Timestamped events | IN-MEMORY ONLY | engine source |
| Durable KPI ledger | NOT IMPLEMENTED | no durable writer |
| Real provider dispatch | NOT VERIFIED | no live receipts |
| Automated PR / merge | NOT VERIFIED | no merged autonomous PR receipt |
| Continuous self-recovery | NOT VERIFIED | no end-to-end evidence |

## Ticket backlog (initial)
1. P0: Durable append-only event log with safe redaction and replay.
2. P0: Real agent/provider adapters, bounded timeouts and failover.
3. P0: Independent exact-commit review and negative verdict handling.
4. P0: GitHub issue/PR lifecycle with explicit authorization and receipts.
5. P0: End-to-end autonomous cycle proven without owner intervention.
6. P1: Measured token, API and infrastructure costs, with unknown distinctly marked.
7. P1: Per-agent speed/quality/false-green and recovery KPI aggregation.
8. P1: Matched-task agent routing, learning, rollback and longitudinal snapshots.

## Per-agent/tool ledger schema
Each invocation: timestamp_utc, task_id, agent_id, provider, model, tool_id, role, commit_sha, event_type, wall_time_ms, input_tokens, output_tokens, measured_cost_usd, cost_confidence, claim, independently_verified_outcome, evidence_url, failure_reason, recovery_ms, ticket_id. Null means unknown, **never zero**.

## Baseline metrics
- Completed end-to-end autonomous cycles: **0 verified**.
- Autonomous task throughput/hour: **unknown** (no verified observation window).
- Median/p95 task lead time: **unknown**.
- Mean time to recovery: **unknown**.
- Total real agent spend: **unknown**.
- Per-agent rankings: **insufficient verified data**.
- Outstanding implementation tickets: **8 baseline tickets** (above; planning inventory, not GitHub Issues).
- Prototype tests: **not verified run against this branch**.
- Baseline agent/tool roster: **unmeasured** until observed invocations with stable identifiers; do not invent activity.

## Reporting contract
Every report contains only (1) autonomy milestones with evidence, (2) outstanding tickets and what changed, (3) throughput/lead-time/recovery KPIs with observation window, and (4) agent/tool cost, speed, quality, claims-vs-proof and evidence coverage. Timestamp every snapshot. Compare to the preceding snapshot; mark missing values unknown. Keep all credentials and secrets out of telemetry and email. No narrative filler.
