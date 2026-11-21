import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  X,
  Sparkles,
  Wand2,
  Check,
  Trash2,
  ArrowRight,
  Lightbulb,
  Hash,
  Video,
  MessageSquarePlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { WalkingRobot } from './WalkingRobot';
import { audioEngine } from '../utils/audioEngine';
import { VoiceNoteBubble } from './VoiceNoteBubble';
import {
  useVoiceRecorder,
  VoiceErrorBanner,
  VoiceMessagePayload,
  VoiceMicButton,
  VoiceRecordingBar,
} from './VoiceRecorderControl';
import {
  AspectRatio,
  CoachSuggestedAction,
  CreatorCoachMessage,
  GeneratedVideo,
  UserSubscription,
  VideoStyle,
} from '../types';

interface CreatorAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  user: UserSubscription;
  studioContext: {
    prompt: string;
    style: VideoStyle;
    aspectRatio: AspectRatio;
  };
  currentVideo: GeneratedVideo | null;
  onApplyPromptToStudio: (prompt: string, style?: VideoStyle) => void;
  onApplyToActiveVideo: (patch: {
    hook?: string;
    title?: string;
    hashtags?: string[];
  }) => void;
}

const INITIAL_WELCOME_MESSAGE: CreatorCoachMessage = {
  id: 'welcome-coach',
  role: 'assistant',
  content:
    'Bonjour ! Je suis votre Coach IA FOFO. Je vous accompagne pour trouver des angles viraux, muscler vos accroches des 3 premières secondes, structurer vos scripts et optimiser vos titres et hashtags.\n\nPosez-moi une question ou choisissez une action rapide ci-dessous.',
  timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  followUpQuestions: [
    'Améliore mon Hook des 3 premières secondes',
    'Donne-moi 3 idées virales sur la psychologie ou la tech',
    'Optimise mon titre et mes hashtags SEO',
  ],
};

