import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Layers,
  Film,
  ShieldCheck,
  Users,
  Webhook,
  Headphones,
  Sparkles,
  Play,
  Check,
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  Download,
  Send,
  KeyRound,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  AspectRatio,
  BatchJobItem,
  ExportQualityPreset,
  GeneratedVideo,
  MusicMood,
  SupportTicket,
  TeamRole,
  TeamSeat,
  UserSubscription,
  VideoStyle,
  WebhookLog,
} from '../types';
import { VOICES, VIDEO_STYLES, MUSIC_MOODS } from '../data/mockTemplates';
import { escapeHtml } from '../utils/security';

interface BusinessWorkspaceProps {
  user: UserSubscription;
  exportQuality: ExportQualityPreset;
  onChangeExportQuality: (q: ExportQualityPreset) => void;
  onUpgradeToBusiness: () => void;
  onVideosGenerated: (videos: GeneratedVideo[]) => void;
  onOpenVideoInStudio: (video: GeneratedVideo) => void;
}

type BusinessSection = 'batch' | 'quality-license' | 'team' | 'api' | 'support';

export const BusinessWorkspace: React.FC<BusinessWorkspaceProps> = ({
  user,
  exportQuality,
  onChangeExportQuality,
  onUpgradeToBusiness,
  onVideosGenerated,
  onOpenVideoInStudio,
}) => {
  const isBusiness = user.plan === 'business';
  const [section, setSection] = useState<BusinessSection>('batch');

  // 1. Batch Generation State (jusqu'à 20 vidéos)
  const [batchTopic, setBatchTopic] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(5);
  const [rawPrompts, setRawPrompts] = useState<string>(
    [
      'Les 3 leviers psychologiques qui doublent la rétention sur TikTok',
      'Pourquoi 90% des marques ratent leurs publicités vidéo verticales',
      'Comment automatiser une chaîne YouTube Shorts rentable en 2026',
    ].join('\n')
  );
  const [batchRatio, setBatchRatio] = useState<AspectRatio>('9:16');
  const [batchStyle, setBatchStyle] = useState<VideoStyle>('cinematic');
  const [batchVoice, setBatchVoice] = useState<string>('mathieu');
  const [batchMood, setBatchMood] = useState<MusicMood>('epic');
  const [isBrainstorming, setIsBrainstorming] = useState<boolean>(false);
  const [isRunningBatch, setIsRunningBatch] = useState<boolean>(false);
  const [batchJobs, setBatchJobs] = useState<BatchJobItem[]>([]);
  const [generatedVideosMap, setGeneratedVideosMap] = useState<Record<string, GeneratedVideo>>({});

  // 2. Commercial License State
  const [companyName, setCompanyName] = useState<string>(() => localStorage.getItem('fofo_biz_company') || 'Mon Agence Média SAS');
  const [companyReg, setCompanyReg] = useState<string>(() => localStorage.getItem('fofo_biz_reg') || 'FR 88 912345678');
  const [licenseChannels, setLicenseChannels] = useState<string[]>([
    'TikTok Ads',
    'Meta Ads (Instagram & Facebook)',
    'YouTube Monétisé',
    'Campagnes TV & DOOH',
  ]);
  const [licenseSerial] = useState<string>('FOFO-BIZ-2026-8492');

  // 3. Team Seats (5 max)
  const [seats, setSeats] = useState<TeamSeat[]>(() => {
    try {
      const saved = localStorage.getItem('fofo_biz_seats');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'seat-owner',
        name: user.name,
        email: user.email,
        role: 'Admin',
        status: 'Actif',
        addedAt: "Aujourd'hui",
      },
      {
        id: 'seat-2',
        name: 'Lucas Bernard',
        email: 'lucas@agence-media.fr',
        role: 'Producteur',
        status: 'Actif',
        addedAt: 'Hier',
      },
    ];
  });
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('Éditeur');

  // 4. API & Webhooks State
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('fofo_biz_apikey') || 'fofo_live_9f4e2a8c7b1d6e0f3a9c5b2d8e4f1a7c'
  );
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>(
    () => localStorage.getItem('fofo_biz_webhook') || 'https://api.votre-entreprise.fr/webhooks/fofo'
  );
  const [webhookEvent, setWebhookEvent] = useState<string>('video.rendered');
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [lastWebhookPayload, setLastWebhookPayload] = useState<string>('');

  // 5. VIP Support 24/7 State
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    try {
      const saved = localStorage.getItem('fofo_biz_tickets');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketPriority, setTicketPriority] = useState<SupportTicket['priority']>('Prioritaire');
  const [ticketMessage, setTicketMessage] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('fofo_biz_company', companyName);
      localStorage.setItem('fofo_biz_reg', companyReg);
      localStorage.setItem('fofo_biz_seats', JSON.stringify(seats));
      localStorage.setItem('fofo_biz_apikey', apiKey);
      localStorage.setItem('fofo_biz_webhook', webhookUrl);
      localStorage.setItem('fofo_biz_tickets', JSON.stringify(tickets));
    } catch {
      // ignore
    }
  }, [companyName, companyReg, seats, apiKey, webhookUrl, tickets]);

  const parsedPrompts = rawPrompts
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  // IA: Générer jusqu'à 20 sujets par lots
  const handleGenerateBatchIdeas = async () => {
    if (!batchTopic.trim() || isBrainstorming) return;
    setIsBrainstorming(true);
    try {
      const res = await fetch('/api/business/batch-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: batchTopic.trim(), count: batchCount }),
      });
      const data = await res.json();
      if (Array.isArray(data.prompts) && data.prompts.length > 0) {
        setRawPrompts(data.prompts.slice(0, 20).join('\n'));
      }
    } catch {
      // ignore
    } finally {
      setIsBrainstorming(false);
    }
  };

  // Lancer la génération par lots (jusqu'à 20 vidéos)
  const handleRunBatch = async () => {
    if (!isBusiness) {
      onUpgradeToBusiness();
      return;
    }
    if (parsedPrompts.length === 0 || isRunningBatch) return;

    const initialJobs: BatchJobItem[] = parsedPrompts.map((p, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      prompt: p,
      status: 'pending',
    }));
    setBatchJobs(initialJobs);
    setIsRunningBatch(true);

    const createdVideos: GeneratedVideo[] = [];

    // Traitement par vagues parallèles de 3 vidéos pour fluidité
    const concurrency = 3;
    let cursor = 0;

    const worker = async () => {
      while (cursor < initialJobs.length) {
        const currentIndex = cursor++;
        const job = initialJobs[currentIndex];

        setBatchJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: 'generating' } : j))
        );

        try {
          const response = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: job.prompt,
              aspectRatio: batchRatio,
              duration: 45,
              voiceId: batchVoice,
              style: batchStyle,
              musicMood: batchMood,
              captionStyle: 'hormozi',
              defaultTransition: 'fade',
            }),
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const videoData: GeneratedVideo = await response.json();
          videoData.createdAt = new Date().toISOString();

          createdVideos.push(videoData);
          setGeneratedVideosMap((prev) => ({ ...prev, [job.id]: videoData }));
          setBatchJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: 'completed', videoId: videoData.id, title: videoData.title }
                : j
            )
          );
        } catch {
          setBatchJobs((prev) =>
            prev.map((j) =>
              j.id === job.id ? { ...j, status: 'error', error: 'Échec de génération' } : j
            )
          );
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, initialJobs.length) }, () => worker()));

    if (createdVideos.length > 0) {
      onVideosGenerated(createdVideos);
    }
    setIsRunningBatch(false);
  };

  // Téléchargement du certificat de licence commerciale
  const handleDownloadLicense = () => {
    if (!isBusiness) {
      onUpgradeToBusiness();
      return;
    }
    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Certificat de Licence Commerciale FOFO AI Business</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #0f172a; padding: 40px; }
  .cert { max-width: 780px; margin: 0 auto; background: #ffffff; border: 3px solid #10b981; border-radius: 16px; padding: 48px; }
  h1 { margin: 0 0 8px; font-size: 26px; }
  .meta { color: #475569; font-size: 13px; margin-bottom: 28px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
  ul { line-height: 1.7; font-size: 14px; }
  .footer { margin-top: 32px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
</style>
</head>
<body>
  <div class="cert">
    <h1>Certificat Officiel de Licence Commerciale Complète</h1>
    <div class="meta">Plan FOFO AI Business (44 EUR / mois) · Numéro de série : ${escapeHtml(licenseSerial)}</div>
    <p>Le présent certificat atteste que le titulaire ci-dessous dispose d'une licence d'exploitation commerciale mondiale, perpétuelle et libre de redevances sur toutes les vidéos générées via son compte FOFO AI Business.</p>
    <div class="box">
      <div class="row"><strong>Entreprise / Titulaire :</strong><span>${escapeHtml(companyName)}</span></div>
      <div class="row"><strong>Identifiant fiscal / TVA :</strong><span>${escapeHtml(companyReg || 'Non renseigné')}</span></div>
      <div class="row"><strong>Email du compte :</strong><span>${escapeHtml(user.email)}</span></div>
      <div class="row"><strong>Date d'émission :</strong><span>${escapeHtml(today)}</span></div>
    </div>
    <h3>Canaux et Droits Autorisés :</h3>
    <ul>
      ${licenseChannels.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
      <li>Rendu Ultra HD 4K 60 FPS sans filigrane et droits clients / agences inclus.</li>
    </ul>
    <div class="footer">Délivré par FOFO AI Studio · Valide tant que les œuvres ont été produites sous abonnement Business actif.</div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Licence_Commerciale_${licenseSerial}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Gestion des 5 sièges d'équipe
  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBusiness) {
      onUpgradeToBusiness();
      return;
    }
    if (!inviteName.trim() || !inviteEmail.trim() || seats.length >= 5) return;
    const newSeat: TeamSeat = {
      id: `seat-${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'Invitation envoyée',
      addedAt: "À l'instant",
    };
    setSeats((prev) => [...prev, newSeat]);
    setInviteName('');
    setInviteEmail('');
  };

  const handleRemoveSeat = (id: string) => {
    if (id === 'seat-owner') return;
    setSeats((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSeatRole = (id: string, role: TeamRole) => {
    setSeats((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
  };

  // API & Webhook actions
  const handleRegenerateKey = () => {
    if (!isBusiness) {
      onUpgradeToBusiness();
      return;
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    const randomHex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    setApiKey(`fofo_live_${randomHex}`);
  };

  const handleTestWebhook = async () => {
    if (!isBusiness) {
      onUpgradeToBusiness();
      return;
    }
    if (!webhookUrl.trim() || isTestingWebhook) return;
    setIsTestingWebhook(true);
    try {
      const res = await fetch('/api/business/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim(), event: webhookEvent }),
      });
      const data = await res.json();
      setLastWebhookPayload(JSON.stringify(data.payload || {}, null, 2));
      const log: WebhookLog = {
        id: `wh-${Date.now()}`,
        event: webhookEvent,
        url: webhookUrl.trim(),
        statusCode: data.statusCode || res.status,
        latencyMs: data.latencyMs || 0,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        ok: Boolean(data.ok),
      };
      setWebhookLogs((prev) => [log, ...prev].slice(0, 8));
    } catch {
      // ignore
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Support VIP 24/7
  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBusiness) {
      onUpgradeToBusiness();
      return;
    }
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    const newTicket: SupportTicket = {
      id: `VIP-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: ticketSubject.trim(),
      priority: ticketPriority,
      message: ticketMessage.trim(),
      status: 'Pris en charge (< 15 min)',
      createdAt: new Date().toLocaleString('fr-FR'),
      managerReply:
        'Camille Laurent (Account Manager) a bien reçu votre demande prioritaire et prépare votre réponse.',
    };
    setTickets((prev) => [newTicket, ...prev]);
    setTicketSubject('');
    setTicketMessage('');
  };

  const toggleChannel = (channel: string) => {
    setLicenseChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const curlSnippet = `curl -X POST ${window.location.origin}/api/generate-video \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "prompt": "5 tendances marketing IA incontournables en 2026",
    "aspectRatio": "9:16",
    "style": "cinematic",
    "duration": 45
  }'`;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* En-tête de l'Espace Business */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Suite Production Agences & Entreprises</span>
            <span aria-hidden="true">·</span>
            <span>Tarif Business 44€/mois</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-zinc-950 dark:text-white">
            Espace Business & Production Haute Vitesse
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Générez jusqu'à 20 vidéos simultanées, exportez en Ultra HD 4K 60 FPS sans filigrane, pilotez vos 5 sièges d'équipe, connectez vos webhooks et éditez vos licences commerciales.
          </p>
        </div>

        {!isBusiness ? (
          <button
            type="button"
            onClick={onUpgradeToBusiness}
            className="px-5 py-3 rounded-xl font-heading text-xs font-extrabold text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Briefcase className="w-4 h-4 fill-black" />
            <span>Activer le Tarif Business 44€</span>
          </button>
        ) : (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Forfait Business Actif (44€/mois)</span>
          </div>
        )}
      </div>

      {/* Navigation interne de l'Espace Business */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] overflow-x-auto">
        <button
          type="button"
          onClick={() => setSection('batch')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            section === 'batch' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Génération par lots (20)</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('quality-license')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            section === 'quality-license' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>4K 60 FPS & Licence Ads</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('team')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            section === 'team' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="tabular-nums">Équipe ({seats.length}/5)</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('api')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            section === 'api' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
          }`}
        >
          <Webhook className="w-4 h-4" />
          <span>API REST & Webhooks</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('support')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            section === 'support' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>Support VIP 24/7</span>
        </button>
      </div>

      {/* SECTION 1 : GÉNÉRATION PAR LOTS (JUSQU'À 20 VIDÉOS) */}
      {section === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Studio par lots multi-vidéos</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Saisissez jusqu'à 20 sujets (1 par ligne) ou laissez l'IA générer les variations.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                {parsedPrompts.length} / 20 vidéos
              </span>
            </div>

            {/* Générateur IA d'idées pour le lot */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-3">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                Générer automatiquement la liste des sujets par IA :
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={batchTopic}
                  onChange={(e) => setBatchTopic(e.target.value)}
                  placeholder="Ex : Marketing digital, Fitness, Finance personnelle, IA..."
                  className="flex-1 rounded-xl bg-white dark:bg-[#121214] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-white/30"
                />
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="rounded-xl bg-white dark:bg-[#121214] border border-zinc-300 dark:border-white/[0.1] px-3 py-2.5 text-xs text-zinc-950 dark:text-white focus:outline-none tabular-nums"
                >
                  <option value={3}>3 vidéos</option>
                  <option value={5}>5 vidéos</option>
                  <option value={10}>10 vidéos</option>
                  <option value={20}>20 vidéos (Max)</option>
                </select>
                <button
                  type="button"
                  onClick={handleGenerateBatchIdeas}
                  disabled={!batchTopic.trim() || isBrainstorming}
                  className="px-4 py-2.5 rounded-xl bg-[#0095F6] hover:bg-[#1877F2] disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isBrainstorming ? 'Création...' : 'Remplir par IA'}</span>
                </button>
              </div>
            </div>

            {/* Éditeur de prompts (1 par ligne) */}
            <div className="space-y-2">
              <textarea
                rows={8}
                value={rawPrompts}
                onChange={(e) => setRawPrompts(e.target.value)}
                placeholder="Saisissez un sujet par ligne (jusqu'à 20 lignes)..."
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.08] px-4 py-3 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-white/30 leading-relaxed"
              />
            </div>

            {/* Paramètres communs du lot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-zinc-600 dark:text-zinc-400 block mb-1">Format</label>
                <select
                  value={batchRatio}
                  onChange={(e) => setBatchRatio(e.target.value as AspectRatio)}
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-2.5 py-2 text-xs text-zinc-950 dark:text-white"
                >
                  <option value="9:16">9:16 Vertical</option>
                  <option value="16:9">16:9 Paysage</option>
                  <option value="1:1">1:1 Carré</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-600 dark:text-zinc-400 block mb-1">Style visuel</label>
                <select
                  value={batchStyle}
                  onChange={(e) => setBatchStyle(e.target.value as VideoStyle)}
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-2.5 py-2 text-xs text-zinc-950 dark:text-white"
                >
                  {VIDEO_STYLES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-600 dark:text-zinc-400 block mb-1">Voix off</label>
                <select
                  value={batchVoice}
                  onChange={(e) => setBatchVoice(e.target.value)}
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-2.5 py-2 text-xs text-zinc-950 dark:text-white"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.tone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-600 dark:text-zinc-400 block mb-1">Musique</label>
                <select
                  value={batchMood}
                  onChange={(e) => setBatchMood(e.target.value as MusicMood)}
                  className="w-full rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-2.5 py-2 text-xs text-zinc-950 dark:text-white"
                >
                  {MUSIC_MOODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.bpm})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunBatch}
              disabled={parsedPrompts.length === 0 || isRunningBatch}
              className="w-full py-3.5 rounded-xl font-heading text-sm font-extrabold text-black bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>
                {isRunningBatch
                  ? 'Production du lot en cours...'
                  : `Lancer la génération de ${parsedPrompts.length} vidéo${parsedPrompts.length > 1 ? 's' : ''}`}
              </span>
            </button>
          </div>

          {/* File de production en direct */}
          <div className="lg:col-span-5 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">File de production</h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                {batchJobs.filter((j) => j.status === 'completed').length} / {batchJobs.length} prêtes
              </span>
            </div>

            {batchJobs.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-zinc-300 dark:border-white/[0.1] rounded-xl">
                <Film className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Aucune file active</p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Vos vidéos générées par lots apparaîtront ici et seront enregistrées automatiquement dans « Mes Créations ».
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {batchJobs.map((job, idx) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                        {idx + 1}. {job.title || job.prompt}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {job.status === 'pending' && 'En attente dans la file'}
                        {job.status === 'generating' && 'Génération IA en cours...'}
                        {job.status === 'completed' && 'Terminée · Enregistrée dans Mes Créations'}
                        {job.status === 'error' && (job.error || 'Erreur')}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {job.status === 'completed' && generatedVideosMap[job.id] ? (
                        <button
                          type="button"
                          onClick={() => onOpenVideoInStudio(generatedVideosMap[job.id])}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 cursor-pointer whitespace-nowrap"
                        >
                          Ouvrir
                        </button>
                      ) : job.status === 'generating' ? (
                        <RefreshCw className="w-4 h-4 text-zinc-900 dark:text-white animate-spin" />
                      ) : job.status === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2 : RENDU ULTRA HD 4K 60 FPS & LICENCE COMMERCIALE */}
      {section === 'quality-license' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Paramètre de rendu par défaut 4K 60 FPS */}
          <div className="lg:col-span-5 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Qualité d'exportation du Studio</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Choisissez la résolution et la fluidité appliquées lorsque vous cliquez sur « Exporter en MP4 » dans le lecteur.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onChangeExportQuality('4k-60')}
                className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  exportQuality === '4k-60'
                    ? 'bg-emerald-500/10 border-emerald-500 dark:border-emerald-400'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-950 dark:text-white">Ultra HD 4K · 60 FPS</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Business VIP</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  Bitrate élevé 16 Mbps, interpolation 60 images/seconde, 0 filigrane. Idéal publicités TikTok, Meta et TV.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeExportQuality('1080p-30')}
                className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  exportQuality === '1080p-30'
                    ? 'bg-zinc-100 dark:bg-white/[0.08] border-zinc-900 dark:border-white'
                    : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-950 dark:text-white">Full HD 1080p · 30 FPS</span>
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Standard rapide</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  Export léger et rapide optimisé pour l'aperçu ou le partage mobile instantané.
                </p>
              </button>
            </div>
          </div>

          {/* Certificat de licence commerciale */}
          <div className="lg:col-span-7 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Licence Commerciale Complète</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Générez votre certificat officiel pour vos comptes publicitaires TikTok Ads, Meta Ads, YouTube et clients.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{licenseSerial}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Raison sociale / Nom d'agence
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-500 dark:focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  N° SIRET / TVA Intracommunautaire
                </label>
                <input
                  type="text"
                  value={companyReg}
                  onChange={(e) => setCompanyReg(e.target.value)}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-500 dark:focus:border-white/30 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Canaux couverts par l'attestation :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'TikTok Ads',
                  'Meta Ads (Instagram & Facebook)',
                  'YouTube Monétisé',
                  'Campagnes TV & DOOH',
                ].map((channel) => {
                  const checked = licenseChannels.includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => toggleChannel(channel)}
                      className={`p-2.5 rounded-xl border text-left text-xs flex items-center gap-2.5 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-zinc-950 dark:text-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          checked ? 'bg-emerald-400 border-emerald-400 text-black' : 'border-zinc-400 dark:border-zinc-600'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span>{channel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadLicense}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-heading text-xs font-extrabold text-black bg-emerald-400 hover:bg-emerald-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le Certificat de Licence Commerciale</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 3 : ÉQUIPE COLLABORATIVE (5 SIÈGES INCLUS) */}
      {section === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Membres de l'espace de travail</h3>
              <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                {seats.length} / 5 sièges utilisés
              </span>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
              {seats.map((seat) => (
                <div key={seat.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-zinc-950 dark:text-white">{seat.name}</span>
                      <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">·</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{seat.status}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{seat.email}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={seat.role}
                      disabled={seat.id === 'seat-owner'}
                      onChange={(e) => handleUpdateSeatRole(seat.id, e.target.value as TeamRole)}
                      className="rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-2.5 py-1.5 text-xs text-zinc-950 dark:text-white disabled:opacity-70"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Producteur">Producteur</option>
                      <option value="Éditeur">Éditeur</option>
                      <option value="Analyste">Analyste</option>
                    </select>

                    {seat.id !== 'seat-owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSeat(seat.id)}
                        title="Retirer ce siège"
                        className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleInviteMember} className="lg:col-span-5 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">Inviter un collaborateur</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Chaque siège dispose de son propre accès au Studio, aux modèles et aux exports 4K sans surcoût.
            </p>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Nom complet</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex : Sarah Moreau"
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Email professionnel</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="sarah@agence.fr"
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Rôle attribué</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white focus:outline-none"
              >
                <option value="Producteur">Producteur (Génération & Exports 4K)</option>
                <option value="Éditeur">Éditeur (Scripts & Scènes)</option>
                <option value="Analyste">Analyste (Statistiques uniquement)</option>
                <option value="Admin">Admin (Gestion complète)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={seats.length >= 5 || !inviteName.trim() || !inviteEmail.trim()}
              className="w-full py-3 rounded-xl font-heading text-xs font-bold text-white bg-[#0095F6] hover:bg-[#1877F2] disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {seats.length >= 5 ? 'Limite de 5 sièges atteinte' : 'Envoyer l\'invitation'}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* SECTION 4 : ACCÈS API REST & WEBHOOKS */}
      {section === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Clé API & cURL */}
          <div className="lg:col-span-6 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">Clé API REST Production</h3>
              </div>
              <button
                type="button"
                onClick={handleRegenerateKey}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Régénérer</span>
              </button>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
              <code className="flex-1 text-xs text-emerald-700 dark:text-emerald-400 font-mono truncate">
                {showApiKey ? apiKey : `${apiKey.slice(0, 14)}••••••••••••••••••••`}
              </code>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-white/[0.08] text-[11px] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-white/[0.14] cursor-pointer"
              >
                {showApiKey ? 'Masquer' : 'Afficher'}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 1800);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copié' : 'Copier'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Exemple d'appel REST (cURL)</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(curlSnippet);
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 1800);
                  }}
                  className="text-[11px] text-[#0095F6] hover:underline cursor-pointer font-semibold"
                >
                  {copiedSnippet ? 'Copié ✓' : 'Copier l\'exemple'}
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-[11px] text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto leading-relaxed">
                {curlSnippet}
              </pre>
            </div>
          </div>

          {/* Webhooks & Test */}
          <div className="lg:col-span-6 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">Intégration Webhooks</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">URL de réception HTTPS</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white font-mono focus:outline-none focus:border-zinc-500 dark:focus:border-white/30"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                  className="flex-1 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3 py-2.5 text-xs text-zinc-950 dark:text-white"
                >
                  <option value="video.rendered">Événement : video.rendered</option>
                  <option value="batch.completed">Événement : batch.completed</option>
                  <option value="export.4k_ready">Événement : export.4k_ready</option>
                </select>

                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !webhookUrl.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingWebhook ? 'Envoi...' : 'Tester le Webhook'}</span>
                </button>
              </div>
            </div>

            {lastWebhookPayload && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Dernier payload envoyé :</span>
                <pre className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-[11px] text-emerald-700 dark:text-emerald-300 font-mono overflow-x-auto max-h-40">
                  {lastWebhookPayload}
                </pre>
              </div>
            )}

            {webhookLogs.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Journal des appels récents</span>
                <div className="divide-y divide-zinc-200 dark:divide-white/[0.06] rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#09090B]">
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="px-3 py-2 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-zinc-800 dark:text-zinc-200">{log.event}</span>
                      <span className={log.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        HTTP {log.statusCode} · {log.latencyMs} ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5 : SUPPORT VIP 24/7 & ACCOUNT MANAGER */}
      {section === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Account Manager + Formulaire */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-base shrink-0">
                  CL
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Camille Laurent</h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Account Manager Dédiée · SLA &lt; 15 minutes 24/7</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Accompagnement production, API & campagnes Ads</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            </div>

            <form onSubmit={handleSubmitTicket} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">Ouvrir une demande prioritaire VIP</h3>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Objet</label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Ex : Configuration Webhook Make / Augmentation quota batch"
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Priorité</label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as SupportTicket['priority'])}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white"
                >
                  <option value="Standard">Standard (&lt; 2h)</option>
                  <option value="Prioritaire">Prioritaire Business (&lt; 15 min)</option>
                  <option value="Critique Production">Critique Production 24/7 (&lt; 5 min)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Votre message</label>
                <textarea
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Décrivez votre besoin technique, créatif ou commercial..."
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-white/30 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!ticketSubject.trim() || !ticketMessage.trim()}
                className="w-full py-3 rounded-xl font-heading text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer au Support VIP 24/7</span>
              </button>
            </form>
          </div>

          {/* Historique des demandes */}
          <div className="lg:col-span-6 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">Suivi de vos demandes VIP</h3>

            {tickets.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-300 dark:border-white/[0.1] rounded-xl space-y-2">
                <Headphones className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Aucune demande ouverte</p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Votre Account Manager dédiée répond à toutes vos demandes techniques ou éditoriales en moins de 15 minutes.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-zinc-950 dark:text-white">{t.subject}</span>
                      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{t.id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>{t.priority}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.status}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{t.createdAt}</span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">{t.message}</p>
                    {t.managerReply && (
                      <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.06] text-[11px] text-emerald-600 dark:text-emerald-400">
                        {t.managerReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
