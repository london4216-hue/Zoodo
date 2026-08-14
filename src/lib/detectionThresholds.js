// Detection thresholds (spec): >=75% auto-pass; 50–74% caregiver confirm;
// <50% retry with simplified demo. After two failed attempts, switch to the
// simplified editorial variant (slower tempo, clearer enunciation).

export const AUTO_PASS = 75;
export const CAREGIVER_CONFIRM_MIN = 50;

export function classifyConfidence(confidence) {
  const c = Number(confidence) || 0;
  if (c >= AUTO_PASS) return 'pass';
  if (c >= CAREGIVER_CONFIRM_MIN) return 'caregiver_confirm';
  return 'retry';
}

// Returns the next action given a confidence and the current attempt count.
//   action: 'celebrate' | 'caregiver_confirm' | 'retry' | 'simplified_retry'
export function detectionDecision(confidence, attemptCount = 0) {
  const result = classifyConfidence(confidence);
  if (result === 'pass') return { action: 'celebrate', result };
  if (result === 'caregiver_confirm') return { action: 'caregiver_confirm', result };
  const useSimplified = attemptCount >= 2;
  return { action: useSimplified ? 'simplified_retry' : 'retry', result, useSimplified };
}