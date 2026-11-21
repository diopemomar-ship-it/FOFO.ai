import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  Download,
  Film,
  Orbit,
  Crosshair,
  Sliders,
  Sparkles,
  SunMedium,
  Search,
  Loader2,
  Check,
  Wand2,
  Smartphone,
  Tv,
  Square,
  Layers,
} from 'lucide-react';
import {
  AspectRatio,
  ColorGradePreset,
  ImageMotionIntensity,
  ImageMotionPreset,
  ImageVideoEngine,
  ImportedMediaItem,
  StockImageResult,
} from '../types';
import { IMAGE_MOTION_PRESETS, IMAGE_VIDEO_ENGINES } from '../data/mockTemplates';
import {
  BokehParticle,
  createBokehParticles,
  getDimensionsForAspectRatio,
  loadSourceImage,
  renderAnimatedImageFrame,
  synthesizeImageToVideoClip,
} from '../utils/imageToVideoSynthesizer';
import { processUploadedMediaFiles } from '../utils/mediaImport';
import { triggerDownload } from '../utils/videoExporter';

import sampleAlpinePeak from '../assets/images/sample_alpine_peak_1795170066814.jpg';
import sampleCyberStreet from '../assets/images/sample_cyber_street_1795170067937.jpg';
import sampleLuxuryWatch from '../assets/images/sample_luxury_watch_1795170066689.jpg';
import sampleStudioPortrait from '../assets/images/sample_studio_portrait_1795170067030.jpg';

export interface AnimatedSequenceFrame {
  id: string;
  name: string;
  imageUrl: string;
  motionPreset: ImageMotionPreset;
  intensity: ImageMotionIntensity;
  focalPoint: { x: number; y: number };
  colorGrade: ColorGradePreset;
  durationSeconds: number;
  enableParticles: boolean;
  enableLightRays: boolean;
}

interface ImageToVideoStudioProps {
  onSendSequenceToCinemaStudio: (config: {
    media: ImportedMediaItem[];
    motionPrompt: string;
    motionPreset: ImageMotionPreset;
    imageVideoEngine: ImageVideoEngine;
    motionIntensity: ImageMotionIntensity;
    clipDuration: number;
    aspectRatio: AspectRatio;
  }) => void;
  isGenerating?: boolean;
}

const SAMPLE_FRAMES: Array<{
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  defaultRatio: AspectRatio;
  defaultPreset: ImageMotionPreset;
  defaultGrade: ColorGradePreset;
  defaultFocal: { x: number; y: number };
}> = [
  {
    id: 'sample-cyber',
    name: 'Rue Néon Tokyo',
    category: 'Urbain',
    imageUrl: sampleCyberStreet,
    defaultRatio: '9:16',
    defaultPreset: 'dolly-zoom',
    defaultGrade: 'cyber-blue',
    defaultFocal: { x: 0.56, y: 0.52 },
  },
  {
    id: 'sample-alpine',
    name: 'Sommet Alpin',
    category: 'Paysage',
    imageUrl: sampleAlpinePeak,
    defaultRatio: '16:9',
    defaultPreset: 'drone-flyover',
    defaultGrade: 'golden-hour',
    defaultFocal: { x: 0.68, y: 0.44 },
  },
  {
    id: 'sample-watch',
    name: 'Chronographe Titane',
    category: 'Produit',
    imageUrl: sampleLuxuryWatch,
    defaultRatio: '1:1',
    defaultPreset: 'orbit-3d',
    defaultGrade: 'teal-orange',
    defaultFocal: { x: 0.5, y: 0.48 },
  },
  {
    id: 'sample-portrait',
    name: 'Portrait Éditorial',
    category: 'Portrait',
    imageUrl: sampleStudioPortrait,
    defaultRatio: '4:5',
    defaultPreset: 'float-breathing',
    defaultGrade: 'noir-contrast',
    defaultFocal: { x: 0.52, y: 0.36 },
  },
];

