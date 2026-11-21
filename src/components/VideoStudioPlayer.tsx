import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  Edit3,
  Check,
  Copy,
  FolderPlus,
  Maximize2,
  Sliders,
  Eye,
  Layers,
  Wand2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Tv,
  Smartphone,
  Square,
  Flame,
  FileText,
  Hash,
  X,
  Film,
  Undo2,
  Redo2,
  History,
  Languages,
  Gauge,
  Volume1,
  Zap,
  Link2,
  MessageCircle,
  BarChart3,
  Plus,
  Upload,
  Scissors,
  Palette,
  Activity,
  Orbit,
  Loader2,
  GripVertical,
  BookmarkPlus,
  Mic,
  MicOff,
  RotateCw,
  FlipHorizontal2,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  GeneratedVideo,
  VideoScene,
  AspectRatio,
  CaptionStyle,
  MusicMood,
  CameraEffect,
  SceneTransition,
  StudioInspectorTab,
  TransitionIntensity,
  TrendingEffectId,
  TrendingSfxId,
  ColorGradePreset,
  UserSubscription,
  ExportQualityPreset,
  ImageMotionPreset,
  LibraryItem,
} from '../types';
import {
  VOICES,
  VIDEO_STYLES,
  CAPTION_STYLES,
  DEFAULT_KARAOKE_HIGHLIGHT_COLOR,
  KARAOKE_HIGHLIGHT_COLORS,
  MUSIC_MOODS,
  SCENE_TRANSITIONS,
  TRANSITION_INTENSITIES,
  getTransitionIntensityConfig,
  TRENDING_EFFECT_LIST,
  TRENDING_SFX_LIST,
  IMAGE_MOTION_PRESETS,
  AI_MODEL_ENGINES,
  IMAGE_VIDEO_ENGINES,
} from '../data/mockTemplates';
import { audioEngine } from '../utils/audioEngine';
import { exportVideoFile, triggerDownload, ExportProgress } from '../utils/videoExporter';
import { processUploadedMediaFiles } from '../utils/mediaImport';
import { loadPlayerPrefs, savePlayerPrefs } from '../utils/autoSave';
import { formatDurationShort, formatTimecode } from '../utils/durationFormat';
import { synthesizeImageToVideoClip } from '../utils/imageToVideoSynthesizer';
import {
  buildCombinedSceneFilterCss,
  buildSceneTransformCss,
  hasCustomPhotoEdits,
  hasCustomVideoEdits,
} from '../utils/mediaTransforms';
import { SocialShareModal } from './SocialShareModal';
import { PhotoEditorPanel, VideoEffectsPanel } from './SceneMediaEditor';
import { VoiceoverSceneDetector } from './VoiceoverSceneDetector';
import {
  applySuggestedCutsToScenes,
  SuggestedCutPoint,
} from '../utils/voiceoverSceneDetector';

interface VideoStudioPlayerProps {
  video: GeneratedVideo;
  onUpdateVideo: (updated: GeneratedVideo) => void;
  onSaveToCreations: (video: GeneratedVideo) => void;
  onNewVideo: () => void;
  user: UserSubscription;
  openPricingModal: () => void;
  onOpenStats?: () => void;
  exportQuality?: ExportQualityPreset;
  customVoices?: LibraryItem[];
  onSaveToLibrary?: (item: LibraryItem) => void;
}

export type PreviewAspectRatio = '9:16' | '4:5' | '16:9';

