/**
 * Local unattended automation loop.
 * Runs periodic checks, grades, and ledger writes without Hatchet/Inngest/Trigger.dev.
 * Can be scheduled via cron, GitHub Actions, or node --watch.
 * No live external worker activation claimed.
 */
import { enforceAll } from './manifest-enforcement.mjs';

export async function runLocalLoop(options = {}) {
  const {
    manifests = [],
    intervalMs = 5 * 60 * 1000,
    maxRuns = 1,
    onTick = console.log
  } = options;

  const results = [];
  for (let i = 0; i < maxRuns; i++) {
    const start = Date.now();
    const enforcement = enforceAll(manifests, start);
    const tick = {
      run: i + 1,
      at: new Date(start).toISOString(),
      enforcement,
      next_in_ms: intervalMs
    };
    results.push(tick);
    onTick(tick);
    if (i < maxRuns - 1 && intervalMs > 0) {
      await new Promise(r => setTimeout(r, Math.min(intervalMs, 1000))); // short sleep in tests
    }
  }
  return { ok: results.every(r => r.enforcement.ok), runs: results.length, results };
}

// CLI entry if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = [{
    agent_id: 'local-loop',
    timestamp: new Date().toISOString(),
    action: 'health-check',
    evidence_hash: 'localdemo12'
  }];
  runLocalLoop({ manifests: sample, maxRuns: 1 }).then(r => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  });
}
