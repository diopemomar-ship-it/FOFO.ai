export type AspectRatio = '9:16' | '4:5' | '16:9' | '1:1';

export type VideoStyle = 
  | 'cinematic' 
  | 'cyberpunk' 
  | 'anime' 
  | 'pixar3d' 
  | 'vintage' 
  | 'minimalist' 
  | 'luxury';

export type CaptionStyle = 
  | 'hormozi' 
  | 'neon-blue' 
  | 'minimal' 
  | 'karaoke';

export type MusicMood = 
  | 'epic' 
  | 'lofi' 
  | 'suspense' 
  | 'dynamic' 
  | 'ambient'
  | 'phonk-drift'
  | 'afro-amapiano'
  | 'trap-motivation'
  | 'synthwave-reels'
  | 'piano-story';

export type CameraEffect = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';

export type SceneTransition = 'fade' | 'slide' | 'cut' | 'zoom';

export type TransitionIntensity = 'slow' | 'normal' | 'fast' | 'intense';

export type AIModelEngine =
  | 'chatgpt-astra'
  | 'claude'
  | 'gemini'
  | 'grok'
  | 'deepseek'
  | 'mistral'
  | 'perplexity'
  | 'llama'
  | 'qwen'
  | 'cohere-command'
  | 'kimi'
  | 'nova-pro';

export type ImageVideoEngine =
  | 'kling-2'
  | 'runway-gen4'
  | 'luma-ray2'
  | 'sora-motion'
  | 'hailuo-minimax'
  | 'gemini-vision-motion';

export type ContentNiche =
  | 'general'
  | 'education'
  | 'motivation'
  | 'psychology'
  | 'business'
  | 'storytelling';

export type TrendingEffectId =
  | 'none'
  | 'vhs-retro'
  | 'rgb-glitch'
  | 'neon-cyber'
  | 'cinema-bars'
  | 'film-grain'
  | 'prism-glow'
  | 'flash-beat'
  | 'zoom-punch'
  | 'camcorder-rec'
  | 'spotlight-vignette'
  | 'speed-blur';

export type TrendingSfxId =
  | 'whoosh'
  | 'impact'
  | 'ding'
  | 'glitch'
  | 'riser'
  | 'shutter'
  | 'cash'
  | 'record-stop';

export type ColorGradePreset =
  | 'natural'
  | 'teal-orange'
  | 'noir-contrast'
  | 'golden-hour'
  | 'cyber-blue';

export type ImageMotionPreset =
  | 'orbit-3d'
  | 'dolly-zoom'
  | 'parallax-depth'
  | 'drone-flyover'
  | 'whip-pan'
  | 'ken-burns-drama'
  | 'float-breathing'
  | 'cine-reveal';

export type ImageMotionIntensity = 'subtle' | 'cinematic' | 'intense';

export type StudioInspectorTab =
  | 'scenes'
  | 'photo-edit'
  | 'video-fx'
  | 'audio-style'
  | 'script';

export interface ScenePhotoAdjustments {
  brightness?: number; // 50..150 (100 = normal)
  contrast?: number; // 50..150 (100 = normal)
  saturation?: number; // 0..200 (100 = normal)
  warmth?: number; // 0..100 (0 = neutral)
  blur?: number; // 0..8 px (0 = sharp)
  vignette?: number; // 0..80 % (0 = none)
  presetId?: string;
}

export interface SceneTransform {
  rotation?: number; // 0 | 90 | 180 | 270
  tilt?: number; // -15..15 degrees
  flipH?: boolean;
  flipV?: boolean;
  zoom?: number; // 1.0..2.2
  fitMode?: 'cover' | 'contain';
}

export interface SceneOverlayConfig {
  text?: string;
  position?: 'top' | 'center' | 'bottom';
  color?: string;
}

