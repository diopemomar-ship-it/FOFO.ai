import React, { useState } from 'react';
import {
  Activity,
  BookmarkPlus,
  Check,
  Clock,
  Crop,
  Film,
  Flame,
  FlipHorizontal2,
  FlipVertical2,
  Gauge,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Orbit,
  Palette,
  RotateCcw,
  RotateCw,
  Scissors,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  CameraEffect,
  ColorGradePreset,
  GeneratedVideo,
  ImageMotionPreset,
  SceneOverlayConfig,
  ScenePhotoAdjustments,
  SceneTransform,
  TrendingEffectId,
  VideoScene,
} from '../types';
import {
  IMAGE_MOTION_PRESETS,
  TRENDING_EFFECT_LIST,
} from '../data/mockTemplates';
import {
  buildPhotoAdjustmentsFilterCss,
  DEFAULT_PHOTO_ADJUSTMENTS,
  DEFAULT_SCENE_TRANSFORM,
  OVERLAY_COLOR_OPTIONS,
  PHOTO_FILTER_PRESETS,
} from '../utils/mediaTransforms';

interface CommonEditorProps {
  video: GeneratedVideo;
  currentSceneIdx: number;
  currentScene: VideoScene;
  onLiveUpdate: (updated: GeneratedVideo) => void;
  onCommitUpdate: (updated: GeneratedVideo, actionLabel?: string) => void;
}

interface PhotoEditorPanelProps extends CommonEditorProps {
  onReplaceSceneMedia: () => void;
  onRegenerateImage: () => void;
  onAnimateToVideo: (preset?: ImageMotionPreset) => void;
  isAnimatingScene: boolean;
  onSaveSceneImageToLibrary?: () => void;
  isSceneSavedToLibrary?: boolean;
}

const FOCAL_ANCHORS = [
  { x: 0.2, y: 0.2, label: 'Haut gauche' },
  { x: 0.5, y: 0.2, label: 'Haut centre' },
  { x: 0.8, y: 0.2, label: 'Haut droite' },
  { x: 0.2, y: 0.5, label: 'Milieu gauche' },
  { x: 0.5, y: 0.45, label: 'Centre sujet' },
  { x: 0.8, y: 0.5, label: 'Milieu droite' },
  { x: 0.2, y: 0.8, label: 'Bas gauche' },
  { x: 0.5, y: 0.8, label: 'Bas centre' },
  { x: 0.8, y: 0.8, label: 'Bas droite' },
];

