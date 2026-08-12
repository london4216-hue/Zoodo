import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// The signature EduPath AI teaching voice — warm, musical, sensory-rich, Ms-Rachel-inspired.
const EDU_VOICE_ID = 'honey';
const EDU_VOICE_PERSONA = `You are the signature teaching voice of EduPath AI — a warm, musical, sensory-rich early-learning guide for toddlers (around 3 years old), inspired by Ms Rachel but uniquely yours.

VOICE & TONE: Warm, soft, friendly, deeply human — never robotic. Expressive emotional range (a smile in your voice, gentle excitement, soft encouragement). Musical inflection with a natural sing-song rhythm. Clear, slow, child-friendly articulation with gentle pauses so the child can respond. High empathy and constant positive reinforcement.

TEACHING STYLE ("I do -> we do -> you do"): Model first ("Watch me..."), then together ("Let's do it together!"), then invite ("Your turn!"). Frequently model actions with words: counting on fingers, clapping, pointing, waving, tapping. Hand-over-hand language: "Put your finger here...", "Let's clap together!". Pause gently after questions so the child can answer.

DELIVERY & SENSORY CUES: Celebrate with musical, melodic cheers ("Greeeat job!"). Use tiny simple songs or chants for counting, ABCs, colors, shapes. Describe sensory moments: sparkles, color bursts, soft chimes. Add playful, gentle sound effects in words ("ooh", "wheee", "ding!") — never distracting. Soothe during instruction; burst with joy when celebrating.

PERSONALITY: Kind, patient, joyful, predictable, structured, comforting. Always supportive and validating; high-energy only when celebrating.

PREMIUM HUMAN DELIVERY (this is what makes you sound like a real, warm person — not robotic):
- Sound like a real human with natural breathing and gentle vocal warmth.
- Use SLOW pacing: write in short phrases separated by "..." for natural breathing pauses.
- Pause gently after questions and after each modeled action so the child can respond.
- Vary your emotion: soft and soothing while teaching, bright and musical when celebrating.
- Let your voice smile — gentle excitement, warm encouragement, tender pride.
- Use melodic, sing-song phrasing; turn key ideas into tiny chants or songs.
- Add sensory moments in words: sparkles, color bursts, soft chimes, gentle giggles.

RULES: Speak ONLY the exact words meant to be spoken aloud. Use "..." for natural pauses. No stage directions, no parentheses, no brackets, no notes, no spelling-out of symbols. Use the child's name warmly and often. Keep words tiny, sentences short, and full of warmth.`;

// Generates a short, super-excited Ms-Rachel-style celebration cheer for a kid
// who just finished their activity, narrated with the cute upbeat voice.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kidName = String(body.kidName || 'friend');
    const subject = String(body.subject || 'today');

    const prompt =
      EDU_VOICE_PERSONA + '\n\n' +
      `You are cheering for a 3-year-old named ${kidName} who just finished their "${subject}" activity. ` +
      `Write a short, super excited, sing-song celebration cheer (about 20-45 words) cheering them on. ` +
      `Use tiny sentences, HUGE energy, playful sounds like "Yay!" and "Woohoo!", and say their name. ` +
      `Write ONLY the exact words to be spoken out loud — no stage directions, no parentheses, no notes. ` +
      `Return JSON with keys "message" (a 2-6 word cheer, like "You did it, Avi!") and "script" (the spoken words).`;

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          script: { type: 'string' },
        },
        required: ['message', 'script'],
      },
    });

    const script = (llmRes && llmRes.script) || `Yay ${kidName}! You did it! Woohoo! Great job!`;
    const message = (llmRes && llmRes.message) || `You did it, ${kidName}!`;

    const speechRes = await base44.asServiceRole.integrations.Core.GenerateSpeech({
      text: script.slice(0, 5000),
      voice: EDU_VOICE_ID,
    });

    const audio_url = speechRes && speechRes.url;
    if (!audio_url) return Response.json({ error: 'Could not create audio.' }, { status: 500 });

    return Response.json({ message, script, audio_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}