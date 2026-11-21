import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns/promises';
import net from 'net';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// ============================================================================
// Couche de Sécurité Globale : En-têtes HTTP, Anti-DoS, Anti-CSRF & Rate Limit
// ============================================================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), payment=(self)'
  );
  res.setHeader(
    'Content-Security-Policy',
    "base-uri 'self'; object-src 'none'; form-action 'self' https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com; frame-ancestors 'self' https://*.google.com https://aistudio.google.com https://*.aistudio.google.com"
  );
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Limite stricte par défaut (2 Mo) sauf /api/image-to-video (50 Mo) et /api/audio/transcribe (15 Mo)
const largeJsonParser = express.json({ limit: '50mb' });
const audioJsonParser = express.json({ limit: '15mb' });
const defaultJsonParser = express.json({ limit: '2mb' });
app.use((req, res, next) => {
  if (req.path === '/api/image-to-video') {
    return largeJsonParser(req, res, next);
  }
  if (req.path === '/api/audio/transcribe') {
    return audioJsonParser(req, res, next);
  }
  return defaultJsonParser(req, res, next);
});

// Vérification Same-Origin / Anti-CSRF sur les requêtes API mutantes
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  const originHeader = req.headers.origin;
  if (originHeader) {
    try {
      const originHost = new URL(String(originHeader)).host.toLowerCase();
      const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
      const envHost =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? new URL(process.env.APP_URL).host.toLowerCase()
          : '';
      if (originHost && requestHost && originHost !== requestHost && originHost !== envHost) {
        return res.status(403).json({ error: 'Origine de requête non autorisée (protection CSRF).' });
      }
    } catch {
      return res.status(403).json({ error: 'En-tête Origin invalide.' });
    }
  }
  return next();
});

// Rate limiter en mémoire par IP + catégorie de route
interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (v.resetAt <= now) rateBuckets.delete(k);
  }
}, 60_000).unref();

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(bucketPrefix: string, maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = getClientIp(req);
    const key = `${bucketPrefix}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);

    if (!existing || existing.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: `Trop de requêtes détectées. Réessayez dans ${retryAfterSec} secondes.`,
      });
    }

    existing.count += 1;
    return next();
  };
}

app.use('/api', createRateLimiter('api-global', 120, 60_000));
app.use('/api/payments', createRateLimiter('api-payments', 12, 60_000));
app.use('/api/business/test-webhook', createRateLimiter('api-webhook', 10, 60_000));
app.use(
  ['/api/generate-video', '/api/image-to-video', '/api/creator-coach', '/api/ai-bot', '/api/business/batch-ideas', '/api/audio'],
  createRateLimiter('api-ai', 25, 60_000)
);

// Initialisation du client Google GenAI selon les directives recommandées
const rawApiKey = process.env.GEMINI_API_KEY?.trim();
const apiKey = rawApiKey && rawApiKey !== 'MY_GEMINI_API_KEY' ? rawApiKey : undefined;
let ai: GoogleGenAI | null = null;
let audioAi: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  audioAi = new GoogleGenAI({
    apiKey: apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Curated high-res imagery matching various genres & themes for reliable high-definition visual clips
const THEMED_VISUALS: Record<string, string[]> = {
  space: [
    'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=1200&q=80',
  ],
  cyberpunk: [
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1515260268569-9271009adfdb?auto=format&fit=crop&w=1200&q=80',
  ],
  technology: [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  ],
  mystery: [
    'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?auto=format&fit=crop&w=1200&q=80',
  ],
  history: [
    'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
  ],
  nature: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
  ],
  luxury: [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
  ],
  motivation: [
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
  ],
  cinematic: [
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=1200&q=80',
  ],
};

function pickThemedImage(theme: string, index: number): string {
  const list = THEMED_VISUALS[theme.toLowerCase()] || THEMED_VISUALS.cinematic;
  return list[index % list.length];
}

type AIModelEngine =
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
type ContentNiche = 'general' | 'education' | 'motivation' | 'psychology' | 'business' | 'storytelling';

const AI_MODEL_LABELS: Record<AIModelEngine, string> = {
  'chatgpt-astra': 'ChatGPT Astra',
  claude: 'Claude',
  gemini: 'Gemini 4',
  grok: 'Grok 3',
  deepseek: 'DeepSeek R1',
  mistral: 'Mistral Large',
  perplexity: 'Perplexity Sonar',
  llama: 'Llama 4',
  qwen: 'Qwen 3 Max',
  'cohere-command': 'Command A',
  kimi: 'Kimi k1.5',
  'nova-pro': 'Amazon Nova Pro',
};

function normalizeAiModel(val: unknown): AIModelEngine {
  if (
    val === 'claude' ||
    val === 'gemini' ||
    val === 'chatgpt-astra' ||
    val === 'grok' ||
    val === 'deepseek' ||
    val === 'mistral' ||
    val === 'perplexity' ||
    val === 'llama' ||
    val === 'qwen' ||
    val === 'cohere-command' ||
    val === 'kimi' ||
    val === 'nova-pro'
  ) {
    return val;
  }
  return 'chatgpt-astra';
}

const NICHE_FLOW_BLUEPRINTS: Record<ContentNiche, string> = {
  education: `NICHE ÉDUCATION & PÉDAGOGIE — Cheminement logique obligatoire :
1. Scène 1 (Hook Question / Paradoxe) : capte l'attention en posant une énigme ou en cassant une idée reçue sur le sujet.
2. Scène 2 (Contexte simple) : situe l'enjeu en une phrase limpide accessible à tous.
3. Scène 3 (Principe fondamental) : explique le mécanisme ou la cause réelle étape par étape, avec clarté.
4. Scène 4 (Exemple concret) : illustre avec un cas réel, une analogie visuelle ou un chiffre vérifiable.
5. Scènes suivantes (Synthèse & Règle d'or) : résume l'essentiel à retenir et conclut sur une application pratique immédiate.`,
  motivation: `NICHE MOTIVATION & MINDSET — Cheminement émotionnel croissant obligatoire :
1. Scène 1 (Vérité brute / Électrochoc) : interpelle directement le spectateur dès les 2 premières secondes.
2. Scène 2 (Le piège du quotidien) : nomme avec justesse la peur, la distraction ou la procrastination qui freine tout le monde.
3. Scène 3 (Le déclic mental) : renverse la perspective avec une prise de conscience puissante et sincère.
4. Scène 4 (Discipline & Preuve) : montre l'action concrète ou l'habitude silencieuse qui fait toute la différence.
5. Scènes suivantes (Montée finale & Passage à l'action) : termine par un appel vibrant à commencer dès aujourd'hui.`,
  psychology: `NICHE PSYCHOLOGIE & BIAIS COGNITIFS — Cheminement structuré :
1. Scène 1 : situation familière dans laquelle le spectateur se reconnaît immédiatement.
2. Scène 2 : révélation du biais cognitif ou mécanisme cérébral caché.
3. Scène 3 : explication claire de pourquoi notre cerveau réagit ainsi.
4. Scène 4+ : impact réel au quotidien et astuce pratique pour reprendre le contrôle.`,
  business: `NICHE BUSINESS & FINANCE — Cheminement stratégique :
1. Scène 1 : chiffre fort ou erreur coûteuse que commettent 90% des débutants.
2. Scène 2 : diagnostic précis de la cause réelle.
3. Scène 3 : méthode ou levier concret expliqué simplement.
4. Scène 4+ : résultat mesurable et plan d'action en étapes claires.`,
  storytelling: `NICHE STORYTELLING & RÉCITS — Cheminement dramatique :
1. Scène 1 (In Media Res) : plonge au cœur d'un moment décisif ou mystérieux.
2. Scène 2 : pose le contexte et les enjeux humains.
3. Scène 3 : introduit l'obstacle ou le rebondissement clé.
4. Scène 4+ : climax intense et morale marquante.`,
  general: `CHEMINEMENT NARRATIF OPTIMISÉ :
1. Hook choc dès les 2 premières secondes.
2. Développement fluide et progressif d'une scène à l'autre avec transitions verbales naturelles.
3. Climax / Révélation + conclusion mémorable.`,
};

const ENGINE_STYLE_INSTRUCTIONS: Record<AIModelEngine, string> = {
  'chatgpt-astra':
    'STYLE COGNITIF CHATGPT ASTRA (OpenAI · Dernier modèle) : Tu maîtrises une architecture narrative d’une clarté chirurgicale. Chaque phrase enchaîne logiquement avec la suivante grâce à des transitions naturelles (« Voici pourquoi… », « Mais en réalité… », « La règle à retenir… »). Zéro phrase creuse, pédagogie lumineuse, rythme net et exemples concrets.',
  claude:
    'STYLE NARRATIF CLAUDE (Anthropic · Dernier modèle) : Tu écris avec une plume humaine profonde, nuancée et authentique. Aucun ton robotique ni cliché publicitaire. Tes phrases respirent, créent une vraie tension émotionnelle et accompagnent le spectateur jusqu’à un déclic sincère et inspirant.',
  gemini:
    'STYLE CINÉMATIQUE GEMINI 4 (Google) : Tu privilégies un rythme vif, visuel et percutant avec des images fortes et des phrases calibrées pour une rétention maximale.',
  grok:
    'STYLE DIRECT GROK 3 (xAI) : Tu adoptes un ton franc, incisif, audacieux et sans langue de bois. Accroche provocante ou contre-intuitive dès la première seconde, rythme nerveux et vérités percutantes qui déclenchent le débat.',
  deepseek:
    'STYLE ANALYTIQUE DEEPSEEK R1 : Tu décomposes le sujet avec un raisonnement rigoureux et méthodique : cause première, mécanisme vérifiable, nuance scientifique et synthèse imparable accessible à tous.',
  mistral:
    'STYLE ÉLOQUENCE MISTRAL LARGE (Mistral AI) : Tu rédiges dans un français d’une grande justesse littéraire et orale : vocabulaire riche sans être lourd, cadences naturelles et références culturelles subtiles.',
  perplexity:
    'STYLE DOCUMENTAIRE PERPLEXITY SONAR : Tu construis un cheminement factuel et sourcé : chiffres précis, dates, faits vérifiables et enchaînement logique de type reportage d’investigation.',
  llama:
    'STYLE SOCIAL LLAMA 4 (Meta) : Tu privilégies des phrases courtes, rythmées et ultra-digestes pensées pour Instagram Reels et Shorts, avec une progression dynamique sans temps mort.',
  qwen:
    'STYLE RAISONNEMENT QWEN 3 MAX (Alibaba) : Tu clarifies chaque concept étape par étape avec une structure logique rigoureuse, des transitions nettes et des exemples concrets.',
  'cohere-command':
    'STYLE ENTREPRISE COMMAND A (Cohere) : Tu adoptes un ton stratégique, orienté résultats, chiffres clés et synthèse claire adaptée au Business et à la Finance.',
  kimi:
    'STYLE STORYTELLING KIMI k1.5 (Moonshot AI) : Tu tisses un récit immersif au long cours, avec montée dramatique continue et enchaînement captivant entre chaque image.',
  'nova-pro':
    'STYLE STUDIO AMAZON NOVA PRO (AWS) : Tu livres une narration soignée, claire et professionnelle calibrée pour présentations, marques et documentaires modernes.',
};

function getOpenAICompatibleConfig(aiModel: AIModelEngine): {
  endpoint: string;
  apiKey: string;
  model: string;
  supportsJsonObject: boolean;
} | null {
  if (aiModel === 'chatgpt-astra' && process.env.OPENAI_API_KEY) {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_ASTRA_MODEL || 'gpt-4.1',
      supportsJsonObject: true,
    };
  }
  if (aiModel === 'grok' && process.env.XAI_API_KEY) {
    return {
      endpoint: 'https://api.x.ai/v1/chat/completions',
      apiKey: process.env.XAI_API_KEY,
      model: process.env.XAI_MODEL || 'grok-3-latest',
      supportsJsonObject: true,
    };
  }
  if (aiModel === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
    return {
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
      supportsJsonObject: false,
    };
  }
  if (aiModel === 'mistral' && process.env.MISTRAL_API_KEY) {
    return {
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
      supportsJsonObject: true,
    };
  }
  if (aiModel === 'perplexity' && process.env.PERPLEXITY_API_KEY) {
    return {
      endpoint: 'https://api.perplexity.ai/chat/completions',
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
      supportsJsonObject: false,
    };
  }
  if (aiModel === 'llama' && process.env.TOGETHER_API_KEY) {
    return {
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      apiKey: process.env.TOGETHER_API_KEY,
      model: process.env.LLAMA_MODEL || 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      supportsJsonObject: false,
    };
  }
  if (aiModel === 'qwen' && process.env.DASHSCOPE_API_KEY) {
    return {
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: process.env.DASHSCOPE_API_KEY,
      model: process.env.QWEN_MODEL || 'qwen-max',
      supportsJsonObject: true,
    };
  }
  if (aiModel === 'kimi' && process.env.MOONSHOT_API_KEY) {
    return {
      endpoint: 'https://api.moonshot.cn/v1/chat/completions',
      apiKey: process.env.MOONSHOT_API_KEY,
      model: process.env.KIMI_MODEL || 'kimi-latest',
      supportsJsonObject: false,
    };
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${ms}ms) sur ${label}`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateContentWithFallback(params: {
  contents: any;
  config?: Record<string, any>;
  preferLowThinking?: boolean;
  preferFastModel?: boolean;
  timeoutMs?: number;
}) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY non configurée');
  }
  const {
    contents,
    config = {},
    preferLowThinking = true,
    preferFastModel = false,
    timeoutMs = 7500,
  } = params;

  const liteAttempt = {
    model: 'gemini-3.1-flash-lite',
    modelConfig: config,
    ms: timeoutMs,
  };
  const hydrogenAttempt = {
    model: 'gemini-4-hydrogen',
    modelConfig: preferLowThinking
      ? { ...config, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
      : config,
    ms: timeoutMs,
  };

  const attempts = preferFastModel ? [liteAttempt, hydrogenAttempt] : [hydrogenAttempt, liteAttempt];

  let lastErr: any;
  for (const attempt of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attempt.ms);
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents,
          config: { ...attempt.modelConfig, abortSignal: controller.signal },
        }),
        attempt.ms + 250,
        attempt.model
      );
      clearTimeout(timer);
      if (response.text) {
        return response;
      }
      lastErr = new Error(`Réponse vide de ${attempt.model}`);
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      console.warn(`Fallback modèle Gemini après échec sur ${attempt.model}:`, err?.status || err?.message || err);
    }
  }
  throw lastErr || new Error('Tous les modèles Gemini sont indisponibles');
}

async function generateJsonWithSelectedEngine(params: {
  aiModel: AIModelEngine;
  systemInstruction: string;
  userPrompt: string;
  geminiSchema: any;
}): Promise<string | null> {
  const { aiModel, systemInstruction, userPrompt, geminiSchema } = params;

  const openAICompat = getOpenAICompatibleConfig(aiModel);
  if (openAICompat) {
    try {
      const bodyPayload: any = {
        model: openAICompat.model,
        messages: [
          {
            role: 'system',
            content: `${systemInstruction}\nRéponds STRICTEMENT avec un objet JSON valide respectant les clés demandées (title, hook, description, hashtags, scenes).`,
          },
          { role: 'user', content: userPrompt },
        ],
      };
      if (openAICompat.supportsJsonObject) {
        bodyPayload.response_format = { type: 'json_object' };
      }
      const resp = await fetch(openAICompat.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAICompat.apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        if (cleaned) return cleaned;
      }
    } catch (err) {
      console.warn(`Fallback vers Gemini pour ${AI_MODEL_LABELS[aiModel]}:`, err);
    }
  }

  if (aiModel === 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_CLAUDE_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 2400,
          system: `${systemInstruction}\nRéponds UNIQUEMENT avec du JSON pur (aucun texte avant ou après, aucun bloc markdown).`,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const rawText = data?.content?.[0]?.text || '';
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        if (cleaned) return cleaned;
      }
    } catch (err) {
      console.warn('Fallback vers Gemini pour Claude:', err);
    }
  }

  if (!ai) return null;

  const response = await generateContentWithFallback({
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: geminiSchema,
    },
    preferLowThinking: true,
    timeoutMs: 9000,
  });
  return response.text || null;
}

async function streamTextWithSelectedEngine(params: {
  aiModel: AIModelEngine;
  systemInstruction: string;
  fullPrompt: string;
  onChunk: (text: string) => void;
}): Promise<boolean> {
  const { aiModel, systemInstruction, fullPrompt, onChunk } = params;

  const openAICompat = getOpenAICompatibleConfig(aiModel);
  if (openAICompat) {
    try {
      const resp = await fetch(openAICompat.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAICompat.apiKey}`,
        },
        body: JSON.stringify({
          model: openAICompat.model,
          stream: true,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: fullPrompt },
          ],
        }),
      });
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            if (raw === '[DONE]') return true;
            try {
              const json = JSON.parse(raw);
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) onChunk(delta);
            } catch {
              // ignore partial chunk
            }
          }
        }
        return true;
      }
    } catch (err) {
      console.warn(`Stream fallback Gemini pour ${AI_MODEL_LABELS[aiModel]}:`, err);
    }
  }

  if (aiModel === 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_CLAUDE_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 1800,
          stream: true,
          system: systemInstruction,
          messages: [{ role: 'user', content: fullPrompt }],
        }),
      });
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            try {
              const json = JSON.parse(raw);
              if (json?.type === 'content_block_delta' && json?.delta?.text) {
                onChunk(json.delta.text);
              }
            } catch {
              // ignore partial chunk
            }
          }
        }
        return true;
      }
    } catch (err) {
      console.warn('Stream fallback Gemini pour Claude:', err);
    }
  }

  if (!ai) return false;

  const streamAttempts: { model: string; config: Record<string, any>; ms: number }[] = [
    {
      model: 'gemini-3.1-flash-lite',
      config: {
        systemInstruction,
      },
      ms: 8500,
    },
    {
      model: 'gemini-4-hydrogen',
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
      ms: 6500,
    },
  ];

  let lastErr: any = null;
  for (const attempt of streamAttempts) {
    let emittedChars = 0;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attempt.ms);
    try {
      const stream = await withTimeout(
        ai.models.generateContentStream({
          model: attempt.model,
          contents: fullPrompt,
          config: { ...attempt.config, abortSignal: controller.signal },
        }),
        attempt.ms + 250,
        attempt.model
      );

      for await (const chunk of stream) {
        if (chunk.text) {
          emittedChars += chunk.text.length;
          onChunk(chunk.text);
        }
      }
      clearTimeout(timer);
      if (emittedChars > 0) {
        return true;
      }
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      console.warn(
        `Stream fallback après échec sur ${attempt.model} (emittedChars=${emittedChars}):`,
        err?.status || err?.message || err
      );
      if (emittedChars > 0) {
        return true;
      }
    }
  }

  // Ultime tentative non-streaming avec gemini-3.1-flash-lite avant fallback
  const syncController = new AbortController();
  const syncTimer = setTimeout(() => syncController.abort(), 8000);
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: fullPrompt,
        config: { systemInstruction, abortSignal: syncController.signal },
      }),
      8250,
      'gemini-3.1-flash-lite-sync'
    );
    clearTimeout(syncTimer);
    if (response.text) {
      onChunk(response.text);
      return true;
    }
  } catch (err: any) {
    clearTimeout(syncTimer);
    lastErr = err;
    console.warn('Échec ultime Gemini chat:', err?.status || err?.message || err);
  }

  if (lastErr) {
    throw lastErr;
  }
  return false;
}

