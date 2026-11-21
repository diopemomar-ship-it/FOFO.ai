import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Wand2,
  Check,
  Trash2,
  Volume2,
  VolumeX,
  Film,
  Compass,
  Sliders,
  TrendingUp,
  ArrowRight,
  Plus,
  MessageSquare,
  PanelLeft,
  Copy,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import {
  AIBotDiscussion,
  AIBotMessage,
  AIModelEngine,
  AspectRatio,
  BotExecutableAction,
  BotPersona,
  GeneratedVideo,
  UserSubscription,
  VideoStyle,
} from '../types';
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

interface AIBotViewProps {
  user: UserSubscription;
  studioContext: {
    prompt: string;
    style: VideoStyle;
    aspectRatio: AspectRatio;
  };
  currentVideo: GeneratedVideo | null;
  onExecuteAction: (action: BotExecutableAction) => void;
}

const PERSONAS: {
  id: BotPersona;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'assistant', label: 'Assistant', icon: <Bot className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> },
  { id: 'scriptwriter', label: 'Scénariste', icon: <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" /> },
  { id: 'editor', label: 'Monteur', icon: <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> },
  { id: 'growth', label: 'Croissance', icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> },
];

const CONVERSATION_STARTERS: string[] = [
  'Discutons d’une idée de vidéo virale pour cette semaine',
  'Génère une vidéo de 45s sur les mystères des abysses',
  'Comment améliorer l’accroche de ma vidéo active ?',
  'Aide-moi à rédiger un script TikTok captivant en 4 scènes',
];

