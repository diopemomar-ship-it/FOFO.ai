import React, { useState } from 'react';
import {
  Flame,
  ArrowRight,
  Search,
  TrendingUp,
  Zap,
  Clock,
  Tv,
  Smartphone,
  Layers,
  Users,
  Sparkles,
  Sliders,
  Music2,
  Clapperboard,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { CreatorPersona, GeneratedVideo, VideoTemplate } from '../types';
import {
  VIRAL_TEMPLATES,
  FAMOUS_CREATOR_PERSONAS,
  VOICES,
  MUSIC_MOODS,
  CAPTION_STYLES,
} from '../data/mockTemplates';
import { CreatorAvatar } from './CreatorAvatar';
import { AnimatedInfluencerShowcase } from './AnimatedInfluencerShowcase';

interface TemplatesGalleryProps {
  onSelectTemplate: (template: VideoTemplate) => void;
  onCustomizeTemplate?: (template: VideoTemplate) => void;
  onSelectCreatorPersona?: (persona: CreatorPersona, customPrompt?: string) => void;
  onCustomizeCreatorPersona?: (persona: CreatorPersona, customPrompt?: string) => void;
  onOpenAnimatedVideo?: (video: GeneratedVideo) => void;
  onOpenCopyrightModal?: () => void;
}

export const TemplatesGallery: React.FC<TemplatesGalleryProps> = ({
  onSelectTemplate,
  onCustomizeTemplate,
  onSelectCreatorPersona,
  onCustomizeCreatorPersona,
  onOpenAnimatedVideo,
  onOpenCopyrightModal,
}) => {
  const [creatorPlatformFilter, setCreatorPlatformFilter] = useState<'all' | 'youtube' | 'tiktok'>('all');
  const [selectedTopicByCreator, setSelectedTopicByCreator] = useState<Record<string, number>>({});
  const [customTopicByCreator, setCustomTopicByCreator] = useState<Record<string, string>>({});
  const [editingCreatorId, setEditingCreatorId] = useState<string | null>(null);

  const [selectedFormat, setSelectedFormat] = useState<
    'all' | 'youtube' | 'tiktok' | 'shorts' | 'instagram'
  >('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const CATEGORIES = [
    'Tous',
    'YouTube 16:9',
    'TikTok Viral',
    'Challenge & Divertissement',
    'Comédie & Humour',
    'Instagram 4:5',
    'Top Tendances',
    'Éducation Express',
    'Motivation & Business',
    'Psychologie & Faits',
    'Anime & Gaming',
    'Sport & Lifestyle',
    'Tech & Futur',
    'Faceless Mystère',
    'True Crime & Enquête',
    'Science & Espace',
    'Santé & Biohacking',
    'Histoire & Légendes',
  ];

  const filteredCreators = FAMOUS_CREATOR_PERSONAS.filter((creator) => {
    const matchesPlatform =
      creatorPlatformFilter === 'all' ? true : creator.platform === creatorPlatformFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      creator.name.toLowerCase().includes(q) ||
      creator.handle.toLowerCase().includes(q) ||
      creator.niche.toLowerCase().includes(q) ||
      creator.tagline.toLowerCase().includes(q);
    return matchesPlatform && matchesSearch;
  });

  const filteredTemplates = VIRAL_TEMPLATES.filter((template) => {
    const matchesFormat =
      selectedFormat === 'all'
        ? true
        : selectedFormat === 'youtube'
        ? template.aspectRatio === '16:9' || template.platform === 'youtube'
        : selectedFormat === 'tiktok'
        ? template.platform === 'tiktok' ||
          template.category.includes('TikTok') ||
          template.badge?.includes('TikTok') ||
          (template.aspectRatio === '9:16' && template.duration <= 45)
        : selectedFormat === 'instagram'
        ? template.aspectRatio === '4:5' || template.platform === 'instagram'
        : template.aspectRatio === '9:16';

    const matchesCategory =
      selectedCategory === 'Tous'
        ? true
        : selectedCategory === 'YouTube 16:9'
        ? template.aspectRatio === '16:9' || template.category.includes('YouTube 16:9')
        : selectedCategory === 'TikTok Viral'
        ? template.platform === 'tiktok' ||
          template.category.includes('TikTok') ||
          template.badge?.includes('TikTok')
        : selectedCategory === 'Instagram 4:5'
        ? template.aspectRatio === '4:5' || template.category.includes('Instagram 4:5')
        : selectedCategory === 'Top Tendances'
        ? Boolean(
            template.badge?.includes('Viral') ||
              template.badge?.includes('Top') ||
              template.badge?.includes('Vues') ||
              template.badge?.includes('Rétention') ||
              template.badge?.includes('#1')
          )
        : template.category.includes(selectedCategory);

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      template.title.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q) ||
      template.samplePrompt.toLowerCase().includes(q) ||
      template.category.toLowerCase().includes(q);

    return matchesFormat && matchesCategory && matchesSearch;
  });

  const youtubeCount = VIRAL_TEMPLATES.filter(
    (t) => t.aspectRatio === '16:9' || t.platform === 'youtube'
  ).length;
  const tiktokCount = VIRAL_TEMPLATES.filter(
    (t) =>
      t.platform === 'tiktok' ||
      t.category.includes('TikTok') ||
      t.badge?.includes('TikTok') ||
      (t.aspectRatio === '9:16' && t.duration <= 45)
  ).length;
  const shortsCount = VIRAL_TEMPLATES.filter((t) => t.aspectRatio === '9:16').length;
  const instagramCount = VIRAL_TEMPLATES.filter((t) => t.aspectRatio === '4:5').length;

  const ytCreatorCount = FAMOUS_CREATOR_PERSONAS.filter((c) => c.platform === 'youtube').length;
  const tiktokCreatorCount = FAMOUS_CREATOR_PERSONAS.filter((c) => c.platform === 'tiktok').length;

  const resolveCreatorPrompt = (creator: CreatorPersona) => {
    const custom = (customTopicByCreator[creator.id] || '').trim();
    if (custom) return custom;
    const topicIdx = selectedTopicByCreator[creator.id] ?? 0;
    return creator.sampleTopics[topicIdx]?.prompt || creator.sampleTopics[0].prompt;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-2.5">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full ig-story-ring" />
          <span>Personnages YouTube & TikTok · Modèles prêts à générer en 1 clic</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-zinc-900 dark:text-white tracking-tight">
          Créateurs Célèbres & Modèles Vidéo
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          Adoptez le style narratif, la voix off, les sous-titres et la mise en scène des plus grands créateurs YouTube et TikTok, ou démarrez avec un modèle viral calibré.
        </p>
      </div>

      {/* Global Search Bar */}
      <div className="relative max-w-3xl mx-auto">
        <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un créateur (MrBeast, Squeezie, Khaby, Léna...) ou un modèle YouTube / TikTok..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] focus:border-zinc-400 dark:focus:border-white/30 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs sm:text-sm focus:outline-none transition-all"
        />
      </div>

      {/* SECTION 0: Famous Influencer Animated Videos */}
      {onOpenAnimatedVideo && (
        <AnimatedInfluencerShowcase
          onOpenInStudio={onOpenAnimatedVideo}
          onOpenCopyrightModal={onOpenCopyrightModal}
          layout="grid"
        />
      )}

      {/* SECTION 1: Famous YouTube & TikTok Creator Personas */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.08] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#DD2A7B]">
              <Users className="w-4 h-4" />
              <span>Archétypes Créateurs IA</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold font-heading text-zinc-900 dark:text-white">
              Personnages Célèbres YouTube & TikTok
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Choisissez un personnage, sélectionnez un sujet ou écrivez le vôtre : FOFO AI configure automatiquement le format, la voix, le rythme et les sous-titres.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                La génération utilise uniquement le <strong>style narratif &amp; visuel</strong> (libre de droits, sans portrait tiers ni voix clonée).
              </span>
              {onOpenCopyrightModal && (
                <button
                  type="button"
                  onClick={onOpenCopyrightModal}
                  className="font-semibold text-[#0095F6] hover:underline cursor-pointer"
                >
                  Droits d’auteur &amp; droit à l’image
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setCreatorPlatformFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                creatorPlatformFilter === 'all'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span className="tabular-nums">Tous ({FAMOUS_CREATOR_PERSONAS.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatorPlatformFilter('youtube')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                creatorPlatformFilter === 'youtube'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="tabular-nums">YouTube ({ytCreatorCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatorPlatformFilter('tiktok')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                creatorPlatformFilter === 'tiktok'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-[#00F2EA] dark:text-black dark:border-[#00F2EA]'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              <span className="tabular-nums">TikTok ({tiktokCreatorCount})</span>
            </button>
          </div>
        </div>

        {filteredCreators.length === 0 ? (
          <div className="text-center py-10 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08]">
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              Aucun personnage créateur trouvé pour cette recherche.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {filteredCreators.map((creator) => {
              const activeTopicIdx = selectedTopicByCreator[creator.id] ?? 0;
              const isEditingCustom = editingCreatorId === creator.id;
              const customVal = customTopicByCreator[creator.id] || '';
              const voiceName = VOICES.find((v) => v.id === creator.voiceId)?.name || 'Voix IA';
              const musicName =
                MUSIC_MOODS.find((m) => m.id === creator.musicMood)?.name || creator.musicMood;
              const captionName =
                CAPTION_STYLES.find((c) => c.id === creator.captionStyle)?.name ||
                creator.captionStyle;
              const isYouTube = creator.platform === 'youtube';

              return (
                <div
                  key={creator.id}
                  className="rounded-3xl overflow-hidden bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] shadow-sm dark:shadow-none transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Immense Full-Bleed Creator Portrait */}
                    <div className="relative h-80 sm:h-96 w-full overflow-hidden">
                      <CreatorAvatar persona={creator} variant="poster" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md ${
                            isYouTube
                              ? 'bg-red-600/95 text-white'
                              : 'bg-black/85 text-[#00F2EA] border border-[#00F2EA]/40'
                          }`}
                        >
                          {isYouTube ? <Tv className="w-3.5 h-3.5" /> : <Music2 className="w-3.5 h-3.5" />}
                          <span>{isYouTube ? 'YouTube 16:9' : 'TikTok 9:16'}</span>
                        </span>
                      </div>

                      <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                              {creator.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-sm text-xs font-bold text-white shrink-0">
                              {creator.country}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-200 truncate font-mono mt-0.5">
                            {creator.handle} · <span className="tabular-nums font-bold text-white">{creator.subscribersLabel}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Creator Body */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {creator.niche}
                        </span>
                        <span className="font-mono tabular-nums text-zinc-500 shrink-0">
                          {creator.duration}s · {creator.aspectRatio}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                        {creator.tagline}
                      </p>

                      {/* Hook Signature */}
                      <div className="px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06] text-[11px] text-zinc-700 dark:text-zinc-300">
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          Signature Hook :
                        </span>{' '}
                        {creator.hookStyle}
                      </div>

                      {/* Topic Switcher or Custom Prompt */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            Sujet prêt à tourner :
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingCreatorId((curr) =>
                                curr === creator.id ? null : creator.id
                              )
                            }
                            className="text-[10px] font-semibold text-[#0095F6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            <span>{isEditingCustom ? 'Sujets proposés' : 'Écrire mon sujet'}</span>
                          </button>
                        </div>

                        {isEditingCustom ? (
                          <textarea
                            rows={2}
                            value={customVal}
                            onChange={(e) =>
                              setCustomTopicByCreator((prev) => ({
                                ...prev,
                                [creator.id]: e.target.value,
                              }))
                            }
                            placeholder={`Décrivez n'importe quel sujet à traiter dans le style de ${creator.name}...`}
                            className="w-full rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-white/15 px-2.5 py-2 text-[11px] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 resize-none"
                          />
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-1.5">
                              {creator.sampleTopics.map((topic, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTopicByCreator((prev) => ({
                                      ...prev,
                                      [creator.id]: idx,
                                    }));
                                    if (customVal) {
                                      setCustomTopicByCreator((prev) => ({
                                        ...prev,
                                        [creator.id]: '',
                                      }));
                                    }
                                  }}
                                  className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold text-left truncate border transition-all cursor-pointer ${
                                    activeTopicIdx === idx && !customVal
                                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                                      : 'bg-zinc-100 dark:bg-[#09090B] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400'
                                  }`}
                                  title={topic.prompt}
                                >
                                  {topic.label}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic line-clamp-2">
                              « {resolveCreatorPrompt(creator)} »
                            </p>
                          </>
                        )}
                      </div>

                      {/* Preset Summary */}
                      <div className="pt-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                        {voiceName} · {musicName} · {captionName}
                      </div>
                    </div>
                  </div>

                  {/* Creator Actions */}
                  <div className="p-3.5 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0B0B0D] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectCreatorPersona?.(creator, resolveCreatorPrompt(creator))
                      }
                      className="flex-1 py-2.5 px-3 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Générer style {creator.name}</span>
                    </button>

                    {onCustomizeCreatorPersona && (
                      <button
                        type="button"
                        onClick={() =>
                          onCustomizeCreatorPersona(creator, resolveCreatorPrompt(creator))
                        }
                        title={`Charger les réglages de ${creator.name} dans le Directeur IA`}
                        className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-[#141418] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400 dark:hover:border-white/30 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Studio</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: Video Templates Library */}
      <section className="space-y-5 pt-4 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0095F6]">
            <Clapperboard className="w-4 h-4" />
            <span>Bibliothèque de Structures Virales</span>
          </div>
          <h3 className="text-2xl font-extrabold font-heading text-zinc-900 dark:text-white tracking-tight">
            Modèles Vidéo YouTube, TikTok & Reels
          </h3>
        </div>

        {/* Format Switcher + Category Filters */}
        <div className="space-y-4 max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedFormat('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedFormat === 'all'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.16]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="tabular-nums">Tous ({VIRAL_TEMPLATES.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('youtube')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedFormat === 'youtube'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.16]'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="tabular-nums">YouTube 16:9 ({youtubeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('tiktok')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedFormat === 'tiktok'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-[#00F2EA] dark:text-black dark:border-[#00F2EA]'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.16]'
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              <span className="tabular-nums">TikTok 9:16 ({tiktokCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('shorts')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedFormat === 'shorts'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.16]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="tabular-nums">Shorts & Reels 9:16 ({shortsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('instagram')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedFormat === 'instagram'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                  : 'bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.16]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#DD2A7B]" />
              <span className="tabular-nums">Instagram 4:5 ({instagramCount})</span>
            </button>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center justify-center flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white font-semibold'
                    : 'bg-white dark:bg-[#121214] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.16]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Template Cards Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-14 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] space-y-3">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Aucun modèle ne correspond à votre recherche actuelle.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedFormat('all');
                setSelectedCategory('Tous');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((template) => {
              const isYouTube = template.aspectRatio === '16:9' || template.platform === 'youtube';
              const isTikTok =
                template.platform === 'tiktok' ||
                template.category.includes('TikTok') ||
                template.badge?.includes('TikTok');
              return (
                <div
                  key={template.id}
                  className="rounded-2xl overflow-hidden bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.18] shadow-xs dark:shadow-none transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Thumbnail Container */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                      <img
                        src={template.thumbnail}
                        alt={template.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35" />

                      {template.badge && (
                        <div
                          className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-md ${
                            isYouTube
                              ? 'bg-red-600/90 text-white border border-white/15'
                              : isTikTok
                              ? 'bg-black/85 text-[#00F2EA] border border-[#00F2EA]/40'
                              : 'ig-story-ring text-white'
                          }`}
                        >
                          {isYouTube ? (
                            <Tv className="w-3 h-3" />
                          ) : isTikTok ? (
                            <Music2 className="w-3 h-3" />
                          ) : (
                            <TrendingUp className="w-3 h-3" />
                          )}
                          <span>{template.badge}</span>
                        </div>
                      )}

                      <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono tabular-nums text-zinc-100 border border-white/10">
                        {template.duration}s ·{' '}
                        {template.aspectRatio === '16:9'
                          ? '16:9 YouTube'
                          : template.aspectRatio === '4:5'
                          ? '4:5 Instagram'
                          : template.aspectRatio === '1:1'
                          ? '1:1 Carré'
                          : isTikTok
                          ? '9:16 TikTok'
                          : '9:16 Shorts'}
                      </div>
                    </div>

                    {/* Template Body */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                          {template.category}
                        </span>
                        <span className="font-mono tabular-nums flex items-center gap-1 shrink-0 text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {template.duration}s
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                        {template.title}
                      </h4>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>

                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06] text-[11px] text-zinc-600 dark:text-zinc-300 italic line-clamp-2">
                        <span className="text-zinc-900 dark:text-white font-semibold not-italic">
                          Hook :
                        </span>{' '}
                        « {template.samplePrompt} »
                      </div>
                    </div>
                  </div>

                  {/* Template Action Footer */}
                  <div className="p-4 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0B0B0D] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectTemplate(template)}
                      className="flex-1 py-2.5 px-3.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        {isYouTube
                          ? 'Générer (YouTube)'
                          : isTikTok
                          ? 'Générer (TikTok)'
                          : template.aspectRatio === '4:5'
                          ? 'Générer (Instagram)'
                          : 'Générer (Reels)'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </button>

                    {onCustomizeTemplate && (
                      <button
                        type="button"
                        onClick={() => onCustomizeTemplate(template)}
                        title="Personnaliser ce modèle dans le Studio"
                        className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-[#141418] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400 dark:hover:border-white/30 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Studio</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
