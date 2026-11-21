import React, { useEffect, useState } from 'react';
import {
  X,
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Download,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Crown,
  Briefcase,
} from 'lucide-react';
import { BillingCycle, PaymentProvider, UserSubscription } from '../types';
import { escapeHtml } from '../utils/security';

function isTrustedCheckoutUrl(rawUrl: string, expectedProvider: 'stripe' | 'paypal'): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (expectedProvider === 'stripe') {
      return host === 'checkout.stripe.com';
    }
    return host === 'www.paypal.com' || host === 'www.sandbox.paypal.com';
  } catch {
    return false;
  }
}

interface PaymentCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: 'pro' | 'business';
  initialBillingCycle: BillingCycle;
  user: UserSubscription;
  onPaymentSuccess: (result: {
    plan: 'pro' | 'business';
    billingCycle: BillingCycle;
    provider: PaymentProvider;
    transactionId: string;
    cardLast4?: string;
  }) => void;
}

interface PaymentGatewayConfig {
  stripeConfigured: boolean;
  paypalConfigured: boolean;
  paypalEnv: 'live' | 'sandbox';
}

interface PaymentReceipt {
  transactionId: string;
  provider: PaymentProvider;
  plan: 'pro' | 'business';
  billingCycle: BillingCycle;
  amountEur: number;
  label: string;
  brand?: string;
  last4?: string;
  paidAt: string;
  mode: string;
}

function luhnIsValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

