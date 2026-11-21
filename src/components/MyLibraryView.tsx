import React, { useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  FileText,
  Image as ImageIcon,
  Mic,
  Search,
  Star,
  Plus,
  Play,
  Square,
  Trash2,
  Edit3,
  Check,
  Copy,
  Tag,
  X,
  ArrowUpRight,
  SlidersHorizontal,
  Upload,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  AspectRatio,
  ContentNiche,
  GeneratedVideo,
  LibraryItem,
  LibraryItemType,
  VideoStyle,
} from '../types';
import { CONTENT_NICHES, VIDEO_STYLES, VOICES } from '../data/mockTemplates';
import {
  extractTagsWithCounts,
  normalizeTag,
  normalizeTagsList,
} from '../utils/libraryStorage';
import { audioEngine } from '../utils/audioEngine';
import { resizeImageDataUrlForAI } from '../utils/imageToVideoSynthesizer';

interface MyLibraryViewProps {
  items: LibraryItem[];
  currentVideo: GeneratedVideo | null;
  onAddItem: (item: LibraryItem) => void;
  onUpdateItem: (updated: LibraryItem) => void;
  onDeleteItem: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onReuseScript: (item: LibraryItem, mode: 'studio-draft' | 'open-project') => void;
  onReuseImage: (item: LibraryItem, mode: 'add-scene' | 'studio-rush') => void;
  onReuseVoice: (item: LibraryItem, mode: 'active-video' | 'studio-default') => void;
}

type TypeFilter = 'all' | LibraryItemType;
type SortMode = 'recent' | 'favorites' | 'title';
type TagMatchMode = 'and' | 'or';

const SUGGESTED_TAGS = [
  'hook',
  'viral',
  'shorts',
  'cinématique',
  'psychologie',
  'storytelling',
  'motivation',
  'tech',
  'espace',
  'voix-grave',
];

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80';

