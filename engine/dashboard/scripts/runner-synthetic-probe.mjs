// Bounded, zero-network host-execution qualification primitive.
// This does NOT certify scheduling, durable state, GitHub API access, secrets, or AI models.
import { createHash } from 'node:crypto';

export const PROBE_INPUT = 'zoo-independent-runner-probe-v1';
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

export function executeSyntheticProbe(input) {
  if (input !== PROBE_INPUT) throw new Error('synthetic probe input not allowlisted');
  const start = process.hrtime.bigint();
  const input_sha256 = sha256(input);
  const output_sha256 = sha256(`output:${input_sha256}`);
  const elapsed_ms = Number(process.hrtime.bigint() - start) / 1e6;
  return {
    task_type: 'bounded-sha256', input_sha256, output_sha256,
    elapsed_ms, network_calls: 0, external_model_calls: 0
  };
}