function detectBrand(digits: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'CARTE' {
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  return 'CARTE';
}

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  isOpen,
  onClose,
  plan,
  initialBillingCycle,
  user,
  onPaymentSuccess,
}) => {
  const [provider, setProvider] = useState<PaymentProvider>('visa');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>({
    stripeConfigured: false,
    paypalConfigured: false,
    paypalEnv: 'sandbox',
  });

  // Form states
  const [email, setEmail] = useState<string>(user.email || 'creator@fofo.ai');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [expiry, setExpiry] = useState<string>('');
  const [cvc, setCvc] = useState<string>('');
  const [cardholderName, setCardholderName] = useState<string>(user.name || '');
  const [paypalEmail, setPaypalEmail] = useState<string>(user.email || '');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    setBillingCycle(initialBillingCycle);
  }, [initialBillingCycle]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setReceipt(null);
    setRedirectUrl(null);
    setEmail(user.email || 'creator@fofo.ai');
    setCardholderName(user.name || '');
    setPaypalEmail(user.email || '');

    fetch('/api/payments/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg) setGatewayConfig(cfg);
      })
      .catch(() => {
        // fallback sandbox config
      });
  }, [isOpen, user.email, user.name]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const monthlyUnit =
    plan === 'business'
      ? billingCycle === 'annual'
        ? 35
        : 44
      : billingCycle === 'annual'
      ? 15
      : 19;
  const totalEur = billingCycle === 'annual' ? monthlyUnit * 12 : monthlyUnit;
  const planTitle = plan === 'business' ? 'Tarif Business' : 'Créateur PRO';
  const rawDigits = cardNumber.replace(/\D/g, '');
  const cardBrand = detectBrand(rawDigits);

  const fillDemoVisa = () => {
    setCardNumber('4242 4242 4242 4242');
    setExpiry('12/29');
    setCvc('424');
    if (!cardholderName.trim()) setCardholderName(user.name || 'Créateur FOFO');
    setErrorMsg(null);
  };

  const handlePayVisa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!luhnIsValid(rawDigits)) {
      setErrorMsg('Veuillez saisir un numéro de carte Visa / bancaire valide (16 chiffres).');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setErrorMsg('Veuillez saisir une date d’expiration au format MM/AA.');
      return;
    }
    if (cvc.replace(/\D/g, '').length < 3) {
      setErrorMsg('Veuillez saisir un code de sécurité CVC valide (3 ou 4 chiffres).');
      return;
    }
    if (!cardholderName.trim()) {
      setErrorMsg('Veuillez saisir le nom figurant sur la carte.');
      return;
    }

    setIsProcessing(true);
    try {
      const resp = await fetch('/api/payments/visa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          billingCycle,
          cardNumber: rawDigits,
          expiry,
          cvc,
          cardholderName,
          email,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || 'Paiement refusé.');
      }

      const nextReceipt: PaymentReceipt = {
        transactionId: data.transactionId,
        provider: 'visa',
        plan,
        billingCycle,
        amountEur: data.amountEur,
        label: data.label,
        brand: data.brand,
        last4: data.last4,
        paidAt: data.paidAt,
        mode: data.mode,
      };
      setReceipt(nextReceipt);
      onPaymentSuccess({
        plan,
        billingCycle,
        provider: 'visa',
        transactionId: data.transactionId,
        cardLast4: data.last4,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du paiement par carte Visa.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayStripe = async () => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const resp = await fetch('/api/payments/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle, email }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || 'Erreur Stripe Checkout.');
      }

      if (data.mode === 'live' && data.checkoutUrl) {
        if (!isTrustedCheckoutUrl(data.checkoutUrl, 'stripe')) {
          throw new Error('URL de redirection Stripe non autorisée.');
        }
        setRedirectUrl(data.checkoutUrl);
        window.location.assign(data.checkoutUrl);
        return;
      }

      const nextReceipt: PaymentReceipt = {
        transactionId: data.transactionId,
        provider: 'stripe',
        plan,
        billingCycle,
        amountEur: data.amountEur,
        label: data.label,
        paidAt: data.paidAt,
        mode: data.mode,
      };
      setReceipt(nextReceipt);
      onPaymentSuccess({
        plan,
        billingCycle,
        provider: 'stripe',
        transactionId: data.transactionId,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible d’initialiser Stripe Checkout.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayPayPal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const resp = await fetch('/api/payments/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle, paypalEmail }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || 'Erreur PayPal.');
      }

      if (data.mode === 'live' && data.approveUrl) {
        if (!isTrustedCheckoutUrl(data.approveUrl, 'paypal')) {
          throw new Error('URL de redirection PayPal non autorisée.');
        }
        setRedirectUrl(data.approveUrl);
        window.location.assign(data.approveUrl);
        return;
      }

      const nextReceipt: PaymentReceipt = {
        transactionId: data.transactionId,
        provider: 'paypal',
        plan,
        billingCycle,
        amountEur: data.amountEur,
        label: data.label,
        paidAt: data.paidAt,
        mode: data.mode,
      };
      setReceipt(nextReceipt);
      onPaymentSuccess({
        plan,
        billingCycle,
        provider: 'paypal',
        transactionId: data.transactionId,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible d’initialiser le paiement PayPal.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receipt) return;
    const providerLabel =
      receipt.provider === 'visa'
        ? `${receipt.brand || 'Visa'} •••• ${receipt.last4 || '4242'}`
        : receipt.provider === 'stripe'
        ? 'Stripe Checkout'
        : 'PayPal';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Reçu FOFO AI — ${escapeHtml(receipt.transactionId)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background:#f8fafc; color:#0f172a; padding:40px; }
  .box { max-width:640px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:32px; }
  .badge { display:inline-block; background:#dcfce7; color:#166534; font-weight:700; font-size:12px; padding:4px 10px; border-radius:6px; }
  .row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }
</style>
</head>
<body>
  <div class="box">
    <span class="badge">PAIEMENT CONFIRMÉ</span>
    <h1 style="margin:14px 0 4px;">Reçu de Paiement FOFO AI Studio</h1>
    <p style="color:#64748b;font-size:13px;margin-top:0;">Transaction : ${escapeHtml(receipt.transactionId)}</p>
    <div class="row"><span>Offre souscrite</span><strong>${escapeHtml(receipt.label)}</strong></div>
    <div class="row"><span>Moyen de paiement</span><strong>${escapeHtml(providerLabel)}</strong></div>
    <div class="row"><span>Client / Facturation</span><strong>${escapeHtml(email)}</strong></div>
    <div class="row"><span>Date</span><strong>${escapeHtml(new Date(receipt.paidAt).toLocaleString('fr-FR'))}</strong></div>
    <div class="row" style="border-bottom:none;font-size:16px;"><span>Total réglé (TTC)</span><strong>${escapeHtml(receipt.amountEur)} € EUR</strong></div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Recu_FOFO_AI_${receipt.transactionId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[60] p-4 bg-black/75 backdrop-blur-md overflow-y-auto"
      onClick={() => !isProcessing && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="min-h-full flex items-center justify-center py-6">
        <div
          className="w-full max-w-3xl rounded-3xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-white/[0.12] shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-4 bg-zinc-50 dark:bg-[#0B0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 id="checkout-modal-title" className="text-base sm:text-lg font-extrabold font-heading">
                Paiement Sécurisé · {planTitle}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                PayPal, Stripe Checkout &amp; Carte Visa / Mastercard · Chiffrement SSL 256-bit
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            aria-label="Fermer le paiement"
            className="p-2 rounded-xl bg-white dark:bg-[#18181D] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {receipt ? (
          /* Success Receipt View */
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-extrabold font-heading text-zinc-900 dark:text-white">
                Abonnement {planTitle} activé !
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                Votre règlement de <strong className="text-zinc-900 dark:text-white">{receipt.amountEur} €</strong> a bien été confirmé.
              </p>
            </div>

            <div className="max-w-md mx-auto rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] p-4 space-y-2.5 text-xs text-left">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">N° de transaction</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">{receipt.transactionId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Moyen de paiement</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {receipt.provider === 'visa'
                    ? `${receipt.brand || 'Visa'} •••• ${receipt.last4}`
                    : receipt.provider === 'stripe'
                    ? 'Stripe Checkout'
                    : 'PayPal'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Formule</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{receipt.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">E-mail de facturation</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-[#22222A] border border-zinc-200 dark:border-white/[0.1] text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le reçu</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Accéder au Studio {plan === 'business' ? 'Business' : 'PRO'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Body */
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Payment Methods + Form */}
            <div className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-white/[0.08]">
              {/* Method Selector Tabs */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Choisissez votre moyen de paiement
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('visa');
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      provider === 'visa'
                        ? 'bg-blue-500/10 border-[#1A1F71] dark:border-blue-400 ring-1 ring-[#1A1F71] dark:ring-blue-400'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black tracking-wider text-[#1A1F71] dark:text-blue-300 italic">
                        VISA
                      </span>
                      <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      Carte Visa / CB
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProvider('stripe');
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      provider === 'stripe'
                        ? 'bg-[#635BFF]/10 border-[#635BFF] ring-1 ring-[#635BFF]'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black tracking-tight text-[#635BFF]">
                        stripe
                      </span>
                      <Lock className="w-3.5 h-3.5 text-[#635BFF]" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      Stripe Checkout
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProvider('paypal');
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      provider === 'paypal'
                        ? 'bg-[#0070BA]/10 border-[#0070BA] ring-1 ring-[#0070BA]'
                        : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black italic">
                        <span className="text-[#003087] dark:text-sky-400">Pay</span>
                        <span className="text-[#0079C1] dark:text-cyan-300">Pal</span>
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0070BA]" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      Compte PayPal
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Redirect Info */}
              {redirectUrl && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
                  <span>Redirection sécurisée en cours…</span>
                  <a
                    href={redirectUrl}
                    target="_top"
                    className="font-bold underline inline-flex items-center gap-1"
                  >
                    <span>Continuer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Provider Forms */}
              {provider === 'visa' && (
                <form onSubmit={handlePayVisa} className="space-y-3.5">
                  {/* Live Visual Card Preview */}
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1D4ED8] text-white shadow-lg flex flex-col justify-between h-36 border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-blue-200">
                        3D Secure · FOFO AI Billing
                      </span>
                      <span className="text-sm font-black italic tracking-wider px-2 py-0.5 rounded bg-white/15">
                        {cardBrand}
                      </span>
                    </div>
                    <div className="font-mono text-base sm:text-lg tracking-[0.18em] font-semibold">
                      {cardNumber || '4242 •••• •••• 4242'}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-blue-100">
                      <span className="uppercase truncate max-w-[180px]">
                        {cardholderName || 'NOM DU TITULAIRE'}
                      </span>
                      <span className="font-mono tabular-nums">{expiry || 'MM/AA'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Accepte Visa, Visa Electron &amp; Mastercard
                    </span>
                    {!gatewayConfig.stripeConfigured && (
                      <button
                        type="button"
                        onClick={fillDemoVisa}
                        className="text-[11px] font-semibold text-[#0095F6] hover:underline cursor-pointer"
                      >
                        Remplir carte test Visa (4242…)
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      E-mail de facturation
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs focus:outline-none focus:border-[#0095F6]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Numéro de carte Visa / Bancaire
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="4242 4242 4242 4242"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs font-mono tracking-wider focus:outline-none focus:border-[#0095F6]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Expiration (MM/AA)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="12/29"
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#0095F6]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                        CVC / CVV
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="424"
                        className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#0095F6]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Nom du titulaire
                    </label>
                    <input
                      type="text"
                      required
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder="Prénom Nom"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs focus:outline-none focus:border-[#0095F6]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl font-heading text-xs font-bold text-white bg-[#1A1F71] hover:bg-[#14185A] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validation Visa sécurisée…</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Payer {totalEur} € par Visa / Carte</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {provider === 'stripe' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#635BFF]/[0.08] border border-[#635BFF]/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-[#635BFF] tracking-tight">Stripe Checkout</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#635BFF]/15 text-[#635BFF] font-bold">
                        {gatewayConfig.stripeConfigured ? 'API LIVE' : 'SANDBOX PRÊT'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {gatewayConfig.stripeConfigured
                        ? 'Vous allez être redirigé vers la page hébergée Stripe Checkout (Visa, Mastercard, Apple Pay, Google Pay, SEPA).'
                        : 'Session Stripe Checkout sécurisée (Visa, Mastercard, Apple Pay, Google Pay). Ajoutez STRIPE_SECRET_KEY côté serveur pour basculer vers vos encaissements réels.'}
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      E-mail pour le reçu Stripe
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs focus:outline-none focus:border-[#635BFF]"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handlePayStripe}
                    className="w-full py-3.5 rounded-xl font-heading text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249F5] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-md"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connexion à Stripe…</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Payer {totalEur} € avec Stripe</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {provider === 'paypal' && (
                <form onSubmit={handlePayPayPal} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#0070BA]/[0.08] border border-[#0070BA]/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black italic">
                        <span className="text-[#003087] dark:text-sky-400">Pay</span>
                        <span className="text-[#0079C1] dark:text-cyan-300">Pal</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0070BA]/15 text-[#0070BA] dark:text-sky-300 font-bold">
                        {gatewayConfig.paypalConfigured ? `API ${gatewayConfig.paypalEnv.toUpperCase()}` : 'EXPRESS SANDBOX'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {gatewayConfig.paypalConfigured
                        ? 'Réglez en 1 clic via votre compte PayPal ou PayPal 4x sans frais. Protection des achats incluse.'
                        : 'Paiement rapide via PayPal Express. Renseignez PAYPAL_CLIENT_ID et PAYPAL_CLIENT_SECRET côté serveur pour activer les encaissements réels.'}
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Adresse e-mail du compte PayPal
                    </label>
                    <input
                      type="email"
                      required
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="votre.compte@paypal.com"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.12] px-3 py-2 text-xs focus:outline-none focus:border-[#0070BA]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl font-heading text-xs font-extrabold text-[#003087] bg-[#FFC439] hover:bg-[#F5B82E] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-md"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validation PayPal…</span>
                      </>
                    ) : (
                      <span>Payer {totalEur} € avec PayPal</span>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Right: Order Summary */}
            <div className="lg:col-span-5 p-6 bg-zinc-50 dark:bg-[#0A0A0D] flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  {plan === 'business' ? (
                    <Briefcase className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
                  )}
                  <div>
                    <p className="text-sm font-extrabold font-heading">{planTitle}</p>
                    <p className="text-[11px] text-zinc-500">Accès immédiat après validation</p>
                  </div>
                </div>

                {/* Cycle switcher */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      billingCycle === 'monthly'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      billingCycle === 'annual'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Annuel (-20%)
                  </button>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-white/[0.08] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Tarif mensuel</span>
                    <span className="font-semibold tabular-nums">{monthlyUnit} € / mois</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Facturation</span>
                    <span className="font-semibold">
                      {billingCycle === 'annual' ? 'Annuelle (12 mois)' : 'Mensuelle sans engagement'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-200 dark:border-white/[0.08] text-sm">
                    <span className="font-bold">Total à régler</span>
                    <span className="text-xl font-black font-heading tabular-nums text-zinc-900 dark:text-white">
                      {totalEur} €
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Garantie satisfait ou remboursé 14 jours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#0095F6] shrink-0" />
                  <span>Facture pro avec TVA déductible envoyée par e-mail</span>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
