import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  Volume2,
  Smartphone,
  Tv,
  Square,
  Wand2,
  Sliders,
  Music,
  Type,
  Layers,
  Flame,
  Plus,
  ImagePlus,
  X,
  Cpu,
  BookOpen,
  Film,
  Orbit,
  Search,
  Loader2,
  Check,
  Image as ImageIcon,
  BookmarkPlus,
  Users,
  Music2,
} from 'lucide-react';
import {
  AspectRatio,
  VideoStyle,
  CaptionStyle,
  MusicMood,
  SceneTransition,
  UserSubscription,
  ImportedMediaItem,
  AIModelEngine,
  ContentNiche,
  TrendingEffectId,
  TrendingSfxId,
  ImageMotionPreset,
  ImageMotionIntensity,
  ImageVideoEngine,
  StockImageResult,
  LibraryItem,
  CreatorPersona,
} from '../types';
import {
  VOICES,
  VIDEO_STYLES,
  CAPTION_STYLES,
  DEFAULT_KARAOKE_HIGHLIGHT_COLOR,
  KARAOKE_HIGHLIGHT_COLORS,
  MUSIC_MOODS,
  SCENE_TRANSITIONS,
  AI_MODEL_ENGINES,
  CONTENT_NICHES,
  TRENDING_EFFECT_LIST,
  TRENDING_SFX_LIST,
  IMAGE_MOTION_PRESETS,
  IMAGE_VIDEO_ENGINES,
  FAMOUS_CREATOR_PERSONAS,
} from '../data/mockTemplates';
import { audioEngine } from '../utils/audioEngine';
import { processUploadedMediaFiles } from '../utils/mediaImport';
import { loadStudioDraft, saveStudioDraft } from '../utils/autoSave';
import { estimateSceneCountForDuration, formatDurationShort } from '../utils/durationFormat';
import { WalkingRobot } from './WalkingRobot';
import { CreatorAvatar } from './CreatorAvatar';

interface HeroStudioProps {
  onGenerate: (config: {
    prompt: string;
    aspectRatio: AspectRatio;
    duration: number;
    voiceId: string;
    style: VideoStyle;
    musicMood: MusicMood;
    captionStyle: CaptionStyle;
    karaokeHighlightColor?: string;
    defaultTransition?: SceneTransition;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    aiModel?: AIModelEngine;
    niche?: ContentNiche;
    uploadedMedia?: ImportedMediaItem[];
  }) => void;
  onImportMediaProject?: (config: {
    media: ImportedMediaItem[];
    prompt: string;
    aspectRatio: AspectRatio;
    voiceId: string;
    style: VideoStyle;
    musicMood: MusicMood;
    captionStyle: CaptionStyle;
    karaokeHighlightColor?: string;
    defaultTransition: SceneTransition;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    aiModel?: AIModelEngine;
    niche?: ContentNiche;
  }) => void;
  onGenerateImageToVideo?: (config: {
    media: ImportedMediaItem[];
    motionPrompt: string;
    motionPreset: ImageMotionPreset | 'auto';
    imageVideoEngine: ImageVideoEngine;
    motionIntensity: ImageMotionIntensity;
    clipDuration: number;
    aspectRatio: AspectRatio;
    voiceId: string;
    style: VideoStyle;
    musicMood: MusicMood;
    captionStyle: CaptionStyle;
    karaokeHighlightColor?: string;
    defaultTransition: SceneTransition;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    aiModel?: AIModelEngine;
    niche?: ContentNiche;
  }) => void;
  isGenerating: boolean;
  user: UserSubscription;
  openPricingModal: () => void;
  onScrollToPlayer?: () => void;
  externalDraft?: {
    prompt: string;
    style?: VideoStyle;
    aspectRatio?: AspectRatio;
    duration?: number;
    voiceId?: string;
    musicMood?: MusicMood;
    captionStyle?: CaptionStyle;
    karaokeHighlightColor?: string;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    creatorName?: string;
    id: number;
  } | null;
  onOpenCoach?: () => void;
  onOpenTemplates?: () => void;
  onContextChange?: (ctx: { prompt: string; style: VideoStyle; aspectRatio: AspectRatio }) => void;
  onDraftSaved?: (savedAt: string) => void;
  hasActiveVideo?: boolean;
  onAddSceneToCurrentVideo?: (item: { name: string; previewUrl: string; query?: string }) => void;
  customVoices?: LibraryItem[];
  externalMediaRush?: { item: ImportedMediaItem; id: number } | null;
  externalVoiceSelection?: { voiceId: string; id: number } | null;
  onSaveToLibrary?: (item: LibraryItem) => void;
  onOpenAnimateStudio?: () => void;
}

type DirectorTab = 'engine' | 'style' | 'audio';
type CreationMode = 'text' | 'image-to-video';

const STOCK_QUICK_TOPICS = ['Espace', 'Nature', 'Tech & IA', 'Ville', 'Business', 'Sport'];

