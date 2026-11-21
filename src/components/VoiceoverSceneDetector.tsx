import React, { useMemo, useState, useEffect } from 'react';
import {
  Activity,
  Check,
  Clock,
  Scissors,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { SceneTransition, VideoScene } from '../types';
import {
  analyzeProjectVoiceoverRhythm,
  CutRhythmProfile,
  SuggestedCutPoint,
} from '../utils/voiceoverSceneDetector';
import { audioEngine } from '../utils/audioEngine';

interface VoiceoverSceneDetectorProps {
  scenes: VideoScene[];
  currentSceneIdx: number;
  vocalSpeed: number;
  voiceId: string;
  onSelectScene: (idx: number) => void;
  onApplyCuts: (cuts: SuggestedCutPoint[]) => void;
  onSyncDurationsToVoice: (durationsSec: number[]) => void;
  onClose?: () => void;
}

const RHYTHM_PROFILES: Array<{
  id: CutRhythmProfile;
  label: string;
  cadenceHint: string;
}> = [
  { id: 'tiktok-fast', label: 'TikTok · Rapide', cadenceHint: '2.0–3.5s' },
  { id: 'balanced', label: 'Équilibré', cadenceHint: '3.5–5.5s' },
  { id: 'youtube-story', label: 'YouTube · Posé', cadenceHint: '5.5–8.5s' },
];

export const VoiceoverSceneDetector: React.FC<VoiceoverSceneDetectorProps> = ({
  scenes,
  currentSceneIdx,
  vocalSpeed,
  voiceId,
  onSelectScene,
  onApplyCuts,
  onSyncDurationsToVoice,
  onClose,
}) => {
  const [scope, setScope] = useState<'project' | 'scene'>('project');
  const [profile, setProfile] = useState<CutRhythmProfile>('balanced');
  const [selectedCutIds, setSelectedCutIds] = useState<Record<string, boolean>>({});
  const [transitionOverrides, setTransitionOverrides] = useState<Record<string, SceneTransition>>({});
  const [focusedCutId, setFocusedCutId] = useState<string | null>(null);
  const [playingCutId, setPlayingCutId] = useState<string | null>(null);

  const analysis = useMemo(
    () => analyzeProjectVoiceoverRhythm(scenes, profile, vocalSpeed),
    [scenes, profile, vocalSpeed]
  );

  const visibleCuts = useMemo(() => {
    const base =
      scope === 'scene'
        ? analysis.allSuggestedCuts.filter((c) => c.sceneIndex === currentSceneIdx)
        : analysis.allSuggestedCuts;

    return base.map((c) => ({
      ...c,
      recommendedTransition: transitionOverrides[c.id] || c.recommendedTransition,
    }));
  }, [analysis.allSuggestedCuts, scope, currentSceneIdx, transitionOverrides]);

  // Select all newly detected cuts by default when scope/profile/scenes change
  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    visibleCuts.forEach((c) => {
      defaults[c.id] = true;
    });
    setSelectedCutIds(defaults);
    setFocusedCutId((prev) =>
      prev && visibleCuts.some((c) => c.id === prev) ? prev : visibleCuts[0]?.id || null
    );
  }, [visibleCuts.map((c) => c.id).join('|')]);

  const activeSceneReport =
    analysis.sceneReports[currentSceneIdx] || analysis.sceneReports[0];

  const selectedCutsToApply = visibleCuts.filter((c) => selectedCutIds[c.id] !== false);

  const handleToggleCut = (cutId: string) => {
    setSelectedCutIds((prev) => ({
      ...prev,
      [cutId]: !(prev[cutId] !== false),
    }));
  };

  const handleListenAroundCut = (cut: SuggestedCutPoint) => {
    if (playingCutId === cut.id) {
      audioEngine.stopSpeech();
      setPlayingCutId(null);
      return;
    }
    const snippet = `${cut.beforeText.split(/\s+/).slice(-6).join(' ')} ... ${cut.afterText
      .split(/\s+/)
      .slice(0, 7)
      .join(' ')}`;
    setPlayingCutId(cut.id);
    setFocusedCutId(cut.id);
    audioEngine.speakText(snippet, voiceId, {
      rate: vocalSpeed,
      onEnd: () => setPlayingCutId(null),
      onError: () => setPlayingCutId(null),
    });
  };

  const handleSyncAllDurations = () => {
    const durations = analysis.sceneReports.map((r) =>
      Math.max(2, Math.round(r.estimatedSpokenSec))
    );
    onSyncDurationsToVoice(durations);
  };

  const timelineSceneIdx =
    scope === 'scene'
      ? currentSceneIdx
      : visibleCuts.find((c) => c.id === focusedCutId)?.sceneIndex ?? currentSceneIdx;
  const timelineReport =
    analysis.sceneReports[timelineSceneIdx] || activeSceneReport;
  const timelineSceneCuts = visibleCuts.filter(
    (c) => c.sceneIndex === timelineReport?.sceneIndex
  );

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/[0.07]">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0095F6] shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-white truncate">
              Détection de Scène Automatique (Voix Off)
            </h4>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {analysis.averageWpm > 0 ? `${analysis.averageWpm} mots/min` : 'Analyse prête'} ·{' '}
            {visibleCuts.length} coupe{visibleCuts.length > 1 ? 's' : ''} suggérée
            {visibleCuts.length > 1 ? 's' : ''} · ~{analysis.averageTargetShotSec}s / plan
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleSyncAllDurations}
            title="Ajuster la durée de chaque scène au temps réel de lecture de sa voix off"
            className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#09090B] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Clock className="w-3 h-3 text-[#0095F6]" />
            <span>Caler durées</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le détecteur de scène"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Controls: Scope + Rhythm Sensitivity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Scope segmented toggle */}
        <div
          role="group"
          aria-label="Portée de l'analyse vocale"
          className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.07]"
        >
          <button
            type="button"
            onClick={() => setScope('project')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              scope === 'project'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Toute la vidéo ({scenes.length})
          </button>
          <button
            type="button"
            onClick={() => setScope('scene')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
              scope === 'scene'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Scène {currentSceneIdx + 1} seule
          </button>
        </div>

        {/* Rhythm Profile segmented toggle */}
        <div
          role="group"
          aria-label="Profil de rythme de coupe"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.07]"
        >
          {RHYTHM_PROFILES.map((opt) => {
            const isSelected = profile === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProfile(opt.id)}
                title={`Cadence cible : ${opt.cadenceHint}`}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Voiceover Rhythm Cadence Bar with Cut Markers */}
      {timelineReport && timelineReport.segments.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Profil rythmique · Scène {timelineReport.sceneNumber}
            </span>
            <span className="font-mono tabular-nums">
              {timelineReport.wordCount} mots · ~{timelineReport.estimatedSpokenSec}s voix /{' '}
              {timelineReport.configuredDurationSec}s plan
            </span>
          </div>

          <div className="relative h-11 px-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.07] flex items-end gap-[2px] overflow-hidden pb-1.5 pt-3">
            {timelineReport.segments.map((seg) => {
              const hasPauseAfter = seg.pauseAfterMs >= 180;
              const isCutBoundary = timelineSceneCuts.some((c) => c.wordIndex === seg.wordIndex);
              const heightPct = Math.round(seg.energy * 100);
              return (
                <div
                  key={seg.wordIndex}
                  className="relative flex-1 h-full flex items-end justify-center group"
                  title={`${seg.word} (${seg.startSec.toFixed(1)}s)${
                    hasPauseAfter ? ` · pause ${seg.pauseAfterMs}ms` : ''
                  }`}
                >
                  <div
                    className={`w-full rounded-t-[2px] transition-colors ${
                      isCutBoundary
                        ? 'bg-[#DD2A7B]'
                        : hasPauseAfter
                        ? 'bg-[#0095F6]'
                        : 'bg-zinc-400/75 dark:bg-zinc-600/85'
                    }`}
                    style={{ height: `${Math.max(22, heightPct)}%` }}
                  />
                  {isCutBoundary && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-[1px] top-0 bottom-0 w-[2px] bg-[#DD2A7B] z-10"
                    />
                  )}
                </div>
              );
            })}

            {/* Clickable cut point markers */}
            {timelineSceneCuts.map((cut) => {
              const pct = Math.min(
                94,
                Math.max(
                  6,
                  (cut.timestampSec / Math.max(1, timelineReport.configuredDurationSec)) * 100
                )
              );
              const isFocused = focusedCutId === cut.id;
              return (
                <button
                  key={cut.id}
                  type="button"
                  onClick={() => setFocusedCutId(cut.id)}
                  style={{ left: `${pct}%` }}
                  title={`Point de coupe à ${cut.timestampSec}s — ${cut.reasonLabel}`}
                  className={`absolute top-1 -translate-x-1/2 px-1 py-0.5 rounded text-[9px] font-mono font-bold tabular-nums flex items-center gap-0.5 cursor-pointer z-20 transition-transform ${
                    isFocused
                      ? 'bg-[#DD2A7B] text-white scale-105 shadow-sm'
                      : 'bg-zinc-900 text-white dark:bg-white dark:text-black opacity-90 hover:opacity-100'
                  }`}
                >
                  <Scissors className="w-2.5 h-2.5" />
                  <span>{cut.timestampSec}s</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Cut Points List OR Clean Empty State */}
      {visibleCuts.length === 0 ? (
        <div className="py-5 px-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.07] text-center space-y-2">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Aucun point de coupe supplémentaire nécessaire sur {scope === 'scene' ? `la Scène ${currentSceneIdx + 1}` : 'ce découpage'}.
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {profile !== 'tiktok-fast'
              ? 'Le rythme vocal actuel est déjà concis. Passez en mode « TikTok · Rapide » pour détecter des coupes plus serrées.'
              : 'Vos phrases sont déjà courtes et rythmées pour un montage dynamique.'}
          </p>
          {profile !== 'tiktok-fast' && (
            <button
              type="button"
              onClick={() => setProfile('tiktok-fast')}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
            >
              Analyser en mode TikTok · Rapide
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
          {visibleCuts.map((cut) => {
            const isChecked = selectedCutIds[cut.id] !== false;
            const isFocused = focusedCutId === cut.id;
            const isListening = playingCutId === cut.id;

            return (
              <div
                key={cut.id}
                onClick={() => {
                  setFocusedCutId(cut.id);
                  if (cut.sceneIndex !== currentSceneIdx) {
                    onSelectScene(cut.sceneIndex);
                  }
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isFocused
                    ? 'bg-zinc-50 dark:bg-[#17171C] border-zinc-400 dark:border-white/30'
                    : 'bg-white dark:bg-[#09090B] border-zinc-200 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      aria-label={`Sélectionner le point de coupe Scène ${cut.sceneNumber} à ${cut.timestampSec}s`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCut(cut.id);
                      }}
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black'
                          : 'bg-transparent border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-zinc-950 dark:text-white truncate tabular-nums">
                        Scène {cut.sceneNumber} · Coupe à {cut.timestampSec}s{' '}
                        <span className="font-normal text-zinc-500 dark:text-zinc-400">
                          ({cut.beforeDurationSec}s / {cut.afterDurationSec}s)
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
                        {cut.reasonLabel} · pause ~{cut.pauseMs}ms
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={cut.recommendedTransition}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = e.target.value as SceneTransition;
                        setTransitionOverrides((prev) => ({
                          ...prev,
                          [cut.id]: val,
                        }));
                      }}
                      aria-label="Transition suggérée au point de coupe"
                      className="bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.12] rounded-md px-1.5 py-1 text-[10px] font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer focus:outline-none"
                    >
                      <option value="cut">Cut</option>
                      <option value="zoom">Zoom</option>
                      <option value="slide">Gliss.</option>
                      <option value="fade">Fondu</option>
                    </select>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleListenAroundCut(cut);
                      }}
                      title="Écouter le passage autour du point de coupe"
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isListening
                          ? 'bg-[#0095F6] text-white border-[#0095F6]'
                          : 'bg-zinc-100 dark:bg-[#121214] border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyCuts([cut]);
                      }}
                      className="px-2 py-1 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Couper
                    </button>
                  </div>
                </div>

                {/* Before / After Text Split Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                  <div className="px-2 py-1 rounded-lg bg-zinc-100/80 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 truncate">
                    <span className="font-semibold text-zinc-500">Avant :</span> « {cut.beforeText} »
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-zinc-100/80 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 truncate">
                    <span className="font-semibold text-[#DD2A7B]">Après :</span> « {cut.afterText} »
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Apply Footer */}
      {visibleCuts.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-white/[0.07]">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {selectedCutsToApply.length} / {visibleCuts.length} sélectionnée
            {selectedCutsToApply.length > 1 ? 's' : ''}
          </span>

          <button
            type="button"
            disabled={selectedCutsToApply.length === 0}
            onClick={() => onApplyCuts(selectedCutsToApply)}
            className="px-4 py-2 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient disabled:opacity-45 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Appliquer {selectedCutsToApply.length} coupe
              {selectedCutsToApply.length > 1 ? 's' : ''} suggérée
              {selectedCutsToApply.length > 1 ? 's' : ''}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
