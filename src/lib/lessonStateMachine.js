// LessonStateMachine — the single controlled state machine for the lesson flow.
// Spec: PREFLIGHT → ZOODO_INTRO → LESSON_PLAYBACK → CAPTURE → DETECTION →
// CELEBRATION → DASHBOARD. Each state only begins after the prior state has
// fully and cleanly finished.

export const STATES = {
  DASHBOARD: 'DASHBOARD',
  PREFLIGHT: 'PREFLIGHT',
  ZOODO_INTRO: 'ZOODO_INTRO',
  LESSON_PLAYBACK: 'LESSON_PLAYBACK',
  CAPTURE: 'CAPTURE',
  DETECTION: 'DETECTION',
  CELEBRATION: 'CELEBRATION',
};

// Allowed forward transitions. Anything not listed is rejected, so a buggy
// component can never skip a state or jump out of order.
const TRANSITIONS = {
  DASHBOARD: ['PREFLIGHT'],
  PREFLIGHT: ['ZOODO_INTRO', 'DASHBOARD'],
  ZOODO_INTRO: ['LESSON_PLAYBACK', 'DASHBOARD'],
  LESSON_PLAYBACK: ['CAPTURE', 'CELEBRATION', 'DASHBOARD'],
  CAPTURE: ['DETECTION', 'LESSON_PLAYBACK', 'DASHBOARD'],
  DETECTION: ['CELEBRATION', 'CAPTURE', 'LESSON_PLAYBACK', 'DASHBOARD'],
  CELEBRATION: ['DASHBOARD'],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

// Returns the next state, or throws if the transition is not allowed.
export function nextState(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lesson state transition: ${from} → ${to}`);
  }
  return to;
}

export const ORDER = [
  STATES.DASHBOARD,
  STATES.PREFLIGHT,
  STATES.ZOODO_INTRO,
  STATES.LESSON_PLAYBACK,
  STATES.CAPTURE,
  STATES.DETECTION,
  STATES.CELEBRATION,
];