export const HeroStudio: React.FC<HeroStudioProps> = ({
  onGenerate,
  onImportMediaProject,
  onGenerateImageToVideo,
  isGenerating,
  user,
  openPricingModal,
  externalDraft,
  onOpenCoach,
  onOpenTemplates,
  onContextChange,
  onDraftSaved,
  hasActiveVideo = false,
  onAddSceneToCurrentVideo,
  customVoices = [],
  externalMediaRush,
  externalVoiceSelection,
  onSaveToLibrary,
  onOpenAnimateStudio,
}) => {
  const [savedDraft] = useState(() => loadStudioDraft());
  const [creationMode, setCreationMode] = useState<CreationMode>(() =>
    savedDraft?.uploadedMedia && savedDraft.uploadedMedia.some((m) => m.mediaType === 'image')
      ? 'image-to-video'
      : 'text'
  );
  const [prompt, setPrompt] = useState<string>(() => savedDraft?.prompt || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => savedDraft?.aspectRatio || '9:16');
  const [duration, setDuration] = useState<number>(() => savedDraft?.duration || 45);
  const [voiceId, setVoiceId] = useState<string>(() => savedDraft?.voiceId || 'mathieu');
  const [style, setStyle] = useState<VideoStyle>(() => savedDraft?.style || 'cinematic');
  const [musicMood, setMusicMood] = useState<MusicMood>(() => savedDraft?.musicMood || 'epic');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(() => savedDraft?.captionStyle || 'hormozi');
  const [karaokeHighlightColor, setKaraokeHighlightColor] = useState<string>(
    () => savedDraft?.karaokeHighlightColor || DEFAULT_KARAOKE_HIGHLIGHT_COLOR
  );
  const [defaultTransition, setDefaultTransition] = useState<SceneTransition>(() => savedDraft?.defaultTransition || 'fade');
  const [trendingEffect, setTrendingEffect] = useState<TrendingEffectId>(() => savedDraft?.trendingEffect || 'none');
  const [hookSfx, setHookSfx] = useState<TrendingSfxId | 'none'>(() => savedDraft?.hookSfx || 'impact');
  const [aiModel, setAiModel] = useState<AIModelEngine>(() => savedDraft?.aiModel || 'chatgpt-astra');
  const [niche, setNiche] = useState<ContentNiche>(() => savedDraft?.niche || 'education');
  const [imageVideoEngine, setImageVideoEngine] = useState<ImageVideoEngine>('kling-2');
  const [motionPreset, setMotionPreset] = useState<ImageMotionPreset | 'auto'>('auto');
  const [motionIntensity, setMotionIntensity] = useState<ImageMotionIntensity>('cinematic');
  const [clipDuration, setClipDuration] = useState<number>(5);
  const [activeDirectorTab, setActiveDirectorTab] = useState<DirectorTab>(() => savedDraft?.activeDirectorTab || 'engine');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playingMusicId, setPlayingMusicId] = useState<MusicMood | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<ImportedMediaItem[]>(() => savedDraft?.uploadedMedia || []);
  const [isProcessingMedia, setIsProcessingMedia] = useState<boolean>(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState<boolean>(false);
  const [stockQuery, setStockQuery] = useState<string>('');
  const [stockResults, setStockResults] = useState<StockImageResult[]>([]);
  const [stockSources, setStockSources] = useState<string[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState<boolean>(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [hasSearchedStock, setHasSearchedStock] = useState<boolean>(false);
  const [addedSceneMap, setAddedSceneMap] = useState<Record<string, boolean>>({});
  const [savedStockMap, setSavedStockMap] = useState<Record<string, boolean>>({});
  const [savedPromptFeedback, setSavedPromptFeedback] = useState<boolean>(false);
  const [activeCreatorId, setActiveCreatorId] = useState<string | null>(null);
  const [failedThumbMap, setFailedThumbMap] = useState<Record<string, boolean>>({});
  const mediaInputRef = React.useRef<HTMLInputElement | null>(null);
  const isFirstDraftMountRef = React.useRef(true);

  const draftSnapshotRef = React.useRef({
    prompt,
    aspectRatio,
    duration,
    voiceId,
    style,
    musicMood,
    captionStyle,
    karaokeHighlightColor,
    defaultTransition,
    trendingEffect,
    hookSfx,
    aiModel,
    niche,
    activeDirectorTab,
    uploadedMedia,
  });
  draftSnapshotRef.current = {
    prompt,
    aspectRatio,
    duration,
    voiceId,
    style,
    musicMood,
    captionStyle,
    karaokeHighlightColor,
    defaultTransition,
    trendingEffect,
    hookSfx,
    aiModel,
    niche,
    activeDirectorTab,
    uploadedMedia,
  };

  React.useEffect(() => {
    if (externalDraft) {
      setPrompt(externalDraft.prompt);
      if (externalDraft.style) setStyle(externalDraft.style);
      if (externalDraft.aspectRatio) setAspectRatio(externalDraft.aspectRatio);
      if (externalDraft.duration) setDuration(externalDraft.duration);
      if (externalDraft.voiceId) setVoiceId(externalDraft.voiceId);
      if (externalDraft.musicMood) setMusicMood(externalDraft.musicMood);
      if (externalDraft.captionStyle) setCaptionStyle(externalDraft.captionStyle);
      if (externalDraft.karaokeHighlightColor) {
        setKaraokeHighlightColor(externalDraft.karaokeHighlightColor);
      }
      if (externalDraft.trendingEffect) setTrendingEffect(externalDraft.trendingEffect);
      if (externalDraft.hookSfx) setHookSfx(externalDraft.hookSfx);
      if (externalDraft.creatorName) {
        const found = FAMOUS_CREATOR_PERSONAS.find((c) => c.name === externalDraft.creatorName);
        setActiveCreatorId(found ? found.id : null);
      }
    }
  }, [externalDraft]);

  const handleApplyCreatorPreset = (creator: CreatorPersona) => {
    setActiveCreatorId(creator.id);
    setPrompt(creator.sampleTopics[0].prompt);
    setAspectRatio(creator.aspectRatio);
    setDuration(creator.duration);
    setVoiceId(creator.voiceId);
    setStyle(creator.style);
    setMusicMood(creator.musicMood);
    setCaptionStyle(creator.captionStyle);
    if (creator.karaokeHighlightColor) {
      setKaraokeHighlightColor(creator.karaokeHighlightColor);
    }
    if (creator.trendingEffect) {
      setTrendingEffect(creator.trendingEffect);
    }
    if (creator.hookSfx) {
      setHookSfx(creator.hookSfx);
    }
  };

  React.useEffect(() => {
    if (externalMediaRush) {
      setUploadedMedia((prev) => {
        if (prev.some((m) => m.previewUrl === externalMediaRush.item.previewUrl)) return prev;
        return [...prev, externalMediaRush.item];
      });
    }
  }, [externalMediaRush]);

  React.useEffect(() => {
    if (externalVoiceSelection) {
      setVoiceId(externalVoiceSelection.voiceId);
      setActiveDirectorTab('audio');
    }
  }, [externalVoiceSelection]);

  React.useEffect(() => {
    onContextChange?.({ prompt, style, aspectRatio });
  }, [prompt, style, aspectRatio, onContextChange]);

  // Sauvegarde automatique locale du brouillon & paramètres du Directeur IA
  React.useEffect(() => {
    if (isFirstDraftMountRef.current) {
      isFirstDraftMountRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const savedAt = saveStudioDraft(draftSnapshotRef.current);
      if (savedAt) {
        onDraftSaved?.(savedAt);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    prompt,
    aspectRatio,
    duration,
    voiceId,
    style,
    musicMood,
    captionStyle,
    karaokeHighlightColor,
    defaultTransition,
    trendingEffect,
    hookSfx,
    aiModel,
    niche,
    activeDirectorTab,
    uploadedMedia,
    onDraftSaved,
  ]);

  React.useEffect(() => {
    const flushDraft = () => {
      saveStudioDraft(draftSnapshotRef.current);
    };
    window.addEventListener('beforeunload', flushDraft);
    return () => window.removeEventListener('beforeunload', flushDraft);
  }, []);

  const QUICK_IDEAS = [
    {
      title: 'Mystères espace',
      prompt: 'Les 3 découvertes spatiales récentes les plus troublantes qui remettent en cause les lois de la physique moderne.',
      style: 'cinematic' as VideoStyle,
      mood: 'suspense' as MusicMood,
    },
    {
      title: '5 Biais Psycho',
      prompt: '5 biais cognitifs fascinants que votre cerveau utilise chaque jour pour vous manipuler sans que vous le sachiez.',
      style: 'cyberpunk' as VideoStyle,
      mood: 'dynamic' as MusicMood,
    },
    {
      title: 'Règle 2 Minutes',
      prompt: 'La règle psychologique des 2 minutes pour vaincre la procrastination et reprogrammer votre discipline.',
      style: 'minimalist' as VideoStyle,
      mood: 'epic' as MusicMood,
    },
    {
      title: 'IA en 2030',
      prompt: 'Comment l\'intelligence artificielle et les robots humanoïdes vont transformer les métiers et le quotidien d\'ici 2030.',
      style: 'cyberpunk' as VideoStyle,
      mood: 'dynamic' as MusicMood,
    },
    {
      title: 'Empire Romain',
      prompt: 'Le mystère archéologique le plus secret de la Rome antique que les empereurs ont tenté d\'effacer de l\'histoire.',
      style: 'vintage' as VideoStyle,
      mood: 'epic' as MusicMood,
    },
    {
      title: 'Énigme Eilean Mor',
      prompt: 'L\'énigme glaçante des 3 gardiens de phare mystérieusement disparus sur une île déserte en 1900.',
      style: 'cinematic' as VideoStyle,
      mood: 'suspense' as MusicMood,
    },
    {
      title: 'Secret des 0.1%',
      prompt: 'La règle financière secrète des milliardaires qui transforme les revenus passifs en empire.',
      style: 'minimalist' as VideoStyle,
      mood: 'dynamic' as MusicMood,
    },
  ];

  const handlePreviewVoice = (vId: string, voiceName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingVoiceId === vId) {
      audioEngine.stopSpeech();
      setPlayingVoiceId(null);
      return;
    }
    setPlayingVoiceId(vId);
    audioEngine.speakText(
      `Bonjour ! Je suis ${voiceName}. Avec FOFO AI, je donne vie à vos vidéos avec un rythme captivant et une clarté parfaite.`,
      vId,
      {
        onEnd: () => setPlayingVoiceId(null),
        onError: () => setPlayingVoiceId(null),
      }
    );
  };

  const handlePreviewMusic = (moodId: MusicMood, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingMusicId === moodId) {
      audioEngine.stopBackgroundMusic();
      setPlayingMusicId(null);
      return;
    }
    setPlayingMusicId(moodId);
    audioEngine.previewMusicMood(moodId, 0.35, () => {
      setPlayingMusicId((curr) => (curr === moodId ? null : curr));
    });
  };

  const handleMediaFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingMedia(true);
    try {
      const processed = await processUploadedMediaFiles(files);
      if (processed.length > 0) {
        setUploadedMedia((prev) => [...prev, ...processed]);
        if (processed.some((p) => p.mediaType === 'image')) {
          setCreationMode('image-to-video');
        }
      }
    } finally {
      setIsProcessingMedia(false);
      if (mediaInputRef.current) {
        mediaInputRef.current.value = '';
      }
    }
  };

  const handleRemoveUploadedMedia = (id: string) => {
    setUploadedMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSearchStockImages = async (queryOverride?: string) => {
    const activeQ = (queryOverride !== undefined ? queryOverride : stockQuery).trim();
    if (!activeQ) return;
    if (queryOverride !== undefined) {
      setStockQuery(queryOverride);
    }

    setIsSearchingStock(true);
    setStockError(null);
    setHasSearchedStock(true);

    try {
      const orientation =
        aspectRatio === '16:9' ? 'landscape' : aspectRatio === '1:1' ? 'square' : 'portrait';
      const resp = await fetch(
        `/api/stock-images/search?q=${encodeURIComponent(activeQ)}&orientation=${orientation}&limit=8`
      );
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setStockResults(Array.isArray(data.results) ? data.results : []);
      setStockSources(Array.isArray(data.sources) ? data.sources : []);
      setFailedThumbMap({});
    } catch (err) {
      console.error('Erreur recherche banque images:', err);
      setStockError("Impossible de contacter la banque d'images pour le moment.");
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleAddStockToRushes = (img: StockImageResult) => {
    const safeUrl = img.proxyUrl || img.fullUrl;
    setUploadedMedia((prev) => {
      if (prev.some((m) => m.previewUrl === safeUrl)) return prev;
      return [
        ...prev,
        {
          id: `stock-${img.id}-${Date.now()}`,
          name: img.title.slice(0, 48) || 'Image libre de droits',
          mediaType: 'image',
          previewUrl: safeUrl,
          durationSeconds: 5,
        },
      ];
    });
  };

  const handleAddStockDirectScene = (img: StockImageResult) => {
    if (!onAddSceneToCurrentVideo) return;
    onAddSceneToCurrentVideo({
      name: img.title.slice(0, 48) || stockQuery || 'Visuel libre de droits',
      previewUrl: img.proxyUrl || img.fullUrl,
      query: stockQuery.trim() || undefined,
    });
    setAddedSceneMap((prev) => ({ ...prev, [img.id]: true }));
    setTimeout(() => {
      setAddedSceneMap((prev) => ({ ...prev, [img.id]: false }));
    }, 1800);
  };

  const handleSavePromptToLibrary = () => {
    if (!onSaveToLibrary || !prompt.trim()) return;
    const cleanTitle = prompt.trim().slice(0, 56) + (prompt.trim().length > 56 ? '...' : '');
    onSaveToLibrary({
      id: `lib-script-${Date.now()}`,
      type: 'script',
      title: cleanTitle,
      description: `Brouillon Studio (${style}, ${aspectRatio}, ${formatDurationShort(duration)})`,
      tags: [niche, style, 'studio'].filter(Boolean),
      createdAt: new Date().toISOString(),
      scriptData: {
        prompt: prompt.trim(),
        style,
        aspectRatio,
        duration,
        niche,
      },
    });
    setSavedPromptFeedback(true);
    setTimeout(() => setSavedPromptFeedback(false), 1800);
  };

  const handleSaveStockImageToLibrary = (img: StockImageResult) => {
    if (!onSaveToLibrary) return;
    const targetUrl = img.proxyUrl || img.fullUrl;
    const queryTag = stockQuery
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .slice(0, 24);
    onSaveToLibrary({
      id: `lib-image-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'image',
      title: img.title.slice(0, 60) || stockQuery || 'Visuel libre de droits',
      description: `Sauvegardé depuis ${img.source}`,
      tags: ['stock', img.source.toLowerCase().replace(/\s+/g, '-'), queryTag].filter(Boolean),
      createdAt: new Date().toISOString(),
      imageData: {
        imageUrl: targetUrl,
        source: img.source,
        author: img.author,
        imagePrompt: img.title,
      },
    });
    setSavedStockMap((prev) => ({ ...prev, [img.id]: true }));
    setTimeout(() => {
      setSavedStockMap((prev) => ({ ...prev, [img.id]: false }));
    }, 1800);
  };

  const handleEditUploadedDirectly = () => {
    if (uploadedMedia.length === 0 || !onImportMediaProject) return;
    onImportMediaProject({
      media: uploadedMedia,
      prompt: prompt.trim(),
      aspectRatio,
      voiceId,
      style,
      musicMood,
      captionStyle,
      karaokeHighlightColor: captionStyle === 'karaoke' ? karaokeHighlightColor : undefined,
      defaultTransition,
      trendingEffect,
      hookSfx,
      aiModel,
      niche,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const imageItems = uploadedMedia.filter((m) => m.mediaType === 'image');
    if (creationMode === 'image-to-video' && imageItems.length > 0 && onGenerateImageToVideo) {
      if (user.plan === 'free' && user.creditsRemaining <= 0) {
        openPricingModal();
        return;
      }
      onGenerateImageToVideo({
        media: uploadedMedia,
        motionPrompt: prompt.trim(),
        motionPreset,
        imageVideoEngine,
        motionIntensity,
        clipDuration,
        aspectRatio,
        voiceId,
        style,
        musicMood,
        captionStyle,
        karaokeHighlightColor: captionStyle === 'karaoke' ? karaokeHighlightColor : undefined,
        defaultTransition,
        trendingEffect,
        hookSfx,
        aiModel,
        niche,
      });
      return;
    }

    if (!prompt.trim() && uploadedMedia.length > 0) {
      handleEditUploadedDirectly();
      return;
    }
    if (!prompt.trim()) return;

    if (user.plan === 'free' && user.creditsRemaining <= 0) {
      openPricingModal();
      return;
    }

    onGenerate({
      prompt: prompt.trim(),
      aspectRatio,
      duration,
      voiceId,
      style,
      musicMood,
      captionStyle,
      karaokeHighlightColor: captionStyle === 'karaoke' ? karaokeHighlightColor : undefined,
      defaultTransition,
      trendingEffect,
      hookSfx,
      aiModel,
      niche,
      uploadedMedia: uploadedMedia.length > 0 ? uploadedMedia : undefined,
    });
  };

  const selectedEngine = AI_MODEL_ENGINES.find((m) => m.id === aiModel);
  const selectedNiche = CONTENT_NICHES.find((n) => n.id === niche);
  const selectedStyleObj = VIDEO_STYLES.find((s) => s.id === style);

  return (
    <aside className="rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none p-4 space-y-4">
      {/* Director Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/[0.07]">
        <div>
          <h2 className="text-sm font-bold font-heading text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#DD2A7B]" />
            <span>Directeur IA</span>
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {selectedEngine?.name} · {aspectRatio} · <span className="tabular-nums">{formatDurationShort(duration)}</span>
          </p>
        </div>

        {onOpenCoach && (
          <button
            type="button"
            onClick={onOpenCoach}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <WalkingRobot mode="compact" size={18} />
            <span>Coach IA</span>
          </button>
        )}
      </div>

      {/* Mode Switcher: Text-to-Video vs Image-to-Video AI */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.07]">
        <button
          type="button"
          onClick={() => setCreationMode('text')}
          className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            creationMode === 'text'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Texte → Vidéo</span>
        </button>

        <button
          type="button"
          onClick={() => setCreationMode('image-to-video')}
          className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            creationMode === 'image-to-video'
              ? 'electric-button-gradient text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Image → Vidéo IA</span>
        </button>
      </div>

      {/* Prompt Composer + Media + Primary Generate CTA */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <label htmlFor="idea-input" className="font-semibold text-zinc-700 dark:text-zinc-300">
              {creationMode === 'image-to-video'
                ? 'Prompt d’animation & narration IA'
                : 'Prompt & Scénario'}
            </label>
            <div className="flex items-center gap-2">
              {onSaveToLibrary && prompt.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleSavePromptToLibrary}
                  title="Sauvegarder ce script dans Ma Bibliothèque"
                  className="text-[11px] font-semibold text-[#0095F6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {savedPromptFeedback ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Sauvegardé</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3 h-3" />
                      <span>Sauver</span>
                    </>
                  )}
                </button>
              )}
              {prompt.length > 0 && (
                <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  {prompt.length} car.
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <textarea
              id="idea-input"
              rows={creationMode === 'image-to-video' ? 2 : 3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                creationMode === 'image-to-video'
                  ? 'Optionnel : décrivez le mouvement ou le récit (ex: Orbite 3D fluide autour du sujet, atmosphère épique)...'
                  : 'Décrivez votre vidéo (ex: 5 biais psychologiques qui influencent vos décisions quotidiennes)...'
              }
              className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.09] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/35 focus:ring-1 focus:ring-zinc-300 dark:focus:ring-white/20 transition-all resize-none leading-relaxed"
            />
            {prompt && (
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="absolute top-2 right-2 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-white/[0.08] cursor-pointer"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {/* 1-Click Quick Idea Chips */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500 dark:text-orange-400" />
            <span>Idées rapides</span>
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {QUICK_IDEAS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveCreatorId(null);
                  setPrompt(item.prompt);
                  setStyle(item.style);
                  setMusicMood(item.mood);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#09090B] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        {/* Famous YouTube & TikTok Creator Persona Presets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-[#DD2A7B]" />
              <span>Style créateur YouTube & TikTok</span>
            </p>
            {onOpenTemplates && (
              <button
                type="button"
                onClick={onOpenTemplates}
                className="text-[10px] font-semibold text-[#0095F6] hover:underline cursor-pointer whitespace-nowrap"
              >
                Tous ({FAMOUS_CREATOR_PERSONAS.length})
              </button>
            )}
          </div>
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
            {FAMOUS_CREATOR_PERSONAS.map((creator) => {
              const isSelected = activeCreatorId === creator.id;
              return (
                <button
                  key={creator.id}
                  type="button"
                  onClick={() => handleApplyCreatorPreset(creator)}
                  title={`${creator.name} (${creator.platform === 'youtube' ? 'YouTube 16:9' : 'TikTok 9:16'}) — ${creator.niche}`}
                  className={`min-w-[200px] w-[200px] sm:min-w-[220px] sm:w-[220px] rounded-2xl overflow-hidden border flex flex-col text-left transition-all shrink-0 cursor-pointer group ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white ring-2 ring-[#0095F6] shadow-lg'
                      : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-[#09090B] dark:hover:bg-white/[0.08] border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  <div className="relative w-full h-52 sm:h-56 overflow-hidden">
                    <CreatorAvatar persona={creator} variant="poster" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span
                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        creator.platform === 'youtube'
                          ? 'bg-red-600/90 text-white'
                          : 'bg-black/80 text-[#00F2EA] border border-[#00F2EA]/40'
                      }`}
                    >
                      {creator.platform === 'youtube' ? (
                        <Tv className="w-3 h-3" />
                      ) : (
                        <Music2 className="w-3 h-3" />
                      )}
                      <span>{creator.platform === 'youtube' ? 'YouTube' : 'TikTok'}</span>
                    </span>
                    <div className="absolute bottom-2.5 left-3 right-3">
                      <p className="text-base font-black text-white truncate leading-tight">
                        {creator.name}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-200 truncate">
                        {creator.handle}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-2 w-full flex items-center justify-between gap-2 text-[11px]">
                    <span className={`font-semibold truncate ${isSelected ? 'text-zinc-200 dark:text-zinc-700' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {creator.subscribersLabel}
                    </span>
                    <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-white dark:text-black font-bold' : 'text-zinc-500'}`}>
                      {creator.aspectRatio}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reference Media Dropzone / Bin */}
        <div className="space-y-2">
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleMediaFilesSelected(e.target.files)}
          />

          {uploadedMedia.length === 0 ? (
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingMedia(true);
              }}
              onDragLeave={() => setIsDraggingMedia(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingMedia(false);
                handleMediaFilesSelected(e.dataTransfer.files);
              }}
              className={`w-full py-5 px-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer group ${
                isDraggingMedia
                  ? 'bg-pink-50 dark:bg-white/[0.08] border-pink-400'
                  : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-[#09090B] dark:hover:bg-white/[0.04] border-zinc-300 hover:border-zinc-400 dark:border-white/15 dark:hover:border-white/35'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl electric-button-gradient flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-lg">
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                  {isProcessingMedia ? 'Chargement de vos médias...' : 'Ajouter des photos ou vidéos'}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Importez JPG, PNG, MP4, MOV pour monter & sous-titrer
                </p>
              </div>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.09] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
                  Rushes ({uploadedMedia.length})
                </span>
                {onImportMediaProject && (
                  <button
                    type="button"
                    onClick={handleEditUploadedDirectly}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:text-black dark:bg-white dark:hover:bg-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Monter</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {uploadedMedia.map((item) => (
                  <div
                    key={item.id}
                    className="relative w-14 h-16 rounded-lg overflow-hidden border border-zinc-300 dark:border-white/10 bg-black shrink-0"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/75 text-[8px] font-mono tabular-nums text-white">
                      {item.durationSeconds}s
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUploadedMedia(item.id)}
                      title="Retirer ce média"
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  title="Ajouter d'autres médias"
                  className="w-14 h-16 rounded-lg border border-dashed border-zinc-300 dark:border-white/20 hover:border-zinc-500 dark:hover:border-white/45 bg-white dark:bg-white/[0.03] flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Integrated Royalty-Free Stock Image Search Bar */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#0095F6]" />
              <span>Banque d'images libres de droits</span>
            </span>
            {stockResults.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStockResults([]);
                  setHasSearchedStock(false);
                  setStockError(null);
                }}
                className="text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Fermer
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchStockImages();
                  }
                }}
                placeholder="Rechercher une photo (Paris, IA, Océan...)"
                aria-label="Rechercher des images libres de droits"
                className="w-full rounded-lg bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSearchStockImages()}
              disabled={isSearchingStock || !stockQuery.trim()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-45 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSearchingStock ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Chercher</span>
            </button>
          </div>

          {/* Quick Topic Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {STOCK_QUICK_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => handleSearchStockImages(topic)}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>

          {stockError && (
            <p className="text-[11px] text-red-600 dark:text-red-400">{stockError}</p>
          )}

          {isSearchingStock && (
            <div className="py-4 text-center text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0095F6]" />
              <span>Recherche dans les banques libres de droits...</span>
            </div>
          )}

          {!isSearchingStock && hasSearchedStock && stockResults.length === 0 && !stockError && (
            <p className="py-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
              Aucun visuel trouvé pour « {stockQuery} ». Essayez un autre mot-clé.
            </p>
          )}

          {!isSearchingStock && stockResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="tabular-nums">{stockResults.length} visuels disponibles</span>
                <span className="truncate max-w-[160px]">{stockSources.join(' · ')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-0.5">
                {stockResults.map((img) => {
                  const targetUrl = img.proxyUrl || img.fullUrl;
                  const alreadyInRushes = uploadedMedia.some((m) => m.previewUrl === targetUrl);
                  const justAddedScene = Boolean(addedSceneMap[img.id]);
                  const thumbFailed = Boolean(failedThumbMap[img.id]);

                  return (
                    <div
                      key={img.id}
                      className="rounded-lg overflow-hidden bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] flex flex-col"
                    >
                      <div className="relative aspect-[16/10] w-full bg-zinc-200 dark:bg-zinc-900 overflow-hidden">
                        {thumbFailed ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-2 text-center text-zinc-500">
                            <ImageIcon className="w-4 h-4 opacity-70" />
                            <span className="text-[9px] truncate w-full">{img.title}</span>
                          </div>
                        ) : (
                          <img
                            src={img.thumbUrl}
                            alt={img.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const el = e.currentTarget;
                              if (!el.dataset.proxyTried && img.proxyUrl && el.src !== img.proxyUrl) {
                                el.dataset.proxyTried = '1';
                                el.src = img.proxyUrl;
                              } else {
                                setFailedThumbMap((prev) => ({ ...prev, [img.id]: true }));
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <div className="p-1.5 space-y-1.5">
                        <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                          {img.source} · {img.license}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAddStockToRushes(img)}
                            className={`flex-1 py-1 px-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                              alreadyInRushes
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35'
                                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.15] text-zinc-900 dark:text-white'
                            }`}
                            title="Ajouter aux Rushes pour la prochaine génération ou montage"
                          >
                            {alreadyInRushes ? (
                              <>
                                <Check className="w-2.5 h-2.5" />
                                <span>Rushes</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-2.5 h-2.5" />
                                <span>Rushes</span>
                              </>
                            )}
                          </button>

                          {hasActiveVideo && onAddSceneToCurrentVideo && (
                            <button
                              type="button"
                              onClick={() => handleAddStockDirectScene(img)}
                              className={`flex-1 py-1 px-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                                justAddedScene
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
                              }`}
                              title="Ajouter directement comme nouvelle scène dans la vidéo en cours"
                            >
                              {justAddedScene ? (
                                <>
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Scène</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Scène</span>
                                </>
                              )}
                            </button>
                          )}

                          {onSaveToLibrary && (
                            <button
                              type="button"
                              onClick={() => handleSaveStockImageToLibrary(img)}
                              title="Sauvegarder cette image dans Ma Bibliothèque"
                              className={`p-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                                savedStockMap[img.id]
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.15] text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {savedStockMap[img.id] ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <BookmarkPlus className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Image-to-Video AI Controls when in Image-to-Video mode */}
        {creationMode === 'image-to-video' && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-3">
            {/* Image-to-Video AI Engine Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Orbit className="w-3.5 h-3.5 text-[#DD2A7B]" />
                  <span>IA Animation Vidéo</span>
                </span>
                {onOpenAnimateStudio ? (
                  <button
                    type="button"
                    onClick={onOpenAnimateStudio}
                    className="text-[10px] font-bold text-[#0095F6] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Aperçu 3D Live →
                  </button>
                ) : (
                  <span className="text-[10px] text-zinc-500">
                    {IMAGE_VIDEO_ENGINES.find((e) => e.id === imageVideoEngine)?.provider}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {IMAGE_VIDEO_ENGINES.map((eng) => {
                  const active = imageVideoEngine === eng.id;
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => setImageVideoEngine(eng.id)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white dark:bg-[#111114] border-zinc-200 dark:border-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold truncate">{eng.name}</span>
                        <span
                          className={`text-[8px] font-semibold px-1 rounded shrink-0 ${
                            active
                              ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black'
                              : 'bg-[#DD2A7B]/10 text-[#DD2A7B]'
                          }`}
                        >
                          {eng.badge}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Camera Motion Preset */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Mouvement Caméra</span>
                <span className="text-[10px] text-zinc-500">
                  {motionPreset === 'auto'
                    ? 'Auto Vision IA'
                    : IMAGE_MOTION_PRESETS.find((p) => p.id === motionPreset)?.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setMotionPreset('auto')}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    motionPreset === 'auto'
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-white dark:bg-[#111114] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  ✨ Auto Vision
                </button>
                {IMAGE_MOTION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setMotionPreset(preset.id)}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                      motionPreset === preset.id
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white dark:bg-[#111114] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity + Clip Duration */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Intensité</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['subtle', 'cinematic', 'intense'] as ImageMotionIntensity[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setMotionIntensity(lvl)}
                      className={`py-1 rounded-md border text-[9px] font-bold cursor-pointer ${
                        motionIntensity === lvl
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white dark:bg-[#111114] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {lvl === 'subtle' ? 'Doux' : lvl === 'cinematic' ? 'Ciné' : 'Fort'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Durée / image</span>
                <div className="grid grid-cols-3 gap-1">
                  {[4, 5, 7].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setClipDuration(sec)}
                      className={`py-1 rounded-md border text-[9px] font-bold tabular-nums cursor-pointer ${
                        clipDuration === sec
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white dark:bg-[#111114] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Generate CTA */}
        {creationMode === 'image-to-video' ? (
          <button
            type="submit"
            disabled={isGenerating || uploadedMedia.filter((m) => m.mediaType === 'image').length === 0}
            className={`w-full py-3 px-4 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
              isGenerating || uploadedMedia.filter((m) => m.mediaType === 'image').length === 0
                ? 'bg-zinc-200 text-zinc-400 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-white/5 cursor-not-allowed'
                : 'electric-button-gradient text-white'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>
              {uploadedMedia.filter((m) => m.mediaType === 'image').length === 0
                ? 'Importez 1+ image ci-dessus'
                : `Transformer ${uploadedMedia.filter((m) => m.mediaType === 'image').length} image${
                    uploadedMedia.filter((m) => m.mediaType === 'image').length > 1 ? 's' : ''
                  } en vidéo IA`}
            </span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={isGenerating || (!prompt.trim() && uploadedMedia.length === 0)}
            className={`w-full py-3 px-4 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
              isGenerating || (!prompt.trim() && uploadedMedia.length === 0)
                ? 'bg-zinc-200 text-zinc-400 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-white/5 cursor-not-allowed'
                : 'electric-button-gradient text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{uploadedMedia.length > 0 && !prompt.trim() ? 'Ouvrir mes médias' : 'Générer la vidéo'}</span>
            <span className="text-[11px] opacity-80 font-mono font-normal">
              · {uploadedMedia.length > 0 && !prompt.trim() ? 'Studio' : '1 crédit'}
            </span>
          </button>
        )}
      </form>

      {/* Parameter Inspector Tabs (Higgsfield Left Control Rail) */}
      <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.07] space-y-3">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.07]">
          <button
            type="button"
            onClick={() => setActiveDirectorTab('engine')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              activeDirectorTab === 'engine'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>Moteur</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDirectorTab('style')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              activeDirectorTab === 'style'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Style</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDirectorTab('audio')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              activeDirectorTab === 'audio'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Volume2 className="w-3 h-3" />
            <span>Audio</span>
          </button>
        </div>

        {/* Inspector Tab 1: Engine, Niche, Aspect Ratio & Duration */}
        {activeDirectorTab === 'engine' && (
          <div className="space-y-4 max-h-[540px] overflow-y-auto pr-0.5">
            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Format de sortie</span>
                <span className="text-zinc-500 dark:text-zinc-400 font-mono">{aspectRatio}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: '9:16' as AspectRatio, label: '9:16', sub: 'Reels', icon: Smartphone },
                  { id: '16:9' as AspectRatio, label: '16:9', sub: 'YouTube', icon: Tv },
                  { id: '1:1' as AspectRatio, label: '1:1', sub: 'Carré', icon: Square },
                ].map((r) => {
                  const Icon = r.icon;
                  const active = aspectRatio === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setAspectRatio(r.id)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                        active
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold leading-none tabular-nums">{r.label}</p>
                        <p className={`text-[9px] mt-0.5 truncate ${active ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500'}`}>
                          {r.sub}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Duration (supports short-form & 1h+ long-form up to 12h) */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                <span>Durée ciblée</span>
                <span className="text-zinc-900 dark:text-white font-mono tabular-nums">
                  {formatDurationShort(duration)} · {estimateSceneCountForDuration(duration)}{' '}
                  {duration > 180 ? 'chapitres' : 'scènes'}
                </span>
              </label>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { sec: 30, label: '30s' },
                  { sec: 60, label: '1m' },
                  { sec: 300, label: '5m' },
                  { sec: 900, label: '15m' },
                  { sec: 1800, label: '30m' },
                  { sec: 3600, label: '1h' },
                  { sec: 5400, label: '1h30' },
                  { sec: 7200, label: '2h' },
                ].map((opt) => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => setDuration(opt.sec)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer tabular-nums ${
                      duration === opt.sec
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom Hours / Minutes / Seconds Duration Control */}
              <div className="p-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  Sur mesure :
                </span>
                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={Math.floor(duration / 3600)}
                      aria-label="Heures"
                      onChange={(e) => {
                        const h = Math.max(0, Math.min(12, Math.floor(Number(e.target.value) || 0)));
                        const m = Math.floor((duration % 3600) / 60);
                        const s = duration % 60;
                        const next = Math.max(15, Math.min(43200, h * 3600 + m * 60 + s));
                        setDuration(next);
                      }}
                      className="w-11 rounded-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] px-1.5 py-1 text-center text-[11px] font-mono tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
                    />
                    <span>h</span>
                  </label>

                  <label className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={Math.floor((duration % 3600) / 60)}
                      aria-label="Minutes"
                      onChange={(e) => {
                        const h = Math.floor(duration / 3600);
                        const m = Math.max(0, Math.min(59, Math.floor(Number(e.target.value) || 0)));
                        const s = duration % 60;
                        const next = Math.max(15, Math.min(43200, h * 3600 + m * 60 + s));
                        setDuration(next);
                      }}
                      className="w-11 rounded-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] px-1.5 py-1 text-center text-[11px] font-mono tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
                    />
                    <span>m</span>
                  </label>

                  <label className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={duration % 60}
                      aria-label="Secondes"
                      onChange={(e) => {
                        const h = Math.floor(duration / 3600);
                        const m = Math.floor((duration % 3600) / 60);
                        const s = Math.max(0, Math.min(59, Math.floor(Number(e.target.value) || 0)));
                        const next = Math.max(15, Math.min(43200, h * 3600 + m * 60 + s));
                        setDuration(next);
                      }}
                      className="w-11 rounded-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] px-1.5 py-1 text-center text-[11px] font-mono tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
                    />
                    <span>s</span>
                  </label>
                </div>
              </div>
            </div>

            {/* AI Model Engine Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Moteur IA de Scénario</span>
                </span>
                <span className="text-zinc-500 truncate">{selectedEngine?.provider}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                {AI_MODEL_ENGINES.map((engine) => {
                  const isSelected = aiModel === engine.id;
                  return (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => setAiModel(engine.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900/5 border-zinc-900 text-zinc-900 dark:bg-white/[0.1] dark:border-white/75 dark:text-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/20'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate">{engine.name}</p>
                      <p className={`text-[9px] mt-0.5 truncate ${isSelected ? 'text-pink-600 dark:text-pink-400' : 'text-zinc-500'}`}>
                        {engine.badge}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Niche & Flow */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Niche & Cheminement</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CONTENT_NICHES.map((item) => {
                  const isSelected = niche === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setNiche(item.id)}
                      className={`px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900/5 border-zinc-900 text-zinc-900 dark:bg-white/[0.1] dark:border-white/75 dark:text-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/20'
                      }`}
                    >
                      <p className="text-[11px] font-semibold truncate">{item.name}</p>
                      <p className="text-[9px] text-zinc-500 truncate">
                        {item.recommendedEngine === 'chatgpt-astra'
                          ? 'Astra'
                          : item.recommendedEngine === 'claude'
                          ? 'Claude'
                          : 'Gemini 4'}
                      </p>
                    </button>
                  );
                })}
              </div>
              {selectedNiche && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed pt-0.5">
                  {selectedNiche.flowSummary}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Inspector Tab 2: Higgsfield Visual Style Presets Grid */}
        {activeDirectorTab === 'style' && (
          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Preset Visuel Cinéma</span>
              <span className="text-zinc-900 dark:text-white font-semibold">{selectedStyleObj?.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {VIDEO_STYLES.map((st) => {
                const isSelected = style === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStyle(st.id)}
                    className={`relative rounded-xl overflow-hidden border text-left cursor-pointer transition-all group ${
                      isSelected
                        ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white/80'
                        : 'border-zinc-200 dark:border-white/[0.08] opacity-90 hover:opacity-100 hover:border-zinc-400 dark:hover:border-white/25'
                    }`}
                  >
                    <div className="h-24 w-full overflow-hidden bg-black">
                      <img
                        src={st.previewUrl}
                        alt={st.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
                    </div>
                    <div className="absolute bottom-2 left-2.5 right-2.5">
                      <p className="text-xs font-bold text-white truncate">{st.name}</p>
                      <span className="text-[10px] text-zinc-300 font-medium">{st.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inspector Tab 3: Voices, Captions, Music & Transitions */}
        {activeDirectorTab === 'audio' && (
          <div className="space-y-4 max-h-[540px] overflow-y-auto pr-0.5">
            {/* Voices */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Voix Off IA</span>
                <span className="text-zinc-500">Tester ▶</span>
              </div>
              <div className="space-y-1.5">
                {VOICES.map((v) => {
                  const isSelected = voiceId === v.id;
                  const isPlaying = playingVoiceId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setVoiceId(v.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-zinc-900/5 border-zinc-900 dark:bg-white/[0.09] dark:border-white/75'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {v.name} <span className="font-normal text-zinc-500 dark:text-zinc-400">· {v.tone}</span>
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">{v.recommendedFor}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handlePreviewVoice(v.id, v.name, e)}
                        title="Écouter un extrait de la voix"
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-900 hover:text-white dark:bg-white/[0.08] dark:text-white dark:hover:bg-white dark:hover:text-black'
                        }`}
                      >
                        {isPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3 h-3 ml-0.5" />}
                      </button>
                    </div>
                  );
                })}

                {customVoices.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Voix personnalisées (Ma Bibliothèque)
                    </p>
                    {customVoices.map((cv) => {
                      const isSelected = voiceId === cv.id;
                      const isPlaying = playingVoiceId === cv.id;
                      return (
                        <div
                          key={cv.id}
                          onClick={() => setVoiceId(cv.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-zinc-900/5 border-zinc-900 dark:bg-white/[0.09] dark:border-white/75'
                              : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/20'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                              {cv.title}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono tabular-nums truncate">
                              Hauteur {cv.voiceData?.pitch.toFixed(2)}x · Vitesse {cv.voiceData?.rate.toFixed(2)}x
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handlePreviewVoice(cv.id, cv.title, e)}
                            title="Écouter cette voix personnalisée"
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              isPlaying
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-900 hover:text-white dark:bg-white/[0.08] dark:text-white dark:hover:bg-white dark:hover:text-black'
                            }`}
                          >
                            {isPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Captions */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Sous-titres</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {CAPTION_STYLES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCaptionStyle(c.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      captionStyle === c.id
                        ? 'bg-zinc-900/5 border-zinc-900 dark:bg-white/[0.09] dark:border-white/75'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/20'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">{c.sample}</p>
                  </button>
                ))}
              </div>

              {captionStyle === 'karaoke' && (
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Surbrillance Karaoké
                    </span>
                    <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400 uppercase">
                      {karaokeHighlightColor}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {KARAOKE_HIGHLIGHT_COLORS.map((preset) => {
                      const active = karaokeHighlightColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setKaraokeHighlightColor(preset.hex)}
                          title={preset.name}
                          aria-label={`Couleur ${preset.name}`}
                          className={`w-6 h-6 rounded-md border cursor-pointer transition-transform ${
                            active
                              ? 'scale-110 ring-2 ring-zinc-900 dark:ring-white border-white dark:border-black'
                              : 'border-black/15 dark:border-white/15 hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset.hex }}
                        />
                      );
                    })}
                    <label
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#121214] text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      title="Couleur personnalisée"
                    >
                      <input
                        type="color"
                        value={karaokeHighlightColor}
                        onChange={(e) => setKaraokeHighlightColor(e.target.value)}
                        aria-label="Couleur de surbrillance personnalisée"
                        className="w-3.5 h-3.5 rounded border-0 bg-transparent p-0 cursor-pointer"
                      />
                      <span>Libre</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Sons & Beats Tendance Shorts / Reels */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Sons & Beats Tendance</span>
                </span>
                <span className="text-[10px] text-zinc-500">Shorts & Reels</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                {MUSIC_MOODS.map((m) => {
                  const isPreviewPlaying = playingMusicId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setMusicMood(m.id)}
                      className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        musicMood === m.id
                          ? 'bg-zinc-900/5 border-zinc-900 dark:bg-white/[0.09] dark:border-white/75'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate">{m.name}</p>
                          {m.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#0095F6]/15 text-[#0095F6] border border-[#0095F6]/30">
                              {m.badge}
                            </span>
                          )}
                          <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                            {m.bpm}
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 truncate">{m.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handlePreviewMusic(m.id, e)}
                        title="Pré-écouter ce son tendance (3.5s)"
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          isPreviewPlaying
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-900 hover:text-white dark:bg-white/[0.08] dark:text-white dark:hover:bg-white dark:hover:text-black'
                        }`}
                      >
                        {isPreviewPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3 h-3 ml-0.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Effets Visuels Tendance Shorts & Reels */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#DD2A7B]" />
                  <span>Effet Visuel Tendance</span>
                </span>
                <span className="text-[10px] text-zinc-500">Shorts & Reels</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TRENDING_EFFECT_LIST.slice(0, 6).map((fx) => (
                  <button
                    key={fx.id}
                    type="button"
                    onClick={() => setTrendingEffect(fx.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      trendingEffect === fx.id
                        ? 'bg-zinc-900/5 border-zinc-900 dark:bg-white/[0.09] dark:border-white/75'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate">{fx.label}</p>
                      {fx.badge && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-zinc-200/80 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 shrink-0">
                          {fx.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-zinc-500 truncate">{fx.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Son Hook Intro (SFX Viral) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Son Hook d'Accroche (SFX)</span>
                </span>
                <span className="text-[10px] text-zinc-500">Test au clic</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setHookSfx('none')}
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    hookSfx === 'none'
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Aucun
                </button>
                {TRENDING_SFX_LIST.map((sfx) => (
                  <button
                    key={sfx.id}
                    type="button"
                    onClick={() => {
                      setHookSfx(sfx.id);
                      audioEngine.playSfx(sfx.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                      hookSfx === sfx.id
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                    }`}
                  >
                    {sfx.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Transitions */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Transition par défaut</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {SCENE_TRANSITIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDefaultTransition(t.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      defaultTransition === t.id
                        ? 'bg-zinc-900/5 border-zinc-900 dark:bg-white/[0.09] dark:border-white/75'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/20'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate">{t.name}</p>
                    <p className="text-[9px] text-zinc-500 truncate">{t.sample}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