export const MyLibraryView: React.FC<MyLibraryViewProps> = ({
  items,
  currentVideo,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onToggleFavorite,
  onReuseScript,
  onReuseImage,
  onReuseVoice,
}) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>('and');

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [editingTagsItemId, setEditingTagsItemId] = useState<string | null>(null);
  const [inlineTagInput, setInlineTagInput] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [formType, setFormType] = useState<LibraryItemType>('script');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagDraft, setFormTagDraft] = useState<string>('');

  // Script fields
  const [formHook, setFormHook] = useState<string>('');
  const [formPrompt, setFormPrompt] = useState<string>('');
  const [formStyle, setFormStyle] = useState<VideoStyle>('cinematic');
  const [formAspectRatio, setFormAspectRatio] = useState<AspectRatio>('9:16');
  const [formDuration, setFormDuration] = useState<number>(45);
  const [formNiche, setFormNiche] = useState<ContentNiche>('general');

  // Image fields
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formImageAuthor, setFormImageAuthor] = useState<string>('Collection Personnelle');
  const [formImagePrompt, setFormImagePrompt] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice fields
  const [formBaseVoiceId, setFormBaseVoiceId] = useState<string>('thomas');
  const [formPitch, setFormPitch] = useState<number>(0.92);
  const [formRate, setFormRate] = useState<number>(1.0);
  const [formSampleText, setFormSampleText] = useState<string>(
    'Voici un aperçu de ma voix off personnalisée dans FOFO AI.'
  );
  const [isTestingModalVoice, setIsTestingModalVoice] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      all: items.length,
      script: items.filter((i) => i.type === 'script').length,
      image: items.filter((i) => i.type === 'image').length,
      voice: items.filter((i) => i.type === 'voice').length,
      favorites: items.filter((i) => i.isFavorite).length,
    };
  }, [items]);

  // Tags disponibles calculés selon l'onglet catégorie et le filtre favoris
  const availableTags = useMemo(() => {
    const scoped = items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (favoritesOnly && !item.isFavorite) return false;
      return true;
    });
    return extractTagsWithCounts(scoped);
  }, [items, typeFilter, favoritesOnly]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (favoritesOnly && !item.isFavorite) return false;

      if (selectedTags.length > 0) {
        const itemTags = (item.tags || []).map((t) => normalizeTag(t));
        const matchesTags =
          tagMatchMode === 'and'
            ? selectedTags.every((t) => itemTags.includes(t))
            : selectedTags.some((t) => itemTags.includes(t));
        if (!matchesTags) return false;
      }

      if (q) {
        const haystack = [
          item.title,
          item.description || '',
          ...(item.tags || []),
          item.scriptData?.prompt || '',
          item.scriptData?.hook || '',
          item.imageData?.author || '',
          item.imageData?.source || '',
          item.voiceData?.baseVoiceId || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...list];
    if (sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    } else if (sortMode === 'favorites') {
      sorted.sort((a, b) => {
        if (Boolean(b.isFavorite) !== Boolean(a.isFavorite)) {
          return b.isFavorite ? 1 : -1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [items, typeFilter, favoritesOnly, selectedTags, tagMatchMode, searchQuery, sortMode]);

  const toggleTagFilter = (tag: string) => {
    const clean = normalizeTag(tag);
    if (!clean) return;
    setSelectedTags((prev) =>
      prev.includes(clean) ? prev.filter((t) => t !== clean) : [...prev, clean]
    );
  };

  const resetAllFilters = () => {
    setTypeFilter('all');
    setFavoritesOnly(false);
    setSearchQuery('');
    setSelectedTags([]);
  };

  const openCreateModal = (defaultType: LibraryItemType = 'script') => {
    setEditingItem(null);
    setFormType(typeFilter !== 'all' ? typeFilter : defaultType);
    setFormTitle('');
    setFormDescription('');
    setFormTags(selectedTags.length > 0 ? [...selectedTags] : []);
    setFormTagDraft('');
    setFormHook('');
    setFormPrompt('');
    setFormStyle('cinematic');
    setFormAspectRatio('9:16');
    setFormDuration(45);
    setFormNiche('general');
    setFormImageUrl('');
    setFormImageAuthor('Collection Personnelle');
    setFormImagePrompt('');
    setFormBaseVoiceId('thomas');
    setFormPitch(0.92);
    setFormRate(1.0);
    setFormSampleText('Voici un aperçu de ma voix off personnalisée dans FOFO AI.');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: LibraryItem) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormTitle(item.title);
    setFormDescription(item.description || '');
    setFormTags(normalizeTagsList(item.tags || []));
    setFormTagDraft('');
    setFormHook(item.scriptData?.hook || '');
    setFormPrompt(item.scriptData?.prompt || '');
    setFormStyle(item.scriptData?.style || 'cinematic');
    setFormAspectRatio(item.scriptData?.aspectRatio || '9:16');
    setFormDuration(item.scriptData?.duration || 45);
    setFormNiche(item.scriptData?.niche || 'general');
    setFormImageUrl(item.imageData?.imageUrl || '');
    setFormImageAuthor(item.imageData?.author || 'Collection Personnelle');
    setFormImagePrompt(item.imageData?.imagePrompt || '');
    setFormBaseVoiceId(item.voiceData?.baseVoiceId || 'thomas');
    setFormPitch(item.voiceData?.pitch ?? 1.0);
    setFormRate(item.voiceData?.rate ?? 1.0);
    setFormSampleText(
      item.voiceData?.sampleText || 'Voici un aperçu de ma voix off personnalisée dans FOFO AI.'
    );
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddFormTag = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => normalizeTag(p))
      .filter(Boolean);
    if (parts.length === 0) return;
    setFormTags((prev) => normalizeTagsList([...prev, ...parts]));
    setFormTagDraft('');
  };

  const handleUploadImageFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsProcessingImage(true);
    setFormError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
        reader.readAsDataURL(file);
      });
      const optimized = await resizeImageDataUrlForAI(dataUrl, 800);
      setFormImageUrl(optimized);
      if (!formTitle.trim()) {
        setFormTitle(file.name.replace(/\.[^/.]+$/, '').slice(0, 60));
      }
    } catch {
      setFormError("Impossible de charger cette image depuis l'appareil.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError('Veuillez renseigner un titre pour cet élément.');
      return;
    }

    const pendingTags = formTagDraft.trim()
      ? normalizeTagsList([...formTags, ...formTagDraft.split(',')])
      : normalizeTagsList(formTags);

    const nowIso = new Date().toISOString();
    const selectedBaseVoice = VOICES.find((v) => v.id === formBaseVoiceId) || VOICES[0];

    if (formType === 'script') {
      if (!formPrompt.trim() && !formHook.trim()) {
        setFormError('Veuillez saisir un prompt ou une accroche pour votre script.');
        return;
      }
      const nextItem: LibraryItem = {
        id: editingItem ? editingItem.id : `lib-script-${Date.now()}`,
        type: 'script',
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        tags: pendingTags,
        createdAt: editingItem ? editingItem.createdAt : nowIso,
        updatedAt: nowIso,
        isFavorite: editingItem?.isFavorite ?? false,
        scriptData: {
          prompt: formPrompt.trim() || formHook.trim(),
          hook: formHook.trim() || undefined,
          style: formStyle,
          aspectRatio: formAspectRatio,
          duration: formDuration,
          niche: formNiche,
          scenes: editingItem?.scriptData?.scenes,
        },
      };
      if (editingItem) onUpdateItem(nextItem);
      else onAddItem(nextItem);
      setIsModalOpen(false);
      return;
    }

    if (formType === 'image') {
      if (!formImageUrl.trim()) {
        setFormError("Veuillez coller l'URL d'une image ou importer un fichier.");
        return;
      }
      const nextItem: LibraryItem = {
        id: editingItem ? editingItem.id : `lib-image-${Date.now()}`,
        type: 'image',
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        tags: pendingTags,
        createdAt: editingItem ? editingItem.createdAt : nowIso,
        updatedAt: nowIso,
        isFavorite: editingItem?.isFavorite ?? false,
        imageData: {
          imageUrl: formImageUrl.trim(),
          source: editingItem?.imageData?.source || 'Bibliothèque Perso',
          author: formImageAuthor.trim() || 'Créateur',
          imagePrompt: formImagePrompt.trim() || undefined,
        },
      };
      if (editingItem) onUpdateItem(nextItem);
      else onAddItem(nextItem);
      setIsModalOpen(false);
      return;
    }

    // formType === 'voice'
    const nextItem: LibraryItem = {
      id: editingItem ? editingItem.id : `lib-voice-${Date.now()}`,
      type: 'voice',
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      tags: pendingTags,
      createdAt: editingItem ? editingItem.createdAt : nowIso,
      updatedAt: nowIso,
      isFavorite: editingItem?.isFavorite ?? false,
      voiceData: {
        baseVoiceId: selectedBaseVoice.id,
        pitch: Number(formPitch.toFixed(2)),
        rate: Number(formRate.toFixed(2)),
        gender: selectedBaseVoice.gender,
        sampleText: formSampleText.trim() || undefined,
      },
    };
    if (editingItem) onUpdateItem(nextItem);
    else onAddItem(nextItem);
    setIsModalOpen(false);
  };

  const handleTogglePlayVoiceCard = (item: LibraryItem) => {
    if (playingVoiceId === item.id) {
      audioEngine.stopSpeech();
      setPlayingVoiceId(null);
      return;
    }
    const text =
      item.voiceData?.sampleText ||
      `Bonjour, voici la voix personnalisée ${item.title} prête pour votre prochaine vidéo.`;
    setPlayingVoiceId(item.id);
    audioEngine.speakText(text, item.id, {
      pitch: item.voiceData?.pitch,
      rate: item.voiceData?.rate,
      onEnd: () => setPlayingVoiceId(null),
      onError: () => setPlayingVoiceId(null),
    });
  };

  const handleTestModalVoice = () => {
    if (isTestingModalVoice) {
      audioEngine.stopSpeech();
      setIsTestingModalVoice(false);
      return;
    }
    setIsTestingModalVoice(true);
    audioEngine.speakText(
      formSampleText.trim() || 'Test de votre voix off personnalisée dans FOFO AI.',
      formBaseVoiceId,
      {
        pitch: formPitch,
        rate: formRate,
        onEnd: () => setIsTestingModalVoice(false),
        onError: () => setIsTestingModalVoice(false),
      }
    );
  };

  const handleAddInlineTag = (item: LibraryItem, rawTag: string) => {
    const clean = normalizeTag(rawTag);
    if (!clean) return;
    const nextTags = normalizeTagsList([...(item.tags || []), clean]);
    onUpdateItem({
      ...item,
      tags: nextTags,
      updatedAt: new Date().toISOString(),
    });
    setInlineTagInput('');
  };

  const handleRemoveInlineTag = (item: LibraryItem, tagToRemove: string) => {
    const clean = normalizeTag(tagToRemove);
    const nextTags = (item.tags || []).filter((t) => normalizeTag(t) !== clean);
    onUpdateItem({
      ...item,
      tags: nextTags,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCopyScript = (item: LibraryItem) => {
    const textParts = [
      item.scriptData?.hook ? `Hook : ${item.scriptData.hook}` : '',
      item.scriptData?.prompt || '',
      item.scriptData?.scenes?.length
        ? '\n' +
          item.scriptData.scenes
            .map((s, idx) => `[Scène ${idx + 1}] ${s.voiceoverText}`)
            .join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(textParts);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 1800);
  };

  const hasActiveFilters =
    typeFilter !== 'all' || favoritesOnly || searchQuery.trim().length > 0 || selectedTags.length > 0;

  return (
    <section className="max-w-[1640px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-white/[0.08]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl ig-story-ring p-[1.5px] shrink-0">
              <div className="w-full h-full rounded-[10px] bg-white dark:bg-black flex items-center justify-center text-zinc-900 dark:text-white">
                <BookMarked className="w-4 h-4" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-zinc-900 dark:text-white">
              Ma Bibliothèque
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Sauvegardez, classez par tags et réutilisez vos scripts, visuels et voix off sur mesure en un clic.
          </p>
          <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
            {counts.script} script{counts.script > 1 ? 's' : ''} · {counts.image} image
            {counts.image > 1 ? 's' : ''} · {counts.voice} voix off
            {counts.favorites > 0 ? ` · ${counts.favorites} favori${counts.favorites > 1 ? 's' : ''}` : ''}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCreateModal('script')}
            className="px-4 py-2.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel élément</span>
          </button>
        </div>
      </div>

      {/* Category Switcher + Search + Sort Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-1.5">
          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08]">
            {(
              [
                { id: 'all', label: 'Tout', count: counts.all, icon: Layers },
                { id: 'script', label: 'Scripts', count: counts.script, icon: FileText },
                { id: 'image', label: 'Images', count: counts.image, icon: ImageIcon },
                { id: 'voice', label: 'Voix off', count: counts.voice, icon: Mic },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              favoritesOnly
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                : 'bg-white dark:bg-[#121215] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
            <span>Favoris</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 lg:max-w-md justify-end">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un script, visuel, voix ou tag..."
              aria-label="Rechercher dans Ma Bibliothèque"
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Trier la bibliothèque"
              className="bg-transparent text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="recent" className="dark:bg-zinc-900">
                Plus récents
              </option>
              <option value="favorites" className="dark:bg-zinc-900">
                Favoris d&apos;abord
              </option>
              <option value="title" className="dark:bg-zinc-900">
                Nom (A-Z)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Multi-Tag Filtering Bar */}
      <div className="p-3.5 sm:px-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Tag className="w-3.5 h-3.5 text-[#0095F6]" />
            <span className="font-semibold text-zinc-900 dark:text-white">Filtrer par tags</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              · {filteredItems.length} résultat{filteredItems.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedTags.length >= 2 && (
              <div
                className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08] text-[11px]"
                title="Mode de combinaison des tags sélectionnés"
              >
                <button
                  type="button"
                  onClick={() => setTagMatchMode('and')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                    tagMatchMode === 'and'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Tous (ET)
                </button>
                <button
                  type="button"
                  onClick={() => setTagMatchMode('or')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                    tagMatchMode === 'or'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Au moins un (OU)
                </button>
              </div>
            )}

            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-[11px] font-semibold text-[#0095F6] hover:underline cursor-pointer"
              >
                Effacer les tags ({selectedTags.length})
              </button>
            )}
          </div>
        </div>

        {availableTags.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Aucun tag enregistré dans cette catégorie. Ajoutez des tags sur vos cartes pour classer vos ressources.
          </p>
        ) : (
          <div className="flex items-center flex-wrap gap-1.5">
            {availableTags.map(({ tag, count }) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagFilter(tag)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-zinc-50 dark:bg-[#09090B] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/25'
                  }`}
                >
                  <span>#{tag}</span>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Grid or Empty State */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] mx-auto flex items-center justify-center text-zinc-500">
            <BookMarked className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold font-heading text-zinc-900 dark:text-white">
              {hasActiveFilters
                ? 'Aucun élément ne correspond à vos filtres'
                : 'Votre bibliothèque est encore vide'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hasActiveFilters
                ? 'Essayez de désactiver certains tags ou de changer votre recherche.'
                : 'Sauvegardez vos scripts, images libres de droits ou réglages de voix depuis le Studio, ou créez un élément ici.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-zinc-900 dark:text-white cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            )}
            <button
              type="button"
              onClick={() => openCreateModal('script')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white electric-button-gradient inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un élément</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isEditingCardTags = editingTagsItemId === item.id;
            const typeLabel =
              item.type === 'script'
                ? 'Script'
                : item.type === 'image'
                ? 'Image'
                : 'Voix off';
            const TypeIcon =
              item.type === 'script' ? FileText : item.type === 'image' ? ImageIcon : Mic;
            const dateStr = new Date(item.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            });

            const baseVoice =
              item.type === 'voice'
                ? VOICES.find((v) => v.id === item.voiceData?.baseVoiceId) || VOICES[0]
                : null;

            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/20 transition-colors p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Top Metadata Line (unboxed text + icon actions, zero pill clutter) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      <TypeIcon className="w-3.5 h-3.5 text-[#0095F6]" />
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{typeLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{dateStr}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(item.id)}
                        title={item.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          item.isFavorite
                            ? 'text-amber-500 bg-amber-500/10'
                            : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Modifier cet élément"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {confirmDeleteId === item.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteItem(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Confirmer
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          title="Supprimer de la bibliothèque"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Image Preview for Image Cards */}
                  {item.type === 'image' && item.imageData && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-white/[0.06]">
                      <img
                        src={item.imageData.imageUrl || FALLBACK_IMAGE}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMAGE;
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold font-heading text-zinc-900 dark:text-white leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Type-specific content block */}
                  {item.type === 'script' && item.scriptData && (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06] space-y-1.5">
                      {item.scriptData.hook && (
                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">
                          « {item.scriptData.hook} »
                        </p>
                      )}
                      {!item.scriptData.hook && item.scriptData.prompt && (
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">
                          {item.scriptData.prompt}
                        </p>
                      )}
                      <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {VIDEO_STYLES.find((s) => s.id === item.scriptData?.style)?.name || 'Cinématique'}
                        {' · '}
                        {item.scriptData.aspectRatio || '9:16'}
                        {' · '}
                        {item.scriptData.duration || 45}s
                        {item.scriptData.scenes?.length
                          ? ` · ${item.scriptData.scenes.length} scènes`
                          : ''}
                      </p>
                    </div>
                  )}

                  {item.type === 'image' && item.imageData && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {item.imageData.source || 'Banque Studio'}
                      {item.imageData.author ? ` · ${item.imageData.author}` : ''}
                    </p>
                  )}

                  {item.type === 'voice' && item.voiceData && (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                            Base : {baseVoice?.name || item.voiceData.baseVoiceId} ({item.voiceData.gender})
                          </p>
                          <p className="font-mono tabular-nums">
                            Hauteur {item.voiceData.pitch.toFixed(2)}x · Vitesse{' '}
                            {item.voiceData.rate.toFixed(2)}x
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePlayVoiceCard(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                            playingVoiceId === item.id
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                              : 'bg-white dark:bg-[#141418] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-400'
                          }`}
                        >
                          {playingVoiceId === item.id ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>Écouter</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tags Line (Plain typographic inline links, no capsule pills!) */}
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[11px]">
                      {(item.tags || []).map((tag) => {
                        const clean = normalizeTag(tag);
                        const isFiltered = selectedTags.includes(clean);
                        return (
                          <span key={clean} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleTagFilter(clean)}
                              className={`font-medium transition-colors cursor-pointer ${
                                isFiltered
                                  ? 'text-[#0095F6] font-semibold underline underline-offset-2'
                                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                              }`}
                            >
                              #{clean}
                            </button>
                            {isEditingCardTags && (
                              <button
                                type="button"
                                onClick={() => handleRemoveInlineTag(item, clean)}
                                title={`Retirer le tag #${clean}`}
                                className="text-zinc-400 hover:text-red-500 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagsItemId(isEditingCardTags ? null : item.id);
                          setInlineTagInput('');
                        }}
                        className="text-[11px] font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                      >
                        {isEditingCardTags ? 'Terminer' : '+ Tag'}
                      </button>
                    </div>

                    {isEditingCardTags && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={inlineTagInput}
                          onChange={(e) => setInlineTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddInlineTag(item, inlineTagInput);
                            }
                          }}
                          placeholder="Nouveau tag (ex: viral)"
                          className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-[11px] text-zinc-900 dark:text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddInlineTag(item, inlineTagInput)}
                          disabled={!inlineTagInput.trim()}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          Ajouter
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reuse Action Footer */}
                <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.06] flex items-center flex-wrap gap-2">
                  {item.type === 'script' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onReuseScript(item, 'studio-draft')}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Utiliser dans le Studio</span>
                      </button>

                      {item.scriptData?.scenes && item.scriptData.scenes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onReuseScript(item, 'open-project')}
                          className="py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-zinc-900 dark:text-white transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Charger scènes
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyScript(item)}
                        title="Copier le script"
                        className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      >
                        {copiedItemId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}

                  {item.type === 'image' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onReuseImage(item, 'studio-rush')}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Utiliser dans le Studio</span>
                      </button>

                      <button
                        type="button"
                        disabled={!currentVideo}
                        onClick={() => onReuseImage(item, 'add-scene')}
                        title={
                          currentVideo
                            ? 'Ajouter comme nouvelle scène de la vidéo active'
                            : 'Aucune vidéo active dans le Studio'
                        }
                        className="py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-zinc-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                      >
                        + Scène active
                      </button>
                    </>
                  )}

                  {item.type === 'voice' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onReuseVoice(item, 'studio-default')}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Utiliser dans le Studio</span>
                      </button>

                      <button
                        type="button"
                        disabled={!currentVideo}
                        onClick={() => onReuseVoice(item, 'active-video')}
                        title={
                          currentVideo
                            ? 'Appliquer cette voix personnalisée à la vidéo active'
                            : 'Aucune vidéo active dans le Studio'
                        }
                        className="py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-zinc-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Appliquer au projet
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            audioEngine.stopSpeech();
            setIsTestingModalVoice(false);
            setIsModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
              <h2 className="text-base font-bold font-heading text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0095F6]" />
                <span>
                  {editingItem ? "Modifier l'élément" : 'Ajouter à Ma Bibliothèque'}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  audioEngine.stopSpeech();
                  setIsTestingModalVoice(false);
                  setIsModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              {/* Type Selector (locked when editing existing item) */}
              {!editingItem && (
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.08]">
                  {(
                    [
                      { id: 'script', label: 'Script', icon: FileText },
                      { id: 'image', label: 'Image', icon: ImageIcon },
                      { id: 'voice', label: 'Voix off', icon: Mic },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = formType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormType(opt.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          active
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Titre
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    formType === 'script'
                      ? 'Ex: Script Hook Psychologie Sombre'
                      : formType === 'image'
                      ? 'Ex: Panorama Cyberpunk 4K'
                      : 'Ex: Voix Narrateur Documentaire Grave'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Notes / Description (optionnel)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contexte d'utilisation ou remarque..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
                />
              </div>

              {/* Script Fields */}
              {formType === 'script' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Accroche / Hook (optionnel)
                    </label>
                    <input
                      type="text"
                      value={formHook}
                      onChange={(e) => setFormHook(e.target.value)}
                      placeholder="La phrase choc d'ouverture..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Prompt ou Script complet
                    </label>
                    <textarea
                      rows={4}
                      value={formPrompt}
                      onChange={(e) => setFormPrompt(e.target.value)}
                      placeholder="Décrivez le sujet ou collez votre texte prêt pour le Studio..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Style
                      </label>
                      <select
                        value={formStyle}
                        onChange={(e) => setFormStyle(e.target.value as VideoStyle)}
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                      >
                        {VIDEO_STYLES.map((s) => (
                          <option key={s.id} value={s.id} className="dark:bg-zinc-900">
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Format
                      </label>
                      <select
                        value={formAspectRatio}
                        onChange={(e) => setFormAspectRatio(e.target.value as AspectRatio)}
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                      >
                        <option value="9:16" className="dark:bg-zinc-900">
                          9:16 (Vertical)
                        </option>
                        <option value="1:1" className="dark:bg-zinc-900">
                          1:1 (Carré)
                        </option>
                        <option value="16:9" className="dark:bg-zinc-900">
                          16:9 (Paysage)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Niche
                      </label>
                      <select
                        value={formNiche}
                        onChange={(e) => setFormNiche(e.target.value as ContentNiche)}
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                      >
                        {CONTENT_NICHES.map((n) => (
                          <option key={n.id} value={n.id} className="dark:bg-zinc-900">
                            {n.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Fields */}
              {formType === 'image' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Image (URL ou fichier local)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                      />
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImageFile(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        disabled={isProcessingImage}
                        className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-xs font-semibold text-zinc-900 dark:text-white inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isProcessingImage ? 'Chargement...' : 'Importer'}</span>
                      </button>
                    </div>
                  </div>

                  {formImageUrl && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-zinc-200 dark:border-white/[0.08]">
                      <img
                        src={formImageUrl}
                        alt="Aperçu"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMAGE;
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Auteur / Crédit (optionnel)
                    </label>
                    <input
                      type="text"
                      value={formImageAuthor}
                      onChange={(e) => setFormImageAuthor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Voice Fields */}
              {formType === 'voice' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Voix de base IA
                    </label>
                    <select
                      value={formBaseVoiceId}
                      onChange={(e) => setFormBaseVoiceId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                    >
                      {VOICES.map((v) => (
                        <option key={v.id} value={v.id} className="dark:bg-zinc-900">
                          {v.name} — {v.tone} ({v.gender})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        <span>Hauteur (Pitch)</span>
                        <span className="font-mono tabular-nums">{formPitch.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.65}
                        max={1.45}
                        step={0.02}
                        value={formPitch}
                        onChange={(e) => setFormPitch(parseFloat(e.target.value))}
                        className="w-full accent-[#0095F6]"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        <span>Vitesse (Débit)</span>
                        <span className="font-mono tabular-nums">{formRate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.75}
                        max={1.4}
                        step={0.02}
                        value={formRate}
                        onChange={(e) => setFormRate(parseFloat(e.target.value))}
                        className="w-full accent-[#0095F6]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Phrase de test
                      </label>
                      <button
                        type="button"
                        onClick={handleTestModalVoice}
                        className="text-xs font-semibold text-[#0095F6] inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isTestingModalVoice ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Arrêter</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Tester la voix</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formSampleText}
                      onChange={(e) => setFormSampleText(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Tags Input + Quick Suggestions */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tags de classement
                </label>

                {formTags.length > 0 && (
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    {formTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => setFormTags((prev) => prev.filter((t) => t !== tag))}
                          className="text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formTagDraft}
                    onChange={(e) => setFormTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddFormTag(formTagDraft);
                      }
                    }}
                    placeholder="Ajouter un tag (Entrée ou virgule)..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddFormTag(formTagDraft)}
                    disabled={!formTagDraft.trim()}
                    className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] text-xs font-semibold text-zinc-900 dark:text-white disabled:opacity-40 cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  {SUGGESTED_TAGS.filter((t) => !formTags.includes(t))
                    .slice(0, 7)
                    .map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddFormTag(sug)}
                        className="px-2 py-0.5 rounded-md border border-zinc-200 dark:border-white/[0.08] text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                      >
                        + #{sug}
                      </button>
                    ))}
                </div>
              </div>

              {formError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.stopSpeech();
                    setIsTestingModalVoice(false);
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white electric-button-gradient cursor-pointer"
                >
                  {editingItem ? 'Enregistrer' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