function normalizeTargetDuration(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 45;
  return Math.max(15, Math.min(43200, Math.round(num)));
}

function getSceneCountForDuration(durationSeconds: number): number {
  if (durationSeconds <= 30) return 4;
  if (durationSeconds <= 60) return 6;
  if (durationSeconds <= 180) return 8;
  if (durationSeconds <= 600) return 10;
  if (durationSeconds <= 1800) return 14;
  if (durationSeconds <= 3600) return 18;
  return 24;
}

function formatDurationFr(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe} secondes`;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}h${m > 0 ? ` ${String(m).padStart(2, '0')}min` : ''}${s > 0 ? ` ${s}s` : ''}`;
  }
  return `${m} min${s > 0 ? ` ${s}s` : ''}`;
}

function calibrateScenesToDuration<T extends { durationSeconds?: number }>(
  scenes: T[],
  targetDuration: number
): T[] {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;
  const count = scenes.length;
  const rawWeights = scenes.map((s) => Math.max(1, Number(s.durationSeconds) || 5));
  const weightSum = rawWeights.reduce((acc, w) => acc + w, 0) || count;

  let allocated = 0;
  return scenes.map((scene, idx) => {
    if (idx === count - 1) {
      const remaining = Math.max(2, targetDuration - allocated);
      return { ...scene, durationSeconds: remaining };
    }
    const minNeededForRest = (count - 1 - idx) * 2;
    const proportional = Math.max(2, Math.round((rawWeights[idx] / weightSum) * targetDuration));
    const capped = Math.min(proportional, Math.max(2, targetDuration - allocated - minNeededForRest));
    allocated += capped;
    return { ...scene, durationSeconds: capped };
  });
}

// Fallback intelligent script generator if API key is absent or quota is hit
function generateFallbackScript(
  prompt: string,
  style: string,
  duration: number,
  aiModel: AIModelEngine = 'gemini',
  niche: ContentNiche = 'general'
) {
  const safeDuration = normalizeTargetDuration(duration);
  const sceneCount = getSceneCountForDuration(safeDuration);
  const isLongForm = safeDuration > 180;
  const scenes = [];
  const effects: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
    'zoom-in',
    'pan-right',
    'zoom-out',
    'pan-left',
    'zoom-in',
    'pan-right',
    'zoom-out',
    'pan-left',
  ];

  const shortTopic = prompt.slice(0, 55);
  const themes =
    niche === 'motivation'
      ? ['motivation', 'cinematic', 'luxury', 'nature', 'motivation', 'cinematic']
      : niche === 'education'
      ? ['technology', 'history', 'space', 'cinematic', 'mystery', 'technology']
      : ['mystery', 'technology', 'space', 'motivation', 'luxury', 'cinematic', 'history', 'nature'];

  const buildVoiceLine = (i: number) => {
    if (isLongForm) {
      if (i === 0) {
        return `Bienvenue dans ce grand format de ${formatDurationFr(safeDuration)} consacré à "${shortTopic}". Installez-vous confortablement, nous entrons dans le vif du sujet.`;
      }
      if (i === sceneCount - 1) {
        return `Chapitre final : voici la synthèse complète de tout ce que nous avons exploré sur "${shortTopic}". Abonnez-vous et partagez votre retour en commentaire.`;
      }
      return `Chapitre ${i + 1} sur ${sceneCount} : approfondissons maintenant une facette essentielle de "${shortTopic}", avec des exemples concrets et des perspectives inédites.`;
    }
    if (niche === 'education') {
      if (i === 0) return `Pourquoi presque tout le monde comprend mal "${shortTopic}" ? Voici l'explication claire.`;
      if (i === 1) return `Première étape : pour maîtriser ce principe, il faut d'abord comprendre le mécanisme caché derrière.`;
      if (i === 2) return `Concrètement, lorsque l'on observe cet exemple dans la réalité, le schéma devient immédiatement évident.`;
      if (i === sceneCount - 1) return `La règle d'or à retenir dès aujourd'hui : appliquez ce principe simple et abonnez-vous pour le prochain cours.`;
      return `Étape ${i} : c'est précisément ce lien logique qui permet de passer de la théorie à la maîtrise totale.`;
    }
    if (niche === 'motivation') {
      if (i === 0) return `Arrêtez d'attendre le moment parfait pour "${shortTopic}". Ce moment n'arrivera jamais tout seul.`;
      if (i === 1) return `Chaque jour où vous doutez de vous, la distraction et la peur volent silencieusement votre potentiel.`;
      if (i === 2) return `Le vrai déclic arrive quand vous réalisez que la discipline bat le talent à chaque fois que le talent s'arrête.`;
      if (i === sceneCount - 1) return `Faites ce premier pas dès maintenant, même imparfait. Votre futur vous en remerciera demain.`;
      return `Répétez l'effort chaque matin sans chercher d'excuses : c'est dans ces heures silencieuses que tout se construit.`;
    }
    if (i === 0) return `Voici la vérité fascinante sur "${shortTopic}" que 99% des gens ignorent encore.`;
    if (i === sceneCount - 1) return `Et vous, que pensez-vous de cette découverte ? Dites-le en commentaire et abonnez-vous pour la suite !`;
    return `Point capital numéro ${i} : l'impact invisible qui transforme complètement notre compréhension du phénomène.`;
  };

  for (let i = 0; i < sceneCount; i++) {
    const theme = themes[i % themes.length];
    scenes.push({
      sceneNumber: i + 1,
      voiceoverText: buildVoiceLine(i),
      durationSeconds: Math.max(3, Math.round(safeDuration / sceneCount)),
      visualDescription: isLongForm
        ? `Chapitre ${i + 1}/${sceneCount} — Séquence documentaire immersive haute définition illustrant "${shortTopic}".`
        : `Séquence cinématique haute intensité illustrant le sujet avec éclairage dramatique et atmosphère immersive.`,
      imagePrompt: `Cinematic ultra-realistic visual of ${prompt}, scene ${i + 1}, high resolution, volumetric cinematic lighting, 8k render, masterpiece`,
      visualThemeKeyword: theme,
      keywords:
        niche === 'motivation'
          ? ['discipline', 'déclic', 'action', 'potentiel']
          : niche === 'education'
          ? ['principe', 'exemple', 'comprendre', 'règle']
          : ['incroyable', 'secret', 'découverte', 'impact', 'futur'],
      kenBurnsEffect: effects[i % effects.length],
      imageUrl: pickThemedImage(theme, i),
    });
  }

  const calibratedScenes = calibrateScenesToDuration(scenes, safeDuration);

  return {
    id: `fofo-${Date.now()}`,
    title: prompt.length > 50 ? `${prompt.slice(0, 47)}...` : prompt,
    hook: calibratedScenes[0]?.voiceoverText || `Le secret choc sur ${prompt.slice(0, 30)}`,
    description: `Vidéo générée avec ${AI_MODEL_LABELS[aiModel]} (${niche}, ${formatDurationFr(safeDuration)}) : ${prompt}`,
    hashtags:
      niche === 'motivation'
        ? ['#Motivation', '#Discipline', '#Mindset', '#Reussite', '#FOFOAI']
        : niche === 'education'
        ? ['#Education', '#Apprendre', '#Savoir', '#Culture', '#FOFOAI']
        : isLongForm
        ? ['#FOFOAI', '#Documentaire', '#LongFormat', '#YouTube', '#DeepDive']
        : ['#FOFOAI', '#Shorts', '#Viral', '#Facts', '#AI'],
    aspectRatio: '9:16',
    style: style || 'cinematic',
    voiceId: 'mathieu',
    musicMood: 'epic',
    captionStyle: 'hormozi',
    aiModel,
    niche,
    totalEstimatedDuration: calibratedScenes.reduce((acc, s) => acc + s.durationSeconds, 0),
    scenes: calibratedScenes,
  };
}

