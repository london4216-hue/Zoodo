import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DAY_THEMES = [
  { day: 'monday', subject: 'Numbers' },
  { day: 'tuesday', subject: 'Letters' },
  { day: 'wednesday', subject: 'Outdoor activity' },
  { day: 'thursday', subject: 'Music' },
  { day: 'friday', subject: 'Exercises' },
];

const videoItem = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    video_id: { type: 'string' },
    channel: { type: 'string' },
    description: { type: 'string' },
    why: { type: 'string' },
  },
  required: ['title', 'video_id', 'channel', 'description', 'why'],
};

// Generates all 5 days' YouTube picks in a SINGLE web-search call, so the
// whole week is ready by the time the caregiver taps a day.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const kidName = (body?.kidName || 'the child').toString().trim();
    const lovedSubjects = Array.isArray(body?.lovedSubjects)
      ? body.lovedSubjects.filter(Boolean)
      : [];

    const personalization = lovedSubjects.length
      ? ` The child has especially loved these topics before: ${lovedSubjects.join(', ')}. Lean slightly toward those interests where natural, while still covering all five themes.`
      : '';

    const lines = DAY_THEMES.map((d) => `- ${d.day}: ${d.subject}`).join('\n');

    const prompt = `You are a warm, expert early-childhood educator building a weekly lesson plan for a young child named ${kidName}.${personalization}

For each of the 5 weekdays below, search the web for 3 real, high-quality YouTube videos that fit that day's theme for young children.
${lines}

For each video return:
- title: the real video title as it appears on YouTube
- video_id: the real 11-character YouTube video ID (only use a real id you found; never invent one)
- channel: the channel name that published it
- description: 1-2 sentences on what it teaches and why it's great for young kids
- why: one short sentence connecting it to the day's theme

The 3 videos per day must be genuinely different from each other (e.g. one song-based, one story-based, one hands-on activity). Only return real videos you actually found on the web; never invent video IDs. Return only JSON keyed by day name.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          monday: { type: 'array', items: videoItem },
          tuesday: { type: 'array', items: videoItem },
          wednesday: { type: 'array', items: videoItem },
          thursday: { type: 'array', items: videoItem },
          friday: { type: 'array', items: videoItem },
        },
        required: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      },
    });

    return Response.json(result || {});
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}