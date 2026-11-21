import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Crown, X, ShieldCheck, Briefcase, Building2, CreditCard } from 'lucide-react';
import { BillingCycle, UserSubscription } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserSubscription;
  onUpgradeToPro: () => void;
  onUpgradeToBusiness?: () => void;
  onDowngradeToFree: () => void;
  onStartCheckout?: (plan: 'pro' | 'business', billingCycle: BillingCycle) => void;
  variant?: 'modal' | 'page';
  onBackToHome?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpgradeToPro,
  onUpgradeToBusiness,
  onDowngradeToFree,
  onStartCheckout,
  variant = 'modal',
  onBackToHome,
}) => {
  const [isAnnual, setIsAnnual] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || variant !== 'modal') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, variant, onClose]);

  if (!isOpen) return null;

  const handleBackHome = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      onClose();
    }
  };

  const cardContent = (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-6xl rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] p-6 sm:p-10 shadow-2xl relative"
    >
      {/* Top Action Bar: Back to Home + Close */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={handleBackHome}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C1C20] dark:hover:bg-[#26262C] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'accueil</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les tarifs"
          className="p-2 rounded-full bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Modal Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Crown className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 fill-amber-400" />
          <span>Tarifs Transparents FOFO AI</span>
        </div>
        <h3 className="text-2xl sm:text-4xl font-extrabold font-heading text-zinc-900 dark:text-white tracking-tight">
          Choisissez la puissance adaptée à <span className="electric-gradient-text">vos ambitions</span>
        </h3>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          Du créateur solo aux agences média : générez des vidéos ultra-virales sans filigrane avec les voix off les plus réalistes du marché.
        </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] mt-4">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                !isAnnual ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isAnnual ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>Annuel</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0095F6] text-white font-bold">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {/* 1. Plan Gratuit */}
          <div className="rounded-2xl p-6 sm:p-7 bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] flex flex-col justify-between hover:border-zinc-300 dark:hover:border-white/[0.16] transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-white font-heading">Plan Gratuit</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Pour découvrir le studio IA</p>
                </div>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Découverte
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white font-heading tabular-nums">0€</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">/ gratuit à vie</span>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-white/[0.06] space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-900 dark:text-white flex-shrink-0" />
                  <span>3 vidéos générées par mois</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-900 dark:text-white flex-shrink-0" />
                  <span>Tous formats : 9:16 Reels, 4:5, 16:9</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-900 dark:text-white flex-shrink-0" />
                  <span>Résolution standard 720p / 1080p</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-zinc-900 dark:text-white flex-shrink-0" />
                  <span>Voix off standards françaises</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-400 dark:text-zinc-500">
                  <span className="w-4 h-4 flex items-center justify-center font-bold text-xs">✕</span>
                  <span>Filigrane discret FOFO AI</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              {user.plan === 'free' ? (
                <div className="w-full py-3 rounded-xl bg-zinc-200/80 dark:bg-[#18181B] text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-white/[0.08]">
                  ✓ Votre Plan Actuel
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onDowngradeToFree}
                  className="w-full py-3 rounded-xl border border-zinc-300 dark:border-white/[0.1] hover:bg-zinc-200/70 dark:hover:bg-[#18181B] text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Rétrograder vers Gratuit
                </button>
              )}
            </div>
          </div>

          {/* 2. Plan Créateur PRO */}
          <div className="rounded-2xl p-6 sm:p-7 bg-white dark:bg-[#16161A] border-2 border-zinc-900/20 dark:border-white/25 shadow-sm dark:shadow-none flex flex-col justify-between relative overflow-hidden">
            {/* Top highlight ribbon */}
            <div className="absolute top-0 right-0 ig-story-ring text-white font-bold text-[10px] uppercase tracking-wider py-1 px-3.5 rounded-bl-xl">
              Populaire
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500 dark:text-amber-400 fill-amber-400" />
                <h4 className="text-xl font-bold text-zinc-900 dark:text-white font-heading">Créateur PRO</h4>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white font-heading tabular-nums">
                  {isAnnual ? '15€' : '19€'}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">/ mois {isAnnual && '(annuel)'}</span>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                Idéal pour créateurs Reels, TikTok & YouTube.
              </p>

              <div className="pt-4 border-t border-zinc-200 dark:border-white/[0.08] space-y-3 text-xs text-zinc-700 dark:text-zinc-200">
                <div className="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white">
                  <Check className="w-4 h-4 text-[#DD2A7B] flex-shrink-0" />
                  <span>Vidéos IA ILLIMITÉES chaque mois</span>
                </div>
                <div className="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white">
                  <Check className="w-4 h-4 text-[#DD2A7B] flex-shrink-0" />
                  <span>Téléchargement SANS AUCUN filigrane</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#DD2A7B] flex-shrink-0" />
                  <span>Résolution Ultra HD 1080p & 4K</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#DD2A7B] flex-shrink-0" />
                  <span>Toutes les voix off Ultra-HD (Thomas, Alex...)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#DD2A7B] flex-shrink-0" />
                  <span>Effets tendance & Rendu accéléré</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              {user.plan === 'pro' ? (
                <div className="w-full py-3.5 rounded-xl bg-zinc-100 dark:bg-white/10 border border-zinc-300 dark:border-white/25 text-center text-xs font-bold text-zinc-900 dark:text-white">
                  ✓ Vous êtes Membre PRO Actif
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onStartCheckout
                      ? onStartCheckout('pro', isAnnual ? 'annual' : 'monthly')
                      : onUpgradeToPro()
                  }
                  className="w-full py-3.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4" />
                  <span>Choisir l'Offre PRO ({isAnnual ? '15€' : '19€'})</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. Tarif Business 44€ */}
          <div className="rounded-2xl p-6 sm:p-7 bg-zinc-50 dark:bg-[#09090B] border border-emerald-500/40 flex flex-col justify-between relative overflow-hidden">
            {/* Top highlight ribbon */}
            <div className="absolute top-0 right-0 bg-emerald-500 text-black font-bold text-[10px] uppercase tracking-wider py-1 px-3.5 rounded-bl-xl flex items-center gap-1">
              <Briefcase className="w-3 h-3 fill-black" />
              <span>Agences & Entreprises</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xl font-bold text-zinc-900 dark:text-white font-heading">Tarif Business</h4>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400 font-heading tabular-nums">
                  {isAnnual ? '35€' : '44€'}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  / mois {isAnnual ? '(35€ annuel)' : '(sans engagement)'}
                </span>
              </div>

              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Pour agences média, e-commerçants, marques et équipes de production vidéo.
              </p>

              <div className="pt-4 border-t border-zinc-200 dark:border-white/[0.08] space-y-3 text-xs text-zinc-700 dark:text-zinc-200">
                <div className="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Tout le plan PRO en illimité prioritaire</span>
                </div>
                <div className="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Génération par lots (jusqu'à 20 vidéos simultanées)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Rendu Ultra HD 4K 60 FPS sans filigrane</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Licence commerciale complète (TikTok Ads, Meta & TV)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>5 sièges d'équipe collaboratifs inclus</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Accès API REST & Intégration Webhooks</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Support VIP Dédié 24/7 & Account Manager</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              {user.plan === 'business' ? (
                <div className="w-full py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  ✓ Vous êtes Membre Business Actif (44€)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onStartCheckout
                      ? onStartCheckout('business', isAnnual ? 'annual' : 'monthly')
                      : onUpgradeToBusiness?.()
                  }
                  className="w-full py-3.5 rounded-xl font-heading text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 fill-black" />
                  <span>Activer le Tarif Business 44€</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-zinc-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 dark:text-zinc-400 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Garantie satisfait ou remboursé 14 jours · Factures pro TVA déductible</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="px-2.5 py-1 rounded-lg bg-[#1A1F71]/10 dark:bg-blue-500/15 border border-[#1A1F71]/25 dark:border-blue-400/30 text-[11px] font-black italic tracking-wider text-[#1A1F71] dark:text-blue-300 inline-flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 not-italic" />
              VISA
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#635BFF]/10 border border-[#635BFF]/30 text-[11px] font-black tracking-tight text-[#635BFF]">
              stripe
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#0070BA]/10 border border-[#0070BA]/30 text-[11px] font-black italic">
              <span className="text-[#003087] dark:text-sky-400">Pay</span>
              <span className="text-[#0079C1] dark:text-cyan-300">Pal</span>
            </span>
          </div>
        </div>
      </div>
  );

  if (variant === 'page') {
    return cardContent;
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tarifs FOFO AI"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 dark:bg-black/85 backdrop-blur-md p-4"
    >
      <div className="min-h-full flex items-center justify-center py-6">
        {cardContent}
      </div>
    </div>
  );
};


