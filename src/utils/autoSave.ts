import {
  AIModelEngine,
  AspectRatio,
  CaptionStyle,
  ContentNiche,
  GeneratedVideo,
  ImportedMediaItem,
  MusicMood,
  SceneTransition,
  StudioInspectorTab,
  TrendingEffectId,
  TrendingSfxId,
  VideoStyle,
} from '../types';

export const AUTO_SAVE_KEYS = {
  ACTIVE_PROJECT: 'fofo_active_project_v1',
  STUDIO_DRAFT: 'fofo_studio_draft_v1',
  WORKSPACE_STATE: 'fofo_workspace_state_v1',
  PLAYER_PREFS: 'fofo_player_prefs_v1',
  CREATIONS: 'fofo_creations',
  LIBRARY: 'fofo_my_library_v1',
} as const;

export type AppTab = 'studio' | 'animate' | 'creations' | 'library' | 'templates' | 'stats' | 'business' | 'bot' | 'pricing';

export interface StudioDraftState {
  prompt: string;
  aspectRatio: AspectRatio;
  duration: number;
  voiceId: string;
  style: VideoStyle;
  musicMood: MusicMood;
  captionStyle: CaptionStyle;
  karaokeHighlightColor?: string;
  defaultTransition: SceneTransition;
  trendingEffect?: TrendingEffectId;
  hookSfx?: TrendingSfxId | 'none';
  aiModel: AIModelEngine;
  niche: ContentNiche;
  activeDirectorTab: 'engine' | 'style' | 'audio';
  uploadedMedia: ImportedMediaItem[];
  savedAt: string;
}

export interface WorkspaceState {
  currentTab: AppTab;
  showEagleShowcase: boolean;
}

export interface PlayerPrefsState {
  videoId: string;
  currentSceneIdx: number;
  previewAspectRatio: '9:16' | '4:5' | '16:9';
  showFramingGuides: boolean;
  voiceVolume: number;
  musicVolume: number;
  audioBalance: number;
  isMuted: boolean;
  activeTab: StudioInspectorTab;
  vocalSpeed: number;
  ctaObjective: 'comments' | 'followers' | 'shares';
  customWatermark: string;
  showWatermark: boolean;
  autoDucking?: boolean;
  duckingIntensity?: number;
}

interface ActiveProjectRecord {
  video: GeneratedVideo | null;
  savedAt: string;
}

const FALLBACK_SCENE_IMAGE =
  'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1200&q=80';

export function sanitizeVideoForStorage(video: GeneratedVideo, stripLargeDataUrls = false): GeneratedVideo {
  return {
    ...video,
    scenes: video.scenes.map((scene) => {
      const hasEphemeralBlobVideo = Boolean(scene.videoUrl && scene.videoUrl.startsWith('blob:'));
      const hasEphemeralBlobImage = Boolean(scene.imageUrl && scene.imageUrl.startsWith('blob:'));
      const isOversizedDataImage =
        stripLargeDataUrls && Boolean(scene.imageUrl && scene.imageUrl.startsWith('data:') && scene.imageUrl.length > 120_000);

      return {
        ...scene,
        videoUrl: hasEphemeralBlobVideo ? undefined : scene.videoUrl,
        mediaType: hasEphemeralBlobVideo ? 'image' : scene.mediaType,
        imageUrl: hasEphemeralBlobImage || isOversizedDataImage ? FALLBACK_SCENE_IMAGE : scene.imageUrl,
      };
    }),
  };
}

export function sanitizeMediaItemsForStorage(
  items: ImportedMediaItem[],
  stripLargeDataUrls = false
): ImportedMediaItem[] {
  return items
    .filter((item) => !(stripLargeDataUrls && item.previewUrl.startsWith('data:') && item.previewUrl.length > 120_000))
    .map((item) => ({
      ...item,
      videoUrl: item.videoUrl && item.videoUrl.startsWith('blob:') ? undefined : item.videoUrl,
      mediaType: item.videoUrl && item.videoUrl.startsWith('blob:') ? 'image' : item.mediaType,
    }));
}