export interface VideoScene {
  sceneNumber: number;
  voiceoverText: string;
  durationSeconds: number;
  visualDescription: string;
  imagePrompt: string;
  visualThemeKeyword: string;
  keywords: string[];
  kenBurnsEffect: CameraEffect;
  imageUrl: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  transition?: SceneTransition;
  transitionIntensity?: TransitionIntensity;
  trendingEffect?: TrendingEffectId;
  motionPreset?: ImageMotionPreset;
  motionIntensity?: ImageMotionIntensity;
  focalPoint?: { x: number; y: number };
  aiAnimated?: boolean;
  voiceEnabled?: boolean;
  photoAdjustments?: ScenePhotoAdjustments;
  transform?: SceneTransform;
  playbackRate?: number;
  trimStart?: number;
  trimEnd?: number;
  clipVolume?: number;
  overlay?: SceneOverlayConfig;
}

export interface ImportedMediaItem {
  id: string;
  name: string;
  mediaType: 'image' | 'video';
  previewUrl: string;
  videoUrl?: string;
  durationSeconds: number;
}

export interface StockImageResult {
  id: string;
  title: string;
  author: string;
  license: string;
  source: string;
  thumbUrl: string;
  fullUrl: string;
  proxyUrl: string;
  width?: number;
  height?: number;
}

export interface GeneratedVideo {
  id: string;
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
  aspectRatio: AspectRatio;
  style: VideoStyle;
  voiceId: string;
  musicMood: MusicMood;
  captionStyle: CaptionStyle;
  karaokeHighlightColor?: string;
  defaultTransition?: SceneTransition;
  transitionIntensity?: TransitionIntensity;
  autoTransitionSfx?: boolean;
  autoDucking?: boolean;
  duckingIntensity?: number;
  hookSfx?: TrendingSfxId | 'none';
  trendingEffect?: TrendingEffectId;
  colorGrade?: ColorGradePreset;
  beatPulse?: boolean;
  aiModel?: AIModelEngine;
  imageVideoEngine?: ImageVideoEngine;
  niche?: ContentNiche;
  totalEstimatedDuration: number;
  scenes: VideoScene[];
  createdAt: string;
  isFavorite?: boolean;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'homme' | 'femme';
  tone: string;
  language: string;
  description: string;
  recommendedFor: string;
  speechSynthesisVoiceName?: string;
}

export type AppTheme = 'system' | 'light' | 'deep-night' | 'neon-contrast';
export type ResolvedTheme = 'light' | 'deep-night' | 'neon-contrast';

export type PaymentProvider = 'visa' | 'stripe' | 'paypal';
export type BillingCycle = 'monthly' | 'annual';

export interface UserSubscription {
  uid?: string;
  isAuthenticated?: boolean;
  authProvider?: 'google' | 'password';
  emailVerified?: boolean;
  installedApp?: boolean;
  plan: 'free' | 'pro' | 'business';
  creditsRemaining: number;
  maxCredits: number;
  renewalDate: string;
  name: string;
  email: string;
  avatarUrl: string;
  theme?: AppTheme;
  paymentProvider?: PaymentProvider;
  billingCycle?: BillingCycle;
  lastPaymentId?: string;
  cardLast4?: string;
}

export type CreatorPlatform = 'youtube' | 'tiktok';

export interface CreatorPersona {
  id: string;
  name: string;
  handle: string;
  platform: CreatorPlatform;
  country: 'FR' | 'INTL';
  niche: string;
  subscribersLabel: string;
  tagline: string;
  hookStyle: string;
  avatarBgGradient: string;
  avatarUrl?: string;
  accentColor: string;
  signatureIcon:
    | 'bolt'
    | 'ghost'
    | 'mountain'
    | 'camera'
    | 'newspaper'
    | 'flame'
    | 'smile'
    | 'sparkles'
    | 'mic'
    | 'trending'
    | 'gamepad'
    | 'laugh';
  initials: string;
  coverThumbnail: string;
  aspectRatio: AspectRatio;
  style: VideoStyle;
  voiceId: string;
  musicMood: MusicMood;
  captionStyle: CaptionStyle;
  karaokeHighlightColor?: string;
  trendingEffect?: TrendingEffectId;
  hookSfx?: TrendingSfxId;
  duration: number;
  sampleTopics: Array<{
    label: string;
    prompt: string;
  }>;
}

