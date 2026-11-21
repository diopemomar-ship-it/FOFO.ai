import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Eye,
  Heart,
  Share2,
  Clock,
  Sparkles,
  BarChart3,
  Layers,
  Compass,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Zap,
  Flame,
  Award,
  Video,
  ChevronRight,
} from 'lucide-react';
import { GeneratedVideo, VideoStyle } from '../types';
import { formatDurationShort } from '../utils/durationFormat';

interface StatsDashboardProps {
  currentVideo: GeneratedVideo | null;
  creations: GeneratedVideo[];
  onOpenVideoInStudio: (video: GeneratedVideo) => void;
  onApplyPresetToStudio?: (preset: { style: VideoStyle; prompt: string }) => void;
}

// Sujets prédéfinis avec leurs coefficients de performance simulée
export interface TopicBenchmark {
  id: string;
  name: string;
  category: string;
  baseViewsMultiplier: number;
  baseEngagementRate: number; // en %
  baseRetentionRate: number; // en %
  shareRate: number; // en %
  recommendedHashtags: string[];
  bestPostingHours: string;
  sampleHook: string;
}

export const TOPIC_BENCHMARKS: TopicBenchmark[] = [
  {
    id: 'psychology',
    name: 'Psychologie & Secrets du Cerveau',
    category: 'Développement & Mental',
    baseViewsMultiplier: 1.35,
    baseEngagementRate: 9.2,
    baseRetentionRate: 74,
    shareRate: 4.8,
    recommendedHashtags: ['#Psychologie', '#Cerveau', '#Faits', '#Mindset', '#Shorts'],
    bestPostingHours: '18h30 - 21h00',
    sampleHook: '95% des gens ne réalisent pas ce que leur subconscient décide pour eux...',
  },
  {
    id: 'mysteries',
    name: 'Énigmes & Mystères Inexpliqués',
    category: 'Storytelling & Histoire',
    baseViewsMultiplier: 1.45,
    baseEngagementRate: 8.8,
    baseRetentionRate: 78,
    shareRate: 5.2,
    recommendedHashtags: ['#Mystere', '#Enigme', '#Histoire', '#Inexplique', '#Creepy'],
    bestPostingHours: '20h00 - 23h00',
    sampleHook: 'En 1900, 3 gardiens ont disparu d\'une île déserte sans laisser aucune trace...',
  },
  {
    id: 'tech_ai',
    name: 'Tech, IA & Futur 2030',
    category: 'Technologie & Innovation',
    baseViewsMultiplier: 1.25,
    baseEngagementRate: 8.5,
    baseRetentionRate: 71,
    shareRate: 4.5,
    recommendedHashtags: ['#IA', '#Tech', '#Futur', '#Robots', '#Innovation'],
    bestPostingHours: '12h00 - 14h00 et 19h00',
    sampleHook: 'Voici comment l\'IA va remplacer 40% des métiers de bureau d\'ici 2030...',
  },
  {
    id: 'wealth',
    name: 'Finance, Richesse & Business',
    category: 'Finance & Entrepreneuriat',
    baseViewsMultiplier: 1.20,
    baseEngagementRate: 9.6,
    baseRetentionRate: 73,
    shareRate: 6.1,
    recommendedHashtags: ['#Argent', '#Business', '#Investissement', '#Richesse', '#Conseils'],
    bestPostingHours: '07h30 - 09h00 et 18h00',
    sampleHook: 'La règle financière des 1% que les écoles ne vous enseigneront jamais...',
  },
  {
    id: 'ancient_history',
    name: 'Histoire Antique & Empires Perdus',
    category: 'Culture & Documentaire',
    baseViewsMultiplier: 1.15,
    baseEngagementRate: 8.0,
    baseRetentionRate: 76,
    shareRate: 4.2,
    recommendedHashtags: ['#Histoire', '#RomeAntique', '#Egypte', '#Decouverte', '#Antiquite'],
    bestPostingHours: '19h30 - 22h00',
    sampleHook: 'Ce secret de l\'Empire Romain que les empereurs ont tenté d\'effacer...',
  },
  {
    id: 'unusual_facts',
    name: 'Faits Insolites & Curiosités',
    category: 'Divertissement & Savoir',
    baseViewsMultiplier: 1.40,
    baseEngagementRate: 8.9,
    baseRetentionRate: 69,
    shareRate: 5.4,
    recommendedHashtags: ['#Insolite', '#LeSaviezVous', '#FaitsInsolites', '#Science', '#Buzz'],
    bestPostingHours: '17h00 - 20h00',
    sampleHook: '3 faits totalement fous sur votre corps qui semblent impossibles mais sont réels...',
  },
  {
    id: 'productivity',
    name: 'Productivité & Discipline Martiale',
    category: 'Mindset & Habitudes',
    baseViewsMultiplier: 1.10,
    baseEngagementRate: 9.4,
    baseRetentionRate: 72,
    shareRate: 5.7,
    recommendedHashtags: ['#Discipline', '#Motivation', '#Productivite', '#Habitudes', '#Focus'],
    bestPostingHours: '06h30 - 08h30',
    sampleHook: 'La méthode des 2 minutes utilisée par les athlètes de haut niveau pour ne jamais procrastiner...',
  },
];

