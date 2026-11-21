import {
  ColorGradePreset,
  ScenePhotoAdjustments,
  SceneTransform,
  VideoScene,
} from '../types';

export const DEFAULT_PHOTO_ADJUSTMENTS: Required<Omit<ScenePhotoAdjustments, 'presetId'>> = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  blur: 0,
  vignette: 0,
};

export const DEFAULT_SCENE_TRANSFORM: Required<SceneTransform> = {
  rotation: 0,
  tilt: 0,
  flipH: false,
  flipV: false,
  zoom: 1,
  fitMode: 'cover',
};

export interface PhotoPresetOption {
  id: string;
  label: string;
  adjustments: ScenePhotoAdjustments;
}

export const PHOTO_FILTER_PRESETS: PhotoPresetOption[] = [
  {
    id: 'original',
    label: 'Original',
    adjustments: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      warmth: 0,
      blur: 0,
      vignette: 0,
      presetId: 'original',
    },
  },
  {
    id: 'hdr-vivid',
    label: 'Éclat HDR',
    adjustments: {
      brightness: 106,
      contrast: 122,
      saturation: 130,
      warmth: 0,
      blur: 0,
      vignette: 15,
      presetId: 'hdr-vivid',
    },
  },
  {
    id: 'warm-studio',
    label: 'Studio Chaud',
    adjustments: {
      brightness: 108,
      contrast: 108,
      saturation: 118,
      warmth: 24,
      blur: 0,
      vignette: 12,
      presetId: 'warm-studio',
    },
  },
  {
    id: 'cold-cinema',
    label: 'Ciné Froid',
    adjustments: {
      brightness: 96,
      contrast: 118,
      saturation: 86,
      warmth: 0,
      blur: 0,
      vignette: 26,
      presetId: 'cold-cinema',
    },
  },
  {
    id: 'bw-drama',
    label: 'N&B Pro',
    adjustments: {
      brightness: 102,
      contrast: 136,
      saturation: 0,
      warmth: 0,
      blur: 0,
      vignette: 32,
      presetId: 'bw-drama',
    },
  },
  {
    id: 'vintage-soft',
    label: 'Vintage Doux',
    adjustments: {
      brightness: 104,
      contrast: 92,
      saturation: 82,
      warmth: 38,
      blur: 0,
      vignette: 38,
      presetId: 'vintage-soft',
    },
  },
];

export const OVERLAY_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc', hex: '#FFFFFF' },
  { id: 'gold', label: 'Or', hex: '#FDE047' },
  { id: 'cyan', label: 'Cyan', hex: '#38BDF8' },
  { id: 'pink', label: 'Néon', hex: '#FF3366' },
  { id: 'emerald', label: 'Vert', hex: '#10B981' },
];

export function getColorGradeFilterCss(colorGrade?: ColorGradePreset): string {
  switch (colorGrade) {
    case 'teal-orange':
      return 'contrast(1.12) saturate(1.22) sepia(0.08)';
    case 'noir-contrast':
      return 'grayscale(1) contrast(1.35) brightness(0.95)';
    case 'golden-hour':
      return 'sepia(0.24) saturate(1.35) brightness(1.06)';
    case 'cyber-blue':
      return 'contrast(1.18) saturate(1.4) hue-rotate(-12deg)';
    default:
      return '';
  }
}

export function buildPhotoAdjustmentsFilterCss(adj?: ScenePhotoAdjustments): string {
  if (!adj) return '';
  const parts: string[] = [];
  const brightness = adj.brightness ?? DEFAULT_PHOTO_ADJUSTMENTS.brightness;
  const contrast = adj.contrast ?? DEFAULT_PHOTO_ADJUSTMENTS.contrast;
  const saturation = adj.saturation ?? DEFAULT_PHOTO_ADJUSTMENTS.saturation;
  const warmth = adj.warmth ?? DEFAULT_PHOTO_ADJUSTMENTS.warmth;
  const blur = adj.blur ?? DEFAULT_PHOTO_ADJUSTMENTS.blur;

  if (brightness !== 100) parts.push(`brightness(${(brightness / 100).toFixed(2)})`);
  if (contrast !== 100) parts.push(`contrast(${(contrast / 100).toFixed(2)})`);
  if (saturation !== 100) parts.push(`saturate(${(saturation / 100).toFixed(2)})`);
  if (warmth > 0) parts.push(`sepia(${(warmth / 100).toFixed(2)})`);
  if (blur > 0) parts.push(`blur(${blur.toFixed(1)}px)`);

  return parts.join(' ');
}

