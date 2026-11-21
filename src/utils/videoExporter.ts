import { AspectRatio, GeneratedVideo, VideoScene } from '../types';
import {
  DEFAULT_KARAOKE_HIGHLIGHT_COLOR,
  getTransitionIntensityConfig,
} from '../data/mockTemplates';
import { playSfxOnContext, playTransitionSfxOnContext } from './audioEngine';
import { buildCombinedSceneFilterCss } from './mediaTransforms';

export interface ExportProgress {
  progress: number; // 0 to 100
  status: string;
  isCompleted: boolean;
}

export async function exportVideoFile(
  video: GeneratedVideo,
  isPro: boolean,
  onProgress?: (p: ExportProgress) => void,
  exportQuality: '1080p-30' | '4k-60' = '1080p-30',
  audioMix: {
    voiceVolume: number;
    musicVolume: number;
    autoDucking?: boolean;
    duckingIntensity?: number;
  } = { voiceVolume: 1.0, musicVolume: 0.25 },
  targetAspectRatio?: AspectRatio
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const is4k60 = exportQuality === '4k-60' && isPro;
      const effectiveRatio: AspectRatio = targetAspectRatio || video.aspectRatio || '9:16';
      onProgress?.({
        progress: 5,
        status: is4k60
          ? `Initialisation du moteur Ultra HD 4K 60 FPS (${effectiveRatio})...`
          : `Préparation du moteur de rendu vidéo (${effectiveRatio})...`,
        isCompleted: false,
      });

      // Résolution logique de base selon le format d'exportation choisi
      let baseWidth = 720;
      let baseHeight = 1280; // Portrait 9:16 par défaut
      if (effectiveRatio === '16:9') {
        baseWidth = 1280;
        baseHeight = 720;
      } else if (effectiveRatio === '4:5') {
        baseWidth = 720;
        baseHeight = 900;
      } else if (effectiveRatio === '1:1') {
        baseWidth = 720;
        baseHeight = 720;
      }

      const resScale = is4k60 ? 2 : 1; // 1440x2560 / 2560x1440 Ultra HD safe canvas
      const width = baseWidth;
      const height = baseHeight;

      const canvas = document.createElement('canvas');
      canvas.width = baseWidth * resScale;
      canvas.height = baseHeight * resScale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible de créer le contexte Canvas 2D');
      if (resScale !== 1) {
        ctx.scale(resScale, resScale);
      }

      onProgress?.({ progress: 15, status: 'Chargement des visuels haute définition...', isCompleted: false });

      // Préchargement de toutes les images (et clips vidéo animés pour les scènes mediaType === 'video')
      const loadedImages: HTMLImageElement[] = [];
      const loadedVideos: Array<HTMLVideoElement | null> = [];
      for (let i = 0; i < video.scenes.length; i++) {
        const scene = video.scenes[i];

        if (scene.mediaType === 'video' && scene.videoUrl) {
          const vidEl = document.createElement('video');
          vidEl.muted = true;
          vidEl.playsInline = true;
          vidEl.loop = true;
          vidEl.preload = 'auto';
          if (!scene.videoUrl.startsWith('data:') && !scene.videoUrl.startsWith('blob:')) {
            vidEl.crossOrigin = 'anonymous';
          }
          vidEl.src = scene.videoUrl;
          await new Promise<void>((vidResolve) => {
            const timer = setTimeout(() => vidResolve(), 2500);
            vidEl.onloadeddata = () => {
              clearTimeout(timer);
              vidResolve();
            };
            vidEl.onerror = () => {
              clearTimeout(timer);
              vidResolve();
            };
          });
          loadedVideos.push(vidEl.readyState >= 2 ? vidEl : null);
        } else {
          loadedVideos.push(null);
        }

        const img = new Image();
        if (!scene.imageUrl.startsWith('data:') && !scene.imageUrl.startsWith('blob:')) {
          img.crossOrigin = 'anonymous';
        }
        await new Promise<void>((imgResolve) => {
          img.onload = () => {
            loadedImages.push(img);
            imgResolve();
          };
          img.onerror = () => {
            // Créer une image de secours élégante sur canvas si l'URL externe échoue
            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = width;
            fallbackCanvas.height = height;
            const fCtx = fallbackCanvas.getContext('2d');
            if (fCtx) {
              const grad = fCtx.createLinearGradient(0, 0, width, height);
              grad.addColorStop(0, '#0B0F19');
              grad.addColorStop(0.5, '#1E293B');
              grad.addColorStop(1, '#0284C7');
              fCtx.fillStyle = grad;
              fCtx.fillRect(0, 0, width, height);
              fCtx.fillStyle = '#FFFFFF';
              fCtx.font = '600 34px "Outfit", "Plus Jakarta Sans", sans-serif';
              fCtx.textAlign = 'center';
              fCtx.fillText(`FOFO AI · Scène ${scene.sceneNumber}`, width / 2, height / 2);
            }
            const fallbackImg = new Image();
            fallbackImg.src = fallbackCanvas.toDataURL();
            fallbackImg.onload = () => {
              loadedImages.push(fallbackImg);
              imgResolve();
            };
          };
          img.src = scene.imageUrl;
        });
        const p = Math.round(15 + ((i + 1) / video.scenes.length) * 20);
        onProgress?.({ progress: p, status: `Optimisation de la scène ${i + 1}/${video.scenes.length}...`, isCompleted: false });
      }

      // Configuration Audio avec Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();

      // Génération d'une nappe sonore musicale d'ambiance adaptée au son choisi
      const osc = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const musicGain = audioCtx.createGain();
      osc.type =
        video.musicMood === 'phonk-drift' || video.musicMood === 'synthwave-reels'
          ? 'sawtooth'
          : 'sine';
      osc2.type = 'triangle';
      const baseFreqMap: Record<string, [number, number]> = {
        suspense: [55, 110],
        'phonk-drift': [73.42, 146.83],
        'afro-amapiano': [110, 164.81],
        'trap-motivation': [55, 164.81],
        'synthwave-reels': [110, 220],
        'piano-story': [130.81, 261.63],
        dynamic: [130.81, 261.63],
        lofi: [146.83, 220],
        ambient: [82.41, 164.81],
        epic: [110, 220],
      };
      const [f1, f2] = baseFreqMap[video.musicMood] || [110, 220];
      osc.frequency.setValueAtTime(f1, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(f2, audioCtx.currentTime);
      const exportMusicLevel = Math.max(0, Math.min(1, audioMix?.musicVolume ?? 0.25)) * 0.35;
      const duckEnabled = audioMix.autoDucking ?? (video.autoDucking !== false);
      const duckReduction = Math.max(0, Math.min(0.92, audioMix.duckingIntensity ?? video.duckingIntensity ?? 0.6));
      const firstScene = video.scenes[0];
      const firstSceneHasVoice =
        Boolean(firstScene?.voiceoverText?.trim()) &&
        firstScene?.voiceEnabled !== false &&
        (audioMix.voiceVolume ?? 1) > 0;
      const initialGain =
        duckEnabled && firstSceneHasVoice
          ? exportMusicLevel * Math.max(0.08, 1 - duckReduction)
          : exportMusicLevel;
      musicGain.gain.setValueAtTime(initialGain, audioCtx.currentTime);
      osc.connect(musicGain);
      osc2.connect(musicGain);
      musicGain.connect(dest);
      osc.start();
      osc2.start();

      // Configuration MediaRecorder avec stream combiné vidéo + audio
      const targetFps = is4k60 ? 60 : 30;
      const videoStream = canvas.captureStream(targetFps);
      const combinedTracks = [...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const combinedStream = new MediaStream(combinedTracks);

      let mimeType = 'video/mp4';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a')) {
        mimeType = 'video/mp4;codecs=avc1,mp4a';
      } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: is4k60 ? 16000000 : isPro ? 8000000 : 4000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          loadedVideos.forEach((v) => {
            if (v) {
              v.pause();
              v.src = '';
            }
          });
          osc.stop();
          osc2.stop();
          audioCtx.close();
        } catch (e) {
          // ignore
        }
        const blob = new Blob(chunks, { type: 'video/mp4' });
        onProgress?.({
          progress: 100,
          status: is4k60
            ? 'Exportation Ultra HD 4K 60 FPS terminée sans filigrane !'
            : 'Exportation MP4 terminée avec succès !',
          isCompleted: true,
        });
        resolve(blob);
      };

      mediaRecorder.start();

      // Animation & Rendu Canvas scène par scène
      const FPS = targetFps;
      let currentSceneIdx = 0;
      const totalFramesPerScene = is4k60 ? 75 : 45; // Fluide 60 FPS
      let frameInScene = 0;
      const totalScenes = video.scenes.length;

      const renderLoop = () => {
        if (currentSceneIdx >= totalScenes) {
          mediaRecorder.stop();
          return;
        }

        const scene = video.scenes[currentSceneIdx];
        const img = loadedImages[currentSceneIdx];
        const activeVid = loadedVideos[currentSceneIdx];
        const prevImg = currentSceneIdx > 0 ? loadedImages[currentSceneIdx - 1] : null;
        const progressInScene = frameInScene / totalFramesPerScene;
        const transitionType = scene.transition || video.defaultTransition || 'fade';
        const transitionIntensity = scene.transitionIntensity || video.transitionIntensity || 'normal';
        const intensityCfg = getTransitionIntensityConfig(transitionIntensity);

        // Démarrer la lecture du clip vidéo animé et ajuster le ducking audio automatique pour cette scène
        if (frameInScene === 0) {
          const voiceActiveOnScene =
            Boolean(scene.voiceoverText && scene.voiceoverText.trim().length > 0) &&
            scene.voiceEnabled !== false &&
            (audioMix.voiceVolume ?? 1) > 0;
          const sceneMusicLevel =
            duckEnabled && voiceActiveOnScene
              ? exportMusicLevel * Math.max(0.08, 1 - duckReduction)
              : exportMusicLevel;
          musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
          musicGain.gain.setValueAtTime(musicGain.gain.value, audioCtx.currentTime);
          musicGain.gain.linearRampToValueAtTime(sceneMusicLevel, audioCtx.currentTime + 0.18);

          loadedVideos.forEach((v, idx) => {
            if (!v) return;
            if (idx === currentSceneIdx) {
              try {
                const startSec = Math.max(0, scene.trimStart ?? 0);
                v.playbackRate = scene.playbackRate ?? 1.0;
                v.currentTime = startSec;
                v.play().catch(() => {});
              } catch {
                // ignore
              }
            } else {
              try {
                v.pause();
              } catch {
                // ignore
              }
            }
          });
        } else if (activeVid && activeVid.readyState >= 2) {
          const trimStartSec = Math.max(0, scene.trimStart ?? 0);
          const trimEndSec = scene.trimEnd && scene.trimEnd > trimStartSec ? scene.trimEnd : 0;
          if (trimEndSec > 0 && activeVid.currentTime >= trimEndSec) {
            try {
              activeVid.currentTime = trimStartSec;
            } catch {
              // ignore
            }
          }
        }

        // Déclencher le son d'intro Hook SFX au démarrage de la Scène 1 si configuré
        if (
          frameInScene === 0 &&
          currentSceneIdx === 0 &&
          video.hookSfx &&
          video.hookSfx !== 'none' &&
          (audioMix.voiceVolume > 0 || audioMix.musicVolume > 0)
        ) {
          playSfxOnContext(
            audioCtx,
            dest,
            video.hookSfx,
            Math.max(0.45, audioMix.voiceVolume || 0.75)
          );
        }

        // Déclencher l'effet sonore de transition au changement de scène dans le flux audio exporté
        if (
          frameInScene === 0 &&
          currentSceneIdx > 0 &&
          video.autoTransitionSfx !== false &&
          (audioMix.voiceVolume > 0 || audioMix.musicVolume > 0)
        ) {
          playTransitionSfxOnContext(
            audioCtx,
            dest,
            transitionType,
            Math.max(0.35, audioMix.voiceVolume || 0.7),
            transitionIntensity
          );
        }

        // Durée de la transition en frames calibrée sur l'intensité choisie et le FPS
        const TRANSITION_FRAMES = Math.min(
          totalFramesPerScene - 2,
          Math.max(3, Math.round(intensityCfg.durationSec * FPS))
        );
        const isTransitioning = currentSceneIdx > 0 && frameInScene < TRANSITION_FRAMES && transitionType !== 'cut';
        const transitionProgress = isTransitioning ? frameInScene / TRANSITION_FRAMES : 1.0;
        const easedTransitionProgress = 1 - Math.pow(1 - transitionProgress, 3);

        ctx.save();
        ctx.fillStyle = '#07090E';
        ctx.fillRect(0, 0, width, height);

        const drawMediaFrame = (
          mediaEl: HTMLImageElement | HTMLVideoElement,
          targetScene: VideoScene,
          extraScale = 1,
          extraTransX = 0,
          extraTransY = 0
        ) => {
          const isVidEl = typeof HTMLVideoElement !== 'undefined' && mediaEl instanceof HTMLVideoElement;
          const mediaW = isVidEl ? mediaEl.videoWidth || width : (mediaEl as HTMLImageElement).width || width;
          const mediaH = isVidEl ? mediaEl.videoHeight || height : (mediaEl as HTMLImageElement).height || height;
          const mediaAspect = mediaW / Math.max(1, mediaH);
          const canvasAspect = width / height;

          const fitMode = targetScene.transform?.fitMode || 'cover';
          const focalX = typeof targetScene.focalPoint?.x === 'number' ? targetScene.focalPoint.x : 0.5;
          const focalY = typeof targetScene.focalPoint?.y === 'number' ? targetScene.focalPoint.y : 0.45;
          const rotation = targetScene.transform?.rotation ?? 0;
          const tilt = targetScene.transform?.tilt ?? 0;
          const zoom = targetScene.transform?.zoom ?? 1;
          const flipH = targetScene.transform?.flipH ? -1 : 1;
          const flipV = targetScene.transform?.flipV ? -1 : 1;
          const filterCss = buildCombinedSceneFilterCss(targetScene, video.colorGrade);

          // Fond flouté si mode "Cadre entier" (contain)
          if (fitMode === 'contain') {
            let bgW = width;
            let bgH = height;
            let bgX = 0;
            let bgY = 0;
            if (mediaAspect > canvasAspect) {
              bgW = height * mediaAspect;
              bgX = (width - bgW) / 2;
            } else {
              bgH = width / mediaAspect;
              bgY = (height - bgH) / 2;
            }
            ctx.save();
            ctx.filter = 'blur(18px) brightness(0.55)';
            ctx.drawImage(mediaEl, bgX, bgY, bgW, bgH);
            ctx.filter = 'none';
            ctx.restore();
          }

          ctx.save();
          ctx.translate(width / 2 + extraTransX, height / 2 + extraTransY);
          const totalRad = ((rotation + tilt) * Math.PI) / 180;
          if (totalRad !== 0) {
            ctx.rotate(totalRad);
          }
          const tiltCompensation =
            fitMode === 'cover' && tilt !== 0 && zoom === 1 && rotation % 180 === 0
              ? 1 + Math.sin((Math.abs(tilt) * Math.PI) / 180) * 0.45
              : 1;
          ctx.scale(extraScale * zoom * flipH * tiltCompensation, extraScale * zoom * flipV * tiltCompensation);
          ctx.translate(-width / 2, -height / 2);

          if (filterCss) {
            ctx.filter = filterCss;
          }

          let drawW = width;
          let drawH = height;
          let offsetX = 0;
          let offsetY = 0;

          if (fitMode === 'contain') {
            if (mediaAspect > canvasAspect) {
              drawW = width;
              drawH = width / mediaAspect;
              offsetY = (height - drawH) / 2;
            } else {
              drawH = height;
              drawW = height * mediaAspect;
              offsetX = (width - drawW) / 2;
            }
          } else {
            if (mediaAspect > canvasAspect) {
              drawW = height * mediaAspect;
              offsetX = (width - drawW) * focalX;
            } else {
              drawH = width / mediaAspect;
              offsetY = (height - drawH) * focalY;
            }
          }

          ctx.drawImage(mediaEl, offsetX, offsetY, drawW, drawH);
          ctx.filter = 'none';
          ctx.restore();
        };

        // Si transition par glissement (slide)
        if (isTransitioning && transitionType === 'slide' && prevImg) {
          const prevSceneObj = video.scenes[currentSceneIdx - 1] || scene;
          const prevSlideX = -width * easedTransitionProgress;
          ctx.save();
          ctx.translate(prevSlideX, 0);
          drawMediaFrame(prevImg, prevSceneObj);
          ctx.restore();

          const newSlideX = width * (1.0 - easedTransitionProgress);
          ctx.save();
          ctx.translate(newSlideX, 0);
          const useVidSlide = activeVid && activeVid.readyState >= 2 && activeVid.videoWidth > 0;
          drawMediaFrame(useVidSlide ? activeVid : img, scene);
          ctx.restore();
        } else {
          // Si transition en fondu (fade) avec image précédente en sous-couche
          if (isTransitioning && transitionType === 'fade' && prevImg) {
            const prevSceneObj = video.scenes[currentSceneIdx - 1] || scene;
            ctx.save();
            drawMediaFrame(prevImg, prevSceneObj);
            ctx.restore();
          }

          // Effet Ken Burns (zoom progressif)
          let scale = 1.0 + progressInScene * 0.12;
          let transX = 0;
          let transY = 0;
          if (scene.kenBurnsEffect === 'zoom-out') {
            scale = 1.15 - progressInScene * 0.12;
          } else if (scene.kenBurnsEffect === 'pan-right') {
            transX = progressInScene * 30;
          } else if (scene.kenBurnsEffect === 'pan-left') {
            transX = -progressInScene * 30;
          }

          if (isTransitioning && transitionType === 'zoom') {
            const zoomStart = intensityCfg.zoomScale;
            scale = scale * (zoomStart - (zoomStart - 1.0) * easedTransitionProgress);
          }

          const activeTrendEffectForTransform = scene.trendingEffect || video.trendingEffect || 'none';
          if (video.beatPulse || activeTrendEffectForTransform === 'zoom-punch') {
            const beatDivisor = activeTrendEffectForTransform === 'zoom-punch' ? 0.65 : 0.85;
            const pulseCycle =
              (frameInScene % Math.max(10, Math.round(FPS * beatDivisor))) /
              Math.max(10, Math.round(FPS * beatDivisor));
            if (pulseCycle < 0.25) {
              scale = scale * (1 + (0.25 - pulseCycle) * (activeTrendEffectForTransform === 'zoom-punch' ? 0.22 : 0.14));
            }
          }

          if (isTransitioning && transitionType === 'fade') {
            ctx.globalAlpha = transitionProgress;
          }

          const useVideoSource = activeVid && activeVid.readyState >= 2 && activeVid.videoWidth > 0;
          drawMediaFrame(useVideoSource ? activeVid : img, scene, scale, transX, transY);
        }

        ctx.restore();

        // Vignettage photo personnalisé par scène si configuré
        const vignetteStrength = scene.photoAdjustments?.vignette ?? 0;
        if (vignetteStrength > 0) {
          ctx.save();
          const vGrad = ctx.createRadialGradient(
            width / 2,
            height / 2,
            Math.min(width, height) * 0.28,
            width / 2,
            height / 2,
            Math.max(width, height) * 0.72
          );
          vGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vGrad.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, vignetteStrength / 100).toFixed(2)})`);
          ctx.fillStyle = vGrad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }

        // Rendu des effets de tendance viraux sur le Canvas exporté
        const activeTrendEffect = scene.trendingEffect || video.trendingEffect || 'none';
        if (activeTrendEffect === 'vhs-retro') {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 60, 140, 0.08)';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
          for (let y = 0; y < height; y += 6) {
            ctx.fillRect(0, y, width, 2);
          }
          ctx.restore();
        } else if (activeTrendEffect === 'rgb-glitch' && frameInScene % 18 < 3) {
          ctx.save();
          ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
          ctx.fillRect(0, (frameInScene * 37) % height, width, 18);
          ctx.fillStyle = 'rgba(255, 0, 128, 0.14)';
          ctx.fillRect(0, ((frameInScene * 61) + 120) % height, width, 12);
          ctx.restore();
        } else if (activeTrendEffect === 'neon-cyber') {
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 210, 255, 0.65)';
          ctx.lineWidth = 6;
          ctx.strokeRect(14, 14, width - 28, height - 28);
          ctx.restore();
        } else if (activeTrendEffect === 'cinema-bars') {
          const barH = Math.round(height * 0.09);
          ctx.save();
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, barH);
          ctx.fillRect(0, height - barH, width, barH);
          ctx.restore();
        } else if (activeTrendEffect === 'prism-glow') {
          ctx.save();
          const prismGrad = ctx.createLinearGradient(0, 0, width, height * 0.65);
          prismGrad.addColorStop(0, 'rgba(0, 210, 255, 0.25)');
          prismGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.14)');
          prismGrad.addColorStop(1, 'rgba(251, 191, 36, 0.18)');
          ctx.fillStyle = prismGrad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        } else if (activeTrendEffect === 'flash-beat' && frameInScene % 16 < 2) {
          ctx.save();
          ctx.fillStyle = frameInScene % 16 === 0 ? 'rgba(255, 255, 255, 0.42)' : 'rgba(255, 255, 255, 0.18)';
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        } else if (activeTrendEffect === 'camcorder-rec') {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 2;
          const m = 24;
          const arm = 26;
          ctx.beginPath();
          ctx.moveTo(m, m + arm); ctx.lineTo(m, m); ctx.lineTo(m + arm, m);
          ctx.moveTo(width - m - arm, m); ctx.lineTo(width - m, m); ctx.lineTo(width - m, m + arm);
          ctx.moveTo(m, height - m - arm); ctx.lineTo(m, height - m); ctx.lineTo(m + arm, height - m);
          ctx.moveTo(width - m - arm, height - m); ctx.lineTo(width - m, height - m); ctx.lineTo(width - m, height - m - arm);
          ctx.stroke();
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(46, 86, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 16px "JetBrains Mono", monospace';
          ctx.fillText(`REC 00:${String(currentSceneIdx + 1).padStart(2, '0')}`, 62, 92);
          ctx.restore();
        } else if (activeTrendEffect === 'spotlight-vignette') {
          ctx.save();
          const spot = ctx.createRadialGradient(
            width / 2,
            height * 0.42,
            width * 0.18,
            width / 2,
            height * 0.42,
            width * 0.72
          );
          spot.addColorStop(0, 'rgba(0,0,0,0)');
          spot.addColorStop(1, 'rgba(0,0,0,0.82)');
          ctx.fillStyle = spot;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        } else if (activeTrendEffect === 'speed-blur') {
          ctx.save();
          const blurGrad = ctx.createLinearGradient(0, 0, width, 0);
          blurGrad.addColorStop(0, 'rgba(0, 210, 255, 0.22)');
          blurGrad.addColorStop(0.2, 'rgba(0, 0, 0, 0)');
          blurGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
          blurGrad.addColorStop(1, 'rgba(221, 42, 123, 0.22)');
          ctx.fillStyle = blurGrad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }

        // Dégradé sombre en bas pour lisibilité optimale des sous-titres
        const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
        grad.addColorStop(0, 'rgba(7, 9, 14, 0)');
        grad.addColorStop(0.5, 'rgba(7, 9, 14, 0.7)');
        grad.addColorStop(1, 'rgba(7, 9, 14, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height * 0.55, width, height * 0.45);

        // Rendu des sous-titres dynamiques
        const words = scene.voiceoverText.trim().split(/\s+/).filter(Boolean);
        const activeWordCount = Math.max(1, Math.min(words.length, Math.floor(progressInScene * words.length) + 1));
        const wordsToShow = words.slice(Math.max(0, activeWordCount - 5), activeWordCount).join(' ');

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const captionY = height * 0.78;
        const captionMaxWidth = width * 0.88;

        if (video.captionStyle === 'hormozi') {
          ctx.font = '700 36px "Outfit", "Plus Jakarta Sans", sans-serif';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
          ctx.shadowBlur = 4;
          ctx.fillStyle = '#FDE047';
          ctx.fillText(wordsToShow, width / 2, captionY, captionMaxWidth);
        } else if (video.captionStyle === 'neon-blue') {
          ctx.font = '700 35px "Outfit", "Plus Jakarta Sans", sans-serif';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
          ctx.shadowBlur = 4;
          ctx.fillStyle = '#38BDF8';
          ctx.fillText(wordsToShow, width / 2, captionY, captionMaxWidth);
        } else if (video.captionStyle === 'karaoke' && words.length > 0) {
          const highlightColor = video.karaokeHighlightColor || DEFAULT_KARAOKE_HIGHLIGHT_COLOR;
          const weights = words.map((w) => Math.max(2, w.replace(/[.,!?;:]/g, '').length) + (/[.,!?;:]$/.test(w) ? 2 : 0));
          const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
          const elapsedWeight = Math.min(0.999, Math.max(0, progressInScene)) * totalWeight;

          let accWeight = 0;
          let activeWordIdx = 0;
          for (let i = 0; i < words.length; i++) {
            accWeight += weights[i];
            if (elapsedWeight <= accWeight) {
              activeWordIdx = i;
              break;
            }
          }

          // Découpe en blocs lisibles de 5 mots maximum centrés sur le mot prononcé
          const chunkSize = 5;
          const chunkIndex = Math.floor(activeWordIdx / chunkSize);
          const chunkStart = chunkIndex * chunkSize;
          const chunkWords = words.slice(chunkStart, chunkStart + chunkSize);

          ctx.font = '700 34px "Outfit", "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'left';

          const spaceW = ctx.measureText(' ').width;
          const wordMetrics = chunkWords.map((w) => ctx.measureText(w).width);
          const rawTotalW =
            wordMetrics.reduce((sum, m) => sum + m, 0) + spaceW * Math.max(0, chunkWords.length - 1);
          const fitScale = rawTotalW > captionMaxWidth ? captionMaxWidth / rawTotalW : 1;
          const boxW = Math.min(captionMaxWidth, rawTotalW * fitScale) + 34;
          const boxH = 54;

          // Cartouche sombre translucide derrière la ligne Karaoké
          ctx.fillStyle = 'rgba(7, 9, 14, 0.72)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(width / 2 - boxW / 2, captionY - boxH / 2, boxW, boxH, 14);
          } else {
            ctx.rect(width / 2 - boxW / 2, captionY - boxH / 2, boxW, boxH);
          }
          ctx.fill();

          ctx.save();
          ctx.translate(width / 2, captionY);
          ctx.scale(fitScale, fitScale);

          let cursorX = -rawTotalW / 2;
          chunkWords.forEach((word, localIdx) => {
            const globalIdx = chunkStart + localIdx;
            const wWidth = wordMetrics[localIdx];
            const isSpoken = globalIdx < activeWordIdx;
            const isCurrent = globalIdx === activeWordIdx;

            ctx.save();
            if (isCurrent) {
              ctx.translate(cursorX + wWidth / 2, -2);
              ctx.scale(1.08, 1.08);
              ctx.fillStyle = highlightColor;
              ctx.shadowColor = highlightColor;
              ctx.shadowBlur = 14;
              ctx.fillText(word, -wWidth / 2, 0);
            } else if (isSpoken) {
              ctx.fillStyle = highlightColor;
              ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
              ctx.shadowBlur = 4;
              ctx.fillText(word, cursorX, 0);
            } else {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
              ctx.shadowBlur = 3;
              ctx.fillText(word, cursorX, 0);
            }
            ctx.restore();

            cursorX += wWidth + spaceW;
          });
          ctx.restore();
        } else {
          ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 3;
          ctx.fillText(wordsToShow, width / 2, captionY, captionMaxWidth);
        }
        ctx.restore();

        // Texte incrusté personnalisé sur la scène
        if (scene.overlay?.text && scene.overlay.text.trim()) {
          ctx.save();
          const ovText = scene.overlay.text.trim().slice(0, 60);
          const ovPos = scene.overlay.position || 'top';
          const ovY = ovPos === 'top' ? height * 0.14 : ovPos === 'center' ? height * 0.48 : height * 0.65;
          ctx.font = '700 26px "Outfit", "Plus Jakarta Sans", sans-serif';
          const metrics = ctx.measureText(ovText);
          const padW = Math.min(width * 0.86, metrics.width + 32);
          ctx.fillStyle = 'rgba(7, 9, 14, 0.72)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(width / 2 - padW / 2, ovY - 22, padW, 44, 12);
          } else {
            ctx.rect(width / 2 - padW / 2, ovY - 22, padW, 44);
          }
          ctx.fill();
          ctx.fillStyle = scene.overlay.color || '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ovText, width / 2, ovY, width * 0.8);
          ctx.restore();
        }

        // Incrustation du titre de la vidéo en haut
        ctx.save();
        ctx.font = '600 20px "Outfit", "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(video.title.slice(0, 48), width / 2, 45, width * 0.86);
        ctx.restore();

        // Badge / Filigrane
        ctx.save();
        if (!isPro) {
          ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.textAlign = 'right';
          ctx.fillText('Créé avec FOFO AI', width - 24, height - 28);
        }
        ctx.restore();

        frameInScene++;
        if (frameInScene >= totalFramesPerScene) {
          frameInScene = 0;
          currentSceneIdx++;
        }

        const totalProgress = Math.round(
          35 + ((currentSceneIdx * totalFramesPerScene + frameInScene) / (totalScenes * totalFramesPerScene)) * 60
        );
        onProgress?.({
          progress: Math.min(98, totalProgress),
          status: `Encodage vidéo ${currentSceneIdx + 1}/${totalScenes} en haute définition...`,
          isCompleted: false,
        });

        setTimeout(renderLoop, 1000 / FPS);
      };

      renderLoop();
    } catch (err) {
      console.error('Erreur export vidéo:', err);
      reject(err);
    }
  });
}

// Fonction utilitaire pour déclencher le téléchargement du fichier généré
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
