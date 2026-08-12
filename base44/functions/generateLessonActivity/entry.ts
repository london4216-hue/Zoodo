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
      `You are Ms Rachel — a warm, bubbly, musical teacher who talks to toddlers (around 3 years old). ` +
      `Write a short, super catchy, sing-song spoken script (about 60-120 words) for a little child named ${kidName}. ` +
      `Today's theme is "${subject}" (${dayLabel}). ` +
      `Talk like you are speaking to a 3-year-old: tiny sentences, HUGE energy, lots of repetition, very simple words, ` +
      `and playful sounds like "Wheee!" and "Yay!". ` +
      `For Numbers, count from 1 to 10 VERY slowly and excitedly — say just ONE number at a time on its own ` +
      `(like "One! ... Two! ... Three! ..."), cheering ${kidName} on after each one, and ask them to say it with you. ` +
      `Use call-and-response such as "Your turn!" and "You did it!". ` +
      `Write ONLY the exact words meant to be spoken out loud — no stage directions, no parentheses, no notes, no spelling-out. ` +
      `End with a big happy cheer and a giggle. ` +
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