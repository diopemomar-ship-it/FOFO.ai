import { LibraryItem } from '../types';
import { AUTO_SAVE_KEYS } from './autoSave';

const FALLBACK_LIBRARY_IMAGE =
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80';

export const INITIAL_LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'lib-script-psycho-hook',
    type: 'script',
    title: 'Script Hook : 3 Biais Psychologiques Cachés',
    description: 'Structure narrative 45s haute rétention avec rupture cognitive dès les 2 premières secondes.',
    tags: ['psychologie', 'hook', 'shorts', 'viral'],
    createdAt: '2026-11-10T10:00:00.000Z',
    isFavorite: true,
    scriptData: {
      prompt:
        'Explique 3 biais psychologiques méconnus qui manipulent nos décisions chaque jour sans que nous en ayons conscience, avec des exemples concrets et une chute mémorable.',
      hook: 'Votre cerveau prend 95% de vos décisions avant même que vous ne réalisiez que vous avez choisi.',
      style: 'cinematic',
      aspectRatio: '9:16',
      duration: 45,
      niche: 'psychology',
      scenes: [
        {
          voiceoverText:
            'Votre cerveau prend 95% de vos décisions avant même que vous ne réalisiez que vous avez choisi.',
          durationSeconds: 7,
          visualDescription: 'Silhouette nocturne devant des néons urbains',
        },
        {
          voiceoverText:
            'Premier biais : l’effet de simple exposition. Plus vous voyez une idée, plus vous la croyez vraie.',
          durationSeconds: 8,
          visualDescription: 'Succession rapide d’écrans et reflets lumineux',
        },
        {
          voiceoverText:
            'Deuxième piège : le biais d’ancrage. Le premier chiffre que vous entendez dicte tout ce que vous êtes prêt à payer.',
          durationSeconds: 8,
          visualDescription: 'Graphiques abstraits et horloge cinématique',
        },
      ],
    },
  },
  {
    id: 'lib-image-nebula-4k',
    type: 'image',
    title: 'Nébuleuse Cosmique & Horizon Bleu',
    description: 'Plan spatial ultra-net idéal pour les scènes d’ouverture Science, Espace ou Philosophie.',
    tags: ['espace', 'cinématique', '4k', 'intro'],
    createdAt: '2026-11-11T14:20:00.000Z',
    isFavorite: true,
    imageData: {
      imageUrl:
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      source: 'Collection Studio',
      author: 'FOFO Curated',
      imagePrompt: 'Deep space planetary horizon with glowing blue atmosphere, 8k cinematic render',
    },
  },
  {
    id: 'lib-image-neon-cyber',
    type: 'image',
    title: 'Métropole Cyberpunk Pluvieuse',
    description: 'Ambiance néon contrastée parfaite pour sujets IA, Tech et Storytelling nocturne.',
    tags: ['cyberpunk', 'tech', 'néon', 'intro'],
    createdAt: '2026-11-12T09:15:00.000Z',
    isFavorite: false,
    imageData: {
      imageUrl:
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
      source: 'Collection Studio',
      author: 'FOFO Curated',
      imagePrompt: 'Neon cyberpunk alley with volumetric rain reflections, futuristic night scene',
    },
  },
  {
    id: 'lib-voice-narrateur-sombre',
    type: 'voice',
    title: 'Narrateur Mystère Profond',
    description: 'Voix grave et posée inspirée des documentaires énigmes et chaînes faceless.',
    tags: ['voix-grave', 'storytelling', 'mystère'],
    createdAt: '2026-11-13T16:40:00.000Z',
    isFavorite: true,
    voiceData: {
      baseVoiceId: 'thomas',
      pitch: 0.82,
      rate: 0.94,
      gender: 'homme',
      sampleText:
        'Ce que personne ne vous a jamais révélé commence précisément ici, derrière cette porte close.',
    },
  },
  {
    id: 'lib-voice-coach-rythme',
    type: 'voice',
    title: 'Chloé Shorts Ultra-Rythmée',
    description: 'Voix féminine vive et claire calibrée pour capter l’attention sur TikTok et Reels.',
    tags: ['voix-rapide', 'motivation', 'shorts'],
    createdAt: '2026-11-14T11:05:00.000Z',
    isFavorite: false,
    voiceData: {
      baseVoiceId: 'chloe',
      pitch: 1.14,
      rate: 1.16,
      gender: 'femme',
      sampleText:
        'Trois secondes pour changer votre routine du matin et doubler votre concentration dès aujourd’hui.',
    },
  },
];

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 32);
}

export function normalizeTagsList(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const clean = normalizeTag(t);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export function extractTagsWithCounts(items: LibraryItem[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const rawTag of item.tags || []) {
      const tag = normalizeTag(rawTag);
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'fr'));
}

export function loadLibraryItems(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEYS.LIBRARY);
    if (!raw) {
      return INITIAL_LIBRARY_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return INITIAL_LIBRARY_ITEMS;
}

export function saveLibraryItems(items: LibraryItem[]): boolean {
  try {
    localStorage.setItem(AUTO_SAVE_KEYS.LIBRARY, JSON.stringify(items));
    return true;
  } catch {
    // Si quota dépassé par une image dataURL volumineuse, remplacer les images > 150ko par fallback
    try {
      const compacted = items.map((item) => {
        if (
          item.type === 'image' &&
          item.imageData?.imageUrl?.startsWith('data:') &&
          item.imageData.imageUrl.length > 150_000
        ) {
          return {
            ...item,
            imageData: {
              ...item.imageData,
              imageUrl: FALLBACK_LIBRARY_IMAGE,
            },
          };
        }
        return item;
      });
      localStorage.setItem(AUTO_SAVE_KEYS.LIBRARY, JSON.stringify(compacted));
      return true;
    } catch {
      return false;
    }
  }
}
