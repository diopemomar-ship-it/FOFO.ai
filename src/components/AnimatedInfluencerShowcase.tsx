import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Clapperboard,
  Tv,
  Music2,
  Film,
  Download,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { GeneratedVideo } from '../types';
import {
  FAMOUS_INFLUENCER_ANIMATED_VIDEOS,
  InfluencerAnimatedVideoPreset,
} from '../data/influencerAnimatedVideos';
import { synthesizeImageToVideoClip } from '../utils/imageToVideoSynthesizer';
import { audioEngine } from '../utils/audioEngine';

interface AnimatedInfluencerShowcaseProps {
  onOpenInStudio: (video: GeneratedVideo) => void;
  onOpenCopyrightModal?: () => void;
  layout?: 'carousel' | 'grid';
  title?: string;
  subtitle?: string;
}

export const AnimatedInfluencerShowcase: React.FC<AnimatedInfluencerShowcaseProps> = ({
  onOpenInStudio,
  onOpenCopyrightModal,
  layout = 'grid',
  title = 'Vidéos Animées d’Influenceurs Célèbres',
  subtitle = 'Prévisualisez chaque montage multi-scènes en mouvement continu, générez un clip vidéo .webm ou ouvrez le projet complet dans Cinema Studio.',
}) => {
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'tiktok'>('all');
  const [royaltyFreeSafeMode, setRoyaltyFreeSafeMode] = useState<boolean>(false);
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});
  const [sceneTick, setSceneTick] = useState<number>(0);
  const [manualSceneMap, setManualSceneMap] = useState<Record<string, number>>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [generatedClips, setGeneratedClips] = useState<Record<string, string>>({});
  const generatedClipsRef = useRef<Record<string, string>>({});

  // Avance automatique des scènes pour l'aperçu animé multi-scènes
  useEffect(() => {
    const interval = setInterval(() => {
      setSceneTick((prev) => prev + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    generatedClipsRef.current = generatedClips;
  }, [generatedClips]);

  useEffect(() => {
    return () => {
      Object.values(generatedClipsRef.current).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      audioEngine.stopSpeech();
      audioEngine.stopBackgroundMusic();
    };
  }, []);

  const filteredPresets = FAMOUS_INFLUENCER_ANIMATED_VIDEOS.filter((item) =>
    platformFilter === 'all' ? true : item.platform === platformFilter
  );

  const togglePlay = (id: string) => {
    setPausedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAudioPreview = (preset: InfluencerAnimatedVideoPreset) => {
    if (speakingId === preset.id) {
      audioEngine.stopSpeech();
      audioEngine.stopBackgroundMusic();
      setSpeakingId(null);
      return;
    }

    setSpeakingId(preset.id);
    if (preset.video.hookSfx && preset.video.hookSfx !== 'none') {
      audioEngine.playSfx(preset.video.hookSfx);
    }
    audioEngine.playBackgroundMusic(preset.video.musicMood, 0.25);

    const text = preset.video.scenes[0]?.voiceoverText || preset.video.hook;
    audioEngine.speakText(text, preset.video.voiceId, {
      onEnd: () => {
        audioEngine.stopBackgroundMusic();
        setSpeakingId((curr) => (curr === preset.id ? null : curr));
      },
      onError: () => {
        audioEngine.stopBackgroundMusic();
        setSpeakingId((curr) => (curr === preset.id ? null : curr));
      },
    });
  };

  const resolveSafeSceneImage = (preset: InfluencerAnimatedVideoPreset, sceneUrl: string, sceneIdx: number) => {
    if (!royaltyFreeSafeMode || !sceneUrl.startsWith('/assets/creators/')) {
      return sceneUrl;
    }
    const stockScenes = preset.video.scenes.filter((s) => !s.imageUrl.startsWith('/assets/creators/'));
    if (stockScenes.length > 0) {
      return stockScenes[sceneIdx % stockScenes.length].imageUrl;
    }
    return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80';
  };

  const handleSynthesizeWebmClip = async (preset: InfluencerAnimatedVideoPreset) => {
    if (renderingId) return;
    setRenderError(null);
    setRenderingId(preset.id);
    setRenderProgress(5);

    const sourceImageUrl = resolveSafeSceneImage(preset, preset.creatorAvatarUrl, 0);

    try {
      const clip = await synthesizeImageToVideoClip({
        imageUrl: sourceImageUrl,
        motionPreset: preset.motionPreset,
        intensity: 'intense',
        aspectRatio: preset.video.aspectRatio,
        durationSeconds: 4,
        focalPoint: { x: 0.5, y: 0.34 },
        colorGrade: preset.video.colorGrade || 'natural',
        onProgress: (pct) => setRenderProgress(pct),
      });

      setGeneratedClips((prev) => {
        const old = prev[preset.id];
        if (old && old.startsWith('blob:')) {
          URL.revokeObjectURL(old);
        }
        return { ...prev, [preset.id]: clip.videoUrl };
      });
    } catch {
      setRenderError(`Impossible de synthétiser le clip sur ce navigateur.`);
    } finally {
      setRenderingId(null);
      setRenderProgress(0);
    }
  };

  const handleOpenProject = (preset: InfluencerAnimatedVideoPreset) => {
    const generatedClipUrl = generatedClips[preset.id];
    const clonedScenes = preset.video.scenes.map((scene, idx) => {
      const safeImageUrl = resolveSafeSceneImage(preset, scene.imageUrl, idx);
      if (idx === 0 && generatedClipUrl) {
        return {
          ...scene,
          imageUrl: safeImageUrl,
          mediaType: 'video' as const,
          videoUrl: generatedClipUrl,
          aiAnimated: true,
        };
      }
      return {
        ...scene,
        imageUrl: safeImageUrl,
      };
    });

    const cleanTitle = royaltyFreeSafeMode
      ? `${preset.badge} — ${preset.video.title.split('—')[1]?.trim() || preset.video.title}`
      : preset.video.title;

    onOpenInStudio({
      ...preset.video,
      id: `${preset.video.id}-${Date.now()}`,
      title: cleanTitle,
      createdAt: new Date().toISOString(),
      scenes: clonedScenes,
    });
  };

  const getMotionClass = (preset: InfluencerAnimatedVideoPreset, sceneIdx: number) => {
    if (pausedMap[preset.id]) return '';
    if (preset.motionPreset === 'dolly-zoom') return 'anim-live-dolly';
    if (preset.motionPreset === 'whip-pan' || preset.motionPreset === 'drone-flyover') {
      return sceneIdx % 2 === 0 ? 'anim-live-orbit' : 'anim-live-pan';
    }
    return sceneIdx % 2 === 0 ? 'anim-live-orbit' : 'anim-live-dolly';
  };

  const getFxOverlayClass = (effect?: string) => {
    if (effect === 'rgb-glitch') return 'effect-rgb-glitch';
    if (effect === 'zoom-punch') return 'effect-zoom-punch';
    if (effect === 'beat-pulse') return 'effect-beat-pulse';
    return '';
  };

  return (
    <section className="rounded-3xl bg-white/95 dark:bg-[#0D0D12]/85 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/[0.1] shadow-[0_16px_48px_-16px_rgba(0,0,0,0.45)] p-5 sm:p-6 space-y-5">
      {/* Header & Platform Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#DD2A7B]">
            <Film className="w-4 h-4" />
            <span>Montages Animés Prêts à Lire</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-heading text-zinc-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
              platformFilter === 'all'
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span className="tabular-nums">Tous ({FAMOUS_INFLUENCER_ANIMATED_VIDEOS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter('youtube')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              platformFilter === 'youtube'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>YouTube 16:9</span>
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter('tiktok')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              platformFilter === 'tiktok'
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-[#00F2EA] dark:text-black dark:border-[#00F2EA]'
                : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>TikTok 9:16</span>
          </button>

          <button
            type="button"
            onClick={() => {
              Object.values(generatedClipsRef.current).forEach((url) => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
              });
              setGeneratedClips({});
              setRoyaltyFreeSafeMode((prev) => !prev);
            }}
            title="Remplacer les portraits de personnalités par des scènes libres de droits avant export ou monétisation"
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              royaltyFreeSafeMode
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:border-emerald-500/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{royaltyFreeSafeMode ? '100% Libre de droits actif' : 'Sans portraits tiers'}</span>
          </button>
        </div>
      </div>

      {renderError && (
        <div className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-medium text-red-600 dark:text-red-400">
          {renderError}
        </div>
      )}

      {/* Cards Container */}
      <div
        className={
          layout === 'carousel'
            ? 'flex items-stretch gap-4 overflow-x-auto pb-2'
            : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5'
        }
      >
        {filteredPresets.map((preset) => {
          const scenes = preset.video.scenes;
          const isPaused = Boolean(pausedMap[preset.id]);
          const activeSceneIdx =
            manualSceneMap[preset.id] !== undefined
              ? manualSceneMap[preset.id] % scenes.length
              : isPaused
              ? 0
              : sceneTick % scenes.length;
          const activeScene = scenes[activeSceneIdx] || scenes[0];
          const isYouTube = preset.platform === 'youtube';
          const clipUrl = generatedClips[preset.id];
          const isRenderingThis = renderingId === preset.id;
          const isSpeakingThis = speakingId === preset.id;

          return (
            <div
              key={preset.id}
              className={`rounded-2xl overflow-hidden bg-zinc-50 dark:bg-[#121216] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] transition-all flex flex-col justify-between group ${
                layout === 'carousel' ? 'min-w-[300px] w-[300px] sm:min-w-[330px] sm:w-[330px] shrink-0' : ''
              }`}
            >
              <div>
                {/* Live Animated Video Stage */}
                <div className="relative h-72 w-full overflow-hidden bg-black">
                  {clipUrl ? (
                    <video
                      src={clipUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <div
                        className={`w-full h-full ${getFxOverlayClass(
                          activeScene.trendingEffect || preset.video.trendingEffect
                        )}`}
                      >
                        <img
                          key={`${preset.id}-${activeSceneIdx}-${royaltyFreeSafeMode ? 'rf' : 'orig'}`}
                          src={resolveSafeSceneImage(preset, activeScene.imageUrl, activeSceneIdx)}
                          alt={`${preset.creatorName} — Scène ${activeScene.sceneNumber}`}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover object-top ${getMotionClass(
                            preset,
                            activeSceneIdx
                          )}`}
                        />
                      </div>

                      {preset.video.trendingEffect === 'film-grain' && (
                        <div className="absolute inset-0 effect-film-grain pointer-events-none" />
                      )}
                      {preset.video.trendingEffect === 'spotlight-vignette' && (
                        <div className="absolute inset-0 effect-spotlight-vignette pointer-events-none" />
                      )}
                      {preset.video.trendingEffect === 'cinema-bars' && (
                        <>
                          <div className="absolute top-0 inset-x-0 h-5 bg-black pointer-events-none" />
                          <div className="absolute bottom-0 inset-x-0 h-5 bg-black pointer-events-none" />
                        </>
                      )}
                    </>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/55 pointer-events-none" />

                  {/* Scene Timeline Segments */}
                  {!clipUrl && (
                    <div className="absolute top-2.5 left-3 right-3 flex items-center gap-1 z-20">
                      {scenes.map((s, idx) => (
                        <button
                          key={s.sceneNumber}
                          type="button"
                          onClick={() =>
                            setManualSceneMap((prev) => ({ ...prev, [preset.id]: idx }))
                          }
                          title={`Voir scène ${idx + 1}`}
                          className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/25 cursor-pointer"
                        >
                          <div
                            className={`h-full transition-all duration-300 ${
                              idx === activeSceneIdx
                                ? 'bg-white w-full'
                                : idx < activeSceneIdx
                                ? 'bg-white/75 w-full'
                                : 'w-0'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Top Badges & Controls */}
                  <div className="absolute top-6 left-3 right-3 flex items-center justify-between gap-2 z-20">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={preset.creatorAvatarUrl}
                        alt={preset.creatorName}
                        className="w-9 h-9 rounded-full object-cover object-top ring-2 ring-white/50 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-white truncate drop-shadow-sm">
                          {preset.creatorName}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-200 truncate">
                          {preset.creatorHandle}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                        isYouTube
                          ? 'bg-red-600/95 text-white'
                          : 'bg-black/85 text-[#00F2EA] border border-[#00F2EA]/40'
                      }`}
                    >
                      {isYouTube ? <Tv className="w-3 h-3" /> : <Music2 className="w-3 h-3" />}
                      <span>{isYouTube ? '16:9' : '9:16'}</span>
                    </span>
                  </div>

                  {/* Quick Play/Pause & Audio Overlay */}
                  {!clipUrl && (
                    <div className="absolute bottom-14 right-3 flex items-center gap-1.5 z-20">
                      <button
                        type="button"
                        onClick={() => handleToggleAudioPreview(preset)}
                        title={
                          isSpeakingThis
                            ? 'Couper la voix off & musique'
                            : 'Écouter la voix off & ambiance musicale'
                        }
                        className={`p-2 rounded-full backdrop-blur-md border transition-colors cursor-pointer ${
                          isSpeakingThis
                            ? 'bg-[#0095F6] text-white border-[#0095F6]'
                            : 'bg-black/65 text-white border-white/20 hover:bg-black/85'
                        }`}
                      >
                        {isSpeakingThis ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePlay(preset.id)}
                        title={isPaused ? 'Reprendre l’animation' : 'Mettre en pause'}
                        className="p-2 rounded-full bg-black/65 hover:bg-black/85 text-white backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                      >
                        {isPaused ? (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Animated Subtitle Preview */}
                  {!clipUrl && (
                    <div className="absolute bottom-2.5 left-3 right-3 z-20 pointer-events-none space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300">
                        <span>
                          Scène {activeScene.sceneNumber}/{scenes.length} · {preset.motionStyleLabel}
                        </span>
                        <span>~{preset.video.totalEstimatedDuration}s</span>
                      </div>
                      <p
                        className="text-xs font-extrabold leading-snug line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
                        style={{
                          color:
                            preset.video.captionStyle === 'karaoke'
                              ? preset.video.karaokeHighlightColor || '#FACC15'
                              : preset.video.captionStyle === 'neon-blue'
                              ? '#60A5FA'
                              : '#FFFFFF',
                        }}
                      >
                        {activeScene.voiceoverText}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Meta Info */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                      {preset.video.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {preset.video.hook}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
                    <span>{preset.badge}</span>
                    <span>{preset.subscribersLabel}</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="p-3 border-t border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0B0B0E] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenProject(preset)}
                  className="flex-1 py-2 px-3 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Clapperboard className="w-3.5 h-3.5" />
                  <span>Ouvrir dans Studio</span>
                </button>

                {clipUrl ? (
                  <a
                    href={clipUrl}
                    download={`${preset.id}.webm`}
                    title="Télécharger le clip vidéo animé (.webm)"
                    className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.webm</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(renderingId)}
                    onClick={() => handleSynthesizeWebmClip(preset)}
                    title="Synthétiser un vrai clip vidéo animé (.webm) à partir de ce portrait"
                    className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-[#16161C] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400 dark:hover:border-white/30 flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {isRenderingThis ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0095F6]" />
                        <span className="tabular-nums">{renderProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#DD2A7B]" />
                        <span>Clip .webm</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(generatedClips).length > 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Clip vidéo animé prêt : cliquez sur « Ouvrir dans Studio » pour monter le projet complet ou téléchargez le fichier .webm.
          </span>
        </div>
      )}

      {/* Copyright & Image Rights Notice */}
      <div className="pt-3 border-t border-zinc-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Musiques et SFX synthétisés <strong>100 % libres de droits</strong> (zéro Content ID). Les portraits d’influenceurs sont présentés à titre d’inspiration : activez <strong>« Sans portraits tiers »</strong> ou importez vos visuels pour une diffusion commerciale.
          </span>
        </div>
        {onOpenCopyrightModal && (
          <button
            type="button"
            onClick={onOpenCopyrightModal}
            className="text-xs font-semibold text-[#0095F6] hover:underline shrink-0 text-left sm:text-right cursor-pointer"
          >
            Règles droits d’auteur →
          </button>
        )}
      </div>
    </section>
  );
};