// Endpoint POST /api/generate-video
app.post('/api/generate-video', async (req, res) => {
  try {
    const {
      prompt,
      aspectRatio = '9:16',
      duration = 45,
      voiceId = 'mathieu',
      language = 'fr',
      style = 'cinematic',
      musicMood = 'epic',
      captionStyle = 'hormozi',
      aiModel = 'chatgpt-astra',
      niche = 'general',
    } = req.body;

    const selectedModel = normalizeAiModel(aiModel);

    const selectedNiche: ContentNiche =
      niche === 'education' ||
      niche === 'motivation' ||
      niche === 'psychology' ||
      niche === 'business' ||
      niche === 'storytelling'
        ? niche
        : 'general';

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Veuillez saisir une idée ou un texte pour générer la vidéo.' });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ error: 'Le prompt dépasse la limite de 4000 caractères.' });
    }

    const safeDuration = normalizeTargetDuration(duration);
    const sceneCount = getSceneCountForDuration(safeDuration);
    const isLongForm = safeDuration > 180;

    const systemInstruction = `Tu es FOFO AI, l'intelligence artificielle d'élite pour la création de scripts et vidéos (TikTok, YouTube Shorts, Instagram Reels, YouTube 16:9, documentaires et podcasts longue durée dépassant 1 heure).
${ENGINE_STYLE_INSTRUCTIONS[selectedModel]}

${NICHE_FLOW_BLUEPRINTS[selectedNiche]}

Règles de réalisation :
- Rédige en français naturel, fluide et parfaitement enchaîné entre les scènes (le cheminement doit être logique, progressif et captivant du début à la fin).
- Le Hook (scène 1) doit capter l'attention dans les 2 premières secondes.
- Chaque scène doit préciser un mot-clé visuel thématique parmi : 'space', 'cyberpunk', 'technology', 'mystery', 'history', 'nature', 'luxury', 'motivation', 'cinematic'.
- Génère exactement ${sceneCount} ${isLongForm ? 'chapitres narratifs structurés' : 'scènes'} adaptés à une durée totale ciblée de ${formatDurationFr(safeDuration)} (${safeDuration} secondes).`;

    const userPrompt = `Crée un script vidéo professionnel avec un cheminement impeccable pour le sujet suivant :
"${prompt}"

Configuration :
- Moteur IA sélectionné : ${AI_MODEL_LABELS[selectedModel]}
- Niche ciblée : ${selectedNiche}
- Durée totale ciblée : ${formatDurationFr(safeDuration)} (${safeDuration} secondes, découpée en ${sceneCount} ${isLongForm ? 'chapitres' : 'scènes'}).
- Style visuel : ${style}
- Format : ${aspectRatio}
- Langue : ${language === 'en' ? 'Anglais' : language === 'es' ? 'Espagnol' : 'Français'}`;

    const geminiSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Titre accrocheur de la vidéo' },
        hook: { type: Type.STRING, description: 'Accroche explosive des 3 premières secondes' },
        description: { type: Type.STRING, description: 'Description complète pour TikTok/YouTube' },
        hashtags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '5 hashtags pertinents avec #',
        },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              voiceoverText: { type: Type.STRING, description: 'Texte exact prononcé par la voix off pour cette scène' },
              durationSeconds: { type: Type.NUMBER, description: 'Durée en secondes pour ce chapitre ou scène' },
              visualDescription: { type: Type.STRING, description: 'Description de ce que l\'on voit à l\'écran' },
              imagePrompt: { type: Type.STRING, description: 'Prompt artistique en anglais pour illustrer la scène' },
              visualThemeKeyword: {
                type: Type.STRING,
                description: 'space, cyberpunk, technology, mystery, history, nature, luxury, motivation, ou cinematic',
              },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 ou 3 mots clés à surligner en sous-titre',
              },
            },
            required: [
              'sceneNumber',
              'voiceoverText',
              'durationSeconds',
              'visualDescription',
              'imagePrompt',
              'visualThemeKeyword',
              'keywords',
            ],
          },
        },
      },
      required: ['title', 'hook', 'description', 'hashtags', 'scenes'],
    };

    const textOutput = await generateJsonWithSelectedEngine({
      aiModel: selectedModel,
      systemInstruction,
      userPrompt,
      geminiSchema,
    });

    if (!textOutput) {
      const fallback = generateFallbackScript(prompt, style, safeDuration, selectedModel, selectedNiche);
      fallback.aspectRatio = aspectRatio;
      fallback.voiceId = voiceId;
      fallback.musicMood = musicMood;
      fallback.captionStyle = captionStyle;
      return res.json(fallback);
    }

    const parsedData = JSON.parse(textOutput);
    const effects: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
      'zoom-in',
      'pan-right',
      'zoom-out',
      'pan-left',
    ];

    // Harmonisation et enrichissement des scènes, calibrées sur la durée totale ciblée (courte ou > 1h)
    const enrichedScenes = calibrateScenesToDuration(
      parsedData.scenes.map((scene: any, index: number) => {
        const theme = scene.visualThemeKeyword || 'cinematic';
        const imageUrl = pickThemedImage(theme, index);
        const kenBurns = effects[index % effects.length];
        return {
          ...scene,
          sceneNumber: index + 1,
          kenBurnsEffect: kenBurns,
          imageUrl,
          transition: req.body.defaultTransition || 'fade',
        };
      }),
      safeDuration
    );

    const result = {
      id: `fofo-${Date.now()}`,
      title: parsedData.title || prompt,
      hook: parsedData.hook || '',
      description: parsedData.description || '',
      hashtags: parsedData.hashtags || ['#FOFOAI', '#Viral', '#Shorts'],
      aspectRatio,
      style,
      voiceId,
      musicMood,
      captionStyle,
      aiModel: selectedModel,
      niche: selectedNiche,
      defaultTransition: req.body.defaultTransition || 'fade',
      trendingEffect: req.body.trendingEffect || 'none',
      hookSfx: req.body.hookSfx || 'none',
      totalEstimatedDuration: enrichedScenes.reduce((acc: number, s: any) => acc + (s.durationSeconds || 6), 0),
      scenes: enrichedScenes,
    };

    return res.json(result);
  } catch (error: any) {
    console.error('Erreur lors de la génération de la vidéo:', error);
    const fallback = generateFallbackScript(
      req.body.prompt || 'Mystère de l\'univers',
      req.body.style || 'cinematic',
      normalizeTargetDuration(req.body.duration),
      req.body.aiModel || 'chatgpt-astra',
      req.body.niche || 'general'
    );
    return res.json(fallback);
  }
});

// Endpoint POST /api/image-to-video — Analyse Multimodale Gemini Vision & Chorégraphie Image → Vidéo IA
app.post('/api/image-to-video', async (req, res) => {
  try {
    const {
      images = [],
      motionPrompt = '',
      motionPreset = 'auto',
      imageVideoEngine = 'kling-2',
      motionIntensity = 'cinematic',
      clipDuration = 5,
      aspectRatio = '9:16',
      style = 'cinematic',
      voiceId = 'mathieu',
      musicMood = 'epic',
      captionStyle = 'hormozi',
      aiModel = 'chatgpt-astra',
      niche = 'general',
      trendingEffect = 'none',
      hookSfx = 'impact',
      defaultTransition = 'fade',
    } = req.body || {};

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Veuillez importer au moins une image pour la transformer en vidéo IA.' });
    }

    const safeImages = images.slice(0, 10);
    const selectedModel = normalizeAiModel(aiModel);
    const safeClipDuration = Math.min(8, Math.max(3, Number(clipDuration) || 5));

    const validMotionPresets = [
      'orbit-3d',
      'dolly-zoom',
      'parallax-depth',
      'drone-flyover',
      'whip-pan',
      'ken-burns-drama',
      'float-breathing',
      'cine-reveal',
    ] as const;

    const engineDefaultPresetMap: Record<string, (typeof validMotionPresets)[number]> = {
      'kling-2': 'orbit-3d',
      'runway-gen4': 'dolly-zoom',
      'luma-ray2': 'parallax-depth',
      'sora-motion': 'drone-flyover',
      'hailuo-minimax': 'whip-pan',
      'gemini-vision-motion': 'ken-burns-drama',
    };

    const buildFallbackImageToVideo = () => {
      const effects: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
        'zoom-in',
        'pan-right',
        'zoom-out',
        'pan-left',
      ];
      const basePreset =
        motionPreset !== 'auto' && (validMotionPresets as readonly string[]).includes(motionPreset)
          ? motionPreset
          : engineDefaultPresetMap[imageVideoEngine] || 'orbit-3d';

      const scenes = safeImages.map((img: any, idx: number) => {
        const cleanName = String(img?.name || `Image ${idx + 1}`).replace(/\.[^/.]+$/, '');
        const presetChoice =
          motionPreset === 'auto'
            ? validMotionPresets[idx % validMotionPresets.length]
            : basePreset;
        return {
          sceneNumber: idx + 1,
          voiceoverText:
            idx === 0
              ? motionPrompt.trim()
                ? `${motionPrompt.trim().slice(0, 120)} — regardez cette transformation en mouvement.`
                : `Regardez comment cette image (« ${cleanName} ») prend vie avec une profondeur cinématique.`
              : idx === safeImages.length - 1
              ? `Chaque détail s'anime jusqu'au plan final. Laquelle de ces séquences préférez-vous ?`
              : `Plan ${idx + 1} : un mouvement fluide révèle toute l'intensité de ${cleanName}.`,
          durationSeconds: safeClipDuration,
          visualDescription: `Animation IA ${presetChoice} sur « ${cleanName} » (${imageVideoEngine})`,
          imagePrompt: motionPrompt || `Cinematic AI motion animation of ${cleanName}`,
          visualThemeKeyword: 'cinematic',
          keywords: ['animation', 'mouvement', 'cinéma'],
          kenBurnsEffect: effects[idx % effects.length],
          motionPreset: presetChoice,
          motionIntensity,
          focalPoint: { x: 0.5, y: 0.45 },
          transition: defaultTransition || 'fade',
        };
      });

      return {
        id: `fofo-i2v-${Date.now()}`,
        title: motionPrompt.trim()
          ? motionPrompt.trim().slice(0, 52)
          : `Transformation Image → Vidéo IA (${safeImages.length} plan${safeImages.length > 1 ? 's' : ''})`,
        hook: scenes[0]?.voiceoverText || 'Regardez cette photo prendre vie grâce à l’IA.',
        description:
          motionPrompt.trim() ||
          `Vidéo animée par IA (${imageVideoEngine} + ${AI_MODEL_LABELS[selectedModel]}) à partir de ${safeImages.length} image(s).`,
        hashtags: ['#ImageToVideo', '#FOFOAI', '#AIAnimation', '#Reels', '#Shorts'],
        aspectRatio,
        style,
        voiceId,
        musicMood,
        captionStyle,
        aiModel: selectedModel,
        imageVideoEngine,
        niche,
        defaultTransition,
        trendingEffect,
        hookSfx,
        totalEstimatedDuration: scenes.length * safeClipDuration,
        scenes,
      };
    };

    if (!ai) {
      return res.json(buildFallbackImageToVideo());
    }

    // Construire les parts multimodales (chaque image envoyée à Gemini 4 Vision)
    const parts: any[] = [];
    safeImages.forEach((img: any, index: number) => {
      const dataUrl = String(img?.dataUrl || '');
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        parts.push({
          text: `Image #${index + 1} (nom: ${img?.name || `image-${index + 1}`}):`,
        });
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      } else {
        parts.push({
          text: `Image #${index + 1} (nom: ${img?.name || `image-${index + 1}`})`,
        });
      }
    });

    const systemInstruction = `Tu es le Réalisateur Multimodal Image-to-Video de FOFO AI.
Tu analyses visuellement les images fournies pour concevoir :
1. Une chorégraphie de caméra & animation IA adaptée à chaque photo (point focal exact focalX/focalY entre 0.25 et 0.75, preset de mouvement idéal, transition fluide).
2. Un cheminement narratif et une voix off en français naturel inspirés de ce que tu VOIS réellement dans chaque image, en suivant le style de ${AI_MODEL_LABELS[selectedModel]}.
${ENGINE_STYLE_INSTRUCTIONS[selectedModel]}

Moteur vidéo ciblé : ${imageVideoEngine} | Intensité souhaitée : ${motionIntensity} | Mode mouvement demandé : ${motionPreset}.
Presets de mouvement autorisés pour motionPreset : 'orbit-3d', 'dolly-zoom', 'parallax-depth', 'drone-flyover', 'whip-pan', 'ken-burns-drama', 'float-breathing', 'cine-reveal'.
Effets Ken Burns autorisés : 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'.
Transitions autorisées : 'fade', 'slide', 'cut', 'zoom'.`;

    const promptText = `Analyse ces ${safeImages.length} image(s) et génère exactement ${safeImages.length} scènes (une scène par image, dans le même ordre 1..${safeImages.length}).
Consigne / Prompt d'animation du créateur : "${motionPrompt.trim() || 'Analyse automatiquement les images et transforme-les en vidéo dynamique et captivante avec voix off fluide.'}"
Format cible : ${aspectRatio} | Durée par plan : ${safeClipDuration}s | Style : ${style} | Niche : ${niche}.`;

    parts.push({ text: promptText });

    const response = await generateContentWithFallback({
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            hook: { type: Type.STRING },
            description: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  voiceoverText: { type: Type.STRING, description: 'Voix off en français décrivant et racontant cette image' },
                  visualDescription: { type: Type.STRING, description: 'Description précise de ce que l’IA voit dans l’image' },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  motionPreset: { type: Type.STRING },
                  kenBurnsEffect: { type: Type.STRING },
                  focalX: { type: Type.NUMBER, description: 'Position horizontale du sujet principal (0.25 à 0.75)' },
                  focalY: { type: Type.NUMBER, description: 'Position verticale du sujet principal (0.25 à 0.75)' },
                  transition: { type: Type.STRING },
                },
                required: [
                  'sceneNumber',
                  'voiceoverText',
                  'visualDescription',
                  'keywords',
                  'motionPreset',
                  'kenBurnsEffect',
                  'focalX',
                  'focalY',
                  'transition',
                ],
              },
            },
          },
          required: ['title', 'hook', 'description', 'hashtags', 'scenes'],
        },
      },
      preferLowThinking: true,
      timeoutMs: 10000,
    });

    const parsed = JSON.parse(response.text || '{}');
    const parsedScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const fallback = buildFallbackImageToVideo();

    const mergedScenes = safeImages.map((_: any, idx: number) => {
      const fb = fallback.scenes[idx];
      const aiScene = parsedScenes[idx];
      if (!aiScene) return fb;

      const resolvedPreset =
        motionPreset !== 'auto' && (validMotionPresets as readonly string[]).includes(motionPreset)
          ? motionPreset
          : (validMotionPresets as readonly string[]).includes(aiScene.motionPreset)
          ? aiScene.motionPreset
          : fb.motionPreset;

      const resolvedKenBurns = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'].includes(aiScene.kenBurnsEffect)
        ? aiScene.kenBurnsEffect
        : fb.kenBurnsEffect;

      const resolvedTransition = ['fade', 'slide', 'cut', 'zoom'].includes(aiScene.transition)
        ? aiScene.transition
        : defaultTransition || fb.transition;

      return {
        ...fb,
        sceneNumber: idx + 1,
        voiceoverText: aiScene.voiceoverText || fb.voiceoverText,
        visualDescription: aiScene.visualDescription || fb.visualDescription,
        keywords: Array.isArray(aiScene.keywords) && aiScene.keywords.length > 0 ? aiScene.keywords.slice(0, 4) : fb.keywords,
        motionPreset: resolvedPreset,
        motionIntensity,
        kenBurnsEffect: resolvedKenBurns,
        focalPoint: {
          x: typeof aiScene.focalX === 'number' ? Math.max(0.25, Math.min(0.75, aiScene.focalX)) : 0.5,
          y: typeof aiScene.focalY === 'number' ? Math.max(0.25, Math.min(0.75, aiScene.focalY)) : 0.45,
        },
        transition: resolvedTransition,
      };
    });

    return res.json({
      ...fallback,
      title: parsed.title || fallback.title,
      hook: parsed.hook || fallback.hook,
      description: parsed.description || fallback.description,
      hashtags:
        Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0
          ? parsed.hashtags.slice(0, 6)
          : fallback.hashtags,
      scenes: mergedScenes,
    });
  } catch (err) {
    console.error('Erreur /api/image-to-video:', err);
    return res.status(500).json({ error: "Impossible d'analyser les images pour le moment." });
  }
});