// Benchmarks par style visuel
export interface StyleBenchmark {
  style: VideoStyle;
  name: string;
  viewsMultiplier: number;
  engagementBonus: number; // en %
  retentionBonus: number; // en %
  topPlatform: 'TikTok' | 'YouTube Shorts' | 'Instagram Reels';
  highlight: string;
  colorHex: string;
}

export const STYLE_BENCHMARKS: StyleBenchmark[] = [
  {
    style: 'cinematic',
    name: 'Cinématique Réaliste',
    viewsMultiplier: 1.30,
    engagementBonus: 0.8,
    retentionBonus: 4,
    topPlatform: 'YouTube Shorts',
    highlight: 'Rétention maximale grâce aux éclairages 8K et à la profondeur de champ.',
    colorHex: '#38BDF8',
  },
  {
    style: 'cyberpunk',
    name: 'Cyberpunk & Néon',
    viewsMultiplier: 1.38,
    engagementBonus: 1.4,
    retentionBonus: 3,
    topPlatform: 'TikTok',
    highlight: 'Impact visuel percutant sur les flux verticaux et les publics jeunes.',
    colorHex: '#00E5FF',
  },
  {
    style: 'anime',
    name: 'Anime & Manga Épique',
    viewsMultiplier: 1.15,
    engagementBonus: 1.2,
    retentionBonus: -1,
    topPlatform: 'TikTok',
    highlight: 'Très fort taux de commentaires et de partages entre communautés de passionnés.',
    colorHex: '#818CF8',
  },
  {
    style: 'pixar3d',
    name: 'Animation 3D Stylisée',
    viewsMultiplier: 1.22,
    engagementBonus: 0.6,
    retentionBonus: 1,
    topPlatform: 'Instagram Reels',
    highlight: 'Grand public, très apprécié sur Instagram et pour les sujets éducatifs.',
    colorHex: '#FBBF24',
  },
  {
    style: 'minimalist',
    name: 'Minimaliste Sombre Luxe',
    viewsMultiplier: 1.10,
    engagementBonus: 1.8,
    retentionBonus: 5,
    topPlatform: 'Instagram Reels',
    highlight: 'Taux de sauvegarde record (+65%) pour le contenu business et finance.',
    colorHex: '#94A3B8',
  },
  {
    style: 'vintage',
    name: 'Documentaire d\'Archives',
    viewsMultiplier: 1.18,
    engagementBonus: 0.4,
    retentionBonus: 6,
    topPlatform: 'YouTube Shorts',
    highlight: 'Excellente durée moyenne de visionnage sur les récits historiques et crimes.',
    colorHex: '#F97316',
  },
];

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  currentVideo,
  creations,
  onOpenVideoInStudio,
  onApplyPresetToStudio,
}) => {
  // Sélection interactive des paramètres du simulateur
  const [selectedTopicId, setSelectedTopicId] = useState<string>('psychology');
  const [selectedStyle, setSelectedStyle] = useState<VideoStyle>('cinematic');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'tiktok' | 'shorts' | 'reels'>('all');
  const [selectedDuration, setSelectedDuration] = useState<number>(45);
  const [activeTab, setActiveTab] = useState<'simulator' | 'styles_matrix' | 'topics_ranking' | 'active_video'>('simulator');

  // Sujet et style actuellement choisis
  const currentTopic = useMemo(
    () => TOPIC_BENCHMARKS.find((t) => t.id === selectedTopicId) || TOPIC_BENCHMARKS[0],
    [selectedTopicId]
  );

  const currentStyleBenchmark = useMemo(
    () => STYLE_BENCHMARKS.find((s) => s.style === selectedStyle) || STYLE_BENCHMARKS[0],
    [selectedStyle]
  );

  // Calcul mathématique rigoureux de la performance simulée
  const simulationResults = useMemo(() => {
    // Base de vues médianes selon la durée et les algorithmes de vidéos courtes
    let baseViews = 65000;
    if (selectedDuration <= 30) baseViews = 78000;
    else if (selectedDuration <= 60) baseViews = 65000;
    else baseViews = 52000;

    // Multiplicateurs de plateforme
    const platformFactor =
      selectedPlatform === 'tiktok'
        ? 1.25
        : selectedPlatform === 'shorts'
        ? 1.15
        : selectedPlatform === 'reels'
        ? 1.05
        : 1.18; // 'all' (agrégé multi-plateformes)

    // Calcul des vues estimées
    const combinedMultiplier = currentTopic.baseViewsMultiplier * currentStyleBenchmark.viewsMultiplier * platformFactor;
    const estimatedMedianViews = Math.round(baseViews * combinedMultiplier);
    const lowRangeViews = Math.round(estimatedMedianViews * 0.45);
    const highRangeViews = Math.round(estimatedMedianViews * 2.8);

    // Calcul du taux d'engagement simulé (Likes, commentaires, partages)
    const rawEngagement = currentTopic.baseEngagementRate + currentStyleBenchmark.engagementBonus;
    const finalEngagementRate = Number(Math.min(14.5, Math.max(4.5, rawEngagement)).toFixed(1));

    // Répartition de l'engagement
    const estimatedLikes = Math.round((estimatedMedianViews * (finalEngagementRate * 0.72)) / 100);
    const estimatedComments = Math.round((estimatedMedianViews * (finalEngagementRate * 0.08)) / 100);
    const estimatedShares = Math.round((estimatedMedianViews * (currentTopic.shareRate / 100)));

    // Calcul de la rétention et taux de complétion
    const rawRetention = currentTopic.baseRetentionRate + currentStyleBenchmark.retentionBonus;
    const completionRate = Math.min(88, Math.max(50, rawRetention));
    const retentionAt3s = Math.min(94, Math.round(completionRate * 1.2));

    // Score viral prédictif (sur 100)
    const viralScore = Math.min(
      99,
      Math.round((combinedMultiplier / 2.2) * 45 + (finalEngagementRate / 12) * 30 + (completionRate / 80) * 25)
    );

    return {
      estimatedMedianViews,
      lowRangeViews,
      highRangeViews,
      finalEngagementRate,
      estimatedLikes,
      estimatedComments,
      estimatedShares,
      completionRate,
      retentionAt3s,
      viralScore,
    };
  }, [currentTopic, currentStyleBenchmark, selectedPlatform, selectedDuration]);

  // Évaluation spécifique de la vidéo active de l'utilisateur
  const activeVideoEvaluation = useMemo(() => {
    if (!currentVideo) return null;
    const styleData = STYLE_BENCHMARKS.find((s) => s.style === currentVideo.style) || STYLE_BENCHMARKS[0];
    
    // Détection automatique du sujet par mots clés dans le titre
    const titleLower = (currentVideo.title + ' ' + (currentVideo.hook || '')).toLowerCase();
    let matchedTopic = TOPIC_BENCHMARKS[0];
    if (titleLower.includes('ia') || titleLower.includes('robot') || titleLower.includes('tech')) {
      matchedTopic = TOPIC_BENCHMARKS.find((t) => t.id === 'tech_ai') || matchedTopic;
    } else if (titleLower.includes('myst') || titleLower.includes('énigme') || titleLower.includes('disparu')) {
      matchedTopic = TOPIC_BENCHMARKS.find((t) => t.id === 'mysteries') || matchedTopic;
    } else if (titleLower.includes('argent') || titleLower.includes('richesse') || titleLower.includes('million')) {
      matchedTopic = TOPIC_BENCHMARKS.find((t) => t.id === 'wealth') || matchedTopic;
    } else if (titleLower.includes('romain') || titleLower.includes('histoire') || titleLower.includes('empire')) {
      matchedTopic = TOPIC_BENCHMARKS.find((t) => t.id === 'ancient_history') || matchedTopic;
    }

    const estimatedViews = Math.round(62000 * matchedTopic.baseViewsMultiplier * styleData.viewsMultiplier);
    const engagement = Number((matchedTopic.baseEngagementRate + styleData.engagementBonus).toFixed(1));
    const completion = matchedTopic.baseRetentionRate + styleData.retentionBonus;

    return {
      matchedTopic,
      styleData,
      estimatedViews,
      engagement,
      completion,
      duration: currentVideo.totalEstimatedDuration || 40,
      scenesCount: currentVideo.scenes.length,
    };
  }, [currentVideo]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* En-tête du tableau de bord de statistiques */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-semibold mb-1.5">
            <BarChart3 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span>Tableau de Bord Prédictif IA · Algorithmes TikTok & Reels</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-zinc-950 dark:text-white tracking-tight">
            Statistiques & Performance Simulée
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
            Estimez précisément les <strong className="text-zinc-950 dark:text-white">vues potentielles</strong>, le{' '}
            <strong className="text-zinc-950 dark:text-white">taux d’engagement</strong> et la rétention de vos vidéos selon le style visuel
            et le sujet traité.
          </p>
        </div>

        {/* Boutons d'onglets de vue statistiques */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-[#121214] rounded-xl border border-zinc-200 dark:border-white/[0.08] self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
            }`}
          >
            Simulateur en direct
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('styles_matrix')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'styles_matrix'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
            }`}
          >
            Comparatif par Style
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('topics_ranking')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'topics_ranking'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
            }`}
          >
            Classement Sujets
          </button>
          {currentVideo && (
            <button
              type="button"
              onClick={() => setActiveTab('active_video')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'active_video'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Ma Vidéo Active</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1 : SIMULATEUR INTERACTIF (Style & Sujet en temps réel) */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {/* Panneau de sélection des paramètres de simulation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
                <span className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                  Paramètres
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Temps réel</span>
              </div>

              {/* 1. Choix du Sujet / Thématique */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                  <span>1. Sujet / Thématique :</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{currentTopic.category}</span>
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/[0.1] px-3.5 py-2.5 text-xs font-semibold text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-500 dark:focus:border-white/30 transition-colors"
                >
                  {TOPIC_BENCHMARKS.map((t) => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-[#121214] text-zinc-950 dark:text-white">
                      {t.name} (x{t.baseViewsMultiplier})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                  Accroche suggérée : « {currentTopic.sampleHook} »
                </p>
              </div>

              {/* 2. Choix du Style Visuel */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                  <span>2. Style Visuel IA :</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                    +{currentStyleBenchmark.retentionBonus}% Rétention
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_BENCHMARKS.map((s) => {
                    const isSelected = selectedStyle === s.style;
                    return (
                      <button
                        key={s.style}
                        type="button"
                        onClick={() => setSelectedStyle(s.style)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                            : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <p className="text-xs font-bold truncate">{s.name}</p>
                        <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}>
                          Top: {s.topPlatform}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Choix de la Plateforme */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">3. Plateforme Cible :</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'all', label: 'Multi' },
                    { id: 'tiktok', label: 'TikTok' },
                    { id: 'shorts', label: 'Shorts' },
                    { id: 'reels', label: 'Reels' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id as any)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        selectedPlatform === p.id
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Durée Cible */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                  <span>4. Durée de la vidéo :</span>
                  <span className="text-zinc-950 dark:text-white font-bold font-mono tabular-nums">{selectedDuration}s</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[25, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDuration(d)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer tabular-nums ${
                        selectedDuration === d
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                          : 'bg-zinc-50 dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {d}s ({d <= 30 ? 'Court' : d <= 45 ? 'Optimal' : 'Story'})
                    </button>
                  ))}
                </div>
              </div>

              {/* Raccourci vers le Studio avec ces paramètres */}
              {onApplyPresetToStudio && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyPresetToStudio({
                      style: selectedStyle,
                      prompt: currentTopic.sampleHook,
                    });
                  }}
                  className="w-full py-3 rounded-xl font-heading text-xs font-extrabold text-white electric-button-gradient hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Appliquer ces réglages au Studio</span>
                </button>
              )}
            </div>

            {/* Affichage des KPIs simulés en direct */}
            <div className="lg:col-span-8 space-y-6">
              {/* Carte Principale de Vues Estimées & Potentiel Viral */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Projection Algorithmique Estimée (7 Jours)
                    </span>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-950 dark:text-white mt-1">
                      {currentTopic.name} · {currentStyleBenchmark.name}
                    </h3>
                  </div>

                  {/* Badge Score Viral */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
                    <div className="w-11 h-11 rounded-full ig-story-ring p-[2px]">
                      <div className="w-full h-full rounded-full bg-white dark:bg-[#121214] flex items-center justify-center">
                        <Award className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono">Potentiel Viral</p>
                      <p className="text-lg font-black text-zinc-950 dark:text-white font-mono tabular-nums">
                        {simulationResults.viralScore} <span className="text-xs text-zinc-500">/ 100</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Compteurs Clés */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 relative z-10">
                  {/* Vues Médianes */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="text-xs font-medium">Vues Estimées</span>
                      <Eye className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <p className="text-2xl font-black text-zinc-950 dark:text-white font-mono tabular-nums">
                      {simulationResults.estimatedMedianViews.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
                      {simulationResults.lowRangeViews.toLocaleString()} - {simulationResults.highRangeViews.toLocaleString()}
                    </p>
                  </div>

                  {/* Taux d'Engagement */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="text-xs font-medium">Engagement</span>
                      <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-zinc-950 dark:text-white font-mono tabular-nums">
                      {simulationResults.finalEngagementRate}%
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                      ~{simulationResults.estimatedLikes.toLocaleString()} likes
                    </p>
                  </div>

                  {/* Taux de Complétion */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="text-xs font-medium">Complétion</span>
                      <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    </div>
                    <p className="text-2xl font-black text-zinc-950 dark:text-white font-mono tabular-nums">
                      {simulationResults.completionRate}%
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                      Rétention 3s : {simulationResults.retentionAt3s}%
                    </p>
                  </div>

                  {/* Partages & Viralité */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="text-xs font-medium">Partages</span>
                      <Share2 className="w-4 h-4 text-[#0095F6]" />
                    </div>
                    <p className="text-2xl font-black text-zinc-950 dark:text-white font-mono tabular-nums">
                      {simulationResults.estimatedShares.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                      Ratio : {currentTopic.shareRate}% par vue
                    </p>
                  </div>
                </div>

                {/* Graphique de Rétention Estimé au Fil de la Vidéo (SVG Sparkline) */}
                <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-white/[0.08] relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      Courbe de Rétention Estimée au Fil des Secondes :
                    </span>
                    <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">
                      Rétention Finale : {simulationResults.completionRate}%
                    </span>
                  </div>

                  <div className="h-28 w-full bg-zinc-50 dark:bg-[#09090B] rounded-xl border border-zinc-200 dark:border-white/[0.08] p-2 relative flex items-end">
                    {/* SVG Curve */}
                    <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#DD2A7B" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#8134AF" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Area */}
                      <path
                        d={`M 0 5 Q 80 ${100 - simulationResults.retentionAt3s}, 200 40 T 500 ${
                          100 - simulationResults.completionRate
                        } L 500 100 L 0 100 Z`}
                        fill="url(#retentionGrad)"
                      />
                      {/* Line */}
                      <path
                        d={`M 0 5 Q 80 ${100 - simulationResults.retentionAt3s}, 200 40 T 500 ${
                          100 - simulationResults.completionRate
                        }`}
                        fill="none"
                        stroke="#F58529"
                        strokeWidth="2.5"
                      />
                    </svg>
                    <div className="absolute bottom-1 left-3 text-[10px] text-zinc-500 font-mono">0s (Accroche)</div>
                    <div className="absolute bottom-1 right-3 text-[10px] text-zinc-500 font-mono tabular-nums">
                      {selectedDuration}s (Fin & CTA)
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Cartes de Recommandations Stratégiques */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span>Créneau Horaire Optimal</span>
                  </div>
                  <p className="text-base font-extrabold text-zinc-950 dark:text-white font-mono tabular-nums">
                    {currentTopic.bestPostingHours}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Pic d'activité maximal des spectateurs sur cette thématique.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0095F6]">
                    <Layers className="w-4 h-4" />
                    <span>Plateforme N°1 Recommandée</span>
                  </div>
                  <p className="text-base font-extrabold text-zinc-950 dark:text-white">
                    {currentStyleBenchmark.topPlatform}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    {currentStyleBenchmark.highlight}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Hashtags Porteurs</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentTopic.recommendedHashtags.map((h, i) => (
                      <span key={i} className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                        {h}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Favorise l'indexation dans les recommandations TikTok et YouTube Search.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2 : COMPARATIF PAR STYLE VISUEL */}
      {activeTab === 'styles_matrix' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                Matrice Comparative des Styles Vidéo FOFO AI
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Performances moyennes observées selon les styles visuels sur des vidéos de 30 à 60 secondes.
              </p>
            </div>

            {/* Tableau comparatif des styles */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/[0.08] text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <th className="py-3 px-4">Style Visuel</th>
                    <th className="py-3 px-4">Multiplicateur Vues</th>
                    <th className="py-3 px-4">Engagement Moyen</th>
                    <th className="py-3 px-4">Bonus Rétention</th>
                    <th className="py-3 px-4">Plateforme Forte</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/[0.06] text-xs">
                  {STYLE_BENCHMARKS.map((s) => (
                    <tr key={s.style} className="hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-zinc-950 dark:text-white flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: s.colorHex }}
                        />
                        {s.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                        x{s.viewsMultiplier.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {(8.5 + s.engagementBonus).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{s.retentionBonus}%
                      </td>
                      <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-[11px]">
                          {s.topPlatform}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStyle(s.style);
                            setActiveTab('simulator');
                          }}
                          className="text-[11px] font-bold text-[#0095F6] hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                        >
                          Simuler ce style →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barres Visuelles Comparatives */}
            <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Portée Relative Estimée par Style :</p>
              <div className="space-y-2.5">
                {STYLE_BENCHMARKS.map((s) => {
                  const percentage = Math.round((s.viewsMultiplier / 1.45) * 100);
                  return (
                    <div key={s.style} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">{s.name}</span>
                        <span className="font-mono text-zinc-950 dark:text-white tabular-nums">{percentage}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-[#09090B] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: s.colorHex,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3 : CLASSEMENT DES SUJETS VIRAUX */}
      {activeTab === 'topics_ranking' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                Classement des Sujets par Potentiel de Viralité
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Basé sur l'analyse des tendances TikTok & YouTube Shorts dans le créneau des vidéos automatisées faceless.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TOPIC_BENCHMARKS.map((t, idx) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-[#121214] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] tabular-nums">
                        #{idx + 1} VÉLOCITÉ VIRALE
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        x{t.baseViewsMultiplier} Vues
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-zinc-950 dark:text-white">{t.name}</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Catégorie : {t.category}</p>

                    <p className="text-xs text-zinc-700 dark:text-zinc-300 italic bg-white dark:bg-[#121214] p-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                      « {t.sampleHook} »
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-white/[0.06] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      <span>Engag: <strong className="text-rose-600 dark:text-rose-400">{t.baseEngagementRate}%</strong></span>
                      <span>Rétent: <strong className="text-zinc-950 dark:text-white">{t.baseRetentionRate}%</strong></span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopicId(t.id);
                        setActiveTab('simulator');
                      }}
                      className="text-xs font-bold text-[#0095F6] hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer flex items-center gap-1"
                    >
                      <span>Simuler</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4 : ANALYSE DE LA VIDÉO ACTIVE */}
      {activeTab === 'active_video' && activeVideoEvaluation && currentVideo && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
            <div>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Video className="w-4 h-4 text-[#DD2A7B]" />
                Audit Prédictif de Votre Vidéo en Cours
              </span>
              <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white mt-1 line-clamp-1">
                {currentVideo.title}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                Format : {currentVideo.aspectRatio} · {activeVideoEvaluation.scenesCount} scènes · ~{formatDurationShort(activeVideoEvaluation.duration)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenVideoInStudio(currentVideo)}
              className="px-4 py-2.5 rounded-xl font-heading text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:text-black dark:bg-white dark:hover:bg-zinc-200 transition-all flex items-center gap-2 self-start cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ouvrir dans le Lecteur Vidéo</span>
            </button>
          </div>

          {/* Grille de KPIs pour la vidéo active */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Vues Estimées à 7j</p>
              <p className="text-2xl font-black text-zinc-950 dark:text-white font-mono mt-1 tabular-nums">
                {activeVideoEvaluation.estimatedViews.toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Sujet détecté : {activeVideoEvaluation.matchedTopic.name}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Taux d'Engagement Estimé</p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1 tabular-nums">
                {activeVideoEvaluation.engagement}%
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Style : {activeVideoEvaluation.styleData.name}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Rétention Prédite</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1 tabular-nums">
                {activeVideoEvaluation.completion}%
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Durée optimisée pour les flux Shorts/Reels
              </p>
            </div>
          </div>

          {/* 3 Conseils Stratégiques pour Dépasser les 100K vues */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] space-y-3">
            <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#DD2A7B]" />
              Conseils IA pour Maximiser le Potentiel de cette Vidéo
            </h3>
            <div className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-950 dark:text-white">Accroche percutante :</strong> Les 3 premières secondes doivent poser une question ouverte ou un chiffre choquant pour garantir plus de 80% de rétention initiale.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-950 dark:text-white">Transitions rythmées :</strong> Utilisez la transition <em>Cut Brut</em> ou <em>Fondu Enchaîné</em> pour ne laisser aucun temps mort visuel.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-950 dark:text-white">Sous-titres Hormozi :</strong> Les sous-titres animés avec mots-clés jaunes augmentent le temps de visionnage de +24% en moyenne.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
