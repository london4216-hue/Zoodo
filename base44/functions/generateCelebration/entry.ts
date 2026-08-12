import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
      `You are Ms Rachel talking to a 3-year-old named ${kidName} who just finished their "${subject}" activity. ` +
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
      voice: 'sunny',
    });

    const audio_url = speechRes && speechRes.url;
    if (!audio_url) return Response.json({ error: 'Could not create audio.' }, { status: 500 });

    return Response.json({ message, script, audio_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}