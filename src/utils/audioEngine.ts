// Audio Engine for FOFO AI: Web Speech Synthesis & Web Audio Ambient + Trending Shorts/Reels Music Generator
import { SceneTransition, TransitionIntensity, TrendingSfxId } from '../types';

export type SfxSoundType = TrendingSfxId | 'eagle_cry' | 'eagle_land';

export function playTransitionSfxOnContext(
  ctx: AudioContext,
  destination: AudioNode,
  transition: SceneTransition = 'fade',
  volume: number = 0.65,
  intensity: TransitionIntensity = 'normal'
) {
  const now = ctx.currentTime;
  const timeScale =
    intensity === 'slow' ? 1.35 : intensity === 'fast' ? 0.72 : intensity === 'intense' ? 0.55 : 1.0;
  const volBoost = intensity === 'intense' ? 1.12 : intensity === 'slow' ? 0.92 : 1.0;
  const vol = Math.max(0.05, Math.min(1, volume * volBoost));

  if (transition === 'slide') {
    const dur = 0.38 * timeScale;
    const bufferSize = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, now);
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.16 * timeScale);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.36 * timeScale);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35 * vol, now + 0.12 * timeScale);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.37 * timeScale);

    noise.connect(filter);
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(0.7, now);
      panner.pan.linearRampToValueAtTime(-0.7, now + 0.34 * timeScale);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(destination);
    noise.start(now);
    noise.stop(now + dur);
    return;
  }

  if (transition === 'cut') {
    const osc = ctx.createOscillator();
    const clickOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1100, now);
    clickOsc.frequency.exponentialRampToValueAtTime(240, now + 0.05);

    gain.gain.setValueAtTime(0.38 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    clickOsc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    clickOsc.start(now);
    osc.stop(now + 0.17);
    clickOsc.stop(now + 0.06);
    return;
  }

  if (transition === 'zoom') {
    const osc = ctx.createOscillator();
    const shimmer = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.24 * timeScale);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.36 * timeScale);

    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(520, now);
    shimmer.frequency.exponentialRampToValueAtTime(1240, now + 0.26 * timeScale);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22 * vol, now + 0.14 * timeScale);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38 * timeScale);

    osc.connect(filter);
    shimmer.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(now);
    shimmer.start(now);
    osc.stop(now + 0.39 * timeScale);
    shimmer.stop(now + 0.39 * timeScale);
    return;
  }

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(293.66, now);
  osc1.frequency.exponentialRampToValueAtTime(440, now + 0.25 * timeScale);
  osc2.frequency.setValueAtTime(587.33, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(950, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.16 * vol, now + 0.15 * timeScale);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 * timeScale);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.46 * timeScale);
  osc2.stop(now + 0.46 * timeScale);
}

