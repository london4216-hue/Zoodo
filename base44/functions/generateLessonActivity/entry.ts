import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

// ─────────────────────────────────────────────────────────────────────────
// System-wide tier-one speech-therapy persona + lesson-plan builder.
// Every lesson is treated like a real, high-dosage articulation therapy session.
// ─────────────────────────────────────────────────────────────────────────
const SPEECH_THERAPIST_PERSONA = `You are a world-class, tier-one pediatric speech-language pathologist (SLP) and the signature warm, musical teaching voice of EduPath AI. You work with toddlers (around 3 years old) and you treat every single lesson like a real, high-dosage articulation therapy session.

CLINICAL FRAMEWORK (tier-one articulation & phonological therapy):
- TARGET: Every lesson has ONE clear target. For Letters: one letter, its phoneme (sound), and one picture word that begins with that sound.
- AUDITORY BOMBARDMENT: Say the target sound/letter many times, clearly and slowly, BEFORE asking the child to produce it.
- PRODUCTION HIERARCHY ("I do -> we do -> you do"):
  1. MODEL: "Watch my mouth... AH." (exaggerated, slow)
  2. TOGETHER: "Let's say it together... AH."
  3. INDEPENDENT: "Your turn! Say AH!"
- SOUND ISOLATION: Teach the sound alone first ("Say AH") before attaching the word ("AH... apple"). Use the phrase "say AH like apple".
- TACTILE/KINESTHETIC CUES: Gently describe what the mouth does ("open your mouth wide", "lips smiling", "tongue down").
- REPETITIONS: Aim for many correct, spaced repetitions of the target sound and word.
- SPECIFIC PRAISE: Praise the specific attempt ("Great AH sound!"), not generic "good job".

VOICE & DELIVERY (warm, musical, human — never robotic):
- Soft, warm, friendly, with a smile in your voice. Musical sing-song rhythm.
- SLOW pacing: short phrases separated by "..." for natural breathing pauses.
- Pause gently after every model and every "your turn" so the child can respond.
- Gentle excitement while teaching; bright musical joy when celebrating.
- Use the child's name warmly and often.

RULES:
- Speak ONLY the exact words meant to be spoken aloud. Use "..." for pauses.
- No stage directions, no parentheses, no brackets, no notes, no spelling-out of symbols.
- Keep words tiny, sentences short, full of warmth.
- For Letters: always teach letter NAME -> SOUND -> WORD, e.g. "A... AH... AH-apple... say AH like apple!"
- For Numbers: count slowly, one number at a time, with the child.
- Always end with specific praise and a warm cheer.`;

const LESSON_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    script: { type: 'string' },
    letter: { type: 'string' },
    sound: { type: 'string' },
    word: { type: 'string' },
    camera_recommended: { type: 'boolean' },
  },
  required: ['title', 'script', 'camera_recommended'],
};

// Evidence-based targets per subject. The camera is never used for speech
// lessons (hardcoded off below), so these guides focus purely on pedagogy.
const SUBJECT_GUIDE = {
  'Numbers': 'Target: early numeracy using the counting principles (Gelman & Gallistel). For a young child focus on a SMALL set (start 1-3, build to 5). Teach in this order: (1) ROTE COUNTING — say the number sequence aloud; (2) ONE-TO-ONE CORRESPONDENCE — touch or tap one object for each number said ("touch... one... touch... two"); (3) CARDINALITY — after counting, emphasize the last number tells how many ("so there are THREE!"). Count slowly with the child using I-do/we-do/you-do, using fingers or visible objects. Set letter, sound, word to "".',
  'Letters': 'Target: the EXACT uppercase letter provided for today (do NOT pick a different letter). Pick ONE concrete, high-frequency picture word that begins with that letter\'s sound and where the sound is clear and isolated (A->apple, B->ball, C->cat, D->dog — avoid long or ambiguous words). Teach in order: letter NAME -> phoneme SOUND (e.g. "AH" for A) -> WORD. Use auditory bombardment (say the sound many times), then "say AH like apple" sound-isolation, then I-do/we-do/you-do production. Set word to the picture word.',
  'Outdoor activity': 'Target: sensory exploration and spatial/action vocabulary. Use rich sensory language (look, listen, feel) and spatial words (up/down/over/under/around). Teach one observable action with I-do/we-do/you-do (e.g. "stretch up high", "tip-toe"). Set letter/sound to "" and word to the key object if there is one.',
  'Music': 'Target: steady beat and rhythm. Teach call-and-response clapping/tapping to a steady beat. Use I-do/we-do/you-do ("watch me clap... together... your turn!"). Emphasize keeping a steady beat and copying a simple rhythm pattern. Set letter/sound to "" and word to the key object/instrument if there is one.',
  'Exercises': 'Target: a body-awareness movement (gross motor, bilateral coordination, or crossing midline). Teach "watch me -> together -> your turn" with clear, slow modeling, one movement at a time. Use body-part vocabulary (arms, legs, tummy). Set letter/sound to "" and word to the key object if there is one.',
};

