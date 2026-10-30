# Zoodo autonomous engine

First prototype: builder fallback, independent-provider exact-commit review, timestamped events, and per-agent measured/unknown cost counters.

Run `cd engine && npm test` with Node 20+. These are simulated provider tests, not evidence of live model integrations.

Not yet implemented: durable event store, real provider adapters, GitHub issue dispatch, automatic merge, reviewer failover, billing reconciliation. The existing Base44 app is preserved outside this folder while the engine is proven.
