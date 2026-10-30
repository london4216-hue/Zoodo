# Fixed-task cross-role benchmark — owner intent
Recorded 2026-10-29. This is a benchmark protocol, not evidence of a completed benchmark.

## Objective
Run the **same fixed task** repeatedly across every eligible AI agent/provider/model, rotating each through builder, repairer, reviewer, judge and recovery roles. Compare actual results, costs, elapsed time, independently verified correctness, evidence quality, and claim-to-proof gaps, with UTC timestamps. Repeat at a fixed cadence and after material agent/model changes, tracking longitudinal deltas against the initial baseline.

## Canonical task
In a clean isolated fixture, implement and/or repair a tiny deterministic task queue processor that: (1) processes tasks in stable order, (2) retries one transient failure once, (3) never marks a failed task successful, (4) records timestamped redacted events, and (5) passes hidden negative and positive tests. Freeze fixture version, task statement, acceptance criteria, dependency versions, time/token budget and evaluator tests per benchmark version.

## Fair comparison
Each model receives identical task inputs and equivalent available tools, limits and context per role. For review/judge, provide the same deliberately seeded correct and incorrect commits, blinded to builder identity. For repair, give the same failing fixture and test evidence. For recovery, provide the same scripted refusal/timeout/tool-error sequence. Rotate order to reduce caching or time-of-day effects. Keep distinct per-role rankings, not one global winner. Separate sandbox work from production. Never feed another agent's private chain of thought or secrets to participants.

## Scorecard per run
Record benchmark_version, timestamp_utc, agent/provider/model/tool, role, task_hash, fixture_hash, commit_sha, wall_time_ms, tokens, observed_cost_usd (or unknown), tests_passed, defects_detected, false_approval, evidence_uri, claim_vs_verified_result, retries, recovery_time_ms, and independent verifier identity. Preserve raw event links, evaluator version, sample size and uncertainty. Never interpret an unsupported success claim as a deliberate lie without proof of intent.

## Reporting
Only autonomy scoreboard, outstanding tickets, speed KPIs, and per-agent/tool role benchmark table with baseline-vs-current gap. Do not count simulations as real provider results. A benchmark cannot block building the engine; implement it alongside the working vertical slice. No secret access.
