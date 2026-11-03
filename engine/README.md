# Zoodo autonomous engine

First prototype: builder fallback, independent-provider exact-commit review, timestamped events, and per-agent measured/unknown cost counters.

Added (2026-11-03):
- Agent-wide manifest enforcement stub (`ops/manifest-enforcement.mjs`) with timestamp/admission checks + tests.
- Local unattended automation loop (`ops/local-automation-loop.mjs`) that runs without external Hatchet/Inngest/Trigger.dev runtimes + tests.
- GitHub Actions schedule (`.github/workflows/local-automation-loop.yml`) for periodic local loop ticks.

Run `cd engine && npm test` (or `node --test engine/test/*.test.mjs`) with Node 20+. These are local/simulated; not evidence of live external worker integrations.

Not yet implemented: durable event store, real provider adapters, GitHub issue dispatch, automatic merge, reviewer failover, billing reconciliation, authenticated Hatchet/Inngest/Trigger.dev activation. The existing Base44 app is preserved outside this folder while the engine is proven.
