# Dashboard change verification

Canonical source before edits: public london4216-hue/Zoodo branch autonomous-engine-replacement-2026-10-29, commit 420c8ff71e2cebe900a1596dccda1b994ea91de9. PR #16 is the original accountability repair; PR #95 records live branch mapping. Production build-proof.json is currently 404, so exact production deploy SHA remains unverified.

## Existing flows to preserve
- Open dashboard desktop 1440 and mobile 375: ZOO Execution Proof, priority/restoration lanes, accountability owners, four distinct KPIs.
- Refresh now: retry source evidence and scheduler evidence, retain truthful UNKNOWN/error states rather than inventing activity.
- Open recovery handoffs and independent hosting details: show receipts and disconnected mirrors without claiming deployment.
- Quick links/needs verification: retain all owner destinations and allow opening the original URLs; stale links remain in repair area.
- Labs: preserve My Block and Yearbook local routes and source fallback links.
- Work queue, commits and workflow executions: retain source panels and explicitly unverified heartbeat.

## New review evidence checks
- Independent panel adjacent to accountability, preserving original design and legacy proof source.
- Sanitized public GET feed only, no credentials or raw report in browser.
- Every 15 minutes is review cadence; browser polling every 30 seconds is not work.
- Latest completion and test counts separate scheduler execution from review success.
- Missing feed/latest: UNKNOWN. HTTP/malformed/regressing feed: connection warning, retain clearly qualified last receipt.
- Stale over 35 minutes, future timestamps and impossible timestamp order cannot show passing/current.
- Review failed/needs attention, skipped overlap and task failure are distinct from pass.
- Other assets, agent health, completed PRs/fixes remain unverified; no scheduler ticks fabricate outcomes.
- Source commit visible as receipt identity, not public private-repository file contents.
- Desktop/mobile screenshots, no new JS errors or horizontal overflow; same-page desktop/mobile/desktop resizing.
- Test unavailable feed and regressing snapshot; test stale and malicious string content safely rendered as text.
- Mirror inventory includes every imported review/source/poll module.

## Baseline browser observations
- Live page title ZOO | Execution Proof, 42 links, no page errors during initial render.
- Mobile document scrollWidth 375 at viewport 375.
- Screenshots stored outside deployment at /tmp/r/dashboard-pre-desktop.png and /tmp/r/dashboard-pre-mobile.png.
- External target availability and authenticated owner access are not proved by this UI test.
