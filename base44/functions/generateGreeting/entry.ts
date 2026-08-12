import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

// Premium TTS: ElevenLabs (warm, expressive, human-like) with a safe fallback to
// the built-in "honey" voice. Returns a stored file_url. Activates only when
// ELEVENLABS_API_KEY is set; otherwise the built-in voice is used seamlessly.
const ELEVEN_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — warm, friendly female
async function synthesizeSpeech(base44, text) {
  const clean = (text || "").slice(0, 4500);
  try {
    const key = secrets.get("ELEVENLABS_API_KEY");
    if (key) {
      const customVoice = secrets.get("ELEVENLABS_VOICE_ID");
      const voiceId = (customVoice && /^[A-Za-z0-9]{16,}$/.test(customVoice)) ? customVoice : ELEVEN_VOICE_ID;
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({
          text: clean,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
        }),
      });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const file = new File([buf], "edu_greeting.mp3", { type: "audio/mpeg" });
        const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        if (up && up.file_url) return up.file_url;
      }
    }
  } catch (e) { /* fall through to built-in voice */ }
  const fb = await base44.asServiceRole.integrations.Core.GenerateSpeech({ text: clean, voice: "honey" });
  return (fb && fb.url) || "";
}

// Goofy, silly, giggly toddler persona for the learning-buddy greeting.
const GOOFY_PERSONA = `You are the silly, goofy, giggly learning buddy of EduPath AI — a wiggly, bubbly creature greeting a toddler (around 3 years old) in the warm "honey" voice.

PERSONALITY: Goofy, silly, playful, extra wiggly. Lots of giggles ("hee hee", "tee hee"), silly sounds ("boing", "wheee", "whoosh"), and playful bouncy energy. Warm and sweet underneath the silliness.

DELIVERY: Short phrases separated by "..." for natural breathing pauses. Sing-song, bouncy rhythm. Vary pitch — go high and squeaky for silly moments, soft and warm for the hello. Use the child's name in a silly playful way.

RULES: Speak ONLY the exact words meant to be spoken aloud. No stage directions, no parentheses, no brackets, no notes, no spelling-out of symbols. Keep it short (15-35 words). End with a giggle and a cheerful invite to play.`;

// Generates a short, goofy, giggly greeting for the kid, spoken in the warm
// honey voice (replaces the old robotic browser speech synthesis).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const kidName = (body?.kidName || 'friend').toString().trim();
    const subject = (body?.subject || 'learning').toString().trim();
    const dayLabel = (body?.dayLabel || 'today').toString().trim();

    const prompt = GOOFY_PERSONA + '\n\n' +
      `Write a super silly, goofy, giggly hello for a toddler named ${kidName}. ` +
      `Mention that today is ${dayLabel} and we are going to play and learn about ${subject}. ` +
      `Make it bouncy and wiggly with silly sounds and giggles. Keep it short (15-35 words). ` +
      `Return JSON: { "script": "the exact words to speak aloud" }.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: { script: { type: 'string' } },
        required: ['script'],
      },
    });

    const script = (result as any)?.script || '';
    if (!script) {
      return Response.json({ error: 'Could not create the greeting.' }, { status: 500 });
    }

    const audio_url = await synthesizeSpeech(base44, script);
    if (!audio_url) {
      return Response.json({ error: 'Could not create the audio.' }, { status: 500 });
    }

    return Response.json({ script, audio_url });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}