export function safeLoadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeSaveJson<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveActiveProject(video: GeneratedVideo | null): string | null {
  const savedAt = new Date().toISOString();
  const payload: ActiveProjectRecord = {
    video: video ? sanitizeVideoForStorage(video, false) : null,
    savedAt,
  };

  if (safeSaveJson(AUTO_SAVE_KEYS.ACTIVE_PROJECT, payload)) {
    return savedAt;
  }

  // En cas de dépassement du quota localStorage, compacter les médias volumineux tout en préservant le projet
  if (video) {
    const compactPayload: ActiveProjectRecord = {
      video: sanitizeVideoForStorage(video, true),
      savedAt,
    };
    if (safeSaveJson(AUTO_SAVE_KEYS.ACTIVE_PROJECT, compactPayload)) {
      return savedAt;
    }
  }

  return null;
}

export function loadActiveProject(
  fallback: GeneratedVideo,
  creations: GeneratedVideo[]
): { video: GeneratedVideo | null; savedAt: string | null } {
  const record = safeLoadJson<ActiveProjectRecord>(AUTO_SAVE_KEYS.ACTIVE_PROJECT);
  if (record && 'video' in record) {
    if (!record.video) {
      return { video: null, savedAt: record.savedAt };
    }
    return { video: record.video, savedAt: record.savedAt };
  }

  // Si un historique de créations existe déjà sans active_project, restaurer la plus récente
  if (creations.length > 0) {
    return { video: creations[0], savedAt: null };
  }

  return { video: fallback, savedAt: null };
}

export function saveCreationsList(creations: GeneratedVideo[]): boolean {
  const sanitized = creations.map((v) => sanitizeVideoForStorage(v, false));
  if (safeSaveJson(AUTO_SAVE_KEYS.CREATIONS, sanitized)) {
    return true;
  }

  // Fallback si quota dépassé : compacter les anciens projets puis garder jusqu'aux 20 plus récents
  const compact = creations.slice(0, 20).map((v) => sanitizeVideoForStorage(v, true));
  return safeSaveJson(AUTO_SAVE_KEYS.CREATIONS, compact);
}

export function saveStudioDraft(draft: Omit<StudioDraftState, 'savedAt'>): string | null {
  const savedAt = new Date().toISOString();
  const payload: StudioDraftState = {
    ...draft,
    uploadedMedia: sanitizeMediaItemsForStorage(draft.uploadedMedia, false),
    savedAt,
  };

  if (safeSaveJson(AUTO_SAVE_KEYS.STUDIO_DRAFT, payload)) {
    return savedAt;
  }

  const compactPayload: StudioDraftState = {
    ...draft,
    uploadedMedia: sanitizeMediaItemsForStorage(draft.uploadedMedia, true),
    savedAt,
  };
  if (safeSaveJson(AUTO_SAVE_KEYS.STUDIO_DRAFT, compactPayload)) {
    return savedAt;
  }

  return null;
}

export function loadStudioDraft(): StudioDraftState | null {
  return safeLoadJson<StudioDraftState>(AUTO_SAVE_KEYS.STUDIO_DRAFT);
}

export function saveWorkspaceState(state: WorkspaceState): boolean {
  return safeSaveJson(AUTO_SAVE_KEYS.WORKSPACE_STATE, state);
}

export function loadWorkspaceState(): WorkspaceState | null {
  return safeLoadJson<WorkspaceState>(AUTO_SAVE_KEYS.WORKSPACE_STATE);
}

export function savePlayerPrefs(prefs: PlayerPrefsState): boolean {
  return safeSaveJson(AUTO_SAVE_KEYS.PLAYER_PREFS, prefs);
}

export function loadPlayerPrefs(videoId: string): PlayerPrefsState | null {
  const prefs = safeLoadJson<Omit<PlayerPrefsState, 'activeTab'> & { activeTab?: string }>(
    AUTO_SAVE_KEYS.PLAYER_PREFS
  );
  if (!prefs || prefs.videoId !== videoId) return null;
  const rawTab = prefs.activeTab;
  const normalizedTab: StudioInspectorTab =
    rawTab === 'advanced'
      ? 'video-fx'
      : rawTab === 'scenes' ||
        rawTab === 'photo-edit' ||
        rawTab === 'video-fx' ||
        rawTab === 'audio-style' ||
        rawTab === 'script'
      ? rawTab
      : 'scenes';
  return {
    ...prefs,
    activeTab: normalizedTab,
  };
}
