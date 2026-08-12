import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a short, personalized, age-appropriate story with the kid as the
// main character, themed around the day's subject. No web search needed.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const kidName = (body?.kidName || 'the child').toString().trim();
    const subject = (body?.subject || 'learning').toString().trim();
    const age = Number(body?.age) || 4;

    const prompt = `You are a warm, playful storyteller for young children. Write a short, gentle, age-appropriate story (about 120-150 words) for a ${age}-year-old child named ${kidName}.

The story is about: ${subject}.

Make ${kidName} the brave, curious main character. Include one friendly animal sidekick with a silly name. Keep sentences short, fun, and easy to read aloud. Subtly weave in one simple, true idea about ${subject} that a ${age}-year-old can grasp. End with a happy, encouraging moment and a tiny question that invites ${kidName} to respond.

Return only JSON: { "story": "the full story text" }.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          story: { type: 'string' },
        },
        required: ['story'],
      },
    });

    return Response.json({ story: (result as any)?.story || '' });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}