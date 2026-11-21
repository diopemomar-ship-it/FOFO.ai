import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Trash2, Loader2, FileText, X, AlertCircle } from 'lucide-react';

export interface VoiceMessagePayload {
  text: string;
  audioUrl: string;
  duration: number;
}

interface UseVoiceRecorderOptions {
  maxDurationSeconds?: number;
  onSendVoiceMessage: (payload: VoiceMessagePayload) => void;
  onTranscribeToInput?: (transcript: string) => void;
}

const MAX_RECORDING_SECONDS_DEFAULT = 90;

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Impossible de lire le fichier audio.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de conversion audio.'));
    reader.readAsDataURL(blob);
  });
}

async function transcribeAudioOnServer(dataUrl: string, mimeType: string): Promise<string> {
  const res = await fetch('/api/audio/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: dataUrl,
      mimeType: mimeType || 'audio/webm',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Erreur lors de la transcription audio.');
  }
  return typeof data?.transcript === 'string' ? data.transcript.trim() : '';
}

export function useVoiceRecorder({
  maxDurationSeconds = MAX_RECORDING_SECONDS_DEFAULT,
  onSendVoiceMessage,
  onTranscribeToInput,
}: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [liveLevels, setLiveLevels] = useState<number[]>(() => new Array(14).fill(18));
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const startedAtRef = useRef<number>(0);
  const actionModeRef = useRef<'send' | 'transcribe' | 'cancel'>('send');
  const liveTranscriptRef = useRef<string>('');
  const mimeTypeRef = useRef<string>('audio/webm');
  const speechOnlyModeRef = useRef<boolean>(false);

  const cleanupMediaResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLiveLevels(new Array(14).fill(18));
  }, []);

  useEffect(() => {
    return () => {
      actionModeRef.current = 'cancel';
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupMediaResources();
    };
  }, [cleanupMediaResources]);

  const finishRecordingFlow = useCallback(
    async (blob: Blob | null, recordedDuration: number, mode: 'send' | 'transcribe' | 'cancel') => {
      if (mode === 'cancel') {
        setIsProcessing(false);
        setLiveTranscript('');
        liveTranscriptRef.current = '';
        return;
      }

      const fallbackSpeechText = liveTranscriptRef.current.trim();
      setIsProcessing(true);

      try {
        let dataUrl = '';
        let transcript = '';

        if (blob && blob.size > 0) {
          dataUrl = await blobToDataUrl(blob);
          try {
            transcript = await transcribeAudioOnServer(dataUrl, mimeTypeRef.current);
          } catch (serverErr: any) {
            if (!fallbackSpeechText && mode === 'transcribe') {
              throw serverErr;
            }
            if (!fallbackSpeechText && mode === 'send') {
              // On garde l'audio lisible dans le chat même si la transcription échoue
              transcript = '';
            }
          }
        }

        const finalText = (transcript || fallbackSpeechText).trim();

        if (mode === 'transcribe') {
          if (!finalText) {
            setError("Aucune parole détectée. Parlez plus près du micro et réessayez.");
          } else {
            onTranscribeToInput?.(finalText);
          }
        } else {
          // Mode envoi direct de message vocal
          if (!dataUrl && !finalText) {
            setError("L'enregistrement est vide. Parlez puis réessayez.");
          } else {
            onSendVoiceMessage({
              text: finalText || 'Message vocal',
              audioUrl: dataUrl,
              duration: Math.max(1, recordedDuration),
            });
          }
        }
      } catch (err: any) {
        setError(err?.message || "Impossible de traiter le message vocal.");
      } finally {
        setIsProcessing(false);
        setLiveTranscript('');
        liveTranscriptRef.current = '';
      }
    },
    [onSendVoiceMessage, onTranscribeToInput]
  );

  const stopRecording = useCallback(
    (mode: 'send' | 'transcribe' | 'cancel') => {
      actionModeRef.current = mode;
      const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      setIsRecording(false);

      if (speechOnlyModeRef.current) {
        cleanupMediaResources();
        speechOnlyModeRef.current = false;
        finishRecordingFlow(null, elapsed, mode);
        return;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          cleanupMediaResources();
          finishRecordingFlow(null, elapsed, mode);
        }
      } else {
        cleanupMediaResources();
        finishRecordingFlow(null, elapsed, mode);
      }
    },
    [cleanupMediaResources, finishRecordingFlow]
  );

  const startParallelSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return false;

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let committed = '';
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i]?.[0]?.transcript || '';
          if (event.results[i].isFinal) {
            committed = `${committed} ${piece}`.trim();
          } else {
            interim = `${interim} ${piece}`.trim();
          }
        }
        const combined = `${committed} ${interim}`.trim();
        liveTranscriptRef.current = combined;
        setLiveTranscript(combined);
      };
      recognition.onerror = () => {
        // Silence les erreurs non fatales quand MediaRecorder tourne en parallèle
      };
      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch {
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    setError(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setDurationSeconds(0);
    chunksRef.current = [];
    speechOnlyModeRef.current = false;

    const hasMediaRecorder =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';

    if (!hasMediaRecorder) {
      // Fallback pur SpeechRecognition si MediaRecorder est indisponible
      const startedSpeech = startParallelSpeechRecognition();
      if (!startedSpeech) {
        setError(
          "L'enregistrement vocal nécessite l'accès microphone sur un navigateur compatible (HTTPS)."
        );
        return;
      }
      speechOnlyModeRef.current = true;
      startedAtRef.current = Date.now();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDurationSeconds(secs);
        setLiveLevels((prev) =>
          prev.map(() => Math.round(25 + Math.random() * 65))
        );
        if (secs >= maxDurationSeconds) {
          stopRecording('send');
        }
      }, 250);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const selectedMime = pickSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 32000,
      };
      if (selectedMime) {
        recorderOptions.mimeType = selectedMime;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      mimeTypeRef.current = recorder.mimeType || selectedMime || 'audio/webm';
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mode = actionModeRef.current;
        const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' })
            : null;
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        cleanupMediaResources();
        finishRecordingFlow(blob, elapsed, mode);
      };

      // Visualiseur audio temps réel via Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const freqData = new Uint8Array(analyser.frequencyBinCount);

          const updateMeter = () => {
            analyser.getByteFrequencyData(freqData);
            const bars: number[] = [];
            for (let i = 0; i < 14; i++) {
              const val = freqData[i % freqData.length] || 0;
              bars.push(Math.max(16, Math.min(100, Math.round((val / 255) * 100))));
            }
            setLiveLevels(bars);
            rafRef.current = requestAnimationFrame(updateMeter);
          };
          rafRef.current = requestAnimationFrame(updateMeter);
        } catch {
          // Si Web Audio échoue, le timer anime légèrement l'indicateur
        }
      }

      // Reconnaissance navigateur en parallèle comme filet de secours instantané
      startParallelSpeechRecognition();

      startedAtRef.current = Date.now();
      actionModeRef.current = 'send';
      recorder.start(250);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDurationSeconds(secs);
        if (secs >= maxDurationSeconds) {
          stopRecording('send');
        }
      }, 250);
    } catch (err: any) {
      cleanupMediaResources();
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError(
          'Accès au microphone refusé. Autorisez le micro dans les paramètres de votre navigateur.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('Aucun microphone détecté sur cet appareil.');
      } else if (name === 'NotReadableError') {
        setError('Le microphone est déjà utilisé par une autre application.');
      } else {
        setError("Impossible d'accéder au microphone.");
      }
    }
  }, [
    cleanupMediaResources,
    finishRecordingFlow,
    isProcessing,
    isRecording,
    maxDurationSeconds,
    startParallelSpeechRecognition,
    stopRecording,
  ]);

  return {
    isRecording,
    isProcessing,
    durationSeconds,
    liveLevels,
    liveTranscript,
    error,
    clearError: () => setError(null),
    startRecording,
    stopAndSend: () => stopRecording('send'),
    stopAndTranscribe: () => stopRecording('transcribe'),
    cancelRecording: () => stopRecording('cancel'),
  };
}

