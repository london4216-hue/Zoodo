import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

// ─────────────────────────────────────────────────────────────────────────
// Age-aware, CDC-milestone-aligned lesson generator. Each session is a real,
// high-dosage early-learning activity scaled to the child's intake age, with
// the signature warm, musical EduPath teaching voice.
// ─────────────────────────────────────────────────────────────────────────

// Map a subject label to its developmental strand so the right pedagogical
// guide is used regardless of the age-band wording.
function strandFor(subject: string): string {
  const s = (subject || '').toLowerCase();
  if (s.includes('first word')) return 'language';
  if (s.includes('count') || s.includes('number') || s.includes('math')) return 'numeracy';
  if (s.includes('letter') || s.includes('reading') || s.includes('sound')) return 'literacy';
  if (s.includes('music') || s.includes('clap') || s.includes('beat')) return 'music';
  if (s.includes('sensory') || s.includes('sort')) return 'sensory';
  return 'movement';
}

const CDC_MILESTONES: Record<number, string> = {
  2: 'CDC milestones for a 2-year-old: says 2-4 word phrases; points to named things; follows 2-step instructions; sorts shapes/colors; stacks 4+ blocks; runs; kicks a ball; walks up/down stairs; points to body parts. Very short attention — keep activities to 1-2 minutes, one tiny goal, lots of repetition and sensory input.',
  3: 'CDC milestones for a 3-year-old: counts to 3; knows some colors; draws a circle; runs and climbs well; pedals a tricycle; copies a circle; simple conversations. 2-3 minute activities, one clear goal, lots of modeling and repetition.',
  4: 'CDC milestones for a 4-year-old: counts to 10; names some numbers/colors; draws a person with 2-4 body parts; catches a bounced ball; hops on one foot; knows beginning letter sounds. 3-5 minute activities, one target, I-do/we-do/you-do.',
  5: 'CDC milestones for a 5-year-old: counts to 10+; tells simple stories; skips; stands on one foot 10s; recognizes some letters and sounds; rhymes. 5-7 minute activities with clear goals.',
  6: 'CDC milestones for a 6-year-old: counts to 20+; adds/subtracts within 5; reads simple CVC words; hops, skips, balances; copies shapes; multi-step directions. 7-10 minute activities.',
  7: 'CDC milestones for a 7-year-old: reads sight words and simple sentences; adds/subtracts within 20; tells time; complex motor coordination. ~10 minute activities.',
  8: 'CDC milestones for an 8-year-old: reads fluently; multiplies; complex motor coordination; independent learning. 10-15 minute activities.',
};

function cdcForAge(age: number): string {
  const a = Math.max(2, Math.min(8, Number(age) || 4));
  return CDC_MILESTONES[a] || CDC_MILESTONES[4];
}

const PERSONA = `You are a world-class early-childhood educator and the signature warm, musical teaching voice of EduPath AI. You are leading a real, high-dosage early-learning session, scaled to the child's exact developmental level.

TEACHING FRAMEWORK (I do -> we do -> you do):
- MODEL: "Watch my mouth... " or "Watch me... " (exaggerated, slow).
- TOGETHER: "Let's do it together... "
- INDEPENDENT: "Your turn!"
- REPETITION: Many clear, spaced repetitions of the target.
- SPECIFIC PRAISE: Praise the specific attempt ("Great AH sound!", "You counted to three!"), not generic "good job".

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
- Always end with specific praise and a warm cheer.`;

