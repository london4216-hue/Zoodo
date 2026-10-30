# ZOO architecture review — evidence-led execution (2026-10-30 UTC)

**Status:** pilot implementation in progress, not an autonomous army deployment. Owner intent: [18 isolated environments](ZOO_18_COMPANIES_ARCHITECTURE_INTENT.md), [nonblocking product readiness measurement](PRODUCT_LIVE_DEMO_B_GOLD_KPI_INTENT.md). This record is an engineering decision, not a release authorization.

## Verified baseline and collision avoidance
- Owner work tracking: [Zoodo #7](https://github.com/london4216-hue/Zoodo/issues/7), [TransendIQ #999](https://github.com/london4216-hue/TransendIQ/issues/999), [#1004](https://github.com/london4216-hue/TransendIQ/issues/1004), [#1005](https://github.com/london4216-hue/TransendIQ/issues/1005), [#1007](https://github.com/london4216-hue/TransendIQ/issues/1007). Existing recovery PRs must not be overwritten or merged by this pilot.
- [Zoodo PR #6](https://github.com/london4216-hue/Zoodo/pull/6) is draft, on `autonomous-engine-replacement-2026-10-29`; [PR #5](https://github.com/london4216-hue/Zoodo/pull/5) is a separate draft exact-commit-review fix. No independent review submissions found on either at inspection. PR #5 had [successful CI run 40981801213](https://github.com/london4216-hue/Zoodo/actions/runs/40981801213), but its exact-review changes are NOT assumed merged into PR #6.
- PR #6 head `97b9ce8f5b5216494051e27d0a01d9fd9952f5a2` had three **failed** CI runs: [41014729580](https://github.com/london4216-hue/Zoodo/actions/runs/41014729580), [41014729524](https://github.com/london4216-hue/Zoodo/actions/runs/41014729524), [41014729393](https://github.com/london4216-hue/Zoodo/actions/runs/41014729393). Job log retrieval returned BlobNotFound and step summaries were empty; failure root cause **unknown**, not assumed a test failure. Retest after new commits and inspect via GitHub UI.
- The central [Zoo dashboard](https://zoo-live-dashboard.netlify.app/) was not HTTP-verified this run: web fetch failed and this worker's container DNS cannot resolve the host. That is an **unverified host**, not proof of an outage or a healthy deployment.
- TransendIQ source paths found: `apps/myblock/source/README.md`, `apps/myblock/ops/system-intent.md`, `apps/yearbook3/source/README.md`, `apps/movemint/source/README.md`, `apps/letshelp/source/README.md`, `apps/ez-move-ai/`. My Block/YB3 Figma fidelity unverified; original SOWs are intentionally held private, never copied to a public host. MoveMint/Let's Help source records were learn-only at source date, not permission for production releases.
- The inventory records **18 owned repo identities**, **16 safe root inspections** and **2 secret-sensitive excluded**. A root inspection is not a working company deployment or test.

## Root causes and ranked remedies
1. **No authoritative distributed worker:** an hourly ChatGPT task and GitHub issues cannot maintain continuous occupancy. Pilot a durable queue state machine and tests now; move to transactional backing store and event-driven dispatch only with authorized runner credentials.
2. **No real cross-provider review receipts:** a declared reviewer or a CI job is not an independent AI reviewer. Keep exact SHA + distinct provider mandatory; never self-approve or shop after an explicit rejection. PR #5 must be independently assessed and integrated through governance.
3. **CI visibility broken/unresolved:** three failures with missing downloadable logs. Restore observable Actions results before claiming a passing PR; do not use a green local test as a substitute for GitHub CI.
4. **Dashboard evidence freshness and deployment uncertain:** expose unknown health, real last commit and queue evidence; deploy only with supported credentials and verify HTTP + functional walk. Coordinate host repair with TransendIQ #999.
5. **Product UI assets incompletely mapped:** My Block/YB3 synthetic labs exist in Zoodo PR #6, but live functional walks, original Figma comparison, grade, and release readiness are unknown. Work on real bounded journeys; never infer full-product completion.
6. **No provider availability telemetry:** Github connector read/write works; no confirmed direct Claude, DeepSeek, Copilot or CodeRabbit dispatch in this run. Assign tickets only to providers with verified invocation capability; record unknown costs.
7. **Cross-repository scale not proven:** each of 18 environments requires isolated permissions, test command and independently verified execution before acceptance. No cross-company secrets ingestion.

## Seven implementable options (complementary, not seven invented expert votes)
| Option | Implementation and verified license | Tradeoff / next action |
|---|---|---|
| 1. GitHub Issues + Actions | Existing GitHub infrastructure, event-triggered queue worker on approved default branch | Lowest migration cost; limited concurrency, rate limits, CI currently failing; no persistent daemon. Implement after observable CI restored. |
| 2. Single-writer JSONL queue pilot | `engine/src/durable-queue.mjs`, Node built-ins, no third-party runtime dependency | Cheap and testable, restart replay and leases; **not safe for multiple writers** or an always-on hosted worker. Implemented as isolated pilot only. |
| 3. BullMQ + Valkey | [BullMQ MIT](https://github.com/taskforcesh/bullmq) + [Valkey BSD-3-Clause](https://github.com/valkey-io/valkey) | Distributed leases/queue; requires secured persistent service, backup and operations; infra spend unknown. Prototype in disposable environment before adoption. |
| 4. Temporal self-hosted | [Temporal server MIT](https://github.com/temporalio/temporal) | Durable workflow history and retries; heavier operational complexity, DB, upgrades, and host cost. Evaluate if queue scale justifies it. |
| 5. Gitea mirror + Actions | [Gitea MIT](https://github.com/go-gitea/gitea) | Self-hosted fallback for code/CI; mirror credentials, governance divergence and cost. No automatic replacement of GitHub authorized originals. |
| 6. Coolify isolated preview hosting | [Coolify Apache-2.0](https://github.com/coollabsio/coolify) | Self-hostable preview deployments and rollback controls; requires host, secrets handling, TLS and authorization. No production deployment attempted. |
| 7. Evidence-only dashboard + release probes | GitHub read-only APIs and verified deployed HTML/JS smoke checks | Cheap and portable; public API rate limits and CORS; no worker activity implied by polling. Coordinate with #999. |

**Provider panel provenance:** GitHub connector was actually used for repository/issue/PR/CI reads and source writes. Copilot, DeepSeek, Claude and CodeRabbit were **NOT CONSULTED** in this run; no direct API invocation or independent proposals claimed. External FOSS project license evidence comes from the linked upstream repositories, not model votes. No claim of 1,000 engineers.

## Risk register
| Risk | Severity | Control |
|---|---|---|
| Duplicate execution / concurrent JSONL writers | Critical | Single-writer pilot only; production requires transactional claim/lease, idempotency and fencing |
| False green from missing reviewer or wrong commit | Critical | Exact 40-character commit SHA, distinct reviewer provider, explicit verdict and tests |
| Unapproved merge/deploy | Critical | Release proof required; no automatic production write in pilot |
| Secrets leaking across 18 repos | Critical | Per-repo scopes; exclude sensitive repositories; no cross-tenant data copies |
| CI outage, inaccessible logs | High | Preserve run IDs, do not claim passing; investigate runner configuration |
| Worker lease expiry during long job | High | Heartbeats, bounded attempts, requeue/dead-letter with retained events |
| Host broken or stale | High | HTTP and functional checks; show UNKNOWN when unverified |
| Cost explosion | Medium | Bounded retries and job budgets; unknown actual API spend remains unknown |

## Executed pilot and acceptance boundary
- Added `engine/src/durable-queue.mjs`: append-only restartable journal, idempotent ticket creation, lease/heartbeat, expiry recovery, bounded retries, distinct-provider exact-commit review, test gate, explicit release proof and terminal states.
- Added `engine/test/durable-queue.test.mjs`: nine positive/negative tests. **Local Node v22.16.0 run: 9/9 pass**. This includes simulated worker loss and a simulated independent review. **No real provider was invoked by those tests**.
- New GitHub CI results and real independent reviewer are required before marking the code verified. The simulated end-to-end state machine is **not** an end-to-end autonomous ticket delivery.
- No real production merge, deployment, provider installation, multi-repo test sweep, or dashboard verification occurred in this pilot.

## Next non-overlapping tickets
- **Zoodo #7 / queue:** confirm GitHub Actions green for exact head, add transactional queue backend and GitHub issue event worker after permissions are verified; maintain one active issue per feature.
- **Zoodo PR #5 / review:** independent exact-head review, fix negatives, integrate through original governance. Do not bypass by claiming PR #6 has the changes.
- **TransendIQ #999 / host:** verify dashboard and each demo URL with actual HTTP + functional checks, repair deploy routing; do not duplicate Zoo queue work.
- **TransendIQ #1007 / architecture:** request real independent provider reviews only through proven integrations; append actual responses, no invented panel votes.
- **My Block / YB3 labs:** continue bounded synthetic mobile journeys and tests from existing source, then independently review and host/verify; readiness percentages remain unknown.
- **Other owned projects:** record real test commands and actual CI runs one repo at a time. Excluded secret repos remain excluded.

**Costs, per-agent idle time, speed, real failover latency, deployment health and all product readiness percentages remain UNKNOWN until measured.**

## Subsequent asset-first increment (same run)
- Added `engine/dashboard/labs/yearbook3/logic.test.mjs`: eight deterministic synthetic YB3 student-journey cases (consent required, input limits, immutable submission, safe restoration and no forged identity). Local Node v22.16.0: **8/8 YB3 + 9/9 durable queue = 17/17 new tests passed**. Existing project-wide CI remains unverified.
- Updated `.github/workflows/zoo-lab-tests.yml` to execute YB3 tests and trigger on engine source changes.
- At exact commit `d87574851878d24cc8627b62c33b28dac4ecd63a`, three further Actions runs failed: [41015118983](https://github.com/london4216-hue/Zoodo/actions/runs/41015118983), [41015119069](https://github.com/london4216-hue/Zoodo/actions/runs/41015119069), [41015119049](https://github.com/london4216-hue/Zoodo/actions/runs/41015119049). All returned null step summaries and BlobNotFound on log retrieval; **cause unknown**. GitHub combined status showed a successful Netlify deploy-preview status, but HTTP/functional health remained unverified.
- **No** independent provider judged the new YB3 tests or the queue implementation. No product readiness percentage or live YB3 URL is claimed.