export interface VideoTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  samplePrompt: string;
  aspectRatio: AspectRatio;
  style: VideoStyle;
  voiceId: string;
  musicMood: MusicMood;
  captionStyle: CaptionStyle;
  karaokeHighlightColor?: string;
  trendingEffect?: TrendingEffectId;
  hookSfx?: TrendingSfxId;
  platform?: 'youtube' | 'tiktok' | 'instagram';
  duration: number;
  thumbnail: string;
  badge?: string;
}

export type ExportQualityPreset = '1080p-30' | '4k-60';

export interface BatchJobItem {
  id: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  videoId?: string;
  title?: string;
  error?: string;
}

export type TeamRole = 'Admin' | 'Producteur' | 'Éditeur' | 'Analyste';

export interface TeamSeat {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: 'Actif' | 'Invitation envoyée';
  addedAt: string;
}

export interface WebhookLog {
  id: string;
  event: string;
  url: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  ok: boolean;
}

export interface SupportTicket {
  id: string;
  subject: string;
  priority: 'Standard' | 'Prioritaire' | 'Critique Production';
  message: string;
  status: 'Pris en charge (< 15 min)' | 'Résolu';
  createdAt: string;
  managerReply?: string;
}

export interface CoachSuggestedAction {
  suggestedPrompt?: string;
  suggestedHook?: string;
  suggestedTitle?: string;
  suggestedHashtags?: string[];
  recommendedStyle?: VideoStyle;
}

export interface CreatorCoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string;
  audioDuration?: number;
  action?: CoachSuggestedAction;
  followUpQuestions?: string[];
}

export type BotPersona = 'assistant' | 'scriptwriter' | 'editor' | 'growth';

export type BotActionType =
  | 'generate_video'
  | 'update_active_video'
  | 'send_to_studio'
  | 'navigate';

export interface BotExecutableAction {
  type: BotActionType;
  label: string;
  prompt?: string;
  style?: VideoStyle;
  aspectRatio?: AspectRatio;
  duration?: number;
  title?: string;
  hook?: string;
  hashtags?: string[];
  captionStyle?: CaptionStyle;
  musicMood?: MusicMood;
  aiModel?: AIModelEngine;
  niche?: ContentNiche;
  targetTab?: 'studio' | 'creations' | 'library' | 'templates' | 'stats' | 'business' | 'bot' | 'pricing';
}

export type LibraryItemType = 'script' | 'image' | 'voice';

export interface LibraryScriptScene {
  voiceoverText: string;
  visualDescription?: string;
  durationSeconds?: number;
  imagePrompt?: string;
}

export interface LibraryScriptData {
  prompt: string;
  hook?: string;
  scenes?: LibraryScriptScene[];
  style?: VideoStyle;
  aspectRatio?: AspectRatio;
  duration?: number;
  niche?: ContentNiche;
}

export interface LibraryImageData {
  imageUrl: string;
  source?: string;
  author?: string;
  imagePrompt?: string;
}

export interface LibraryVoiceData {
  baseVoiceId: string;
  pitch: number;
  rate: number;
  gender: 'homme' | 'femme';
  sampleText?: string;
}

export interface LibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  isFavorite?: boolean;
  scriptData?: LibraryScriptData;
  imageData?: LibraryImageData;
  voiceData?: LibraryVoiceData;
}

export interface AIBotMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
  audioUrl?: string;
  audioDuration?: number;
  persona?: BotPersona;
  aiModel?: AIModelEngine;
  botAction?: BotExecutableAction;
  suggestions?: string[];
  executed?: boolean;
}

export interface AIBotDiscussion {
  id: string;
  title: string;
  persona: BotPersona;
  aiModel?: AIModelEngine;
  updatedAt: string;
  messages: AIBotMessage[];
}



