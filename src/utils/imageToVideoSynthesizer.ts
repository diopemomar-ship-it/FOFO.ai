import {
  AspectRatio,
  ColorGradePreset,
  ImageMotionIntensity,
  ImageMotionPreset,
} from '../types';

export interface SynthesizedClipResult {
  videoUrl: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

export interface BokehParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  hue: string;
  depth: number;
}

/**
 * Redimensionne proprement une image Data URL avant l'envoi vers l'API Vision IA
 * afin de garantir un transfert rapide et fiable même avec plusieurs photos HD smartphone.
 */
export async function resizeImageDataUrlForAI(
  dataUrl: string,
  maxDimension = 960
): Promise<string> {
  if (!dataUrl) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (!dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (
          !w ||
          !h ||
          (dataUrl.startsWith('data:image/') &&
            w <= maxDimension &&
            h <= maxDimension &&
            dataUrl.length < 320_000)
        ) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, maxDimension / Math.max(w, h));
        const targetW = Math.max(2, Math.round(w * scale));
        const targetH = Math.max(2, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function loadSourceImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image source"));
    img.src = url;
  });
}

export function getDimensionsForAspectRatio(aspectRatio: AspectRatio): { width: number; height: number } {
  if (aspectRatio === '16:9') return { width: 1280, height: 720 };
  if (aspectRatio === '4:5') return { width: 720, height: 900 };
  if (aspectRatio === '1:1') return { width: 720, height: 720 };
  return { width: 720, height: 1280 };
}

export function getColorGradeCss(colorGrade?: ColorGradePreset): string {
  if (colorGrade === 'teal-orange') return 'contrast(1.1) saturate(1.22) sepia(0.08)';
  if (colorGrade === 'noir-contrast') return 'grayscale(1) contrast(1.32) brightness(0.96)';
  if (colorGrade === 'golden-hour') return 'sepia(0.22) saturate(1.32) brightness(1.05)';
  if (colorGrade === 'cyber-blue') return 'contrast(1.16) saturate(1.38) hue-rotate(-12deg)';
  return 'none';
}

export function createBokehParticles(count: number, preset: ImageMotionPreset): BokehParticle[] {
  const palette =
    preset === 'orbit-3d' || preset === 'whip-pan'
      ? ['rgba(0, 210, 255,', 'rgba(221, 42, 123,', 'rgba(255, 255, 255,']
      : preset === 'ken-burns-drama' || preset === 'drone-flyover' || preset === 'cine-reveal'
      ? ['rgba(251, 191, 36,', 'rgba(255, 237, 213,', 'rgba(255, 255, 255,']
      : ['rgba(125, 211, 252,', 'rgba(196, 181, 253,', 'rgba(255, 255, 255,'];

  const particles: BokehParticle[] = [];
  for (let i = 0; i < count; i++) {
    // Distribution déterministe lissée pour éviter tout scintillement lors des aperçus live
    const seedA = Math.sin(i * 12.9898) * 43758.5453;
    const seedB = Math.sin((i + 17) * 78.233) * 19341.123;
    const randA = seedA - Math.floor(seedA);
    const randB = seedB - Math.floor(seedB);
    const depth = 0.5 + (i % 5) * 0.22;
    particles.push({
      x: randA,
      y: randB,
      vx: (randA - 0.5) * 0.09 * depth,
      vy: (-0.035 - randB * 0.085) * depth,
      radius: (1.4 + (i % 4) * 1.15) * depth,
      alpha: 0.14 + (i % 6) * 0.055,
      hue: palette[i % palette.length],
      depth,
    });
  }
  return particles;
}

export interface AnimatedFrameOptions {
  t: number; // 0..1 normalized progress
  width: number;
  height: number;
  motionPreset: ImageMotionPreset;
  intensity: ImageMotionIntensity;
  focalPoint: { x: number; y: number };
  colorGrade?: ColorGradePreset;
  particles?: BokehParticle[];
  enableParticles?: boolean;
  enableLightRays?: boolean;
}

/**
 * Moteur de rendu 2.5D temps réel partagé entre l'aperçu Live 60fps et l'encodeur vidéo MP4/WebM.
 * Gère un double plan profondeur (arrière-plan ambiant + sujet focal) pour un véritable effet Dolly/Parallaxe.
 */