export const CreatorAssistant: React.FC<CreatorAssistantProps> = ({
  isOpen,
  onToggle,
  onClose,
  user,
  studioContext,
  currentVideo,
  onApplyPromptToStudio,
  onApplyToActiveVideo,
}) => {
  const [messages, setMessages] = useState<CreatorCoachMessage[]>(() => {
    try {
      const saved = localStorage.getItem('fofo_coach_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [appliedMap, setAppliedMap] = useState<Record<string, string>>({});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const recent = messages.slice(-24);
    try {
      localStorage.setItem('fofo_coach_messages', JSON.stringify(recent));
    } catch {
      try {
        const compacted = recent.map((m, idx, arr) =>
          idx >= arr.length - 3 ? m : { ...m, audioUrl: undefined }
        );
        localStorage.setItem('fofo_coach_messages', JSON.stringify(compacted));
      } catch {
        try {
          const textOnly = recent.map(({ audioUrl: _omit, ...rest }) => rest);
          localStorage.setItem('fofo_coach_messages', JSON.stringify(textOnly));
        } catch {
          // ignore
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    return () => {
      audioEngine.stopSpeech();
    };
  }, []);

  const sendMessage = async (
    text: string,
    voiceData?: { audioUrl?: string; duration?: number }
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: CreatorCoachMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      audioUrl: voiceData?.audioUrl || undefined,
      audioDuration: voiceData?.duration,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    const aiMessageText =
      trimmed === 'Message vocal'
        ? "L'utilisateur vient d'envoyer un message vocal dont la parole n'a pas pu être transcrite. Invite-le gentiment à réessayer ou à taper sa question."
        : trimmed;

    try {
      const res = await fetch('/api/creator-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiMessageText,
          history: nextHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          context: {
            currentPrompt: studioContext.prompt,
            currentStyle: studioContext.style,
            currentAspectRatio: studioContext.aspectRatio,
            activeVideoTitle: currentVideo?.title || '',
            activeVideoHook: currentVideo?.hook || '',
            activeVideoScenesCount: currentVideo?.scenes.length || 0,
            userPlan: user.plan,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur du Coach IA');
      }

      const action: CoachSuggestedAction | undefined =
        data.suggestedPrompt ||
        data.suggestedHook ||
        data.suggestedTitle ||
        (Array.isArray(data.suggestedHashtags) && data.suggestedHashtags.length > 0)
          ? {
              suggestedPrompt: data.suggestedPrompt,
              suggestedHook: data.suggestedHook,
              suggestedTitle: data.suggestedTitle,
              suggestedHashtags: data.suggestedHashtags,
              recommendedStyle: data.recommendedStyle,
            }
          : undefined;

      const assistantMsg: CreatorCoachMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Voici mes recommandations pour votre prochaine vidéo.',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        action,
        followUpQuestions: Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: CreatorCoachMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content:
          err?.message ||
          'La connexion avec le Coach IA a rencontré un imprévu. Essayez de reformuler votre demande ou cliquez sur une suggestion ci-dessous.',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        followUpQuestions: ['Donne-moi 3 idées virales', 'Améliore mon Hook 3s'],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    audioEngine.stopSpeech();
    setSpeakingMsgId(null);
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setAppliedMap({});
  };

  const markApplied = (msgId: string, label: string) => {
    setAppliedMap((prev) => ({ ...prev, [msgId]: label }));
  };

  const handleSpeakMessage = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      audioEngine.stopSpeech();
      setSpeakingMsgId(null);
      return;
    }
    setSpeakingMsgId(msgId);
    audioEngine.speakText(text, currentVideo?.voiceId || 'mathieu', {
      preferGeminiTts: true,
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
    });
  };

  const voiceRecorder = useVoiceRecorder({
    onSendVoiceMessage: ({ text, audioUrl, duration }: VoiceMessagePayload) => {
      sendMessage(text, { audioUrl, duration });
    },
    onTranscribeToInput: (transcript) => {
      setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
    },
  });

  return (
    <>
      {/* Bouton flottant d'ouverture du Coach IA */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
          <div className="w-40 mb-[-4px] pr-1 pointer-events-none">
            <WalkingRobot mode="patrol" size={30} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full font-heading text-xs font-bold text-zinc-900 dark:text-white bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.14] shadow-2xl hover:border-zinc-400 dark:hover:border-white/30 hover:scale-[1.03] transition-all cursor-pointer whitespace-nowrap"
            aria-label="Ouvrir le Coach IA Créateur"
          >
            <WalkingRobot mode="compact" size={24} />
            <span>Coach IA Créateur</span>
          </button>
        </div>
      )}

      {/* Panneau latéral / flottant du Coach IA */}
      {isOpen && (
        <aside
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[min(640px,calc(100vh-5rem))] rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
          aria-label="Coach IA Créateur FOFO"
        >
          {/* En-tête du Coach IA */}
          <div className="px-4 pt-3 pb-2 bg-zinc-50 dark:bg-[#0B0B0D] border-b border-zinc-200 dark:border-white/[0.08] shrink-0 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full p-[2px] ig-story-ring shrink-0">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                    <WalkingRobot mode="compact" size={26} />
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">Coach IA Créateur</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {currentVideo
                      ? `Contexte : ${currentVideo.title}`
                      : studioContext.prompt
                      ? 'Contexte : Brouillon du Studio'
                      : 'Stratégie, Hooks & Scripts viraux'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Nouvelle conversation"
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title="Fermer le Coach IA"
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <WalkingRobot mode="patrol" size={26} />
          </div>

          {/* Barre d'actions rapides contextuelles */}
          <div className="px-3 py-2 bg-zinc-50 dark:bg-[#09090B] border-b border-zinc-200 dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() =>
                sendMessage(
                  currentVideo
                    ? `Analyse et améliore le Hook de ma vidéo "${currentVideo.title}" (Hook actuel : "${currentVideo.hook}")`
                    : 'Propose un Hook explosif des 3 premières secondes pour mon prochain Short viral'
                )
              }
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-[#18181B] dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] text-[11px] font-medium text-zinc-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-[#DD2A7B]" />
              <span>Hook 3s</span>
            </button>
            <button
              type="button"
              onClick={() =>
                sendMessage(
                  studioContext.prompt
                    ? `Donne-moi 3 variantes virales autour de : "${studioContext.prompt}"`
                    : 'Propose-moi 3 idées de vidéos TikTok / Shorts qui performent fort en ce moment'
                )
              }
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-[#18181B] dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] text-[11px] font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Lightbulb className="w-3 h-3 text-amber-500 dark:text-amber-300" />
              <span>Idées virales</span>
            </button>
            <button
              type="button"
              onClick={() =>
                sendMessage(
                  currentVideo
                    ? `Optimise le titre et les hashtags SEO pour "${currentVideo.title}"`
                    : 'Quels titres et hashtags utiliser pour maximiser la portée organique ?'
                )
              }
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-[#18181B] dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] text-[11px] font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Hash className="w-3 h-3 text-[#0095F6]" />
              <span>Titre & SEO</span>
            </button>
            <button
              type="button"
              onClick={() =>
                sendMessage(
                  'Donne-moi un plan de publication hebdomadaire pour passer de 0 à 100k vues avec des vidéos courtes'
                )
              }
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-[#18181B] dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] text-[11px] font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Video className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Stratégie 7j</span>
            </button>
          </div>

          {/* Flux de messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/70 dark:bg-black/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-[#5B51D8] to-[#0095F6] text-white rounded-br-sm'
                      : 'bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-100 rounded-bl-sm shadow-xs dark:shadow-none'
                  }`}
                >
                  {msg.role === 'user' && msg.audioUrl ? (
                    <VoiceNoteBubble
                      audioUrl={msg.audioUrl}
                      duration={msg.audioDuration}
                      transcript={msg.content}
                      variant="user"
                      compact
                    />
                  ) : (
                    msg.content
                  )}

                  {/* Bloc d'action directe si l'IA propose un prompt, hook ou titre */}
                  {msg.role === 'assistant' && msg.action && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08] space-y-2.5">
                      {msg.action.suggestedPrompt && (
                        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2">
                          <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Sujet prêt pour le Studio
                          </div>
                          <p className="text-xs text-zinc-900 dark:text-white font-medium">
                            {msg.action.suggestedPrompt}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onApplyPromptToStudio(
                                msg.action!.suggestedPrompt!,
                                msg.action!.recommendedStyle
                              );
                              markApplied(msg.id + '-prompt', 'Sujet appliqué au Studio');
                            }}
                            className="w-full py-2 px-3 rounded-lg bg-[#0095F6] hover:bg-[#1877F2] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {appliedMap[msg.id + '-prompt'] ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{appliedMap[msg.id + '-prompt']}</span>
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3.5 h-3.5" />
                                <span>Utiliser ce sujet dans le Studio</span>
                                <ArrowRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {(msg.action.suggestedHook ||
                        msg.action.suggestedTitle ||
                        (msg.action.suggestedHashtags && msg.action.suggestedHashtags.length > 0)) && (
                        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-1.5">
                          {msg.action.suggestedHook && (
                            <p className="text-[11px] text-zinc-700 dark:text-zinc-200">
                              <strong className="text-zinc-900 dark:text-white">Hook :</strong> {msg.action.suggestedHook}
                            </p>
                          )}
                          {msg.action.suggestedTitle && (
                            <p className="text-[11px] text-zinc-700 dark:text-zinc-200">
                              <strong className="text-zinc-900 dark:text-white">Titre :</strong> {msg.action.suggestedTitle}
                            </p>
                          )}
                          {msg.action.suggestedHashtags && msg.action.suggestedHashtags.length > 0 && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              {msg.action.suggestedHashtags.join(' ')}
                            </p>
                          )}

                          {currentVideo && (
                            <button
                              type="button"
                              onClick={() => {
                                onApplyToActiveVideo({
                                  hook: msg.action?.suggestedHook,
                                  title: msg.action?.suggestedTitle,
                                  hashtags: msg.action?.suggestedHashtags,
                                });
                                markApplied(msg.id + '-video', 'Appliqué à la vidéo active');
                              }}
                              className="w-full mt-1 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {appliedMap[msg.id + '-video'] ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{appliedMap[msg.id + '-video']}</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Appliquer à ma vidéo active</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Questions de suivi suggérées */}
                {msg.role === 'assistant' &&
                  msg.followUpQuestions &&
                  msg.followUpQuestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[95%]">
                      {msg.followUpQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => sendMessage(q)}
                          disabled={isLoading}
                          className="text-left px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 dark:bg-[#161619] dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <MessageSquarePlus className="w-3 h-3 text-[#0095F6] shrink-0" />
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
                  )}

                <div className="mt-1 flex items-center gap-2 px-1">
                  <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                    {msg.timestamp}
                  </span>

                  {msg.role === 'assistant' && msg.content && (
                    <button
                      type="button"
                      onClick={() => handleSpeakMessage(msg.id, msg.content)}
                      title={
                        speakingMsgId === msg.id
                          ? 'Arrêter la lecture vocale'
                          : 'Écouter la réponse'
                      }
                      aria-label={
                        speakingMsgId === msg.id
                          ? 'Arrêter la lecture vocale'
                          : 'Écouter la réponse'
                      }
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        speakingMsgId === msg.id
                          ? 'text-[#0095F6] animate-pulse'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {speakingMsgId === msg.id ? (
                        <VolumeX className="w-3 h-3" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-[#DD2A7B]" />
                  <span>Le Coach IA analyse votre demande...</span>
                </div>
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>

          {/* Zone de saisie + message vocal */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3 bg-zinc-50 dark:bg-[#0B0B0D] border-t border-zinc-200 dark:border-white/[0.08] shrink-0"
          >
            <VoiceErrorBanner
              message={voiceRecorder.error}
              onDismiss={voiceRecorder.clearError}
            />

            {voiceRecorder.isRecording || voiceRecorder.isProcessing ? (
              <VoiceRecordingBar
                durationSeconds={voiceRecorder.durationSeconds}
                liveLevels={voiceRecorder.liveLevels}
                liveTranscript={voiceRecorder.liveTranscript}
                isProcessing={voiceRecorder.isProcessing}
                compact
                onCancel={voiceRecorder.cancelRecording}
                onTranscribe={voiceRecorder.stopAndTranscribe}
                onSend={voiceRecorder.stopAndSend}
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <VoiceMicButton
                  onClick={voiceRecorder.startRecording}
                  disabled={isLoading}
                  isProcessing={voiceRecorder.isProcessing}
                  compact
                />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Écrivez ou envoyez un vocal..."
                  className="flex-1 min-w-0 bg-white dark:bg-[#161619] border border-zinc-200 dark:border-white/[0.08] focus:border-zinc-400 dark:focus:border-white/25 rounded-full px-3.5 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`p-2.5 rounded-full transition-all cursor-pointer shrink-0 ${
                    !input.trim() || isLoading
                      ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                      : 'bg-[#0095F6] hover:bg-[#1877F2] text-white'
                  }`}
                  aria-label="Envoyer au Coach IA"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>
        </aside>
      )}
    </>
  );
};
