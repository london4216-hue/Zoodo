# Permanent Zoo owner rule — dashboard accountability

The single owner-facing status surface is https://zoo-live-dashboard.netlify.app/dashboard/ . Routine automation reports must return only this URL. Exceptions: critical failures or decisions requiring owner action must be surfaced accurately.

The dashboard must show live elapsed time since the most recent verified substantive code change, with a 5-minute escalation threshold. It must never claim progress from refreshes, empty commits, or fabricated events. Record GitHub commits, actual test and CI evidence, independent verdicts, and unknown/unavailable signals distinctly. A dashboard warning does not prove that autonomous recovery was triggered.

Each available autonomous execution must advance real engineering and tests, recover from blocked agents without bypassing independent judgment, and provide verifiable evidence. The current hourly ChatGPT automation cannot itself guarantee a five-minute recovery interval; such a service must be separately implemented, deployed, and tested before claiming it works.

This is an enduring owner directive, not a release gate or an instruction to lower existing safety/security standards.

## Never-stop recovery rule

Never silently stop work because an agent, model, tool, workflow, or deployment fails. Detect failures, record truthful evidence, retry with bounded backoff, switch to an approved fallback, or move to the next independently actionable asset-first task. Keep the backlog actionable and the dashboard honest. Escalate only genuinely unresolvable blockers or required owner decisions. Do not fabricate progress, bypass security/independent judgment, or claim that a scheduled automation runs continuously. This is a persistent operating policy; achieving uninterrupted execution requires a deployed and monitored worker, not just this document.
