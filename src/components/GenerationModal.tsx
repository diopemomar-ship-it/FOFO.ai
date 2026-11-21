import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, Film, Brain, Volume2, Wand2 } from 'lucide-react';

interface GenerationModalProps {
  isOpen: boolean;
  prompt: string;
  mode?: 'text' | 'image-to-video';
  customProgress?: number | null;
  customStatus?: string | null;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({
  isOpen,
  prompt,
  mode = 'text',
  customProgress = null,
  customStatus = null,
}) => {
  const [step, setStep] = useState<number>(0);
  const [progress, setProgress] = useState<number>(10);

  const STEPS =
    mode === 'image-to-video'
      ? [
          {
            title: 'Analyse Multimodale Vision IA',
            desc: 'Inspection des sujets, cadrages et points focaux de vos images...',
            icon: Brain,
          },
          {
            title: 'Chorégraphie Caméra 3D & Voix Off',
            desc: 'Création du scénario narratif et sélection des mouvements caméra...',
            icon: Wand2,
          },
          {
            title: 'Synthèse des Clips Vidéo IA',
            desc: 'Animation des photos en séquences vidéo 2.5D/3D haute définition...',
            icon: Film,
          },
          {
            title: 'Montage, Sous-titres & Mix Audio',
            desc: 'Synchronisation des sous-titres viraux et du sound design...',
            icon: Volume2,
          },
        ]
      : [
          { title: 'Analyse IA & Création du Hook viral', desc: 'Conception d\'une accroche irrésistible des 3 premières secondes...', icon: Brain },
          { title: 'Scénarisation & Découpage narratif', desc: 'Structuration des scènes chronométrées pour rétention maximale...', icon: Film },
          { title: 'Sélection des visuels cinématiques HD', desc: 'Association des plans haute définition avec effets Ken Burns...', icon: Wand2 },
          { title: 'Synthèse de la voix off & Sous-titres', desc: 'Génération de l\'audio naturel et synchronisation du karaoké...', icon: Volume2 },
        ];

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setProgress(10);
      return;
    }

    if (typeof customProgress === 'number') {
      setProgress(customProgress);
      if (customProgress >= 75) setStep(3);
      else if (customProgress >= 45) setStep(2);
      else if (customProgress >= 22) setStep(1);
      else setStep(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        const next = prev + Math.floor(Math.random() * 8) + 4;
        if (next > 75) setStep(3);
        else if (next > 50) setStep(2);
        else if (next > 25) setStep(1);
        return next;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [isOpen, customProgress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Story Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 ig-story-ring" />

        <div className="text-center space-y-3 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl ig-story-ring p-[2px] mb-2">
            <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#09090B] flex items-center justify-center text-zinc-900 dark:text-white">
              <Sparkles className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-heading text-zinc-900 dark:text-white tracking-tight">
            {mode === 'image-to-video'
              ? 'Transformation Image → Vidéo IA...'
              : 'Génération de votre vidéo en cours...'}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1 italic max-w-md mx-auto">
            {customStatus || `« ${prompt} »`}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-zinc-700 dark:text-zinc-300">Progression IA</span>
            <span className="text-zinc-900 dark:text-white font-mono tabular-nums">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-100 dark:bg-[#09090B] rounded-full overflow-hidden border border-zinc-200 dark:border-white/[0.08]">
            <div
              className="h-full ig-story-ring rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Generation Steps Checklist */}
        <div className="space-y-2.5">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isDone = idx < step;
            const isCurrent = idx === step;

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'bg-zinc-100 dark:bg-[#18181B] border-zinc-300 dark:border-white/[0.18] text-zinc-900 dark:text-white'
                    : isDone
                    ? 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400'
                    : 'bg-zinc-50/60 dark:bg-[#09090B]/50 border-transparent text-zinc-400 dark:text-zinc-600'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isDone
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : isCurrent
                      ? 'bg-[#0095F6]/15 text-[#0095F6] border border-[#0095F6]/40'
                      : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>

                <div className="text-left flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${isCurrent ? 'text-zinc-900 dark:text-white' : isDone ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {s.title}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] text-[#0095F6] font-mono">
                        En cours...
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] text-zinc-500">
            {mode === 'image-to-video'
              ? 'Moteur Vision Multimodale & Synthèse 3D FOFO AI'
              : 'Moteur multimodal haute précision FOFO AI'}
          </p>
        </div>
      </div>
    </div>
  );
};
