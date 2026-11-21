import { CameraEffect, SceneTransition, VideoScene } from '../types';

export type CutRhythmProfile = 'tiktok-fast' | 'balanced' | 'youtube-story';

export type CutReasonType =
  | 'sentence-pause'
  | 'breath-pause'
  | 'narrative-pivot'
  | 'cadence-beat';

export interface VoiceoverRhythmSegment {
  wordIndex: number;
  word: string;
  startSec: number;
  endSec: number;
  energy: number; // 0.2..1.0 speech cadence intensity
  pauseAfterMs: number;
}

export interface SuggestedCutPoint {
  id: string;
  sceneIndex: number;
  sceneNumber: number;
  wordIndex: number; // split AFTER this word index (i.e. words[0..wordIndex] | words[wordIndex+1..])
  timestampSec: number;
  globalTimestampSec: number;
  beforeText: string;
  afterText: string;
  beforeDurationSec: number;
  afterDurationSec: number;
  pauseMs: number;
  reason: CutReasonType;
  reasonLabel: string;
  recommendedTransition: SceneTransition;
  recommendedCamera: CameraEffect;
}

export interface SceneRhythmReport {
  sceneIndex: number;
  sceneNumber: number;
  wordCount: number;
  estimatedSpokenSec: number;
  configuredDurationSec: number;
  wordsPerMinute: number;
  segments: VoiceoverRhythmSegment[];
  suggestedCuts: SuggestedCutPoint[];
}

export interface ProjectRhythmAnalysis {
  profile: CutRhythmProfile;
  vocalSpeed: number;
  totalWords: number;
  averageWpm: number;
  totalEstimatedSpokenSec: number;
  totalConfiguredSec: number;
  averageTargetShotSec: number;
  sceneReports: SceneRhythmReport[];
  allSuggestedCuts: SuggestedCutPoint[];
}

const NARRATIVE_PIVOT_WORDS = new Set([
  'mais',
  'alors',
  'cependant',
  'pourtant',
  'voici',
  'ensuite',
  'puis',
  'enfin',
  'soudain',
  'pourquoi',
  'comment',
  'attention',
  'résultat',
  'secret',
  'premier',
  'première',
  'deuxième',
  'troisième',
  'surtout',
  'maintenant',
  'finalement',
  'dès',
  'regarde',
  'regardez',
  'écoute',
  'écoutez',
  'but',
  'however',
  'suddenly',
  'first',
  'second',
  'third',
  'finally',
]);

const CAMERA_ROTATION: CameraEffect[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];