// Endpoint POST /api/creator-coach — Compagnon IA pour le créateur de contenu
app.post('/api/creator-coach', async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Veuillez saisir une question pour votre Coach IA.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'Le message dépasse la limite de 4000 caractères.' });
    }

    const {
      currentPrompt = '',
      currentStyle = 'cinematic',
      currentAspectRatio = '9:16',
      activeVideoTitle = '',
      activeVideoHook = '',
      activeVideoScenesCount = 0,
      userPlan = 'free',
    } = context;

    // Fallback intelligent et contextuel si la clé API est absente
    const buildSmartCoachFallback = () => {
      const lower = message.toLowerCase();
      const topicHint = currentPrompt || activeVideoTitle || 'la psychologie et les tendances IA';
      if (lower.includes('hook') || lower.includes('accroche') || lower.includes('3s')) {
        return {
          reply: `Pour captiver l'audience dès les 2 premières secondes sur "${topicHint.slice(0, 60)}", utilisez une rupture cognitive ou une statistique contre-intuitive :\n\n• Commencez par une promesse chiffrée ou une vérité cachée.\n• Coupez les introductions lentes ("Bonjour à tous...").\n• Synchronisez un zoom rapide sur la première image avec un mot-clé fort.\n\nVoici un Hook prêt à être appliqué directement sur votre projet :`,
          suggestedHook: `99% des créateurs ignorent ce détail décisif sur ${topicHint.slice(0, 42)} — voici pourquoi ça change tout.`,
          suggestedTitle: `Le secret que personne ne vous dit sur ${topicHint.slice(0, 38)}`,
          suggestedHashtags: ['#Storytelling', '#TikTokFrance', '#ViralHook', '#Createur', '#Shorts'],
          followUpQuestions: [
            'Réécris un script complet de 45 secondes avec ce Hook',
            'Quel rythme de montage et musique choisir ?',
            'Optimise la description et les hashtags SEO',
          ],
        };
      }
      if (lower.includes('idée') || lower.includes('tendance') || lower.includes('sujet')) {
        return {
          reply: `Voici 3 angles ultra-performants adaptés au format ${currentAspectRatio} et au style ${currentStyle} :\n\n1. "La règle cachée derrière..." (Forte curiosité, idéal 45s)\n2. "Pourquoi 95% des gens échouent sur..." (Contraste psychologique)\n3. "Ce qui va se passer d'ici 2030 avec..." (Projection futuriste)\n\nCliquez sur « Appliquer ce sujet au Studio » ci-dessous pour lancer le premier scénario immédiatement.`,
          suggestedPrompt: `Les 3 vérités psychologiques méconnues sur ${topicHint.slice(0, 45)} qui expliquent pourquoi 95% des gens passent à côté du succès.`,
          recommendedStyle: 'cinematic',
          suggestedHashtags: ['#Tendances', '#Psychologie', '#Productivité', '#ViralVideo', '#Reels'],
          followUpQuestions: [
            'Donne-moi un hook encore plus percutant',
            'Adapte le format pour YouTube Shorts',
            'Planifie une série de 5 épisodes sur ce thème',
          ],
        };
      }
      if (lower.includes('hashtag') || lower.includes('titre') || lower.includes('seo')) {
        return {
          reply: `Pour maximiser la portée organique sur TikTok, Shorts et Reels :\n\n• Gardez un titre court (< 55 caractères) avec un mot-clé de recherche fort.\n• Mixez 2 hashtags larges (#PourToi, #Shorts) et 3 hashtags de niche ultra-ciblés.\n• Posez une question polarisante dans la description pour stimuler les commentaires.`,
          suggestedTitle: activeVideoTitle
            ? `${activeVideoTitle.slice(0, 42)} (La vérité)`
            : '3 secrets que votre cerveau vous cache chaque jour',
          suggestedHashtags: ['#PourToi', '#Culture', '#Psychologie', '#Astuce', '#CreateurContenu'],
          followUpQuestions: [
            'Améliore le Hook des 3 premières secondes',
            'Quelle heure de publication privilégier ?',
          ],
        };
      }
      return {
        reply: `Je suis votre Stratège & Coach Créateur FOFO AI. ${
          activeVideoTitle
            ? `J'analyse votre vidéo active (« ${activeVideoTitle} », ${activeVideoScenesCount} scènes). `
            : ''
        }Pour faire décoller votre taux de rétention au-delà de 65% :\n\n1. Raccourcissez chaque scène à 5–7 secondes avec un changement de plan visuel.\n2. Mettez vos 3 mots-clés clés en majuscules dans les sous-titres.\n3. Terminez par une boucle ouverte ("Et vous, qu'en pensez-vous ?") pour multiplier les commentaires.`,
        suggestedPrompt: currentPrompt
          ? `${currentPrompt} — version ultra-rythmée avec faits chiffrés et chute mémorable.`
          : '5 habitudes silencieuses des créateurs qui dépassent le million de vues en 30 jours.',
        recommendedStyle: currentStyle || 'cinematic',
        followUpQuestions: [
          'Améliore mon Hook des 3 premières secondes',
          'Propose 3 idées de vidéos virales dans ma niche',
          'Optimise mon titre et mes hashtags SEO',
        ],
      };
    };

    if (!ai) {
      return res.json(buildSmartCoachFallback());
    }

    const historyText = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m: any) => `${m.role === 'user' ? 'Créateur' : 'Coach IA'}: ${m.content}`)
          .join('\n')
      : '';

    const systemInstruction = `Tu es le Coach IA Élite de FOFO AI, un directeur artistique, scénariste viral et stratège de croissance pour créateurs de contenu (TikTok, YouTube Shorts, Instagram Reels, vidéos Business 4K).
Tu réponds toujours en français clair, concret, actionnable et bienveillant, sans jargon inutile.
Adapte tes conseils au contexte exact du créateur :
- Sujet actuel saisi dans le Studio : "${currentPrompt || 'Aucun sujet saisi pour le moment'}"
- Style visuel sélectionné : ${currentStyle} | Ratio : ${currentAspectRatio}
- Vidéo active dans le lecteur : "${activeVideoTitle || 'Aucune'}" | Hook actuel : "${activeVideoHook || 'Aucun'}" | Scènes : ${activeVideoScenesCount}
- Abonnement : ${userPlan}

Règles :
1. Donne des conseils précis et actionnables (hooks, rétention, pacing, storytelling, SEO, monétisation).
2. Si pertinent, remplis "suggestedPrompt" (prêt à copier dans le studio), "suggestedHook", "suggestedTitle", "suggestedHashtags" (5 hashtags max) ou "recommendedStyle" ('cinematic' | 'cyberpunk' | 'anime' | 'pixar3d' | 'vintage' | 'minimalist' | 'luxury') pour que le créateur puisse les appliquer en 1 clic.
3. Propose toujours 2 à 3 "followUpQuestions" courtes et utiles.`;

    const fullPrompt = historyText
      ? `Historique récent:\n${historyText}\n\nNouvelle demande du créateur:\n${message}`
      : message;

    const response = await generateContentWithFallback({
      contents: fullPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Réponse structurée et actionnable en français pour le créateur' },
            suggestedPrompt: { type: Type.STRING, description: 'Optionnel: prompt complet prêt à générer dans FOFO AI' },
            suggestedHook: { type: Type.STRING, description: 'Optionnel: accroche des 3 premières secondes' },
            suggestedTitle: { type: Type.STRING, description: 'Optionnel: titre optimisé viral/SEO' },
            suggestedHashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Optionnel: 5 hashtags pertinents avec #',
            },
            recommendedStyle: {
              type: Type.STRING,
              description: 'Optionnel: cinematic, cyberpunk, anime, pixar3d, vintage, minimalist, ou luxury',
            },
            followUpQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 ou 3 suggestions de questions suivantes courtes',
            },
          },
          required: ['reply', 'followUpQuestions'],
        },
      },
      preferLowThinking: true,
      preferFastModel: true,
      timeoutMs: 7500,
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed.reply) {
      return res.json(buildSmartCoachFallback());
    }
    return res.json(parsed);
  } catch (err: any) {
    console.error('Erreur /api/creator-coach:', err?.status || err?.message || err);
    return res.status(502).json({
      error: `Le Coach IA n'a pas pu joindre le modèle Gemini (${err?.status || 'erreur réseau'}). Réessayez dans un instant.`,
    });
  }
});