const BOT_MODELS: { id: AIModelEngine; label: string }[] = [
  { id: 'chatgpt-astra', label: 'ChatGPT Astra' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini 4' },
  { id: 'grok', label: 'Grok 3' },
  { id: 'deepseek', label: 'DeepSeek R1' },
  { id: 'mistral', label: 'Mistral Large' },
  { id: 'perplexity', label: 'Perplexity Sonar' },
  { id: 'llama', label: 'Llama 4' },
  { id: 'qwen', label: 'Qwen 3 Max' },
  { id: 'cohere-command', label: 'Command A' },
  { id: 'kimi', label: 'Kimi k1.5' },
  { id: 'nova-pro', label: 'Nova Pro' },
];

const STORAGE_KEY = 'fofo_ai_bot_discussions';

const createEmptyDiscussion = (
  persona: BotPersona = 'assistant',
  aiModel: AIModelEngine = 'chatgpt-astra'
): AIBotDiscussion => ({
  id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  title: 'Nouvelle discussion',
  persona,
  aiModel,
  updatedAt: new Date().toISOString(),
  messages: [],
});

export const AIBotView: React.FC<AIBotViewProps> = ({
  user,
  studioContext,
  currentVideo,
  onExecuteAction,
}) => {
  const [discussions, setDiscussions] = useState<AIBotDiscussion[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [createEmptyDiscussion('assistant')];
  });

  const [activeDiscussionId, setActiveDiscussionId] = useState<string>(() => {
    return discussions[0]?.id || '';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeDiscussion =
    discussions.find((d) => d.id === activeDiscussionId) || discussions[0];

  useEffect(() => {
    if (!discussions.some((d) => d.id === activeDiscussionId) && discussions[0]) {
      setActiveDiscussionId(discussions[0].id);
    }
  }, [discussions, activeDiscussionId]);

  useEffect(() => {
    const recent = discussions.slice(0, 20);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // En cas de quota dépassé (notes audio volumineuses), préserver le texte en retirant les plus vieux blobs audio
      try {
        const compacted = recent.map((d, dIdx) => ({
          ...d,
          messages: d.messages.map((m, mIdx, arr) =>
            dIdx === 0 && mIdx >= arr.length - 4 ? m : { ...m, audioUrl: undefined }
          ),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
      } catch {
        try {
          const textOnly = recent.map((d) => ({
            ...d,
            messages: d.messages.map(({ audioUrl: _omit, ...rest }) => rest),
          }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(textOnly));
        } catch {
          // ignore
        }
      }
    }
  }, [discussions]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeDiscussion?.messages.length, isStreaming]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      audioEngine.stopSpeech();
    };
  }, []);

  const updateDiscussion = (
    discussionId: string,
    updater: (prev: AIBotDiscussion) => AIBotDiscussion
  ) => {
    setDiscussions((prev) => prev.map((d) => (d.id === discussionId ? updater(d) : d)));
  };

  const handleNewDiscussion = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const fresh = createEmptyDiscussion(
      activeDiscussion?.persona || 'assistant',
      activeDiscussion?.aiModel || 'chatgpt-astra'
    );
    setDiscussions((prev) => [fresh, ...prev]);
    setActiveDiscussionId(fresh.id);
    setIsSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleDeleteDiscussion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (discussions.length === 1) {
      const fresh = createEmptyDiscussion(
        activeDiscussion?.persona || 'assistant',
        activeDiscussion?.aiModel || 'chatgpt-astra'
      );
      setDiscussions([fresh]);
      setActiveDiscussionId(fresh.id);
      return;
    }
    setDiscussions((prev) => prev.filter((d) => d.id !== id));
  };

  const handleChangePersona = (persona: BotPersona) => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (d) => ({ ...d, persona }));
  };

  const handleChangeAiModel = (aiModel: AIModelEngine) => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (d) => ({ ...d, aiModel }));
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const streamBotReply = async (
    targetDiscussionId: string,
    userText: string,
    historyMessages: AIBotMessage[],
    persona: BotPersona,
    aiModel: AIModelEngine = 'chatgpt-astra'
  ) => {
    const botMsgId = `bot-${Date.now()}`;
    const placeholderBotMsg: AIBotMessage = {
      id: botMsgId,
      role: 'bot',
      content: '',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      persona,
      aiModel,
      executed: false,
    };

    updateDiscussion(targetDiscussionId, (d) => ({
      ...d,
      updatedAt: new Date().toISOString(),
      messages: [...d.messages, placeholderBotMsg],
    }));

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestPayload = {
      message: userText,
      persona,
      aiModel,
      history: historyMessages.slice(-12).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      context: {
        currentPrompt: studioContext.prompt,
        currentStyle: studioContext.style,
        currentAspectRatio: studioContext.aspectRatio,
        activeVideoTitle: currentVideo?.title || '',
        activeVideoHook: currentVideo?.hook || '',
        activeVideoScenesCount: currentVideo?.scenes.length || 0,
        userPlan: user.plan,
      },
    };

    let hasReceivedText = false;

    const tryJsonFallback = async (): Promise<boolean> => {
      try {
        const jsonRes = await fetch('/api/ai-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(requestPayload),
        });
        if (!jsonRes.ok) return false;
        const data = await jsonRes.json();
        if (typeof data?.reply === 'string' && data.reply.trim()) {
          hasReceivedText = true;
          updateDiscussion(targetDiscussionId, (d) => ({
            ...d,
            messages: d.messages.map((m) =>
              m.id === botMsgId
                ? {
                    ...m,
                    content: data.reply,
                    botAction: data.botAction || m.botAction,
                    suggestions: Array.isArray(data.suggestions) ? data.suggestions : m.suggestions,
                  }
                : m
            ),
          }));
          return true;
        }
      } catch {
        // ignore fallback failure
      }
      return false;
    };

    try {
      const res = await fetch('/api/ai-bot/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok || !res.body) {
        const recovered = await tryJsonFallback();
        if (!recovered) {
          throw new Error('Réponse invalide du serveur');
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentEvent = 'message';
      let streamErrorMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (line === '') {
            currentEvent = 'message';
            continue;
          }
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const payloadRaw = line.slice(5).trim();
            if (!payloadRaw) continue;
            try {
              const payload = JSON.parse(payloadRaw);
              if (currentEvent === 'chunk' && typeof payload.text === 'string') {
                if (payload.text.length > 0) {
                  hasReceivedText = true;
                }
                updateDiscussion(targetDiscussionId, (d) => ({
                  ...d,
                  messages: d.messages.map((m) =>
                    m.id === botMsgId ? { ...m, content: m.content + payload.text } : m
                  ),
                }));
              } else if (currentEvent === 'meta') {
                updateDiscussion(targetDiscussionId, (d) => ({
                  ...d,
                  messages: d.messages.map((m) =>
                    m.id === botMsgId
                      ? {
                          ...m,
                          botAction: payload.botAction || undefined,
                          suggestions: Array.isArray(payload.suggestions)
                            ? payload.suggestions
                            : m.suggestions,
                        }
                      : m
                  ),
                }));
              } else if (currentEvent === 'error' && typeof payload?.message === 'string') {
                streamErrorMessage = payload.message;
              }
            } catch {
              // ignore partial JSON
            }
          }
        }
      }

      if (!hasReceivedText) {
        const recovered = await tryJsonFallback();
        if (!recovered) {
          updateDiscussion(targetDiscussionId, (d) => ({
            ...d,
            messages: d.messages.map((m) =>
              m.id === botMsgId && !m.content
                ? {
                    ...m,
                    content:
                      streamErrorMessage ||
                      'Aucune réponse reçue du serveur. Clique sur « Régénérer » ou renvoie ton message.',
                  }
                : m
            ),
          }));
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const recovered = !hasReceivedText ? await tryJsonFallback() : false;
        if (!recovered) {
          updateDiscussion(targetDiscussionId, (d) => ({
            ...d,
            messages: d.messages.map((m) =>
              m.id === botMsgId && !m.content
                ? {
                    ...m,
                    content:
                      'La connexion a été interrompue. Tu peux cliquer sur « Régénérer » ou renvoyer ton message.',
                  }
                : m
            ),
          }));
        }
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !activeDiscussion) return;

    const userMsg: AIBotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...activeDiscussion.messages, userMsg];
    const shouldAutoTitle = activeDiscussion.messages.length === 0;
    const autoTitle = trimmed.length > 38 ? `${trimmed.slice(0, 38)}...` : trimmed;

    updateDiscussion(activeDiscussion.id, (d) => ({
      ...d,
      title: shouldAutoTitle ? autoTitle : d.title,
      updatedAt: new Date().toISOString(),
      messages: nextHistory,
    }));

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await streamBotReply(
      activeDiscussion.id,
      trimmed,
      nextHistory,
      activeDiscussion.persona,
      activeDiscussion.aiModel || 'chatgpt-astra'
    );
  };

  const handleSendVoiceMessage = async ({ text, audioUrl, duration }: VoiceMessagePayload) => {
    if (isStreaming || !activeDiscussion) return;
    const cleanText = text.trim() || 'Message vocal';

    const userMsg: AIBotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      audioUrl: audioUrl || undefined,
      audioDuration: duration,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...activeDiscussion.messages, userMsg];
    const shouldAutoTitle = activeDiscussion.messages.length === 0;
    const autoTitle = cleanText.length > 38 ? `${cleanText.slice(0, 38)}...` : cleanText;

    updateDiscussion(activeDiscussion.id, (d) => ({
      ...d,
      title: shouldAutoTitle ? autoTitle : d.title,
      updatedAt: new Date().toISOString(),
      messages: nextHistory,
    }));

    const aiPromptText =
      cleanText === 'Message vocal'
        ? "L'utilisateur vient d'envoyer un message vocal dont la parole n'a pas pu être transcrite. Demande-lui poliment de préciser sa demande par écrit ou de parler un peu plus près du micro."
        : cleanText;

    await streamBotReply(
      activeDiscussion.id,
      aiPromptText,
      nextHistory,
      activeDiscussion.persona,
      activeDiscussion.aiModel || 'chatgpt-astra'
    );
  };

  const voiceRecorder = useVoiceRecorder({
    onSendVoiceMessage: handleSendVoiceMessage,
    onTranscribeToInput: (transcript) => {
      setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
          textareaRef.current.focus();
        }
      }, 20);
    },
  });

  const handleRegenerateLast = async () => {
    if (!activeDiscussion || isStreaming) return;
    const msgs = activeDiscussion.messages;
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;

    const actualIdx = msgs.length - 1 - lastUserIdx;
    const lastUserMsg = msgs[actualIdx];
    const trimmedHistory = msgs.slice(0, actualIdx + 1);

    updateDiscussion(activeDiscussion.id, (d) => ({
      ...d,
      messages: trimmedHistory,
    }));

    await streamBotReply(
      activeDiscussion.id,
      lastUserMsg.content,
      trimmedHistory,
      activeDiscussion.persona,
      activeDiscussion.aiModel || 'chatgpt-astra'
    );
  };

  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1800);
  };

  const handleSpeakReply = (msgId: string, text: string) => {
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

  const handleRunBotAction = (msgId: string, action: BotExecutableAction) => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (d) => ({
      ...d,
      messages: d.messages.map((m) => (m.id === msgId ? { ...m, executed: true } : m)),
    }));
    onExecuteAction(action);
  };

  const renderActionIcon = (type: BotExecutableAction['type']) => {
    if (type === 'generate_video') return <Film className="w-4 h-4 text-cyan-300 dark:text-cyan-600" />;
    if (type === 'update_active_video') return <Wand2 className="w-4 h-4 text-emerald-300 dark:text-emerald-600" />;
    if (type === 'navigate') return <Compass className="w-4 h-4 text-blue-300 dark:text-blue-600" />;
    return <Sparkles className="w-4 h-4 text-amber-300 dark:text-amber-600" />;
  };

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="relative rounded-3xl bg-white dark:bg-[#0B0B0D] border border-zinc-200 dark:border-white/[0.08] shadow-sm dark:shadow-none overflow-hidden flex h-[calc(100vh-11rem)] min-h-[580px]">
        {/* Sidebar des Discussions (Desktop fixe + Mobile overlay) */}
        <aside
          className={`${
            isSidebarOpen
              ? 'fixed inset-y-0 left-0 z-50 w-72 flex'
              : 'hidden md:flex md:w-72'
          } flex-col bg-zinc-50 dark:bg-[#08080A] border-r border-zinc-200 dark:border-white/[0.08] shrink-0`}
        >
          <div className="p-3.5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleNewDiscussion}
              className="flex-1 py-2.5 px-3 rounded-xl electric-button-gradient text-white text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle discussion</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Fermer la liste des discussions"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold text-zinc-500">
              Discussions ({discussions.length})
            </div>

            {discussions.map((disc) => {
              const isActive = disc.id === activeDiscussion?.id;
              const lastMsg = disc.messages[disc.messages.length - 1];
              return (
                <div
                  key={disc.id}
                  onClick={() => {
                    if (!isStreaming) {
                      setActiveDiscussionId(disc.id);
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`group flex items-start justify-between gap-2 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-200/75 dark:bg-white/[0.08] border-zinc-300 dark:border-white/[0.14] text-zinc-950 dark:text-white'
                      : 'bg-transparent border-transparent hover:bg-zinc-100 dark:hover:bg-white/[0.04] text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MessageSquare
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{disc.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {lastMsg
                          ? lastMsg.content.slice(0, 42)
                          : 'Aucun message pour le moment'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteDiscussion(disc.id, e)}
                    title="Supprimer cette discussion"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Backdrop mobile sidebar */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 md:hidden"
          />
        )}

        {/* Zone Principale de Discussion */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-50/70 dark:bg-black">
          {/* Barre supérieure épurée */}
          <div className="px-4 py-3 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                aria-label="Ouvrir les discussions"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 rounded-full ig-story-ring p-[1.5px] shrink-0">
                <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                  <WalkingRobot mode="compact" size={22} />
                </div>
              </div>

              <div className="min-w-0">
                <h2 className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                  {activeDiscussion?.title || 'Discussion Bot AI'}
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {currentVideo
                    ? `Contexte actif : ${currentVideo.title}`
                    : 'Discussion ouverte avec FOFO Bot'}
                </p>
              </div>
            </div>

            {/* Sélecteur de Modèle IA & Modes rapides */}
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#09090B] p-1 rounded-xl border border-zinc-200 dark:border-white/[0.08] overflow-x-auto max-w-full">
                {BOT_MODELS.map((m) => {
                  const isSelected = (activeDiscussion?.aiModel || 'chatgpt-astra') === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleChangeAiModel(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#09090B] p-1 rounded-xl border border-zinc-200 dark:border-white/[0.08] overflow-x-auto">
                {PERSONAS.map((p) => {
                  const isSelected = activeDiscussion?.persona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChangePersona(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-white dark:bg-white/[0.14] text-zinc-950 dark:text-white shadow-xs dark:shadow-none'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {p.icon}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fil de discussion */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
            {(!activeDiscussion || activeDiscussion.messages.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8 space-y-6">
                <div className="w-16 h-16 rounded-full ig-story-ring p-[2px]">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                    <WalkingRobot mode="compact" size={38} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-heading text-xl font-bold text-zinc-950 dark:text-white">
                    Démarrez une discussion avec FOFO Bot
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Posez n’importe quelle question, brainstormez des idées, peaufinez un script ou demandez-lui de générer directement une vidéo dans le Studio.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  {CONVERSATION_STARTERS.map((starter, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(starter)}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-left text-xs text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer flex items-start justify-between gap-2 shadow-xs dark:shadow-none"
                    >
                      <span className="leading-relaxed">{starter}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeDiscussion.messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isLastBotMsg =
                  !isUser && idx === activeDiscussion.messages.length - 1;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 max-w-3xl ${
                      isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden ${
                        isUser
                          ? 'bg-[#0095F6] text-white text-xs font-bold'
                          : 'ig-story-ring p-[1.5px]'
                      }`}
                    >
                      {isUser ? (
                        user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{user.name.slice(0, 1).toUpperCase()}</span>
                        )
                      ) : (
                        <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                          <Bot className="w-4 h-4 text-zinc-900 dark:text-white" />
                        </div>
                      )}
                    </div>

                    {/* Bulle de discussion style Instagram Direct */}
                    <div
                      className={`flex flex-col ${
                        isUser ? 'items-end' : 'items-start'
                      } min-w-0 max-w-[85%]`}
                    >
                      <div
                        className={`rounded-3xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                          isUser
                            ? 'bg-gradient-to-br from-[#5B51D8] to-[#0095F6] text-white rounded-br-md'
                            : 'bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 rounded-bl-md shadow-xs dark:shadow-none'
                        }`}
                      >
                        {isUser && msg.audioUrl ? (
                          <VoiceNoteBubble
                            audioUrl={msg.audioUrl}
                            duration={msg.audioDuration}
                            transcript={msg.content}
                            variant="user"
                          />
                        ) : (
                          msg.content || (
                            <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-300 animate-bounce" />
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-300 animate-bounce [animation-delay:120ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-300 animate-bounce [animation-delay:240ms]" />
                            </span>
                          )
                        )}
                        {isStreaming && isLastBotMsg && msg.content && (
                          <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-zinc-900 dark:bg-white animate-pulse" />
                        )}

                        {!isUser && msg.botAction && (
                          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
                            <button
                              type="button"
                              disabled={msg.executed}
                              onClick={() => handleRunBotAction(msg.id, msg.botAction!)}
                              className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                msg.executed
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 cursor-default'
                                  : 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:border-white dark:hover:bg-zinc-200'
                              }`}
                            >
                              <span className="flex items-center gap-2 text-left">
                                {msg.executed ? (
                                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  renderActionIcon(msg.botAction.type)
                                )}
                                <span>
                                  {msg.executed
                                    ? `Action effectuée : ${msg.botAction.label}`
                                    : msg.botAction.label}
                                </span>
                              </span>
                              {!msg.executed && (
                                <ArrowRight className="w-4 h-4 shrink-0" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 px-1">
                        <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                          {msg.timestamp}
                        </span>

                        {!isUser && msg.content && !(isStreaming && isLastBotMsg) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.id, msg.content)}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                              title="Copier le message"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSpeakReply(msg.id, msg.content)}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                speakingMsgId === msg.id
                                  ? 'text-[#0095F6] animate-pulse'
                                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                              }`}
                              title={
                                speakingMsgId === msg.id
                                  ? 'Arrêter la lecture vocale'
                                  : 'Écouter à voix haute'
                              }
                            >
                              {speakingMsgId === msg.id ? (
                                <VolumeX className="w-3.5 h-3.5" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {isLastBotMsg && (
                              <button
                                type="button"
                                onClick={handleRegenerateLast}
                                className="p-1 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                                title="Régénérer la réponse"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {!isUser &&
                        isLastBotMsg &&
                        !isStreaming &&
                        msg.suggestions &&
                        msg.suggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.suggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleSendMessage(sug)}
                                className="px-3 py-1 rounded-full bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/[0.12] border border-zinc-200 dark:border-white/[0.08] text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={scrollEndRef} />
          </div>

          {/* Zone de saisie multi-lignes + message vocal */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="p-3 sm:p-4 bg-white dark:bg-[#0B0B0D] border-t border-zinc-200 dark:border-white/[0.08] shrink-0"
          >
            <div className="max-w-3xl mx-auto">
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
                  onCancel={voiceRecorder.cancelRecording}
                  onTranscribe={voiceRecorder.stopAndTranscribe}
                  onSend={voiceRecorder.stopAndSend}
                />
              ) : (
                <div className="flex items-end gap-2 bg-zinc-100 dark:bg-[#161619] border border-zinc-300 dark:border-white/[0.1] focus-within:border-zinc-500 dark:focus-within:border-white/30 rounded-3xl p-2 transition-colors">
                  <VoiceMicButton
                    onClick={voiceRecorder.startRecording}
                    disabled={isStreaming}
                    isProcessing={voiceRecorder.isProcessing}
                  />

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(input);
                      }
                    }}
                    placeholder="Écrivez ou envoyez un message vocal..."
                    className="flex-1 bg-transparent px-2 py-1.5 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none max-h-36"
                  />

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      className="p-2.5 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-400/50 text-red-600 dark:text-red-200 cursor-pointer shrink-0 transition-colors"
                      title="Arrêter la réponse"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className={`p-2.5 rounded-full transition-all cursor-pointer shrink-0 ${
                        !input.trim()
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                          : 'bg-[#0095F6] hover:bg-[#1877F2] text-white'
                      }`}
                      aria-label="Envoyer le message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
