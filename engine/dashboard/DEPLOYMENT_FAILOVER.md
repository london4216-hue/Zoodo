# ZOO dashboard — independent hosting and automatic recovery (2026-10-30)

This file is operating documentation, **not a certificate that another provider is deployed**.

## Authority and locations
- Canonical display source: Zoodo/engine/dashboard; private TransendIQ stores incident #1023 and sensitive receipts.
- Existing owner URL: https://zoo-live-dashboard.netlify.app/
- Source repair: Zoodo PR #16 (fix/zoo-live-dashboard-accountability-20261030); preserve the original owner navigation and links.
- Netlify: current primary hosting and automatic deploy previews; `netlify.toml` runs source tests.
- Vercel: independent mirror candidate; `engine/dashboard/vercel.json`.
- Render: independent mirror candidate; root `render.yaml`.
- Cloudflare Pages: independent mirror candidate; git build instructions below.
- Sole Keeper integrates; Dashboard Worker owns source/release; Agent Hunter is a different, qualified deployment-test backup.

## One-time service connections
The user has standing approval for ordinary, reversible changes. **Vendor OAuth / account authorization still has to be completed by an actual account holder or a connected service.** No user password, token or private employee code belongs in a public repository.

**Vercel**: Connect the user's GitHub `london4216-hue/Zoodo` repo, configure root directory `engine/dashboard`. The branch under test is `fix/zoo-live-dashboard-accountability-20261030`. The included `vercel.json` runs `node scripts/build-proof.mjs && node scripts/prepare-mirror.mjs` and publishes `mirror-dist`. Require a real preview status and check `/build-proof.json` and `/index.html`.

**Render**: Connect `london4216-hue/Zoodo` using `render.yaml` Blueprint. It runs the same two scripts with publish directory `./engine/dashboard/mirror-dist`. Select the intended branch for the provider and verify the service URL/commit. A new Render account/service may have costs: do not purchase a plan without owner authorization.

**Cloudflare Pages**: Link the same Git repository with project root `engine/dashboard`, build command `node scripts/build-proof.mjs && node scripts/prepare-mirror.mjs`, output directory `mirror-dist`. Pages injects `CF_PAGES_COMMIT_SHA`; the build writes the same read-only receipt. Git integration automatically builds branch previews and new commits.

Do not use the Zoodo Base44 app root as the dashboard publish directory: the dashboard is the separate `engine/dashboard` folder.

## Per-commit lifecycle
1. Changes arrive in a reversible branch.
2. Native provider builds automatically run *all registered source tests*; failure is nonterminal WIP with owner and backup.
3. Build script emits `build-proof.json` with source commit, test suite and timestamps. Provider B also builds from the exact same SHA, not from a copied UI.
4. Strict allowlist copies only dashboard HTML, evidence JS, verified-links registry, host registry, build proof, and the two isolated synthetic lab demos to `mirror-dist`. Do not publish repo secrets.
5. `node scripts/check-mirrors.mjs` checks live HTTP responses, build proof SHA match, dashboard page marker, and hosted synthetic lab HTML + JS. When a new provider URL is independently confirmed, record it in `hosting-mirrors.json`; until then URL remains null / NOT_CONNECTED.
6. Browser/mobile link checks and authenticated data/worker heartbeats are separate gates. A successful build or same-SHA mirror is not a passed functional walk.
7. When the first host fails, a **confirmed existing mirror address** can be offered immediately to the owner. Stable automatic domain rerouting requires a separate authorized DNS/edge health-routing connection (e.g. Cloudflare Load Balancing or Worker), tested against real outages. Do not claim automatic DNS cutover merely from JavaScript or a second URL.
8. Keep ZOO job queue, source, checkpoints, worker owners, backups and private receipts independent of hosts. A hosting outage must not cancel workers or erase progress.
9. Report completion only after actual deployed URL and exact SHA, owner-access check, real links, and independent evidence feed verification; otherwise WIP with next executable step.

## Current status at creation
- Netlify: primary and preview only.
- Vercel: NOT_CONNECTED.
- Render: NOT_CONNECTED.
- Cloudflare Pages: NOT_CONNECTED.
- GitHub Actions: jobs failing (not a usable sole CI gate).
- Netlify source-test build gate: configured; live/browser proof still requires verification.
- Independent monitor: executable `node scripts/check-mirrors.mjs` when at least one provider has a confirmed URL. It exits nonzero until **two** independent hosts pass. Schedule it on an independently hosted monitor after connecting that provider; a script in a repository is not a running schedule.

**Security:** this dashboard is publicly hosted static content. Do not place confidential TransendIQ evidence, patient/student data, tokens, or patent disclosures in its HTML or JSON. `build-proof.json` reports only public commit metadata and test class.
