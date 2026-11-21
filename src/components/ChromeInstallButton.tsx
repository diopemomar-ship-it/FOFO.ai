import React, { useState, useEffect } from 'react';
import { Download, Monitor, X, UserPlus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface ChromeInstallButtonProps {
  className?: string;
  isAuthenticated?: boolean;
  onAppInstalled?: () => void;
  onOpenPostInstallAuth?: () => void;
}

export const ChromeInstallButton: React.FC<ChromeInstallButtonProps> = ({
  className = '',
  isAuthenticated = false,
  onAppInstalled,
  onOpenPostInstallAuth,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuide(false);
      try {
        localStorage.setItem('fofo_app_installed', '1');
        localStorage.setItem('fofo_pending_post_install_auth', '1');
      } catch {
        // ignore
      }
      onAppInstalled?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onAppInstalled]);

  useEffect(() => {
    if (!showGuide) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showGuide]);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        try {
          localStorage.setItem('fofo_app_installed', '1');
          localStorage.setItem('fofo_pending_post_install_auth', '1');
        } catch {
          // ignore
        }
        onAppInstalled?.();
      }
    } else {
      setShowGuide(true);
    }
  };

  const handleConfirmManualInstallAndCreateAccount = () => {
    try {
      localStorage.setItem('fofo_app_installed', '1');
      localStorage.setItem('fofo_pending_post_install_auth', '1');
    } catch {
      // ignore
    }
    setShowGuide(false);
    if (onOpenPostInstallAuth) {
      onOpenPostInstallAuth();
    } else {
      onAppInstalled?.();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Télécharger et installer l'application"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-300 dark:hover:border-white/[0.2] transition-all cursor-pointer whitespace-nowrap shrink-0 ${className}`}
      >
        <Monitor className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
        <span className="hidden sm:inline">Télécharger l'app</span>
        <span className="sm:hidden">Installer</span>
      </button>

      {/* Guide modal if native prompt is not yet ready */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] p-6 space-y-4 text-center shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Fermer le guide d'installation"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl ig-story-ring p-[2px] mx-auto">
              <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#121214] flex items-center justify-center text-zinc-900 dark:text-white">
                <Download className="w-5 h-5" />
              </div>
            </div>

            <h3 className="text-lg font-heading font-bold text-zinc-900 dark:text-white tracking-tight">
              Télécharger & Installer FOFO AI
            </h3>

            <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-2.5 text-left bg-zinc-50 dark:bg-[#09090B] p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08]">
              <p className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
                <span>Sur ordinateur : cliquez sur l'icône <strong>« Installer »</strong> (ordinateur avec flèche) tout à droite dans la barre d'adresse de Chrome.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
                <span>Ou ouvrez le menu Chrome (<strong>⋮</strong> en haut à droite) &gt; <strong>« Enregistrer et partager »</strong> &gt; <strong>« Installer FOFO AI »</strong>.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center text-[11px] font-bold shrink-0">3</span>
                <span>Sur iOS / Android : <strong>Partager</strong> ou menu <strong>⋮</strong> &gt; <strong>« Sur l'écran d'accueil »</strong> / <strong>« Installer »</strong>.</span>
              </p>
            </div>

            <div className="space-y-2">
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={handleConfirmManualInstallAndCreateAccount}
                  className="w-full py-2.5 px-3 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Application téléchargée → Créer mon compte</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  !isAuthenticated
                    ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C1C20] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-200'
                    : 'font-heading font-bold text-white electric-button-gradient'
                }`}
              >
                {!isAuthenticated ? 'Plus tard' : 'Compris !'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