const COLOR_GRADES: Array<{ id: ColorGradePreset; label: string; swatch: string }> = [
  { id: 'natural', label: 'Naturel', swatch: 'bg-zinc-500' },
  { id: 'teal-orange', label: 'Teal & Orange', swatch: 'bg-gradient-to-r from-cyan-500 to-orange-500' },
  { id: 'golden-hour', label: 'Golden Hour', swatch: 'bg-amber-400' },
  { id: 'cyber-blue', label: 'Cyber Bleu', swatch: 'bg-sky-500' },
  { id: 'noir-contrast', label: 'Noir & Blanc', swatch: 'bg-zinc-900 dark:bg-zinc-200' },
];

export const ImageToVideoStudio: React.FC<ImageToVideoStudioProps> = ({
  onSendSequenceToCinemaStudio,
  isGenerating = false,
}) => {
  const initialSample = SAMPLE_FRAMES[0];

  const [frames, setFrames] = useState<AnimatedSequenceFrame[]>([
    {
      id: initialSample.id,
      name: initialSample.name,
      imageUrl: initialSample.imageUrl,
      motionPreset: initialSample.defaultPreset,
      intensity: 'cinematic',
      focalPoint: initialSample.defaultFocal,
      colorGrade: initialSample.defaultGrade,
      durationSeconds: 5,
      enableParticles: true,
      enableLightRays: true,
    },
  ]);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialSample.defaultRatio);
  const [imageVideoEngine, setImageVideoEngine] = useState<ImageVideoEngine>('kling-2');
  const [motionPrompt, setMotionPrompt] = useState<string>('');

  // Live preview playback state
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0); // 0..1
  const [showFocalHint, setShowFocalHint] = useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportPct, setExportPct] = useState<number>(0);
  const [exportedClipUrl, setExportedClipUrl] = useState<string | null>(null);
  const [exportedMime, setExportedMime] = useState<string>('video/mp4');

  // Upload & stock search state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [stockQuery, setStockQuery] = useState<string>('');
  const [stockResults, setStockResults] = useState<StockImageResult[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState<boolean>(false);
  const [stockOpen, setStockOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const particlesRef = useRef<BokehParticle[]>([]);
  const lastRafRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);

  const activeFrame = frames[selectedFrameIdx] || frames[0];

  const updateActiveFrame = useCallback(
    (patch: Partial<AnimatedSequenceFrame>) => {
      setFrames((prev) =>
        prev.map((item, idx) => (idx === selectedFrameIdx ? { ...item, ...patch } : item))
      );
      setExportedClipUrl(null);
    },
    [selectedFrameIdx]
  );

  // Load image into HTMLImageElement & rebuild deterministic bokeh particles on frame/preset change
  useEffect(() => {
    if (!activeFrame?.imageUrl) return;
    let cancelled = false;
    setIsImageLoading(true);
    setImageLoadError(null);

    particlesRef.current = createBokehParticles(
      activeFrame.motionPreset === 'parallax-depth' ? 30 : 20,
      activeFrame.motionPreset
    );

    loadSourceImage(activeFrame.imageUrl)
      .then((img) => {
        if (cancelled) return;
        loadedImageRef.current = img;
        setIsImageLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        loadedImageRef.current = null;
        setIsImageLoading(false);
        setImageLoadError("Impossible de charger cette image pour l'aperçu.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeFrame?.imageUrl, activeFrame?.motionPreset]);

  // Real-time 60fps Canvas preview loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getDimensionsForAspectRatio(aspectRatio);
    // Keep preview canvas crisp at 0.75x scale for effortless 60fps smoothness
    const previewW = Math.round(width * 0.75);
    const previewH = Math.round(height * 0.75);
    if (canvas.width !== previewW || canvas.height !== previewH) {
      canvas.width = previewW;
      canvas.height = previewH;
    }

    let animId = 0;
    lastRafRef.current = null;

    const tick = (timestamp: number) => {
      if (lastRafRef.current === null) {
        lastRafRef.current = timestamp;
      }
      const deltaSec = Math.min(0.1, (timestamp - lastRafRef.current) / 1000);
      lastRafRef.current = timestamp;

      if (isPreviewPlaying) {
        const nextP = (progressRef.current + deltaSec / Math.max(3, activeFrame.durationSeconds)) % 1;
        progressRef.current = nextP;
        setProgress(nextP);
      }

      if (loadedImageRef.current) {
        renderAnimatedImageFrame(ctx, loadedImageRef.current, {
          t: progressRef.current,
          width: previewW,
          height: previewH,
          motionPreset: activeFrame.motionPreset,
          intensity: activeFrame.intensity,
          focalPoint: activeFrame.focalPoint,
          colorGrade: activeFrame.colorGrade,
          particles: particlesRef.current,
          enableParticles: activeFrame.enableParticles,
          enableLightRays: activeFrame.enableLightRays,
        });
      }

      animId = window.requestAnimationFrame(tick);
    };

    animId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animId);
  }, [
    aspectRatio,
    isPreviewPlaying,
    activeFrame?.motionPreset,
    activeFrame?.intensity,
    activeFrame?.focalPoint,
    activeFrame?.colorGrade,
    activeFrame?.durationSeconds,
    activeFrame?.enableParticles,
    activeFrame?.enableLightRays,
    activeFrame?.imageUrl,
  ]);

  const handleScrub = (val: number) => {
    const clamped = Math.max(0, Math.min(0.999, val));
    progressRef.current = clamped;
    setProgress(clamped);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.2, Math.min(0.8, (e.clientY - rect.top) / rect.height));
    updateActiveFrame({ focalPoint: { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) } });
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    try {
      const processed = await processUploadedMediaFiles(fileList);
      const imageItems = processed.filter((m) => m.mediaType === 'image');
      if (imageItems.length > 0) {
        const added: AnimatedSequenceFrame[] = imageItems.map((item) => ({
          id: `up-${item.id}`,
          name: item.name.replace(/\.[^/.]+$/, '').slice(0, 36) || 'Image importée',
          imageUrl: item.previewUrl,
          motionPreset: activeFrame?.motionPreset || 'orbit-3d',
          intensity: activeFrame?.intensity || 'cinematic',
          focalPoint: { x: 0.5, y: 0.45 },
          colorGrade: activeFrame?.colorGrade || 'natural',
          durationSeconds: activeFrame?.durationSeconds || 5,
          enableParticles: true,
          enableLightRays: true,
        }));
        setFrames((prev) => {
          const isOnlyDefault = prev.length === 1 && prev[0].id.startsWith('sample-');
          const next = isOnlyDefault ? added : [...prev, ...added];
          setSelectedFrameIdx(isOnlyDefault ? 0 : prev.length);
          return next;
        });
        progressRef.current = 0;
        setProgress(0);
        setExportedClipUrl(null);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSample = (sample: (typeof SAMPLE_FRAMES)[number]) => {
    setAspectRatio(sample.defaultRatio);
    const newFrame: AnimatedSequenceFrame = {
      id: `${sample.id}-${Date.now()}`,
      name: sample.name,
      imageUrl: sample.imageUrl,
      motionPreset: sample.defaultPreset,
      intensity: 'cinematic',
      focalPoint: sample.defaultFocal,
      colorGrade: sample.defaultGrade,
      durationSeconds: 5,
      enableParticles: true,
      enableLightRays: true,
    };
    setFrames((prev) => {
      if (prev.length === 1 && prev[0].id.startsWith('sample-')) {
        setSelectedFrameIdx(0);
        return [newFrame];
      }
      setSelectedFrameIdx(prev.length);
      return [...prev, newFrame];
    });
    progressRef.current = 0;
    setProgress(0);
    setExportedClipUrl(null);
  };

  const handleSearchStock = async () => {
    const q = stockQuery.trim();
    if (!q) return;
    setIsSearchingStock(true);
    try {
      const orientation =
        aspectRatio === '16:9' ? 'landscape' : aspectRatio === '1:1' ? 'square' : 'portrait';
      const resp = await fetch(
        `/api/stock-images/search?q=${encodeURIComponent(q)}&orientation=${orientation}&limit=6`
      );
      if (resp.ok) {
        const data = await resp.json();
        setStockResults(Array.isArray(data.results) ? data.results : []);
      }
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleAddStockImage = (img: StockImageResult) => {
    const url = img.proxyUrl || img.fullUrl;
    const newFrame: AnimatedSequenceFrame = {
      id: `stock-${img.id}-${Date.now()}`,
      name: img.title.slice(0, 32) || 'Visuel libre de droits',
      imageUrl: url,
      motionPreset: activeFrame?.motionPreset || 'parallax-depth',
      intensity: activeFrame?.intensity || 'cinematic',
      focalPoint: { x: 0.5, y: 0.45 },
      colorGrade: activeFrame?.colorGrade || 'natural',
      durationSeconds: activeFrame?.durationSeconds || 5,
      enableParticles: true,
      enableLightRays: true,
    };
    setFrames((prev) => {
      const next = [...prev, newFrame];
      setSelectedFrameIdx(next.length - 1);
      return next;
    });
    setStockOpen(false);
    setExportedClipUrl(null);
  };

  const handleRemoveFrame = (idx: number) => {
    if (frames.length <= 1) return;
    setFrames((prev) => prev.filter((_, i) => i !== idx));
    setSelectedFrameIdx((curr) => (curr >= idx ? Math.max(0, curr - 1) : curr));
    setExportedClipUrl(null);
  };

  const handleExportActiveClip = async () => {
    if (!activeFrame || isExporting) return;
    setIsExporting(true);
    setExportPct(5);
    try {
      const result = await synthesizeImageToVideoClip({
        imageUrl: activeFrame.imageUrl,
        motionPreset: activeFrame.motionPreset,
        intensity: activeFrame.intensity,
        aspectRatio,
        durationSeconds: activeFrame.durationSeconds,
        focalPoint: activeFrame.focalPoint,
        colorGrade: activeFrame.colorGrade,
        enableParticles: activeFrame.enableParticles,
        enableLightRays: activeFrame.enableLightRays,
        onProgress: (pct) => setExportPct(pct),
      });
      setExportedClipUrl(result.videoUrl);
      setExportedMime(result.mimeType);
      const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const safeName = activeFrame.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28);
      triggerDownload(result.blob, `fofo-anim-${safeName || 'clip'}.${ext}`);
    } catch (err) {
      console.error('Erreur export animation Image->Vidéo:', err);
      setImageLoadError("L'exportation du clip vidéo a échoué.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendToCinemaStudio = () => {
    if (frames.length === 0 || isGenerating) return;
    const media: ImportedMediaItem[] = frames.map((f) => ({
      id: f.id,
      name: f.name,
      mediaType: 'image',
      previewUrl: f.imageUrl,
      durationSeconds: f.durationSeconds,
    }));
    onSendSequenceToCinemaStudio({
      media,
      motionPrompt:
        motionPrompt.trim() ||
        `Animation cinématique ${activeFrame.motionPreset} sur ${frames.length} visuel${frames.length > 1 ? 's' : ''}`,
      motionPreset: activeFrame.motionPreset,
      imageVideoEngine,
      motionIntensity: activeFrame.intensity,
      clipDuration: activeFrame.durationSeconds,
      aspectRatio,
    });
  };

  const currentPresetMeta = IMAGE_MOTION_PRESETS.find((p) => p.id === activeFrame?.motionPreset);

  return (
    <div className="max-w-[1640px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header Bar */}
      <div className="p-4 sm:px-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Orbit className="w-4 h-4 text-[#DD2A7B]" />
              <span>Atelier Image → Vidéo 2.5D</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Aperçu temps réel 60 FPS</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {frames.length} image{frames.length > 1 ? 's' : ''}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-zinc-900 dark:text-white tracking-tight [text-wrap:balance]">
            Donnez vie à vos photos avec mouvement caméra 3D, parallaxe et lumière volumétrique
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportActiveClip}
            disabled={isExporting || isImageLoading || !activeFrame}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="tabular-nums">Encodage {exportPct}%...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger Clip ({activeFrame?.durationSeconds || 5}s)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSendToCinemaStudio}
            disabled={isGenerating || frames.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white electric-button-gradient disabled:opacity-50 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Film className="w-3.5 h-3.5" />
            )}
            <span>Monter avec Voix Off & Sous-titres</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Workstation */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Controls Rail */}
        <div className="xl:col-span-5 2xl:col-span-4 space-y-4">
          {/* Source Images & Samples */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#0095F6]" />
                <span>1. Source Image</span>
              </h2>
              <button
                type="button"
                onClick={() => setStockOpen((prev) => !prev)}
                className="text-[11px] font-semibold text-[#0095F6] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Search className="w-3 h-3" />
                <span>{stockOpen ? 'Fermer banque' : 'Banque libre de droits'}</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleUploadFiles(e.dataTransfer.files);
              }}
              className={`w-full py-4 px-3 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-3 cursor-pointer ${
                isDragging
                  ? 'bg-pink-50 dark:bg-white/[0.08] border-[#DD2A7B]'
                  : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-[#09090B] dark:hover:bg-white/[0.04] border-zinc-300 dark:border-white/[0.12]'
              }`}
            >
              <div className="w-9 h-9 rounded-lg electric-button-gradient flex items-center justify-center text-white shrink-0">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  {isUploading ? 'Importation en cours...' : 'Importer vos photos (JPG, PNG, WebP)'}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Glissez-déposez une ou plusieurs images à animer
                </p>
              </div>
            </button>

            {/* Stock Search Drawer */}
            {stockOpen && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchStock();
                      }
                    }}
                    placeholder="Ex: cosmos, océan, architecture..."
                    className="flex-1 min-w-0 rounded-lg bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSearchStock}
                    disabled={isSearchingStock || !stockQuery.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-black whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSearchingStock ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Chercher'}
                  </button>
                </div>
                {stockResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {stockResults.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleAddStockImage(img)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-zinc-200 dark:border-white/[0.1] hover:ring-2 hover:ring-[#0095F6] cursor-pointer"
                      >
                        <img
                          src={img.thumbUrl}
                          alt={img.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Instant Studio Samples */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Exemples haute définition prêts à tester
              </p>
              <div className="grid grid-cols-4 gap-2">
                {SAMPLE_FRAMES.map((sample) => {
                  const isActiveSample = activeFrame?.imageUrl === sample.imageUrl;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleLoadSample(sample)}
                      className={`group relative rounded-lg overflow-hidden border text-left transition-all cursor-pointer ${
                        isActiveSample
                          ? 'border-[#DD2A7B] ring-2 ring-[#DD2A7B]/40'
                          : 'border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400 dark:hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
                        <img
                          src={sample.imageUrl}
                          alt={sample.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="p-1.5 bg-zinc-50 dark:bg-[#09090B]">
                        <p className="text-[10px] font-bold text-zinc-900 dark:text-white truncate">
                          {sample.name}
                        </p>
                        <p className="text-[9px] text-zinc-500 truncate">{sample.category}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Motion Choreography Controls */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[#DD2A7B]" />
                <span>2. Mouvement Caméra 2.5D / 3D</span>
              </h2>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {currentPresetMeta?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {IMAGE_MOTION_PRESETS.map((preset) => {
                const isSelected = activeFrame?.motionPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateActiveFrame({ motionPreset: preset.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-[#09090B] dark:hover:bg-white/[0.06] border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">{preset.label}</span>
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 line-clamp-2 leading-snug ${
                        isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {preset.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Aspect Ratio + Duration + Intensity */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Format</span>
                <div className="grid grid-cols-2 gap-1">
                  {(['9:16', '16:9', '4:5', '1:1'] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold tabular-nums flex items-center justify-center gap-1 cursor-pointer ${
                        aspectRatio === ratio
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {ratio === '16:9' ? (
                        <Tv className="w-2.5 h-2.5" />
                      ) : ratio === '1:1' ? (
                        <Square className="w-2.5 h-2.5" />
                      ) : (
                        <Smartphone className="w-2.5 h-2.5" />
                      )}
                      <span>{ratio}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Intensité</span>
                <div className="space-y-1">
                  {(['subtle', 'cinematic', 'intense'] as ImageMotionIntensity[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updateActiveFrame({ intensity: lvl })}
                      className={`w-full py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                        activeFrame?.intensity === lvl
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {lvl === 'subtle' ? 'Doux' : lvl === 'cinematic' ? 'Ciné' : 'Intense'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Durée</span>
                <div className="space-y-1">
                  {[3, 5, 8].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateActiveFrame({ durationSeconds: sec })}
                      className={`w-full py-1 rounded-lg border text-[10px] font-bold tabular-nums cursor-pointer ${
                        activeFrame?.durationSeconds === sec
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Grade + Atmospheric FX */}
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/[0.07]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#0095F6]" />
                  <span>Étalonnage & Lumière</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {COLOR_GRADES.map((grade) => {
                  const active = activeFrame?.colorGrade === grade.id;
                  return (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => updateActiveFrame({ colorGrade: grade.id })}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${grade.swatch}`} />
                      <span>{grade.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateActiveFrame({ enableParticles: !activeFrame?.enableParticles })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    activeFrame?.enableParticles
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Particules Bokeh</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveFrame({ enableLightRays: !activeFrame?.enableLightRays })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    activeFrame?.enableLightRays
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  <SunMedium className="w-3.5 h-3.5" />
                  <span>Rayons Lumière</span>
                </button>
              </div>
            </div>

            {/* AI Engine & Narration Prompt for Studio */}
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/[0.07]">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                Moteur IA & Consigne de scène (optionnel pour Cinema Studio)
              </label>
              <div className="grid grid-cols-3 gap-1">
                {IMAGE_VIDEO_ENGINES.map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setImageVideoEngine(eng.id)}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold truncate cursor-pointer ${
                      imageVideoEngine === eng.id
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {eng.name}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={motionPrompt}
                onChange={(e) => setMotionPrompt(e.target.value)}
                placeholder="Ex: Mouvement immersif et voix off cinématique décrivant chaque détail..."
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.09] px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 resize-none"
              />
            </div>
          </section>
        </div>

        {/* Center Live 60FPS Animation Stage + Sequence Strip */}
        <div className="xl:col-span-7 2xl:col-span-8 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] space-y-4">
            {/* Stage Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Crosshair className="w-4 h-4 text-[#0095F6]" />
                <span>
                  Point focal caméra :{' '}
                  <strong className="text-zinc-900 dark:text-white font-mono tabular-nums">
                    {Math.round((activeFrame?.focalPoint.x ?? 0.5) * 100)}% /{' '}
                    {Math.round((activeFrame?.focalPoint.y ?? 0.45) * 100)}%
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="hidden sm:inline">Cliquez sur l’image pour viser le sujet</span>
              </div>

              <button
                type="button"
                onClick={() => updateActiveFrame({ focalPoint: { x: 0.5, y: 0.45 } })}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#09090B] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Recentrer</span>
              </button>
            </div>

            {/* Interactive Canvas Preview Viewport */}
            <div className="w-full rounded-2xl bg-[#07070A] border border-zinc-200 dark:border-white/[0.08] p-4 sm:p-6 flex items-center justify-center min-h-[420px] sm:min-h-[520px]">
              <div
                className="relative group"
                onMouseEnter={() => setShowFocalHint(true)}
                onMouseLeave={() => setShowFocalHint(false)}
              >
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className={`rounded-xl shadow-2xl border border-white/15 cursor-crosshair bg-black ${
                    aspectRatio === '16:9'
                      ? 'w-full max-w-[780px] aspect-video'
                      : aspectRatio === '1:1'
                      ? 'w-[340px] sm:w-[440px] aspect-square'
                      : aspectRatio === '4:5'
                      ? 'w-[300px] sm:w-[370px] aspect-[4/5]'
                      : 'w-[260px] sm:w-[300px] aspect-[9/16]'
                  }`}
                />

                {/* Interactive Focal Point Reticle */}
                {activeFrame && (
                  <div
                    style={{
                      left: `${activeFrame.focalPoint.x * 100}%`,
                      top: `${activeFrame.focalPoint.y * 100}%`,
                    }}
                    className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ${
                      showFocalHint ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.65)] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00F2EA]" />
                    </div>
                  </div>
                )}

                {isImageLoading && (
                  <div className="absolute inset-0 rounded-xl bg-black/70 flex items-center justify-center text-white text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Chargement haute résolution...</span>
                  </div>
                )}
              </div>
            </div>

            {imageLoadError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{imageLoadError}</p>
            )}

            {/* Playback & Scrubber Bar */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsPreviewPlaying((p) => !p)}
                className="w-9 h-9 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={isPreviewPlaying ? 'Mettre en pause' : 'Lire'}
              >
                {isPreviewPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={0.999}
                step={0.005}
                value={progress}
                onChange={(e) => {
                  setIsPreviewPlaying(false);
                  handleScrub(Number(e.target.value));
                }}
                aria-label="Progression de l'animation"
                className="flex-1 accent-[#DD2A7B] cursor-pointer"
              />

              <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-300 shrink-0 w-24 text-right">
                {(progress * (activeFrame?.durationSeconds || 5)).toFixed(1)}s /{' '}
                {(activeFrame?.durationSeconds || 5).toFixed(1)}s
              </span>
            </div>

            {/* Exported Video Clip Inline Verification Player */}
            {exportedClipUrl && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>
                    Clip vidéo exporté ({exportedMime.includes('mp4') ? 'MP4' : 'WebM'}) et téléchargé avec succès.
                  </span>
                </div>
                <a
                  href={exportedClipUrl}
                  download={`fofo-anim-${selectedFrameIdx + 1}.${exportedMime.includes('mp4') ? 'mp4' : 'webm'}`}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline whitespace-nowrap"
                >
                  Re-télécharger
                </a>
              </div>
            )}
          </div>

          {/* Multi-Image Sequence Strip */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0095F6]" />
                <span>Séquence d’images ({frames.length})</span>
              </h3>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Chaque image conserve son propre mouvement et point focal
              </span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {frames.map((frame, idx) => {
                const isSelected = idx === selectedFrameIdx;
                const presetLabel =
                  IMAGE_MOTION_PRESETS.find((p) => p.id === frame.motionPreset)?.label ||
                  frame.motionPreset;
                return (
                  <div
                    key={frame.id}
                    onClick={() => {
                      setSelectedFrameIdx(idx);
                      progressRef.current = 0;
                      setProgress(0);
                    }}
                    className={`relative w-36 rounded-xl overflow-hidden border shrink-0 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#DD2A7B] ring-2 ring-[#DD2A7B]/40 bg-zinc-900 text-white'
                        : 'border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#09090B] text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="relative h-20 w-full bg-black overflow-hidden">
                      <img
                        src={frame.imageUrl}
                        alt={frame.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono tabular-nums text-white">
                        #{idx + 1} · {frame.durationSeconds}s
                      </span>
                      {frames.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFrame(idx);
                          }}
                          title="Retirer cette image"
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-bold truncate">{frame.name}</p>
                      <p
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {presetLabel}
                      </p>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-[124px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-white/15 hover:border-zinc-500 dark:hover:border-white/35 bg-zinc-50 dark:bg-[#09090B] flex flex-col items-center justify-center gap-1.5 text-zinc-600 dark:text-zinc-300 shrink-0 cursor-pointer transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[11px] font-semibold">Ajouter</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