export function buildCombinedSceneFilterCss(
  scene: VideoScene | undefined,
  colorGrade?: ColorGradePreset
): string | undefined {
  const gradeCss = getColorGradeFilterCss(colorGrade);
  const photoCss = buildPhotoAdjustmentsFilterCss(scene?.photoAdjustments);
  const combined = [gradeCss, photoCss].filter(Boolean).join(' ').trim();
  return combined.length > 0 ? combined : undefined;
}

export function buildSceneTransformCss(scene: VideoScene | undefined): {
  transform: string | undefined;
  objectPosition: string;
  objectFit: 'cover' | 'contain';
  vignetteOpacity: number;
  focalX: number;
  focalY: number;
} {
  const t = scene?.transform;
  const rotation = t?.rotation ?? 0;
  const tilt = t?.tilt ?? 0;
  const totalDeg = rotation + tilt;
  const zoom = t?.zoom ?? 1;
  const flipH = t?.flipH ? -1 : 1;
  const flipV = t?.flipV ? -1 : 1;
  const fitMode = t?.fitMode || 'cover';

  const focalX = typeof scene?.focalPoint?.x === 'number' ? scene.focalPoint.x : 0.5;
  const focalY = typeof scene?.focalPoint?.y === 'number' ? scene.focalPoint.y : 0.45;

  const transformParts: string[] = [];
  if (totalDeg !== 0) transformParts.push(`rotate(${totalDeg}deg)`);
  if (zoom !== 1 || flipH !== 1 || flipV !== 1) {
    transformParts.push(`scale(${(zoom * flipH).toFixed(3)}, ${(zoom * flipV).toFixed(3)})`);
  }

  // Compense les marges si rotation/inclinaison légère sur mode cover pour éviter les bords noirs
  if (fitMode === 'cover' && tilt !== 0 && zoom === 1 && rotation % 180 === 0) {
    const rad = (Math.abs(tilt) * Math.PI) / 180;
    const autoScale = 1 + Math.sin(rad) * 0.45;
    transformParts.push(`scale(${autoScale.toFixed(3)})`);
  }

  const vignetteVal = scene?.photoAdjustments?.vignette ?? 0;

  return {
    transform: transformParts.length > 0 ? transformParts.join(' ') : undefined,
    objectPosition: `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%`,
    objectFit: fitMode,
    vignetteOpacity: Math.max(0, Math.min(0.85, vignetteVal / 100)),
    focalX,
    focalY,
  };
}

export function hasCustomPhotoEdits(scene: VideoScene | undefined): boolean {
  if (!scene) return false;
  const adj = scene.photoAdjustments;
  const t = scene.transform;
  const hasAdj = Boolean(
    adj &&
      ((adj.brightness !== undefined && adj.brightness !== 100) ||
        (adj.contrast !== undefined && adj.contrast !== 100) ||
        (adj.saturation !== undefined && adj.saturation !== 100) ||
        (adj.warmth !== undefined && adj.warmth !== 0) ||
        (adj.blur !== undefined && adj.blur !== 0) ||
        (adj.vignette !== undefined && adj.vignette !== 0))
  );
  const hasTrans = Boolean(
    t &&
      ((t.rotation !== undefined && t.rotation !== 0) ||
        (t.tilt !== undefined && t.tilt !== 0) ||
        t.flipH ||
        t.flipV ||
        (t.zoom !== undefined && t.zoom !== 1) ||
        (t.fitMode !== undefined && t.fitMode !== 'cover'))
  );
  return hasAdj || hasTrans;
}

export function hasCustomVideoEdits(scene: VideoScene | undefined): boolean {
  if (!scene) return false;
  return Boolean(
    (scene.playbackRate !== undefined && scene.playbackRate !== 1) ||
      (scene.trimStart !== undefined && scene.trimStart > 0) ||
      (scene.trimEnd !== undefined && scene.trimEnd > 0) ||
      (scene.overlay?.text && scene.overlay.text.trim().length > 0)
  );
}