export const VideoStudioPlayer: React.FC<VideoStudioPlayerProps> = ({
  video,
  onUpdateVideo,
  onSaveToCreations,
  onNewVideo,
  user,
  openPricingModal,
  onOpenStats,
  exportQuality = '1080p-30',
  customVoices = [],
  onSaveToLibrary,
}) => {
  const [initialPrefs] = useState(() => loadPlayerPrefs(video.id));
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSceneIdx, setCurrentSceneIdx] = useState<number>(() =>
    initialPrefs ? Math.min(Math.max(0, initialPrefs.currentSceneIdx), Math.max(0, video.scenes.length - 1)) : 0
  );
  const [previewAspectRatio, setPreviewAspectRatio] = useState<PreviewAspectRatio>(() =>
    initialPrefs?.previewAspectRatio ||
    (video.aspectRatio === '16:9' ? '16:9' : video.aspectRatio === '4:5' ? '4:5' : '9:16')
  );
  const [showFramingGuides, setShowFramingGuides] = useState<boolean>(() => initialPrefs?.showFramingGuides ?? false);
  const [selectedTransitionSceneIdx, setSelectedTransitionSceneIdx] = useState<number>(1);
  const [transitionIntensityScope, setTransitionIntensityScope] = useState<'all' | 'scene'>('all');
  const [transitionPreviewNonce, setTransitionPreviewNonce] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [voiceVolume, setVoiceVolume] = useState<number>(() => initialPrefs?.voiceVolume ?? 1.0);
  const [musicVolume, setMusicVolume] = useState<number>(() => initialPrefs?.musicVolume ?? 0.25);
  const [audioBalance, setAudioBalance] = useState<number>(() => initialPrefs?.audioBalance ?? 20); // 0 = 100% Voix, 100 = 100% Musique
  const [isMuted, setIsMuted] = useState<boolean>(() => initialPrefs?.isMuted ?? false);
  const [activeTab, setActiveTab] = useState<StudioInspectorTab>(() =>
    initialPrefs?.activeTab || 'scenes'
  );
  const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const [activeWord, setActiveWord] = useState<string>('');
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedTags, setCopiedTags] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [savedLibraryScript, setSavedLibraryScript] = useState<boolean>(false);
  const [savedLibraryVoice, setSavedLibraryVoice] = useState<boolean>(false);
  const [savedSceneLibraryMap, setSavedSceneLibraryMap] = useState<Record<number, boolean>>({});

  // Outils Avancés (Advanced Tools) State
  const [vocalSpeed, setVocalSpeed] = useState<number>(() => initialPrefs?.vocalSpeed ?? 1.05);
  const [ctaObjective, setCtaObjective] = useState<'comments' | 'followers' | 'shares'>(() =>
    initialPrefs?.ctaObjective || 'comments'
  );
  const [copiedCta, setCopiedCta] = useState<boolean>(false);
  const [activeSfx, setActiveSfx] = useState<string | null>(null);
  const [effectApplyScope, setEffectApplyScope] = useState<'all' | 'scene'>('all');
  const [customWatermark, setCustomWatermark] = useState<string>(() => initialPrefs?.customWatermark || '@FOFO_AI');
  const [showWatermark, setShowWatermark] = useState<boolean>(() => initialPrefs?.showWatermark ?? true);

  // Social Sharing state & Toast
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [copiedVideoLink, setCopiedVideoLink] = useState<boolean>(false);
  const [supportsNativeShare, setSupportsNativeShare] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setSupportsNativeShare(true);
    }
  }, []);

  // Video Export state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<AspectRatio>(() =>
    video.aspectRatio === '16:9' ? '16:9' : video.aspectRatio === '1:1' ? '1:1' : '9:16'
  );
  const [activeExportFormat, setActiveExportFormat] = useState<AspectRatio>(() =>
    video.aspectRatio === '16:9' ? '16:9' : video.aspectRatio === '1:1' ? '1:1' : '9:16'
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string>('');
  const [animatingSceneIdx, setAnimatingSceneIdx] = useState<number | null>(null);
  const [draggedSceneIdx, setDraggedSceneIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const [isSceneDetectorOpen, setIsSceneDetectorOpen] = useState<boolean>(false);

  // Undo / Redo History state (piles d'annulation et de rétablissement)
  const [pastStates, setPastStates] = useState<GeneratedVideo[]>([]);
  const [futureStates, setFutureStates] = useState<GeneratedVideo[]>([]);
  const lastVideoIdRef = useRef<string>(video.id);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const karaokeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedSceneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneStartTimeRef = useRef<number>(0);
  const lastBoundaryAtRef = useRef<number>(0);

  const currentScene = video.scenes[currentSceneIdx] || video.scenes[0];
  const totalDuration = video.scenes.reduce((acc, s) => acc + (s.durationSeconds || 6), 0);

  const tokenizeSceneWords = (text: string) => {
    const tokens: Array<{ word: string; startChar: number; endChar: number; weight: number }> = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const w = match[0];
      const cleanLen = Math.max(2, w.replace(/[.,!?;:]/g, '').length);
      const punctPause = /[.,!?;:]$/.test(w) ? 2.5 : 0;
      tokens.push({
        word: w,
        startChar: match.index,
        endChar: match.index + w.length,
        weight: cleanLen + punctPause,
      });
    }
    return tokens;
  };

  const clearSceneSyncTimers = () => {
    if (karaokeIntervalRef.current) {
      clearInterval(karaokeIntervalRef.current);
      karaokeIntervalRef.current = null;
    }
    if (mutedSceneTimeoutRef.current) {
      clearTimeout(mutedSceneTimeoutRef.current);
      mutedSceneTimeoutRef.current = null;
    }
  };

  // Initialisation et gestion de la lecture
  const playScene = (sceneIndex: number) => {
    clearSceneSyncTimers();

    if (sceneIndex >= video.scenes.length) {
      setIsPlaying(false);
      audioEngine.stopAll();
      setCurrentSceneIdx(0);
      setCurrentTime(0);
      setActiveWord('');
      setActiveWordIndex(-1);
      return;
    }

    const scene = video.scenes[sceneIndex];
    setCurrentSceneIdx(sceneIndex);
    if (sceneIndex >= 1) {
      setSelectedTransitionSceneIdx(sceneIndex);
    }

    const tokens = tokenizeSceneWords(scene.voiceoverText);
    const totalWeight = tokens.reduce((sum, t) => sum + t.weight, 0) || 1;
    // Durée estimée d'élocution calée sur le rythme vocal (rate) et la durée de la scène
    const baseSpeechMs = Math.max(
      1800,
      Math.min((scene.durationSeconds || 6) * 1000, (scene.voiceoverText.length / (13.2 * Math.max(0.7, vocalSpeed))) * 1000)
    );
    sceneStartTimeRef.current = Date.now();
    lastBoundaryAtRef.current = 0;
    setActiveWordIndex(tokens.length > 0 ? 0 : -1);
    setActiveWord(tokens[0]?.word || '');

    // Synchronisation fluide mot-à-mot (priorité aux événements Web Speech onBoundary + fallback temporel pondéré)
    if (tokens.length > 0) {
      karaokeIntervalRef.current = setInterval(() => {
        const now = Date.now();
        // Si SpeechSynthesis a émis un événement onBoundary récemment, il garde la priorité exacte
        if (lastBoundaryAtRef.current > 0 && now - lastBoundaryAtRef.current < 900) {
          return;
        }
        const elapsed = now - sceneStartTimeRef.current;
        const progress = Math.min(0.999, Math.max(0, elapsed / baseSpeechMs));
        const targetWeight = progress * totalWeight;
        let acc = 0;
        let estimatedIdx = 0;
        for (let i = 0; i < tokens.length; i++) {
          acc += tokens[i].weight;
          if (targetWeight <= acc) {
            estimatedIdx = i;
            break;
          }
        }
        setActiveWordIndex((prev) => (prev !== estimatedIdx ? estimatedIdx : prev));
        setActiveWord(tokens[estimatedIdx]?.word || '');
      }, 65);
    }

    const autoSfxEnabled = video.autoTransitionSfx !== false;

    // Son Hook Intro viral sur la Scène 1 si activé
    if (sceneIndex === 0 && !isMuted && video.hookSfx && video.hookSfx !== 'none') {
      audioEngine.playSfx(video.hookSfx, Math.max(0.55, voiceVolume * 0.85));
    }

    // Effet sonore automatique lors du passage à une nouvelle scène
    if (sceneIndex > 0 && !isMuted && autoSfxEnabled) {
      const transitionType = scene.transition || video.defaultTransition || 'fade';
      const transitionIntensity = scene.transitionIntensity || video.transitionIntensity || 'normal';
      audioEngine.playTransitionSfx(transitionType, Math.max(0.4, voiceVolume * 0.75), transitionIntensity);
    }

    // Garder la musique de fond fluide d'une scène à l'autre pour permettre au ducking de moduler le gain en douceur
    if (!isMuted) {
      if (!audioEngine.isMusicActive(video.musicMood)) {
        audioEngine.playBackgroundMusic(video.musicMood, musicVolume);
      } else {
        audioEngine.setMusicVolume(musicVolume);
      }
    }

    const sceneHasActiveVoice =
      Boolean(scene.voiceoverText && scene.voiceoverText.trim().length > 0) &&
      scene.voiceEnabled !== false &&
      voiceVolume > 0;

    // Jouer la voix off uniquement si elle est active sur cette scène (sinon la musique remonte automatiquement à 100%)
    if (!isMuted && sceneHasActiveVoice) {
      const activeCustomVoice = customVoices.find((v) => v.id === video.voiceId);
      audioEngine.speakText(scene.voiceoverText, video.voiceId, {
        volume: voiceVolume,
        rate: activeCustomVoice?.voiceData?.rate ?? vocalSpeed,
        pitch: activeCustomVoice?.voiceData?.pitch,
        onBoundary: (charIdx, _length, word) => {
          lastBoundaryAtRef.current = Date.now();
          setActiveWord(word);
          if (tokens.length > 0) {
            let matchedIdx = tokens.findIndex((t) => charIdx >= t.startChar && charIdx <= t.endChar);
            if (matchedIdx === -1) {
              matchedIdx = tokens.findIndex((t) => t.startChar >= charIdx);
            }
            if (matchedIdx !== -1) {
              setActiveWordIndex(matchedIdx);
            }
          }
        },
        onEnd: () => {
          clearSceneSyncTimers();
          playScene(sceneIndex + 1);
        },
        onError: () => {
          mutedSceneTimeoutRef.current = setTimeout(() => {
            playScene(sceneIndex + 1);
          }, (scene.durationSeconds || 5) * 1000);
        },
      });
    } else {
      audioEngine.stopSpeech();
      // Scène muette ou sans voix off : laisser la musique respirer pendant la durée de la scène
      mutedSceneTimeoutRef.current = setTimeout(() => {
        playScene(sceneIndex + 1);
      }, (scene.durationSeconds || 5) * 1000);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      clearSceneSyncTimers();
      audioEngine.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setIsPlaying(true);
      playScene(currentSceneIdx);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    clearSceneSyncTimers();
    audioEngine.stopAll();
    setCurrentSceneIdx(0);
    setCurrentTime(0);
    setActiveWord('');
    setActiveWordIndex(-1);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSelectScene = (idx: number) => {
    clearSceneSyncTimers();
    setCurrentSceneIdx(idx);
    const startOffset = video.scenes
      .slice(0, idx)
      .reduce((acc, s) => acc + (s.durationSeconds || 6), 0);
    setCurrentTime(startOffset);
    if (idx >= 1) {
      setSelectedTransitionSceneIdx(idx);
    }
    setActiveWord('');
    setActiveWordIndex(-1);
    if (isPlaying) {
      audioEngine.stopSpeech();
      playScene(idx);
    } else if (idx > 0 && !isMuted && video.autoTransitionSfx !== false) {
      const targetTrans = video.scenes[idx]?.transition || video.defaultTransition || 'fade';
      const targetIntensity = video.scenes[idx]?.transitionIntensity || video.transitionIntensity || 'normal';
      audioEngine.playTransitionSfx(targetTrans, Math.max(0.4, voiceVolume * 0.75), targetIntensity);
    }
  };

  const handleSeekTimeline = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const targetSec = Math.round(ratio * totalDuration);
    let acc = 0;
    let targetSceneIdx = 0;
    for (let i = 0; i < video.scenes.length; i++) {
      const dur = video.scenes[i].durationSeconds || 6;
      if (targetSec < acc + dur || i === video.scenes.length - 1) {
        targetSceneIdx = i;
        break;
      }
      acc += dur;
    }
    clearSceneSyncTimers();
    setCurrentTime(targetSec);
    setCurrentSceneIdx(targetSceneIdx);
    if (targetSceneIdx >= 1) {
      setSelectedTransitionSceneIdx(targetSceneIdx);
    }
    setActiveWord('');
    setActiveWordIndex(-1);
    if (isPlaying) {
      audioEngine.stopSpeech();
      playScene(targetSceneIdx);
    }
  };

  const handleChangeSceneDuration = (idx: number, nextDurationSeconds: number) => {
    const safeSec = Math.max(2, Math.min(43200, Math.round(nextDurationSeconds) || 2));
    const updatedScenes = video.scenes.map((s, sIdx) =>
      sIdx === idx ? { ...s, durationSeconds: safeSec } : s
    );
    const newTotal = updatedScenes.reduce((sum, s) => sum + (s.durationSeconds || 6), 0);
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
        totalEstimatedDuration: newTotal,
      },
      `Durée Scène ${idx + 1} : ${formatDurationShort(safeSec)}`
    );
  };

  const handleReorderScenes = (fromIdx: number, toIdx: number) => {
    const total = video.scenes.length;
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= total ||
      toIdx >= total ||
      fromIdx === toIdx
    ) {
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      clearSceneSyncTimers();
      audioEngine.stopSpeech();
      if (timerRef.current) clearInterval(timerRef.current);
    }

    const nextScenes = [...video.scenes];
    const [moved] = nextScenes.splice(fromIdx, 1);
    nextScenes.splice(toIdx, 0, moved);

    const renumbered = nextScenes.map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1,
    }));

    // Conserver la sélection sur la scène suivie après déplacement
    let nextActiveIdx = currentSceneIdx;
    if (currentSceneIdx === fromIdx) {
      nextActiveIdx = toIdx;
    } else if (fromIdx < currentSceneIdx && toIdx >= currentSceneIdx) {
      nextActiveIdx = currentSceneIdx - 1;
    } else if (fromIdx > currentSceneIdx && toIdx <= currentSceneIdx) {
      nextActiveIdx = currentSceneIdx + 1;
    }

    setEditingSceneIdx(null);
    setCurrentSceneIdx(nextActiveIdx);
    if (nextActiveIdx >= 1) {
      setSelectedTransitionSceneIdx(nextActiveIdx);
    }
    setActiveWord('');
    setActiveWordIndex(-1);

    updateVideoWithHistory(
      {
        ...video,
        scenes: renumbered,
      },
      `Scène ${fromIdx + 1} déplacée en position ${toIdx + 1}`
    );
  };

  const computeAdjustedDropIndex = (fromIdx: number, targetIdx: number, position: 'before' | 'after') => {
    const insertAt = position === 'after' ? targetIdx + 1 : targetIdx;
    return insertAt > fromIdx ? insertAt - 1 : insertAt;
  };

  const clearDragState = () => {
    setDraggedSceneIdx(null);
    setDropTarget(null);
  };

  const activeTransitionSceneIdx =
    video.scenes.length > 1
      ? Math.min(Math.max(1, selectedTransitionSceneIdx), video.scenes.length - 1)
      : 0;

  const getTransitionShortLabel = (transition?: SceneTransition) => {
    const t = transition || video.defaultTransition || 'fade';
    if (t === 'slide') return 'Gliss.';
    if (t === 'cut') return 'Cut';
    if (t === 'zoom') return 'Zoom';
    return 'Fondu';
  };

  const getTransitionSfxLabel = (transition?: SceneTransition) => {
    const t = transition || video.defaultTransition || 'fade';
    if (t === 'slide') return 'Whoosh';
    if (t === 'cut') return 'Punch';
    if (t === 'zoom') return 'Riser';
    return 'Swell';
  };

  const handleToggleAutoSfx = () => {
    const nextEnabled = video.autoTransitionSfx === false;
    updateVideoWithHistory(
      { ...video, autoTransitionSfx: nextEnabled },
      nextEnabled ? 'SFX automatiques activés sur les transitions' : 'SFX automatiques désactivés'
    );
  };

  const handlePreviewTransition = (targetSceneIdx: number, overrideTransition?: SceneTransition) => {
    if (video.scenes.length < 2) return;
    const clampedIdx = Math.min(Math.max(1, targetSceneIdx), video.scenes.length - 1);
    setSelectedTransitionSceneIdx(clampedIdx);
    setCurrentSceneIdx(clampedIdx);
    setTransitionPreviewNonce((prev) => prev + 1);
    setActiveWord('');
    if (isPlaying) {
      audioEngine.stopSpeech();
      playScene(clampedIdx);
    } else if (!isMuted && video.autoTransitionSfx !== false) {
      const transitionToPlay =
        overrideTransition ||
        video.scenes[clampedIdx]?.transition ||
        video.defaultTransition ||
        'fade';
      const intensityToPlay =
        video.scenes[clampedIdx]?.transitionIntensity || video.transitionIntensity || 'normal';
      audioEngine.playTransitionSfx(transitionToPlay, Math.max(0.45, voiceVolume * 0.75), intensityToPlay);
    }
  };

  const handleChangeTransitionIntensity = (
    intensity: TransitionIntensity,
    scopeOverride?: 'all' | 'scene',
    targetIdxOverride?: number,
    previewInPlayer = true
  ) => {
    const scope = scopeOverride ?? transitionIntensityScope;
    const cfg = getTransitionIntensityConfig(intensity);
    const targetIdx =
      targetIdxOverride ??
      (video.scenes.length > 1 ? activeTransitionSceneIdx : 0);

    if (scope === 'scene' && video.scenes.length > 1 && targetIdx > 0) {
      const updatedScenes = video.scenes.map((scene, idx) =>
        idx === targetIdx ? { ...scene, transitionIntensity: intensity } : scene
      );
      updateVideoWithHistory(
        { ...video, scenes: updatedScenes },
        `Vitesse Sc.${targetIdx} → Sc.${targetIdx + 1} : ${cfg.label} (${cfg.shortLabel})`
      );
    } else {
      const clearedScenes = video.scenes.map((scene) => ({
        ...scene,
        transitionIntensity: undefined,
      }));
      updateVideoWithHistory(
        {
          ...video,
          transitionIntensity: intensity,
          scenes: clearedScenes,
        },
        `Vitesse des transitions : ${cfg.label} (${cfg.shortLabel})`
      );
    }

    if (previewInPlayer && video.scenes.length > 1) {
      const previewIdx = Math.min(Math.max(1, targetIdx), video.scenes.length - 1);
      setSelectedTransitionSceneIdx(previewIdx);
      setCurrentSceneIdx(previewIdx);
      setTransitionPreviewNonce((prev) => prev + 1);
      if (!isMuted && video.autoTransitionSfx !== false) {
        const transType = video.scenes[previewIdx]?.transition || video.defaultTransition || 'fade';
        audioEngine.playTransitionSfx(transType, Math.max(0.45, voiceVolume * 0.75), intensity);
      }
    }
  };

  const syncBalanceFromChannels = (nextVoice: number, nextMusic: number) => {
    const total = nextVoice + nextMusic;
    if (total <= 0) {
      setAudioBalance(50);
      return;
    }
    setAudioBalance(Math.round((nextMusic / total) * 100));
  };

  const handleRelativeBalanceChange = (balanceVal: number) => {
    const clamped = Math.max(0, Math.min(100, balanceVal));
    setAudioBalance(clamped);
    // Courbe douce : conserve une voix nette à gauche/centre, monte la musique progressivement à droite
    const nextVoice =
      clamped <= 40 ? 1.0 : Number(Math.max(0.25, 1.0 - ((clamped - 40) / 60) * 0.75).toFixed(2));
    const nextMusic =
      clamped <= 60
        ? Number(((clamped / 60) * 0.65).toFixed(2))
        : Number((0.65 + ((clamped - 60) / 40) * 0.35).toFixed(2));

    setVoiceVolume(nextVoice);
    setMusicVolume(nextMusic);
    if (isMuted && (nextVoice > 0 || nextMusic > 0)) {
      setIsMuted(false);
    }
    audioEngine.setMusicVolume(nextMusic);
  };

  const handleVoiceVolumeChange = (nextVoice: number) => {
    const clamped = Number(Math.max(0, Math.min(1, nextVoice)).toFixed(2));
    setVoiceVolume(clamped);
    if (isMuted && clamped > 0) setIsMuted(false);
    syncBalanceFromChannels(clamped, musicVolume);
  };

  const handleMusicVolumeChange = (nextMusic: number) => {
    const clamped = Number(Math.max(0, Math.min(1, nextMusic)).toFixed(2));
    setMusicVolume(clamped);
    if (isMuted && clamped > 0) setIsMuted(false);
    audioEngine.setMusicVolume(clamped);
    syncBalanceFromChannels(voiceVolume, clamped);
  };

  const handleApplyAudioMixPreset = (presetVoice: number, presetMusic: number, label: string) => {
    setVoiceVolume(presetVoice);
    setMusicVolume(presetMusic);
    syncBalanceFromChannels(presetVoice, presetMusic);
    if (isMuted) setIsMuted(false);
    audioEngine.setMusicVolume(presetMusic);
    showShareToast(`Mixage « ${label} » appliqué`);
  };

  const autoDucking = video.autoDucking !== false;
  const duckingIntensity = typeof video.duckingIntensity === 'number' ? video.duckingIntensity : 0.6;
  const isCurrentSceneVoiceActive =
    Boolean(currentScene?.voiceoverText?.trim()) &&
    currentScene?.voiceEnabled !== false &&
    !isMuted &&
    voiceVolume > 0;
  const effectiveDuckedMusicPercent = Math.round(
    musicVolume * (autoDucking && isCurrentSceneVoiceActive ? Math.max(0.08, 1 - duckingIntensity) : 1) * 100
  );

  // Synchroniser en temps réel les paramètres de ducking avec l'AudioEngine
  useEffect(() => {
    audioEngine.configureDucking(autoDucking, duckingIntensity);
  }, [autoDucking, duckingIntensity]);

  const handleToggleAutoDucking = () => {
    const nextEnabled = !autoDucking;
    audioEngine.configureDucking(nextEnabled, duckingIntensity);
    updateVideoWithHistory(
      { ...video, autoDucking: nextEnabled },
      nextEnabled ? 'Ducking automatique activé' : 'Ducking automatique désactivé'
    );
    showShareToast(
      nextEnabled
        ? `Ducking automatique activé (-${Math.round(duckingIntensity * 100)}% pendant la voix off)`
        : 'Ducking automatique désactivé'
    );
  };

  const handleChangeDuckingIntensity = (nextIntensity: number) => {
    const clamped = Number(Math.max(0.2, Math.min(0.85, nextIntensity)).toFixed(2));
    audioEngine.configureDucking(true, clamped);
    onUpdateVideo({
      ...video,
      autoDucking: true,
      duckingIntensity: clamped,
    });
  };

  const handleToggleSceneVoice = (idx: number) => {
    const target = video.scenes[idx];
    if (!target) return;
    const nextEnabled = target.voiceEnabled === false;
    const updatedScenes = video.scenes.map((s, sIdx) =>
      sIdx === idx ? { ...s, voiceEnabled: nextEnabled } : s
    );
    if (!nextEnabled && isPlaying && idx === currentSceneIdx) {
      audioEngine.stopSpeech();
    }
    updateVideoWithHistory(
      { ...video, scenes: updatedScenes },
      nextEnabled
        ? `Voix off activée sur Scène ${target.sceneNumber}`
        : `Voix off coupée sur Scène ${target.sceneNumber} (musique à 100%)`
    );
  };

  // Synchronisation du temps global
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            handleStop();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      clearSceneSyncTimers();
      audioEngine.stopAll();
    };
  }, []);

  // Réinitialiser l'historique quand une autre vidéo est chargée, et restaurer ses préférences locales si existantes
  useEffect(() => {
    if (lastVideoIdRef.current !== video.id) {
      lastVideoIdRef.current = video.id;
      setPastStates([]);
      setFutureStates([]);
      const savedPrefs = loadPlayerPrefs(video.id);
      if (savedPrefs) {
        setCurrentSceneIdx(Math.min(Math.max(0, savedPrefs.currentSceneIdx), Math.max(0, video.scenes.length - 1)));
        setPreviewAspectRatio(savedPrefs.previewAspectRatio);
        setShowFramingGuides(savedPrefs.showFramingGuides);
        setVoiceVolume(savedPrefs.voiceVolume);
        setMusicVolume(savedPrefs.musicVolume);
        setAudioBalance(savedPrefs.audioBalance);
        setIsMuted(savedPrefs.isMuted);
        setActiveTab(savedPrefs.activeTab);
        setVocalSpeed(savedPrefs.vocalSpeed);
        setCtaObjective(savedPrefs.ctaObjective);
        setCustomWatermark(savedPrefs.customWatermark);
        setShowWatermark(savedPrefs.showWatermark);
      } else {
        setCurrentSceneIdx(0);
        setPreviewAspectRatio(
          video.aspectRatio === '16:9' ? '16:9' : video.aspectRatio === '4:5' ? '4:5' : '9:16'
        );
      }
      setExportFormat(
        video.aspectRatio === '16:9' ? '16:9' : video.aspectRatio === '1:1' ? '1:1' : '9:16'
      );
    }
  }, [video.id, video.aspectRatio, video.scenes.length]);

  // Sauvegarde automatique des préférences du lecteur pour le projet en cours
  useEffect(() => {
    const timer = setTimeout(() => {
      savePlayerPrefs({
        videoId: video.id,
        currentSceneIdx,
        previewAspectRatio,
        showFramingGuides,
        voiceVolume,
        musicVolume,
        audioBalance,
        isMuted,
        activeTab,
        vocalSpeed,
        ctaObjective,
        customWatermark,
        showWatermark,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    video.id,
    currentSceneIdx,
    previewAspectRatio,
    showFramingGuides,
    voiceVolume,
    musicVolume,
    audioBalance,
    isMuted,
    activeTab,
    vocalSpeed,
    ctaObjective,
    customWatermark,
    showWatermark,
  ]);

  const handleApplyPreviewRatioToVideo = () => {
    if (video.aspectRatio === previewAspectRatio) return;
    const label =
      previewAspectRatio === '9:16'
        ? '9:16 (TikTok / Shorts)'
        : previewAspectRatio === '4:5'
        ? '4:5 (Instagram)'
        : '16:9 (YouTube)';
    updateVideoWithHistory(
      {
        ...video,
        aspectRatio: previewAspectRatio,
      },
      `Format de rendu appliqué : ${label}`
    );
  };

  // Fonction centrale de mise à jour avec enregistrement de l'état précédent dans la pile Undo
  const updateVideoWithHistory = (newVideo: GeneratedVideo, actionLabel?: string) => {
    // Garder jusqu'à 30 états en mémoire
    setPastStates((prev) => [...prev.slice(-30), video]);
    setFutureStates([]); // Une nouvelle action efface la pile de rétablissement
    onUpdateVideo(newVideo);
    if (actionLabel) {
      showShareToast(actionLabel);
    }
  };

  const addMediaInputRef = useRef<HTMLInputElement | null>(null);
  const replaceSceneInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceTargetSceneIdx, setReplaceTargetSceneIdx] = useState<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const vidEl = previewVideoRef.current;
    if (!vidEl) return;
    vidEl.playbackRate = currentScene?.playbackRate ?? 1.0;
    const clipVol = currentScene?.clipVolume ?? 0;
    vidEl.muted = isMuted || clipVol <= 0.01;
    vidEl.volume = Math.max(0, Math.min(1, clipVol));
    if (isPlaying || currentScene?.aiAnimated) {
      const startSec = Math.max(0, currentScene?.trimStart ?? 0);
      if (startSec > 0 && vidEl.currentTime < startSec) {
        try {
          vidEl.currentTime = startSec;
        } catch {
          // ignore
        }
      }
      vidEl.play().catch(() => {});
    } else {
      vidEl.pause();
    }
  }, [
    isPlaying,
    currentSceneIdx,
    currentScene?.aiAnimated,
    currentScene?.videoUrl,
    currentScene?.playbackRate,
    currentScene?.clipVolume,
    currentScene?.trimStart,
    isMuted,
  ]);

  const handleAddUploadedMediaScenes = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items = await processUploadedMediaFiles(files);
    if (items.length === 0) return;

    const newScenes: VideoScene[] = items.map((item, offset) => ({
      sceneNumber: video.scenes.length + offset + 1,
      voiceoverText: `Séquence personnalisée : ${item.name.replace(/\.[^/.]+$/, '')}.`,
      durationSeconds: item.durationSeconds,
      visualDescription: `${item.mediaType === 'video' ? 'Vidéo importée' : 'Photo importée'} (${item.name})`,
      imagePrompt: item.name,
      visualThemeKeyword: 'cinematic',
      keywords: [item.mediaType === 'video' ? 'vidéo' : 'photo'],
      kenBurnsEffect: 'zoom-in',
      imageUrl: item.previewUrl,
      mediaType: item.mediaType,
      videoUrl: item.videoUrl,
      transition: video.defaultTransition || 'fade',
    }));

    const updatedScenes = [...video.scenes, ...newScenes];
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
        totalEstimatedDuration: updatedScenes.reduce((acc, s) => acc + s.durationSeconds, 0),
      },
      `${newScenes.length} média${newScenes.length > 1 ? 's' : ''} ajouté${newScenes.length > 1 ? 's' : ''} au montage`
    );
    setCurrentSceneIdx(video.scenes.length);
  };

  const handleReplaceSceneMedia = async (files: FileList | null) => {
    if (!files || files.length === 0 || replaceTargetSceneIdx === null) return;
    const items = await processUploadedMediaFiles(files);
    if (items.length === 0) return;
    const item = items[0];
    const updatedScenes = video.scenes.map((s, idx) =>
      idx === replaceTargetSceneIdx
        ? {
            ...s,
            imageUrl: item.previewUrl,
            mediaType: item.mediaType,
            videoUrl: item.videoUrl,
            durationSeconds: item.mediaType === 'video' ? item.durationSeconds : s.durationSeconds,
          }
        : s
    );
    updateVideoWithHistory(
      { ...video, scenes: updatedScenes },
      `Média de la scène ${replaceTargetSceneIdx + 1} remplacé`
    );
    setReplaceTargetSceneIdx(null);
  };

  const [isBatchAnimatingAll, setIsBatchAnimatingAll] = useState<boolean>(false);

  // Transformer n'importe quelle image de scène en clip vidéo animé par IA (Image → Vidéo)
  const handleAnimateSceneToVideo = async (idx: number, presetOverride?: ImageMotionPreset) => {
    const targetScene = video.scenes[idx];
    if (!targetScene || animatingSceneIdx !== null || isBatchAnimatingAll) return;

    const chosenPreset: ImageMotionPreset =
      presetOverride || targetScene.motionPreset || 'orbit-3d';
    setAnimatingSceneIdx(idx);
    try {
      const clip = await synthesizeImageToVideoClip({
        imageUrl: targetScene.imageUrl,
        motionPreset: chosenPreset,
        intensity: targetScene.motionIntensity || 'cinematic',
        aspectRatio: video.aspectRatio,
        durationSeconds: Math.min(8, Math.max(4, targetScene.durationSeconds || 5)),
        focalPoint: targetScene.focalPoint || { x: 0.5, y: 0.45 },
        colorGrade: video.colorGrade,
        enableParticles: true,
        enableLightRays: true,
      });

      const updatedScenes = video.scenes.map((s, sIdx) =>
        sIdx === idx
          ? {
              ...s,
              mediaType: 'video' as const,
              videoUrl: clip.videoUrl,
              motionPreset: chosenPreset,
              aiAnimated: true,
            }
          : s
      );
      updateVideoWithHistory(
        { ...video, scenes: updatedScenes },
        `Scène ${idx + 1} animée en vidéo IA (${IMAGE_MOTION_PRESETS.find((p) => p.id === chosenPreset)?.label || chosenPreset})`
      );
      setCurrentSceneIdx(idx);
      showShareToast(`Scène ${idx + 1} transformée en vidéo IA !`);
    } catch (err) {
      console.error('Erreur animation image -> vidéo:', err);
      showShareToast("Impossible d'animer cette image pour le moment.");
    } finally {
      setAnimatingSceneIdx(null);
    }
  };

  // Animer toutes les scènes du projet en clips vidéo 2.5D/3D en un clic
  const handleAnimateAllScenesToVideo = async () => {
    if (isBatchAnimatingAll || animatingSceneIdx !== null || video.scenes.length === 0) return;
    setIsBatchAnimatingAll(true);
    try {
      const nextScenes = [...video.scenes];
      for (let i = 0; i < nextScenes.length; i++) {
        const s = nextScenes[i];
        setAnimatingSceneIdx(i);
        const chosenPreset: ImageMotionPreset =
          s.motionPreset || IMAGE_MOTION_PRESETS[i % IMAGE_MOTION_PRESETS.length].id;
        const clip = await synthesizeImageToVideoClip({
          imageUrl: s.imageUrl,
          motionPreset: chosenPreset,
          intensity: s.motionIntensity || 'cinematic',
          aspectRatio: video.aspectRatio,
          durationSeconds: Math.min(8, Math.max(4, s.durationSeconds || 5)),
          focalPoint: s.focalPoint || { x: 0.5, y: 0.45 },
          colorGrade: video.colorGrade,
          enableParticles: true,
          enableLightRays: true,
        });
        nextScenes[i] = {
          ...s,
          mediaType: 'video',
          videoUrl: clip.videoUrl,
          motionPreset: chosenPreset,
          aiAnimated: true,
        };
      }
      updateVideoWithHistory(
        { ...video, scenes: nextScenes },
        `Toutes les scènes (${nextScenes.length}) animées en vidéo IA`
      );
      showShareToast(`${nextScenes.length} scènes animées en vidéo IA !`);
    } catch (err) {
      console.error('Erreur animation batch scènes:', err);
      showShareToast("Une erreur s'est produite pendant l'animation des scènes.");
    } finally {
      setAnimatingSceneIdx(null);
      setIsBatchAnimatingAll(false);
    }
  };

  // Annuler la dernière action (Undo)
  const handleUndo = () => {
    if (pastStates.length === 0) return;
    const previous = pastStates[pastStates.length - 1];
    const newPast = pastStates.slice(0, pastStates.length - 1);
    setPastStates(newPast);
    setFutureStates((prev) => [video, ...prev]);
    onUpdateVideo(previous);
    showShareToast('Action annulée ↩️');
  };

  // Rétablir l'action annulée (Redo)
  const handleRedo = () => {
    if (futureStates.length === 0) return;
    const next = futureStates[0];
    const newFuture = futureStates.slice(1);
    setFutureStates(newFuture);
    setPastStates((prev) => [...prev, video]);
    onUpdateVideo(next);
    showShareToast('Action rétablie ↪️');
  };

  // Écouteur global des raccourcis clavier Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Laisser le comportement natif si l'utilisateur tape dans un textarea
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pastStates, futureStates, video]);

  // Modification du texte / sous-titre d'une scène
  const handleSaveSceneText = (idx: number) => {
    const trimmed = editedText.trim();
    if (!trimmed || trimmed === video.scenes[idx].voiceoverText) {
      setEditingSceneIdx(null);
      return;
    }
    const updatedScenes = [...video.scenes];
    updatedScenes[idx] = {
      ...updatedScenes[idx],
      voiceoverText: trimmed,
    };
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
      },
      `Sous-titre scène ${idx + 1} modifié`
    );
    setEditingSceneIdx(null);
  };

  // Changement d'image pour une scène
  const handleRegenerateImage = (idx: number) => {
    const alternativeUrls = [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80',
    ];
    const newUrl = alternativeUrls[Math.floor(Math.random() * alternativeUrls.length)];
    const updatedScenes = [...video.scenes];
    updatedScenes[idx] = {
      ...updatedScenes[idx],
      imageUrl: newUrl,
    };
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
      },
      `Image de la scène ${idx + 1} modifiée`
    );
  };

  // Changement de l'effet de caméra
  const handleChangeEffect = (idx: number, effect: CameraEffect) => {
    const updatedScenes = [...video.scenes];
    updatedScenes[idx] = {
      ...updatedScenes[idx],
      kenBurnsEffect: effect,
    };
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
      },
      `Effet de caméra scène ${idx + 1} : ${effect}`
    );
  };

  // Changement granulaire de la transition pour un enchaînement spécifique (Scène idx-1 -> Scène idx)
  const handleChangeTransition = (idx: number, transition: SceneTransition, previewInPlayer = false) => {
    const updatedScenes = [...video.scenes];
    updatedScenes[idx] = {
      ...updatedScenes[idx],
      transition,
    };
    const label =
      transition === 'fade'
        ? 'Fondu'
        : transition === 'slide'
        ? 'Glissement'
        : transition === 'cut'
        ? 'Cut'
        : 'Zoom';

    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
      },
      idx > 0
        ? `Transition Scène ${idx} → ${idx + 1} : ${label}`
        : `Transition scène 1 : ${label}`
    );

    if (previewInPlayer && idx >= 1) {
      setSelectedTransitionSceneIdx(idx);
      setCurrentSceneIdx(idx);
      setTransitionPreviewNonce((prev) => prev + 1);
      if (!isMuted && video.autoTransitionSfx !== false) {
        const targetIntensity = video.scenes[idx]?.transitionIntensity || video.transitionIntensity || 'normal';
        audioEngine.playTransitionSfx(transition, Math.max(0.45, voiceVolume * 0.75), targetIntensity);
      }
    }
  };

  const EXPORT_FORMAT_OPTIONS: Array<{
    id: AspectRatio;
    label: string;
    ratio: string;
    platforms: string;
    hdResolution: string;
    uhdResolution: string;
    previewClass: string;
  }> = [
    {
      id: '9:16',
      label: 'Portrait',
      ratio: '9:16',
      platforms: 'TikTok · Reels · Shorts',
      hdResolution: '1080×1920',
      uhdResolution: '2160×3840',
      previewClass: 'w-3 h-5',
    },
    {
      id: '1:1',
      label: 'Carré',
      ratio: '1:1',
      platforms: 'Instagram · LinkedIn',
      hdResolution: '1080×1080',
      uhdResolution: '2160×2160',
      previewClass: 'w-4 h-4',
    },
    {
      id: '16:9',
      label: 'Paysage',
      ratio: '16:9',
      platforms: 'YouTube · Web · Cinéma',
      hdResolution: '1920×1080',
      uhdResolution: '3840×2160',
      previewClass: 'w-5 h-3',
    },
  ];

  const handleOpenExportMenu = () => {
    setExportProgress(null);
    setIsExporting(false);
    setIsExportMenuOpen(true);
  };

  // Export du fichier vidéo au format MP4 dans le ratio choisi
  const handleExportVideo = async (chosenFormat: AspectRatio = exportFormat) => {
    setIsExportMenuOpen(true);
    setActiveExportFormat(chosenFormat);
    setIsExporting(true);
    setExportProgress({
      progress: 5,
      status: `Initialisation de l'encodage MP4 (${chosenFormat})...`,
      isCompleted: false,
    });

    // Pause la lecture prévisuelle
    if (isPlaying) {
      handleTogglePlay();
    }

    try {
      const isProOrBusiness = user.plan === 'pro' || user.plan === 'business';
      const activeQuality: ExportQualityPreset = user.plan === 'business' ? exportQuality : '1080p-30';
      const blob = await exportVideoFile(
        video,
        isProOrBusiness,
        (progress) => {
          setExportProgress(progress);
        },
        activeQuality,
        {
          voiceVolume: isMuted ? 0 : voiceVolume,
          musicVolume: isMuted ? 0 : musicVolume,
          autoDucking,
          duckingIntensity,
        },
        chosenFormat
      );

      // Nom de fichier final au format MP4 incluant le format choisi
      const safeTitle = video.title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
      const formatTag = chosenFormat.replace(':', 'x');
      const resLabel = activeQuality === '4k-60' ? '4K_60fps' : '1080p';
      const filename = `${safeTitle}_FOFO_AI_${formatTag}_${resLabel}.mp4`;

      setExportedBlob(blob);
      setExportedFilename(filename);

      // Déclenche le téléchargement du fichier MP4
      triggerDownload(blob, filename);

      // Lance les confettis pour célébrer
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00D2FF', '#3B82F6', '#FFFFFF', '#60A5FA', '#10B981'],
        });
      } catch (e) {
        // ignore
      }

      setExportProgress({
        progress: 100,
        status: `Votre vidéo MP4 (${chosenFormat}) a été exportée et téléchargée avec succès !`,
        isCompleted: true,
      });
    } catch (err) {
      console.error('Erreur export:', err);
      setIsExporting(false);
      setExportProgress(null);
      showShareToast("Une erreur est survenue lors de l'exportation de la vidéo MP4.");
    }
  };

  const handleRedownload = () => {
    if (exportedBlob && exportedFilename) {
      triggerDownload(exportedBlob, exportedFilename);
      showShareToast('Téléchargement du fichier MP4 relancé !');
    }
  };

  const handleCopyScript = () => {
    const fullScript = video.scenes
      .map((s, i) => `[Scène ${i + 1} - ${formatDurationShort(s.durationSeconds)}]\n${s.voiceoverText}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyTags = () => {
    navigator.clipboard.writeText(video.hashtags.join(' '));
    setCopiedTags(true);
    setTimeout(() => setCopiedTags(false), 2000);
  };

  const handleSaveProjectScriptToLibrary = () => {
    if (!onSaveToLibrary) return;
    const cleanTags = video.hashtags
      .map((h) => h.replace(/^#+/, '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
    onSaveToLibrary({
      id: `lib-script-${Date.now()}`,
      type: 'script',
      title: video.title,
      description: video.description,
      tags: Array.from(new Set([...cleanTags, video.niche || 'studio'])),
      createdAt: new Date().toISOString(),
      scriptData: {
        prompt: video.description || video.hook,
        hook: video.hook,
        style: video.style,
        aspectRatio: video.aspectRatio,
        duration: video.totalEstimatedDuration,
        niche: video.niche,
        scenes: video.scenes.map((s) => ({
          voiceoverText: s.voiceoverText,
          visualDescription: s.visualDescription,
          durationSeconds: s.durationSeconds,
          imagePrompt: s.imagePrompt,
        })),
      },
    });
    setSavedLibraryScript(true);
    setTimeout(() => setSavedLibraryScript(false), 2200);
  };

  const handleSaveSceneImageToLibrary = (scene: VideoScene, idx: number) => {
    if (!onSaveToLibrary) return;
    onSaveToLibrary({
      id: `lib-image-${Date.now()}-${idx}`,
      type: 'image',
      title: `${video.title.slice(0, 34)} · Scène ${scene.sceneNumber}`,
      description: scene.visualDescription,
      tags: ['scène', video.style, ...(scene.keywords || []).slice(0, 2)].filter(Boolean),
      createdAt: new Date().toISOString(),
      imageData: {
        imageUrl: scene.imageUrl,
        source: 'Projet Studio',
        author: user.name || 'Créateur',
        imagePrompt: scene.imagePrompt,
      },
    });
    setSavedSceneLibraryMap((prev) => ({ ...prev, [idx]: true }));
    setTimeout(() => {
      setSavedSceneLibraryMap((prev) => ({ ...prev, [idx]: false }));
    }, 2000);
  };

  const handleSaveCurrentVoiceToLibrary = () => {
    if (!onSaveToLibrary) return;
    const existingCustom = customVoices.find((v) => v.id === video.voiceId);
    const baseId = existingCustom?.voiceData?.baseVoiceId || video.voiceId;
    const baseObj = VOICES.find((v) => v.id === baseId) || VOICES[0];
    const defaultPitch =
      baseObj.id === 'thomas'
        ? 0.85
        : baseObj.id === 'chloe'
        ? 1.15
        : baseObj.id === 'sarah'
        ? 1.05
        : baseObj.id === 'alex'
        ? 0.9
        : 0.98;
    const pitch = existingCustom?.voiceData?.pitch ?? defaultPitch;
    onSaveToLibrary({
      id: `lib-voice-${Date.now()}`,
      type: 'voice',
      title: `${baseObj.name} · ${vocalSpeed.toFixed(2)}x (${video.title.slice(0, 22)})`,
      description: `Réglage vocal sauvegardé depuis ${video.title}`,
      tags: ['voix-perso', baseObj.id, video.niche || 'studio'].filter(Boolean),
      createdAt: new Date().toISOString(),
      voiceData: {
        baseVoiceId: baseObj.id,
        pitch,
        rate: Number(vocalSpeed.toFixed(2)),
        gender: baseObj.gender,
        sampleText: video.scenes[0]?.voiceoverText || video.hook,
      },
    });
    setSavedLibraryVoice(true);
    setTimeout(() => setSavedLibraryVoice(false), 2200);
  };

  const showShareToast = (msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 3500);
  };

  // Obtenir le lien de partage officiel de la vidéo
  const getVideoShareUrl = () => {
    if (typeof window !== 'undefined') {
      const base = `${window.location.origin}${window.location.pathname}`;
      return `${base}?v=${encodeURIComponent(video.id)}`;
    }
    return `https://fofo.ai/watch?v=${video.id}`;
  };

  // Copier le lien de la vidéo dans le presse-papier
  const handleCopyVideoLink = () => {
    const url = getVideoShareUrl();
    navigator.clipboard.writeText(url);
    setCopiedVideoLink(true);
    showShareToast('Lien de la vidéo copié dans le presse-papier ! 🔗');
    setTimeout(() => setCopiedVideoLink(false), 2500);
  };

  // Partage direct via l'API Web Share native vers les applications mobiles installées (WhatsApp, Instagram, TikTok, Twitter, SMS...)
  const handleNativeWebShare = async () => {
    const url = getVideoShareUrl();
    const shareData: ShareData = {
      title: video.title,
      text: `🎬 Regardez cette vidéo IA créée avec FOFO AI : "${video.title}" !\n${video.hook}\n\nLien :`,
      url: url,
    };

    // Si un rendu MP4 a été exporté, tenter d'inclure le fichier vidéo dans le partage natif
    if (exportedBlob && typeof File !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const file = new File([exportedBlob], exportedFilename || `FOFO_${video.title.slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_')}.mp4`, {
          type: 'video/mp4',
        });
        const fileShareData = {
          title: video.title,
          text: `🎬 "${video.title}"\n${video.hook}\n\n${url}`,
          files: [file],
        };
        if (navigator.canShare(fileShareData)) {
          await navigator.share(fileShareData);
          showShareToast('Vidéo MP4 et lien partagés avec succès ! 🚀');
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Partage de fichier non supporté, bascule sur URL:', err);
      }
    }

    // Partage direct du lien via l'API Web Share native
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        showShareToast('Lien partagé avec succès via votre application ! 🚀');
        return;
      } catch (err: any) {
        // Annulé par l'utilisateur (fermeture de la feuille de partage native sans choisir d'app)
        if (err.name === 'AbortError') {
          return;
        }
        console.warn('Web Share URL standard échoué, tentative simplifiée:', err);
        try {
          // Certaines implémentations mobiles n'acceptent que l'URL
          await navigator.share({
            title: video.title,
            url: url,
          });
          showShareToast('Lien partagé avec succès ! 🚀');
          return;
        } catch (innerErr: any) {
          if (innerErr.name === 'AbortError') return;
        }
      }
    }

    // Fallback gracieux sur navigateur sans Web Share (Firefox Desktop, etc.)
    navigator.clipboard.writeText(url);
    showShareToast('Lien copié dans le presse-papier ! Choisissez votre réseau 📲');
    setIsShareModalOpen(true);
  };

  // Alias pour rétrocompatibilité
  const handleQuickShare = handleNativeWebShare;

  const handleShareTwitter = () => {
    const url = getVideoShareUrl();
    const tweetText = `🎬 Découvrez ma nouvelle vidéo IA : "${video.title}" !\n\n${video.hook}\n\nCréé avec @FOFO_AI 🚀\n${video.hashtags.slice(0, 3).join(' ')}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    showShareToast('Ouverture de Twitter / X avec le lien...');
  };

  const handleShareTikTok = () => {
    const url = getVideoShareUrl();
    const captionText = `${video.title}\n\n${video.hook}\n\nLien : ${url}\n\n${video.hashtags.join(' ')}`;
    navigator.clipboard.writeText(captionText);
    showShareToast('Lien, description et hashtags copiés pour TikTok ! Redirection...');
    setTimeout(() => {
      window.open('https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer');
    }, 600);
  };

  const handleShareInstagram = () => {
    const url = getVideoShareUrl();
    const captionText = `${video.title}\n\n${video.hook}\n\nLien : ${url}\n\n${video.hashtags.join(' ')}\n\nVidéo créée avec @fofo.ai`;
    navigator.clipboard.writeText(captionText);
    showShareToast('Lien et description copiés pour Instagram Reels ! Redirection...');
    setTimeout(() => {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }, 600);
  };

  const handleShareWhatsApp = () => {
    const url = getVideoShareUrl();
    const text = `Regarde cette vidéo IA créée sur FOFO AI : "${video.title}" !\n\n${video.hook}\n\nLien : ${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showShareToast('Ouverture de WhatsApp...');
  };

  const handleSave = () => {
    onSaveToCreations(video);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Outils Avancés : Hooks Viraux calculés
  const VIRAL_HOOK_TEMPLATES = [
    {
      type: 'Curiosité & Choc',
      badge: '99% Rétention',
      text: `Voici le secret que 99% des gens ignorent sur ${video.title.slice(0, 40)}... et la vérité va vous choquer.`,
    },
    {
      type: 'Avertissement Immédiat',
      badge: 'Tendance TikTok #1',
      text: `Arrêtez tout ! Si vous vous intéressez à ${video.title.slice(0, 35)}, cette seule erreur détruit tout.`,
    },
    {
      type: 'Preuve & Révélation',
      badge: 'Format Viral Pro',
      text: `Des experts ont enfin brisé le silence : ce qu'on vous a toujours caché sur ${video.title.slice(0, 40)}.`,
    },
  ];

  const handleApplyHook = (newHookText: string) => {
    const updatedScenes = [...video.scenes];
    updatedScenes[0] = {
      ...updatedScenes[0],
      voiceoverText: newHookText,
    };
    updateVideoWithHistory(
      {
        ...video,
        hook: newHookText,
        scenes: updatedScenes,
      },
      'Nouveau Hook Viral appliqué à la Scène 1 ⚡'
    );
  };

  const handlePlaySfx = (type: TrendingSfxId) => {
    setActiveSfx(type);
    audioEngine.playSfx(type);
    setTimeout(() => setActiveSfx(null), 500);
  };

  const handleToggleHookSfx = (type: TrendingSfxId | 'none') => {
    if (type !== 'none') {
      audioEngine.playSfx(type);
    }
    const sfxLabel =
      type === 'none'
        ? 'Aucun'
        : TRENDING_SFX_LIST.find((s) => s.id === type)?.name || type;
    updateVideoWithHistory(
      { ...video, hookSfx: type },
      type === 'none' ? 'Son Hook Intro désactivé' : `Son Hook Intro : ${sfxLabel}`
    );
  };

  const handleCopyOptimizedCta = () => {
    let ctaText = '';
    if (ctaObjective === 'comments') {
      ctaText = `💬 Et vous, que pensez-vous de cette vérité ? Donnez votre avis en commentaire sous la vidéo !`;
    } else if (ctaObjective === 'followers') {
      ctaText = `🚀 Abonne-toi à @FOFO_AI pour ne manquer aucun secret chaque jour !`;
    } else {
      ctaText = `📲 Envoie cette vidéo à un ami qui a impérativement besoin d'entendre ce conseil !`;
    }

    const fullText = `${video.title}\n\n${video.description}\n\n${ctaText}\n\n${video.hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopiedCta(true);
    setTimeout(() => setCopiedCta(false), 2200);
    showShareToast('Description avec Call-To-Action copiée !');
  };

  const handleTranslateScript = (lang: 'en' | 'es' | 'fr') => {
    const updatedScenes = video.scenes.map((scene, idx) => {
      let translated = scene.voiceoverText;
      if (lang === 'en') {
        if (idx === 0) {
          translated = `Here is the fascinating truth about "${video.title.slice(0, 35)}" that 99% of people still ignore.`;
        } else if (idx === video.scenes.length - 1) {
          translated = `What do you think about this discovery? Let us know in the comments and subscribe for part 2!`;
        } else {
          translated = `Key point number ${idx}: the invisible factor that completely transforms our understanding of the phenomenon.`;
        }
      } else if (lang === 'es') {
        if (idx === 0) {
          translated = `Aquí está la verdad fascinante sobre "${video.title.slice(0, 35)}" que el 99% de las personas ignora.`;
        } else if (idx === video.scenes.length - 1) {
          translated = `¿Qué opinas sobre este descubrimiento? ¡Dinos en los comentarios y suscríbete para la parte 2!`;
        } else {
          translated = `Punto clave número ${idx}: el factor invisible que cambia por completo cómo entendemos este fenómeno.`;
        }
      } else {
        // Restaurer
        translated = scene.voiceoverText;
      }
      return {
        ...scene,
        voiceoverText: translated,
      };
    });

    const langLabel = lang === 'en' ? 'Anglais (US)' : lang === 'es' ? 'Espagnol (ES)' : 'Français';
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
      },
      `Script traduit en ${langLabel} 🌍`
    );
  };

  // Effets de tendance & étalonnage couleur (catalogue partagé Shorts & Reels)
  const TRENDING_EFFECT_OPTIONS = TRENDING_EFFECT_LIST;

  const COLOR_GRADE_OPTIONS: Array<{
    id: ColorGradePreset;
    label: string;
    cssFilter: string;
    swatchClass: string;
  }> = [
    { id: 'natural', label: 'Naturel', cssFilter: 'none', swatchClass: 'bg-slate-500' },
    {
      id: 'teal-orange',
      label: 'Teal & Orange',
      cssFilter: 'contrast(1.12) saturate(1.22) sepia(0.08)',
      swatchClass: 'bg-gradient-to-tr from-cyan-500 to-orange-400',
    },
    {
      id: 'noir-contrast',
      label: 'Film Noir',
      cssFilter: 'grayscale(1) contrast(1.35) brightness(0.95)',
      swatchClass: 'bg-gradient-to-tr from-zinc-900 to-zinc-200',
    },
    {
      id: 'golden-hour',
      label: 'Golden Hour',
      cssFilter: 'sepia(0.24) saturate(1.35) brightness(1.06)',
      swatchClass: 'bg-gradient-to-tr from-amber-500 to-yellow-200',
    },
    {
      id: 'cyber-blue',
      label: 'Cyber Bleu',
      cssFilter: 'contrast(1.18) saturate(1.4) hue-rotate(-12deg)',
      swatchClass: 'bg-gradient-to-tr from-blue-700 to-cyan-300',
    },
  ];

  const activeTrendingEffect: TrendingEffectId =
    currentScene?.trendingEffect || video.trendingEffect || 'none';

  const activeColorGradeCss: string =
    COLOR_GRADE_OPTIONS.find((c) => c.id === (video.colorGrade || 'natural'))?.cssFilter || 'none';

  const handleApplyTrendingEffect = (effectId: TrendingEffectId) => {
    const label = TRENDING_EFFECT_OPTIONS.find((e) => e.id === effectId)?.label || effectId;
    if (effectApplyScope === 'scene') {
      const updatedScenes = video.scenes.map((scene, idx) =>
        idx === currentSceneIdx ? { ...scene, trendingEffect: effectId } : scene
      );
      updateVideoWithHistory(
        {
          ...video,
          scenes: updatedScenes,
        },
        `Effet « ${label} » appliqué à la Scène ${currentSceneIdx + 1}`
      );
    } else {
      const clearedScenes = video.scenes.map((scene) => ({
        ...scene,
        trendingEffect: undefined,
      }));
      updateVideoWithHistory(
        {
          ...video,
          trendingEffect: effectId,
          scenes: clearedScenes,
        },
        `Effet « ${label} » appliqué à toute la vidéo`
      );
    }
  };

  const handleApplyColorGrade = (preset: ColorGradePreset) => {
    const label = COLOR_GRADE_OPTIONS.find((c) => c.id === preset)?.label || preset;
    updateVideoWithHistory(
      {
        ...video,
        colorGrade: preset,
      },
      `Étalonnage « ${label} » appliqué`
    );
  };

  const handleToggleBeatPulse = () => {
    const nextState = !video.beatPulse;
    updateVideoWithHistory(
      {
        ...video,
        beatPulse: nextState,
      },
      nextState ? 'Effet Beat-Pulse activé' : 'Effet Beat-Pulse désactivé'
    );
  };

  // Édits Avancés de montage en 1 clic
  const handleApplyDynamicPacingEdit = () => {
    const cameras: CameraEffect[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
    const transitions: SceneTransition[] = ['cut', 'zoom', 'slide'];
    const updatedScenes = video.scenes.map((scene, idx) => ({
      ...scene,
      durationSeconds: idx === 0 ? 4 : 5,
      kenBurnsEffect: cameras[idx % cameras.length],
      transition: idx === 0 ? 'cut' : transitions[idx % transitions.length],
    }));
    const newTotal = updatedScenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
        totalEstimatedDuration: newTotal,
      },
      'Montage dynamique TikTok appliqué (cuts rapides)'
    );
  };

  const handleAlternateCamerasEdit = () => {
    const cameras: CameraEffect[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
    const updatedScenes = video.scenes.map((scene, idx) => ({
      ...scene,
      kenBurnsEffect: cameras[idx % cameras.length],
    }));
    updateVideoWithHistory(
      {
        ...video,
        scenes: updatedScenes,
      },
      'Caméras Ken Burns alternées sur toutes les scènes'
    );
  };

  const handleSplitCurrentScene = () => {
    const target = video.scenes[currentSceneIdx];
    if (!target) return;

    const rawText = target.voiceoverText.trim();
    const words = rawText.split(/\s+/).filter(Boolean);
    let part1 = rawText;
    let part2 = rawText;

    const sentences = rawText.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length >= 2) {
      const midSentence = Math.ceil(sentences.length / 2);
      part1 = sentences.slice(0, midSentence).join(' ').trim();
      part2 = sentences.slice(midSentence).join(' ').trim();
    } else if (words.length >= 2) {
      const midWord = Math.ceil(words.length / 2);
      part1 = words.slice(0, midWord).join(' ');
      part2 = words.slice(midWord).join(' ');
    }

    const baseDuration = target.durationSeconds || 6;
    const dur1 = Math.max(2, Math.floor(baseDuration / 2));
    const dur2 = Math.max(2, Math.ceil(baseDuration / 2));
    const contrastCamera: CameraEffect =
      target.kenBurnsEffect === 'zoom-in' ? 'pan-right' : 'zoom-in';

    const firstHalf: VideoScene = {
      ...target,
      voiceoverText: part1,
      durationSeconds: dur1,
    };
    const secondHalf: VideoScene = {
      ...target,
      voiceoverText: part2,
      durationSeconds: dur2,
      kenBurnsEffect: contrastCamera,
      transition: 'cut',
    };

    const nextScenes = [
      ...video.scenes.slice(0, currentSceneIdx),
      firstHalf,
      secondHalf,
      ...video.scenes.slice(currentSceneIdx + 1),
    ].map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));

    const newTotal = nextScenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0);
    updateVideoWithHistory(
      {
        ...video,
        scenes: nextScenes,
        totalEstimatedDuration: newTotal,
      },
      `Scène ${currentSceneIdx + 1} scindée en 2 plans`
    );
  };

  const handleApplyDetectedCuts = (cuts: SuggestedCutPoint[]) => {
    if (cuts.length === 0) return;
    if (isPlaying) {
      setIsPlaying(false);
      clearSceneSyncTimers();
      audioEngine.stopSpeech();
      if (timerRef.current) clearInterval(timerRef.current);
    }

    const nextScenes = applySuggestedCutsToScenes(video.scenes, cuts);
    if (nextScenes.length === video.scenes.length) {
      showShareToast('Aucune coupe applicable sur ces segments.');
      return;
    }

    const addedCount = nextScenes.length - video.scenes.length;
    const newTotal = nextScenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0);
    setEditingSceneIdx(null);
    setCurrentSceneIdx((prev) => Math.min(prev, Math.max(0, nextScenes.length - 1)));
    updateVideoWithHistory(
      {
        ...video,
        scenes: nextScenes,
        totalEstimatedDuration: newTotal,
      },
      `${addedCount} nouveau${addedCount > 1 ? 'x' : ''} plan${addedCount > 1 ? 's' : ''} créé${addedCount > 1 ? 's' : ''} selon le rythme de la voix off`
    );
  };

  const handleSyncDurationsToVoice = (durationsSec: number[]) => {
    const nextScenes = video.scenes.map((scene, idx) => ({
      ...scene,
      durationSeconds: Math.max(2, durationsSec[idx] ?? scene.durationSeconds ?? 5),
    }));
    const newTotal = nextScenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    updateVideoWithHistory(
      {
        ...video,
        scenes: nextScenes,
        totalEstimatedDuration: newTotal,
      },
      `Durées synchronisées sur la voix off (~${formatDurationShort(newTotal)})`
    );
  };

  const handleDuplicateCurrentScene = () => {
    const target = video.scenes[currentSceneIdx];
    if (!target) return;
    const clone: VideoScene = {
      ...target,
      kenBurnsEffect: target.kenBurnsEffect === 'zoom-in' ? 'zoom-out' : 'zoom-in',
      transition: 'cut',
    };
    const nextScenes = [
      ...video.scenes.slice(0, currentSceneIdx + 1),
      clone,
      ...video.scenes.slice(currentSceneIdx + 1),
    ].map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));

    const newTotal = nextScenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0);
    updateVideoWithHistory(
      {
        ...video,
        scenes: nextScenes,
        totalEstimatedDuration: newTotal,
      },
      `Scène ${currentSceneIdx + 1} dupliquée`
    );
  };

  const handleDeleteScene = (targetIndex = currentSceneIdx) => {
    if (video.scenes.length <= 1) {
      showShareToast('La vidéo doit contenir au moins 1 scène.');
      return;
    }
    const nextScenes = video.scenes
      .filter((_, idx) => idx !== targetIndex)
      .map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
    const nextIdx = Math.min(targetIndex, nextScenes.length - 1);
    const newTotal = nextScenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0);
    setCurrentSceneIdx(Math.max(0, nextIdx));
    updateVideoWithHistory(
      {
        ...video,
        scenes: nextScenes,
        totalEstimatedDuration: newTotal,
      },
      `Scène ${targetIndex + 1} supprimée`
    );
  };

  const handleQuickRotateActiveScene = () => {
    if (!currentScene) return;
    const prevRot = currentScene.transform?.rotation ?? 0;
    const nextRot = (prevRot + 90) % 360;
    const nextScenes = video.scenes.map((s, idx) =>
      idx === currentSceneIdx
        ? { ...s, transform: { ...s.transform, rotation: nextRot } }
        : s
    );
    updateVideoWithHistory({ ...video, scenes: nextScenes }, `Rotation ${nextRot}° appliquée`);
  };

  const handleQuickFlipActiveScene = () => {
    if (!currentScene) return;
    const nextFlip = !currentScene.transform?.flipH;
    const nextScenes = video.scenes.map((s, idx) =>
      idx === currentSceneIdx
        ? { ...s, transform: { ...s.transform, flipH: nextFlip } }
        : s
    );
    updateVideoWithHistory(
      { ...video, scenes: nextScenes },
      nextFlip ? 'Miroir horizontal activé' : 'Miroir horizontal désactivé'
    );
  };

  const handleQuickZoomToggleActiveScene = () => {
    if (!currentScene) return;
    const currentZoom = currentScene.transform?.zoom ?? 1;
    const nextZoom = currentZoom >= 1.24 ? 1.0 : 1.25;
    const nextScenes = video.scenes.map((s, idx) =>
      idx === currentSceneIdx
        ? { ...s, transform: { ...s.transform, zoom: nextZoom } }
        : s
    );
    updateVideoWithHistory(
      { ...video, scenes: nextScenes },
      `Zoom cadrage : ${nextZoom.toFixed(2)}x`
    );
  };

  return (
    <div className="space-y-4">
      {/* Studio Top Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-950 dark:text-white">
              {video.aspectRatio === '9:16'
                ? 'TikTok / Shorts 9:16'
                : video.aspectRatio === '4:5'
                ? 'Instagram 4:5'
                : video.aspectRatio === '16:9'
                ? 'YouTube 16:9'
                : 'Instagram 1:1'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {video.scenes.length} scènes · ~{formatDurationShort(totalDuration)} totales
            </span>
            {video.aiModel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {AI_MODEL_ENGINES.find((m) => m.id === video.aiModel)?.name || 'Gemini 4'}
                </span>
              </>
            )}
            {video.imageVideoEngine && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#DD2A7B] font-semibold">
                  {IMAGE_VIDEO_ENGINES.find((e) => e.id === video.imageVideoEngine)?.name || 'Kling 2.0'}
                </span>
              </>
            )}
            {video.niche && video.niche !== 'general' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="capitalize text-zinc-700 dark:text-zinc-300">{video.niche}</span>
              </>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-heading text-zinc-950 dark:text-white tracking-tight line-clamp-1">
            {video.title}
          </h2>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Annuler / Rétablir (Undo / Redo) */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={handleUndo}
              disabled={pastStates.length === 0}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pastStates.length > 0
                  ? 'text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] cursor-pointer'
                  : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-40'
              }`}
              title={
                pastStates.length > 0
                  ? `Annuler la dernière modification (Ctrl+Z) · ${pastStates.length} action(s)`
                  : 'Aucune modification à annuler'
              }
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Annuler</span>
              {pastStates.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] tabular-nums">
                  {pastStates.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={futureStates.length === 0}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                futureStates.length > 0
                  ? 'text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] cursor-pointer'
                  : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-40'
              }`}
              title={
                futureStates.length > 0
                  ? `Rétablir la modification (Ctrl+Y) · ${futureStates.length} action(s)`
                  : 'Aucune modification à rétablir'
              }
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Rétablir</span>
              {futureStates.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] tabular-nums">
                  {futureStates.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleNativeWebShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.2] transition-all cursor-pointer whitespace-nowrap"
            title="Partager directement vers vos applications mobiles installées ou copier le lien"
          >
            <Share2 className="w-4 h-4 text-[#0095F6]" />
            <span>Partager</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
              savedSuccess
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-zinc-100 dark:bg-[#18181B] border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.2]'
            }`}
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <FolderPlus className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />}
            <span>{savedSuccess ? 'Enregistré !' : 'Sauvegarder'}</span>
          </button>

          <button
            onClick={onNewVideo}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.2] transition-all cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-[#DD2A7B]" />
            <span>Nouvelle vidéo</span>
          </button>

          <button
            data-export-btn="true"
            onClick={handleOpenExportMenu}
            disabled={isExporting}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-heading text-xs sm:text-sm font-bold text-white electric-button-gradient cursor-pointer whitespace-nowrap"
            title="Ouvrir le menu d'exportation et choisir le format (9:16, 1:1, 16:9)"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exportation MP4...' : 'Exporter la vidéo'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/35 font-mono text-white font-bold tabular-nums">
              {exportFormat}
            </span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Center Cinema Stage on Left, Scene & Style Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 flex flex-col items-center space-y-3">
          {/* Preview Aspect Ratio Selector (9:16 TikTok · 4:5 Instagram · 16:9 YouTube) */}
          <div className="w-full p-2.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2">
            <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
              <span className="font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                Aperçu cadrage ·{' '}
                <span className="text-zinc-950 dark:text-white font-semibold tabular-nums">
                  {previewAspectRatio === '9:16'
                    ? 'TikTok 9:16'
                    : previewAspectRatio === '4:5'
                    ? 'Instagram 4:5'
                    : 'YouTube 16:9'}
                </span>
              </span>

              {previewAspectRatio !== video.aspectRatio ? (
                <button
                  type="button"
                  onClick={handleApplyPreviewRatioToVideo}
                  className="text-[11px] font-semibold text-[#0095F6] hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  title="Appliquer ce format au rendu final MP4"
                >
                  Appliquer au rendu ({previewAspectRatio})
                </button>
              ) : (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap shrink-0">
                  Format rendu actif
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <div
                role="group"
                aria-label="Sélecteur de format de prévisualisation"
                className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06]"
              >
                {(
                  [
                    { id: '9:16', ratioLabel: '9:16', platform: 'TikTok', iconClass: 'w-2 h-3.5' },
                    { id: '4:5', ratioLabel: '4:5', platform: 'Instagram', iconClass: 'w-2.5 h-3' },
                    { id: '16:9', ratioLabel: '16:9', platform: 'YouTube', iconClass: 'w-3.5 h-2' },
                  ] as const
                ).map((fmt) => {
                  const isActive = previewAspectRatio === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setPreviewAspectRatio(fmt.id)}
                      aria-pressed={isActive}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block rounded-[2px] border ${fmt.iconClass} ${
                          isActive ? 'border-white bg-white/15 dark:border-black dark:bg-black/15' : 'border-zinc-500'
                        }`}
                      />
                      <span className="tabular-nums">{fmt.ratioLabel}</span>
                      <span className="hidden sm:inline text-[10px] opacity-80">{fmt.platform}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowFramingGuides((prev) => !prev)}
                aria-pressed={showFramingGuides}
                className={`px-2.5 py-2 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  showFramingGuides
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                    : 'bg-zinc-100 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.18]'
                }`}
                title="Afficher la grille et les zones sûres de cadrage"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Cadrage</span>
              </button>
            </div>
          </div>

          {/* Cinema Stage Viewport Frame */}
          <div className="w-full rounded-2xl bg-zinc-100 dark:bg-[#08080A] border border-zinc-200 dark:border-white/[0.08] p-4 sm:p-5 flex items-center justify-center">
            <div
              className={`relative rounded-[24px] overflow-hidden bg-black border transition-all duration-200 flex items-center justify-center ${
                activeTrendingEffect === 'neon-cyber'
                  ? 'border-[#DD2A7B]/80 shadow-[0_0_32px_rgba(221,42,123,0.35)]'
                  : 'border-white/[0.12] shadow-2xl'
              } ${
                previewAspectRatio === '9:16'
                  ? 'w-full max-w-[300px] sm:max-w-[330px] aspect-[9/16]'
                  : previewAspectRatio === '4:5'
                  ? 'w-full max-w-[340px] sm:max-w-[370px] aspect-[4/5]'
                  : 'w-full max-w-[560px] aspect-[16/9]'
              }`}
            >
            {/* Active Scene Background with Photo Adjustments, Transform, Ken Burns, Color Grading & Trending Effects */}
            {(() => {
              const combinedFilterCss = buildCombinedSceneFilterCss(currentScene, video.colorGrade);
              const transformCss = buildSceneTransformCss(currentScene);
              const isContainFit = transformCss.objectFit === 'contain';
              const activeTransitionType = currentScene.transition || video.defaultTransition || 'fade';
              const activeIntensityCfg = getTransitionIntensityConfig(
                currentScene.transitionIntensity || video.transitionIntensity || 'normal'
              );
              const trimStartSec = Math.max(0, currentScene.trimStart ?? 0);
              const trimEndSec =
                currentScene.trimEnd && currentScene.trimEnd > trimStartSec
                  ? currentScene.trimEnd
                  : 0;

              return (
            <div
              className={`absolute inset-0 overflow-hidden ${
                activeTrendingEffect === 'rgb-glitch' ? 'effect-rgb-glitch' : ''
              } ${activeTrendingEffect === 'zoom-punch' ? 'effect-zoom-punch' : ''} ${
                video.beatPulse && isPlaying ? 'effect-beat-pulse' : ''
              }`}
              style={{
                filter: combinedFilterCss,
              }}
            >
                  <div
                    key={`trans-${currentSceneIdx}-${transitionPreviewNonce}`}
                    style={
                      activeTransitionType !== 'cut'
                        ? ({
                            animationDuration: `${activeIntensityCfg.durationSec}s`,
                            '--transition-blur': `${activeIntensityCfg.blurPx}px`,
                            '--transition-zoom-scale': `${activeIntensityCfg.zoomScale}`,
                          } as React.CSSProperties)
                        : undefined
                    }
                    className={`w-full h-full relative ${
                      activeTransitionType === 'fade'
                        ? 'anim-transition-fade'
                        : activeTransitionType === 'slide'
                        ? 'anim-transition-slide'
                        : activeTransitionType === 'zoom'
                        ? 'anim-transition-zoom'
                        : 'anim-transition-cut'
                    }`}
                  >
                {isContainFit && (
                  <img
                    src={currentScene.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-55 pointer-events-none"
                  />
                )}
                {currentScene.mediaType === 'video' && currentScene.videoUrl ? (
                  <video
                    ref={previewVideoRef}
                    key={`vid-${currentScene.sceneNumber}-${currentScene.videoUrl}`}
                    src={currentScene.videoUrl}
                    autoPlay={isPlaying || Boolean(currentScene.aiAnimated)}
                    loop
                    muted={isMuted || !isPlaying || (currentScene.clipVolume ?? 0) <= 0.01}
                    playsInline
                    onLoadedMetadata={(e) => {
                      const vid = e.currentTarget;
                      vid.playbackRate = currentScene.playbackRate ?? 1.0;
                      if (trimStartSec > 0) {
                        vid.currentTime = trimStartSec;
                      }
                    }}
                    onTimeUpdate={(e) => {
                      const vid = e.currentTarget;
                      if (trimEndSec > 0 && vid.currentTime >= trimEndSec) {
                        vid.currentTime = trimStartSec;
                      }
                    }}
                    className={`w-full h-full relative z-[1] ${
                      isContainFit ? 'object-contain' : 'object-cover'
                    }`}
                    style={{
                      transform: transformCss.transform,
                      objectPosition: transformCss.objectPosition,
                    }}
                  />
                ) : (
                  <img
                    key={currentScene.sceneNumber}
                    src={currentScene.imageUrl}
                    alt={currentScene.visualDescription}
                    className={`w-full h-full relative z-[1] ${
                      isContainFit ? 'object-contain' : 'object-cover'
                    } ${
                      !transformCss.transform && !isContainFit
                        ? currentScene.kenBurnsEffect === 'zoom-in'
                          ? 'anim-kenburns-zoom-in'
                          : currentScene.kenBurnsEffect === 'zoom-out'
                          ? 'anim-kenburns-zoom-out'
                          : currentScene.kenBurnsEffect === 'pan-left'
                          ? 'anim-kenburns-pan-left'
                          : 'anim-kenburns-pan-right'
                        : ''
                    }`}
                    style={{
                      transform: transformCss.transform,
                      objectPosition: transformCss.objectPosition,
                    }}
                  />
                )}
                  </div>

              {transformCss.vignetteOpacity > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none z-[5]"
                  style={{
                    background: `radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(0,0,0,${transformCss.vignetteOpacity.toFixed(
                      2
                    )}) 100%)`,
                  }}
                />
              )}

              {/* Trending Visual Overlays */}
              {activeTrendingEffect === 'vhs-retro' && (
                <>
                  <div className="absolute inset-0 effect-vhs-scanlines pointer-events-none" />
                  <div className="absolute top-12 left-4 px-2 py-0.5 rounded bg-black/50 text-[10px] font-mono font-bold text-red-400 tracking-widest pointer-events-none">
                    REC ● VHS
                  </div>
                </>
              )}

              {activeTrendingEffect === 'film-grain' && (
                <div className="absolute inset-0 effect-film-grain pointer-events-none" />
              )}

              {activeTrendingEffect === 'prism-glow' && (
                <div className="absolute inset-0 effect-prism-glow pointer-events-none" />
              )}

              {activeTrendingEffect === 'neon-cyber' && (
                <div className="absolute inset-2 rounded-2xl border border-[#DD2A7B]/70 shadow-[inset_0_0_24px_rgba(221,42,123,0.3)] pointer-events-none" />
              )}

              {activeTrendingEffect === 'cinema-bars' && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-[9%] bg-black pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-[9%] bg-black pointer-events-none z-10" />
                </>
              )}

              {activeTrendingEffect === 'flash-beat' && (
                <div className="absolute inset-0 effect-flash-beat pointer-events-none" />
              )}

              {activeTrendingEffect === 'spotlight-vignette' && (
                <div className="absolute inset-0 effect-spotlight-vignette pointer-events-none" />
              )}

              {activeTrendingEffect === 'speed-blur' && (
                <div className="absolute inset-0 effect-speed-blur pointer-events-none" />
              )}

              {activeTrendingEffect === 'camcorder-rec' && (
                <div className="absolute inset-3 pointer-events-none z-10">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/60" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/60" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/60" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/60" />
                  <div className="absolute top-9 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/55 text-[10px] font-mono font-bold text-white">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>REC 00:0{currentSceneIdx + 1} · 4K</span>
                  </div>
                </div>
              )}

              {/* Cinematic Vignette & Bottom Gradient for Subtitles */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/35 pointer-events-none" />
            </div>
              );
            })()}

            {/* Custom Scene Overlay Text Banner */}
            {currentScene.overlay?.text && currentScene.overlay.text.trim() && (
              <div
                className={`absolute left-4 right-4 z-20 flex justify-center pointer-events-none ${
                  currentScene.overlay.position === 'bottom'
                    ? previewAspectRatio === '16:9'
                      ? 'bottom-20'
                      : 'bottom-28'
                    : currentScene.overlay.position === 'center'
                    ? 'top-1/2 -translate-y-1/2'
                    : 'top-14'
                }`}
              >
                <span
                  className="px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 font-heading text-xs sm:text-sm font-extrabold tracking-tight text-center shadow-lg"
                  style={{ color: currentScene.overlay.color || '#FFFFFF' }}
                >
                  {currentScene.overlay.text}
                </span>
              </div>
            )}

            {/* Framing Safe-Zone & Rule of Thirds Overlay */}
            {showFramingGuides && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/15" />

                <div
                  className={`absolute border border-dashed border-white/70 rounded-lg ${
                    previewAspectRatio === '9:16'
                      ? 'top-[10%] bottom-[20%] left-[6%] right-[16%]'
                      : previewAspectRatio === '4:5'
                      ? 'inset-[8%]'
                      : 'top-[6%] bottom-[14%] left-[5%] right-[5%]'
                  }`}
                >
                  <span className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono font-semibold text-white tabular-nums">
                    Zone sûre · {previewAspectRatio}
                  </span>
                </div>
              </div>
            )}

            {/* Top Bar inside Player */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
              <div className="px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white tabular-nums">
                SCÈNE {currentSceneIdx + 1}/{video.scenes.length}
              </div>

              {user.plan === 'free' ? (
                <div className="px-2 py-0.5 rounded bg-black/65 backdrop-blur-md border border-white/15 text-[9px] font-semibold text-zinc-300">
                  FOFO AI
                </div>
              ) : user.plan === 'business' ? (
                <div className="px-2 py-0.5 rounded bg-emerald-950/85 border border-emerald-400/50 text-[9px] font-bold text-emerald-300">
                  BUSINESS 4K
                </div>
              ) : (
                <div className="px-2 py-0.5 rounded bg-black/70 border border-white/20 text-[9px] font-bold text-white">
                  PRO 4K
                </div>
              )}
            </div>

            {/* Play/Pause Overlay Icon if paused */}
            {!isPlaying && (
              <button
                onClick={handleTogglePlay}
                className="absolute z-20 w-16 h-16 rounded-full bg-black/65 backdrop-blur-md border border-white/25 text-white flex items-center justify-center hover:scale-105 hover:bg-black/80 transition-all cursor-pointer"
              >
                <Play className="w-7 h-7 ml-1 fill-white" />
              </button>
            )}

            {/* Subtitles Overlay */}
            <div
              className={`absolute ${
                previewAspectRatio === '16:9' ? 'bottom-7' : 'bottom-12'
              } left-4 right-4 z-10 text-center pointer-events-none`}
            >
              {video.captionStyle === 'hormozi' ? (
                <div className="inline-block px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/10">
                  <p className="font-heading text-sm sm:text-base font-bold tracking-tight leading-snug">
                    {currentScene.voiceoverText.trim().split(/\s+/).filter(Boolean).map((word, wIdx) => {
                      const isHighlit =
                        (activeWordIndex >= 0 && wIdx === activeWordIndex) ||
                        (activeWord.length > 0 && word.toLowerCase().includes(activeWord.toLowerCase())) ||
                        currentScene.keywords.some((k) => k && word.toLowerCase().includes(k.toLowerCase()));
                      return (
                        <span
                          key={wIdx}
                          className={`inline-block mx-0.5 transition-transform duration-150 ${
                            isHighlit
                              ? 'text-yellow-300 scale-105'
                              : 'text-white'
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </p>
                </div>
              ) : video.captionStyle === 'neon-blue' ? (
                <div className="inline-block px-3.5 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20">
                  <p className="font-heading text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                    {currentScene.voiceoverText.trim().split(/\s+/).filter(Boolean).map((word, wIdx) => {
                      const isHighlit =
                        (activeWordIndex >= 0 && wIdx === activeWordIndex) ||
                        (activeWord.length > 0 && word.toLowerCase().includes(activeWord.toLowerCase()));
                      return (
                        <span
                          key={wIdx}
                          className={`inline-block mx-0.5 px-1 rounded transition-colors duration-150 ${
                            isHighlit ? 'bg-white text-black font-bold' : 'text-zinc-100'
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </p>
                </div>
              ) : video.captionStyle === 'karaoke' ? (
                (() => {
                  const karaokeColor = video.karaokeHighlightColor || DEFAULT_KARAOKE_HIGHLIGHT_COLOR;
                  const words = currentScene.voiceoverText.trim().split(/\s+/).filter(Boolean);
                  const previewIdx = !isPlaying && activeWordIndex < 0 ? Math.min(1, Math.max(0, words.length - 1)) : activeWordIndex;

                  return (
                    <div className="inline-block px-4 py-2 rounded-xl bg-black/78 backdrop-blur-md border border-white/15">
                      <p className="font-heading text-sm sm:text-base font-bold tracking-tight leading-snug">
                        {words.map((word, wIdx) => {
                          const isCurrent = isPlaying && wIdx === previewIdx;
                          const isIlluminated = wIdx <= previewIdx;
                          return (
                            <span
                              key={wIdx}
                              className={`inline-block mx-0.5 transition-all duration-150 ${
                                isCurrent ? 'scale-110 font-extrabold' : ''
                              }`}
                              style={{
                                color: isIlluminated ? karaokeColor : 'rgba(255, 255, 255, 0.45)',
                                textShadow: isCurrent
                                  ? `0 0 14px ${karaokeColor}D9, 0 2px 6px rgba(0, 0, 0, 0.8)`
                                  : isIlluminated
                                  ? '0 1px 4px rgba(0, 0, 0, 0.75)'
                                  : '0 1px 3px rgba(0, 0, 0, 0.7)',
                              }}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="inline-block px-3.5 py-1.5 rounded-xl bg-black/65 backdrop-blur-md">
                  <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed tracking-tight">
                    {currentScene.voiceoverText}
                  </p>
                </div>
              )}
            </div>

            {/* Scene progress bars inside player */}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-1 z-10">
              {video.scenes.map((_, sIdx) => (
                <div
                  key={sIdx}
                  className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden cursor-pointer"
                  onClick={() => handleSelectScene(sIdx)}
                >
                  <div
                    className={`h-full bg-white transition-all ${
                      sIdx < currentSceneIdx
                        ? 'w-full'
                        : sIdx === currentSceneIdx
                        ? isPlaying
                          ? 'w-full duration-5000'
                          : 'w-1/2'
                        : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>
            </div>
          </div>

          {/* Quick Docked Photo & Video Action Toolbar (1-Click Access for Active Scene) */}
          <div className="w-full p-2 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('photo-edit')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'photo-edit'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-[#09090B] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.08]'
                }`}
                title="Ouvrir tous les outils de retouche photo"
              >
                <Sliders className="w-3.5 h-3.5 text-[#0095F6]" />
                <span>Retouche Photo</span>
                {hasCustomPhotoEdits(currentScene) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0095F6]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('video-fx')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'video-fx'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-[#09090B] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.08]'
                }`}
                title="Ouvrir tous les outils de montage vidéo & effets"
              >
                <Film className="w-3.5 h-3.5 text-[#DD2A7B]" />
                <span>Montage Vidéo</span>
                {hasCustomVideoEdits(currentScene) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DD2A7B]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('scenes');
                  setIsSceneDetectorOpen((prev) => (activeTab === 'scenes' ? !prev : true));
                }}
                aria-expanded={activeTab === 'scenes' && isSceneDetectorOpen}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'scenes' && isSceneDetectorOpen
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-[#09090B] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.08]'
                }`}
                title="Analyser le rythme de la voix off pour détecter automatiquement les points de coupe"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span>Détection scènes</span>
              </button>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={handleQuickRotateActiveScene}
                className="p-1.5 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors"
                title="Pivoter +90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleQuickFlipActiveScene}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  currentScene.transform?.flipH
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title="Miroir horizontal"
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleQuickZoomToggleActiveScene}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  (currentScene.transform?.zoom ?? 1) > 1
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title="Zoom rapide 1.25x / 1.00x"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSplitCurrentScene}
                className="p-1.5 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors"
                title="Scinder la scène en 2 plans"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDuplicateCurrentScene}
                className="p-1.5 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors"
                title="Dupliquer la scène"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {video.scenes.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteScene(currentSceneIdx)}
                  className="p-1.5 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-rose-600 dark:text-rose-400 hover:border-rose-500/40 cursor-pointer transition-colors"
                  title="Supprimer cette scène"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Higgsfield-style Multi-Scene Storyboard Strip (Drag & Drop Reorderable) */}
          <div className="w-full p-2.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 min-w-0">
                <Film className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="whitespace-nowrap">Séquences du montage</span>
                <span className="text-zinc-500 font-mono tabular-nums whitespace-nowrap">
                  · {video.scenes.length} plans · ~{formatDurationShort(totalDuration)}
                </span>
                {video.scenes.length > 1 && (
                  <span className="hidden sm:inline text-[10px] font-normal text-zinc-400 dark:text-zinc-500 truncate">
                    · Glisser-déposer pour réorganiser
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('scenes');
                    setIsSceneDetectorOpen((prev) => (activeTab === 'scenes' ? !prev : true));
                  }}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-zinc-950 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Analyser la voix off et proposer des points de coupe automatiques"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Coupes auto</span>
                </button>
                <button
                  type="button"
                  onClick={() => addMediaInputRef.current?.click()}
                  className="text-[11px] font-semibold text-[#0095F6] hover:text-zinc-950 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter plan</span>
                </button>
              </div>
            </div>

            <div
              className="flex items-center gap-2 overflow-x-auto pb-1"
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTarget(null);
                }
              }}
            >
              {video.scenes.map((scene, sIdx) => {
                const isActiveScene = sIdx === currentSceneIdx;
                const isDragged = draggedSceneIdx === sIdx;
                const showBeforeIndicator =
                  dropTarget !== null &&
                  dropTarget.index === sIdx &&
                  dropTarget.position === 'before' &&
                  draggedSceneIdx !== null &&
                  computeAdjustedDropIndex(draggedSceneIdx, sIdx, 'before') !== draggedSceneIdx;
                const showAfterIndicator =
                  dropTarget !== null &&
                  dropTarget.index === sIdx &&
                  dropTarget.position === 'after' &&
                  draggedSceneIdx !== null &&
                  computeAdjustedDropIndex(draggedSceneIdx, sIdx, 'after') !== draggedSceneIdx;

                return (
                  <div
                    key={`${scene.sceneNumber}-${sIdx}`}
                    role="button"
                    tabIndex={0}
                    draggable={video.scenes.length > 1}
                    aria-label={`Scène ${scene.sceneNumber}, ${scene.durationSeconds} secondes. Glisser-déposer ou Alt+Flèche pour réorganiser`}
                    onClick={() => handleSelectScene(sIdx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectScene(sIdx);
                      } else if (e.altKey && e.key === 'ArrowLeft' && sIdx > 0) {
                        e.preventDefault();
                        handleReorderScenes(sIdx, sIdx - 1);
                      } else if (e.altKey && e.key === 'ArrowRight' && sIdx < video.scenes.length - 1) {
                        e.preventDefault();
                        handleReorderScenes(sIdx, sIdx + 1);
                      }
                    }}
                    onDragStart={(e) => {
                      if (video.scenes.length <= 1) return;
                      setDraggedSceneIdx(sIdx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(sIdx));
                    }}
                    onDragOver={(e) => {
                      if (draggedSceneIdx === null || draggedSceneIdx === sIdx) {
                        if (draggedSceneIdx === sIdx) setDropTarget(null);
                        return;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos: 'before' | 'after' =
                        e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                      if (!dropTarget || dropTarget.index !== sIdx || dropTarget.position !== pos) {
                        setDropTarget({ index: sIdx, position: pos });
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const rawFrom = e.dataTransfer.getData('text/plain');
                      const fromIdx =
                        draggedSceneIdx !== null
                          ? draggedSceneIdx
                          : rawFrom !== '' && !Number.isNaN(Number(rawFrom))
                          ? Number(rawFrom)
                          : null;
                      if (fromIdx === null) {
                        clearDragState();
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos: 'before' | 'after' =
                        e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                      const toIdx = computeAdjustedDropIndex(fromIdx, sIdx, pos);
                      clearDragState();
                      handleReorderScenes(fromIdx, toIdx);
                    }}
                    onDragEnd={clearDragState}
                    className={`relative w-24 shrink-0 rounded-xl overflow-visible border text-left transition-all select-none group ${
                      video.scenes.length > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                      isDragged
                        ? 'opacity-40 scale-95 border-[#0095F6]'
                        : isActiveScene
                        ? 'border-zinc-900 ring-1 ring-zinc-900/70 dark:border-white dark:ring-white/80'
                        : 'border-zinc-200 dark:border-white/[0.08] opacity-85 hover:opacity-100 hover:border-zinc-400 dark:hover:border-white/25'
                    }`}
                  >
                    {showBeforeIndicator && (
                      <span
                        aria-hidden="true"
                        className="absolute -left-[5px] top-0 bottom-0 w-1 rounded-full bg-[#0095F6] z-30 pointer-events-none"
                      />
                    )}
                    {showAfterIndicator && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-[5px] top-0 bottom-0 w-1 rounded-full bg-[#0095F6] z-30 pointer-events-none"
                      />
                    )}

                    <div className="rounded-[11px] overflow-hidden">
                      <div className="h-14 w-full bg-black overflow-hidden relative">
                        <img
                          src={scene.imageUrl}
                          alt={`Scène ${scene.sceneNumber}`}
                          draggable={false}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/75 text-[9px] font-mono font-bold text-white tabular-nums">
                          Sc.{scene.sceneNumber}
                        </span>
                        <span className="absolute top-1 right-1 px-1 py-0.5 rounded bg-black/75 text-[9px] font-mono text-zinc-200 tabular-nums">
                          {formatDurationShort(scene.durationSeconds)}
                        </span>
                      </div>
                      <div className="px-1.5 py-1 bg-zinc-50 dark:bg-[#09090B] flex items-center justify-between gap-1 text-[9px] text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-0.5 min-w-0">
                          {video.scenes.length > 1 && (
                            <GripVertical className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                          )}
                          <span className="truncate font-medium text-zinc-800 dark:text-zinc-300">
                            {sIdx === 0 ? 'Intro' : getTransitionShortLabel(scene.transition)}
                          </span>
                        </span>
                        {sIdx > 0 && video.autoTransitionSfx !== false && (
                          <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-mono shrink-0">SFX</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => addMediaInputRef.current?.click()}
                title="Ajouter une photo ou vidéo en nouvelle scène"
                className="w-16 h-[76px] shrink-0 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 hover:border-zinc-500 dark:hover:border-white/45 bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.04] flex flex-col items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[9px] font-semibold">Plan</span>
              </button>
            </div>
          </div>

          {/* External Media Controls Bar */}
          <div className="w-full p-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-3">
            {/* Timeline scrubber */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tabular-nums text-zinc-950 dark:text-white font-semibold">
                {formatTimecode(currentTime)}
              </span>
              <div
                onClick={handleSeekTimeline}
                title="Cliquer pour naviguer dans la timeline"
                className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer"
              >
                <div
                  className="h-full bg-zinc-900 dark:bg-white transition-all"
                  style={{ width: `${Math.min(100, (currentTime / (totalDuration || 1)) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                ~{formatTimecode(totalDuration)}
              </span>
            </div>

            {/* Play, Previous, Next, Audio controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSelectScene(Math.max(0, currentSceneIdx - 1))}
                  disabled={currentSceneIdx === 0}
                  className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-10 h-10 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
                </button>

                <button
                  onClick={() => handleSelectScene(Math.min(video.scenes.length - 1, currentSceneIdx + 1))}
                  disabled={currentSceneIdx === video.scenes.length - 1}
                  className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <button
                  onClick={handleStop}
                  className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                  title="Recommencer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Volume & Audio Mixer */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    if (next) audioEngine.stopAll();
                  }}
                  className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-500 dark:text-rose-400" /> : <Volume2 className="w-4 h-4 text-zinc-900 dark:text-white" />}
                </button>

                {/* Subtitle style quick access */}
                <button
                  type="button"
                  onClick={() => setActiveTab('audio-style')}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 font-mono flex items-center gap-1.5 hover:border-zinc-400 dark:hover:border-white/25 cursor-pointer transition-colors"
                  title="Personnaliser le style des sous-titres"
                >
                  {video.captionStyle === 'karaoke' && (
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-xs border border-black/20 dark:border-white/25 shrink-0"
                      style={{ backgroundColor: video.karaokeHighlightColor || DEFAULT_KARAOKE_HIGHLIGHT_COLOR }}
                    />
                  )}
                  <span>{video.captionStyle === 'karaoke' ? 'karaoké' : video.captionStyle}</span>
                </button>
              </div>
            </div>

            {/* Relative Audio Balance Control (Voix Off vs Musique de fond) */}
            <div className="pt-2.5 border-t border-zinc-200 dark:border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Volume1 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                  <span>Balance Voix Off / Musique</span>
                </span>
                <span className="text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {isMuted
                    ? 'Muet'
                    : `Voix ${Math.round(voiceVolume * 100)}% • Mus. ${Math.round(musicVolume * 100)}%`}
                </span>
              </div>

              {/* Relative cross-balance slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1 text-zinc-950 dark:text-white font-semibold">
                    <Volume2 className="w-3 h-3" />
                    Voix off
                  </span>
                  <span className="text-zinc-500 font-mono tabular-nums">Relatif</span>
                  <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-semibold">
                    Musique
                    <Music className="w-3 h-3" />
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={audioBalance}
                  onChange={(e) => handleRelativeBalanceChange(Number(e.target.value))}
                  aria-label="Volume relatif voix off par rapport à la musique de fond"
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
                />
              </div>

              {/* Fine channel sliders + quick relative presets */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Voix off</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
                      {Math.round(voiceVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(voiceVolume * 100)}
                    onChange={(e) => handleVoiceVolumeChange(Number(e.target.value) / 100)}
                    aria-label="Volume de la voix off"
                    className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 dark:text-zinc-400">Musique de fond</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
                      {Math.round(musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(musicVolume * 100)}
                    onChange={(e) => handleMusicVolumeChange(Number(e.target.value) / 100)}
                    aria-label="Volume de la musique de fond"
                    className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#0095F6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyAudioMixPreset(1.0, 0.15, 'Voix nette')}
                  className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    voiceVolume >= 0.9 && musicVolume <= 0.25
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  Voix nette
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyAudioMixPreset(0.9, 0.45, 'Équilibré')}
                  className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    voiceVolume >= 0.75 && musicVolume > 0.25 && musicVolume <= 0.6
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  Équilibré
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyAudioMixPreset(0.55, 0.85, 'Ambiance')}
                  className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    musicVolume > 0.6
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  Ambiance
                </button>
              </div>

              {/* Automatic Audio Ducking Option */}
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Ducking automatique</span>
                      {autoDucking && (
                        <span className="font-mono tabular-nums text-[10px] text-[#0095F6]">
                          -{Math.round(duckingIntensity * 100)}%
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {!autoDucking
                        ? 'Musique à volume constant sur toutes les scènes'
                        : isCurrentSceneVoiceActive
                        ? `Voix active Sc.${currentSceneIdx + 1} · musique réduite à ${effectiveDuckedMusicPercent}%`
                        : `Scène ${currentSceneIdx + 1} sans voix · musique à ${Math.round(musicVolume * 100)}%`}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoDucking}
                    onClick={handleToggleAutoDucking}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors shrink-0 cursor-pointer ${
                      autoDucking
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.1]'
                    }`}
                  >
                    {autoDucking ? 'Activé' : 'Désactivé'}
                  </button>
                </div>

                {autoDucking && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span>Atténuation musique pendant la voix off</span>
                      <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                        -{Math.round(duckingIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={85}
                      step={5}
                      value={Math.round(duckingIntensity * 100)}
                      onChange={(e) => handleChangeDuckingIntensity(Number(e.target.value) / 100)}
                      aria-label="Intensité du ducking automatique"
                      className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#0095F6]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Granular Scene Transition Selector inside Player Controls */}
            {video.scenes.length > 1 && (
              <div className="pt-2.5 border-t border-zinc-200 dark:border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                    <span>Transition Sc.{activeTransitionSceneIdx} → Sc.{activeTransitionSceneIdx + 1}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleAutoSfx}
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                        video.autoTransitionSfx !== false
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                      title="Activer ou désactiver les effets sonores automatiques lors des transitions"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>
                        SFX {video.autoTransitionSfx !== false
                          ? `• ${getTransitionSfxLabel(video.scenes[activeTransitionSceneIdx]?.transition)}`
                          : 'Off'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePreviewTransition(activeTransitionSceneIdx)}
                      className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.08] hover:bg-zinc-200 dark:hover:bg-white/[0.14] border border-zinc-200 dark:border-white/[0.1] text-[10px] font-semibold text-zinc-900 dark:text-white flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
                      title="Prévisualiser cette transition et son SFX dans le lecteur"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Tester</span>
                    </button>
                  </div>
                </div>

                {/* Boundary pills: S1->S2, S2->S3, ... */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {video.scenes.slice(1).map((targetScene, offset) => {
                    const boundaryIdx = offset + 1;
                    const isActiveBoundary = boundaryIdx === activeTransitionSceneIdx;
                    return (
                      <button
                        key={boundaryIdx}
                        type="button"
                        onClick={() => handlePreviewTransition(boundaryIdx)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap tabular-nums transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                          isActiveBoundary
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/20'
                        }`}
                      >
                        <span>Sc.{boundaryIdx}→{boundaryIdx + 1}</span>
                        <span className={`text-[9px] font-mono ${isActiveBoundary ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}>
                          {getTransitionShortLabel(targetScene.transition)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Per-boundary transition choices */}
                <div className="grid grid-cols-4 gap-1.5">
                  {SCENE_TRANSITIONS.map((trans) => {
                    const currentBoundaryTransition =
                      video.scenes[activeTransitionSceneIdx]?.transition || video.defaultTransition || 'fade';
                    const isSelected = currentBoundaryTransition === trans.id;
                    const shortName =
                      trans.id === 'fade'
                        ? 'Fondu'
                        : trans.id === 'slide'
                        ? 'Gliss.'
                        : trans.id === 'cut'
                        ? 'Cut'
                        : 'Zoom';
                    return (
                      <button
                        key={trans.id}
                        type="button"
                        onClick={() => handleChangeTransition(activeTransitionSceneIdx, trans.id, true)}
                        className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/20'
                        }`}
                      >
                        {shortName}
                      </button>
                    );
                  })}
                </div>

                {/* Transition Intensity / Speed Selector */}
                {(() => {
                  const boundaryTransition =
                    video.scenes[activeTransitionSceneIdx]?.transition || video.defaultTransition || 'fade';
                  const activeIntensity =
                    transitionIntensityScope === 'scene'
                      ? video.scenes[activeTransitionSceneIdx]?.transitionIntensity ||
                        video.transitionIntensity ||
                        'normal'
                      : video.transitionIntensity || 'normal';
                  const activeIntensityCfg = getTransitionIntensityConfig(activeIntensity);

                  return (
                    <div className="pt-2 border-t border-zinc-200/80 dark:border-white/[0.06] space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Gauge className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                          <span>Intensité & vitesse</span>
                          <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                            · {boundaryTransition === 'cut' ? '0.00s (Cut)' : activeIntensityCfg.shortLabel}
                          </span>
                        </span>

                        <div
                          role="group"
                          aria-label="Portée de l'intensité de transition"
                          className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]"
                        >
                          <button
                            type="button"
                            onClick={() => setTransitionIntensityScope('all')}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                              transitionIntensityScope === 'all'
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                            }`}
                          >
                            Toutes
                          </button>
                          <button
                            type="button"
                            onClick={() => setTransitionIntensityScope('scene')}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                              transitionIntensityScope === 'scene'
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                            }`}
                          >
                            Sc.{activeTransitionSceneIdx}→{activeTransitionSceneIdx + 1}
                          </button>
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-label="Sélecteur d'intensité des transitions"
                        className="grid grid-cols-4 gap-1.5"
                      >
                        {TRANSITION_INTENSITIES.map((opt) => {
                          const isSelected = activeIntensity === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleChangeTransitionIntensity(opt.id)}
                              title={`${opt.label} (${opt.shortLabel}) — ${opt.desc}`}
                              className={`py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                                  : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/20'
                              }`}
                            >
                              <div className="text-[10px] font-bold leading-tight whitespace-nowrap">
                                {opt.label}
                              </div>
                              <div
                                className={`text-[9px] font-mono tabular-nums leading-tight ${
                                  isSelected
                                    ? 'text-zinc-300 dark:text-zinc-700'
                                    : 'text-zinc-500 dark:text-zinc-500'
                                }`}
                              >
                                {opt.shortLabel}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {boundaryTransition === 'cut' && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          Le Cut brut reste instantané (0s) ; l’intensité s’applique aux fondus, glissements et zooms.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Bouton de Partage Rapide (Share) & Barre Réseaux Sociaux sous le lecteur vidéo */}
          <div className="w-full p-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                Partage rapide
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Lien & Réseaux
              </span>
            </div>

            {/* Bouton Principal de Partage Rapide (Web Share API Native) */}
            <button
              type="button"
              onClick={handleNativeWebShare}
              className="w-full py-2.5 px-4 rounded-xl font-heading text-xs sm:text-sm font-bold text-white bg-[#0095F6] hover:bg-[#1877F2] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              title="Partager via l'API Web Share native vers vos applications installées (WhatsApp, Instagram, TikTok...)"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>
                {supportsNativeShare ? 'Partager vers mes applications' : 'Partager le lien de la vidéo'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-black/25 font-mono text-white flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                {supportsNativeShare ? 'Web Share' : 'Lien'}
              </span>
            </button>

            {supportsNativeShare && (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center flex items-center justify-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                Partage direct WhatsApp, TikTok, Instagram, Messages
              </p>
            )}

            {/* Champ de Copie Directe de l'URL de la vidéo */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
              <div className="pl-2 text-zinc-500 dark:text-zinc-400">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
              </div>
              <input
                type="text"
                readOnly
                value={getVideoShareUrl()}
                className="flex-1 bg-transparent text-[11px] font-mono text-zinc-700 dark:text-zinc-300 truncate outline-none select-all"
                title="Lien direct de la vidéo"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={handleCopyVideoLink}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                  copiedVideoLink
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
                }`}
                title="Copier le lien direct de la vidéo"
              >
                {copiedVideoLink ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedVideoLink ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            {/* Grille de Partage 1-Clic Réseaux Sociaux */}
            <div className="grid grid-cols-5 gap-1.5 pt-0.5">
              {/* TikTok */}
              <button
                type="button"
                onClick={handleShareTikTok}
                title="Partager le lien sur TikTok (copie description & hashtags)"
                className="py-2 px-1 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current text-zinc-900 dark:text-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
                </svg>
                <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-200">TikTok</span>
              </button>

              {/* Instagram */}
              <button
                type="button"
                onClick={handleShareInstagram}
                title="Partager le lien sur Instagram Reels"
                className="py-2 px-1 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] hover:border-pink-400/50 transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current text-[#E1306C] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-200">Insta</span>
              </button>

              {/* Twitter / X */}
              <button
                type="button"
                onClick={handleShareTwitter}
                title="Partager le lien sur Twitter / X"
                className="py-2 px-1 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 fill-current text-zinc-900 dark:text-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-200">X / Twitter</span>
              </button>

              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                title="Envoyer le lien par WhatsApp"
                className="py-2 px-1 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-emerald-500/10 border border-zinc-200 dark:border-white/[0.08] hover:border-emerald-500/40 transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300">WhatsApp</span>
              </button>

              {/* Plus d'options (Modal) */}
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                title="Toutes les options de partage et légendes prêtes à coller"
                className="py-2 px-1 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-200">Plus</span>
              </button>
            </div>
          </div>

          {/* Action Principale : Menu & Exportation vidéo MP4 */}
          <div className="w-full p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-900 dark:text-white shrink-0">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    Rendu Final MP4
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 font-mono text-[9px] border border-zinc-200 dark:border-white/[0.08] tabular-nums">
                      {user.plan === 'business' && exportQuality === '4k-60' ? '4K 60fps' : '1080p HD'}
                    </span>
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.label}{' '}
                    {exportFormat} · {EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.platforms}
                  </p>
                </div>
              </div>
            </div>

            {/* Sélecteur rapide du format d'exportation (Portrait 9:16 · Carré 1:1 · Paysage 16:9) */}
            <div
              role="group"
              aria-label="Format d'exportation vidéo"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06]"
            >
              {EXPORT_FORMAT_OPTIONS.map((fmt) => {
                const isSelected = exportFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setExportFormat(fmt.id)}
                    aria-pressed={isSelected}
                    className={`px-2 py-2 rounded-lg text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className={`inline-block rounded-[2px] border ${fmt.previewClass} ${
                          isSelected ? 'border-white bg-white/15 dark:border-black dark:bg-black/15' : 'border-zinc-500'
                        }`}
                      />
                      <span>{fmt.label}</span>
                      <span className="font-mono text-[10px] tabular-nums opacity-85">{fmt.ratio}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              data-export-btn="true"
              type="button"
              onClick={handleOpenExportMenu}
              disabled={isExporting}
              className="w-full py-3 px-4 rounded-xl font-heading text-xs sm:text-sm font-extrabold text-white electric-button-gradient hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Exportation MP4 en cours...' : `Exporter en ${exportFormat}`}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono text-white/90">
                .MP4
              </span>
            </button>

            {onOpenStats && (
              <button
                type="button"
                onClick={onOpenStats}
                className="w-full py-2.5 px-3 rounded-xl font-heading text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                title="Consulter les vues estimées, le taux d'engagement et l'analyse selon le style et le sujet"
              >
                <BarChart3 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 group-hover:scale-110 transition-transform" />
                <span>Simuler la performance & stats (Vues, Engagement)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Cleanly Structured 5-Tab Studio Inspector */}
        <div className="lg:col-span-5 space-y-3">
          {/* Editor Tab Navigation */}
          <div
            role="tablist"
            aria-label="Outils d'édition Studio"
            className="grid grid-cols-5 gap-1 p-1 bg-zinc-100 dark:bg-[#111114] rounded-xl border border-zinc-200 dark:border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'scenes'}
              onClick={() => setActiveTab('scenes')}
              className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'scenes'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Scènes</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'photo-edit'}
              onClick={() => setActiveTab('photo-edit')}
              className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'photo-edit'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>Photo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'video-fx'}
              onClick={() => setActiveTab('video-fx')}
              className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'video-fx'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span>Vidéo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audio-style'}
              onClick={() => setActiveTab('audio-style')}
              className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'audio-style'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5 shrink-0" />
              <span>Audio</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'script'}
              onClick={() => setActiveTab('script')}
              className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'script'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Script</span>
            </button>
          </div>

          {/* TAB 1: SCENES LIST & IN-DEPTH EDITOR */}
          {activeTab === 'scenes' && (
            <div className="space-y-3">
              {/* Contextual History Toolbar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-zinc-200">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-950 dark:text-white">Édition des scènes & sous-titres</span>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:block">Cliquez sur une scène pour modifier son texte, son image ou son effet</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAnimateAllScenesToVideo}
                    disabled={isBatchAnimatingAll || animatingSceneIdx !== null}
                    className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold border border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20 text-[#DD2A7B] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                    title="Animer toutes les images de scènes en clips vidéo 2.5D/3D"
                  >
                    {isBatchAnimatingAll ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Orbit className="w-3 h-3" />
                    )}
                    <span>
                      {isBatchAnimatingAll
                        ? `Animation (${(animatingSceneIdx ?? 0) + 1}/${video.scenes.length})...`
                        : 'Tout animer IA'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSceneDetectorOpen((prev) => !prev)}
                    aria-expanded={isSceneDetectorOpen}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                      isSceneDetectorOpen
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-zinc-100 dark:bg-[#09090B] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.08] border-zinc-300 dark:border-white/[0.12]'
                    }`}
                    title="Détection automatique des points de coupe sur le rythme de la voix off"
                  >
                    <Activity className="w-3 h-3 text-[#0095F6]" />
                    <span>Coupes auto</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={pastStates.length === 0}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${
                      pastStates.length > 0
                        ? 'bg-zinc-100 dark:bg-[#09090B] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.08] border border-zinc-300 dark:border-white/[0.12] cursor-pointer'
                        : 'bg-zinc-50 dark:bg-[#09090B] text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-white/[0.05] cursor-not-allowed opacity-40'
                    }`}
                    title="Annuler la modification (Ctrl+Z)"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Annuler</span>
                    {pastStates.length > 0 && (
                      <span className="text-[9px] px-1 rounded bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 font-mono">
                        {pastStates.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={futureStates.length === 0}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${
                      futureStates.length > 0
                        ? 'bg-zinc-100 dark:bg-[#09090B] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.08] border border-zinc-300 dark:border-white/[0.12] cursor-pointer'
                        : 'bg-zinc-50 dark:bg-[#09090B] text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-white/[0.05] cursor-not-allowed opacity-40'
                    }`}
                    title="Rétablir la modification (Ctrl+Y)"
                  >
                    <Redo2 className="w-3 h-3" />
                    <span>Rétablir</span>
                    {futureStates.length > 0 && (
                      <span className="text-[9px] px-1 rounded bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 font-mono">
                        {futureStates.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Automatic Voiceover Scene Cut Detector */}
              {isSceneDetectorOpen && (
                <VoiceoverSceneDetector
                  scenes={video.scenes}
                  currentSceneIdx={currentSceneIdx}
                  vocalSpeed={vocalSpeed}
                  voiceId={video.voiceId}
                  onSelectScene={handleSelectScene}
                  onApplyCuts={handleApplyDetectedCuts}
                  onSyncDurationsToVoice={handleSyncDurationsToVoice}
                  onClose={() => setIsSceneDetectorOpen(false)}
                />
              )}

              {/* Granular Transitions Map (Per Scene-to-Scene Boundary) */}
              {video.scenes.length > 1 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      Transitions entre les scènes (par enchaînement) :
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {video.scenes.length - 1} jonction{video.scenes.length - 1 > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Global transition speed quick bar */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] flex-wrap">
                    <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Gauge className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                      <span>Vitesse globale :</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {TRANSITION_INTENSITIES.map((opt) => {
                        const isGlobalActive = (video.transitionIntensity || 'normal') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={isGlobalActive}
                            onClick={() => handleChangeTransitionIntensity(opt.id, 'all')}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                              isGlobalActive
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
                            }`}
                            title={`${opt.label} (${opt.shortLabel}) — ${opt.desc}`}
                          >
                            {opt.label} · {opt.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {video.scenes.slice(1).map((targetScene, offset) => {
                      const boundaryIdx = offset + 1;
                      const activeBoundary = boundaryIdx === activeTransitionSceneIdx;
                      const currentTrans = targetScene.transition || video.defaultTransition || 'fade';
                      const boundaryIntensityCfg = getTransitionIntensityConfig(
                        targetScene.transitionIntensity || video.transitionIntensity || 'normal'
                      );

                      return (
                        <div
                          key={boundaryIdx}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            activeBoundary
                              ? 'bg-zinc-100 dark:bg-white/[0.08] border-zinc-400 dark:border-white/40'
                              : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handlePreviewTransition(boundaryIdx)}
                            className="text-left min-w-0 cursor-pointer group"
                            title="Aperçu dans le lecteur"
                          >
                            <p className="text-[11px] font-bold text-zinc-950 dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors tabular-nums">
                              Scène {boundaryIdx} → Scène {boundaryIdx + 1}
                            </p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
                              {currentTrans === 'cut'
                                ? 'Cut instantané (0s)'
                                : `${boundaryIntensityCfg.label} · ${boundaryIntensityCfg.shortLabel}`}
                            </p>
                          </button>

                          <select
                            value={currentTrans}
                            onChange={(e) =>
                              handleChangeTransition(boundaryIdx, e.target.value as SceneTransition, true)
                            }
                            className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-white/[0.12] rounded-lg px-2 py-1 text-zinc-950 dark:text-white text-[11px] font-semibold focus:outline-none cursor-pointer"
                          >
                            <option value="fade">Fondu</option>
                            <option value="slide">Glissement</option>
                            <option value="cut">Cut</option>
                            <option value="zoom">Zoom</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scenes Scrollable List */}
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {video.scenes.map((scene, idx) => {
                  const isCurrent = idx === currentSceneIdx;
                  const isEditing = editingSceneIdx === idx;
                  const isDraggedCard = draggedSceneIdx === idx;
                  const isCardDropTarget =
                    dropTarget !== null && dropTarget.index === idx && draggedSceneIdx !== null && draggedSceneIdx !== idx;

                  return (
                    <div
                      key={`${scene.sceneNumber}-${idx}`}
                      draggable={video.scenes.length > 1 && !isEditing}
                      onDragStart={(e) => {
                        if (video.scenes.length <= 1 || isEditing) return;
                        setDraggedSceneIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                      }}
                      onDragOver={(e) => {
                        if (draggedSceneIdx === null || draggedSceneIdx === idx) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pos: 'before' | 'after' =
                          e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        if (!dropTarget || dropTarget.index !== idx || dropTarget.position !== pos) {
                          setDropTarget({ index: idx, position: pos });
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rawFrom = e.dataTransfer.getData('text/plain');
                        const fromIdx =
                          draggedSceneIdx !== null
                            ? draggedSceneIdx
                            : rawFrom !== '' && !Number.isNaN(Number(rawFrom))
                            ? Number(rawFrom)
                            : null;
                        if (fromIdx === null) {
                          clearDragState();
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pos: 'before' | 'after' =
                          e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        const toIdx = computeAdjustedDropIndex(fromIdx, idx, pos);
                        clearDragState();
                        handleReorderScenes(fromIdx, toIdx);
                      }}
                      onDragEnd={clearDragState}
                      onClick={() => handleSelectScene(idx)}
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isDraggedCard
                          ? 'opacity-45 scale-[0.99] border-[#0095F6]'
                          : isCardDropTarget
                          ? 'border-[#0095F6] ring-1 ring-[#0095F6]/50 bg-zinc-50 dark:bg-[#141418]'
                          : isCurrent
                          ? 'bg-zinc-100/90 dark:bg-[#18181B] border-zinc-900 dark:border-white/50 shadow-xs dark:shadow-none'
                          : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Scene Thumbnail */}
                        <div className="w-16 h-20 rounded-xl overflow-hidden relative flex-shrink-0 border border-zinc-200 dark:border-white/[0.1] bg-black">
                          <img
                            src={scene.imageUrl}
                            alt={scene.visualDescription}
                            draggable={false}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono tabular-nums text-white">
                            {formatDurationShort(scene.durationSeconds)}
                          </span>
                        </div>

                        {/* Scene Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {video.scenes.length > 1 && !isEditing && (
                                <span
                                  title="Glisser-déposer pour réorganiser"
                                  className="text-zinc-400 dark:text-zinc-500 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="text-xs font-bold text-zinc-950 dark:text-white">Scène {scene.sceneNumber}</span>
                              {idx === 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                                  Hook Viral 🔥
                                </span>
                              )}
                              {scene.mediaType === 'video' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                                  <Film className="w-2.5 h-2.5" />
                                  <span>{scene.aiAnimated ? 'Vidéo IA' : 'Vidéo'}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSceneVoice(idx);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  scene.voiceEnabled === false
                                    ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-400'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                                }`}
                                title={
                                  scene.voiceEnabled === false
                                    ? 'Réactiver la voix off sur cette scène (musique avec ducking)'
                                    : 'Couper la voix off sur cette scène (musique à 100%)'
                                }
                              >
                                {scene.voiceEnabled === false ? (
                                  <>
                                    <MicOff className="w-3 h-3" />
                                    <span>Sans voix</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic className="w-3 h-3" />
                                    <span>Voix</span>
                                  </>
                                )}
                              </button>

                              {onSaveToLibrary && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveSceneImageToLibrary(scene, idx);
                                  }}
                                  className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                                  title="Sauver l'image dans Ma Bibliothèque"
                                >
                                  {savedSceneLibraryMap[idx] ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <BookmarkPlus className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  audioEngine.speakText(scene.voiceoverText, video.voiceId);
                                }}
                                className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors"
                                title="Écouter la voix de cette scène"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isEditing) {
                                    handleSaveSceneText(idx);
                                  } else {
                                    setEditingSceneIdx(idx);
                                    setEditedText(scene.voiceoverText);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors"
                                title={isEditing ? 'Valider' : 'Modifier le texte'}
                              >
                                {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectScene(idx);
                                  setActiveTab('photo-edit');
                                }}
                                className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-[#0095F6] hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                                title="Retoucher la photo de cette scène"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>

                              {video.scenes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteScene(idx);
                                  }}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Supprimer cette scène"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Editable Voiceover Text */}
                          {isEditing ? (
                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                rows={2}
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="w-full text-xs bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-white/25 rounded-xl p-2.5 text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingSceneIdx(null)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                                >
                                  Annuler
                                </button>
                                <button
                                  onClick={() => handleSaveSceneText(idx)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] bg-zinc-900 text-white dark:bg-white dark:text-black font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200"
                                >
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                              {scene.voiceoverText}
                            </p>
                          )}

                          {/* Scene Camera, Transition & Image controls */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span>Caméra:</span>
                                <select
                                  value={scene.kenBurnsEffect}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleChangeEffect(idx, e.target.value as CameraEffect)}
                                  className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] rounded-md px-1.5 py-0.5 text-zinc-800 dark:text-zinc-200 text-[10px] focus:outline-none"
                                >
                                  <option value="zoom-in">Zoom In</option>
                                  <option value="zoom-out">Zoom Out</option>
                                  <option value="pan-left">Pan Gauche</option>
                                  <option value="pan-right">Pan Droite</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span>Mouvement IA:</span>
                                <select
                                  value={scene.motionPreset || 'orbit-3d'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const preset = e.target.value as ImageMotionPreset;
                                    handleAnimateSceneToVideo(idx, preset);
                                  }}
                                  disabled={animatingSceneIdx === idx}
                                  className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] rounded-md px-1.5 py-0.5 text-zinc-800 dark:text-zinc-200 text-[10px] focus:outline-none"
                                >
                                  {IMAGE_MOTION_PRESETS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {idx > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span>Entrée Sc.{idx}→{idx + 1}:</span>
                                  <select
                                    value={scene.transition || video.defaultTransition || 'fade'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      handleChangeTransition(idx, e.target.value as SceneTransition, true)
                                    }
                                    className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] rounded-md px-1.5 py-0.5 text-zinc-950 dark:text-white text-[10px] font-semibold focus:outline-none"
                                  >
                                    <option value="fade">Fondu</option>
                                    <option value="slide">Glissement</option>
                                    <option value="cut">Cut</option>
                                    <option value="zoom">Zoom</option>
                                  </select>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-500">Ouverture directe</span>
                              )}

                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>Durée:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={720}
                                  aria-label={`Minutes scène ${scene.sceneNumber}`}
                                  value={Math.floor((scene.durationSeconds || 5) / 60)}
                                  onChange={(e) => {
                                    const mins = Math.max(0, Math.min(720, Math.floor(Number(e.target.value) || 0)));
                                    const secs = (scene.durationSeconds || 5) % 60;
                                    handleChangeSceneDuration(idx, Math.max(2, mins * 60 + secs));
                                  }}
                                  className="w-10 bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] rounded-md px-1 py-0.5 text-center font-mono tabular-nums text-zinc-950 dark:text-white text-[10px] focus:outline-none"
                                />
                                <span>m</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={59}
                                  aria-label={`Secondes scène ${scene.sceneNumber}`}
                                  value={(scene.durationSeconds || 5) % 60}
                                  onChange={(e) => {
                                    const mins = Math.floor((scene.durationSeconds || 5) / 60);
                                    const secs = Math.max(0, Math.min(59, Math.floor(Number(e.target.value) || 0)));
                                    handleChangeSceneDuration(idx, Math.max(2, mins * 60 + secs));
                                  }}
                                  className="w-10 bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] rounded-md px-1 py-0.5 text-center font-mono tabular-nums text-zinc-950 dark:text-white text-[10px] focus:outline-none"
                                />
                                <span>s</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap">
                              <button
                                type="button"
                                disabled={animatingSceneIdx !== null}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAnimateSceneToVideo(idx);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/10 hover:bg-pink-500/20 text-[10px] text-[#DD2A7B] font-bold border border-pink-500/25 cursor-pointer disabled:opacity-50"
                                title="Transformer cette image fixe en clip vidéo animé par IA"
                              >
                                {animatingSceneIdx === idx ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Orbit className="w-3 h-3" />
                                )}
                                <span>
                                  {animatingSceneIdx === idx
                                    ? 'Animation...'
                                    : scene.mediaType === 'video'
                                    ? 'Ré-animer IA'
                                    : 'Animer en Vidéo IA'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplaceTargetSceneIdx(idx);
                                  replaceSceneInputRef.current?.click();
                                }}
                                className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Importer photo/vidéo</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRegenerateImage(idx);
                                }}
                                className="flex items-center gap-1 text-[10px] text-[#0095F6] hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer font-semibold"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>Changer l'image</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inputs cachés pour import & remplacement */}
              <input
                ref={addMediaInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddUploadedMediaScenes(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={replaceSceneInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  handleReplaceSceneMedia(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* GRAND BOUTON + POUR AJOUTER PHOTOS / VIDÉOS AU MONTAGE */}
              <button
                type="button"
                onClick={() => addMediaInputRef.current?.click()}
                className="w-full py-5 px-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-white/[0.15] hover:border-zinc-500 dark:hover:border-white/35 bg-white dark:bg-[#121214] hover:bg-zinc-50 dark:hover:bg-[#18181B] transition-all flex items-center justify-center gap-4 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl electric-button-gradient flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-extrabold text-zinc-950 dark:text-white">
                    Ajouter une photo ou vidéo à modifier
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Importez depuis votre appareil (JPG, PNG, MP4, MOV) pour l'ajouter en nouvelle scène
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* TAB 2: STUDIO PHOTO & RETOUCHE */}
          {activeTab === 'photo-edit' && currentScene && (
            <PhotoEditorPanel
              video={video}
              currentSceneIdx={currentSceneIdx}
              currentScene={currentScene}
              onLiveUpdate={onUpdateVideo}
              onCommitUpdate={updateVideoWithHistory}
              onReplaceSceneMedia={() => {
                setReplaceTargetSceneIdx(currentSceneIdx);
                replaceSceneInputRef.current?.click();
              }}
              onRegenerateImage={() => handleRegenerateImage(currentSceneIdx)}
              onAnimateToVideo={(preset) => handleAnimateSceneToVideo(currentSceneIdx, preset)}
              isAnimatingScene={animatingSceneIdx === currentSceneIdx}
              onSaveSceneImageToLibrary={
                onSaveToLibrary
                  ? () => handleSaveSceneImageToLibrary(currentScene, currentSceneIdx)
                  : undefined
              }
              isSceneSavedToLibrary={Boolean(savedSceneLibraryMap[currentSceneIdx])}
            />
          )}

          {/* TAB 3: MONTAGE VIDÉO & EFFETS */}
          {activeTab === 'video-fx' && currentScene && (
            <VideoEffectsPanel
              video={video}
              currentSceneIdx={currentSceneIdx}
              currentScene={currentScene}
              onLiveUpdate={onUpdateVideo}
              onCommitUpdate={updateVideoWithHistory}
              effectApplyScope={effectApplyScope}
              onChangeEffectScope={setEffectApplyScope}
              activeTrendingEffect={activeTrendingEffect}
              onApplyTrendingEffect={handleApplyTrendingEffect}
              onToggleBeatPulse={handleToggleBeatPulse}
              onApplyColorGrade={handleApplyColorGrade}
              colorGradeOptions={COLOR_GRADE_OPTIONS}
              onSplitScene={handleSplitCurrentScene}
              onDuplicateScene={handleDuplicateCurrentScene}
              onDeleteScene={() => handleDeleteScene(currentSceneIdx)}
              onDynamicPacing={handleApplyDynamicPacingEdit}
              onAlternateCameras={handleAlternateCamerasEdit}
              onChangeCameraEffect={(effect) => handleChangeEffect(currentSceneIdx, effect)}
              onAnimateToVideo={(preset) => handleAnimateSceneToVideo(currentSceneIdx, preset)}
              isAnimatingScene={animatingSceneIdx === currentSceneIdx}
            />
          )}

          {/* TAB 2: AUDIO, STYLE & SUBTITLES */}
          {activeTab === 'audio-style' && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-5">
              {/* Voice selector */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-950 dark:text-white flex items-center justify-between gap-2">
                  <span>Changer la Voix Off IA :</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600 dark:text-zinc-300 text-xs">
                      {VOICES.find((v) => v.id === video.voiceId)?.name ||
                        customVoices.find((cv) => cv.id === video.voiceId)?.title ||
                        video.voiceId}
                    </span>
                    {onSaveToLibrary && (
                      <button
                        type="button"
                        onClick={handleSaveCurrentVoiceToLibrary}
                        className="text-[11px] font-semibold text-[#0095F6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {savedLibraryVoice ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Sauvegardée</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3 h-3" />
                            <span>Sauver voix</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => updateVideoWithHistory({ ...video, voiceId: v.id }, `Voix off changée : ${v.name}`)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        video.voiceId === v.id
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white hover:border-zinc-400 dark:hover:border-white/25'
                      }`}
                    >
                      <p className={`text-xs font-bold ${video.voiceId === v.id ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{v.name}</p>
                      <p className={`text-[10px] truncate ${video.voiceId === v.id ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{v.tone}</p>
                    </button>
                  ))}
                </div>

                {customVoices.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Voix personnalisées (Ma Bibliothèque) :
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {customVoices.map((cv) => (
                        <button
                          key={cv.id}
                          type="button"
                          onClick={() => {
                            if (cv.voiceData?.rate) setVocalSpeed(cv.voiceData.rate);
                            updateVideoWithHistory({ ...video, voiceId: cv.id }, `Voix perso activée : ${cv.title}`);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            video.voiceId === cv.id
                              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                              : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white hover:border-zinc-400 dark:hover:border-white/25'
                          }`}
                        >
                          <p className={`text-xs font-bold truncate ${video.voiceId === cv.id ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>
                            {cv.title}
                          </p>
                          <p className={`text-[10px] font-mono tabular-nums truncate ${video.voiceId === cv.id ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {cv.voiceData?.pitch.toFixed(2)}x · {cv.voiceData?.rate.toFixed(2)}x
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Music Mood Selector (Sons & Beats Tendance Shorts / Reels) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-950 dark:text-white flex items-center justify-between">
                  <span>Sons Tendance & Ambiance :</span>
                  <span className="text-zinc-600 dark:text-zinc-300 text-xs">
                    {MUSIC_MOODS.find((m) => m.id === video.musicMood)?.name}
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                  {MUSIC_MOODS.map((m) => {
                    const isSelected = video.musicMood === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          updateVideoWithHistory({ ...video, musicMood: m.id }, `Son tendance activé : ${m.name}`);
                          audioEngine.playBackgroundMusic(m.id, musicVolume);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{m.name}</p>
                            {m.badge && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[8px] font-bold border shrink-0 ${
                                  isSelected
                                    ? 'bg-white/15 text-white border-white/25 dark:bg-black/10 dark:text-black dark:border-black/20'
                                    : 'bg-[#0095F6]/15 text-[#0095F6] border-[#0095F6]/30'
                                }`}
                              >
                                {m.badge}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] truncate ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {m.bpm} · {m.desc}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            audioEngine.previewMusicMood(m.id, Math.max(0.28, musicVolume));
                          }}
                          title="Pré-écouter (3.5s)"
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white/20 text-white dark:bg-black/15 dark:text-black hover:scale-105'
                              : 'bg-zinc-200/80 dark:bg-white/[0.08] text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black'
                          }`}
                        >
                          <Play className="w-3 h-3 ml-0.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Granular Scene Transition Selector in Style tab */}
              {video.scenes.length > 1 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-zinc-950 dark:text-white">
                      Transition Sc.{activeTransitionSceneIdx} → Sc.{activeTransitionSceneIdx + 1} :
                    </label>
                    <span className="text-zinc-600 dark:text-zinc-300 text-xs font-semibold">
                      {
                        SCENE_TRANSITIONS.find(
                          (t) =>
                            t.id ===
                            (video.scenes[activeTransitionSceneIdx]?.transition ||
                              video.defaultTransition ||
                              'fade')
                        )?.name
                      }
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {video.scenes.slice(1).map((targetScene, offset) => {
                      const boundaryIdx = offset + 1;
                      const isActive = boundaryIdx === activeTransitionSceneIdx;
                      return (
                        <button
                          key={boundaryIdx}
                          type="button"
                          onClick={() => handlePreviewTransition(boundaryIdx)}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap tabular-nums cursor-pointer shrink-0 ${
                            isActive
                              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                              : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                          }`}
                        >
                          Sc.{boundaryIdx} → Sc.{boundaryIdx + 1} ({getTransitionShortLabel(targetScene.transition)})
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {SCENE_TRANSITIONS.map((t) => {
                      const currentBoundaryTrans =
                        video.scenes[activeTransitionSceneIdx]?.transition ||
                        video.defaultTransition ||
                        'fade';
                      const isSelected = currentBoundaryTrans === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleChangeTransition(activeTransitionSceneIdx, t.id, true)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                              : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                          }`}
                        >
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{t.name}</p>
                          <p className={`text-[10px] truncate ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{t.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Synchronized Intensity Selector in Style Tab */}
                  {(() => {
                    const activeIntensity =
                      transitionIntensityScope === 'scene'
                        ? video.scenes[activeTransitionSceneIdx]?.transitionIntensity ||
                          video.transitionIntensity ||
                          'normal'
                        : video.transitionIntensity || 'normal';
                    const activeIntensityCfg = getTransitionIntensityConfig(activeIntensity);
                    return (
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            <span>Intensité & vitesse des transitions</span>
                            <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                              · {activeIntensityCfg.shortLabel}
                            </span>
                          </span>
                          <div className="flex items-center p-0.5 rounded-lg bg-zinc-200/70 dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08]">
                            <button
                              type="button"
                              onClick={() => setTransitionIntensityScope('all')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                transitionIntensityScope === 'all'
                                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                              }`}
                            >
                              Toutes
                            </button>
                            <button
                              type="button"
                              onClick={() => setTransitionIntensityScope('scene')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer tabular-nums ${
                                transitionIntensityScope === 'scene'
                                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                              }`}
                            >
                              Sc.{activeTransitionSceneIdx}→{activeTransitionSceneIdx + 1}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {TRANSITION_INTENSITIES.map((opt) => {
                            const isSelected = activeIntensity === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => handleChangeTransitionIntensity(opt.id)}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                                    : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[11px] font-bold ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>
                                    {opt.label}
                                  </span>
                                  <span className={`text-[9px] font-mono tabular-nums ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                    {opt.shortLabel}
                                  </span>
                                </div>
                                <p className={`text-[9px] truncate mt-0.5 ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                  {opt.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Caption Style Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-950 dark:text-white">Style de Sous-titres :</label>
                <div className="grid grid-cols-2 gap-2">
                  {CAPTION_STYLES.map((c) => {
                    const isSelected = video.captionStyle === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => updateVideoWithHistory({ ...video, captionStyle: c.id }, `Style de sous-titres : ${c.name}`)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{c.name}</p>
                        <p className={`text-[10px] truncate ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{c.sample}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Karaoke Highlight Color Customizer */}
                {video.captionStyle === 'karaoke' && (() => {
                  const activeKaraokeColor = video.karaokeHighlightColor || DEFAULT_KARAOKE_HIGHLIGHT_COLOR;
                  const updateKaraokeColor = (hex: string, label?: string) => {
                    updateVideoWithHistory(
                      { ...video, karaokeHighlightColor: hex },
                      label ? `Surbrillance Karaoké : ${label}` : `Surbrillance Karaoké : ${hex.toUpperCase()}`
                    );
                  };

                  return (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-zinc-900 dark:text-white">
                          Couleur de surbrillance Karaoké
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 uppercase">
                          {activeKaraokeColor}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-2">
                        {KARAOKE_HIGHLIGHT_COLORS.map((preset) => {
                          const isColorActive = activeKaraokeColor.toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => updateKaraokeColor(preset.hex, preset.name)}
                              title={preset.name}
                              aria-label={`Couleur ${preset.name}`}
                              aria-pressed={isColorActive}
                              className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer flex items-center justify-center ${
                                isColorActive
                                  ? 'scale-110 ring-2 ring-zinc-900 dark:ring-white border-white dark:border-black'
                                  : 'border-black/15 dark:border-white/15 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                            >
                              {isColorActive && <Check className="w-3.5 h-3.5 text-black drop-shadow-xs" />}
                            </button>
                          );
                        })}

                        <label
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#121214] text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 cursor-pointer"
                          title="Choisir une couleur personnalisée"
                        >
                          <input
                            type="color"
                            value={activeKaraokeColor}
                            onChange={(e) => updateKaraokeColor(e.target.value)}
                            aria-label="Couleur de surbrillance personnalisée"
                            className="w-4 h-4 rounded border-0 bg-transparent p-0 cursor-pointer"
                          />
                          <span>Libre</span>
                        </label>
                      </div>

                      <div className="px-3 py-2 rounded-lg bg-black text-center font-heading text-xs font-bold tracking-tight">
                        <span style={{ color: activeKaraokeColor }}>Chaque</span>{' '}
                        <span style={{ color: activeKaraokeColor, textShadow: `0 0 10px ${activeKaraokeColor}` }}>
                          mot
                        </span>{' '}
                        <span className="text-white/50">s’illumine au rythme</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sound Mixer Sliders */}
              <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Mixeur Audio FOFO :</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>Volume Voix Off</span>
                    <span className="tabular-nums font-mono">{Math.round(voiceVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={voiceVolume}
                    onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                    className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>Volume Musique de fond</span>
                    <span className="tabular-nums font-mono">{Math.round(musicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={musicVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setMusicVolume(v);
                      audioEngine.setMusicVolume(v);
                    }}
                    className="w-full accent-[#0095F6] cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                        Ducking automatique de la musique
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Baisse automatiquement la musique dès que la voix off parle sur une scène
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoDucking}
                      onClick={handleToggleAutoDucking}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors shrink-0 cursor-pointer ${
                        autoDucking
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white dark:bg-[#141418] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.1]'
                      }`}
                    >
                      {autoDucking ? 'Activé' : 'Désactivé'}
                    </button>
                  </div>

                  {autoDucking && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>Réduction appliquée</span>
                        <span className="tabular-nums font-mono text-zinc-900 dark:text-white">
                          -{Math.round(duckingIntensity * 100)}% (musique à {effectiveDuckedMusicPercent}%)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={85}
                        step={5}
                        value={Math.round(duckingIntensity * 100)}
                        onChange={(e) => handleChangeDuckingIntensity(Number(e.target.value) / 100)}
                        className="w-full accent-[#0095F6] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Vocal Pacing Controls */}
              <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                    Rythme & Pacing Vocal :
                  </label>
                  <span className="text-xs font-mono tabular-nums text-zinc-950 dark:text-white font-bold">
                    {vocalSpeed.toFixed(2)}x
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { speed: 0.9, label: '0.90x Posé', desc: 'Documentaire' },
                    { speed: 1.0, label: '1.00x Normal', desc: 'Standard' },
                    { speed: 1.15, label: '1.15x Rythmé', desc: 'TikTok Viral' },
                    { speed: 1.25, label: '1.25x Rapide', desc: 'Speedrun' },
                  ].map((s) => {
                    const isSelected = Math.abs(vocalSpeed - s.speed) < 0.02;
                    return (
                      <button
                        key={s.speed}
                        type="button"
                        onClick={() => {
                          setVocalSpeed(s.speed);
                          showShareToast(`Vitesse vocale réglée à ${s.speed}x`);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <p className={`text-xs font-bold tabular-nums ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{s.label}</p>
                        <p className={`text-[10px] ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{s.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    audioEngine.speakText(video.scenes[0].voiceoverText, video.voiceId, {
                      volume: voiceVolume,
                      rate: vocalSpeed,
                    });
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume1 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                  <span>Tester l'élocution avec la Scène 1 ({vocalSpeed}x)</span>
                </button>
              </div>

              {/* Trending SFX & Hook Intro Box */}
              <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                    Bruitages & Hook Intro SFX :
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleHookSfx('none')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors ${
                      !video.hookSfx || video.hookSfx === 'none'
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-zinc-100 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {!video.hookSfx || video.hookSfx === 'none' ? 'Hook Intro : Aucun' : 'Désactiver Hook Intro'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TRENDING_SFX_LIST.map((sfx) => {
                    const isPlayingNow = activeSfx === sfx.id;
                    const isHookSelected = video.hookSfx === sfx.id;
                    return (
                      <div
                        key={sfx.id}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                          isHookSelected || isPlayingNow
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handlePlaySfx(sfx.id)}
                          className="text-left cursor-pointer w-full"
                          title="Écouter ce son viral"
                        >
                          <p className={`text-xs font-bold truncate ${isHookSelected || isPlayingNow ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{sfx.name}</p>
                          <p className={`text-[10px] mt-0.5 truncate ${isHookSelected || isPlayingNow ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{sfx.desc}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleHookSfx(isHookSelected ? 'none' : sfx.id)}
                          className={`w-full py-1 px-2 rounded-lg text-[9px] font-bold transition-colors cursor-pointer ${
                            isHookSelected
                              ? 'bg-[#0095F6] text-white'
                              : 'bg-zinc-200/75 dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-white/[0.15]'
                          }`}
                        >
                          {isHookSelected ? '✓ Hook Scène 1' : '+ Hook Intro'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SCRIPT, HOOKS, TRANSLATION & GROWTH */}
          {activeTab === 'script' && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-5">
              {/* Hook */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                  Hook d'Accroche Viral
                </p>
                <p className="text-xs font-bold text-zinc-950 dark:text-white leading-relaxed">{video.hook}</p>
              </div>

              {/* Viral Hook Templates Generator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Variantes de Hooks Viraux :
                  </label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">1 clic sur Scène 1</span>
                </div>

                <div className="space-y-2">
                  {VIRAL_HOOK_TEMPLATES.map((hk, hIdx) => (
                    <div
                      key={hIdx}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                          {hk.type}
                        </span>
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-300 font-bold">
                          {hk.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-950 dark:text-white leading-relaxed font-medium">
                        « {hk.text} »
                      </p>
                      <button
                        type="button"
                        onClick={() => handleApplyHook(hk.text)}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 fill-black" />
                        <span>Appliquer ce Hook à la Scène 1</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
                <p className="text-xs font-bold text-zinc-950 dark:text-white">Description TikTok / YouTube / Reels :</p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] leading-relaxed">
                  {video.description}
                </p>
              </div>

              {/* Hashtags */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-950 dark:text-white">Hashtags optimisés :</p>
                  <button
                    onClick={handleCopyTags}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#0095F6] hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                  >
                    {copiedTags ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTags ? 'Copié !' : 'Copier les tags'}</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {video.hashtags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA Optimizer */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
                <label className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                  Call-To-Action (Engagement) :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'comments' as const, label: 'Commentaires', desc: '+400% Débat' },
                    { id: 'followers' as const, label: 'Abonnements', desc: '+250% Abonnés' },
                    { id: 'shares' as const, label: 'Partages', desc: '+180% Portée' },
                  ].map((cta) => {
                    const isSelected = ctaObjective === cta.id;
                    return (
                      <button
                        key={cta.id}
                        type="button"
                        onClick={() => setCtaObjective(cta.id)}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        <p className={`text-xs font-bold ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>{cta.label}</p>
                        <p className={`text-[10px] ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{cta.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleCopyOptimizedCta}
                  className="w-full py-2.5 px-4 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedCta ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCta ? 'Description copiée !' : 'Copier la description avec Call-To-Action'}</span>
                </button>
              </div>

              {/* Multilingual Translator */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                    Traducteur de Script Express :
                  </label>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Ctrl+Z</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTranslateScript('en')}
                    className="p-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-all cursor-pointer"
                  >
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">Anglais</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">YouTube US</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTranslateScript('es')}
                    className="p-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-all cursor-pointer"
                  >
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">Espagnol</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">TikTok LATAM</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTranslateScript('fr')}
                    className="p-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-all cursor-pointer"
                  >
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">Français</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Original</p>
                  </button>
                </div>
              </div>

              {/* Full Script */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-zinc-950 dark:text-white">Script complet prêt pour prompteur :</p>
                  <div className="flex items-center gap-3">
                    {onSaveToLibrary && (
                      <button
                        type="button"
                        onClick={handleSaveProjectScriptToLibrary}
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#0095F6] hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                      >
                        {savedLibraryScript ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Sauvé en bibliothèque !</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            <span>Sauver dans Ma Bibliothèque</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleCopyScript}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#0095F6] hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'Copié !' : 'Copier tout le script'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] max-h-48 overflow-y-auto space-y-2 text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                  {video.scenes.map((s, idx) => (
                    <p key={idx}>
                      <span className="text-zinc-950 dark:text-white font-bold">[Scène {idx + 1}]</span>{' '}
                      {s.voiceoverText}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu d'exportation & Progression MP4 */}
      {isExportMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] p-6 text-center space-y-4 shadow-2xl relative">
            {/* Bouton de fermeture en haut à droite */}
            <button
              type="button"
              onClick={() => {
                setIsExportMenuOpen(false);
                setIsExporting(false);
                setExportProgress(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>

            {!isExporting || !exportProgress ? (
              /* ÉTAPE 1 : MENU DE CONFIGURATION DU FORMAT D'EXPORTATION */
              <>
                <div className="w-12 h-12 rounded-2xl mx-auto bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-900 dark:text-white">
                  <Film className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-extrabold font-heading text-zinc-950 dark:text-white">
                    Menu d'exportation MP4
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Choisissez le format de sortie adapté à votre plateforme de publication.
                  </p>
                </div>

                {/* Choix des 3 formats : Portrait 9:16, Carré 1:1, Paysage 16:9 */}
                <div className="grid grid-cols-3 gap-2 text-left">
                  {EXPORT_FORMAT_OPTIONS.map((fmt) => {
                    const isSelected = exportFormat === fmt.id;
                    const is4kActive = user.plan === 'business' && exportQuality === '4k-60';
                    const resText = is4kActive ? fmt.uhdResolution : fmt.hdResolution;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setExportFormat(fmt.id)}
                        aria-pressed={isSelected}
                        className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-md'
                            : 'bg-zinc-50 dark:bg-[#09090B] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <div className="h-7 flex items-center justify-center">
                          <span
                            aria-hidden="true"
                            className={`inline-block rounded-[3px] border-2 ${fmt.previewClass} ${
                              isSelected
                                ? 'border-white bg-white/20 dark:border-black dark:bg-black/15'
                                : 'border-zinc-400 dark:border-zinc-500'
                            }`}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-extrabold whitespace-nowrap">
                            {fmt.label} {fmt.ratio}
                          </div>
                          <div
                            className={`text-[10px] font-mono tabular-nums ${
                              isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {resText}
                          </div>
                        </div>
                        <div
                          className={`text-[9px] leading-tight ${
                            isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {fmt.platforms}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Récapitulatif technique avant rendu */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-left space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Format sélectionné :</span>
                    <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.label} ({exportFormat})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Résolution :</span>
                    <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {user.plan === 'business' && exportQuality === '4k-60'
                        ? `${EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.uhdResolution} · 4K 60 FPS`
                        : `${EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.hdResolution} · Full HD`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Conteneur & Audio :</span>
                    <span className="font-semibold text-zinc-950 dark:text-white">MP4 (H.264 / AAC)</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportVideo(exportFormat)}
                    className="w-full py-3 px-4 rounded-xl font-heading text-xs sm:text-sm font-extrabold text-white electric-button-gradient hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      Lancer l'exportation ({EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.label} {exportFormat})
                    </span>
                  </button>
                </div>
              </>
            ) : (
              /* ÉTAPE 2 : PROGRESSION & FICHE TECHNIQUE APRÈS EXPORTATION */
              <>
                <div
                  className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                    exportProgress.isCompleted
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : 'ig-story-ring p-[2px]'
                  }`}
                >
                  {exportProgress.isCompleted ? (
                    <Check className="w-7 h-7" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-white dark:bg-[#121214] flex items-center justify-center text-zinc-900 dark:text-white">
                      <Download className="w-6 h-6 animate-bounce" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-extrabold font-heading text-zinc-950 dark:text-white">
                    {exportProgress.isCompleted ? 'Vidéo MP4 prête !' : 'Exportation en cours...'}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{exportProgress.status}</p>
                </div>

                {/* Barre de progression pendant l'export */}
                {!exportProgress.isCompleted && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                      <span>Rendu Canvas ({activeExportFormat}) + Audio HD</span>
                      <span>{exportProgress.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 dark:bg-[#09090B] rounded-full overflow-hidden border border-zinc-200 dark:border-white/[0.08]">
                      <div
                        className="h-full ig-story-ring transition-all duration-200"
                        style={{ width: `${exportProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Fiche technique du fichier MP4 exporté */}
                {exportProgress.isCompleted && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 pb-1.5 border-b border-zinc-200 dark:border-white/[0.06]">
                      <span className="text-zinc-500 dark:text-zinc-400">Fichier :</span>
                      <span className="font-mono text-zinc-950 dark:text-white truncate max-w-[220px]" title={exportedFilename || ''}>
                        {exportedFilename || 'FOFO_AI_1080p.mp4'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                      <span className="text-zinc-500 dark:text-zinc-400">Format :</span>
                      <span className="font-semibold text-zinc-950 dark:text-white">MP4 (H.264 / AAC)</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                      <span className="text-zinc-500 dark:text-zinc-400">Résolution :</span>
                      <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                        {activeExportFormat === '9:16'
                          ? '1080×1920 (Portrait 9:16)'
                          : activeExportFormat === '4:5'
                          ? '1080×1350 (Portrait 4:5)'
                          : activeExportFormat === '16:9'
                          ? '1920×1080 (Paysage 16:9)'
                          : '1080×1080 (Carré 1:1)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                      <span className="text-zinc-500 dark:text-zinc-400">Transition active :</span>
                      <span className="font-semibold text-zinc-950 dark:text-white capitalize">
                        {video.defaultTransition || 'Fondu (Fade)'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions quand l'export est terminé */}
                {exportProgress.isCompleted ? (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRedownload}
                      className="w-full py-2.5 px-4 rounded-xl font-heading text-xs font-extrabold text-white electric-button-gradient hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger à nouveau (MP4)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          setIsExporting(false);
                          setExportProgress(null);
                          setIsShareModalOpen(true);
                        }}
                        className="py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Partager</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          setIsExporting(false);
                          setExportProgress(null);
                        }}
                        className="py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-600" />
                        <span>Terminé</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExporting(false);
                        setExportProgress(null);
                      }}
                      className="w-full py-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Exporter dans un autre format
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Format MP4 optimisé haute qualité pour TikTok, YouTube Shorts, Reels et Instagram.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Social Share Modal */}
      <SocialShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        video={video}
        onShowToast={showShareToast}
      />

      {/* Floating Share Toast Notification */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.15] text-zinc-950 dark:text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#DD2A7B]" />
          <span>{shareToast}</span>
        </div>
      )}
    </div>
  );
};
