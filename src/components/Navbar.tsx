import React from 'react';
import { Sparkles, Crown, FolderHeart, BookMarked, Zap, User, Flame, BarChart3, Briefcase, Bot, Monitor, Sun, Moon, Contrast, Orbit, LogIn } from 'lucide-react';
import { AppTheme, ResolvedTheme, UserSubscription } from '../types';
import { ChromeInstallButton } from './ChromeInstallButton';
import { SystemColorScheme } from '../utils/themeManager';

interface NavbarProps {
  currentTab: 'studio' | 'animate' | 'creations' | 'library' | 'templates' | 'stats' | 'business' | 'bot' | 'pricing';
  setCurrentTab: (tab: 'studio' | 'animate' | 'creations' | 'library' | 'templates' | 'stats' | 'business' | 'bot' | 'pricing') => void;
  user: UserSubscription;
  openPricingModal: () => void;
  openUserModal: () => void;
  openAuthModal?: (mode: 'signup' | 'login') => void;
  onAppInstalled?: () => void;
  onOpenPostInstallAuth?: () => void;
  creationsCount: number;
  libraryCount?: number;
  currentTheme?: AppTheme;
  resolvedTheme?: ResolvedTheme;
  systemScheme?: SystemColorScheme;
  onThemeChange?: (theme: AppTheme) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  openPricingModal,
  openUserModal,
  openAuthModal,
  onAppInstalled,
  onOpenPostInstallAuth,
  creationsCount,
  libraryCount = 0,
  currentTheme = 'system',
  resolvedTheme = 'deep-night',
  systemScheme = 'dark',
  onThemeChange,
}) => {
  const cycleTheme = () => {
    if (!onThemeChange) return;
    const order: AppTheme[] = ['system', 'light', 'deep-night', 'neon-contrast'];
    const idx = order.indexOf(currentTheme);
    const next = order[(idx + 1) % order.length];
    onThemeChange(next);
  };

  const renderThemeIcon = () => {
    if (currentTheme === 'system') return <Monitor className="w-3.5 h-3.5" />;
    if (resolvedTheme === 'light') return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    if (resolvedTheme === 'neon-contrast') return <Contrast className="w-3.5 h-3.5 text-[#00F0FF]" />;
    return <Moon className="w-3.5 h-3.5" />;
  };

  const themeShortLabel =
    currentTheme === 'system'
      ? `Auto (${systemScheme === 'light' ? 'Clair' : 'Sombre'})`
      : currentTheme === 'light'
      ? 'Clair'
      : currentTheme === 'neon-contrast'
      ? 'Néon'
      : 'Sombre';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#07070A]/80 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-colors">
      <div className="max-w-[1640px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-6">
        {/* Zone 1: Clean Brand Wordmark */}
        <button
          type="button"
          onClick={() => setCurrentTab('studio')}
          className="flex items-center gap-2.5 cursor-pointer group whitespace-nowrap shrink-0"
        >
          <div className="w-8 h-8 rounded-lg ig-story-ring p-[1.5px] transition-transform duration-200 group-hover:scale-105">
            <div className="w-full h-full bg-white dark:bg-black rounded-[6px] flex items-center justify-center">
              <Zap className="w-4 h-4 text-zinc-900 dark:text-white fill-current" />
            </div>
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-zinc-900 dark:text-white">
            FOFO<span className="text-zinc-500 dark:text-zinc-400 font-medium">.ai</span>
          </span>
        </button>

        {/* Zone 2: Higgsfield-style Studio Workspace Switcher */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-100/90 dark:bg-white/[0.04] p-1 rounded-xl border border-zinc-200/80 dark:border-white/[0.08] overflow-x-auto">
          <button
            type="button"
            onClick={() => setCurrentTab('studio')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'studio'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('animate')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'animate'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <Orbit className="w-3.5 h-3.5 text-[#DD2A7B]" />
            <span>Image → Vidéo</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('creations')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'creations'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5" />
            <span>Créations</span>
            {creationsCount > 0 && (
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  currentTab === 'creations' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                · {creationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('library')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'library'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Ma Bibliothèque</span>
            {libraryCount > 0 && (
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  currentTab === 'library' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                · {libraryCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('templates')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'templates'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Modèles</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('stats')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'stats'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Stats</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('business')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'business'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Business</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('bot')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'bot'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Bot AI</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('pricing')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'pricing'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Tarifs</span>
          </button>
        </nav>

        {/* Zone 3: Action, Theme Auto & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {onThemeChange && (
            <button
              type="button"
              onClick={cycleTheme}
              title={`Thème : ${themeShortLabel} (cliquez pour changer ou passer en Auto Système)`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-zinc-200 dark:border-white/[0.1] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {renderThemeIcon()}
              <span className="hidden xl:inline">{themeShortLabel}</span>
            </button>
          )}

          <ChromeInstallButton
            isAuthenticated={Boolean(user.isAuthenticated)}
            onAppInstalled={onAppInstalled}
            onOpenPostInstallAuth={onOpenPostInstallAuth}
          />

          {!user.isAuthenticated && openAuthModal && (
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              title="Créer un compte ou se connecter"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-zinc-200 dark:border-white/[0.12] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[#0095F6]" />
              <span className="hidden md:inline">Connexion</span>
            </button>
          )}

          {user.plan === 'free' ? (
            <button
              type="button"
              onClick={openPricingModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0095F6] hover:bg-[#1877F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Passer Pro</span>
            </button>
          ) : (
            <span className="hidden sm:inline-block text-xs font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap shrink-0">
              {user.plan === 'business' ? 'Business VIP' : 'Pro VIP'}
            </span>
          )}

          {/* Profile button */}
          <button
            type="button"
            onClick={openUserModal}
            title="Profil, Compte, Crédits & Thème du Studio"
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-zinc-100 dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <div className="w-8 h-8 rounded-full ig-story-ring p-[1.5px] shrink-0 relative">
              <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden flex items-center justify-center">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                )}
              </div>
              {user.isAuthenticated && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-black"
                  title="Compte connecté"
                />
              )}
            </div>
            <span className="text-xs font-semibold text-zinc-900 dark:text-white tabular-nums hidden xs:inline">
              {user.plan === 'pro' || user.plan === 'business'
                ? 'Illimité'
                : `${user.creditsRemaining}/${user.maxCredits} crédits`}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden items-center justify-between gap-1 py-2 px-2 bg-zinc-50 dark:bg-black border-t border-zinc-200 dark:border-white/[0.08] overflow-x-auto">
        <button
          type="button"
          onClick={() => setCurrentTab('studio')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'studio' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Studio</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('animate')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'animate' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Orbit className="w-4 h-4 text-[#DD2A7B]" />
          <span>Image→Vidéo</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('creations')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'creations' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <FolderHeart className="w-4 h-4" />
          <span>Créations ({creationsCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('library')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'library' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <BookMarked className="w-4 h-4" />
          <span>Bibliothèque</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('templates')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'templates' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Modèles</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('stats')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'stats' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Stats</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('business')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'business' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Business</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('bot')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'bot' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Bot AI</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('pricing')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${
            currentTab === 'pricing' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>Tarifs</span>
        </button>
      </div>
    </header>
  );
};