export function playSfxOnContext(
  ctx: AudioContext,
  destination: AudioNode,
  type: TrendingSfxId,
  volume: number = 0.75
) {
  const now = ctx.currentTime;
  const vol = Math.max(0.05, Math.min(1, volume));

  if (type === 'impact') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.58);
    gain.gain.setValueAtTime(0.55 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.7);
    return;
  }

  if (type === 'whoosh') {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.38 * vol, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.44);
    return;
  }

  if (type === 'ding') {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);
    osc2.frequency.setValueAtTime(2093, now);
    gain.gain.setValueAtTime(0.35 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.78);
    osc2.stop(now + 0.78);
    return;
  }

  if (type === 'glitch') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(250, now + 0.05);
    osc.frequency.setValueAtTime(1200, now + 0.1);
    osc.frequency.setValueAtTime(150, now + 0.15);
    gain.gain.setValueAtTime(0.28 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.27);
    return;
  }

  if (type === 'riser') {
    // Riser tension cinématique avant le Hook / Drop (Shorts & Reels)
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.85);
    sub.frequency.setValueAtTime(55, now);
    sub.frequency.exponentialRampToValueAtTime(220, now + 0.85);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + 0.85);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.32 * vol, now + 0.78);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.92);
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.94);
    sub.stop(now + 0.94);
    return;
  }

  if (type === 'shutter') {
    // Double clic appareil photo / flash arrêt sur image Reels
    const bufSize = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    [0, 0.075].forEach((offset) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1400, now + offset);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45 * vol, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      src.start(now + offset);
      src.stop(now + offset + 0.055);
    });
    return;
  }

  if (type === 'cash') {
    // Cha-Ching business / chiffre clé viral
    [1318.5, 1975.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = now + idx * 0.09;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0.36 * vol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.45);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + 0.48);
    });
    return;
  }

  if (type === 'record-stop') {
    // Scratch / arrêt vinyle plot twist
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.34);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.34);
    gain.gain.setValueAtTime(0.35 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }
}

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private isMusicPlaying: boolean = false;
  private isSpeaking: boolean = false;
  private baseMusicVolume: number = 0.25;
  private musicOscillators: (OscillatorNode | AudioNode)[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeTtsAudio: HTMLAudioElement | null = null;
  private activeTtsBoundaryTimer: any = null;
  private speechSessionId: number = 0;
  private beatInterval: any = null;
  private previewTimeout: any = null;
  private autoDuckingEnabled: boolean = true;
  private duckingReduction: number = 0.6;
  private currentMusicMood: string | null = null;
  private customVoices: Map<
    string,
    { baseVoiceId: string; pitch: number; rate: number; gender: 'homme' | 'femme' }
  > = new Map();

  private getEffectiveMusicGain(): number {
    if (this.isSpeaking && this.autoDuckingEnabled) {
      return this.baseMusicVolume * Math.max(0.08, 1 - this.duckingReduction);
    }
    return this.baseMusicVolume;
  }

  public configureDucking(enabled: boolean, reduction: number = 0.6) {
    this.autoDuckingEnabled = enabled;
    this.duckingReduction = Math.max(0, Math.min(0.92, reduction));
    if (this.musicGainNode && this.audioCtx && this.isMusicPlaying) {
      const targetGain = this.getEffectiveMusicGain();
      this.musicGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, this.audioCtx.currentTime);
      this.musicGainNode.gain.linearRampToValueAtTime(targetGain, this.audioCtx.currentTime + 0.14);
    }
  }

  public isMusicActive(mood?: string): boolean {
    if (!this.isMusicPlaying) return false;
    if (mood && this.currentMusicMood !== mood) return false;
    return true;
  }

  public registerCustomVoices(
    voices: Array<{
      id: string;
      baseVoiceId: string;
      pitch: number;
      rate: number;
      gender: 'homme' | 'femme';
    }>
  ) {
    this.customVoices.clear();
    for (const v of voices) {
      this.customVoices.set(v.id, {
        baseVoiceId: v.baseVoiceId,
        pitch: v.pitch,
        rate: v.rate,
        gender: v.gender,
      });
    }
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        this.musicGainNode = this.audioCtx.createGain();
        this.musicGainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        this.musicGainNode.connect(this.audioCtx.destination);
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public getAudioContext(): AudioContext | null {
    this.initAudioContext();
    return this.audioCtx;
  }

  public getMusicGainNode(): GainNode | null {
    this.initAudioContext();
    return this.musicGainNode;
  }

  private triggerDrumStep(ctx: AudioContext, dest: AudioNode, step: number, mood: string) {
    const now = ctx.currentTime;

    const triggerKick = (pitch = 135, dur = 0.22, level = 0.34) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + dur);
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };

    const triggerHat = (level = 0.07) => {
      const bufSize = Math.floor(ctx.sampleRate * 0.035);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(6500, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(dest);
      src.start(now);
      src.stop(now + 0.04);
    };

    const triggerNote = (freq: number, wave: OscillatorType, dur: number, level: number, cutoff = 1600) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };

    if (mood === 'phonk-drift') {
      // Phonk 808 + Cowbell viral motif
      if (step % 4 === 0) triggerKick(145, 0.24, 0.42);
      if (step % 2 === 1) triggerHat(0.065);
      const cowbell = [587.33, 587.33, 698.46, 523.25, 587.33, 440, 523.25, 587.33];
      if (step % 2 === 0 || step === 3 || step === 7) {
        triggerNote(cowbell[step % cowbell.length], 'square', 0.14, 0.09, 1900);
      }
    } else if (mood === 'afro-amapiano') {
      // Log drum rebondissante + groove afro
      if (step === 0 || step === 3 || step === 6) triggerKick(118, 0.2, 0.36);
      if (step % 2 === 1) triggerHat(0.055);
      const logNotes = [110, 130.81, 146.83, 130.81, 164.81, 146.83, 130.81, 98];
      if (step === 2 || step === 5 || step === 7) {
        triggerNote(logNotes[step % logNotes.length], 'triangle', 0.22, 0.24, 900);
      }
    } else if (mood === 'trap-motivation') {
      // Trap 808 lourd + hi-hats rapides
      if (step === 0 || step === 6) triggerKick(150, 0.3, 0.42);
      triggerHat(step % 2 === 0 ? 0.075 : 0.045);
      const arp = [220, 261.63, 329.63, 440, 392, 329.63, 293.66, 261.63];
      if (step % 2 === 0) {
        triggerNote(arp[step % arp.length], 'sawtooth', 0.18, 0.08, 1350);
      }
    } else if (mood === 'synthwave-reels') {
      // Basse synthwave 80s en croches
      if (step % 4 === 0) triggerKick(125, 0.18, 0.3);
      const bass = [110, 110, 130.81, 130.81, 98, 98, 123.47, 123.47];
      triggerNote(bass[step % bass.length], 'sawtooth', 0.16, 0.1, 820);
    } else if (mood === 'piano-story') {
      // Arpège piano doux storytelling
      const notes = [261.63, 329.63, 392, 493.88, 392, 329.63, 293.66, 349.23];
      if (step % 2 === 0) {
        triggerNote(notes[(step / 2) % notes.length], 'sine', 0.55, 0.16, 1500);
      }
    } else if (mood === 'dynamic') {
      if (step % 4 === 0) triggerKick(130, 0.18, 0.28);
      if (step % 2 === 1) triggerHat(0.05);
    }
  }

  // Jouer la musique de fond avec Web Audio API
  public playBackgroundMusic(mood: string, volume: number = 0.25) {
    this.stopBackgroundMusic();
    this.initAudioContext();
    if (!this.audioCtx || !this.musicGainNode) return;

    this.baseMusicVolume = Math.max(0, Math.min(1, volume));
    this.currentMusicMood = mood;
    const effectiveGain = this.getEffectiveMusicGain();
    this.musicGainNode.gain.setValueAtTime(effectiveGain, this.audioCtx.currentTime);
    this.isMusicPlaying = true;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Définition d'accords et ambiances selon le mood
    let baseFrequencies: number[] = [110, 164.8, 220, 277.18];
    let type: OscillatorType = 'sine';
    let filterCutoff = 650;
    let stepMs = 0;

    if (mood === 'suspense') {
      baseFrequencies = [55, 77.78, 110, 155.56];
      type = 'sawtooth';
      filterCutoff = 350;
    } else if (mood === 'dynamic') {
      baseFrequencies = [130.81, 196.0, 261.63, 329.63];
      type = 'triangle';
      stepMs = 235;
    } else if (mood === 'lofi') {
      baseFrequencies = [146.83, 174.61, 220, 261.63];
      type = 'sine';
      filterCutoff = 520;
    } else if (mood === 'ambient') {
      baseFrequencies = [82.41, 123.47, 164.81, 246.94];
      type = 'sine';
    } else if (mood === 'phonk-drift') {
      baseFrequencies = [73.42, 110, 146.83];
      type = 'sawtooth';
      filterCutoff = 420;
      stepMs = 215;
    } else if (mood === 'afro-amapiano') {
      baseFrequencies = [110, 164.81, 220];
      type = 'sine';
      filterCutoff = 540;
      stepMs = 260;
    } else if (mood === 'trap-motivation') {
      baseFrequencies = [55, 110, 164.81];
      type = 'triangle';
      filterCutoff = 480;
      stepMs = 210;
    } else if (mood === 'synthwave-reels') {
      baseFrequencies = [110, 164.81, 220, 329.63];
      type = 'sawtooth';
      filterCutoff = 620;
      stepMs = 250;
    } else if (mood === 'piano-story') {
      baseFrequencies = [130.81, 196.0, 261.63];
      type = 'sine';
      filterCutoff = 580;
      stepMs = 340;
    }

    // Création d'oscillateurs multi-couches pour un son riche et profond
    baseFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.2 + idx * 0.15, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(2.6, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      this.musicOscillators.push(lfo);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterCutoff, now);

      gain.gain.setValueAtTime((stepMs > 0 ? 0.08 : 0.12) / baseFrequencies.length, now);

      osc.connect(filter);
      filter.connect(gain);
      if (panner) {
        panner.pan.setValueAtTime(idx % 2 === 0 ? -0.4 : 0.4, now);
        gain.connect(panner);
        panner.connect(this.musicGainNode!);
      } else {
        gain.connect(this.musicGainNode!);
      }

      osc.start(now);
      this.musicOscillators.push(osc);
    });

    if (stepMs > 0 && this.musicGainNode) {
      let step = 0;
      this.triggerDrumStep(ctx, this.musicGainNode, step, mood);
      this.beatInterval = setInterval(() => {
        if (!this.audioCtx || !this.musicGainNode || !this.isMusicPlaying) return;
        step = (step + 1) % 8;
        this.triggerDrumStep(this.audioCtx, this.musicGainNode, step, mood);
      }, stepMs);
    }
  }

  // Pré-écouter un son tendance pendant 3.5 secondes
  public previewMusicMood(mood: string, volume: number = 0.35, onEnd?: () => void) {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.playBackgroundMusic(mood, volume);
    this.previewTimeout = setTimeout(() => {
      this.stopBackgroundMusic();
      this.previewTimeout = null;
      onEnd?.();
    }, 3500);
  }

  public setMusicVolume(volume: number) {
    this.baseMusicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGainNode && this.audioCtx) {
      const effectiveGain = this.getEffectiveMusicGain();
      this.musicGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, this.audioCtx.currentTime);
      this.musicGainNode.gain.linearRampToValueAtTime(
        effectiveGain,
        this.audioCtx.currentTime + 0.1
      );
    }
  }

  public stopBackgroundMusic() {
    if (this.beatInterval) {
      clearInterval(this.beatInterval);
      this.beatInterval = null;
    }
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.musicOscillators.forEach((osc: any) => {
      try {
        if (typeof osc.stop === 'function') {
          osc.stop();
        }
        if (typeof osc.disconnect === 'function') {
          osc.disconnect();
        }
      } catch (e) {
        // ignore
      }
    });
    this.musicOscillators = [];
    this.isMusicPlaying = false;
    this.currentMusicMood = null;
  }

  private applyDucking(active: boolean) {
    this.isSpeaking = active;
    if (this.musicGainNode && this.audioCtx) {
      this.musicGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, this.audioCtx.currentTime);
      this.musicGainNode.gain.linearRampToValueAtTime(
        active ? this.getEffectiveMusicGain() : this.baseMusicVolume,
        this.audioCtx.currentTime + (active ? 0.14 : 0.25)
      );
    }
  }

  private async playViaGeminiTts(
    text: string,
    voiceId: string,
    sessionId: number,
    options?: {
      rate?: number;
      volume?: number;
      onBoundary?: (charIndex: number, wordLength: number, word: string) => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1500), voiceId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.audioBase64 || sessionId !== this.speechSessionId) return false;

      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audio.volume = options?.volume !== undefined ? Math.max(0, Math.min(1, options.volume)) : 1.0;
      if (options?.rate) {
        audio.playbackRate = Math.max(0.6, Math.min(1.8, options.rate));
      }
      this.activeTtsAudio = audio;
      this.applyDucking(true);

      // Simulate word boundary tracking during WAV playback for animated captions
      if (options?.onBoundary) {
        const wordMatches = Array.from(text.matchAll(/\S+/g));
        let wordIdx = 0;
        const startTimer = () => {
          if (this.activeTtsBoundaryTimer) clearInterval(this.activeTtsBoundaryTimer);
          const totalWords = Math.max(1, wordMatches.length);
          const durationMs =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? (audio.duration * 1000) / audio.playbackRate
              : Math.max(1500, totalWords * 340);
          const stepMs = Math.max(90, Math.floor(durationMs / totalWords));
          this.activeTtsBoundaryTimer = setInterval(() => {
            if (sessionId !== this.speechSessionId || wordIdx >= wordMatches.length) {
              if (this.activeTtsBoundaryTimer) {
                clearInterval(this.activeTtsBoundaryTimer);
                this.activeTtsBoundaryTimer = null;
              }
              return;
            }
            const m = wordMatches[wordIdx];
            options.onBoundary?.(m.index ?? 0, m[0].length, m[0]);
            wordIdx += 1;
          }, stepMs);
        };
        audio.addEventListener('loadedmetadata', startTimer, { once: true });
      }

      audio.onended = () => {
        if (this.activeTtsBoundaryTimer) {
          clearInterval(this.activeTtsBoundaryTimer);
          this.activeTtsBoundaryTimer = null;
        }
        this.activeTtsAudio = null;
        this.applyDucking(false);
        if (sessionId === this.speechSessionId) {
          options?.onEnd?.();
        }
      };

      audio.onerror = (e) => {
        if (this.activeTtsBoundaryTimer) {
          clearInterval(this.activeTtsBoundaryTimer);
          this.activeTtsBoundaryTimer = null;
        }
        this.activeTtsAudio = null;
        this.applyDucking(false);
        if (sessionId === this.speechSessionId) {
          options?.onError?.(e);
        }
      };

      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  // Synthèse vocale naturelle (Web Speech API + fallback Gemini TTS haute fidélité)
  public speakText(
    text: string,
    voiceId: string,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      preferGeminiTts?: boolean;
      onBoundary?: (charIndex: number, wordLength: number, word: string) => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): SpeechSynthesisUtterance | null {
    if (!text.trim() || options?.volume === 0) {
      this.stopSpeech();
      options?.onEnd?.();
      return null;
    }

    this.stopSpeech();
    const sessionId = ++this.speechSessionId;

    const customProfile = this.customVoices.get(voiceId);
    const effectiveBaseVoice = customProfile ? customProfile.baseVoiceId : voiceId;

    const hasBrowserSpeech =
      typeof window !== 'undefined' &&
      Boolean(window.speechSynthesis) &&
      typeof SpeechSynthesisUtterance !== 'undefined';
    const voices = hasBrowserSpeech ? window.speechSynthesis.getVoices() : [];

    // Utiliser Gemini TTS directement si demandé ou si le navigateur n'a aucune voix disponible
    if (options?.preferGeminiTts || !hasBrowserSpeech || voices.length === 0) {
      this.playViaGeminiTts(text, effectiveBaseVoice, sessionId, options).then((played) => {
        if (!played && sessionId === this.speechSessionId) {
          if (hasBrowserSpeech) {
            // Dernier recours : tenter speechSynthesis même si getVoices() était vide
            this.speakWithBrowserSynthesis(text, voiceId, sessionId, options);
          } else {
            options?.onEnd?.();
          }
        }
      });
      return null;
    }

    return this.speakWithBrowserSynthesis(text, voiceId, sessionId, options);
  }

  private speakWithBrowserSynthesis(
    text: string,
    voiceId: string,
    sessionId: number,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      onBoundary?: (charIndex: number, wordLength: number, word: string) => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): SpeechSynthesisUtterance | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      options?.onEnd?.();
      return null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    this.applyDucking(true);

    const customProfile = this.customVoices.get(voiceId);
    const effectiveBaseVoice = customProfile ? customProfile.baseVoiceId : voiceId;

    let rate = options?.rate ?? (customProfile ? customProfile.rate : 1.05);
    let pitch = options?.pitch ?? (customProfile ? customProfile.pitch : 1.0);

    if (!customProfile) {
      if (effectiveBaseVoice === 'thomas') {
        pitch = options?.pitch ?? 0.85;
        if (options?.rate === undefined) rate = 0.95;
      } else if (effectiveBaseVoice === 'chloe') {
        pitch = options?.pitch ?? 1.15;
        if (options?.rate === undefined) rate = 1.12;
      } else if (effectiveBaseVoice === 'sarah') {
        pitch = options?.pitch ?? 1.05;
        if (options?.rate === undefined) rate = 0.98;
      } else if (effectiveBaseVoice === 'alex') {
        pitch = options?.pitch ?? 0.9;
        if (options?.rate === undefined) rate = 1.0;
      } else {
        pitch = options?.pitch ?? 0.98;
        if (options?.rate === undefined) rate = 1.05;
      }
    }

    utterance.lang = 'fr-FR';
    utterance.rate = Math.max(0.5, Math.min(2.0, rate));
    utterance.pitch = Math.max(0.5, Math.min(2.0, pitch));
    utterance.volume = options?.volume !== undefined ? options?.volume : 1.0;

    const voices = window.speechSynthesis.getVoices();
    const isFemale = customProfile
      ? customProfile.gender === 'femme'
      : effectiveBaseVoice === 'chloe' || effectiveBaseVoice === 'sarah';

    const matchedVoice =
      voices.find((v) => {
        const nameLower = v.name.toLowerCase();
        const isFrench = v.lang.startsWith('fr') || v.lang.includes('FR');
        if (!isFrench) return false;
        if (isFemale) {
          return (
            nameLower.includes('female') ||
            nameLower.includes('audrey') ||
            nameLower.includes('amelie') ||
            nameLower.includes('hortense') ||
            nameLower.includes('julie')
          );
        }
        return (
          nameLower.includes('male') ||
          nameLower.includes('thomas') ||
          nameLower.includes('nicolas') ||
          nameLower.includes('paul')
        );
      }) ||
      voices.find((v) => v.lang.startsWith('fr')) ||
      voices[0];

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    const startedAt = Date.now();
    let gotBoundary = false;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        gotBoundary = true;
        const charIdx = event.charIndex;
        const remaining = text.slice(charIdx);
        const match = remaining.match(/^(\S+)/);
        const word = match ? match[1] : '';
        options?.onBoundary?.(charIdx, word.length, word);
      }
    };

    utterance.onend = () => {
      const elapsed = Date.now() - startedAt;
      this.currentUtterance = null;
      // Si le navigateur a terminé instantanément sans rien prononcer (< 120ms sur un texte > 8 chars), basculer sur Gemini TTS
      if (!gotBoundary && elapsed < 120 && text.trim().length > 8 && sessionId === this.speechSessionId) {
        this.playViaGeminiTts(text, effectiveBaseVoice, sessionId, options).then((played) => {
          if (!played && sessionId === this.speechSessionId) {
            this.applyDucking(false);
            options?.onEnd?.();
          }
        });
        return;
      }
      this.applyDucking(false);
      if (sessionId === this.speechSessionId) {
        options?.onEnd?.();
      }
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      if (e.error === 'interrupted' || e.error === 'canceled') {
        this.applyDucking(false);
        return;
      }
      if (sessionId === this.speechSessionId) {
        this.playViaGeminiTts(text, effectiveBaseVoice, sessionId, options).then((played) => {
          if (!played && sessionId === this.speechSessionId) {
            this.applyDucking(false);
            options?.onError?.(e);
          }
        });
      }
    };

    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  public stopSpeech() {
    this.speechSessionId += 1;
    this.isSpeaking = false;
    if (this.activeTtsBoundaryTimer) {
      clearInterval(this.activeTtsBoundaryTimer);
      this.activeTtsBoundaryTimer = null;
    }
    if (this.activeTtsAudio) {
      try {
        this.activeTtsAudio.pause();
        this.activeTtsAudio.src = '';
      } catch {
        // ignore
      }
      this.activeTtsAudio = null;
    }
    if (this.musicGainNode && this.audioCtx && this.isMusicPlaying) {
      this.musicGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, this.audioCtx.currentTime);
      this.musicGainNode.gain.linearRampToValueAtTime(
        this.baseMusicVolume,
        this.audioCtx.currentTime + 0.22
      );
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public pause() {
    if (this.activeTtsAudio && !this.activeTtsAudio.paused) {
      this.activeTtsAudio.pause();
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  public resume() {
    if (this.activeTtsAudio && this.activeTtsAudio.paused) {
      this.activeTtsAudio.play().catch(() => {});
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Effet sonore automatique synchronisé sur le type de transition et son intensité
  public playTransitionSfx(
    transition: SceneTransition = 'fade',
    volume: number = 0.65,
    intensity: TransitionIntensity = 'normal'
  ) {
    this.initAudioContext();
    if (!this.audioCtx) return;
    playTransitionSfxOnContext(this.audioCtx, this.audioCtx.destination, transition, volume, intensity);
  }

  // Effets sonores synthétisés en direct avec Web Audio API
  public playSfx(type: SfxSoundType, volume: number = 0.75) {
    if (type === 'eagle_cry') {
      // VRAI CRI ENREGISTRÉ DE L'AIGLE (Audio Réel Haute Fidélité)
      this.playRealEagleCry('screech');
      return;
    }

    this.initAudioContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type !== 'eagle_land') {
      playSfxOnContext(ctx, ctx.destination, type, volume);
      return;
    } else if (type === 'eagle_land') {
      // Bruitage d'atterrissage : souffle d'air + battement de plumes + impact doux
      // 1. Souffle de vent
      const whooshOsc = ctx.createOscillator();
      const whooshFilter = ctx.createBiquadFilter();
      const whooshGain = ctx.createGain();
      whooshOsc.type = 'triangle';
      whooshOsc.frequency.setValueAtTime(120, now);
      whooshOsc.frequency.linearRampToValueAtTime(320, now + 0.2);
      whooshOsc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
      whooshFilter.type = 'lowpass';
      whooshFilter.frequency.setValueAtTime(500, now);
      whooshGain.gain.setValueAtTime(0.01, now);
      whooshGain.gain.linearRampToValueAtTime(0.25, now + 0.15);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      whooshOsc.connect(whooshFilter);
      whooshFilter.connect(whooshGain);
      whooshGain.connect(ctx.destination);
      whooshOsc.start(now);
      whooshOsc.stop(now + 0.6);

      // 2. Impact doux des serres sur le perchoir
      const tapOsc = ctx.createOscillator();
      const tapGain = ctx.createGain();
      tapOsc.type = 'sine';
      tapOsc.frequency.setValueAtTime(110, now + 0.18);
      tapOsc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
      tapGain.gain.setValueAtTime(0.001, now);
      tapGain.gain.setValueAtTime(0.3, now + 0.18);
      tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      tapOsc.connect(tapGain);
      tapGain.connect(ctx.destination);
      tapOsc.start(now + 0.18);
      tapOsc.stop(now + 0.42);
    }
  }

  // Lecture de l'enregistrement authentique du cri de l'aigle royal (screech ou call)
  public playRealEagleCry(variant: 'screech' | 'call' = 'screech') {
    try {
      const src = variant === 'screech'
        ? '/assets/audio/eagle_screech.ogg'
        : '/assets/audio/bald_eagle_call.ogg';

      const audio = new Audio(src);
      audio.volume = 0.95;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Lecture du cri de l\'aigle empêchée par la politique du navigateur:', err);
        });
      }
    } catch (e) {
      console.warn('Erreur lecture audio aigle:', e);
    }
  }

  public stopAll() {
    this.stopSpeech();
    this.stopBackgroundMusic();
  }
}

export const audioEngine = new AudioEngine();
