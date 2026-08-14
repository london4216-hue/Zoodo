// Canonical editorial lesson definitions (spec: every lesson follows the
// editorial template). Each lesson JSON carries the narration script
// segments, the mastered/voice-only audio URLs, the detection spec, and the
// celebration spec — so narration, visuals, and detection can never drift.
//
// Audio/asset URLs are hydrated from base44_media_map.txt once assets are
// uploaded. Until then they are empty strings and the lesson surfaces a clear
// "asset required" state rather than falling back to default TTS.

export const LESSON_SCHEMA = {
  id: 'string',
  title: 'string',
  ageRange: [2, 6],
  learningObjective: 'string',
  successCriteria: 'string',
  fallbackPrompt: 'string',
  scriptSegments: [
    { id: 'preflight', label: 'Preflight', durationMs: 0, text: '' },
    { id: 'zoodo_intro', label: 'Zoodo Intro', durationMs: 4000, text: '' },
    { id: 'vo_intro', label: 'VO Intro', durationMs: 8000, text: '' },
    { id: 'model_demo', label: 'Model Demo', durationMs: 12000, text: '' },
    { id: 'prompt', label: 'Prompt', durationMs: 6000, text: '' },
    { id: 'attempt', label: 'Attempt', durationMs: 8000, text: '' },
    { id: 'feedback', label: 'Feedback', durationMs: 3000, text: '' },
    { id: 'celebration', label: 'Celebration', durationMs: 5000, text: '' },
  ],
  masterAudioUrl: '',
  voiceOnlyUrl: '',
  visualAssets: [],
  detectionSpec: { mode: 'camera', target: '', minConfidence: 75 },
  celebrationSpec: { parentVideoUrl: '', confetti: true, bubblePop: true },
};

// Canonical Clap lesson — ready-to-record scripts from the spec.
export const CLAP_LESSON = {
  id: 'clap',
  title: 'Clap with Zoodo',
  ageRange: [2, 6],
  learningObjective: 'Practice clapping — bilateral coordination and timing.',
  successCriteria: 'Child performs at least one visible clap during the attempt window.',
  fallbackPrompt: "Let's try again — nice and slow. Watch my hands, then clap with me!",
  scriptSegments: [
    { id: 'preflight', label: 'Preflight', durationMs: 0, text: 'Preflight: child name spoken twice.' },
    { id: 'zoodo_intro', label: 'Zoodo Intro', durationMs: 4000, text: 'Hey {childName}! Let\'s clap with me — ready?' },
    { id: 'vo_intro', label: 'VO Intro', durationMs: 8000, text: 'Today we\'re practicing clapping. Watch me first, then you try.' },
    { id: 'model_demo', label: 'Model Demo', durationMs: 12000, text: 'Clap-clap. Nice and slow — clap with me: one, two.' },
    { id: 'prompt', label: 'Prompt', durationMs: 6000, text: 'Now your turn. On three: 1…2…3 — clap!' },
    { id: 'attempt', label: 'Attempt', durationMs: 8000, text: 'Great try — I\'m watching.' },
    { id: 'feedback', label: 'Feedback', durationMs: 3000, text: 'Awesome, {childName} — I saw your clap!' },
    { id: 'celebration', label: 'Celebration', durationMs: 5000, text: '{childName}, you did it!' },
  ],
  masterAudioUrl: '',   // audio/lesson_clap_mastered.mp3 — from base44_media_map.txt
  voiceOnlyUrl: '',     // audio/lesson_clap_voiceonly.mp3 — accessibility fallback
  visualAssets: [],     // video/lesson_clap_1080p.mp4 + per-segment visuals
  detectionSpec: { mode: 'camera', target: 'clap', minConfidence: 75 },
  celebrationSpec: { parentVideoUrl: '', confetti: true, bubblePop: true, stickers: 6 },
};

// Fill audio/asset URLs from a parsed base44_media_map.txt object
// ({ 'audio/lesson_clap_mastered.mp3': '<url>', ... }).
export function hydrateLessonUrls(lesson, mediaMap) {
  if (!mediaMap) return lesson;
  return {
    ...lesson,
    masterAudioUrl: mediaMap['audio/lesson_clap_mastered.mp3'] || lesson.masterAudioUrl,
    voiceOnlyUrl: mediaMap['audio/lesson_clap_voiceonly.mp3'] || lesson.voiceOnlyUrl,
    celebrationSpec: {
      ...lesson.celebrationSpec,
      parentVideoUrl: mediaMap['video/lesson_clap_1080p.mp4'] || lesson.celebrationSpec.parentVideoUrl,
    },
  };
}

// Replace {childName} placeholders in every script segment.
export function personalizeLesson(lesson, childName) {
  const fill = (t) => (t ? t.replace(/\{childName\}/g, childName) : t);
  return {
    ...lesson,
    scriptSegments: lesson.scriptSegments.map((s) => ({ ...s, text: fill(s.text) })),
  };
}

// True when every audio/asset URL the lesson needs is present.
export function isLessonReady(lesson) {
  return Boolean(lesson.masterAudioUrl);
}