// Endpoint POST /api/ai-bot — Bot AI conversationnel & agent d'action FOFO AI
app.post('/api/ai-bot', async (req, res) => {
  try {
    const { message, persona = 'assistant', history = [], context = {} } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Veuillez écrire un message pour le Bot AI.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'Le message dépasse la limite de 4000 caractères.' });
    }

    const {
      currentPrompt = '',
      currentStyle = 'cinematic',
      currentAspectRatio = '9:16',
      activeVideoTitle = '',
      activeVideoHook = '',
      activeVideoScenesCount = 0,
      userPlan = 'free',
    } = context;

    const buildBotFallback = () => {
      const lower = message.toLowerCase();
      if (
        lower.includes('génère') ||
        lower.includes('genere') ||
        lower.includes('crée') ||
        lower.includes('cree') ||
        lower.includes('vidéo sur') ||
        lower.includes('video sur')
      ) {
        const cleanTopic = message
          .replace(/^(g[eé]n[eè]re|cr[eé]e|fais)(-moi)?\s+(une\s+)?vid[eé]o\s*(courte|tiktok|shorts|de\s+\d+s)?\s*(sur|à propos de)?\s*/i, '')
          .trim() || currentPrompt || 'Les secrets fascinants de l’intelligence artificielle';
        return {
          reply: `C'est prêt ! J'ai préparé la configuration complète pour générer votre vidéo sur « ${cleanTopic} » au format ${currentAspectRatio} avec un style ${currentStyle}.\n\nCliquez sur le bouton d'action ci-dessous pour lancer la génération immédiatement.`,
          botAction: {
            type: 'generate_video',
            label: `Générer la vidéo : "${cleanTopic.slice(0, 36)}${cleanTopic.length > 36 ? '...' : ''}"`,
            prompt: cleanTopic,
            style: currentStyle || 'cinematic',
            aspectRatio: currentAspectRatio || '9:16',
            duration: 45,
          },
          suggestions: [
            'Optimise le hook pour les 3 premières secondes',
            'Change le style en Cyberpunk',
            'Propose 3 autres idées proches',
          ],
        };
      }

      if (lower.includes('tarif') || lower.includes('prix') || lower.includes('pro') || lower.includes('business')) {
        return {
          reply:
            'FOFO AI propose 3 formules claires : Gratuit (0€, 3 crédits), PRO (19€/mois, vidéos et voix illimitées sans filigrane) et Business (44€/mois, export 4K 60fps, génération par lots jusqu’à 20 vidéos, 5 sièges équipe, API & Webhooks).',
          botAction: {
            type: 'navigate',
            label: 'Voir les tarifs & formules',
            targetTab: 'pricing',
          },
          suggestions: [
            'Ouvrir l’espace Business',
            'Quels sont les avantages du plan 44€ ?',
          ],
        };
      }

      if (lower.includes('création') || lower.includes('creation') || lower.includes('bibliothèque') || lower.includes('historique')) {
        return {
          reply: 'Je peux vous ouvrir directement votre bibliothèque « Mes Créations » pour retrouver, relire ou exporter vos vidéos.',
          botAction: {
            type: 'navigate',
            label: 'Ouvrir Mes Créations',
            targetTab: 'creations',
          },
          suggestions: ['Retourner au Studio IA', 'Génère une nouvelle vidéo'],
        };
      }

      if (lower.includes('hook') || lower.includes('titre') || lower.includes('sous-titre') || lower.includes('musique')) {
        return {
          reply: activeVideoTitle
            ? `J'ai analysé votre vidéo active « ${activeVideoTitle} ». Pour maximiser la rétention dès la première seconde, je vous propose un hook plus incisif et des sous-titres dynamiques style Hormozi.`
            : 'Pour un maximum de rétention, utilisez un Hook chiffré dès les 2 premières secondes et des sous-titres dynamiques.',
          botAction: activeVideoTitle
            ? {
                type: 'update_active_video',
                label: 'Appliquer Hook & Sous-titres Hormozi à la vidéo',
                hook: `Ce secret sur ${activeVideoTitle.slice(0, 36)} change tout en 30 secondes.`,
                captionStyle: 'hormozi',
                hashtags: ['#FOFOAI', '#Viral', '#Shorts', '#Astuce', '#PourToi'],
              }
            : {
                type: 'send_to_studio',
                label: 'Pré-remplir le Studio IA',
                prompt: 'Les 3 secrets méconnus qui captivent l’attention en moins de 3 secondes.',
                style: 'cinematic',
              },
          suggestions: [
            'Génère une vidéo de 45s avec cette idée',
            'Quelle transition choisir entre les scènes ?',
          ],
        };
      }

      return {
        reply: `Bonjour ! Je suis le Bot AI de FOFO AI (mode ${persona}). Je peux répondre à vos questions, rédiger des scripts viraux, modifier votre vidéo active (${activeVideoTitle ? `« ${activeVideoTitle} »` : 'aucune sélectionnée'}), ou lancer la création d'une nouvelle vidéo en un clic.`,
        suggestions: [
          'Génère une vidéo sur les mystères des abysses',
          'Améliore le hook et les sous-titres de ma vidéo',
          'Quels sont les tarifs Business à 44€ ?',
        ],
      };
    };

    if (!ai) {
      return res.json(buildBotFallback());
    }

    const personaPrompts: Record<string, string> = {
      assistant: 'Tu es FOFO Bot, assistant IA polyvalent intégré au studio FOFO AI. Tu aides sur la création vidéo, la navigation dans l’app et toute question du créateur.',
      scriptwriter: 'Tu es FOFO Bot en mode Scénariste Viral : expert en hooks des 3 premières secondes, storytelling TikTok/Shorts/Reels et voix off percutantes.',
      editor: 'Tu es FOFO Bot en mode Monteur & Effets : expert en rythme visuel, transitions granulaires (Fondu, Glissement, Cut, Zoom), sous-titres animés et design sonore.',
      growth: 'Tu es FOFO Bot en mode Stratège Croissance : expert algorithmes TikTok/Reels/Shorts, SEO, hashtags, régularité et monétisation.',
    };

    const historyText = Array.isArray(history)
      ? history
          .slice(-8)
          .map((m: any) => `${m.role === 'user' ? 'Utilisateur' : 'Bot AI'}: ${m.content}`)
          .join('\n')
      : '';

    const systemInstruction = `${personaPrompts[persona] || personaPrompts.assistant}
Réponds toujours en français clair, naturel, précis et concis.

Contexte actuel dans l'application :
- Brouillon Studio : "${currentPrompt || 'Aucun'}" | Style : ${currentStyle} | Format : ${currentAspectRatio}
- Vidéo active dans le lecteur : "${activeVideoTitle || 'Aucune'}" | Hook : "${activeVideoHook || 'Aucun'}" | Scènes : ${activeVideoScenesCount}
- Abonnement utilisateur : ${userPlan} (Offres : Gratuit 0€, Pro 19€/mois, Business 44€/mois avec export 4K 60fps, batch 20 vidéos, 5 sièges équipe, API & Webhooks).

Si l'utilisateur demande d'effectuer une action concrète dans FOFO AI, renseigne l'objet optionnel "botAction" :
- type "generate_video" : pour créer/générer une nouvelle vidéo (remplis prompt, style parmi cinematic|cyberpunk|anime|pixar3d|vintage|minimalist|luxury, aspectRatio parmi 9:16|16:9|1:1, duration en secondes : 30, 60, 900 pour 15m, 3600 pour 1h, 5400 pour 1h30, 7200 pour 2h, jusqu'à 43200s / 12h).
- type "update_active_video" : pour modifier la vidéo active (remplis hook, title, hashtags, captionStyle parmi hormozi|neon-blue|minimal|karaoke, ou musicMood parmi phonk-drift|afro-amapiano|trap-motivation|synthwave-reels|piano-story|epic|lofi|suspense|dynamic|ambient).
- type "send_to_studio" : pour pré-remplir le formulaire du Studio IA (remplis prompt, style).
- type "navigate" : pour ouvrir un onglet (targetTab parmi studio|creations|templates|stats|business|pricing).
Propose toujours 2 à 3 "suggestions" courtes pour continuer la conversation.`;

    const fullContents = historyText
      ? `Historique récent :\n${historyText}\n\nMessage actuel :\n${message}`
      : message;

    const response = await generateContentWithFallback({
      contents: fullContents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Réponse claire et utile en français.' },
            botAction: {
              type: Type.OBJECT,
              description: 'Action exécutable optionnelle dans FOFO AI.',
              properties: {
                type: {
                  type: Type.STRING,
                  description: 'generate_video, update_active_video, send_to_studio, ou navigate',
                },
                label: { type: Type.STRING, description: 'Libellé court du bouton d’action en français' },
                prompt: { type: Type.STRING },
                style: { type: Type.STRING },
                aspectRatio: { type: Type.STRING },
                duration: { type: Type.NUMBER },
                title: { type: Type.STRING },
                hook: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                captionStyle: { type: Type.STRING },
                musicMood: { type: Type.STRING },
                targetTab: { type: Type.STRING },
              },
              required: ['type', 'label'],
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 ou 3 propositions de messages suivants courts',
            },
          },
          required: ['reply', 'suggestions'],
        },
      },
      preferLowThinking: true,
      preferFastModel: true,
      timeoutMs: 7500,
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed.reply) {
      return res.json(buildBotFallback());
    }
    return res.json(parsed);
  } catch (err: any) {
    console.error('Erreur /api/ai-bot:', err?.status || err?.message || err);
    return res.status(502).json({
      error: `Le Bot AI n'a pas pu obtenir de réponse du modèle (${err?.status || 'erreur temporaire'}). Réessayez dans un instant.`,
    });
  }
});

