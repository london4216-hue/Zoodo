import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Play, X, Youtube } from 'lucide-react';

// A "watch a supporting video" section for a weekly sensory activity.
// Lazily finds a kid-friendly YouTube video for the skill on first tap, then
// embeds it as a playable frame. The found video is persisted on the activity.
export default function ActivityVideo({ activity, age, onVideo }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [video, setVideo] = useState(activity.video || null);

  const ensureVideo = async () => {
    if (video) return video;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('generateActivityVideo', {
        title: activity.title,
        description: activity.description,
        age,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const v = res?.data?.video;
      if (!v) throw new Error('No video came back');
      setVideo(v);
      onVideo?.(activity.id, v);
      try {
        await base44.entities.SensoryActivity.update(activity.id, { video: v });
      } catch (e) { /* state already updated; persist failure is non-fatal */ }
      return v;
    } catch (e) {
      setError(e?.message || 'Could not find a video.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    await ensureVideo();
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFE8F3] py-2.5 text-sm font-bold text-[#D96969] active:scale-95 transition"
      >
        <Youtube className="h-4 w-4" />
        Watch a video for this skill
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-black/40">
          Supporting video
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-black/40 active:scale-95"
          aria-label="Close video"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#D96969]" />
          <span className="ml-2 text-sm font-semibold text-black/50">
            Finding a good video…
          </span>
        </div>
      )}

      {!loading && error && (
        <p className="py-4 text-center text-sm font-semibold text-red-500">{error}</p>
      )}

      {!loading && video && (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${video.video_id}?rel=0&modestbranding=1`}
              title={video.title || 'Supporting video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="mt-2 text-sm font-bold text-black/70">
            {video.title || 'Supporting video'}
          </p>
          {video.channel && (
            <p className="text-xs font-semibold text-black/40">{video.channel}</p>
          )}
          {video.why && (
            <p className="mt-1 text-xs text-black/50">{video.why}</p>
          )}
        </>
      )}
    </div>
  );
}