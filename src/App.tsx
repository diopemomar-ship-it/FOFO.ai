import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroStudio } from './components/HeroStudio';
import { VideoStudioPlayer } from './components/VideoStudioPlayer';
import { MyCreationsView } from './components/MyCreationsView';
import { MyLibraryView } from './components/MyLibraryView';
import { TemplatesGallery } from './components/TemplatesGallery';
import { PricingModal } from './components/PricingModal';
import { UserProfileModal } from './components/UserProfileModal';
import { GenerationModal } from './components/GenerationModal';
import { StatsDashboard } from './components/StatsDashboard';
import { BusinessWorkspace } from './components/BusinessWorkspace';
import { CreatorAssistant } from './components/CreatorAssistant';
import { AIBotView } from './components/AIBotView';
import { LandingEagle } from './components/LandingEagle';
import { AnimatedInfluencerShowcase } from './components/AnimatedInfluencerShowcase';
import { CopyrightModal } from './components/CopyrightModal';
import { PaymentCheckoutModal } from './components/PaymentCheckoutModal';
import { ImageToVideoStudio } from './components/ImageToVideoStudio';
import { AuthModal, AuthModalMode, AuthTriggerSource } from './components/AuthModal';
import { onAuthStateChanged, signOut, sendEmailVerification, User as FirebaseUser } from 'firebase/auth';
import { auth, syncUserProfileWithFirestore, updateUserPreferencesInFirestore } from './firebase';
import defaultUserAvatar from './assets/images/user_default_avatar_1795170424373.jpg';
import {
  GeneratedVideo,
  UserSubscription,
  AspectRatio,
  VideoStyle,
  MusicMood,
  CaptionStyle,
  SceneTransition,
  VideoTemplate,
  AppTheme,
  ExportQualityPreset,
  ImportedMediaItem,
  BotExecutableAction,
  AIModelEngine,
  ContentNiche,
  TrendingEffectId,
  TrendingSfxId,
  ImageMotionPreset,
  ImageMotionIntensity,
  ImageVideoEngine,
  LibraryItem,
  CreatorPersona,
  BillingCycle,
  PaymentProvider,
} from './types';
import {
  resizeImageDataUrlForAI,
  synthesizeImageToVideoClip,
} from './utils/imageToVideoSynthesizer';
import confetti from 'canvas-confetti';
import { Zap, Heart, Sparkles, Play, Download, Film, BarChart3, Feather, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import {
  AUTO_SAVE_KEYS,
  AppTab,
  loadActiveProject,
  loadWorkspaceState,
  safeLoadJson,
  saveActiveProject,
  saveCreationsList,
  saveWorkspaceState,
} from './utils/autoSave';
import { loadLibraryItems, saveLibraryItems } from './utils/libraryStorage';
import { audioEngine } from './utils/audioEngine';
import {
  SystemColorScheme,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  getInitialThemePreference,
  getSystemColorScheme,
  resolveAppTheme,
  subscribeToSystemColorScheme,
} from './utils/themeManager';

const INITIAL_DEMO_VIDEO: GeneratedVideo = {
  id: 'fofo-demo-1',
  title: '5 Faits Psychologiques Révélateurs sur le Comportement Humain',
  hook: 'Votre subconscient contrôle 95% de vos décisions sans votre accord.',
  description: 'Découvrez les 5 secrets fascinants de la psychologie humaine qui influencent vos pensées et vos relations au quotidien.',
  hashtags: ['#FOFOAI', '#Psychologie', '#Faits', '#Shorts', '#Viral'],
  aspectRatio: '9:16',
  style: 'cinematic',
  voiceId: 'mathieu',
  musicMood: 'suspense',
  captionStyle: 'hormozi',
  defaultTransition: 'fade',
  totalEstimatedDuration: 36,
  createdAt: new Date().toISOString(),
  isFavorite: true,
  scenes: [
    {
      sceneNumber: 1,
      voiceoverText: 'Votre subconscient contrôle 95% de vos décisions quotidiennes sans même que vous en ayez conscience.',
      durationSeconds: 7,
      visualDescription: 'Silhouettes mystérieuses marchant dans une ville nocturne avec lumières cinématographiques.',
      imagePrompt: 'Cinematic silhouette of a person contemplating in a futuristic dimly lit city, 8k render, moody lighting',
      visualThemeKeyword: 'mystery',
      keywords: ['subconscient', 'décisions', 'conscience'],
      kenBurnsEffect: 'zoom-in',
      transition: 'fade',
      imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1200&q=80',
    },
    {
      sceneNumber: 2,
      voiceoverText: 'Premier fait : regarder quelqu\'un dans les yeux pendant plus de 4 secondes déclenche une montée instantanée de dopamine.',
      durationSeconds: 8,
      visualDescription: 'Gros plan intense sur un regard humain captivant avec reflets de néons bleus.',
      imagePrompt: 'Macro shot of captivating human eyes reflecting neon cyan city lights, cinematic depth of field',
      visualThemeKeyword: 'cinematic',
      keywords: ['yeux', 'secondes', 'dopamine'],
      kenBurnsEffect: 'pan-right',
      transition: 'slide',
      imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
    },
    {
      sceneNumber: 3,
      voiceoverText: 'Deuxième secret : votre cerveau est programmé pour se souvenir beaucoup plus des fins inachevées que des succès.',
      durationSeconds: 7,
      visualDescription: 'Labyrinthe infini abstrait avec structures géométriques et reflets métalliques.',
      imagePrompt: 'Abstract infinite architectural labyrinth, surreal lighting, deep shadows and neon cyan accents',
      visualThemeKeyword: 'technology',
      keywords: ['cerveau', 'inachevées', 'succès'],
      kenBurnsEffect: 'zoom-out',
      transition: 'zoom',
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    },
    {
      sceneNumber: 4,
      voiceoverText: 'Et vous, quelle réaction observez-vous le plus chez les gens ? Partagez votre avis en commentaire et abonnez-vous !',
      durationSeconds: 7,
      visualDescription: 'Vue aérienne grandiose au crépuscule symbolisant l\'éveil et la réflexion.',
      imagePrompt: 'Epic aerial view of a sprawling metropolis during twilight with warm and cool cinematic contrast',
      visualThemeKeyword: 'luxury',
      keywords: ['réaction', 'commentaire', 'abonnez-vous'],
      kenBurnsEffect: 'pan-left',
      transition: 'cut',
      imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    },
  ],
};

const DEFAULT_USER: UserSubscription = {
  plan: 'free',
  creditsRemaining: 3,
  maxCredits: 3,
  renewalDate: '1er du mois prochain',
  name: 'Créateur FOFO',
  email: 'creator@fofo.ai',
  avatarUrl: defaultUserAvatar,
};

export default function App() {
  const [initialWorkspace] = useState(() => loadWorkspaceState());
  const [currentTab, setCurrentTab] = useState<AppTab>(() => initialWorkspace?.currentTab || 'studio');
  const [creations, setCreations] = useState<GeneratedVideo[]>(() => {
    const saved = safeLoadJson<GeneratedVideo[]>(AUTO_SAVE_KEYS.CREATIONS);
    return Array.isArray(saved) && saved.length > 0 ? saved : [INITIAL_DEMO_VIDEO];
  });
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => loadLibraryItems());
  const customLibraryVoices = React.useMemo(
    () => libraryItems.filter((item) => item.type === 'voice' && item.voiceData),
    [libraryItems]
  );
  const [initialProjectState] = useState(() => loadActiveProject(INITIAL_DEMO_VIDEO, creations));
  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(() => initialProjectState.video);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(() => initialProjectState.savedAt);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);

  const [user, setUser] = useState<UserSubscription>(() => {
    try {
      const saved = localStorage.getItem('fofo_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        const isLegacyDefault =
          !parsed.avatarUrl ||
          String(parsed.avatarUrl).includes('images.unsplash.com/photo-1534528741775');
        return {
          ...DEFAULT_USER,
          ...parsed,
          avatarUrl: isLegacyDefault ? defaultUserAvatar : parsed.avatarUrl,
        };
      }
      return DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationPrompt, setGenerationPrompt] = useState<string>('');
  const [generationMode, setGenerationMode] = useState<'text' | 'image-to-video'>('text');
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState<boolean>(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [isCopyrightOpen, setIsCopyrightOpen] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: AuthModalMode;
    source: AuthTriggerSource;
  }>({ isOpen: false, mode: 'signup', source: 'manual' });
  const firebaseUserRef = React.useRef<FirebaseUser | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<{
    plan: 'pro' | 'business';
    billingCycle: BillingCycle;
  } | null>(null);
  const [isCoachOpen, setIsCoachOpen] = useState<boolean>(false);
  const [showEagleShowcase, setShowEagleShowcase] = useState<boolean>(() =>
    initialWorkspace ? initialWorkspace.showEagleShowcase : true
  );
  const [coachDraft, setCoachDraft] = useState<{
    prompt: string;
    style?: VideoStyle;
    aspectRatio?: AspectRatio;
    duration?: number;
    voiceId?: string;
    musicMood?: MusicMood;
    captionStyle?: CaptionStyle;
    karaokeHighlightColor?: string;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    creatorName?: string;
    id: number;
  } | null>(null);
  const [libraryMediaRush, setLibraryMediaRush] = useState<{ item: ImportedMediaItem; id: number } | null>(null);
  const [libraryVoiceSelection, setLibraryVoiceSelection] = useState<{ voiceId: string; id: number } | null>(null);
  const [libraryToast, setLibraryToast] = useState<string | null>(null);
  const [studioContext, setStudioContext] = useState<{ prompt: string; style: VideoStyle; aspectRatio: AspectRatio }>({
    prompt: '',
    style: 'cinematic',
    aspectRatio: '9:16',
  });
  const [exportQuality, setExportQuality] = useState<ExportQualityPreset>(() => {
    try {
      const saved = localStorage.getItem('fofo_export_quality');
      return (saved as ExportQualityPreset) || '4k-60';
    } catch {
      return '4k-60';
    }
  });
  const [systemScheme, setSystemScheme] = useState<SystemColorScheme>(() => getSystemColorScheme());
  const [theme, setTheme] = useState<AppTheme>(() => getInitialThemePreference());
  const resolvedTheme = resolveAppTheme(theme, systemScheme);

  // Écouter les changements de préférence système (Clair/Sombre) en temps réel
  useEffect(() => {
    return subscribeToSystemColorScheme((detected) => {
      setSystemScheme(detected);
    });
  }, []);

  // Appliquer le thème résolu sur document.documentElement et stocker la préférence
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    applyThemeToDocument(resolvedTheme);
  }, [theme, resolvedTheme]);

  // Vérification automatique au retour de redirection Stripe Checkout ou PayPal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment_status');
    const provider = params.get('provider');
    if (!status) return;

    const cleanUrl = () => {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // ignore
      }
    };

    if (status !== 'success') {
      cleanUrl();
      return;
    }

    const sessionId = params.get('session_id');
    const paypalOrderId = params.get('token');

    if (provider === 'stripe' && sessionId) {
      fetch('/api/payments/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.ok) {
            handlePaymentCompleted({
              plan: data.plan === 'business' ? 'business' : 'pro',
              billingCycle: data.billingCycle === 'monthly' ? 'monthly' : 'annual',
              provider: 'stripe',
              transactionId: data.transactionId || sessionId,
            });
          }
        })
        .finally(cleanUrl);
    } else if (provider === 'paypal' && paypalOrderId) {
      fetch('/api/payments/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: paypalOrderId }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.ok) {
            handlePaymentCompleted({
              plan: data.plan === 'business' ? 'business' : 'pro',
              billingCycle: data.billingCycle === 'monthly' ? 'monthly' : 'annual',
              provider: 'paypal',
              transactionId: data.transactionId || paypalOrderId,
            });
          }
        })
        .finally(cleanUrl);
    } else {
      cleanUrl();
    }
  }, []);

  // Écouter l'état d'authentification Firebase & synchroniser le profil utilisateur
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      firebaseUserRef.current = fbUser;
      setAuthReady(true);

      if (!fbUser) {
        setUser((prev) => ({
          ...prev,
          uid: undefined,
          isAuthenticated: false,
          authProvider: undefined,
          emailVerified: false,
        }));
        return;
      }

      const isGoogle = fbUser.providerData.some((p) => p.providerId === 'google.com');
      const isInstalledFlag =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        localStorage.getItem('fofo_app_installed') === '1';

      try {
        localStorage.removeItem('fofo_pending_post_install_auth');
      } catch {
        // ignore
      }

      const resolvedName =
        fbUser.displayName?.trim() ||
        fbUser.email?.split('@')[0] ||
        'Créateur FOFO';

      setUser((prev) => {
        const hasCustomAvatar =
          prev.avatarUrl &&
          prev.avatarUrl !== defaultUserAvatar &&
          !prev.avatarUrl.startsWith('https://lh3.googleusercontent.com');
        return {
          ...prev,
          uid: fbUser.uid,
          isAuthenticated: true,
          authProvider: isGoogle ? 'google' : 'password',
          emailVerified: fbUser.emailVerified,
          installedApp: isInstalledFlag || prev.installedApp,
          name: resolvedName,
          email: fbUser.email || prev.email,
          avatarUrl: hasCustomAvatar ? prev.avatarUrl : fbUser.photoURL || prev.avatarUrl || defaultUserAvatar,
        };
      });

      if (fbUser.emailVerified) {
        try {
          const synced = await syncUserProfileWithFirestore(fbUser.uid, {
            name: resolvedName,
            email: fbUser.email || '',
            theme,
            installedApp: isInstalledFlag,
          });
          if (synced) {
            setUser((prev) => ({
              ...prev,
              ...synced,
              avatarUrl: prev.avatarUrl || fbUser.photoURL || defaultUserAvatar,
            }));
          }
        } catch (err) {
          console.error('Erreur synchronisation profil Firestore:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Déclencher automatiquement la création de compte / connexion une fois l'app téléchargée
  useEffect(() => {
    const handleGlobalAppInstalled = () => {
      try {
        localStorage.setItem('fofo_app_installed', '1');
        localStorage.setItem('fofo_pending_post_install_auth', '1');
      } catch {
        // ignore
      }
      if (!firebaseUserRef.current) {
        setAuthModalState({ isOpen: true, mode: 'signup', source: 'post-download' });
      }
    };

    window.addEventListener('appinstalled', handleGlobalAppInstalled);
    return () => window.removeEventListener('appinstalled', handleGlobalAppInstalled);
  }, []);

  useEffect(() => {
    if (!authReady || user.isAuthenticated) return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    let pendingPostInstall = false;
    let dismissedThisSession = false;
    try {
      pendingPostInstall = localStorage.getItem('fofo_pending_post_install_auth') === '1';
      dismissedThisSession = sessionStorage.getItem('fofo_post_download_auth_dismissed') === '1';
    } catch {
      // ignore
    }

    if ((isStandalone || pendingPostInstall) && !dismissedThisSession) {
      setAuthModalState({ isOpen: true, mode: 'signup', source: 'post-download' });
    }
  }, [authReady, user.isAuthenticated]);

  const handleOpenAuthModal = useCallback(
    (mode: AuthModalMode = 'signup', source: AuthTriggerSource = 'manual') => {
      setAuthModalState({ isOpen: true, mode, source });
    },
    []
  );

  const handleCloseAuthModal = useCallback(() => {
    if (authModalState.source === 'post-download') {
      try {
        localStorage.removeItem('fofo_pending_post_install_auth');
        sessionStorage.setItem('fofo_post_download_auth_dismissed', '1');
      } catch {
        // ignore
      }
    }
    setAuthModalState((prev) => ({ ...prev, isOpen: false }));
  }, [authModalState.source]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser({
        ...DEFAULT_USER,
        theme,
      });
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  }, [theme]);

  const handleResendVerification = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const handleThemeChange = (newTheme: AppTheme) => {
    setTheme(newTheme);
    setUser((prev) => ({
      ...prev,
      theme: newTheme,
    }));
    if (user.isAuthenticated && user.uid && user.emailVerified) {
      updateUserPreferencesInFirestore(user.uid, { theme: newTheme }).catch(() => {});
    }
  };

  // Sauvegarde automatique de la bibliothèque des créations
  useEffect(() => {
    saveCreationsList(creations);
  }, [creations]);

  // Sauvegarde automatique de Ma Bibliothèque & enregistrement des voix personnalisées
  useEffect(() => {
    saveLibraryItems(libraryItems);
  }, [libraryItems]);

  useEffect(() => {
    audioEngine.registerCustomVoices(
      customLibraryVoices.map((cv) => ({
        id: cv.id,
        baseVoiceId: cv.voiceData!.baseVoiceId,
        pitch: cv.voiceData!.pitch,
        rate: cv.voiceData!.rate,
        gender: cv.voiceData!.gender,
      }))
    );
  }, [customLibraryVoices]);

  // Sauvegarde automatique de l'état de l'espace de travail (onglet actif & vitrine)
  useEffect(() => {
    saveWorkspaceState({ currentTab, showEagleShowcase });
  }, [currentTab, showEagleShowcase]);

  // Sauvegarde automatique locale (auto-save) du projet actif avec anti-rebond + flush avant fermeture
  const latestVideoRef = React.useRef<GeneratedVideo | null>(currentVideo);
  latestVideoRef.current = currentVideo;
  const isFirstAutoSaveMountRef = React.useRef(true);

  useEffect(() => {
    if (isFirstAutoSaveMountRef.current) {
      isFirstAutoSaveMountRef.current = false;
      // S'assurer que le projet restauré ou initial est bien inscrit dans localStorage dès le chargement
      const savedAt = saveActiveProject(currentVideo);
      if (savedAt) setLastAutoSavedAt(savedAt);
      return;
    }

    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      const savedAt = saveActiveProject(currentVideo);
      if (savedAt) {
        setLastAutoSavedAt(savedAt);
      }
      setIsAutoSaving(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [currentVideo]);

  useEffect(() => {
    const flushAutoSave = () => {
      saveActiveProject(latestVideoRef.current);
      saveCreationsList(creations);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAutoSave();
      }
    };

    window.addEventListener('beforeunload', flushAutoSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushAutoSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [creations]);

  useEffect(() => {
    try {
      localStorage.setItem('fofo_user', JSON.stringify(user));
    } catch (e) {
      // ignore
    }
  }, [user]);

  // Génération d'une nouvelle vidéo (avec support des médias importés si présents)
  const handleGenerate = async (config: {
    prompt: string;
    aspectRatio: AspectRatio;
    duration: number;
    voiceId: string;
    style: VideoStyle;
    musicMood: MusicMood;
    captionStyle: CaptionStyle;
    karaokeHighlightColor?: string;
    defaultTransition?: SceneTransition;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    aiModel?: AIModelEngine;
    niche?: ContentNiche;
    uploadedMedia?: ImportedMediaItem[];
  }) => {
    setIsGenerating(true);
    setGenerationMode('text');
    setGenerationProgress(null);
    setGenerationStatus(null);
    setGenerationPrompt(config.prompt);

    try {
      const { uploadedMedia, ...apiPayload } = config;
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const newVideoData: GeneratedVideo = await response.json();
      newVideoData.createdAt = new Date().toISOString();
      newVideoData.defaultTransition = config.defaultTransition || 'fade';
      if (config.karaokeHighlightColor) newVideoData.karaokeHighlightColor = config.karaokeHighlightColor;
      if (config.trendingEffect) newVideoData.trendingEffect = config.trendingEffect;
      if (config.hookSfx) newVideoData.hookSfx = config.hookSfx;
      newVideoData.scenes = newVideoData.scenes.map((s, idx) => {
        const media =
          uploadedMedia && uploadedMedia.length > 0 && idx < uploadedMedia.length
            ? uploadedMedia[idx]
            : undefined;
        return {
          ...s,
          imageUrl: media ? media.previewUrl : s.imageUrl,
          mediaType: media ? media.mediaType : 'image',
          videoUrl: media ? media.videoUrl : undefined,
          transition: s.transition || config.defaultTransition || 'fade',
        };
      });

      // Décrémenter un crédit si plan gratuit
      if (user.plan === 'free') {
        setUser((prev) => ({
          ...prev,
          creditsRemaining: Math.max(0, prev.creditsRemaining - 1),
        }));
      }

      // Sauvegarder dans la liste des créations
      setCreations((prev) => [newVideoData, ...prev]);
      setCurrentVideo(newVideoData);
      setCurrentTab('studio');

      // Effet de célébration
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.5 },
          colors: ['#00D2FF', '#3B82F6', '#FFFFFF'],
        });
      } catch (e) {
        // ignore
      }
    } catch (error) {
      console.error('Erreur de génération:', error);
      alert('Une erreur est survenue lors de la génération. Le générateur de secours a été utilisé.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Ouverture directe des photos et vidéos importées dans l'éditeur Studio
  const handleImportMediaProject = (config: {
    media: ImportedMediaItem[];
    prompt: string;
    aspectRatio: AspectRatio;
    voiceId: string;
    style: VideoStyle;
    musicMood: MusicMood;
    captionStyle: CaptionStyle;
    karaokeHighlightColor?: string;
    defaultTransition: SceneTransition;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    aiModel?: AIModelEngine;
    niche?: ContentNiche;
  }) => {
    const effects: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
      'zoom-in',
      'pan-right',
      'zoom-out',
      'pan-left',
    ];
    const scenes = config.media.map((item, idx) => ({
      sceneNumber: idx + 1,
      voiceoverText:
        config.prompt && idx === 0
          ? config.prompt
          : `Séquence ${idx + 1} : ${item.name.replace(/\.[^/.]+$/, '')}.`,
      durationSeconds: item.durationSeconds || 6,
      visualDescription: `${item.mediaType === 'video' ? 'Vidéo importée' : 'Photo importée'} (${item.name})`,
      imagePrompt: item.name,
      visualThemeKeyword: 'cinematic',
      keywords: [item.mediaType === 'video' ? 'vidéo' : 'photo'],
      kenBurnsEffect: effects[idx % effects.length],
      imageUrl: item.previewUrl,
      mediaType: item.mediaType,
      videoUrl: item.videoUrl,
      transition: config.defaultTransition || 'fade',
    }));

    const project: GeneratedVideo = {
      id: `fofo-media-${Date.now()}`,
      title: config.prompt ? config.prompt.slice(0, 50) : `Montage personnalisé (${scenes.length} médias)`,
      hook: config.prompt || 'Découvrez ce montage créé avec FOFO AI',
      description: config.prompt || `Montage vidéo personnalisé à partir de ${scenes.length} photos/vidéos.`,
      hashtags: ['#FOFOAI', '#Montage', '#Studio', '#Createur', '#Viral'],
      aspectRatio: config.aspectRatio,
      style: config.style,
      voiceId: config.voiceId,
      musicMood: config.musicMood,
      captionStyle: config.captionStyle,
      karaokeHighlightColor: config.karaokeHighlightColor,
      aiModel: config.aiModel || 'chatgpt-astra',
      niche: config.niche || 'general',
      defaultTransition: config.defaultTransition,
      trendingEffect: config.trendingEffect,
      hookSfx: config.hookSfx,
      totalEstimatedDuration: scenes.reduce((acc, s) => acc + s.durationSeconds, 0),
      scenes,
      createdAt: new Date().toISOString(),
    };

    setCreations((prev) => [project, ...prev]);
    setCurrentVideo(project);
    setCurrentTab('studio');
    setTimeout(() => {
      const el = document.getElementById('studio-player-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Transformation complète Images → Vidéo par IA avancée (Vision Multimodale + Synthèse Motion 3D)
  const handleGenerateImageToVideo = async (config: {
    media: ImportedMediaItem[];
    motionPrompt: string;
    motionPreset: ImageMotionPreset | 'auto';
    imageVideoEngine: ImageVideoEngine;
    motionIntensity: ImageMotionIntensity;
    clipDuration: number;
    aspectRatio: AspectRatio;
    voiceId: string;
    style: VideoStyle;
    musicMood: MusicMood;
    captionStyle: CaptionStyle;
    karaokeHighlightColor?: string;
    defaultTransition: SceneTransition;
    trendingEffect?: TrendingEffectId;
    hookSfx?: TrendingSfxId | 'none';
    aiModel?: AIModelEngine;
    niche?: ContentNiche;
  }) => {
    const imageItems = config.media.filter((m) => m.mediaType === 'image');
    const videoItems = config.media.filter((m) => m.mediaType === 'video');
    if (imageItems.length === 0) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationMode('image-to-video');
    setGenerationPrompt(
      config.motionPrompt || `Animation IA de ${imageItems.length} image${imageItems.length > 1 ? 's' : ''}`
    );
    setGenerationProgress(12);
    setGenerationStatus('Préparation et optimisation des images pour l’IA Vision...');

    try {
      const preparedImages = await Promise.all(
        imageItems.map(async (item) => ({
          name: item.name,
          dataUrl: await resizeImageDataUrlForAI(item.previewUrl, 960),
        }))
      );

      setGenerationProgress(28);
      setGenerationStatus('Analyse Multimodale Gemini Vision & rédaction de la voix off...');

      const resp = await fetch('/api/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: preparedImages,
          motionPrompt: config.motionPrompt,
          motionPreset: config.motionPreset,
          imageVideoEngine: config.imageVideoEngine,
          motionIntensity: config.motionIntensity,
          clipDuration: config.clipDuration,
          aspectRatio: config.aspectRatio,
          style: config.style,
          voiceId: config.voiceId,
          musicMood: config.musicMood,
          captionStyle: config.captionStyle,
          aiModel: config.aiModel || 'chatgpt-astra',
          niche: config.niche || 'general',
          trendingEffect: config.trendingEffect || 'none',
          hookSfx: config.hookSfx || 'impact',
          defaultTransition: config.defaultTransition || 'fade',
        }),
      });

      if (!resp.ok) {
        throw new Error(`Erreur HTTP: ${resp.status}`);
      }

      const directedProject: GeneratedVideo = await resp.json();

      setGenerationProgress(46);
      setGenerationStatus(`Synthèse des clips vidéo animés (${config.imageVideoEngine})...`);

      const animatedScenes = [];
      for (let i = 0; i < imageItems.length; i++) {
        const sourceItem = imageItems[i];
        const aiScene = directedProject.scenes[i];
        const chosenPreset: ImageMotionPreset =
          config.motionPreset !== 'auto'
            ? config.motionPreset
            : aiScene?.motionPreset || 'orbit-3d';

        setGenerationStatus(
          `Animation IA du plan ${i + 1}/${imageItems.length} (${chosenPreset})...`
        );

        const clip = await synthesizeImageToVideoClip({
          imageUrl: sourceItem.previewUrl,
          motionPreset: chosenPreset,
          intensity: config.motionIntensity,
          aspectRatio: config.aspectRatio,
          durationSeconds: config.clipDuration,
          focalPoint: aiScene?.focalPoint || { x: 0.5, y: 0.45 },
        });

        const pct = Math.round(48 + ((i + 1) / imageItems.length) * 44);
        setGenerationProgress(pct);

        animatedScenes.push({
          ...aiScene,
          sceneNumber: i + 1,
          durationSeconds: config.clipDuration,
          imageUrl: sourceItem.previewUrl,
          mediaType: 'video' as const,
          videoUrl: clip.videoUrl,
          motionPreset: chosenPreset,
          motionIntensity: config.motionIntensity,
          aiAnimated: true,
          transition: aiScene?.transition || config.defaultTransition || 'fade',
        });
      }

      // Ajouter les éventuelles vidéos importées à la suite
      const appendedVideos = videoItems.map((vid, vIdx) => ({
        sceneNumber: animatedScenes.length + vIdx + 1,
        voiceoverText: `Séquence vidéo complémentaire : ${vid.name.replace(/\.[^/.]+$/, '')}.`,
        durationSeconds: vid.durationSeconds || 6,
        visualDescription: `Vidéo importée (${vid.name})`,
        imagePrompt: vid.name,
        visualThemeKeyword: 'cinematic',
        keywords: ['vidéo', 'montage'],
        kenBurnsEffect: 'zoom-in' as const,
        imageUrl: vid.previewUrl,
        mediaType: 'video' as const,
        videoUrl: vid.videoUrl,
        transition: config.defaultTransition || 'fade',
      }));

      const allScenes = [...animatedScenes, ...appendedVideos];
      const finalProject: GeneratedVideo = {
        ...directedProject,
        id: `fofo-i2v-${Date.now()}`,
        aspectRatio: config.aspectRatio,
        style: config.style,
        voiceId: config.voiceId,
        musicMood: config.musicMood,
        captionStyle: config.captionStyle,
        karaokeHighlightColor: config.karaokeHighlightColor,
        defaultTransition: config.defaultTransition,
        trendingEffect: config.trendingEffect,
        hookSfx: config.hookSfx,
        aiModel: config.aiModel || 'chatgpt-astra',
        imageVideoEngine: config.imageVideoEngine,
        niche: config.niche || 'general',
        totalEstimatedDuration: allScenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0),
        scenes: allScenes,
        createdAt: new Date().toISOString(),
      };

      setGenerationProgress(98);
      setGenerationStatus('Finalisation dans le Cinema Studio...');

      if (user.plan === 'free') {
        setUser((prev) => ({
          ...prev,
          creditsRemaining: Math.max(0, prev.creditsRemaining - 1),
        }));
      }

      setCreations((prev) => [finalProject, ...prev]);
      setCurrentVideo(finalProject);
      setCurrentTab('studio');

      setTimeout(() => {
        const el = document.getElementById('studio-player-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 150);

      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.5 },
          colors: ['#DD2A7B', '#0095F6', '#F58529', '#FFFFFF'],
        });
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Erreur Image -> Vidéo IA:', error);
      setGenerationError("Une erreur est survenue pendant la transformation des images en vidéo IA.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      setGenerationStatus(null);
    }
  };

  // Ajouter directement une image libre de droits trouvée dans HeroStudio comme nouvelle scène de la vidéo active
  const handleAddStockImageToCurrentVideo = (item: { name: string; previewUrl: string; query?: string }) => {
    if (!currentVideo) return;
    const effects: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
      'zoom-in',
      'pan-right',
      'zoom-out',
      'pan-left',
    ];
    const nextIdx = currentVideo.scenes.length;
    const newScene = {
      sceneNumber: nextIdx + 1,
      voiceoverText: item.query
        ? `Illustration visuelle : ${item.name || item.query}.`
        : `Séquence ajoutée : ${item.name}.`,
      durationSeconds: 5,
      visualDescription: `Image libre de droits : ${item.name}`,
      imagePrompt: item.name,
      visualThemeKeyword: 'cinematic',
      keywords: [item.query || 'visuel'],
      kenBurnsEffect: effects[nextIdx % effects.length],
      imageUrl: item.previewUrl,
      mediaType: 'image' as const,
      transition: currentVideo.defaultTransition || 'fade',
    };
    const updatedScenes = [...currentVideo.scenes, newScene];
    const updatedVideo: GeneratedVideo = {
      ...currentVideo,
      scenes: updatedScenes,
      totalEstimatedDuration: updatedScenes.reduce((acc, s) => acc + (s.durationSeconds || 5), 0),
    };
    setCurrentVideo(updatedVideo);
    setCreations((prev) => prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v)));
  };

  // Sélection d'un modèle viral
  const handleSelectTemplate = (template: VideoTemplate) => {
    handleGenerate({
      prompt: template.samplePrompt,
      aspectRatio: template.aspectRatio,
      duration: template.duration,
      voiceId: template.voiceId,
      style: template.style,
      musicMood: template.musicMood,
      captionStyle: template.captionStyle,
      karaokeHighlightColor: template.karaokeHighlightColor,
      trendingEffect: template.trendingEffect,
      hookSfx: template.hookSfx,
    });
  };

  const handleCustomizeTemplate = (template: VideoTemplate) => {
    setCoachDraft({
      prompt: template.samplePrompt,
      style: template.style,
      aspectRatio: template.aspectRatio,
      duration: template.duration,
      voiceId: template.voiceId,
      musicMood: template.musicMood,
      captionStyle: template.captionStyle,
      karaokeHighlightColor: template.karaokeHighlightColor,
      trendingEffect: template.trendingEffect,
      hookSfx: template.hookSfx,
      id: Date.now(),
    });
    setCurrentTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCreatorPersona = (persona: CreatorPersona, customPrompt?: string) => {
    handleGenerate({
      prompt: (customPrompt && customPrompt.trim()) || persona.sampleTopics[0].prompt,
      aspectRatio: persona.aspectRatio,
      duration: persona.duration,
      voiceId: persona.voiceId,
      style: persona.style,
      musicMood: persona.musicMood,
      captionStyle: persona.captionStyle,
      karaokeHighlightColor: persona.karaokeHighlightColor,
      trendingEffect: persona.trendingEffect,
      hookSfx: persona.hookSfx,
    });
  };

  const handleCustomizeCreatorPersona = (persona: CreatorPersona, customPrompt?: string) => {
    setCoachDraft({
      prompt: (customPrompt && customPrompt.trim()) || persona.sampleTopics[0].prompt,
      style: persona.style,
      aspectRatio: persona.aspectRatio,
      duration: persona.duration,
      voiceId: persona.voiceId,
      musicMood: persona.musicMood,
      captionStyle: persona.captionStyle,
      karaokeHighlightColor: persona.karaokeHighlightColor,
      trendingEffect: persona.trendingEffect,
      hookSfx: persona.hookSfx,
      creatorName: persona.name,
      id: Date.now(),
    });
    setCurrentTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAnimatedInfluencerVideo = (video: GeneratedVideo) => {
    setCreations((prev) => [video, ...prev]);
    setCurrentVideo(video);
    setCurrentTab('studio');
    setTimeout(() => {
      const el = document.getElementById('studio-player-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleUpdateVideo = (updated: GeneratedVideo) => {
    setCurrentVideo(updated);
    setCreations((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  const handleSaveToCreations = (video: GeneratedVideo) => {
    setCreations((prev) => {
      const exists = prev.some((v) => v.id === video.id);
      if (exists) {
        return prev.map((v) => (v.id === video.id ? video : v));
      } else {
        return [video, ...prev];
      }
    });
  };

  const handleDeleteVideo = (id: string) => {
    setCreations((prev) => prev.filter((v) => v.id !== id));
    if (currentVideo?.id === id) {
      setCurrentVideo(null);
    }
  };

  const handleToggleFavorite = (id: string) => {
    setCreations((prev) =>
      prev.map((v) => (v.id === id ? { ...v, isFavorite: !v.isFavorite } : v))
    );
    if (currentVideo?.id === id) {
      setCurrentVideo((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  // Gestion de Ma Bibliothèque (Scripts, Images, Voix off personnalisées)
  const triggerLibraryToast = (msg: string) => {
    setLibraryToast(msg);
    setTimeout(() => setLibraryToast(null), 3200);
  };

  const handleSaveToLibrary = (item: LibraryItem) => {
    setLibraryItems((prev) => [item, ...prev]);
    triggerLibraryToast(`« ${item.title.slice(0, 36)} » ajouté à Ma Bibliothèque`);
  };

  const handleAddLibraryItem = (item: LibraryItem) => {
    setLibraryItems((prev) => [item, ...prev]);
  };

  const handleUpdateLibraryItem = (updated: LibraryItem) => {
    setLibraryItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleDeleteLibraryItem = (id: string) => {
    setLibraryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleLibraryFavorite = (id: string) => {
    setLibraryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
    );
  };

  const handleReuseLibraryScript = (
    item: LibraryItem,
    mode: 'studio-draft' | 'open-project'
  ) => {
    const script = item.scriptData;
    if (!script) return;

    if (mode === 'open-project' && script.scenes && script.scenes.length > 0) {
      const effects: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
        'zoom-in',
        'pan-right',
        'zoom-out',
        'pan-left',
      ];
      const fallbackImages = [
        'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
      ];
      const builtScenes = script.scenes.map((sc, idx) => ({
        sceneNumber: idx + 1,
        voiceoverText: sc.voiceoverText,
        durationSeconds: sc.durationSeconds || 6,
        visualDescription: sc.visualDescription || `Scène ${idx + 1}`,
        imagePrompt: sc.imagePrompt || sc.visualDescription || item.title,
        visualThemeKeyword: script.style || 'cinematic',
        keywords: item.tags.slice(0, 3),
        kenBurnsEffect: effects[idx % effects.length],
        imageUrl: fallbackImages[idx % fallbackImages.length],
        mediaType: 'image' as const,
        transition: 'fade' as const,
      }));
      const project: GeneratedVideo = {
        id: `fofo-lib-${Date.now()}`,
        title: item.title,
        hook: script.hook || script.scenes[0]?.voiceoverText || item.title,
        description: script.prompt,
        hashtags: item.tags.length > 0 ? item.tags.map((t) => `#${t}`) : ['#FOFOAI', '#Studio'],
        aspectRatio: script.aspectRatio || '9:16',
        style: script.style || 'cinematic',
        voiceId: currentVideo?.voiceId || 'mathieu',
        musicMood: currentVideo?.musicMood || 'epic',
        captionStyle: currentVideo?.captionStyle || 'hormozi',
        niche: script.niche || 'general',
        defaultTransition: 'fade',
        totalEstimatedDuration: builtScenes.reduce((acc, s) => acc + s.durationSeconds, 0),
        scenes: builtScenes,
        createdAt: new Date().toISOString(),
      };
      setCreations((prev) => [project, ...prev]);
      setCurrentVideo(project);
      setCurrentTab('studio');
      setTimeout(() => {
        document.getElementById('studio-player-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    setCoachDraft({
      prompt: script.prompt || script.hook || item.title,
      style: script.style,
      id: Date.now(),
    });
    setCurrentTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReuseLibraryImage = (
    item: LibraryItem,
    mode: 'add-scene' | 'studio-rush'
  ) => {
    if (!item.imageData?.imageUrl) return;
    if (mode === 'add-scene' && currentVideo) {
      handleAddStockImageToCurrentVideo({
        name: item.title,
        previewUrl: item.imageData.imageUrl,
        query: item.tags[0],
      });
      setCurrentTab('studio');
      setTimeout(() => {
        document.getElementById('studio-player-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    setLibraryMediaRush({
      id: Date.now(),
      item: {
        id: `lib-rush-${item.id}-${Date.now()}`,
        name: item.title,
        mediaType: 'image',
        previewUrl: item.imageData.imageUrl,
        durationSeconds: 5,
      },
    });
    setCurrentTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReuseLibraryVoice = (
    item: LibraryItem,
    mode: 'active-video' | 'studio-default'
  ) => {
    if (!item.voiceData) return;
    if (mode === 'active-video' && currentVideo) {
      handleUpdateVideo({
        ...currentVideo,
        voiceId: item.id,
      });
      setCurrentTab('studio');
      setTimeout(() => {
        document.getElementById('studio-player-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    setLibraryVoiceSelection({
      voiceId: item.id,
      id: Date.now(),
    });
    setCurrentTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCheckout = (plan: 'pro' | 'business', billingCycle: BillingCycle = 'annual') => {
    setCheckoutTarget({ plan, billingCycle });
  };

  const handlePaymentCompleted = (result: {
    plan: 'pro' | 'business';
    billingCycle: BillingCycle;
    provider: PaymentProvider;
    transactionId: string;
    cardLast4?: string;
  }) => {
    const isBiz = result.plan === 'business';
    setUser((prev) => ({
      ...prev,
      plan: result.plan,
      creditsRemaining: isBiz ? 9999 : 999,
      maxCredits: isBiz ? 9999 : 999,
      paymentProvider: result.provider,
      billingCycle: result.billingCycle,
      lastPaymentId: result.transactionId,
      cardLast4: result.cardLast4,
    }));
    if (isBiz) {
      setExportQuality('4k-60');
    }
    setIsPricingOpen(false);
    try {
      confetti({
        particleCount: isBiz ? 120 : 100,
        spread: isBiz ? 100 : 90,
        origin: { y: 0.5 },
        colors: isBiz
          ? ['#10B981', '#00D2FF', '#FFFFFF', '#3B82F6', '#F59E0B']
          : ['#F59E0B', '#00D2FF', '#FFFFFF', '#3B82F6'],
      });
    } catch {
      // ignore
    }
  };

  const handleUpgradeToPro = () => {
    handleOpenCheckout('pro', 'annual');
  };

  const handleUpgradeToBusiness = () => {
    handleOpenCheckout('business', 'monthly');
  };

  const handleChangeExportQuality = (q: ExportQualityPreset) => {
    setExportQuality(q);
    try {
      localStorage.setItem('fofo_export_quality', q);
    } catch {
      // ignore
    }
  };

  const handleStudioContextChange = useCallback(
    (ctx: { prompt: string; style: VideoStyle; aspectRatio: AspectRatio }) => {
      setStudioContext(ctx);
    },
    []
  );

  const handleApplyCoachPrompt = (promptText: string, style?: VideoStyle) => {
    setCoachDraft({ prompt: promptText, style, id: Date.now() });
    setCurrentTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyCoachToActiveVideo = (patch: {
    hook?: string;
    title?: string;
    hashtags?: string[];
  }) => {
    if (!currentVideo) return;
    const updated: GeneratedVideo = {
      ...currentVideo,
      hook: patch.hook || currentVideo.hook,
      title: patch.title || currentVideo.title,
      hashtags: patch.hashtags && patch.hashtags.length > 0 ? patch.hashtags : currentVideo.hashtags,
    };
    handleUpdateVideo(updated);
  };

  const handleBatchVideosGenerated = (videos: GeneratedVideo[]) => {
    setCreations((prev) => [...videos, ...prev]);
    if (videos[0]) {
      setCurrentVideo(videos[0]);
    }
  };

  const handleExecuteBotAction = (action: BotExecutableAction) => {
    if (action.type === 'generate_video' && action.prompt) {
      handleGenerate({
        prompt: action.prompt,
        aspectRatio: action.aspectRatio || studioContext.aspectRatio || '9:16',
        duration: action.duration || 45,
        voiceId: currentVideo?.voiceId || 'mathieu',
        style: action.style || studioContext.style || 'cinematic',
        musicMood: action.musicMood || currentVideo?.musicMood || 'epic',
        captionStyle: action.captionStyle || currentVideo?.captionStyle || 'hormozi',
        aiModel: action.aiModel || 'chatgpt-astra',
        niche: action.niche || 'general',
      });
      return;
    }

    if (action.type === 'update_active_video' && currentVideo) {
      handleUpdateVideo({
        ...currentVideo,
        title: action.title || currentVideo.title,
        hook: action.hook || currentVideo.hook,
        hashtags: action.hashtags && action.hashtags.length > 0 ? action.hashtags : currentVideo.hashtags,
        captionStyle: action.captionStyle || currentVideo.captionStyle,
        musicMood: action.musicMood || currentVideo.musicMood,
      });
      setCurrentTab('studio');
      setTimeout(() => {
        document.getElementById('studio-player-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    if (action.type === 'send_to_studio' && action.prompt) {
      handleApplyCoachPrompt(action.prompt, action.style);
      return;
    }

    if (action.type === 'navigate' && action.targetTab) {
      setCurrentTab(action.targetTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDowngradeToFree = () => {
    setUser((prev) => ({
      ...prev,
      plan: 'free',
      creditsRemaining: 3,
      maxCredits: 3,
    }));
    setIsPricingOpen(false);
  };

  const handleAddCredits = () => {
    setUser((prev) => ({
      ...prev,
      creditsRemaining: prev.creditsRemaining + 5,
    }));
    alert('5 crédits gratuits ont été ajoutés à votre compte !');
  };

  return (
    <div
      className={`min-h-screen flex flex-col selection:bg-[#0095F6] selection:text-white transition-colors duration-300 ${
        resolvedTheme === 'neon-contrast'
          ? 'bg-[#000000] text-white theme-neon-contrast'
          : 'bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100'
      }`}
    >
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        openPricingModal={() => setIsPricingOpen(true)}
        openUserModal={() => setIsUserModalOpen(true)}
        openAuthModal={(mode) => handleOpenAuthModal(mode, 'manual')}
        onAppInstalled={() => {
          if (!user.isAuthenticated) {
            handleOpenAuthModal('signup', 'post-download');
          }
        }}
        onOpenPostInstallAuth={() => handleOpenAuthModal('signup', 'post-download')}
        creationsCount={creations.length}
        libraryCount={libraryItems.length}
        currentTheme={theme}
        resolvedTheme={resolvedTheme}
        systemScheme={systemScheme}
        onThemeChange={handleThemeChange}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'studio' && (
          <div className="w-full home-multicolor-fast-bg">
            <div className="relative z-10 max-w-[1640px] mx-auto px-4 sm:px-6 pt-3 pb-16 space-y-4">
            {/* Compact Higgsfield Cinema Studio Sub-Header Bar */}
            <div className="p-3 sm:px-4 rounded-2xl bg-white/90 dark:bg-[#0D0D11]/75 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl ig-story-ring p-[1.5px] shrink-0">
                  <div className="w-full h-full rounded-[10px] bg-white dark:bg-black flex items-center justify-center text-zinc-900 dark:text-white">
                    <Film className="w-4 h-4" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-white">Cinema Studio</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[340px] text-zinc-700 dark:text-zinc-300">
                      {currentVideo ? currentVideo.title : 'Nouveau projet IA'}
                    </span>
                    {currentVideo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                          {currentVideo.aspectRatio} · {currentVideo.scenes.length} scènes
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                      {isAutoSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Sauvegarde...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            Sauvegardé localement
                            {lastAutoSavedAt
                              ? ` · ${new Date(lastAutoSavedAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}`
                              : ''}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 shrink-0">
                {/* Toggle between Atelier Vidéo & Vitrine Aigle Royal */}
                <button
                  type="button"
                  onClick={() => setShowEagleShowcase((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    showEagleShowcase
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:text-zinc-900 hover:border-zinc-300 dark:bg-[#09090B] dark:text-zinc-300 dark:border-white/[0.08] dark:hover:text-white dark:hover:border-white/25'
                  }`}
                >
                  <Feather className="w-3.5 h-3.5" />
                  <span>{showEagleShowcase ? 'Masquer Vitrine Aigle' : 'Vitrine Aigle 3D'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('stats')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#09090B] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Voir les performances et statistiques simulées"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Analytics</span>
                </button>

                {currentVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      const exportBtn = document.querySelector('[data-export-btn]') as HTMLButtonElement;
                      if (exportBtn) {
                        exportBtn.click();
                      } else {
                        const el = document.getElementById('studio-player-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg font-heading text-xs font-bold text-white electric-button-gradient flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exporter MP4</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Eagle 3D Showcase Stage (Visible by default, toggleable) */}
            {showEagleShowcase && (
              <div className="rounded-3xl home-hero-multicolor-fast border border-white/[0.15] ring-1 ring-inset ring-white/[0.08] p-5 sm:p-8 flex flex-col items-center justify-center space-y-4">
                <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-4">
                  <LandingEagle />
                  <div className="text-center max-w-2xl space-y-2">
                    <h1 className="text-2xl sm:text-4xl font-extrabold font-heading tracking-tight leading-[1.1] text-white [text-wrap:balance]">
                      Transformez vos idées en{' '}
                      <span className="home-hero-gradient-text">vidéos IA virales</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Script automatique, voix off naturelle, visuels cinématiques, musique rythmée et sous-titres animés prêts pour Instagram Reels, TikTok et YouTube.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main 3-Zone Higgsfield Workstation Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              {/* Left Director & Generator Panel */}
              <div className="xl:col-span-4 2xl:col-span-3 xl:sticky xl:top-[68px]">
                <HeroStudio
                  onGenerate={handleGenerate}
                  onImportMediaProject={handleImportMediaProject}
                  onGenerateImageToVideo={handleGenerateImageToVideo}
                  isGenerating={isGenerating}
                  user={user}
                  openPricingModal={() => setIsPricingOpen(true)}
                  onScrollToPlayer={() => {
                    const el = document.getElementById('studio-player-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  externalDraft={coachDraft}
                  onOpenCoach={() => setIsCoachOpen(true)}
                  onOpenTemplates={() => setCurrentTab('templates')}
                  onContextChange={handleStudioContextChange}
                  onDraftSaved={(savedAt) => setLastAutoSavedAt(savedAt)}
                  hasActiveVideo={Boolean(currentVideo)}
                  onAddSceneToCurrentVideo={handleAddStockImageToCurrentVideo}
                  customVoices={customLibraryVoices}
                  externalMediaRush={libraryMediaRush}
                  externalVoiceSelection={libraryVoiceSelection}
                  onSaveToLibrary={handleSaveToLibrary}
                  onOpenAnimateStudio={() => setCurrentTab('animate')}
                />
              </div>

              {/* Center Cinema Stage + Multi-Scene Storyboard + Right Inspector */}
              <div id="studio-player-section" className="xl:col-span-8 2xl:col-span-9 scroll-mt-20">
                {currentVideo ? (
                  <VideoStudioPlayer
                    video={currentVideo}
                    onUpdateVideo={handleUpdateVideo}
                    onSaveToCreations={handleSaveToCreations}
                    onNewVideo={() => {
                      const input = document.getElementById('idea-input') as HTMLTextAreaElement | null;
                      input?.focus();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    user={user}
                    openPricingModal={() => setIsPricingOpen(true)}
                    onOpenStats={() => setCurrentTab('stats')}
                    exportQuality={exportQuality}
                    customVoices={customLibraryVoices}
                    onSaveToLibrary={handleSaveToLibrary}
                  />
                ) : (
                  <div className="rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none p-12 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl ig-story-ring p-[2px] mx-auto">
                      <div className="w-full h-full rounded-[14px] bg-white dark:bg-black flex items-center justify-center text-zinc-900 dark:text-white">
                        <Sparkles className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold font-heading text-zinc-900 dark:text-white">
                      Prêt à tourner votre prochaine vidéo IA
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                      Rédigez votre idée ou importez vos photos et vidéos dans le panneau Directeur IA à gauche pour lancer le montage instantané.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('idea-input') as HTMLTextAreaElement | null;
                        input?.focus();
                      }}
                      className="px-5 py-2.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Commencer un projet</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Famous Influencers Animated Video Carousel */}
            <AnimatedInfluencerShowcase
              onOpenInStudio={handleOpenAnimatedInfluencerVideo}
              onOpenCopyrightModal={() => setIsCopyrightOpen(true)}
              layout="carousel"
            />
            </div>
          </div>
        )}

        {currentTab === 'animate' && (
          <ImageToVideoStudio
            isGenerating={isGenerating}
            onSendSequenceToCinemaStudio={(cfg) => {
              handleGenerateImageToVideo({
                media: cfg.media,
                motionPrompt: cfg.motionPrompt,
                motionPreset: cfg.motionPreset,
                imageVideoEngine: cfg.imageVideoEngine,
                motionIntensity: cfg.motionIntensity,
                clipDuration: cfg.clipDuration,
                aspectRatio: cfg.aspectRatio,
                voiceId: 'mathieu',
                style: 'cinematic',
                musicMood: 'epic',
                captionStyle: 'hormozi',
                defaultTransition: 'fade',
                trendingEffect: 'none',
                hookSfx: 'impact',
                aiModel: 'chatgpt-astra',
                niche: 'storytelling',
              });
            }}
          />
        )}

        {currentTab === 'creations' && (
          <MyCreationsView
            creations={creations}
            onOpenVideo={(video) => {
              setCurrentVideo(video);
              setCurrentTab('studio');
            }}
            onDeleteVideo={handleDeleteVideo}
            onToggleFavorite={handleToggleFavorite}
            onCreateNew={() => setCurrentTab('studio')}
            user={user}
          />
        )}

        {currentTab === 'library' && (
          <MyLibraryView
            items={libraryItems}
            currentVideo={currentVideo}
            onAddItem={handleAddLibraryItem}
            onUpdateItem={handleUpdateLibraryItem}
            onDeleteItem={handleDeleteLibraryItem}
            onToggleFavorite={handleToggleLibraryFavorite}
            onReuseScript={handleReuseLibraryScript}
            onReuseImage={handleReuseLibraryImage}
            onReuseVoice={handleReuseLibraryVoice}
          />
        )}

        {currentTab === 'templates' && (
          <TemplatesGallery
            onSelectTemplate={handleSelectTemplate}
            onCustomizeTemplate={handleCustomizeTemplate}
            onSelectCreatorPersona={handleSelectCreatorPersona}
            onCustomizeCreatorPersona={handleCustomizeCreatorPersona}
            onOpenAnimatedVideo={handleOpenAnimatedInfluencerVideo}
            onOpenCopyrightModal={() => setIsCopyrightOpen(true)}
          />
        )}

        {currentTab === 'stats' && (
          <StatsDashboard
            currentVideo={currentVideo}
            creations={creations}
            onOpenVideoInStudio={(video) => {
              setCurrentVideo(video);
              setCurrentTab('studio');
              setTimeout(() => {
                const el = document.getElementById('studio-player-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }}
            onApplyPresetToStudio={(preset) => {
              setCurrentTab('studio');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentTab === 'business' && (
          <BusinessWorkspace
            user={user}
            exportQuality={exportQuality}
            onChangeExportQuality={handleChangeExportQuality}
            onUpgradeToBusiness={handleUpgradeToBusiness}
            onVideosGenerated={handleBatchVideosGenerated}
            onOpenVideoInStudio={(video) => {
              setCurrentVideo(video);
              setCurrentTab('studio');
              setTimeout(() => {
                const el = document.getElementById('studio-player-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }}
          />
        )}

        {currentTab === 'bot' && (
          <AIBotView
            user={user}
            studioContext={studioContext}
            currentVideo={currentVideo}
            onExecuteAction={handleExecuteBotAction}
          />
        )}

        {currentTab === 'pricing' && (
          <div className="py-8">
            <div className="max-w-6xl mx-auto px-4">
              <PricingModal
                isOpen={true}
                variant="page"
                onClose={() => {
                  setCurrentTab('studio');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onBackToHome={() => {
                  setCurrentTab('studio');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                user={user}
                onUpgradeToPro={handleUpgradeToPro}
                onUpgradeToBusiness={handleUpgradeToBusiness}
                onDowngradeToFree={handleDowngradeToFree}
                onStartCheckout={handleOpenCheckout}
              />
            </div>
          </div>
        )}
      </main>

      {/* Compagnon IA pour Créateurs de Contenu */}
      <CreatorAssistant
        isOpen={isCoachOpen}
        onToggle={() => setIsCoachOpen((v) => !v)}
        onClose={() => setIsCoachOpen(false)}
        user={user}
        studioContext={studioContext}
        currentVideo={currentVideo}
        onApplyPromptToStudio={handleApplyCoachPrompt}
        onApplyToActiveVideo={handleApplyCoachToActiveVideo}
      />

      {/* Generation Progress Overlay */}
      <GenerationModal
        isOpen={isGenerating}
        prompt={generationPrompt}
        mode={generationMode}
        customProgress={generationProgress}
        customStatus={generationStatus}
      />

      {libraryToast && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold shadow-xl flex items-center gap-3 border border-white/10 dark:border-black/10"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{libraryToast}</span>
          <button
            type="button"
            onClick={() => {
              setLibraryToast(null);
              setCurrentTab('library');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-2 py-0.5 rounded bg-[#0095F6] text-white hover:bg-[#1877F2] cursor-pointer"
          >
            Voir
          </button>
        </div>
      )}

      {generationError && (
        <div
          role="alert"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold shadow-xl flex items-center gap-3"
        >
          <span>{generationError}</span>
          <button
            type="button"
            onClick={() => setGenerationError(null)}
            className="px-2 py-0.5 rounded bg-black/25 hover:bg-black/40 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Pricing Modal (Popup) */}
      <PricingModal
        isOpen={isPricingOpen}
        variant="modal"
        onClose={() => setIsPricingOpen(false)}
        onBackToHome={() => {
          setIsPricingOpen(false);
          setCurrentTab('studio');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        user={user}
        onUpgradeToPro={handleUpgradeToPro}
        onUpgradeToBusiness={handleUpgradeToBusiness}
        onDowngradeToFree={handleDowngradeToFree}
        onStartCheckout={handleOpenCheckout}
      />

      {/* Payment Checkout Modal (PayPal, Stripe & Visa) */}
      <PaymentCheckoutModal
        isOpen={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        plan={checkoutTarget?.plan || 'pro'}
        initialBillingCycle={checkoutTarget?.billingCycle || 'annual'}
        user={user}
        onPaymentSuccess={handlePaymentCompleted}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        user={user}
        onAddCredits={handleAddCredits}
        onUpdateAvatar={(avatarUrl) => setUser((prev) => ({ ...prev, avatarUrl }))}
        onOpenAuth={(mode) => handleOpenAuthModal(mode, 'manual')}
        onLogout={handleLogout}
        onResendVerification={handleResendVerification}
        openPricingModal={() => {
          setIsUserModalOpen(false);
          setIsPricingOpen(true);
        }}
        currentTheme={theme}
        resolvedTheme={resolvedTheme}
        systemScheme={systemScheme}
        onThemeChange={handleThemeChange}
      />

      {/* Account Creation & Login Modal (Direct + Post-Download) */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        triggerSource={authModalState.source}
        onClose={handleCloseAuthModal}
        onAuthSuccess={(fbUser, displayNameOverride) => {
          if (displayNameOverride) {
            setUser((prev) => ({
              ...prev,
              name: displayNameOverride,
              email: fbUser.email || prev.email,
              uid: fbUser.uid,
              isAuthenticated: true,
              authProvider: 'password',
              emailVerified: fbUser.emailVerified,
            }));
          }
          try {
            localStorage.removeItem('fofo_pending_post_install_auth');
          } catch {
            // ignore
          }
        }}
      />

      {/* Copyright & Image Rights Modal */}
      <CopyrightModal
        isOpen={isCopyrightOpen}
        onClose={() => setIsCopyrightOpen(false)}
      />

      {/* Modern Dual-Theme Cinema Footer */}
      <footer
        className={`border-t py-8 px-4 sm:px-6 ${
          currentTab === 'studio'
            ? 'mt-0 border-white/[0.08] bg-black text-zinc-200'
            : 'mt-12 border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-black'
        }`}
      >
        <div className="max-w-[1640px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl ig-story-ring p-[1.5px]">
              <div className={`w-full h-full rounded-[10px] flex items-center justify-center ${
                currentTab === 'studio'
                  ? 'bg-black text-white'
                  : 'bg-white dark:bg-black text-zinc-900 dark:text-white'
              }`}>
                <Zap className="w-4 h-4 fill-current" />
              </div>
            </div>
            <div>
              <p className={`font-heading font-bold text-sm ${
                currentTab === 'studio' ? 'text-white' : 'text-zinc-900 dark:text-white'
              }`}>
                FOFO<span className={currentTab === 'studio' ? 'text-zinc-400 font-medium' : 'text-zinc-500 dark:text-zinc-400 font-medium'}>.ai</span>
              </p>
              <p className="text-[11px] text-zinc-500">© {new Date().getFullYear()} FOFO AI · Tous droits réservés</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <button onClick={() => setCurrentTab('studio')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Studio
            </button>
            <button onClick={() => setCurrentTab('creations')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Créations
            </button>
            <button onClick={() => setCurrentTab('library')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Ma Bibliothèque
            </button>
            <button onClick={() => setCurrentTab('templates')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Modèles
            </button>
            <button onClick={() => setCurrentTab('stats')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Stats
            </button>
            <button onClick={() => setCurrentTab('business')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Business
            </button>
            <button onClick={() => setCurrentTab('bot')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Bot AI
            </button>
            <button onClick={() => setIsPricingOpen(true)} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Tarifs
            </button>
            <button
              type="button"
              onClick={() => setIsCopyrightOpen(true)}
              className="hover:text-emerald-400 text-emerald-500 dark:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Droits d’auteur</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span>Conçu avec</span>
            <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
            <span>pour les créateurs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