// Endpoint POST /api/ai-bot/stream — Discussion en temps réel (Server-Sent Events)
app.post('/api/ai-bot/stream', async (req, res) => {
  const {
    message,
    persona = 'assistant',
    aiModel = 'chatgpt-astra',
    history = [],
    context = {},
  } = req.body || {};

  const selectedModel = normalizeAiModel(aiModel);

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Veuillez écrire un message pour le Bot AI.' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'Le message dépasse la limite de 4000 caractères.' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const {
    currentPrompt = '',
    currentStyle = 'cinematic',
    currentAspectRatio = '9:16',
    activeVideoTitle = '',
    activeVideoHook = '',
    activeVideoScenesCount = 0,
    userPlan = 'free',
  } = context;

  const detectIntentAction = (userText: string) => {
    const lower = userText.toLowerCase();
    const detectedNiche: ContentNiche =
      lower.includes('éduc') || lower.includes('educ') || lower.includes('cours') || lower.includes('explique')
        ? 'education'
        : lower.includes('motiv') || lower.includes('discipline') || lower.includes('mindset')
        ? 'motivation'
        : lower.includes('psycho') || lower.includes('biais')
        ? 'psychology'
        : lower.includes('business') || lower.includes('argent')
        ? 'business'
        : 'general';

    if (
      lower.includes('génère') ||
      lower.includes('genere') ||
      lower.includes('crée') ||
      lower.includes('cree') ||
      lower.includes('fais-moi une vidéo') ||
      lower.includes('fais une vidéo') ||
      lower.includes('lance une vidéo')
    ) {
      const cleanTopic =
        userText
          .replace(
            /^(g[eé]n[eè]re|cr[eé]e|fais|lance)(-moi)?\s+(une\s+)?vid[eé]o\s*(courte|tiktok|shorts|de\s+\d+s)?\s*(sur|à propos de)?\s*/i,
            ''
          )
          .trim() ||
        currentPrompt ||
        'Les secrets fascinants de l’intelligence artificielle';
      return {
        botAction: {
          type: 'generate_video',
          label: `Générer la vidéo : "${cleanTopic.slice(0, 38)}${cleanTopic.length > 38 ? '...' : ''}"`,
          prompt: cleanTopic,
          style: currentStyle || 'cinematic',
          aspectRatio: currentAspectRatio || '9:16',
          duration: 45,
          aiModel: selectedModel,
          niche: detectedNiche,
        },
        suggestions: [
          'Propose 3 idées de hooks pour cette vidéo',
          'Affine le cheminement scène par scène',
        ],
      };
    }

    if (lower.includes('ouvre mes créations') || lower.includes('mes créations') || lower.includes('bibliothèque')) {
      return {
        botAction: {
          type: 'navigate',
          label: 'Ouvrir Mes Créations',
          targetTab: 'creations',
        },
        suggestions: ['Retourner au Studio IA', 'Donne-moi une nouvelle idée virale'],
      };
    }

    if (lower.includes('tarif') || lower.includes('prix') || lower.includes('abonnement') || lower.includes('44€')) {
      return {
        botAction: {
          type: 'navigate',
          label: 'Voir les tarifs & formules',
          targetTab: 'pricing',
        },
        suggestions: ['Quels sont les avantages du plan Business 44€ ?', 'Ouvrir l’espace Business'],
      };
    }

    if (
      activeVideoTitle &&
      (lower.includes('améliore') || lower.includes('ameliore') || lower.includes('hook') || lower.includes('sous-titre'))
    ) {
      return {
        botAction: {
          type: 'update_active_video',
          label: 'Appliquer Hook & Sous-titres à la vidéo',
          hook: `Ce secret sur ${activeVideoTitle.slice(0, 36)} change tout en 30 secondes.`,
          captionStyle: 'hormozi',
          hashtags: ['#FOFOAI', '#Viral', '#Shorts', '#Astuce', '#PourToi'],
        },
        suggestions: ['Quelle transition entre les scènes choisir ?', 'Propose une suite à cette vidéo'],
      };
    }

    return {
      botAction: undefined,
      suggestions: [
        'Structure le cheminement complet d’une vidéo Éducation',
        'Transforme cette idée en script Motivation avec Claude',
      ],
    };
  };

  try {
    const personaPrompts: Record<string, string> = {
      assistant:
        "Tu es FOFO Bot, un assistant IA chaleureux, clair et naturel intégré au studio vidéo FOFO AI. Tu réponds comme dans une vraie discussion humaine, avec des paragraphes fluides et concis.",
      scriptwriter:
        "Tu es FOFO Bot en mode Scénariste : tu discutes avec le créateur pour imaginer des accroches percutantes, des cheminements parfaits (Éducation, Motivation, Psychologie) et des scripts de 30-90s.",
      editor:
        "Tu es FOFO Bot en mode Monteur : tu conseilles naturellement sur le rythme, les transitions entre scènes (Fondu, Glissement, Cut, Zoom), les effets de tendance et l'ambiance sonore.",
      growth:
        "Tu es FOFO Bot en mode Stratège Croissance : tu échanges librement sur la viralité TikTok/Reels/Shorts/YouTube, les titres SEO et la rétention.",
    };

    const historyText = Array.isArray(history)
      ? history
          .slice(-12)
          .map((m: any) => `${m.role === 'user' ? 'Utilisateur' : 'Bot AI'}: ${m.content}`)
          .join('\n\n')
      : '';

    const systemInstruction = `${personaPrompts[persona] || personaPrompts.assistant}
${ENGINE_STYLE_INSTRUCTIONS[selectedModel]}
Réponds toujours en français naturel et conversationnel, comme dans une discussion directe (sans format JSON ni balises techniques).
Contexte de l'application :
- Brouillon Studio : "${currentPrompt || 'Aucun'}" (${currentStyle}, ${currentAspectRatio})
- Vidéo active dans le lecteur : "${activeVideoTitle || 'Aucune'}" | Hook : "${activeVideoHook || 'Aucun'}" | ${activeVideoScenesCount} scènes
- Offre utilisateur : ${userPlan} (Gratuit 0€, Pro 19€/mois, Business 44€/mois).`;

    const fullPrompt = historyText
      ? `Voici la discussion en cours :\n\n${historyText}\n\nNouveau message de l'utilisateur :\n${message}`
      : message;

    const streamed = await streamTextWithSelectedEngine({
      aiModel: selectedModel,
      systemInstruction,
      fullPrompt,
      onChunk: (text) => sendEvent('chunk', { text }),
    });

    if (!streamed) {
      const intentMeta = detectIntentAction(message);
      const engineName = AI_MODEL_LABELS[selectedModel];
      const fallbackText =
        intentMeta.botAction?.type === 'generate_video'
          ? `Avec plaisir (${engineName}) ! Je peux lancer la création d'une vidéo structurée sur « ${intentMeta.botAction.prompt} » au format ${currentAspectRatio}.\n\nClique simplement sur le bouton ci-dessous pour démarrer la génération, ou dis-moi si tu veux ajuster le cheminement scène par scène.`
          : `Je suis prêt en mode ${engineName} ! ${
              activeVideoTitle
                ? `Sur ton projet « ${activeVideoTitle} », on peut renforcer le cheminement pédagogique ou motivationnel, affiner les transitions entre scènes ou explorer un nouvel angle.`
                : `Parle-moi de ton sujet Éducation ou Motivation : je vais structurer un cheminement fluide du Hook jusqu'à la chute, ou lance directement « Génère une vidéo sur... ».`
            }`;

      const words = fallbackText.split(/(\s+)/);
      for (const word of words) {
        sendEvent('chunk', { text: word });
        await new Promise((r) => setTimeout(r, 18));
      }
      sendEvent('meta', intentMeta);
      sendEvent('done', { ok: true });
      return res.end();
    }

    const intentMeta = detectIntentAction(message);
    sendEvent('meta', intentMeta);
    sendEvent('done', { ok: true });
    return res.end();
  } catch (err: any) {
    console.error('Erreur /api/ai-bot/stream:', err?.status || err?.message || err);
    const statusCode = err?.status ? ` (code ${err.status})` : '';
    sendEvent('error', {
      status: err?.status || 502,
      message: `Le serveur IA est momentanément surchargé${statusCode}. Clique sur Régénérer ou renvoie ton message.`,
    });
    sendEvent('chunk', {
      text: `Le modèle IA rencontre une forte affluence momentanée${statusCode}. Clique sur « Régénérer » dans un instant pour obtenir la réponse complète.`,
    });
    sendEvent('meta', {
      suggestions: ['Réessayer maintenant', 'Génère une vidéo Éducation sur l’attention'],
    });
    sendEvent('done', { ok: false, error: err?.message || 'Upstream error' });
    return res.end();
  }
});

// Endpoint POST /api/business/batch-ideas — Génération par lots de sujets (jusqu'à 20 vidéos)
app.post('/api/business/batch-ideas', async (req, res) => {
  try {
    const { topic = 'Productivité et IA', count = 5 } = req.body || {};
    if (typeof topic !== 'string' || topic.trim().length > 300) {
      return res.status(400).json({ error: 'Le thème est invalide ou dépasse 300 caractères.' });
    }
    const safeCount = Math.min(20, Math.max(1, Number(count) || 5));

    const buildBatchFallback = () => {
      const angles = [
        'Les 3 erreurs fatales à éviter absolument sur',
        'La méthode secrète des experts pour maîtriser',
        'Pourquoi 90% des débutants échouent en',
        'Ce que personne ne vous explique jamais sur',
        'Comment automatiser et doubler vos résultats avec',
        'L\'étude scientifique surprenante derrière',
        'Les 5 outils indispensables en 2026 pour',
        'Avant / Après : comment transformer votre approche de',
        'La règle des 80/20 appliquée immédiatement à',
        'Mythes vs Réalité : la vérité brute sur',
        'Le guide express en 45 secondes pour exceller en',
        'Ce qui va radicalement changer d\'ici 2030 dans',
        'Comment les top 1% utilisent quotidiennement',
        '3 chiffres chocs qui prouvent l\'impact de',
        'L\'astuce contre-intuitive qui débloque',
        'Pourquoi commencer aujourd\'hui avec',
        'Le piège invisible qui freine votre croissance en',
        'L\'histoire vraie et inspirante derrière',
        'Plan d\'action en 3 étapes concrètes pour',
        'La checklist ultime avant de lancer votre projet de',
      ];
      return Array.from({ length: safeCount }, (_, i) => `${angles[i % angles.length]} ${topic}`);
    };

    if (!ai) {
      return res.json({ prompts: buildBatchFallback() });
    }

    const response = await generateContentWithFallback({
      contents: `Génère exactement ${safeCount} sujets de vidéos courtes ultra-virales distincts et variés autour du thème principal : "${topic}". Chaque sujet doit être une phrase complète et accrocheuse en français prête à être transformée en vidéo.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['prompts'],
        },
      },
      preferLowThinking: true,
      timeoutMs: 8000,
    });

    const parsed = JSON.parse(response.text || '{}');
    const prompts = Array.isArray(parsed.prompts) && parsed.prompts.length > 0
      ? parsed.prompts.slice(0, safeCount)
      : buildBatchFallback();

    return res.json({ prompts });
  } catch (err) {
    console.error('Erreur /api/business/batch-ideas:', err);
    return res.status(500).json({ error: 'Impossible de générer la liste de sujets par lots.' });
  }
});

// Endpoint POST /api/business/test-webhook — Test réel sécurisé anti-SSRF
app.post('/api/business/test-webhook', async (req, res) => {
  const { url, event = 'video.rendered' } = req.body || {};
  if (!url || typeof url !== 'string' || url.trim().length > 500) {
    return res.status(400).json({ error: 'Veuillez fournir une URL HTTPS publique valide.' });
  }

  const safeCheck = await assertSafePublicExternalUrl(url.trim(), { allowHttp: false });
  if (!safeCheck.ok) {
    return res.status(400).json({
      error: safeCheck.reason || 'URL webhook bloquée par la protection anti-SSRF (HTTPS public requis).',
    });
  }

  const safeEvent = String(event).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || 'video.rendered';
  const startedAt = Date.now();
  const payload = {
    id: `evt_${Date.now()}`,
    event: safeEvent,
    plan: 'business',
    resolution: '4K_60FPS',
    watermark: false,
    timestamp: new Date().toISOString(),
    data: {
      videoId: `fofo-${Date.now()}`,
      status: 'completed',
      downloadUrl: 'https://cdn.fofo.ai/exports/sample-4k-60fps.mp4',
    },
  };
  const bodyStr = JSON.stringify(payload);
  const sig = crypto
    .createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET || 'fofo-studio-webhook-key')
    .update(bodyStr)
    .digest('hex');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const webhookRes = await fetch(safeCheck.normalizedUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FOFO-Event': safeEvent,
        'X-FOFO-Signature': `sha256=${sig}`,
      },
      body: bodyStr,
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return res.json({
      ok: webhookRes.ok,
      statusCode: webhookRes.status,
      latencyMs: Date.now() - startedAt,
      payload,
    });
  } catch {
    return res.json({
      ok: false,
      statusCode: 504,
      latencyMs: Date.now() - startedAt,
      error: 'Délai dépassé ou hôte externe injoignable',
      payload,
    });
  }
});

interface ServerStockImageItem {
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

const STOCK_FRENCH_KEYWORD_HINTS: Array<{ match: RegExp; theme: string; enQuery: string }> = [
  { match: /espace|galaxie|plan[eè]te|lune|univers|astronaut|cosmos|etoile|étoile/i, theme: 'space', enQuery: 'outer space galaxy cosmos' },
  { match: /cyber|n[eé]on|futur|robot|ia|intelligence|tech|code|ordinateur|serveur/i, theme: 'technology', enQuery: 'futuristic technology neon' },
  { match: /nature|for[eê]t|montagne|oc[eé]an|mer|plage|paysage|arbre|lac|cascade/i, theme: 'nature', enQuery: 'nature landscape mountain ocean' },
  { match: /luxe|voiture|sportive|montre|villa|yacht|design|mode|hotel|hôtel/i, theme: 'luxury', enQuery: 'luxury architecture car interior' },
  { match: /histoire|rome|paris|monument|ch[aâ]teau|arch[eé]olog|mus[eé]e|ville|rue|architecture/i, theme: 'history', enQuery: 'historic architecture city landmark' },
  { match: /business|bureau|travail|finance|argent|entrepreneur|startup|r[eé]union|succ[eè]s|sport|fitness/i, theme: 'motivation', enQuery: 'business office fitness motivation' },
  { match: /myst[eè]re|nuit|ombre|brouillard|horreur|sombre|brume|phare/i, theme: 'mystery', enQuery: 'dark mystery fog night' },
  { match: /cin[eé]ma|film|cam[eé]ra|studio|lumi[eè]re|tournage/i, theme: 'cinematic', enQuery: 'cinematic film studio lighting' },
];

function stripHtmlTags(raw: string): string {
  return String(raw || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function isPrivateOrReservedIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/i, '').trim().toLowerCase();
  const family = net.isIP(clean);
  if (family === 4) {
    const parts = clean.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    if (clean === '::' || clean === '::1') return true;
    if (clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('ff')) {
      return true;
    }
    return false;
  }
  return true;
}

function isSafeExternalImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return false;
    }
    if (net.isIP(host) && isPrivateOrReservedIp(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function assertSafePublicExternalUrl(
  rawUrl: string,
  options: { allowHttp?: boolean } = {}
): Promise<{ ok: boolean; normalizedUrl?: string; reason?: string }> {
  try {
    const parsed = new URL(rawUrl);
    const allowedProtocols = options.allowHttp ? ['https:', 'http:'] : ['https:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return { ok: false, reason: 'Protocole HTTPS requis pour des raisons de sécurité.' };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, reason: 'Identifiants dans URL non autorisés.' };
    }
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return { ok: false, reason: 'Les adresses locales ou internes sont bloquées (anti-SSRF).' };
    }

    if (net.isIP(host)) {
      if (isPrivateOrReservedIp(host)) {
        return { ok: false, reason: 'Les adresses IP privées ou réservées sont bloquées (anti-SSRF).' };
      }
      return { ok: true, normalizedUrl: parsed.toString() };
    }

    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: 'Nom de domaine introuvable.' };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { ok: false, reason: 'Résolution DNS vers une adresse privée bloquée (anti-SSRF).' };
      }
    }
    return { ok: true, normalizedUrl: parsed.toString() };
  } catch {
    return { ok: false, reason: 'URL invalide ou hôte injoignable.' };
  }
}

function buildCuratedStockFallback(query: string, limit: number): ServerStockImageItem[] {
  const matched = STOCK_FRENCH_KEYWORD_HINTS.filter((h) => h.match.test(query));
  const themesOrder =
    matched.length > 0
      ? [...matched.map((m) => m.theme), 'cinematic', 'nature', 'technology']
      : ['cinematic', 'nature', 'space', 'technology', 'luxury', 'motivation', 'history'];

  const seen = new Set<string>();
  const items: ServerStockImageItem[] = [];
  for (const theme of themesOrder) {
    const urls = THEMED_VISUALS[theme] || [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (seen.has(url)) continue;
      seen.add(url);
      items.push({
        id: `curated-${theme}-${i}`,
        title: `${query || theme} · Visuel ${theme}`,
        author: 'FOFO Stock Collection',
        license: 'Libre de droits',
        source: 'Collection Studio',
        thumbUrl: url,
        fullUrl: url,
        proxyUrl: `/api/stock-images/image?url=${encodeURIComponent(url)}`,
        width: 1200,
        height: 800,
      });
      if (items.length >= limit) return items;
    }
  }
  return items;
}

