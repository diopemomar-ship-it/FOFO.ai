import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Download,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export type AuthModalMode = 'signup' | 'login' | 'reset';
export type AuthTriggerSource = 'manual' | 'post-download';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  triggerSource?: AuthTriggerSource;
  onClose: () => void;
  onAuthSuccess?: (firebaseUser: FirebaseUser, displayNameOverride?: string) => void;
}

function mapFirebaseAuthError(error: any): string {
  const code = String(error?.code || '');
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cette adresse e-mail. Passez sur « Se connecter ».';
    case 'auth/invalid-email':
      return 'Veuillez saisir une adresse e-mail valide.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
    case 'auth/popup-closed-by-user':
      return 'La fenêtre de connexion Google a été fermée avant la fin.';
    case 'auth/popup-blocked':
      return 'La fenêtre pop-up a été bloquée par votre navigateur. Autorisez les pop-ups pour ce site.';
    case 'auth/operation-not-allowed':
      return 'La connexion par e-mail/mot de passe n’est pas encore activée dans la console Firebase (Authentication > Sign-in method > Adresse e-mail/Mot de passe). Utilisez « Continuer avec Google » ci-dessus en attendant.';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion Internet puis réessayez.';
    default:
      return error?.message || 'Impossible de finaliser la connexion pour le moment.';
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signup',
  triggerSource = 'manual',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setInfoMsg(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      onAuthSuccess?.(cred.user);
      onClose();
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    if (mode === 'reset') {
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfoMsg(
          `Un lien de réinitialisation vient d’être envoyé à ${trimmedEmail}. Vérifiez votre boîte mail.`
        );
      } catch (err) {
        setErrorMsg(mapFirebaseAuthError(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (mode === 'signup') {
      if (trimmedName.length < 2) {
        setErrorMsg('Veuillez indiquer votre nom ou pseudo créateur (2 caractères minimum).');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(cred.user, { displayName: trimmedName.slice(0, 80) });
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Non-blocking if verification email fails to send
        }
        onAuthSuccess?.(cred.user, trimmedName.slice(0, 80));
        onClose();
      } else {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        onAuthSuccess?.(cred.user);
        onClose();
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/85 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.12] p-6 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fenêtre de connexion"
          className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Post-Download Celebratory Banner */}
        {triggerSource === 'post-download' && (
          <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#0095F6]/15 to-[#DD2A7B]/15 border border-emerald-500/30 text-left flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Download className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-zinc-900 dark:text-white">
                Application téléchargée avec succès !
              </p>
              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Créez votre compte ou connectez-vous maintenant pour sauvegarder vos vidéos, crédits et votre avatar sur cet appareil.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-2 mb-5">
          <div className="w-12 h-12 rounded-2xl ig-story-ring p-[2px] mx-auto">
            <div className="w-full h-full rounded-[14px] bg-white dark:bg-black flex items-center justify-center text-zinc-900 dark:text-white">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-xl font-heading font-extrabold text-zinc-900 dark:text-white tracking-tight">
            {mode === 'signup'
              ? 'Créer votre compte FOFO AI'
              : mode === 'login'
              ? 'Connexion à FOFO AI'
              : 'Réinitialiser le mot de passe'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {mode === 'signup'
              ? 'Accédez à votre studio créateur et gardez vos projets synchronisés.'
              : mode === 'login'
              ? 'Retrouvez vos vidéos IA, vos crédits et votre abonnement.'
              : 'Entrez votre e-mail pour recevoir un lien de réinitialisation.'}
          </p>
        </div>

        {/* Mode Switcher */}
        {mode !== 'reset' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#1C1C22] text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Créer un compte
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-[#1C1C22] text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Se connecter
            </button>
          </div>
        )}

        {/* Instant Google Sign-In */}
        {mode !== 'reset' && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black text-xs font-bold flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continuer avec Google (1 clic)</span>
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-zinc-200 dark:border-white/[0.08] w-full" />
              <span className="px-3 text-[11px] font-medium text-zinc-400 bg-white dark:bg-[#121214] whitespace-nowrap">
                ou avec votre e-mail
              </span>
              <div className="border-t border-zinc-200 dark:border-white/[0.08] w-full" />
            </div>
          </>
        )}

        {/* Error / Info Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Nom ou pseudo créateur
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Ex: Alex Créateur"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-[#0095F6]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Adresse e-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={160}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-[#0095F6]"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  Mot de passe
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-[11px] font-semibold text-[#0095F6] hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="Minimum 6 caractères"
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-[#0095F6]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  placeholder="Retapez votre mot de passe"
                  required
                  autoComplete="new-password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-[#0095F6]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'signup'
                    ? 'Créer mon compte'
                    : mode === 'login'
                    ? 'Se connecter'
                    : 'Envoyer le lien'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className="mt-3 w-full py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            ← Retour à la connexion
          </button>
        )}

        <div className="mt-4 pt-3.5 border-t border-zinc-200/80 dark:border-white/[0.08] flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Authentification sécurisée Firebase · Vos créations locales restent conservées.</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
          >
            Continuer en mode invité pour l’instant
          </button>
        </div>
      </div>
    </div>
  );
};
