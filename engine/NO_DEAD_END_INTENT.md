# No-dead-end decision and recovery rule
Owner intent, 2026-10-29. Applies to isolated, zero-production-impact engine development and benchmark tasks.

An agent's refusal, non-choice, indecision, timeout, unsupported assertion, tool failure or unavailable provider must never silently terminate eligible work. The orchestrator records the event and must select an executable next action: retry within a budget, switch agent/provider, decompose the task, choose a safe alternate method, or park only the blocked task while advancing other queued work. Every such transition must be timestamped, linked to evidence, and included in per-agent failure/recovery KPIs. Record choices and rejected alternatives so learning can improve future routing.

No arbitrary escalation to the owner for routine obstacles. Use finite retry budgets, cycle detection, deadlines and durable handoffs to avoid infinite loops; record a blocked state with an actionable reason if all authorized safe routes are exhausted, while other tasks continue. Never fabricate progress or force an approval when evidence fails.

**Non-negotiable boundaries:** never bypass authorization, secrets restrictions, independent verification, security controls, external safety limits, or production protections. 'No choice' is prohibited as an unrecorded dead end, not a mandate to violate these boundaries.

Measure no-choice incidence, alternative selected, time-to-next-action, successful recovery rate, stalled minutes and avoided owner escalations. Compare against fixed benchmark fixtures over time. This is a design rule, not proof it is implemented.