export function renderAnimatedImageFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  opts: AnimatedFrameOptions
): void {
  const {
    t,
    width,
    height,
    motionPreset,
    intensity,
    focalPoint,
    colorGrade = 'natural',
    particles = [],
    enableParticles = true,
    enableLightRays = true,
  } = opts;

  const intensityMul = intensity === 'subtle' ? 0.6 : intensity === 'intense' ? 1.45 : 1.0;
  const fx = Math.max(0.2, Math.min(0.8, focalPoint?.x ?? 0.5));
  const fy = Math.max(0.2, Math.min(0.8, focalPoint?.y ?? 0.45));
  const cssFilter = getColorGradeCss(colorGrade);

  const imgAspect = (img.naturalWidth || img.width || 1) / (img.naturalHeight || img.height || 1);
  const canvasAspect = width / height;
  let coverW = width;
  let coverH = height;
  if (imgAspect > canvasAspect) {
    coverW = height * imgAspect;
  } else {
    coverH = width / imgAspect;
  }
  const baseOffsetX = (width - coverW) * fx;
  const baseOffsetY = (height - coverH) * fy;

  const easeInOut = 0.5 - 0.5 * Math.cos(Math.PI * t);
  const smoothCurve = t * t * (3 - 2 * t);

  let scale = 1.08;
  let bgScale = 1.16;
  let tx = 0;
  let ty = 0;
  let bgTx = 0;
  let bgTy = 0;
  let rot = 0;
  let focusPullBlur = 0;

  if (motionPreset === 'orbit-3d') {
    scale = 1.12 + 0.09 * intensityMul * Math.sin(t * Math.PI);
    bgScale = 1.24 + 0.05 * intensityMul * Math.cos(t * Math.PI);
    tx = Math.sin(t * Math.PI * 2) * width * 0.048 * intensityMul;
    ty = Math.cos(t * Math.PI * 1.5) * height * 0.028 * intensityMul;
    bgTx = -tx * 0.55;
    bgTy = -ty * 0.55;
    rot = Math.sin(t * Math.PI * 2) * 0.026 * intensityMul;
  } else if (motionPreset === 'dolly-zoom') {
    // Véritable contre-zoom Hitchcock : le sujet avance, l'arrière-plan s'éloigne en sens inverse
    scale = 1.05 + 0.24 * intensityMul * easeInOut;
    bgScale = 1.38 - 0.22 * intensityMul * easeInOut;
    tx = (0.5 - fx) * width * 0.14 * easeInOut * intensityMul;
    ty = (0.5 - fy) * height * 0.14 * easeInOut * intensityMul;
    bgTx = -tx * 0.7;
    bgTy = -ty * 0.7;
    rot = (t - 0.5) * 0.015 * intensityMul;
  } else if (motionPreset === 'parallax-depth') {
    scale = 1.15 + 0.07 * intensityMul * easeInOut;
    bgScale = 1.26;
    tx = (t - 0.5) * -width * 0.095 * intensityMul;
    ty = Math.sin(t * Math.PI) * height * 0.025 * intensityMul;
    bgTx = (t - 0.5) * width * 0.055 * intensityMul;
    bgTy = -ty * 0.5;
    rot = Math.sin(t * Math.PI) * 0.012 * intensityMul;
  } else if (motionPreset === 'drone-flyover') {
    scale = 1.26 - 0.17 * intensityMul * easeInOut;
    bgScale = 1.32 - 0.1 * intensityMul * easeInOut;
    tx = Math.sin(t * Math.PI) * width * 0.042 * intensityMul;
    ty = (0.5 - t) * height * 0.075 * intensityMul;
    bgTx = tx * 0.5;
    bgTy = ty * 0.45;
    rot = Math.cos(t * Math.PI) * 0.014 * intensityMul;
  } else if (motionPreset === 'whip-pan') {
    const pulse = Math.abs(Math.sin(t * Math.PI * 3));
    scale = 1.1 + 0.14 * intensityMul * pulse + 0.08 * t;
    bgScale = scale + 0.12;
    tx = Math.sin(t * Math.PI * 4) * width * 0.036 * intensityMul;
    ty = Math.cos(t * Math.PI * 3) * height * 0.022 * intensityMul;
    bgTx = -tx * 0.6;
    bgTy = -ty * 0.4;
    rot = Math.sin(t * Math.PI * 4) * 0.024 * intensityMul;
  } else if (motionPreset === 'float-breathing') {
    // Mouvement organique vivant idéal pour portraits & produits
    const breath = Math.sin(t * Math.PI * 2);
    const sway = Math.cos(t * Math.PI * 2);
    scale = 1.07 + 0.045 * intensityMul * (0.5 + 0.5 * breath);
    bgScale = 1.18 + 0.02 * intensityMul * sway;
    tx = Math.sin(t * Math.PI * 2) * width * 0.016 * intensityMul;
    ty = Math.sin(t * Math.PI * 4) * height * 0.012 * intensityMul;
    bgTx = -tx * 0.4;
    bgTy = -ty * 0.4;
    rot = Math.sin(t * Math.PI * 2) * 0.008 * intensityMul;
  } else if (motionPreset === 'cine-reveal') {
    // Mise au point optique progressive + avancée théâtrale
    scale = 1.18 - 0.09 * intensityMul * smoothCurve;
    bgScale = 1.28;
    tx = (0.5 - t) * width * 0.045 * intensityMul;
    ty = (1 - smoothCurve) * height * 0.03 * intensityMul;
    focusPullBlur = Math.max(0, (1 - Math.min(1, t * 2.2)) * 6.5 * intensityMul);
    rot = (1 - smoothCurve) * 0.014 * intensityMul;
  } else {
    // ken-burns-drama
    scale = 1.05 + 0.16 * intensityMul * easeInOut;
    bgScale = 1.16 + 0.08 * intensityMul * easeInOut;
    tx = (t - 0.5) * width * 0.045 * intensityMul;
    ty = (t - 0.5) * -height * 0.032 * intensityMul;
    bgTx = -tx * 0.35;
    bgTy = -ty * 0.35;
    rot = 0;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#05070C';
  ctx.fillRect(0, 0, width, height);

  // Plan 1 : Arrière-plan profondeur 2.5D (élimine toute bordure noire et renforce la parallaxe)
  ctx.save();
  ctx.translate(width * 0.5 + bgTx, height * 0.5 + bgTy);
  ctx.scale(bgScale, bgScale);
  ctx.translate(-width * 0.5, -height * 0.5);
  ctx.filter = cssFilter !== 'none' ? `${cssFilter} blur(14px) brightness(0.86)` : 'blur(14px) brightness(0.86)';
  ctx.drawImage(img, baseOffsetX, baseOffsetY, coverW, coverH);
  ctx.filter = 'none';
  ctx.restore();

  // Plan 2 : Sujet focal animé avec masque radial doux pour parallaxe 2.5D naturelle
  ctx.save();
  if (motionPreset === 'dolly-zoom' || motionPreset === 'parallax-depth') {
    ctx.beginPath();
    ctx.ellipse(
      width * fx + tx * 0.4,
      height * fy + ty * 0.4,
      width * 0.58,
      height * 0.58,
      0,
      0,
      Math.PI * 2
    );
    ctx.clip();
  }
  ctx.translate(width * fx + tx, height * fy + ty);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-width * fx, -height * fy);

  const activeBlurFilter = focusPullBlur > 0.2 ? `blur(${focusPullBlur.toFixed(1)}px)` : '';
  const combinedFilter = [cssFilter !== 'none' ? cssFilter : '', activeBlurFilter]
    .filter(Boolean)
    .join(' ');
  if (combinedFilter) {
    ctx.filter = combinedFilter;
  }
  ctx.drawImage(img, baseOffsetX, baseOffsetY, coverW, coverH);
  ctx.filter = 'none';
  ctx.restore();

  // Rayons volumétriques & balayage lumineux cinématique
  if (enableLightRays) {
    ctx.save();
    const sweepX = width * (-0.3 + t * 1.6);
    const flare = ctx.createRadialGradient(
      sweepX,
      height * 0.26,
      10,
      sweepX,
      height * 0.26,
      width * 0.78
    );
    const tint =
      motionPreset === 'ken-burns-drama' || motionPreset === 'cine-reveal'
        ? 'rgba(251, 191, 36, 0.14)'
        : motionPreset === 'float-breathing'
        ? 'rgba(244, 114, 182, 0.10)'
        : 'rgba(0, 210, 255, 0.10)';
    flare.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    flare.addColorStop(0.45, tint);
    flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, width, height);

    if (motionPreset === 'whip-pan') {
      const streakAlpha = Math.abs(Math.sin(t * Math.PI * 4)) * 0.16 * intensityMul;
      const streak = ctx.createLinearGradient(0, 0, width, 0);
      streak.addColorStop(0, `rgba(0, 210, 255, ${streakAlpha.toFixed(2)})`);
      streak.addColorStop(0.5, 'rgba(0,0,0,0)');
      streak.addColorStop(1, `rgba(221, 42, 123, ${streakAlpha.toFixed(2)})`);
      ctx.fillStyle = streak;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  // Particules bokeh / braises en parallaxe profondeur
  if (enableParticles && particles.length > 0) {
    ctx.save();
    for (const p of particles) {
      const px = ((p.x + p.vx * t * 3.8 + 4) % 1) * width;
      const py = ((p.y + p.vy * t * 3.8 + 4) % 1) * height;
      const pulseAlpha = p.alpha * (0.75 + 0.25 * Math.sin(t * Math.PI * 2 + p.x * 10));
      ctx.fillStyle = `${p.hue}${pulseAlpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Vignette optique douce centrée sur le point focal
  ctx.save();
  const vig = ctx.createRadialGradient(
    width * fx,
    height * fy,
    width * 0.24,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.8
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.44)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Synthétise véritablement une image fixe en un clip vidéo animé (MP4 / WebM)
 * avec mouvement caméra 2.5D/3D guidé par le point focal Vision IA, particules bokeh,
 * balayage lumineux volumétrique et étalonnage cinématique.
 */
export async function synthesizeImageToVideoClip(params: {
  imageUrl: string;
  motionPreset?: ImageMotionPreset;
  intensity?: ImageMotionIntensity;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;
  focalPoint?: { x: number; y: number };
  colorGrade?: ColorGradePreset;
  enableParticles?: boolean;
  enableLightRays?: boolean;
  onProgress?: (pct: number) => void;
}): Promise<SynthesizedClipResult> {
  const {
    imageUrl,
    motionPreset = 'orbit-3d',
    intensity = 'cinematic',
    aspectRatio = '9:16',
    durationSeconds = 5,
    focalPoint = { x: 0.5, y: 0.45 },
    colorGrade = 'natural',
    enableParticles = true,
    enableLightRays = true,
    onProgress,
  } = params;

  onProgress?.(5);
  const img = await loadSourceImage(imageUrl);
  const { width, height } = getDimensionsForAspectRatio(aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexte Canvas 2D indisponible pour la synthèse vidéo.');
  }

  const safeDuration = Math.min(8, Math.max(3, Math.round(durationSeconds)));
  const fps = 30;
  const totalFrames = safeDuration * fps;

  const stream = canvas.captureStream(fps);
  let mimeType = 'video/webm';
  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 7_500_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const particles = createBokehParticles(motionPreset === 'parallax-depth' ? 30 : 20, motionPreset);

  return new Promise<SynthesizedClipResult>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Erreur lors de l'encodage du clip vidéo IA."));
    recorder.onstop = () => {
      const outputType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
      const blob = new Blob(chunks, { type: outputType });
      const videoUrl = URL.createObjectURL(blob);
      onProgress?.(100);
      resolve({
        videoUrl,
        blob,
        mimeType: outputType,
        durationSeconds: safeDuration,
      });
    };

    recorder.start();

    let frame = 0;
    const renderNextFrame = () => {
      if (frame >= totalFrames) {
        try {
          recorder.stop();
        } catch (err) {
          reject(err);
        }
        return;
      }

      const t = frame / Math.max(1, totalFrames - 1);
      renderAnimatedImageFrame(ctx, img, {
        t,
        width,
        height,
        motionPreset,
        intensity,
        focalPoint,
        colorGrade,
        particles,
        enableParticles,
        enableLightRays,
      });

      frame++;
      onProgress?.(Math.min(95, Math.round(10 + (frame / totalFrames) * 85)));
      setTimeout(renderNextFrame, 1000 / fps);
    };

    renderNextFrame();
  });
}