// Evidence-based guides per developmental strand. The camera is never used for
// speech lessons (hardcoded off below), so these focus purely on pedagogy.
const STRAND_GUIDES: Record<string, string> = {
  numeracy: `Target: early numeracy using the counting principles (Gelman & Gallistel), scaled to the child's age and CDC milestones. Teach in order: (1) ROTE COUNTING — say the number sequence aloud; (2) ONE-TO-ONE CORRESPONDENCE — touch or tap one object for each number said; (3) CARDINALITY — after counting, the last number tells how many. Count slowly with the child using I-do/we-do/you-do, fingers or visible objects. Set letter/sound to "" and word to the key number or object.`,
  language: `Target: early SPOKEN LANGUAGE for a toddler — naming a familiar picture, animal sounds, and playful first-sound awareness (NOT formal letter articulation). Model naming the picture ("This is a dog! Dog says woof!"), invite the child to imitate. Use I-do/we-do/you-do with lots of repetition. Set letter/sound to "" and word to the named picture.`,
  literacy: `Target: the EXACT uppercase letter provided for today (do NOT pick a different letter). Pick ONE concrete, high-frequency picture word that begins with that letter's sound and where the sound is clear and isolated (A->apple, B->ball, C->cat, D->dog — avoid long or ambiguous words). Teach in order: letter NAME -> phoneme SOUND (e.g. "AH" for A) -> WORD. Use auditory bombardment (say the sound many times), then "say AH like apple" sound-isolation, then I-do/we-do/you-do production. Set word to the picture word.`,
  movement: `Target: gross-motor and body-awareness movement scaled to the child's age and CDC milestones. Use "watch me -> together -> your turn" with clear, slow modeling, one movement at a time. Name the body parts. For toddlers focus on fundamental locomotor skills (running, climbing, kicking a ball, stepping up). For preschool+ include balance, bilateral coordination, and crossing midline. Set letter/sound to "" and word to the key body part or object.`,
  music: `Target: steady beat and rhythm scaled to the child's age. Teach call-and-response clapping/tapping to a steady beat. Use I-do/we-do/you-do ("watch me clap... together... your turn!"). Emphasize keeping a steady beat and copying a simple rhythm pattern. Set letter/sound to "" and word to the key instrument or body part.`,
  sensory: `Target: cognitive/sensory play scaled to the child's age and CDC milestones — sorting by color/shape, stacking, matching, or simple puzzles. Use I-do/we-do/you-do with one clear concept. Name the attribute (color, shape, size). Set letter/sound to "" and word to the key object or attribute.`,
};

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

function buildLessonPrompt(kidName: string, age: number, subject: string, dayLabel: string, currentLetter: string) {
  const strand = strandFor(subject);
  const guide = STRAND_GUIDES[strand] || STRAND_GUIDES.movement;
  const cdc = cdcForAge(age);
  const letterDirective = strand === 'literacy' && currentLetter
    ? `The target letter for today is "${currentLetter}". Teach ONLY that letter — its name, its phoneme sound, and one picture word starting with that sound. `
    : '';
  return PERSONA + '\n\n' +
    `Developmental reference — ${cdc}\n\n` +
    `Write a short, high-dosage spoken script (about 60-120 words) for a ${age}-year-old child named ${kidName}. ` +
    `It MUST open by naming the child: "Hi ${kidName}! ..." ` +
    `Today's theme is "${subject}" (${dayLabel}). ${letterDirective}${guide} ` +
    `Use the full I-do -> we-do -> you-do production hierarchy. Use specific praise. ` +
    `Keep it tiny-sentence, huge-warmth, sing-song, and developmentally on-target for a ${age}-year-old per the CDC reference above. ` +
    `Return JSON with keys: title (2-5 word fun title), script (exact spoken words only), letter (target uppercase letter or ""), sound (target phoneme like "AH" or ""), word (the picture word or ""), and camera_recommended (true if a camera check would help verify the child's production or movement, false otherwise).`;
}

function picturePromptFor(word: string) {
  return `A bright, friendly, simple photograph of a single ${word} centered on a clean pure-white background, soft even lighting, sharp focus, children's speech-therapy flashcard style, no text, no people.`;
}

// ─────────────────────────────────────────────────────────────────────────
// TTS — premium ElevenLabs voice with built-in fallback.
// ─────────────────────────────────────────────────────────────────────────
const ELEVEN_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — warm, friendly female
async function synthesizeSpeech(base44, text: string): Promise<string> {
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
    console.warn('ElevenLabs fetch error — using built-in voice.', (e as Error)?.message);
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

async function builtinTTS(base44, text: string): Promise<string> {
  const res = await base44.asServiceRole.integrations.Core.GenerateSpeech({
    text: (text || '').slice(0, 5000),
    voice: 'honey',
  });
  if (!res || !res.url) throw new Error('Built-in TTS returned no audio url');
  return res.url;
}

// ─────────────────────────────────────────────────────────────────────────
// Main: builds an age-appropriate activity (target + I-do/we-do/you-do script),
// narrates it, and — when the plan has a picture word — generates a clean photo
// of the target object so the child sees the real thing.
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
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}