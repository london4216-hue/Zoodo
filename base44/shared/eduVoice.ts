import { secrets } from "base44:runtime";

// Shared EduPath TTS helper. The narrator voice is ElevenLabs "Rachel" ONLY —
// no fallback voice. If ElevenLabs is unavailable, returns "" (no audio) rather
// than play a different voice. Extracted here so every backend function uses
// one identical voice path.

const ELEVEN_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — warm, friendly female

export async function synthesizeSpeech(
  base44,
  text: string,
  opts: { fallback?: boolean; filename?: string; stability?: number; style?: number } = {}
): Promise<string> {
  const clean = (text || "").slice(0, 4500);
  const fallback = opts.fallback !== false;
  const filename = opts.filename || "edu_speech.mp3";
  try {
    const key = secrets.get("ELEVENLABS_API_KEY");
    if (key) {
      // Narrator voice hardcoded to Rachel (warm American female) — the
      // British-sounding secret voice can no longer override it.
      const voiceId = ELEVEN_VOICE_ID;
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({
          text: clean,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: opts.stability ?? 0.45,
            similarity_boost: 0.75,
            style: opts.style ?? 0.5,
            use_speaker_boost: true,
          },
        }),
      });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const file = new File([buf], filename, { type: "audio/mpeg" });
        const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        if (up && up.file_url) return up.file_url;
      }
    }
  } catch (e) { /* fall through — no fallback voice */ }
  // No fallback: the narrator is Rachel only. Missing ElevenLabs = no audio,
  // never a different voice.
  return "";
}