interface VoiceMicButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  compact?: boolean;
}

export const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  onClick,
  disabled = false,
  isProcessing = false,
  compact = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || isProcessing}
    title="Enregistrer un message vocal"
    aria-label="Enregistrer un message vocal"
    className={`${
      compact ? 'p-2' : 'p-2.5'
    } rounded-full transition-colors cursor-pointer shrink-0 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {isProcessing ? (
      <Loader2 className="w-4 h-4 animate-spin text-[#0095F6]" />
    ) : (
      <Mic className="w-4 h-4" />
    )}
  </button>
);

interface VoiceRecordingBarProps {
  durationSeconds: number;
  liveLevels: number[];
  liveTranscript?: string;
  isProcessing: boolean;
  compact?: boolean;
  onCancel: () => void;
  onTranscribe?: () => void;
  onSend: () => void;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VoiceRecordingBar: React.FC<VoiceRecordingBarProps> = ({
  durationSeconds,
  liveLevels,
  liveTranscript,
  isProcessing,
  compact = false,
  onCancel,
  onTranscribe,
  onSend,
}) => {
  if (isProcessing) {
    return (
      <div className="flex items-center justify-between gap-3 w-full px-3 py-2 rounded-3xl bg-zinc-100 dark:bg-[#161619] border border-zinc-300 dark:border-white/[0.12]">
        <div className="flex items-center gap-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
          <Loader2 className="w-4 h-4 animate-spin text-[#0095F6] shrink-0" />
          <span>Transcription du message vocal en cours...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      {liveTranscript && (
        <div className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#161619] border border-zinc-200 dark:border-white/[0.08] text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2">
          {liveTranscript}
        </div>
      )}

      <div className="flex items-center gap-2 w-full bg-red-500/10 dark:bg-red-500/15 border border-red-400/40 rounded-3xl p-1.5 sm:p-2">
        <button
          type="button"
          onClick={onCancel}
          title="Annuler le message vocal"
          aria-label="Annuler le message vocal"
          className="p-2 rounded-full text-red-600 dark:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-300 tabular-nums shrink-0">
            {formatTimer(durationSeconds)}
          </span>

          {/* Barres audio en direct */}
          <div className="flex items-center gap-[3px] flex-1 h-6 overflow-hidden" aria-hidden="true">
            {liveLevels.map((lvl, idx) => (
              <span
                key={idx}
                style={{ height: `${lvl}%` }}
                className="flex-1 min-w-[2px] rounded-full bg-red-500/80 dark:bg-red-400/85 transition-[height] duration-75"
              />
            ))}
          </div>
        </div>

        {onTranscribe && (
          <button
            type="button"
            onClick={onTranscribe}
            title="Transcrire dans le champ texte"
            className="px-2.5 py-1.5 rounded-full bg-white dark:bg-white/[0.1] hover:bg-zinc-100 dark:hover:bg-white/[0.18] border border-zinc-200 dark:border-white/[0.12] text-[11px] font-semibold text-zinc-800 dark:text-white flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-[#0095F6]" />
            {!compact && <span>Transcrire</span>}
          </button>
        )}

        <button
          type="button"
          onClick={onSend}
          title="Envoyer le message vocal"
          aria-label="Envoyer le message vocal"
          className="px-3 py-2 rounded-full bg-[#0095F6] hover:bg-[#1877F2] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {!compact && <span>Envoyer</span>}
        </button>
      </div>
    </div>
  );
};

interface VoiceErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export const VoiceErrorBanner: React.FC<VoiceErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className="mb-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-400/35 text-[11px] text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="leading-snug">{message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l'alerte micro"
        className="p-0.5 rounded hover:bg-red-500/15 cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
