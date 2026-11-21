import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface VoiceNoteBubbleProps {
  audioUrl: string;
  duration?: number;
  transcript?: string;
  variant?: 'user' | 'assistant';
  compact?: boolean;
}

const WAVEFORM_BARS = [
  32, 58, 44, 82, 65, 92, 50, 74, 88, 42, 68, 95, 60, 78, 46, 84, 54, 70, 38, 62,
];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const rounded = Math.max(0, Math.round(seconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VoiceNoteBubble: React.FC<VoiceNoteBubbleProps> = ({
  audioUrl,
  duration = 0,
  transcript,
  variant = 'user',
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState<number>(duration > 0 ? duration : 0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      setResolvedDuration(duration);
    }
  }, [duration]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setResolvedDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setResolvedDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
      setHasError(true);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
        setHasError(true);
      });
  };

  const progressRatio = useMemo(() => {
    if (resolvedDuration <= 0) return 0;
    return Math.min(1, Math.max(0, currentTime / resolvedDuration));
  }, [currentTime, resolvedDuration]);

  const handleSeek = (barIdx: number) => {
    const audio = audioRef.current;
    if (!audio || resolvedDuration <= 0 || !Number.isFinite(audio.duration)) return;
    const target = ((barIdx + 0.5) / WAVEFORM_BARS.length) * audio.duration;
    if (Number.isFinite(target)) {
      audio.currentTime = target;
      setCurrentTime(target);
    }
  };

  const isUser = variant === 'user';
  const showTranscript = Boolean(transcript && transcript.trim() && transcript.trim() !== 'Message vocal');

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2.5 ${compact ? 'min-w-[190px]' : 'min-w-[220px] sm:min-w-[250px]'}`}
      >
        <button
          type="button"
          onClick={togglePlayback}
          disabled={hasError}
          aria-label={isPlaying ? 'Mettre en pause le message vocal' : 'Lire le message vocal'}
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
            isUser
              ? 'bg-white text-[#0095F6] hover:bg-white/90'
              : 'bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90'
          } ${hasError ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Forme d'onde interactive */}
        <div
          className="flex-1 flex items-center gap-[3px] h-7 cursor-pointer"
          aria-hidden="true"
        >
          {WAVEFORM_BARS.map((heightPct, idx) => {
            const barProgress = (idx + 1) / WAVEFORM_BARS.length;
            const isPlayed = progressRatio >= barProgress || (isPlaying && idx === Math.floor(progressRatio * WAVEFORM_BARS.length));
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSeek(idx)}
                tabIndex={-1}
                style={{ height: `${heightPct}%` }}
                className={`flex-1 min-w-[2px] rounded-full transition-colors cursor-pointer ${
                  isUser
                    ? isPlayed
                      ? 'bg-white'
                      : 'bg-white/40'
                    : isPlayed
                    ? 'bg-[#0095F6]'
                    : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
            );
          })}
        </div>

        <span
          className={`text-[11px] font-mono tabular-nums shrink-0 ${
            isUser ? 'text-white/90' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {isPlaying ? formatDuration(currentTime) : formatDuration(resolvedDuration)}
        </span>
      </div>

      {hasError && (
        <p className={`text-[11px] ${isUser ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
          Audio expiré ou non lisible sur ce navigateur.
        </p>
      )}

      {showTranscript && (
        <div
          className={`pt-1.5 border-t flex items-start gap-1.5 text-xs leading-relaxed ${
            isUser
              ? 'border-white/20 text-white/95'
              : 'border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <Mic className="w-3 h-3 mt-0.5 shrink-0 opacity-75" />
          <span>{transcript}</span>
        </div>
      )}
    </div>
  );
};