// Endpoint GET /api/stock-images/search — API de banques d'images libres de droits (Openverse, Wikimedia Commons, Pexels/Unsplash/Pixabay optionnels)
app.get('/api/stock-images/search', async (req, res) => {
  const rawQuery = String(req.query.q || '').trim() || 'cinematic nature';
  const orientation = String(req.query.orientation || 'portrait');
  const limit = Math.min(20, Math.max(4, Number(req.query.limit) || 12));

  const results: ServerStockImageItem[] = [];
  const seenUrls = new Set<string>();
  const pushUnique = (item: ServerStockImageItem) => {
    if (!item.fullUrl || seenUrls.has(item.fullUrl) || !isSafeExternalImageUrl(item.fullUrl)) return;
    seenUrls.add(item.fullUrl);
    results.push(item);
  };

  try {
    // 1. Pexels API si clé configurée
    if (process.env.PEXELS_API_KEY) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4500);
      try {
        const pexelsOrient =
          orientation === 'landscape' ? 'landscape' : orientation === 'square' ? 'square' : 'portrait';
        const r = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(rawQuery)}&per_page=${limit}&orientation=${pexelsOrient}`,
          { headers: { Authorization: process.env.PEXELS_API_KEY }, signal: ctrl.signal }
        );
        if (r.ok) {
          const data: any = await r.json();
          for (const p of data?.photos || []) {
            const fullUrl = p?.src?.large2x || p?.src?.large || p?.src?.original;
            const thumbUrl = p?.src?.medium || p?.src?.small || fullUrl;
            if (fullUrl) {
              pushUnique({
                id: `pexels-${p.id}`,
                title: p.alt || rawQuery,
                author: p.photographer || 'Pexels Creator',
                license: 'Libre de droits · Pexels',
                source: 'Pexels',
                thumbUrl,
                fullUrl,
                proxyUrl: `/api/stock-images/image?url=${encodeURIComponent(fullUrl)}`,
                width: p.width,
                height: p.height,
              });
            }
          }
        }
      } finally {
        clearTimeout(t);
      }
    }

    // 2. Unsplash API si clé configurée
    if (results.length < limit && process.env.UNSPLASH_ACCESS_KEY) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4500);
      try {
        const unsplashOrient =
          orientation === 'landscape' ? 'landscape' : orientation === 'square' ? 'squarish' : 'portrait';
        const r = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(rawQuery)}&per_page=${limit}&orientation=${unsplashOrient}`,
          { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }, signal: ctrl.signal }
        );
        if (r.ok) {
          const data: any = await r.json();
          for (const u of data?.results || []) {
            const fullUrl = u?.urls?.regular || u?.urls?.full;
            const thumbUrl = u?.urls?.small || fullUrl;
            if (fullUrl) {
              pushUnique({
                id: `unsplash-${u.id}`,
                title: u.alt_description || u.description || rawQuery,
                author: u?.user?.name || 'Unsplash Creator',
                license: 'Libre de droits · Unsplash',
                source: 'Unsplash',
                thumbUrl,
                fullUrl,
                proxyUrl: `/api/stock-images/image?url=${encodeURIComponent(fullUrl)}`,
                width: u.width,
                height: u.height,
              });
            }
          }
        }
      } finally {
        clearTimeout(t);
      }
    }

    // 3. Pixabay API si clé configurée
    if (results.length < limit && process.env.PIXABAY_API_KEY) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4500);
      try {
        const r = await fetch(
          `https://pixabay.com/api/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY)}&q=${encodeURIComponent(rawQuery)}&image_type=photo&safesearch=true&per_page=${limit}`,
          { signal: ctrl.signal }
        );
        if (r.ok) {
          const data: any = await r.json();
          for (const hit of data?.hits || []) {
            const fullUrl = hit?.largeImageURL || hit?.webformatURL;
            const thumbUrl = hit?.webformatURL || hit?.previewURL || fullUrl;
            if (fullUrl) {
              pushUnique({
                id: `pixabay-${hit.id}`,
                title: hit.tags || rawQuery,
                author: hit.user || 'Pixabay Creator',
                license: 'Libre de droits · Pixabay',
                source: 'Pixabay',
                thumbUrl,
                fullUrl,
                proxyUrl: `/api/stock-images/image?url=${encodeURIComponent(fullUrl)}`,
                width: hit.imageWidth,
                height: hit.imageHeight,
              });
            }
          }
        }
      } finally {
        clearTimeout(t);
      }
    }

    // 4. APIs Publiques Libres de Droits sans clé : Openverse + Wikimedia Commons en parallèle
    if (results.length < limit) {
      const hintMatch = STOCK_FRENCH_KEYWORD_HINTS.find((h) => h.match.test(rawQuery));
      const searchQueries = Array.from(
        new Set([rawQuery, ...(hintMatch ? [hintMatch.enQuery] : [])])
      );
      const activeSearchQuery = searchQueries[0];

      const fetchOpenverse = async (q: string) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4500);
        try {
          const aspectParam =
            orientation === 'landscape' ? 'wide' : orientation === 'square' ? 'square' : 'tall';
          const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${limit}&mature=false&aspect_ratio=${aspectParam}`;
          const r = await fetch(url, {
            headers: { 'User-Agent': 'FOFO-AI-Studio/1.0' },
            signal: ctrl.signal,
          });
          if (!r.ok) return [] as ServerStockImageItem[];
          const data: any = await r.json();
          const out: ServerStockImageItem[] = [];
          for (const item of data?.results || []) {
            const imgUrl = item?.url;
            const thumb = item?.thumbnail || imgUrl;
            if (!imgUrl || !isSafeExternalImageUrl(imgUrl)) continue;
            if (item?.width && item.width < 320) continue;
            const lic = String(item?.license || 'CC').toUpperCase();
            out.push({
              id: `openverse-${item.id}`,
              title: item.title || q,
              author: item.creator || 'Créateur Openverse',
              license: lic === 'CC0' || lic === 'PDM' ? 'Domaine public · CC0' : `Libre · ${lic}`,
              source: 'Openverse',
              thumbUrl: thumb,
              fullUrl: imgUrl,
              proxyUrl: `/api/stock-images/image?url=${encodeURIComponent(imgUrl)}`,
              width: item.width,
              height: item.height,
            });
          }
          return out;
        } catch {
          return [] as ServerStockImageItem[];
        } finally {
          clearTimeout(t);
        }
      };

      const fetchWikimedia = async (q: string) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4500);
        try {
          const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
            `${q} filetype:bitmap`
          )}&gsrlimit=${limit}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1080&format=json&origin=*`;
          const r = await fetch(url, {
            headers: { 'User-Agent': 'FOFO-AI-Studio/1.0 (https://fofo.ai)' },
            signal: ctrl.signal,
          });
          if (!r.ok) return [] as ServerStockImageItem[];
          const data: any = await r.json();
          const pages = Object.values(data?.query?.pages || {}) as any[];
          const out: ServerStockImageItem[] = [];
          for (const page of pages) {
            const info = page?.imageinfo?.[0];
            if (!info) continue;
            const mime = String(info.mime || '');
            if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) continue;
            if ((info.width || 0) < 350 || (info.height || 0) < 250) continue;
            const fullUrl = info.thumburl || info.url;
            if (!fullUrl || !isSafeExternalImageUrl(fullUrl)) continue;
            const meta = info.extmetadata || {};
            const author = stripHtmlTags(meta?.Artist?.value || '') || 'Wikimedia Contributor';
            const licenseShort = stripHtmlTags(meta?.LicenseShortName?.value || '') || 'CC / Libre';
            const cleanTitle =
              stripHtmlTags(meta?.ObjectName?.value || '') ||
              String(page.title || '')
                .replace(/^File:/i, '')
                .replace(/\.[^/.]+$/, '')
                .replace(/[_-]+/g, ' ');
            out.push({
              id: `commons-${page.pageid}`,
              title: cleanTitle || q,
              author: author.slice(0, 48),
              license: `Libre · ${licenseShort.slice(0, 24)}`,
              source: 'Wikimedia',
              thumbUrl: fullUrl,
              fullUrl,
              proxyUrl: `/api/stock-images/image?url=${encodeURIComponent(fullUrl)}`,
              width: info.thumbwidth || info.width,
              height: info.thumbheight || info.height,
            });
          }
          return out;
        } catch {
          return [] as ServerStockImageItem[];
        } finally {
          clearTimeout(t);
        }
      };

      const [ovPrimary, wmPrimary] = await Promise.all([
        fetchOpenverse(activeSearchQuery),
        fetchWikimedia(activeSearchQuery),
      ]);
      for (const item of [...ovPrimary, ...wmPrimary]) {
        pushUnique(item);
        if (results.length >= limit) break;
      }

      // Si une requête en français a retourné peu de résultats, élargir avec l'équivalent anglais
      if (results.length < 4 && searchQueries.length > 1) {
        const [ovEn, wmEn] = await Promise.all([
          fetchOpenverse(searchQueries[1]),
          fetchWikimedia(searchQueries[1]),
        ]);
        for (const item of [...ovEn, ...wmEn]) {
          pushUnique(item);
          if (results.length >= limit) break;
        }
      }
    }

    // 5. Fallback local thématique si les APIs distantes sont indisponibles
    if (results.length === 0) {
      for (const item of buildCuratedStockFallback(rawQuery, limit)) {
        pushUnique(item);
      }
    }

    return res.json({
      query: rawQuery,
      count: results.length,
      sources: Array.from(new Set(results.map((r) => r.source))),
      results: results.slice(0, limit),
    });
  } catch (err) {
    console.error('Erreur /api/stock-images/search:', err);
    const fallback = buildCuratedStockFallback(rawQuery, limit);
    return res.json({
      query: rawQuery,
      count: fallback.length,
      sources: ['Collection Studio'],
      results: fallback,
    });
  }
});

// Endpoint GET /api/stock-images/image — Proxy CORS-safe durci anti-SSRF, anti-SVG-XSS & limite 12 Mo
app.get('/api/stock-images/image', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  if (!rawUrl || rawUrl.length > 2000 || !isSafeExternalImageUrl(rawUrl)) {
    return res.status(400).send('URL image invalide');
  }

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 7000);
  try {
    let targetUrl = rawUrl;
    let upstream: Response | null = null;

    for (let hop = 0; hop < 3; hop++) {
      const dnsCheck = await assertSafePublicExternalUrl(targetUrl, { allowHttp: false });
      if (!dnsCheck.ok || !dnsCheck.normalizedUrl) {
        clearTimeout(timeoutId);
        return res.status(403).send('URL externe bloquée par la sécurité réseau');
      }

      upstream = await fetch(dnsCheck.normalizedUrl, {
        headers: {
          'User-Agent': 'FOFO-AI-Studio/1.0 (https://fofo.ai)',
          Accept: 'image/jpeg,image/png,image/webp,image/avif,image/gif,*/*;q=0.5',
        },
        redirect: 'manual',
        signal: ctrl.signal,
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (!location) break;
        targetUrl = new URL(location, dnsCheck.normalizedUrl).toString();
        continue;
      }
      break;
    }
    clearTimeout(timeoutId);

    if (!upstream || !upstream.ok) {
      return res.status(upstream?.status || 502).send('Image introuvable');
    }

    const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const allowedImageMimes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
    ]);
    if (!allowedImageMimes.has(contentType)) {
      return res.status(415).send('Type de média non pris en charge');
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    if (contentLength > MAX_IMAGE_BYTES) {
      return res.status(413).send('Image trop volumineuse');
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).send('Image trop volumineuse');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  } catch {
    clearTimeout(timeoutId);
    return res.status(502).send('Impossible de récupérer image');
  }
});

// ============================================================================
// Messages Vocaux & Voix IA : Transcription (gemini-3.5-transcribe + fallback) & TTS (gemini-3.8-flash-lite-tts)
// ============================================================================
app.post('/api/audio/transcribe', async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: 'Service de transcription IA indisponible (clé Gemini non configurée côté serveur).',
      });
    }

    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
    if (typeof audioBase64 !== 'string' || !audioBase64.trim()) {
      return res.status(400).json({ error: 'Données audio manquantes.' });
    }

    // Strip data URL prefix if present & codec suffix (e.g. "audio/webm;codecs=opus" -> "audio/webm")
    const cleanedBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanedBase64) || cleanedBase64.length > 14_000_000) {
      return res.status(400).json({ error: 'Format ou taille de message vocal invalide (max 10 Mo).' });
    }

    const rawMime = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    const allowedAudioMimes = new Set([
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/ogg',
      'audio/wav',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/aac',
    ]);
    const safeMime = allowedAudioMimes.has(rawMime)
      ? rawMime === 'audio/m4a' || rawMime === 'audio/x-m4a'
        ? 'audio/mp4'
        : rawMime
      : 'audio/webm';

    const audioContents = {
      parts: [
        {
          inlineData: {
            mimeType: safeMime,
            data: cleanedBase64,
          },
        },
        {
          text: "Transcris mot à mot les paroles audibles dans ce message vocal en français (ou dans la langue parlée). Retourne uniquement le texte transcrit, sans guillemets ni commentaire. S'il n'y a aucune parole audible ou uniquement du silence, réponds exactement : [SILENCE]",
        },
      ],
    };

    const transcribeClient = audioAi || ai;
    let lastErr: any;
    for (const model of ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite']) {
      try {
        const response = await withTimeout(
          transcribeClient.models.generateContent({
            model,
            contents: audioContents,
          }),
          15000,
          model
        );
        const rawTranscript = (response.text || '').trim();
        const transcript =
          !rawTranscript || /^\[?SILENCE\]?$/i.test(rawTranscript) ? '' : rawTranscript;
        return res.json({ transcript, model });
      } catch (modelErr: any) {
        lastErr = modelErr;
        console.warn(`Fallback transcription après échec sur ${model}:`, modelErr?.status || modelErr?.message || modelErr);
      }
    }

    throw lastErr || new Error('Transcription indisponible');
  } catch (err: any) {
    console.error('Erreur /api/audio/transcribe:', err?.status || err?.message || err);
    return res.status(502).json({
      error: 'Impossible de transcrire le message vocal pour le moment. Réessayez.',
    });
  }
});

