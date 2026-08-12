import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Finds one real, kid-friendly YouTube video that supports a weekly sensory
// activity's skill, using web search. Returns { video } so the client can
// persist it on the SensoryActivity record.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const title = (body?.title || '').toString().trim();
    const description = (body?.description || '').toString().trim();
    const age = Number(body?.age) || 3;
    if (!title) {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }

    const prompt = `You are a warm, expert early-childhood educator helping a ${age}-year-old child.
The activity is: "${title}" — ${description || 'a sensory learning activity'}.

Search the web for 1 real, high-quality, kid-friendly YouTube video that supports this skill for a ${age}-year-old (e.g. from channels like Ms Rachel, Super Simple Songs, Cocomelon, or similar toddler-friendly educators). Return:
- title: the real video title as it appears on YouTube
- video_id: the actual 11-character YouTube video ID (the part after "v=" in the watch URL) — only use a real id you found, never invent one
- channel: the channel name that published it
- why: one short sentence on how this video supports the "${title}" skill

Rules:
- Only return a real video you actually found on the web. Do not make up video IDs.
- Keep language simple, warm, and encouraging.
- Return only the JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          video_id: { type: 'string' },
          title: { type: 'string' },
          channel: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['video_id', 'title', 'channel', 'why'],
      },
    });

    const video = (result as any) || null;
    if (!video || !video.video_id) {
      return Response.json({ error: 'Could not find a video. Please try again.' }, { status: 500 });
    }

    const vid = String(video.video_id).trim();
    // Validate it looks like a real 11-character YouTube video ID.
    if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
      return Response.json({ error: 'Could not find a valid video. Please try again.' }, { status: 500 });
    }

    return Response.json({
      video: {
        video_id: vid,
        title: video.title || '',
        channel: video.channel || '',
        why: video.why || '',
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}