function buildLessonPrompt(kidName, age, subject, dayLabel, currentLetter) {
  const guide = SUBJECT_GUIDE[subject] || `Target: ${subject}. Use I-do/we-do/you-do. Decide if a camera check would help verify the child's production.`;
  const letterDirective = subject === 'Letters' && currentLetter
    ? `The target letter for today is "${currentLetter}". Teach ONLY that letter — its name, its phoneme sound, and one picture word starting with that sound. `
    : '';
  return SPEECH_THERAPIST_PERSONA + '\n\n' +
    `Write a short, high-dosage speech-therapy spoken script (about 60-120 words) for a ${age}-year-old child named ${kidName}. ` +
    `It MUST open by naming the child: "Hi ${kidName}! ..." ` +
    `Today's theme is "${subject}" (${dayLabel}). ${letterDirective}${guide} ` +
    `Use the full I-do -> we-do -> you-do production hierarchy. Use auditory bombardment (say the target many times). Use specific praise. ` +
    `Keep it tiny-sentence, huge-warmth, sing-song. ` +
    `Return JSON with keys: title (2-5 word fun title), script (exact spoken words only), letter (target uppercase letter or ""), sound (target phoneme like "AH" or ""), word (the picture word or ""), and camera_recommended (true if a camera check would help verify the child's production or movement, false otherwise).`;
}

function picturePromptFor(word) {
  return `A bright, friendly, simple photograph of a single ${word} centered on a clean pure-white background, soft even lighting, sharp focus, children's speech-therapy flashcard style, no text, no people.`;
}

// ─────────────────────────────────────────────────────────────────────────
// TTS — premium ElevenLabs voice with built-in fallback.
// ─────────────────────────────────────────────────────────────────────────
const ELEVEN_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — warm, friendly female
async function synthesizeSpeech(base44, text) {
  const clean = (text || "").slice(0, 4500);
  const key = secrets.get("ELEVENLABS_API_KEY");
  if (!key) return await builtinTTS(base44, text);
  const customVoice = secrets.get("ELEVENLABS_VOICE_ID");
  const voiceId = (customVoice && /^[A-Za-z0-9]{16,}$/.test(customVoice)) ? customVoice : ELEVEN_VOICE_ID;
  let resp;
  try {
    resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text: clean,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true },
      }),
    });
  } catch (e) {
    console.warn('ElevenLabs fetch error — using built-in voice.', e?.message);
    return await builtinTTS(base44, text);
  }
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`ElevenLabs TTS failed (${resp.status}): ${detail.slice(0, 200)} — using built-in voice.`);
    return await builtinTTS(base44, text);
  }
  const buf = await resp.arrayBuffer();
  const file = new File([buf], "edu_speech.mp3", { type: "audio/mpeg" });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  if (!up || !up.file_url) throw new Error("UploadFile returned no file_url");
  return up.file_url;
}

async function builtinTTS(base44, text) {
  const res = await base44.asServiceRole.integrations.Core.GenerateSpeech({
    text: (text || '').slice(0, 5000),
    voice: 'honey',
  });
  if (!res || !res.url) throw new Error('Built-in TTS returned no audio url');
  return res.url;
}

// ─────────────────────────────────────────────────────────────────────────
// Tier-one speech-therapy lesson generator.
// Builds an articulation-therapy plan (target letter/sound/word + I-do/we-do/
// you-do script), narrates it, and — when the plan has a picture word —
// generates a clean photo of the target object so the child sees the real
// thing (e.g. a photo of an apple for the letter A). The plan flags whether a
// camera participation check would help verify the child's production, so the
// camera only launches when clinically useful.
// ─────────────────────────────────────────────────────────────────────────
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject || 'Numbers');
    const dayLabel = String(body.dayLabel || 'today');
    const kidName = String(body.kidName || 'friend');
    const age = Number(body.age) || 4;
    const currentLetter = (String(body.currentLetter || 'A').toUpperCase().match(/[A-Z]/) || ['A'])[0];

    const prompt = buildLessonPrompt(kidName, age, subject, dayLabel, currentLetter);

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: LESSON_PLAN_SCHEMA,
    });

    const title = (llmRes && llmRes.title) || `${subject} time with ${kidName}`;
    const script = (llmRes && llmRes.script) || '';
    const letter = (llmRes && llmRes.letter) || '';
    const sound = (llmRes && llmRes.sound) || '';
    const word = (llmRes && llmRes.word) || '';
    // A webcam cannot reliably verify a toddler's articulation, so the camera
    // is never used for speech lessons. (Gross-movement activities elsewhere
    // in the app still use the camera, where it does make sense.)
    const camera_recommended = false;

    if (!script) {
      return Response.json({ error: 'Could not create the activity. Please try again.' }, { status: 500 });
    }

    // Narrate the script and (if there's a picture word) generate a clean photo
    // of the object in parallel so the flashcard is ready with the audio.
    const imageTask = word
      ? base44.asServiceRole.integrations.Core.GenerateImage({ prompt: picturePromptFor(word) })
          .then((r) => (r && r.url) || '').catch(() => '')
      : Promise.resolve('');

    const [audio_url, picture_url] = await Promise.all([
      synthesizeSpeech(base44, script),
      imageTask,
    ]);

    if (!audio_url) {
      return Response.json({ error: 'Could not create the audio. Please try again.' }, { status: 500 });
    }

    return Response.json({
      title, script, audio_url,
      letter, sound, word,
      picture_url,
      camera_recommended,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}