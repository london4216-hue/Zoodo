import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const subject = (body?.subject || '').toString().trim();
    const day = (body?.day || '').toString().trim();
    const kidName = (body?.kidName || 'the child').toString().trim();

    if (!subject || !day) {
      return Response.json({ error: 'subject and day are required' }, { status: 400 });
    }

    const prompt = `You are a warm, expert early-childhood educator designing a playful learning moment for a young child named ${kidName}.

Today is ${day} and the theme is "${subject}".

Suggest 3 unique, high-quality YouTube-style educational videos a caregiver could play for the child on this theme. For each one provide:
- title: a catchy, kid-friendly video title (max 60 chars)
- description: 1-2 sentences describing what the video teaches and why it's great for young kids
- search_query: the exact search phrase a caregiver would type into YouTube to find a real video like this
- why: one short sentence on how it connects to the "${subject}" theme

Make the three videos genuinely different from each other (different angle/format — e.g. one song-based, one story-based, one hands-on activity). Keep language simple, warm, and encouraging. Return only the JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          videos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                search_query: { type: 'string' },
                why: { type: 'string' }
              },
              required: ['title', 'description', 'search_query', 'why']
            }
          }
        },
        required: ['videos']
      }
    });

    const videos = (result && (result as any).videos) ? (result as any).videos : (result as any);

    return Response.json({ videos });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}