import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, RotateCcw, Feather, Globe } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine';
import { WorldMapBackdrop } from './WorldMapBackdrop';

interface LandingEagleProps {
  onLandingComplete?: () => void;
  className?: string;
}

type AnimationPhase = 'soaring' | 'floating';

const EAGLE_IMAGE_SRC = '/assets/aistudio/Screenshot_20261111-152240_5314ba9d.jpg';

export const LandingEagle: React.FC<LandingEagleProps> = ({
  onLandingComplete,
  className = '',
}) => {
  const [phase, setPhase] = useState<AnimationPhase>('soaring');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [screechWave, setScreechWave] = useState<boolean>(false);
  const [showWorldMap, setShowWorldMap] = useState<boolean>(true);
  const [cutoutSrc, setCutoutSrc] = useState<string>(EAGLE_IMAGE_SRC);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Détourage haute précision multi-bords + suppression des poches fermées entre les plumes et lissage des contours
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = EAGLE_IMAGE_SRC;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || 720;
        const h = img.naturalHeight || 754;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const isEagleFeature = (r: number, g: number, b: number) => {
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Tête et queue blanches/crème (jamais bleu froid)
          if (lum > 152 && b <= r + 4) return true;
          if (r > 138 && g > 128 && b > 105 && r - b >= 2) return true;

          // Bec et serres jaune/or
          if (r > 132 && g > 92 && r - b > 40) return true;

          // Plumes brun riche caractéristiques (évite le bokeh taupe doux du fond)
          if (r - b > 24 && r > 42 && maxC - minC > 24) return true;

          // Plumes très sombres / noires pures
          if (maxC < 44) return true;

          return false;
        };

        // Palette de référence échantillonnée sur tout le pourtour hors zones de plumes
        const palette: Array<[number, number, number]> = [];
        const samplePoints: Array<[number, number]> = [];

        for (let x = 8; x < w - 8; x += 20) {
          samplePoints.push([x, 6], [x, h - 6]);
        }
        for (let y = 8; y < h - 8; y += 20) {
          samplePoints.push([6, y], [w - 6, y]);
        }

        for (const [sx, sy] of samplePoints) {
          const idx = (sy * w + sx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          if (!isEagleFeature(r, g, b)) {
            palette.push([r, g, b]);
          }
        }

        const minPaletteDist = (r: number, g: number, b: number) => {
          let best = 999;
          for (let i = 0; i < palette.length; i++) {
            const [pr, pg, pb] = palette[i];
            const d = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
            if (d < best) best = d;
          }
          return best;
        };

        const isBackdropPixel = (r: number, g: number, b: number, localRefDist = 0) => {
          if (isEagleFeature(r, g, b)) return false;
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const sat = maxC - minC;
          // Fond studio doux (faible saturation, pas de dominante brun chaud)
          if (sat > 42 && r > b) return false;
          const pDist = palette.length > 0 ? minPaletteDist(r, g, b) : 0;
          return pDist < 48 || (localRefDist < 24 && pDist < 66);
        };

        const total = w * h;
        const isBg = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const seedIfBackdrop = (x: number, y: number) => {
          const idx = y * w + x;
          if (isBg[idx]) return;
          const p = idx * 4;
          if (isBackdropPixel(data[p], data[p + 1], data[p + 2], 0)) {
            isBg[idx] = 1;
            queue[tail++] = idx;
          }
        };

        // Amorçage sur les 4 bords extérieurs (uniquement sur les pixels de fond, jamais sur les pointes d'ailes)
        for (let x = 0; x < w; x++) {
          seedIfBackdrop(x, 0);
          seedIfBackdrop(x, 1);
          seedIfBackdrop(x, h - 1);
          seedIfBackdrop(x, h - 2);
        }
        for (let y = 0; y < h; y++) {
          seedIfBackdrop(0, y);
          seedIfBackdrop(1, y);
          seedIfBackdrop(w - 1, y);
          seedIfBackdrop(w - 2, y);
        }

        // Amorçage supplémentaire pour les poches de ciel enfermées entre les rémiges (haut de l'image)
        const upperLimit = Math.floor(h * 0.45);
        for (let y = 6; y < upperLimit; y += 3) {
          for (let x = 6; x < w - 6; x += 3) {
            const idx = y * w + x;
            if (isBg[idx]) continue;
            const p = idx * 4;
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            // Poche de fond gris-bleuté lisse et neutre entre les plumes écartées
            if (
              !isEagleFeature(r, g, b) &&
              lum > 68 &&
              lum < 162 &&
              b >= r - 4 &&
              Math.max(r, g, b) - Math.min(r, g, b) < 34 &&
              minPaletteDist(r, g, b) < 36
            ) {
              isBg[idx] = 1;
              queue[tail++] = idx;
            }
          }
        }

        // Propagation 8-voisins guidée par continuité locale + palette du fond
        const dirs = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];
        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % w;
          const cy = (curr - cx) / w;
          const cp = curr * 4;
          const cr = data[cp];
          const cg = data[cp + 1];
          const cb = data[cp + 2];

          for (let d = 0; d < dirs.length; d++) {
            const nIdx = curr + dirs[d];
            if (nIdx < 0 || nIdx >= total || isBg[nIdx]) continue;
            const nx = nIdx % w;
            const ny = (nIdx - nx) / w;
            if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;

            const np = nIdx * 4;
            const nr = data[np];
            const ng = data[np + 1];
            const nb = data[np + 2];
            const localDist = Math.sqrt((nr - cr) ** 2 + (ng - cg) ** 2 + (nb - cb) ** 2);

            if (isBackdropPixel(nr, ng, nb, localDist)) {
              isBg[nIdx] = 1;
              queue[tail++] = nIdx;
            }
          }
        }

        // Suppression des petits îlots isolés résiduels sur les bords et lissage doux (anti-halo)
        const distToBg = new Uint8Array(total);
        distToBg.fill(3);

        for (let i = 0; i < total; i++) {
          if (isBg[i]) {
            distToBg[i] = 0;
          }
        }

        for (let pass = 1; pass <= 2; pass++) {
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = y * w + x;
              if (distToBg[i] > pass) {
                if (
                  distToBg[i - 1] === pass - 1 ||
                  distToBg[i + 1] === pass - 1 ||
                  distToBg[i - w] === pass - 1 ||
                  distToBg[i + w] === pass - 1
                ) {
                  distToBg[i] = pass;
                }
              }
            }
          }
        }

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const p = i * 4;

            if (isBg[i]) {
              data[p + 3] = 0;
            } else if (distToBg[i] === 1) {
              // Atténuation douce du contour immédiat et neutralisation d'une éventuelle teinte bleutée de bordure
              const r = data[p];
              const g = data[p + 1];
              const b = data[p + 2];
              if (b > r + 4 && !isEagleFeature(r, g, b)) {
                data[p + 2] = Math.round((r + g) * 0.5);
              }
              data[p + 3] = 95;
            } else if (distToBg[i] === 2) {
              data[p + 3] = 210;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        if (!cancelled) {
          setCutoutSrc(canvas.toDataURL('image/png'));
        }
      } catch {
        if (!cancelled) {
          setCutoutSrc(EAGLE_IMAGE_SRC);
        }
      }
    };
    return () => {
      cancelled = true;
    };
  }, []);

  // Séquence de vol fluide sans appui ni compression : l'aigle plane et flotte librement dans les airs
  const startFlightSequence = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('soaring');
    setScreechWave(false);
    setIsInteracting(false);

    if (soundEnabled) {
      setTimeout(() => {
        audioEngine.playSfx('whoosh');
      }, 180);
    }

    timerRef.current = setTimeout(() => {
      setPhase('floating');
      if (soundEnabled) {
        audioEngine.playSfx('eagle_cry');
        setScreechWave(true);
        setTimeout(() => setScreechWave(false), 1200);
      }
      if (onLandingComplete) onLandingComplete();
    }, 950);
  };

  useEffect(() => {
    startFlightSequence();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
    };
  }, []);

  // Interaction douce au clic : léger battement d'élévation en apesanteur et cri royal
  const handleEagleClick = () => {
    if (isInteracting) return;
    setIsInteracting(true);
    setScreechWave(true);

    if (soundEnabled) {
      audioEngine.playSfx('eagle_cry');
    }

    if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
    interactTimerRef.current = setTimeout(() => {
      setScreechWave(false);
      setIsInteracting(false);
    }, 1500);
  };

  return (
    <div className={`relative flex flex-col items-center justify-center select-none overflow-visible ${className}`}>
      <style>{`
        /* Flottement libre en apesanteur sans aucun socle ni pression */
        @keyframes eagle-weightless-float {
          0%, 100% {
            transform: translateY(-6px) rotate(-1.1deg);
          }
          50% {
            transform: translateY(7px) rotate(1.1deg);
          }
        }
      `}</style>

      {/* Scène aérienne ouverte : l'aigle flotte librement devant la carte du monde, sans perchoir */}
      <div className="relative w-full max-w-[640px] sm:max-w-[740px] h-[290px] sm:h-[330px] flex items-center justify-center overflow-visible">
        {showWorldMap && (
          <WorldMapBackdrop
            className="-top-8 sm:-top-10 -bottom-4 -inset-x-6 sm:-inset-x-16 z-0 scale-105 sm:scale-115 opacity-90 transition-opacity duration-500"
            glow={true}
            activePulse={screechWave || isInteracting}
          />
        )}

        {/* L'AIGLE UNIFIÉ QUI FLOTTE LIBREMENT SANS DÉCOUPAGE NI HALO DE PANE */}
        <div
          onClick={handleEagleClick}
          className={`relative z-20 cursor-pointer transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            phase === 'soaring'
              ? 'translate-x-[110px] -translate-y-[80px] scale-[0.76] rotate-[-7deg] opacity-0'
              : 'translate-x-0 translate-y-0 scale-100 rotate-0 opacity-100'
          }`}
          title="Cliquez sur l'aigle pour entendre son cri royal"
        >
          <div
            className={`relative w-[260px] sm:w-[320px] h-[240px] sm:h-[285px] flex items-center justify-center transition-transform duration-500 ease-out ${
              isInteracting ? '-translate-y-3 scale-[1.03]' : 'hover:scale-[1.02]'
            }`}
            style={{
              animation:
                phase === 'floating' && !isInteracting
                  ? 'eagle-weightless-float 5.4s ease-in-out infinite'
                  : undefined,
            }}
          >
            <img
              src={cutoutSrc}
              alt="Aigle royal en plein vol libre"
              draggable={false}
              className="w-full h-full object-contain pointer-events-none filter drop-shadow-[0_18px_22px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_22px_28px_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>
      </div>

      {/* Barre de commandes et interactivité */}
      <div className="flex items-center justify-center flex-wrap gap-2 mt-2 z-30">
        {/* Rejouer l'envol libre */}
        <button
          type="button"
          onClick={startFlightSequence}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400 dark:hover:border-white/25 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-all cursor-pointer group"
          title="Relancer le vol libre de l'aigle avec son cri royal"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 group-hover:rotate-180 transition-transform duration-500" />
          <span>Planer librement 🦅</span>
        </button>

        {/* Vrai cri perçant de l'aigle (screech) */}
        <button
          type="button"
          onClick={() => {
            setIsInteracting(true);
            setScreechWave(true);
            audioEngine.playRealEagleCry('screech');
            if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
            interactTimerRef.current = setTimeout(() => {
              setScreechWave(false);
              setIsInteracting(false);
            }, 1500);
          }}
          disabled={isInteracting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-[#121214] border border-amber-500/35 hover:border-amber-500/70 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-all cursor-pointer"
          title="Faire retentir le vrai cri perçant de l'aigle royal (enregistrement réel)"
        >
          <Feather className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-bounce" />
          <span>Vrai cri de l'aigle 🦅</span>
        </button>

        {/* Chant naturel de l'aigle à tête blanche (Yellowstone) */}
        <button
          type="button"
          onClick={() => {
            setIsInteracting(true);
            setScreechWave(true);
            audioEngine.playRealEagleCry('call');
            if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
            interactTimerRef.current = setTimeout(() => {
              setScreechWave(false);
              setIsInteracting(false);
            }, 2500);
          }}
          disabled={isInteracting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25 transition-all cursor-pointer"
          title="Écouter le chant naturel du pygargue à tête blanche (Yellowstone National Park)"
        >
          <Volume2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
          <span>Chant Yellowstone 🌲</span>
        </button>

        {/* Afficher / Masquer la Carte du Monde */}
        <button
          type="button"
          onClick={() => setShowWorldMap(!showWorldMap)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            showWorldMap
              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
              : 'bg-zinc-100 dark:bg-[#121214] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
          title="Afficher ou masquer la carte du monde derrière l'aigle"
        >
          <Globe className={`w-3.5 h-3.5 ${showWorldMap ? 'text-white dark:text-black' : 'text-zinc-500 dark:text-zinc-400'}`} />
          <span>Carte du monde 🌍</span>
        </button>

        {/* Couper / Activer les effets sonores */}
        <button
          type="button"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) audioEngine.playSfx('ding');
          }}
          className={`p-1.5 rounded-xl text-xs border transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-zinc-100 dark:bg-[#121214] border-zinc-200 dark:border-white/[0.12] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.08]'
              : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.06] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
          title={soundEnabled ? 'Cri et sons activés' : 'Sons coupés'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-zinc-900 dark:text-white" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
