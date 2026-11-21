import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crown,
  Mail,
  X,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Check,
  Palette,
  Contrast,
  Briefcase,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  LogIn,
  LogOut,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { UserSubscription, AppTheme, ResolvedTheme } from '../types';
import { SystemColorScheme } from '../utils/themeManager';
import defaultAvatarImg from '../assets/images/user_default_avatar_1795170424373.jpg';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserSubscription;
  onAddCredits: () => void;
  openPricingModal: () => void;
  onUpdateAvatar?: (avatarUrl: string) => void;
  onOpenAuth?: (mode: 'signup' | 'login') => void;
  onLogout?: () => void;
  onResendVerification?: () => Promise<void>;
  currentTheme?: AppTheme;
  resolvedTheme?: ResolvedTheme;
  systemScheme?: SystemColorScheme;
  onThemeChange?: (theme: AppTheme) => void;
}

function cropImageToSquareAvatar(
  source: HTMLImageElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  size = 384
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const side = Math.min(srcW, srcH);
  const sx = Math.max(0, (srcW - side) / 2);
  const sy = Math.max(0, (srcH - side) / 2);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onAddCredits,
  openPricingModal,
  onUpdateAvatar,
  onOpenAuth,
  onLogout,
  onResendVerification,
  currentTheme = 'system',
  resolvedTheme = 'deep-night',
  systemScheme = 'dark',
  onThemeChange,
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setIsCameraOpen(false);
      setCameraError(null);
    }
  }, [isOpen, stopCameraStream]);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

  const showSuccessToast = (msg: string) => {
    setAvatarFeedback(msg);
    setTimeout(() => setAvatarFeedback(null), 2400);
  };

  const startLiveCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    stopCameraStream();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIsCameraOpen(true);
      setCameraError(
        'La caméra directe n’est pas disponible sur ce navigateur. Utilisez le bouton Appareil photo ci-dessous.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setIsCameraOpen(true);
      setCameraError(
        'Accès caméra refusé ou indisponible. Vous pouvez ouvrir l’appareil photo natif ou choisir dans la galerie.'
      );
    }
  };

  const handleCaptureCameraPhoto = () => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth || !vid.videoHeight) return;
    const dataUrl = cropImageToSquareAvatar(vid, vid.videoWidth, vid.videoHeight, 384);
    if (dataUrl && onUpdateAvatar) {
      onUpdateAvatar(dataUrl);
      showSuccessToast('Photo capturée et appliquée !');
    }
    stopCameraStream();
    setIsCameraOpen(false);
  };

  const handleFilePicked = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCameraError('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      if (!rawUrl) return;
      const img = new Image();
      img.onload = () => {
        const cropped = cropImageToSquareAvatar(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          384
        );
        if (cropped && onUpdateAvatar) {
          onUpdateAvatar(cropped);
          showSuccessToast('Photo de profil mise à jour !');
          stopCameraStream();
          setIsCameraOpen(false);
        }
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const activeTheme = currentTheme || user.theme || 'system';
  const displayedAvatar = user.avatarUrl || defaultAvatarImg;
  const isDefaultAvatar = displayedAvatar === defaultAvatarImg;

  const handleSelectTheme = (newTheme: AppTheme) => {
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const themeStatusLabel =
    activeTheme === 'system'
      ? `Auto · OS ${systemScheme === 'light' ? 'Clair' : 'Sombre'}`
      : activeTheme === 'light'
      ? 'Clair'
      : activeTheme === 'neon-contrast'
      ? 'Néon Élevé'
      : 'Insta Dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            stopCameraStream();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Fermer le profil"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hidden Inputs for Gallery & Native Camera */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files);
            e.currentTarget.value = '';
          }}
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files);
            e.currentTarget.value = '';
          }}
        />

        {/* Profil Header + Avatar Controls */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-28 h-28 rounded-full p-[3px] ig-story-ring shrink-0 shadow-lg relative">
            <img
              src={displayedAvatar}
              alt={user.name}
              onError={(e) => {
                if (e.currentTarget.src !== defaultAvatarImg) {
                  e.currentTarget.src = defaultAvatarImg;
                }
              }}
              className="w-full h-full rounded-full object-cover border-2 border-white dark:border-black bg-zinc-900"
            />
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate">{user.name}</h3>
              {user.plan === 'business' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  BUSINESS
                </span>
              )}
              {user.plan === 'pro' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  PRO
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>

            {/* Photo / Avatar Picker Actions */}
            {onUpdateAvatar && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <button
                  type="button"
                  onClick={() => startLiveCamera('user')}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Prendre photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C1C20] dark:hover:bg-white/[0.1] border border-zinc-200 dark:border-white/[0.1] text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Galerie</span>
                </button>

                {!isDefaultAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateAvatar(defaultAvatarImg);
                      showSuccessToast('Avatar par défaut rétabli');
                    }}
                    title="Remettre l'avatar par défaut"
                    className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Avatar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {avatarFeedback && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{avatarFeedback}</span>
          </div>
        )}

        {/* Live Camera Viewfinder Panel */}
        {isCameraOpen && (
          <div className="mb-5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#DD2A7B]" />
                <span>Appareil photo</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setIsCameraOpen(false);
                  setCameraError(null);
                }}
                className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Fermer
              </button>
            </div>

            {cameraError ? (
              <div className="space-y-2.5">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {cameraError}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-white electric-button-gradient flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ouvrir l’appareil photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-200 dark:bg-white/[0.08] text-zinc-900 dark:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Choisir dans la galerie</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-2 border-white/20 bg-black shadow-lg">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                  />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureCameraPhoto}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white electric-button-gradient flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capturer la photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = facingMode === 'user' ? 'environment' : 'user';
                      setFacingMode(nextMode);
                      startLiveCamera(nextMode);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-200 dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 cursor-pointer whitespace-nowrap"
                  >
                    Inverser
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statut Compte & Connexion */}
        {!user.isAuthenticated ? (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-[#0095F6]/10 via-purple-500/10 to-[#DD2A7B]/10 border border-[#0095F6]/25 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  Mode invité local
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                  Créez votre compte ou connectez-vous pour sécuriser votre profil et vos crédits.
                </p>
              </div>
            </div>
            {onOpenAuth && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth('signup');
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-bold text-white electric-button-gradient flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Créer un compte</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth('login');
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.12] text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.1] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Se connecter</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-5 px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Compte connecté ({user.authProvider === 'google' ? 'Google' : 'E-mail'})
              </span>
            </div>
            {!user.emailVerified && user.authProvider === 'password' && onResendVerification && (
              <button
                type="button"
                onClick={async () => {
                  await onResendVerification();
                  showSuccessToast('E-mail de vérification renvoyé !');
                }}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer"
              >
                Vérifier mon e-mail
              </button>
            )}
          </div>
        )}

        {/* Détails du Compte */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06] space-y-2.5 mb-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Abonnement Actuel</span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {user.plan === 'business' ? 'Tarif Business (44€ / mois)' : user.plan === 'pro' ? 'Créateur PRO (Illimité)' : 'Plan Gratuit'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Solde de Crédits</span>
            <span className="font-bold text-zinc-900 dark:text-white font-mono tabular-nums">
              {user.plan === 'pro' || user.plan === 'business' ? 'Illimités VIP' : `${user.creditsRemaining} / ${user.maxCredits}`}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Renouvellement</span>
            <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">{user.renewalDate}</span>
          </div>

          {user.paymentProvider && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/70 dark:border-white/[0.06]">
              <span className="text-zinc-500 dark:text-zinc-400">Moyen de paiement</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {user.paymentProvider === 'visa'
                  ? `Visa •••• ${user.cardLast4 || '4242'}`
                  : user.paymentProvider === 'stripe'
                  ? 'Stripe Checkout'
                  : 'PayPal'}
              </span>
            </div>
          )}
        </div>

        {/* SECTION PERSONNALISATION : Thème d'Affichage */}
        <div className="space-y-3 mb-5 p-4 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
              Thème Visuel du Studio
            </label>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
              {themeStatusLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Option 1 : Auto Système */}
            <button
              type="button"
              onClick={() => handleSelectTheme('system')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative group ${
                activeTheme === 'system'
                  ? 'bg-zinc-900/5 dark:bg-white/[0.08] border-zinc-900 dark:border-white/70'
                  : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/[0.06] hover:border-zinc-400 dark:hover:border-white/[0.16] text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {activeTheme === 'system' && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-[#18181B] flex items-center justify-center border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">Auto Système</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                Détecté : <strong className="text-zinc-900 dark:text-zinc-200">{systemScheme === 'light' ? 'Clair' : 'Sombre'}</strong> (OS)
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white border border-zinc-300" title="Mode Clair" />
                <span className="w-3 h-3 rounded-full bg-black border border-zinc-700" title="Mode Sombre" />
                <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400">
                  {resolvedTheme === 'light' ? 'Actif : Clair' : 'Actif : Dark'}
                </span>
              </div>
            </button>

            {/* Option 2 : Mode Clair */}
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative group ${
                activeTheme === 'light'
                  ? 'bg-zinc-900/5 dark:bg-white/[0.08] border-zinc-900 dark:border-white/70'
                  : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/[0.06] hover:border-zinc-400 dark:hover:border-white/[0.16] text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {activeTheme === 'light' && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-[#18181B] flex items-center justify-center border border-amber-200 dark:border-white/10 text-amber-600 dark:text-amber-300">
                  <Sun className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">Clair</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                Interface studio lumineuse haute lisibilité.
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FAFAFA] border border-zinc-300" title="#FAFAFA" />
                <span className="w-3 h-3 rounded-full bg-[#FFFFFF] border border-zinc-300" title="#FFFFFF" />
                <span className="w-3 h-3 rounded-full ig-story-ring" title="Creator Gradient" />
              </div>
            </button>

            {/* Option 3 : Insta Dark OLED */}
            <button
              type="button"
              onClick={() => handleSelectTheme('deep-night')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative group ${
                activeTheme === 'deep-night'
                  ? 'bg-zinc-900/5 dark:bg-white/[0.08] border-zinc-900 dark:border-white/70'
                  : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/[0.06] hover:border-zinc-400 dark:hover:border-white/[0.16] text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {activeTheme === 'deep-night' && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-[#18181B] flex items-center justify-center border border-zinc-700 dark:border-white/10 text-white">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">Insta Dark</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                Noir OLED pur & reflets graphite épurés.
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#000000] border border-zinc-700" title="#000000" />
                <span className="w-3 h-3 rounded-full bg-[#121214] border border-zinc-700" title="#121214" />
                <span className="w-3 h-3 rounded-full ig-story-ring" title="Creator Gradient" />
              </div>
            </button>

            {/* Option 4 : Néon Contraste Élevé */}
            <button
              type="button"
              onClick={() => handleSelectTheme('neon-contrast')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative group ${
                activeTheme === 'neon-contrast'
                  ? 'bg-black border-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.4)] ring-1 ring-[#00F0FF] text-white'
                  : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/[0.06] hover:border-cyan-500/50 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {activeTheme === 'neon-contrast' && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#00F0FF] flex items-center justify-center text-black">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-black flex items-center justify-center border border-[#00F0FF] text-[#00F0FF]">
                  <Contrast className="w-3.5 h-3.5" />
                </div>
                <span className={`text-xs font-bold ${activeTheme === 'neon-contrast' ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                  Néon Élevé
                </span>
              </div>
              <p className={`text-[10px] leading-snug ${activeTheme === 'neon-contrast' ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                Contraste cyan tranchant haute visibilité.
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#000000] border border-[#00F0FF]" title="#000000" />
                <span className="w-3 h-3 rounded-full bg-[#00F0FF]" title="#00F0FF" />
                <span className="w-3 h-3 rounded-full bg-[#FFFFFF] border border-zinc-400" title="#FFFFFF" />
              </div>
            </button>
          </div>
        </div>

        {/* Actions Rapides */}
        <div className="space-y-2.5">
          {user.plan === 'free' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                openPricingModal();
              }}
              className="w-full py-3 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              <span>Passer en PRO ou Business</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                openPricingModal();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-white/[0.1] hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {user.plan === 'business' ? (
                <>
                  <Briefcase className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>Gérer mon abonnement Business (44€)</span>
                </>
              ) : (
                <>
                  <Crown className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Gérer mon abonnement PRO</span>
                </>
              )}
            </button>
          )}

          {user.plan === 'free' && (
            <button
              type="button"
              onClick={onAddCredits}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#0095F6] bg-[#0095F6]/10 border border-[#0095F6]/25 hover:bg-[#0095F6]/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recharger 5 crédits gratuits de test</span>
            </button>
          )}

          {user.isAuthenticated && onLogout && (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