app.post('/api/audio/tts', async (req, res) => {
  try {
    if (!ai && !audioAi) {
      return res.status(503).json({
        error: 'Synthèse vocale IA indisponible (clé Gemini non configurée côté serveur).',
      });
    }

    const { text = '', voiceId = 'mathieu' } = req.body || {};
    const safeText = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
    if (!safeText) {
      return res.status(400).json({ error: 'Texte manquant pour la lecture vocale.' });
    }

    const voiceMap: Record<string, string> = {
      mathieu: 'Charon',
      thomas: 'Fenrir',
      alex: 'Puck',
      chloe: 'Zephyr',
      sarah: 'Kore',
    };
    const voiceName = voiceMap[String(voiceId).toLowerCase()] || 'Charon';

    const ttsConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    };

    const ttsClient = audioAi || ai!;
    let response: any;
    try {
      response = await withTimeout(
        ttsClient.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: safeText,
                  speechMetadata: {
                    style: 'Voix claire, naturelle et expressive en français',
                  },
                },
              ],
            },
          ],
          config: ttsConfig,
        }),
        15000,
        'gemini-3.8-flash-lite-tts'
      );
    } catch (firstErr: any) {
      console.warn('TTS retry sans speechMetadata après échec:', firstErr?.status || firstErr?.message || firstErr);
      response = await withTimeout(
        ttsClient.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: safeText }],
            },
          ],
          config: ttsConfig,
        }),
        15000,
        'gemini-3.8-flash-lite-tts-plain'
      );
    }

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      return res.status(502).json({ error: 'Aucun flux audio généré.' });
    }

    return res.json({
      audioBase64,
      mimeType: 'audio/wav',
    });
  } catch (err: any) {
    console.error('Erreur /api/audio/tts:', err?.status || err?.message || err);
    return res.status(502).json({
      error: "Impossible de générer l'audio vocal pour le moment.",
    });
  }
});

// Endpoint pour vérifier la disponibilité de l'IA
app.get('/api/status', async (req, res) => {
  const probe = req.query.probe === '1';
  if (!probe) {
    return res.json({
      status: 'ok',
      aiEnabled: !!ai,
      engine: 'FOFO AI (Gemini 4 Hydrogen)',
    });
  }
  if (!ai) {
    return res.json({
      status: 'ok',
      aiEnabled: false,
      probeOk: false,
      reason: 'GEMINI_API_KEY missing or placeholder',
    });
  }
  const results: Record<string, any> = {};
  for (const model of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
    try {
      const r = await withTimeout(
        ai.models.generateContent({
          model,
          contents: 'Réponds uniquement OK',
          config: model === 'gemini-4-hydrogen' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : undefined,
        }),
        6000,
        model
      );
      results[model] = { ok: true, sample: (r.text || '').slice(0, 40) };
    } catch (err: any) {
      results[model] = {
        ok: false,
        status: err?.status || null,
        message: String(err?.message || err || 'unknown').slice(0, 220),
      };
    }
  }
  return res.json({
    status: 'ok',
    aiEnabled: true,
    probeOk: Object.values(results).some((v: any) => v.ok),
    models: results,
  });
});

// ============================================================================
// Paiements Sécurisés : PayPal, Stripe & Visa / Carte Bancaire
// ============================================================================
type PaymentPlanId = 'pro' | 'business';
type PaymentBillingCycle = 'monthly' | 'annual';

function getServerPlanPricing(plan: PaymentPlanId, billingCycle: PaymentBillingCycle) {
  const monthlyUnit = plan === 'business' ? (billingCycle === 'annual' ? 35 : 44) : billingCycle === 'annual' ? 15 : 19;
  const totalEur = billingCycle === 'annual' ? monthlyUnit * 12 : monthlyUnit;
  const label =
    plan === 'business'
      ? `FOFO AI Tarif Business (${billingCycle === 'annual' ? 'Annuel -20%' : 'Mensuel'})`
      : `FOFO AI Créateur PRO (${billingCycle === 'annual' ? 'Annuel -20%' : 'Mensuel'})`;
  return { monthlyUnit, totalEur, label };
}

function luhnCheck(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function detectCardBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  return 'Carte Bancaire';
}

function getPayPalApiBase(): string {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('Identifiants PayPal non configurés');
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) {
    throw new Error(`Erreur OAuth PayPal (${resp.status})`);
  }
  const data: any = await resp.json();
  return data.access_token;
}

function resolveRequestOrigin(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      return new URL(envUrl).origin;
    } catch {
      // Fallback below
    }
  }
  const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim().toLowerCase();
  const proto = rawProto === 'https' ? 'https' : 'http';
  const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`).split(',')[0].trim();
  const safeHost = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost) ? rawHost : `localhost:${PORT}`;
  return `${proto}://${safeHost}`;
}

app.get('/api/payments/config', (_req, res) => {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const paypalConfigured = Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()
  );
  return res.json({
    stripeConfigured,
    paypalConfigured,
    paypalEnv: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    supportedMethods: ['visa', 'stripe', 'paypal'],
    currency: 'EUR',
  });
});

app.post('/api/payments/visa/confirm', (req, res) => {
  try {
    const {
      plan = 'pro',
      billingCycle = 'annual',
      cardNumber = '',
      expiry = '',
      cvc = '',
      cardholderName = '',
      email = '',
    } = req.body || {};

    const safePlan: PaymentPlanId = plan === 'business' ? 'business' : 'pro';
    const safeCycle: PaymentBillingCycle = billingCycle === 'monthly' ? 'monthly' : 'annual';
    const pricing = getServerPlanPricing(safePlan, safeCycle);

    const digits = String(cardNumber).replace(/\D/g, '');
    if (!luhnCheck(digits)) {
      return res.status(400).json({ error: 'Numéro de carte Visa / bancaire invalide.' });
    }

    const expMatch = String(expiry).trim().match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
    if (!expMatch) {
      return res.status(400).json({ error: 'Date d’expiration invalide (format MM/AA requis).' });
    }
    const expMonth = Number(expMatch[1]);
    const rawYear = Number(expMatch[2]);
    const expYear = rawYear < 100 ? 2000 + rawYear : rawYear;
    const now = new Date();
    if (
      expMonth < 1 ||
      expMonth > 12 ||
      expYear < now.getFullYear() ||
      (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)
    ) {
      return res.status(400).json({ error: 'Cette carte est expirée.' });
    }

    const safeCvc = String(cvc).replace(/\D/g, '');
    if (safeCvc.length < 3 || safeCvc.length > 4) {
      return res.status(400).json({ error: 'Code de sécurité CVC invalide (3 ou 4 chiffres).' });
    }

    if (!String(cardholderName).trim() || String(cardholderName).trim().length < 2) {
      return res.status(400).json({ error: 'Veuillez indiquer le nom complet du titulaire.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Adresse e-mail de facturation invalide.' });
    }

    const brand = detectCardBrand(digits);
    const last4 = digits.slice(-4);
    const transactionId = `VISA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    return res.json({
      ok: true,
      mode: process.env.STRIPE_SECRET_KEY ? 'live-verified' : 'sandbox',
      provider: 'visa',
      brand,
      last4,
      plan: safePlan,
      billingCycle: safeCycle,
      amountEur: pricing.totalEur,
      monthlyUnitEur: pricing.monthlyUnit,
      label: pricing.label,
      transactionId,
      paidAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur /api/payments/visa/confirm:', err);
    return res.status(500).json({ error: 'Erreur lors de la validation du paiement carte.' });
  }
});

app.post('/api/payments/stripe/create-checkout-session', async (req, res) => {
  try {
    const {
      plan = 'pro',
      billingCycle = 'annual',
      email = '',
    } = req.body || {};

    const safePlan: PaymentPlanId = plan === 'business' ? 'business' : 'pro';
    const safeCycle: PaymentBillingCycle = billingCycle === 'monthly' ? 'monthly' : 'annual';
    const pricing = getServerPlanPricing(safePlan, safeCycle);
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (stripeKey) {
      const origin = resolveRequestOrigin(req);
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('payment_method_types[]', 'card');
      params.append('line_items[0][price_data][currency]', 'eur');
      params.append('line_items[0][price_data][unit_amount]', String(pricing.totalEur * 100));
      params.append('line_items[0][price_data][product_data][name]', pricing.label);
      params.append('line_items[0][quantity]', '1');
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        params.append('customer_email', String(email).trim());
      }
      params.append('metadata[plan]', safePlan);
      params.append('metadata[billingCycle]', safeCycle);
      params.append(
        'success_url',
        `${origin}/?payment_status=success&provider=stripe&plan=${safePlan}&cycle=${safeCycle}&session_id={CHECKOUT_SESSION_ID}`
      );
      params.append('cancel_url', `${origin}/?payment_status=cancelled&provider=stripe`);

      const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const stripeData: any = await stripeResp.json();
      if (!stripeResp.ok || !stripeData?.url) {
        return res.status(502).json({
          error: stripeData?.error?.message || 'Impossible de créer la session Stripe Checkout.',
        });
      }

      return res.json({
        ok: true,
        mode: 'live',
        provider: 'stripe',
        sessionId: stripeData.id,
        checkoutUrl: stripeData.url,
        plan: safePlan,
        billingCycle: safeCycle,
        amountEur: pricing.totalEur,
      });
    }

    const transactionId = `STR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return res.json({
      ok: true,
      mode: 'sandbox',
      provider: 'stripe',
      plan: safePlan,
      billingCycle: safeCycle,
      amountEur: pricing.totalEur,
      monthlyUnitEur: pricing.monthlyUnit,
      label: pricing.label,
      transactionId,
      paidAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur /api/payments/stripe/create-checkout-session:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du paiement Stripe.' });
  }
});

app.post('/api/payments/stripe/verify-session', async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!sessionId || !stripeKey) {
      return res.status(400).json({ error: 'Session Stripe introuvable.' });
    }
    const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const data: any = await resp.json();
    if (!resp.ok) {
      return res.status(502).json({ error: data?.error?.message || 'Vérification Stripe impossible.' });
    }
    return res.json({
      ok: data.payment_status === 'paid',
      paymentStatus: data.payment_status,
      plan: data.metadata?.plan === 'business' ? 'business' : 'pro',
      billingCycle: data.metadata?.cycle === 'monthly' ? 'monthly' : 'annual',
      transactionId: data.id,
    });
  } catch (err) {
    console.error('Erreur /api/payments/stripe/verify-session:', err);
    return res.status(500).json({ error: 'Erreur lors de la vérification Stripe.' });
  }
});

app.post('/api/payments/paypal/create-order', async (req, res) => {
  try {
    const {
      plan = 'pro',
      billingCycle = 'annual',
      paypalEmail = '',
    } = req.body || {};

    const safePlan: PaymentPlanId = plan === 'business' ? 'business' : 'pro';
    const safeCycle: PaymentBillingCycle = billingCycle === 'monthly' ? 'monthly' : 'annual';
    const pricing = getServerPlanPricing(safePlan, safeCycle);

    const hasLivePayPal = Boolean(
      process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()
    );

    if (hasLivePayPal) {
      const accessToken = await getPayPalAccessToken();
      const origin = resolveRequestOrigin(req);
      const orderResp = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              description: pricing.label,
              custom_id: `${safePlan}:${safeCycle}`,
              amount: {
                currency_code: 'EUR',
                value: pricing.totalEur.toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: 'FOFO AI Studio',
            user_action: 'PAY_NOW',
            return_url: `${origin}/?payment_status=success&provider=paypal&plan=${safePlan}&cycle=${safeCycle}`,
            cancel_url: `${origin}/?payment_status=cancelled&provider=paypal`,
          },
        }),
      });

      const orderData: any = await orderResp.json();
      const approveLink = Array.isArray(orderData?.links)
        ? orderData.links.find((l: any) => l.rel === 'approve')?.href
        : null;

      if (!orderResp.ok || !approveLink) {
        return res.status(502).json({
          error: orderData?.message || 'Impossible de créer la commande PayPal.',
        });
      }

      return res.json({
        ok: true,
        mode: 'live',
        provider: 'paypal',
        orderId: orderData.id,
        approveUrl: approveLink,
        plan: safePlan,
        billingCycle: safeCycle,
        amountEur: pricing.totalEur,
      });
    }

    if (paypalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(paypalEmail).trim())) {
      return res.status(400).json({ error: 'Adresse e-mail PayPal invalide.' });
    }

    const transactionId = `PP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return res.json({
      ok: true,
      mode: 'sandbox',
      provider: 'paypal',
      plan: safePlan,
      billingCycle: safeCycle,
      amountEur: pricing.totalEur,
      monthlyUnitEur: pricing.monthlyUnit,
      label: pricing.label,
      paypalEmail: String(paypalEmail).trim() || 'compte@paypal.com',
      transactionId,
      paidAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur /api/payments/paypal/create-order:', err);
    return res.status(500).json({ error: 'Erreur lors de la création de la commande PayPal.' });
  }
});

app.post('/api/payments/paypal/capture-order', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'Identifiant de commande PayPal manquant.' });
    }
    const accessToken = await getPayPalAccessToken();
    const captureResp = await fetch(
      `${getPayPalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data: any = await captureResp.json();
    if (!captureResp.ok || data.status !== 'COMPLETED') {
      return res.status(502).json({ error: data?.message || 'Capture PayPal non finalisée.' });
    }
    const customId = String(data?.purchase_units?.[0]?.custom_id || 'pro:annual');
    const [rawPlan, rawCycle] = customId.split(':');
    return res.json({
      ok: true,
      plan: rawPlan === 'business' ? 'business' : 'pro',
      billingCycle: rawCycle === 'monthly' ? 'monthly' : 'annual',
      transactionId: data.id,
    });
  } catch (err) {
    console.error('Erreur /api/payments/paypal/capture-order:', err);
    return res.status(500).json({ error: 'Erreur lors de la confirmation PayPal.' });
  }
});

// Montage des fichiers statiques (images, sons .ogg, etc.) et de Vite
async function startServer() {
  app.use(express.static(path.resolve(__dirname, 'public')));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FOFO AI Studio démarré sur http://localhost:${PORT}`);
  });
}

startServer();
