import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

// Premium TTS for arbitrary text: the signature "lady" voice via ElevenLabs.
// Returns a stored file_url. Only the lady voice is ever used — no fallback.
const ELEVEN_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — warm, friendly female

// Warm-instance cache only (best-effort). This avoids duplicate generation
// bursts while the function instance is hot; it is not cross-instance durable.
const speechCache = new Map<string, string>();

const SPECIAL_NAME_PRONUNCIATIONS: Record<string, string> = {
  'zoë': 'Zo-ay',
  'zoe': 'Zo-ee',
  'chloë': 'Klo-ee',
  'saoirse': 'Seer-sha',
  'siobhan': 'Shi-vawn',
  'x Æ a-12': 'Ex Ash A Twelve',
};

function simplifyDiacritics(input: string): string {
  return (input || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeName(name: string): string {
  return simplifyDiacritics(name || '')
    .replace(/[^\p{L}\p{N}\s'\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneticizeName(name: string): string {
  const clean = normalizeName(name);
  if (!clean) return '';
  const lower = clean.toLowerCase();
  if (SPECIAL_NAME_PRONUNCIATIONS[lower]) return SPECIAL_NAME_PRONUNCIATIONS[lower];

  return clean
    .replace(/([aeiou])e$/i, '$1')
    .replace(/thia$/i, 'thee-ah')
    .replace(/eigh/i, 'ay')
    .replace(/kh/i, 'k');
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

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
        const file = new File([buf], "edu_speech.mp3", { type: "audio/mpeg" });
        const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        if (up && up.file_url) return up.file_url;
      }
    }
  } catch (e) { /* lady voice only — no fallback voice */ }
  return "";
}

// Speak any short line aloud in the lady voice. Returns { audio_url }.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const text = (body?.text || '').toString().slice(0, 4500);
    const childNameRaw = (body?.childName || body?.kidName || '').toString();
    const parentNamesRaw = Array.isArray(body?.parentNames) ? body.parentNames : [];
    const childName = normalizeName(childNameRaw);
    const spokenChildName = phoneticizeName(childName);
    const parentNames = parentNamesRaw
      .map((n: unknown) => normalizeName(String(n || '')))
      .filter(Boolean)
      .slice(0, 4);

    if (!text) return Response.json({ error: 'Missing text' }, { status: 400 });

    const normalizedText = normalizeName(text);
    const script = childName
      ? `${normalizedText.includes(childName) || text.includes(childNameRaw) ? text : `Hi ${spokenChildName}... ${text}`}`
      : text;
    const nameHash = shortHash(`${spokenChildName}|${parentNames.join('|')}`);
    const cacheKey = `${nameHash}:${shortHash(script)}`;

    let audio_url = speechCache.get(cacheKey) || '';
    if (!audio_url) {
      audio_url = await synthesizeSpeech(base44, script);
      if (audio_url) speechCache.set(cacheKey, audio_url);
    }

    if (!audio_url) return Response.json({ error: 'Could not create audio' }, { status: 500 });

    return Response.json({ audio_url, text: script, childName, nameHash });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}