function countSyllablesApprox(word: string): number {
  const cleaned = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (!cleaned) return 1;
  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

function getPunctuationPauseMs(word: string, speed: number): {
  pauseMs: number;
  kind: 'sentence' | 'clause' | 'none';
} {
  const factor = 1 / Math.max(0.65, Math.min(1.6, speed));
  if (/[.!?]+["»”)]*$/.test(word)) {
    return { pauseMs: Math.round(460 * factor), kind: 'sentence' };
  }
  if (/[:;—–]+["»”)]*$/.test(word) || /\.\.\.$/.test(word)) {
    return { pauseMs: Math.round(350 * factor), kind: 'clause' };
  }
  if (/[,]+["»”)]*$/.test(word)) {
    return { pauseMs: Math.round(220 * factor), kind: 'clause' };
  }
  return { pauseMs: 0, kind: 'none' };
}

function getProfileThresholds(profile: CutRhythmProfile) {
  if (profile === 'tiktok-fast') {
    return {
      minShotSec: 1.8,
      idealShotSec: 2.6,
      maxShotSec: 3.6,
      minWordsPerSegment: 4,
    };
  }
  if (profile === 'youtube-story') {
    return {
      minShotSec: 4.0,
      idealShotSec: 6.2,
      maxShotSec: 8.5,
      minWordsPerSegment: 9,
    };
  }
  return {
    minShotSec: 2.6,
    idealShotSec: 4.0,
    maxShotSec: 5.5,
    minWordsPerSegment: 6,
  };
}

function pickContrastingCamera(current: CameraEffect, offset: number): CameraEffect {
  const idx = CAMERA_ROTATION.indexOf(current);
  const base = idx >= 0 ? idx : 0;
  return CAMERA_ROTATION[(base + 1 + offset) % CAMERA_ROTATION.length];
}

export function estimateSceneSpokenDurationSec(text: string, vocalSpeed: number = 1.05): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 3;

  const rate = Math.max(0.65, Math.min(1.6, vocalSpeed));
  let totalMs = 0;

  for (const w of words) {
    const syllables = countSyllablesApprox(w);
    const wordMs = (120 + syllables * 145) / rate;
    const { pauseMs } = getPunctuationPauseMs(w, rate);
    totalMs += wordMs + pauseMs;
  }

  return Math.max(2, Number((totalMs / 1000).toFixed(1)));
}

export function analyzeSceneVoiceoverRhythm(
  scene: VideoScene,
  sceneIndex: number,
  globalOffsetSec: number,
  profile: CutRhythmProfile = 'balanced',
  vocalSpeed: number = 1.05
): SceneRhythmReport {
  const words = (scene.voiceoverText || '').trim().split(/\s+/).filter(Boolean);
  const configuredDurationSec = Math.max(2, scene.durationSeconds || 6);
  const rate = Math.max(0.65, Math.min(1.6, vocalSpeed));

  if (words.length === 0) {
    return {
      sceneIndex,
      sceneNumber: scene.sceneNumber,
      wordCount: 0,
      estimatedSpokenSec: configuredDurationSec,
      configuredDurationSec,
      wordsPerMinute: 0,
      segments: [],
      suggestedCuts: [],
    };
  }

  const rawUnits: Array<{
    word: string;
    speakMs: number;
    pauseMs: number;
    punctKind: 'sentence' | 'clause' | 'none';
    syllables: number;
  }> = words.map((word) => {
    const syllables = countSyllablesApprox(word);
    const speakMs = (120 + syllables * 145) / rate;
    const { pauseMs, kind } = getPunctuationPauseMs(word, rate);
    return {
      word,
      speakMs,
      pauseMs,
      punctKind: kind,
      syllables,
    };
  });

  const rawTotalMs = rawUnits.reduce((acc, u) => acc + u.speakMs + u.pauseMs, 0) || 1000;
  const estimatedSpokenSec = Math.max(2, Number((rawTotalMs / 1000).toFixed(1)));
  // Map segment timings cleanly onto the scene's configured timeline duration
  const timeScale = (configuredDurationSec * 1000) / rawTotalMs;

  const segments: VoiceoverRhythmSegment[] = [];
  let cursorSec = 0;

  rawUnits.forEach((u, idx) => {
    const wordDurSec = (u.speakMs * timeScale) / 1000;
    const pauseSec = (u.pauseMs * timeScale) / 1000;
    const syllablesNorm = Math.min(1, 0.35 + u.syllables * 0.16);
    const punctEmphasis = u.punctKind === 'sentence' ? 0.2 : u.punctKind === 'clause' ? 0.1 : 0;
    const energy = Number(Math.min(1, Math.max(0.25, syllablesNorm + punctEmphasis)).toFixed(2));

    segments.push({
      wordIndex: idx,
      word: u.word,
      startSec: Number(cursorSec.toFixed(2)),
      endSec: Number((cursorSec + wordDurSec).toFixed(2)),
      energy,
      pauseAfterMs: Math.round(u.pauseMs),
    });

    cursorSec += wordDurSec + pauseSec;
  });

  const wordsPerMinute = Math.round((words.length / Math.max(1, estimatedSpokenSec)) * 60);
  const thresholds = getProfileThresholds(profile);

  // Need at least 2 * minWordsPerSegment words & sufficient duration to propose a meaningful cut
  const suggestedCuts: SuggestedCutPoint[] = [];
  if (words.length >= thresholds.minWordsPerSegment * 2 && configuredDurationSec >= thresholds.minShotSec * 2) {
    let lastCutWordIdx = -1;
    let lastCutSec = 0;

    // Candidate scoring pass
    while (true) {
      const remainingWords = words.length - 1 - lastCutWordIdx;
      const remainingSec = configuredDurationSec - lastCutSec;
      if (remainingWords < thresholds.minWordsPerSegment * 2 || remainingSec < thresholds.minShotSec * 2) {
        break;
      }

      let bestIdx = -1;
      let bestScore = -Infinity;
      let bestReason: CutReasonType = 'cadence-beat';
      let bestReasonLabel = 'Pic de cadence vocale';
      let bestTransition: SceneTransition = profile === 'tiktok-fast' ? 'cut' : 'zoom';

      for (let i = lastCutWordIdx + thresholds.minWordsPerSegment; i <= words.length - thresholds.minWordsPerSegment - 1; i++) {
        const seg = segments[i];
        const segElapsed = seg.endSec - lastCutSec;
        const segRemaining = configuredDurationSec - seg.endSec;

        if (segElapsed < thresholds.minShotSec || segRemaining < thresholds.minShotSec) {
          continue;
        }

        const unit = rawUnits[i];
        const nextWordClean = (words[i + 1] || '')
          .toLowerCase()
          .replace(/^[^a-zà-ÿ0-9]+|[^a-zà-ÿ0-9]+$/gi, '');
        const isPivotNext = NARRATIVE_PIVOT_WORDS.has(nextWordClean);

        // Distance from ideal shot duration gives rhythm score
        const distFromIdeal = Math.abs(segElapsed - thresholds.idealShotSec);
        let score = Math.max(0, 4.5 - distFromIdeal * 1.15);

        let reason: CutReasonType = 'cadence-beat';
        let reasonLabel = 'Pic de cadence vocale';
        let transition: SceneTransition = profile === 'tiktok-fast' ? 'cut' : 'slide';

        if (unit.punctKind === 'sentence') {
          score += 5.2;
          reason = 'sentence-pause';
          reasonLabel = 'Pause de phrase (. ! ?)';
          transition = profile === 'youtube-story' ? 'fade' : 'cut';
        } else if (unit.punctKind === 'clause') {
          score += 3.1;
          reason = 'breath-pause';
          reasonLabel = 'Respiration rythmique (, : —)';
          transition = profile === 'tiktok-fast' ? 'cut' : 'slide';
        }

        if (isPivotNext) {
          score += 2.8;
          if (unit.punctKind === 'none') {
            reason = 'narrative-pivot';
            reasonLabel = `Pivot narratif (« ${nextWordClean} »)`;
            transition = 'zoom';
          }
        }

        // Mild bonus when current duration approaches maxShotSec
        if (segElapsed >= thresholds.maxShotSec * 0.85) {
          score += 1.4;
        }

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
          bestReason = reason;
          bestReasonLabel = reasonLabel;
          bestTransition = transition;
        }
      }

      if (bestIdx === -1) break;

      const cutSec = segments[bestIdx].endSec;
      const prevStartWord = lastCutWordIdx + 1;
      const beforeText = words.slice(prevStartWord, bestIdx + 1).join(' ');
      const afterText = words.slice(bestIdx + 1).join(' ');
      const beforeDur = Math.max(2, Math.round(cutSec - lastCutSec));
      const afterDur = Math.max(2, Math.round(configuredDurationSec - cutSec));

      suggestedCuts.push({
        id: `cut-${sceneIndex}-${bestIdx}`,
        sceneIndex,
        sceneNumber: scene.sceneNumber,
        wordIndex: bestIdx,
        timestampSec: Number(cutSec.toFixed(1)),
        globalTimestampSec: Number((globalOffsetSec + cutSec).toFixed(1)),
        beforeText,
        afterText,
        beforeDurationSec: beforeDur,
        afterDurationSec: afterDur,
        pauseMs: Math.max(140, segments[bestIdx].pauseAfterMs || 180),
        reason: bestReason,
        reasonLabel: bestReasonLabel,
        recommendedTransition: bestTransition,
        recommendedCamera: pickContrastingCamera(scene.kenBurnsEffect, suggestedCuts.length),
      });

      lastCutWordIdx = bestIdx;
      lastCutSec = cutSec;
    }
  }

  return {
    sceneIndex,
    sceneNumber: scene.sceneNumber,
    wordCount: words.length,
    estimatedSpokenSec,
    configuredDurationSec,
    wordsPerMinute,
    segments,
    suggestedCuts,
  };
}

export function analyzeProjectVoiceoverRhythm(
  scenes: VideoScene[],
  profile: CutRhythmProfile = 'balanced',
  vocalSpeed: number = 1.05
): ProjectRhythmAnalysis {
  let globalOffsetSec = 0;
  const sceneReports: SceneRhythmReport[] = [];
  const allSuggestedCuts: SuggestedCutPoint[] = [];

  scenes.forEach((scene, idx) => {
    const report = analyzeSceneVoiceoverRhythm(scene, idx, globalOffsetSec, profile, vocalSpeed);
    sceneReports.push(report);
    allSuggestedCuts.push(...report.suggestedCuts);
    globalOffsetSec += Math.max(2, scene.durationSeconds || 6);
  });

  const totalWords = sceneReports.reduce((acc, r) => acc + r.wordCount, 0);
  const totalEstimatedSpokenSec = Number(
    sceneReports.reduce((acc, r) => acc + r.estimatedSpokenSec, 0).toFixed(1)
  );
  const totalConfiguredSec = sceneReports.reduce((acc, r) => acc + r.configuredDurationSec, 0);
  const averageWpm =
    totalEstimatedSpokenSec > 0 ? Math.round((totalWords / totalEstimatedSpokenSec) * 60) : 0;
  const projectedSceneCount = scenes.length + allSuggestedCuts.length;
  const averageTargetShotSec = Number(
    (totalConfiguredSec / Math.max(1, projectedSceneCount)).toFixed(1)
  );

  return {
    profile,
    vocalSpeed,
    totalWords,
    averageWpm,
    totalEstimatedSpokenSec,
    totalConfiguredSec,
    averageTargetShotSec,
    sceneReports,
    allSuggestedCuts,
  };
}

export function applySuggestedCutsToScenes(
  scenes: VideoScene[],
  cutsToApply: SuggestedCutPoint[]
): VideoScene[] {
  if (cutsToApply.length === 0) return scenes;

  const cutsByScene = new Map<number, SuggestedCutPoint[]>();
  for (const cut of cutsToApply) {
    const list = cutsByScene.get(cut.sceneIndex) || [];
    list.push(cut);
    cutsByScene.set(cut.sceneIndex, list);
  }

  const nextScenes: VideoScene[] = [];

  scenes.forEach((scene, sceneIdx) => {
    const rawCuts = cutsByScene.get(sceneIdx);
    if (!rawCuts || rawCuts.length === 0) {
      nextScenes.push(scene);
      return;
    }

    const words = (scene.voiceoverText || '').trim().split(/\s+/).filter(Boolean);
    const validCuts = [...rawCuts]
      .filter((c) => c.wordIndex >= 0 && c.wordIndex < words.length - 1)
      .sort((a, b) => a.wordIndex - b.wordIndex);

    // Deduplicate identical word boundaries
    const dedupedCuts: SuggestedCutPoint[] = [];
    for (const c of validCuts) {
      if (dedupedCuts.length === 0 || c.wordIndex > dedupedCuts[dedupedCuts.length - 1].wordIndex) {
        dedupedCuts.push(c);
      }
    }

    if (dedupedCuts.length === 0) {
      nextScenes.push(scene);
      return;
    }

    const totalDur = Math.max(2, scene.durationSeconds || 6);
    const boundaries: Array<{
      startWord: number;
      endWord: number;
      cutUsed?: SuggestedCutPoint;
    }> = [];

    let prevWord = 0;
    for (const c of dedupedCuts) {
      boundaries.push({
        startWord: prevWord,
        endWord: c.wordIndex,
        cutUsed: c,
      });
      prevWord = c.wordIndex + 1;
    }
    boundaries.push({
      startWord: prevWord,
      endWord: words.length - 1,
    });

    const totalWordCount = Math.max(1, words.length);
    let allocated = 0;

    boundaries.forEach((seg, segIdx) => {
      const segWords = words.slice(seg.startWord, seg.endWord + 1);
      const isFirst = segIdx === 0;
      const isLast = segIdx === boundaries.length - 1;

      const rawDur = isLast
        ? Math.max(2, totalDur - allocated)
        : Math.max(2, Math.round((segWords.length / totalWordCount) * totalDur));
      if (!isLast) allocated += rawDur;

      const incomingCut = segIdx > 0 ? boundaries[segIdx - 1].cutUsed : undefined;

      nextScenes.push({
        ...scene,
        voiceoverText: segWords.join(' '),
        durationSeconds: rawDur,
        kenBurnsEffect: isFirst
          ? scene.kenBurnsEffect
          : incomingCut?.recommendedCamera || pickContrastingCamera(scene.kenBurnsEffect, segIdx),
        transition: isFirst
          ? scene.transition
          : incomingCut?.recommendedTransition || 'cut',
      });
    });
  });

  return nextScenes.map((s, idx) => ({
    ...s,
    sceneNumber: idx + 1,
  }));
}