export const PhotoEditorPanel: React.FC<PhotoEditorPanelProps> = ({
  video,
  currentSceneIdx,
  currentScene,
  onLiveUpdate,
  onCommitUpdate,
  onReplaceSceneMedia,
  onRegenerateImage,
  onAnimateToVideo,
  isAnimatingScene,
  onSaveSceneImageToLibrary,
  isSceneSavedToLibrary,
}) => {
  const [scope, setScope] = useState<'scene' | 'all'>('scene');

  const adj: Required<Omit<ScenePhotoAdjustments, 'presetId'>> & { presetId?: string } = {
    brightness: currentScene.photoAdjustments?.brightness ?? DEFAULT_PHOTO_ADJUSTMENTS.brightness,
    contrast: currentScene.photoAdjustments?.contrast ?? DEFAULT_PHOTO_ADJUSTMENTS.contrast,
    saturation: currentScene.photoAdjustments?.saturation ?? DEFAULT_PHOTO_ADJUSTMENTS.saturation,
    warmth: currentScene.photoAdjustments?.warmth ?? DEFAULT_PHOTO_ADJUSTMENTS.warmth,
    blur: currentScene.photoAdjustments?.blur ?? DEFAULT_PHOTO_ADJUSTMENTS.blur,
    vignette: currentScene.photoAdjustments?.vignette ?? DEFAULT_PHOTO_ADJUSTMENTS.vignette,
    presetId: currentScene.photoAdjustments?.presetId,
  };

  const trans: Required<SceneTransform> = {
    rotation: currentScene.transform?.rotation ?? DEFAULT_SCENE_TRANSFORM.rotation,
    tilt: currentScene.transform?.tilt ?? DEFAULT_SCENE_TRANSFORM.tilt,
    flipH: currentScene.transform?.flipH ?? DEFAULT_SCENE_TRANSFORM.flipH,
    flipV: currentScene.transform?.flipV ?? DEFAULT_SCENE_TRANSFORM.flipV,
    zoom: currentScene.transform?.zoom ?? DEFAULT_SCENE_TRANSFORM.zoom,
    fitMode: currentScene.transform?.fitMode ?? DEFAULT_SCENE_TRANSFORM.fitMode,
  };

  const focalX = typeof currentScene.focalPoint?.x === 'number' ? currentScene.focalPoint.x : 0.5;
  const focalY = typeof currentScene.focalPoint?.y === 'number' ? currentScene.focalPoint.y : 0.45;

  const updatePhotoAdj = (patch: Partial<ScenePhotoAdjustments>, commitLabel?: string) => {
    const nextAdj: ScenePhotoAdjustments = {
      ...currentScene.photoAdjustments,
      ...patch,
    };
    const nextScenes = video.scenes.map((scene, idx) =>
      scope === 'all' || idx === currentSceneIdx
        ? {
            ...scene,
            photoAdjustments: {
              ...scene.photoAdjustments,
              ...nextAdj,
            },
          }
        : scene
    );
    const updated = { ...video, scenes: nextScenes };
    if (commitLabel) {
      onCommitUpdate(updated, commitLabel);
    } else {
      onLiveUpdate(updated);
    }
  };

  const updateTransform = (patch: Partial<SceneTransform>, commitLabel?: string) => {
    const nextTrans: SceneTransform = {
      ...currentScene.transform,
      ...patch,
    };
    const nextScenes = video.scenes.map((scene, idx) =>
      scope === 'all' || idx === currentSceneIdx
        ? {
            ...scene,
            transform: {
              ...scene.transform,
              ...nextTrans,
            },
          }
        : scene
    );
    const updated = { ...video, scenes: nextScenes };
    if (commitLabel) {
      onCommitUpdate(updated, commitLabel);
    } else {
      onLiveUpdate(updated);
    }
  };

  const handleApplyPreset = (preset: (typeof PHOTO_FILTER_PRESETS)[number]) => {
    const nextScenes = video.scenes.map((scene, idx) =>
      scope === 'all' || idx === currentSceneIdx
        ? {
            ...scene,
            photoAdjustments: { ...preset.adjustments },
          }
        : scene
    );
    onCommitUpdate(
      { ...video, scenes: nextScenes },
      scope === 'all'
        ? `Filtre photo « ${preset.label} » appliqué à toutes les scènes`
        : `Filtre photo « ${preset.label} » appliqué (Scène ${currentSceneIdx + 1})`
    );
  };

  const handleRotateStep = (deltaDeg: number) => {
    const nextRot = (((trans.rotation + deltaDeg) % 360) + 360) % 360;
    updateTransform(
      { rotation: nextRot },
      `Rotation ${nextRot}° appliquée`
    );
  };

  const handleSetFocalPoint = (x: number, y: number, label?: string) => {
    const nextScenes = video.scenes.map((scene, idx) =>
      scope === 'all' || idx === currentSceneIdx
        ? { ...scene, focalPoint: { x, y } }
        : scene
    );
    onCommitUpdate(
      { ...video, scenes: nextScenes },
      label ? `Cadrage : ${label}` : `Point focal ajusté (${Math.round(x * 100)}%, ${Math.round(y * 100)}%)`
    );
  };

  const handleResetAllPhotoEdits = () => {
    const nextScenes = video.scenes.map((scene, idx) =>
      scope === 'all' || idx === currentSceneIdx
        ? {
            ...scene,
            photoAdjustments: undefined,
            transform: undefined,
            focalPoint: { x: 0.5, y: 0.45 },
          }
        : scene
    );
    onCommitUpdate(
      { ...video, scenes: nextScenes },
      scope === 'all'
        ? 'Retouches photo réinitialisées sur toutes les scènes'
        : `Retouches photo réinitialisées (Scène ${currentSceneIdx + 1})`
    );
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-5">
      {/* Header & Scope Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <h3 className="text-xs sm:text-sm font-extrabold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#0095F6]" />
            <span>Studio Photo · Scène {currentSceneIdx + 1}</span>
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Lumière, filtres, rotation, retournement et cadrage en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label="Portée des retouches photo"
            className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]"
          >
            <button
              type="button"
              onClick={() => setScope('scene')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                scope === 'scene'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              Scène {currentSceneIdx + 1}
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                scope === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              Toutes
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetAllPhotoEdits}
            title="Restaurer les réglages d'origine"
            className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Réinit.</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: 1-CLICK PHOTO PRESETS WITH LIVE SCENE THUMBNAIL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#DD2A7B]" />
            Préréglages Photo (1 clic)
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {scope === 'all' ? 'Tout le projet' : `Scène ${currentSceneIdx + 1}`}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PHOTO_FILTER_PRESETS.map((preset) => {
            const isSelected = (adj.presetId || 'original') === preset.id;
            const thumbFilter = buildPhotoAdjustmentsFilterCss(preset.adjustments);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`rounded-xl border overflow-hidden text-center transition-all cursor-pointer group ${
                  isSelected
                    ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white'
                    : 'border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                <div className="h-11 w-full bg-black overflow-hidden">
                  <img
                    src={currentScene.imageUrl}
                    alt={preset.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    style={{ filter: thumbFilter || undefined }}
                  />
                </div>
                <div
                  className={`py-1 px-1 text-[9px] font-bold truncate ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-50 dark:bg-[#09090B] text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {preset.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: LIGHT & COLOR SLIDERS */}
      <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            Lumière & Couleur
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Cliquer sur un libellé pour réinitialiser
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {[
            {
              key: 'brightness' as const,
              label: 'Luminosité',
              value: adj.brightness,
              min: 50,
              max: 150,
              step: 1,
              def: 100,
              unit: '%',
            },
            {
              key: 'contrast' as const,
              label: 'Contraste',
              value: adj.contrast,
              min: 50,
              max: 150,
              step: 1,
              def: 100,
              unit: '%',
            },
            {
              key: 'saturation' as const,
              label: 'Saturation',
              value: adj.saturation,
              min: 0,
              max: 200,
              step: 2,
              def: 100,
              unit: '%',
            },
            {
              key: 'warmth' as const,
              label: 'Chaleur / Vintage',
              value: adj.warmth,
              min: 0,
              max: 100,
              step: 2,
              def: 0,
              unit: '%',
            },
            {
              key: 'blur' as const,
              label: 'Flou artistique',
              value: adj.blur,
              min: 0,
              max: 8,
              step: 0.5,
              def: 0,
              unit: 'px',
            },
            {
              key: 'vignette' as const,
              label: 'Vignettage bords',
              value: adj.vignette,
              min: 0,
              max: 80,
              step: 2,
              def: 0,
              unit: '%',
            },
          ].map((ctrl) => (
            <div key={ctrl.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    updatePhotoAdj(
                      { [ctrl.key]: ctrl.def, presetId: undefined },
                      `${ctrl.label} réinitialisé`
                    )
                  }
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium cursor-pointer"
                  title={`Remettre à ${ctrl.def}${ctrl.unit}`}
                >
                  {ctrl.label}
                </button>
                <span className="font-mono tabular-nums text-zinc-950 dark:text-white font-bold">
                  {ctrl.value}
                  {ctrl.unit}
                </span>
              </div>
              <input
                type="range"
                min={ctrl.min}
                max={ctrl.max}
                step={ctrl.step}
                value={ctrl.value}
                onChange={(e) =>
                  updatePhotoAdj({ [ctrl.key]: Number(e.target.value), presetId: 'custom' })
                }
                aria-label={ctrl.label}
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
              />
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: TRANSFORM, ROTATE, FLIP, ZOOM & 3x3 FOCAL GRID */}
      <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-[#0095F6]" />
            Géométrie, Rotation & Recadrage
          </span>
          <span className="font-mono tabular-nums text-[10px] text-zinc-500 dark:text-zinc-400">
            {trans.rotation}° · {trans.zoom.toFixed(2)}x
          </span>
        </div>

        {/* Quick 1-click transform buttons */}
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={() => handleRotateStep(-90)}
            className="py-2 px-1.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-zinc-800 dark:text-zinc-200 flex flex-col items-center gap-1 cursor-pointer transition-colors"
            title="Pivoter de -90°"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">-90°</span>
          </button>

          <button
            type="button"
            onClick={() => handleRotateStep(90)}
            className="py-2 px-1.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-zinc-800 dark:text-zinc-200 flex flex-col items-center gap-1 cursor-pointer transition-colors"
            title="Pivoter de +90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">+90°</span>
          </button>

          <button
            type="button"
            onClick={() =>
              updateTransform(
                { flipH: !trans.flipH },
                !trans.flipH ? 'Miroir horizontal activé' : 'Miroir horizontal désactivé'
              )
            }
            aria-pressed={trans.flipH}
            className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              trans.flipH
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25'
            }`}
            title="Retourner horizontalement"
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">Miroir H</span>
          </button>

          <button
            type="button"
            onClick={() =>
              updateTransform(
                { flipV: !trans.flipV },
                !trans.flipV ? 'Miroir vertical activé' : 'Miroir vertical désactivé'
              )
            }
            aria-pressed={trans.flipV}
            className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              trans.flipV
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25'
            }`}
            title="Retourner verticalement"
          >
            <FlipVertical2 className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">Miroir V</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const nextFit = trans.fitMode === 'cover' ? 'contain' : 'cover';
              updateTransform(
                { fitMode: nextFit },
                nextFit === 'contain'
                  ? 'Mode Cadre entier + fond flouté activé'
                  : 'Mode Plein écran (Cover) activé'
              );
            }}
            aria-pressed={trans.fitMode === 'contain'}
            className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              trans.fitMode === 'contain'
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25'
            }`}
            title="Basculer entre Remplir (Cover) et Cadre entier avec fond flouté"
          >
            {trans.fitMode === 'contain' ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="text-[9px] font-bold">
              {trans.fitMode === 'contain' ? 'Entier' : 'Remplir'}
            </span>
          </button>
        </div>

        {/* Zoom, Tilt & 3x3 Focal Anchor */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8 space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => updateTransform({ zoom: 1 }, 'Zoom remis à 1.00x')}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium cursor-pointer"
                >
                  Zoom cadrage
                </button>
                <span className="font-mono tabular-nums font-bold text-zinc-950 dark:text-white">
                  {trans.zoom.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={220}
                step={5}
                value={Math.round(trans.zoom * 100)}
                onChange={(e) => updateTransform({ zoom: Number(e.target.value) / 100 })}
                aria-label="Zoom cadrage"
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#0095F6]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => updateTransform({ tilt: 0 }, 'Inclinaison remise à 0°')}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium cursor-pointer"
                >
                  Inclinaison / Horizon
                </button>
                <span className="font-mono tabular-nums font-bold text-zinc-950 dark:text-white">
                  {trans.tilt > 0 ? `+${trans.tilt}°` : `${trans.tilt}°`}
                </span>
              </div>
              <input
                type="range"
                min={-15}
                max={15}
                step={1}
                value={trans.tilt}
                onChange={(e) => updateTransform({ tilt: Number(e.target.value) })}
                aria-label="Inclinaison horizon"
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
              />
            </div>
          </div>

          {/* 3x3 Point Focal Grid */}
          <div className="sm:col-span-4 p-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Point focal</span>
              <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {Math.round(focalX * 100)}/{Math.round(focalY * 100)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {FOCAL_ANCHORS.map((anchor, aIdx) => {
                const isActive =
                  Math.abs(focalX - anchor.x) < 0.12 && Math.abs(focalY - anchor.y) < 0.12;
                return (
                  <button
                    key={aIdx}
                    type="button"
                    onClick={() => handleSetFocalPoint(anchor.x, anchor.y, anchor.label)}
                    title={anchor.label}
                    className={`h-5 rounded border transition-all cursor-pointer flex items-center justify-center ${
                      isActive
                        ? 'bg-zinc-900 border-zinc-900 dark:bg-white dark:border-white'
                        : 'bg-white dark:bg-[#141418] border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400 dark:hover:border-white/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white dark:bg-black' : 'bg-zinc-400 dark:bg-zinc-500'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: QUICK SOURCE & AI ACTIONS */}
      <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReplaceSceneMedia}
          className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-500" />
          <span>Remplacer photo</span>
        </button>

        <button
          type="button"
          onClick={onRegenerateImage}
          className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#0095F6]" />
          <span>Variante visuel</span>
        </button>

        <button
          type="button"
          disabled={isAnimatingScene}
          onClick={() => onAnimateToVideo()}
          className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-xs font-bold text-[#DD2A7B] flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
        >
          <Orbit className="w-3.5 h-3.5" />
          <span>{isAnimatingScene ? 'Animation...' : 'Animer en Vidéo IA'}</span>
        </button>

        {onSaveSceneImageToLibrary && (
          <button
            type="button"
            onClick={onSaveSceneImageToLibrary}
            className="py-2 px-3 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Sauver cette photo dans Ma Bibliothèque"
          >
            {isSceneSavedToLibrary ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <BookmarkPlus className="w-3.5 h-3.5" />
            )}
            <span>{isSceneSavedToLibrary ? 'Sauvé' : 'Bibliothèque'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

interface VideoEffectsPanelProps extends CommonEditorProps {
  effectApplyScope: 'all' | 'scene';
  onChangeEffectScope: (scope: 'all' | 'scene') => void;
  activeTrendingEffect: TrendingEffectId;
  onApplyTrendingEffect: (effectId: TrendingEffectId) => void;
  onToggleBeatPulse: () => void;
  onApplyColorGrade: (preset: ColorGradePreset) => void;
  colorGradeOptions: Array<{
    id: ColorGradePreset;
    label: string;
    swatchClass: string;
  }>;
  onSplitScene: () => void;
  onDuplicateScene: () => void;
  onDeleteScene: () => void;
  onDynamicPacing: () => void;
  onAlternateCameras: () => void;
  onChangeCameraEffect: (effect: CameraEffect) => void;
  onAnimateToVideo: (preset?: ImageMotionPreset) => void;
  isAnimatingScene: boolean;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const DURATION_QUICK_PRESETS = [3, 5, 7, 10];

export const VideoEffectsPanel: React.FC<VideoEffectsPanelProps> = ({
  video,
  currentSceneIdx,
  currentScene,
  onLiveUpdate,
  onCommitUpdate,
  effectApplyScope,
  onChangeEffectScope,
  activeTrendingEffect,
  onApplyTrendingEffect,
  onToggleBeatPulse,
  onApplyColorGrade,
  colorGradeOptions,
  onSplitScene,
  onDuplicateScene,
  onDeleteScene,
  onDynamicPacing,
  onAlternateCameras,
  onChangeCameraEffect,
  onAnimateToVideo,
  isAnimatingScene,
}) => {
  const playbackRate = currentScene.playbackRate ?? 1.0;
  const trimStart = currentScene.trimStart ?? 0;
  const trimEnd = currentScene.trimEnd ?? 0;
  const clipVolume = currentScene.clipVolume ?? 0;
  const overlayText = currentScene.overlay?.text ?? '';
  const overlayPosition = currentScene.overlay?.position ?? 'top';
  const overlayColor = currentScene.overlay?.color ?? '#FFFFFF';

  const updateCurrentScene = (
    patch: Partial<VideoScene>,
    commitLabel?: string,
    recalcTotalDuration = false
  ) => {
    const nextScenes = video.scenes.map((scene, idx) =>
      idx === currentSceneIdx ? { ...scene, ...patch } : scene
    );
    const updated: GeneratedVideo = {
      ...video,
      scenes: nextScenes,
      ...(recalcTotalDuration
        ? {
            totalEstimatedDuration: nextScenes.reduce(
              (sum, s) => sum + (s.durationSeconds || 5),
              0
            ),
          }
        : {}),
    };
    if (commitLabel) {
      onCommitUpdate(updated, commitLabel);
    } else {
      onLiveUpdate(updated);
    }
  };

  const updateOverlay = (patch: Partial<SceneOverlayConfig>, commitLabel?: string) => {
    updateCurrentScene(
      {
        overlay: {
          position: overlayPosition,
          color: overlayColor,
          text: overlayText,
          ...patch,
        },
      },
      commitLabel
    );
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <h3 className="text-xs sm:text-sm font-extrabold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Film className="w-4 h-4 text-[#0095F6]" />
            <span>Montage Vidéo & Effets · Scène {currentSceneIdx + 1}</span>
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Durée, vitesse, découpe, incrustations, étalonnage et effets viraux.
          </p>
        </div>

        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 font-mono tabular-nums text-[10px] font-bold border border-zinc-200 dark:border-white/[0.08]">
          {currentScene.mediaType === 'video' ? 'Clip Vidéo' : 'Plan Image'} · {currentScene.durationSeconds}s
        </span>
      </div>

      {/* SECTION 1: TIMING, DURATION, PLAYBACK SPEED & VIDEO TRIM */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#0095F6]" />
            Durée, Vitesse & Découpe du plan
          </span>
          <span className="text-[11px] font-mono tabular-nums font-bold text-zinc-950 dark:text-white">
            {currentScene.durationSeconds}s
          </span>
        </div>

        {/* Duration Slider + 1-click quick durations */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Durée d’affichage
            </span>
            <div className="flex items-center gap-1">
              {DURATION_QUICK_PRESETS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() =>
                    updateCurrentScene(
                      { durationSeconds: sec },
                      `Durée Scène ${currentSceneIdx + 1} : ${sec}s`,
                      true
                    )
                  }
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                    currentScene.durationSeconds === sec
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min={2}
            max={15}
            step={1}
            value={currentScene.durationSeconds}
            onChange={(e) =>
              updateCurrentScene({ durationSeconds: Number(e.target.value) }, undefined, true)
            }
            aria-label="Durée de la scène en secondes"
            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
          />

          {/* Camera Motion for Images OR Speed/Trim/Clip Audio for Videos */}
          {currentScene.mediaType === 'video' ? (
            <div className="pt-2 border-t border-zinc-200/80 dark:border-white/[0.06] space-y-2.5">
              {/* Playback Speed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-zinc-500" />
                    Vitesse du clip vidéo
                  </span>
                  <span className="font-mono tabular-nums font-bold text-zinc-950 dark:text-white">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {SPEED_OPTIONS.map((spd) => {
                    const isActive = Math.abs(playbackRate - spd) < 0.01;
                    return (
                      <button
                        key={spd}
                        type="button"
                        onClick={() =>
                          updateCurrentScene(
                            { playbackRate: spd },
                            `Vitesse clip : ${spd}x`
                          )
                        }
                        className={`py-1 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trim Start / End & Original Clip Audio */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block">
                    Début (sec)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={0.5}
                    value={trimStart}
                    onChange={(e) =>
                      updateCurrentScene({
                        trimStart: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.1] text-xs font-mono tabular-nums text-zinc-950 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block">
                    Fin max (0 = tout)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={0.5}
                    value={trimEnd}
                    onChange={(e) =>
                      updateCurrentScene({
                        trimEnd: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.1] text-xs font-mono tabular-nums text-zinc-950 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    <span className="flex items-center gap-0.5">
                      <Volume2 className="w-3 h-3" />
                      Son clip
                    </span>
                    <span className="font-mono tabular-nums text-zinc-950 dark:text-white">
                      {Math.round(clipVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(clipVolume * 100)}
                    onChange={(e) =>
                      updateCurrentScene({ clipVolume: Number(e.target.value) / 100 })
                    }
                    aria-label="Volume audio original du clip"
                    className="w-full h-1.5 mt-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#0095F6]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-zinc-200/80 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                  Caméra Ken Burns :
                </span>
                <select
                  value={currentScene.kenBurnsEffect}
                  onChange={(e) => onChangeCameraEffect(e.target.value as CameraEffect)}
                  className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.1] rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="zoom-in">Zoom In</option>
                  <option value="zoom-out">Zoom Out</option>
                  <option value="pan-left">Pan Gauche</option>
                  <option value="pan-right">Pan Droite</option>
                </select>
              </div>

              <button
                type="button"
                disabled={isAnimatingScene}
                onClick={() => onAnimateToVideo()}
                className="px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-[10px] font-bold text-[#DD2A7B] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Orbit className="w-3 h-3" />
                <span>{isAnimatingScene ? 'Conversion...' : 'Convertir en Clip Vidéo IA'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: SCENE TEXT OVERLAY / CALLOUT */}
      <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
            Texte incrusté sur la scène
          </span>
          {overlayText.trim().length > 0 && (
            <button
              type="button"
              onClick={() => updateOverlay({ text: '' }, 'Texte incrusté retiré')}
              className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Effacer
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={overlayText}
            onChange={(e) => updateOverlay({ text: e.target.value })}
            placeholder="Ex : ÉTAPE 1 · À NE PAS RATER"
            maxLength={60}
            className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs font-semibold text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
          />

          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] shrink-0">
            {(
              [
                { id: 'top', label: 'Haut' },
                { id: 'center', label: 'Centre' },
                { id: 'bottom', label: 'Bas' },
              ] as const
            ).map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => updateOverlay({ position: pos.id }, `Position texte : ${pos.label}`)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                  overlayPosition === pos.id
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Couleur :</span>
          {OVERLAY_COLOR_OPTIONS.map((col) => {
            const isActive = overlayColor.toLowerCase() === col.hex.toLowerCase();
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => updateOverlay({ color: col.hex }, `Couleur texte : ${col.label}`)}
                title={col.label}
                aria-label={`Couleur ${col.label}`}
                className={`w-5 h-5 rounded-md border cursor-pointer transition-transform ${
                  isActive ? 'scale-110 ring-2 ring-zinc-900 dark:ring-white border-white dark:border-black' : 'border-black/20 dark:border-white/20'
                }`}
                style={{ backgroundColor: col.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* SECTION 3: QUICK 1-CLICK MONTAGE ACTIONS */}
      <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
            Actions rapides de montage (1 clic)
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Ctrl+Z pour annuler</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onSplitScene}
            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-colors cursor-pointer"
          >
            <p className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-[#0095F6]" />
              <span>Scinder Sc.{currentSceneIdx + 1}</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Coupe en 2 plans</p>
          </button>

          <button
            type="button"
            onClick={onDuplicateScene}
            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-colors cursor-pointer"
          >
            <p className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-emerald-500" />
              <span>Dupliquer Sc.{currentSceneIdx + 1}</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Clone avec angle opposé</p>
          </button>

          <button
            type="button"
            onClick={onDynamicPacing}
            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-colors cursor-pointer"
          >
            <p className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Cuts Rapides</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Rythme dynamique 4-5s</p>
          </button>

          <button
            type="button"
            onClick={onAlternateCameras}
            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 text-left transition-colors cursor-pointer"
          >
            <p className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Orbit className="w-3.5 h-3.5 text-[#DD2A7B]" />
              <span>Alterner Caméras</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Zoom & Pan auto</p>
          </button>

          <button
            type="button"
            disabled={video.scenes.length <= 1}
            onClick={onDeleteScene}
            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-rose-500/40 text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed sm:col-span-2"
          >
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer la Scène {currentSceneIdx + 1}</span>
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {video.scenes.length <= 1 ? 'Minimum 1 scène requise' : 'Retire ce plan de la timeline'}
            </p>
          </button>
        </div>
      </div>

      {/* SECTION 4: COLOR GRADING & VIRAL VISUAL EFFECTS */}
      <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
            Étalonnage Cinéma (Tout le film)
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">Prévisualisé & Exporté</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {colorGradeOptions.map((grade) => {
            const isSelected = (video.colorGrade || 'natural') === grade.id;
            return (
              <button
                key={grade.id}
                type="button"
                onClick={() => onApplyColorGrade(grade.id)}
                className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                <span className={`w-4 h-4 rounded-full shrink-0 border border-zinc-300 dark:border-white/20 ${grade.swatchClass}`} />
                <span className="text-[11px] font-bold truncate">{grade.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            Effets Visuels Viraux
          </span>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => onChangeEffectScope('all')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  effectApplyScope === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Toute la vidéo
              </button>
              <button
                type="button"
                onClick={() => onChangeEffectScope('scene')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  effectApplyScope === 'scene'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Scène {currentSceneIdx + 1}
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleBeatPulse}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                video.beatPulse
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                  : 'bg-zinc-100 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Beat-Pulse {video.beatPulse ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRENDING_EFFECT_LIST.map((fx) => {
            const isSelected = activeTrendingEffect === fx.id;
            return (
              <button
                key={fx.id}
                type="button"
                onClick={() => onApplyTrendingEffect(fx.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className={`text-xs font-bold truncate ${isSelected ? 'text-white dark:text-black' : 'text-zinc-950 dark:text-white'}`}>
                    {fx.label}
                  </p>
                  {fx.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[8px] font-bold border shrink-0 ${
                        isSelected
                          ? 'bg-white/15 text-white border-white/25 dark:bg-black/10 dark:text-black dark:border-black/20'
                          : 'bg-zinc-200/70 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-white/[0.1]'
                      }`}
                    >
                      {fx.badge}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {fx.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Motion AI preset shortcut */}
      {IMAGE_MOTION_PRESETS.length > 0 && (
        <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Orbit className="w-3.5 h-3.5 text-[#DD2A7B]" />
            Mouvement IA Caméra (Image → Vidéo)
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {IMAGE_MOTION_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={isAnimatingScene}
                onClick={() => onAnimateToVideo(preset.id)}
                className={`px-2 py-1 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-50 ${
                  currentScene.motionPreset === preset.id && currentScene.mediaType === 'video'
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
