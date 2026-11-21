import React, { useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Music,
  UserCheck,
  Image as ImageIcon,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';

interface CopyrightModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopyrightModal: React.FC<CopyrightModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="copyright-modal-title"
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/[0.12] shadow-2xl p-6 sm:p-7 space-y-5 text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="copyright-modal-title" className="text-lg sm:text-xl font-extrabold font-heading">
                Droits d’auteur, Licences &amp; Droit à l’image
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Règles d’utilisation sécurisée sur YouTube, TikTok, Instagram Reels et usage commercial
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre Droits d’auteur"
            className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.12] text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3.5 text-xs sm:text-sm leading-relaxed">
          {/* 1. Audio & Musiques */}
          <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
              <Music className="w-4 h-4 shrink-0" />
              <span>1. Musiques, SFX &amp; Voix IA : 100 % Libres de droits</span>
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Toutes les musiques de fond (Phonk, Épique, Lo-Fi, Suspense, Piano, Amapiano), les effets sonores (Whoosh, Impact, Glitch, Cash) et les pistes vocales synthétisées par FOFO AI sont générés localement par synthèse audio originale. Aucun catalogue protégé tiers n’est utilisé : <strong>aucun blocage Content ID sur YouTube, TikTok ou Meta</strong>.
            </p>
          </div>

          {/* 2. Styles & Templates */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
              <FileCheck2 className="w-4 h-4 text-[#0095F6] shrink-0" />
              <span>2. Vos créations &amp; modèles de montage</span>
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Les structures narratives, rythmes de coupe, styles de sous-titres et paramètres visuels (<em>styles de montage</em>) ne sont pas protégés par le droit d’auteur. Vous restez propriétaire de vos scripts originaux et des vidéos finales que vous exportez pour vos chaînes ou clients.
            </p>
          </div>

          {/* 3. Portraits & Influenceurs */}
          <div className="p-4 rounded-2xl bg-amber-500/[0.08] border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>3. Influenceurs célèbres : Droit à l’image &amp; Marques</span>
            </div>
            <p className="text-xs text-zinc-800 dark:text-zinc-200">
              Les noms, pseudonymes et portraits de créateurs célèbres présents dans la galerie sont fournis exclusivement à titre d’<strong>inspiration stylistique, de référence éditoriale ou de démonstration</strong>.
            </p>
            <ul className="text-xs text-zinc-700 dark:text-zinc-300 list-disc pl-4 space-y-1">
              <li>
                <strong>Ne publiez pas à des fins commerciales ou publicitaires</strong> le portrait ou le nom d’une personnalité réelle sans son autorisation écrite préalable (droit à l’image, droit de la personnalité et droits des photographes).
              </li>
              <li>
                <strong>Solution intégrée en 1 clic :</strong> activez l’option <strong>« Sans portraits tiers (100 % libre de droits) »</strong> dans les Vidéos Animées ou remplacez les portraits par vos propres photos/avatars dans le Studio avant d’exporter et monétiser.
              </li>
            </ul>
          </div>

          {/* 4. Banques d'images */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
              <ImageIcon className="w-4 h-4 text-[#DD2A7B] shrink-0" />
              <span>4. Banques d’images &amp; médias importés</span>
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Les visuels issus des banques Unsplash / Pixabay intégrées sont utilisables librement selon leurs licences respectives (sans revente brute du fichier seul). Pour vos propres imports (photos, vidéos, musiques), assurez-vous de détenir les droits nécessaires avant diffusion publique.
            </p>
          </div>

          {/* 5. Propriété FOFO AI */}
          <div className="flex items-center justify-between gap-3 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>© {new Date().getFullYear()} FOFO AI Studio · Tous droits réservés sur l’interface et le moteur de montage.</span>
            </span>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient cursor-pointer"
          >
            J’ai compris
          </button>
        </div>
      </div>
    </div>
  );
};
