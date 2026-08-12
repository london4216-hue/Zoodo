import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a short, playful, Ms-Rachel-style interactive script for the day's
// subject, then narrates it with a cute, upbeat voice (GenerateSpeech "sunny").
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

    const prompt =
      `You are a playful, warm, energetic early-childhood teacher, much like Ms Rachel. ` +
      `Write a short spoken script (about 60-130 words) for a ${age}-year-old child named ${kidName}. ` +
      `Today's theme is "${subject}" (${dayLabel}). Make it interactive and joyful: greet ${kidName} by name, ` +
      `do the activity together in a cheerful way (for example, for Numbers slowly count from 1 to 10 and ` +
      `cheer them on to count along with you), use simple friendly words and lots of warmth and excitement. ` +
      `Write ONLY the exact words meant to be spoken out loud — no stage directions, no parentheses, no notes. ` +
      `End by inviting ${kidName} to try it themselves. ` +
      `Return JSON with keys "title" (a short, fun, 2-5 word title) and "script" (the words to be spoken).`;

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          script: { type: 'string' },
        },
        required: ['title', 'script'],
      },
    });

    const title = (llmRes && llmRes.title) || `${subject} time with ${kidName}`;
    const script = (llmRes && llmRes.script) || '';

    if (!script) {
      return Response.json({ error: 'Could not create the activity. Please try again.' }, { status: 500 });
    }

    const speechRes = await base44.asServiceRole.integrations.Core.GenerateSpeech({
      text: script.slice(0, 5000),
      voice: 'sunny',
    });

    const audio_url = speechRes && speechRes.url;
    if (!audio_url) {
      return Response.json({ error: 'Could not create the audio. Please try again.' }, { status: 500 });
    }

    return Response.json({ title, script, audio_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}