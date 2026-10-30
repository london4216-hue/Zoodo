# Permanent Zoo owner rule — dashboard accountability

The single owner-facing status surface is https://zoo-live-dashboard.netlify.app/dashboard/ . Routine automation reports must return only this URL. Exceptions: critical failures or decisions requiring owner action must be surfaced accurately.

The dashboard must show live elapsed time since the most recent verified substantive code change, with a 5-minute escalation threshold. It must never claim progress from refreshes, empty commits, or fabricated events. Record GitHub commits, actual test and CI evidence, independent verdicts, and unknown/unavailable signals distinctly. A dashboard warning does not prove that autonomous recovery was triggered.

Each available autonomous execution must advance real engineering and tests, recover from blocked agents without bypassing independent judgment, and provide verifiable evidence. The current hourly ChatGPT automation cannot itself guarantee a five-minute recovery interval; such a service must be separately implemented, deployed, and tested before claiming it works.

This is an enduring owner directive, not a release gate or an instruction to lower existing safety/security standards.
