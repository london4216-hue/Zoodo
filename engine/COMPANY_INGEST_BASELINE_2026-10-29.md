# Zoo company ingestion baseline — 2026-10-29
Verified via authenticated GitHub root directory reads. This is **inventory testing**, not a successful application test or deployment. No secrets or private credential content inspected.

| Repository | Root inspection | Visible testing/config evidence |
|---|---|---|
| ez-move-ai | readable | tests/, playwright.config.js, .github/ |
| Smartvalue | readable | package.json; no root tests/ |
| Zoodo | readable | package.json; engine on separate working branch |
| edupath-ai-copy-copy | readable | package.json; no root tests/ |
| edupath-ai-copy | readable | package.json; no root tests/ |
| Beautyworld | readable | README only |
| TransendIQ | readable | tests/, playwright.config.js, .github/, ENTERPRISE_CONSTITUTION.md |
| beauty-world-staging | readable | tests/, playwright.config.js, .github/, ENTERPRISE_CONSTITUTION.md |
| transcendiq2-site | readable | index.html, CNAME |
| zoomade | readable | beautypath/, edupath-ai-copy/, ez-move-ai/, smartvalue/, zoodo/ |
| wonup2 | readable | tests/, playwright.config.js |
| transcendiq-closet | readable | docs/, ops/, reviews/ |
| transend-closet-backup | readable | docs/, ops/, reviews/ |
| transend-closet-backup-2 | readable | docs/, ops/, reviews/ |
| transcendiq-workshop | readable | tests/, playwright.config.js, .github/, ENTERPRISE_CONSTITUTION.md |
| ezmove-lab | readable | tests/, playwright.config.js |

Two additional repository names exist but are excluded from content ingestion by design because their names suggest sensitive material: BASE44_READ_KEY and lj-secret-closet. They must not be opened or copied. Count: 18 total repository identities; 16 safe root inspections; 2 protected/excluded.

## Immediate test queue
P0: Run non-destructive CI/test workflows in independently isolated environments for each test-capable company; preserve raw receipts.
P0: Map zoomade/beautypath and actual Figma and intent documents to company environments before claiming UI fidelity.
P0: Validate the Zoo engine prototype with an actual Node test run and commit status.
P0: Inventory real CI scores and test command for each repository, never infer passing tests from presence of a tests directory.
P1: Compare self-hosted Coolify, Dokploy and CapRover as candidate isolated deployment layers using an actual disposable environment, without moving production or credentials.
P1: Establish longitudinal per-company scorecard and cross-provider agent KPI ledger.

## Evidence integrity
Unknown test result = UNKNOWN. Unknown score = UNKNOWN. Root directory inspection is not a clone, integration, or completed benchmark. Original governance remains untouched.
