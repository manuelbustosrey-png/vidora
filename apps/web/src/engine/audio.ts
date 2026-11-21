import type { Project } from '@/types';
import { getRuntime } from '@/lib/assets';

const MIDI: Record<string, number> = {};
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (let oct = 0; oct <= 8; oct++) {
  NOTES.forEach((n, i) => { MIDI[`${n}${oct}`] = 12 * (oct + 1) + i; });
}
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Mood = Project['music']['mood'];

interface MoodConfig {
  bpm: number;
  bars: number[][];
  bass: number[];
  wave: OscillatorType;
  cutoff: number;
  pad: number;
  detune: number;
  drums?: boolean;
  arp?: boolean;
  reverse?: boolean;
}

const MOODS: Record<Mood, MoodConfig> = {
  cinematic: {
    bpm: 62,
    bars: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 55, 60],
      [55, 59, 62],
    ],
    bass: [33, 29, 24, 31],
    wave: 'sine',
    cutoff: 1200,
    pad: 0.5,
    detune: 6,
  },
  ambient: {
    bpm: 48,
    bars: [
      [48, 55, 59, 64],
      [50, 57, 60, 65],
      [43, 50, 55, 59],
      [45, 52, 57, 60],
    ],
    bass: [24, 26, 19, 21],
    wave: 'sine',
    cutoff: 900,
    pad: 0.65,
    detune: 9,
  },
  lofi: {
    bpm: 74,
    bars: [
      [50, 53, 57, 60],
      [55, 59, 62, 65],
      [48, 52, 55, 59],
      [45, 48, 52, 55],
    ],
    bass: [26, 31, 24, 21],
    wave: 'triangle',
    cutoff: 1600,
    pad: 0.42,
    detune: 4,
  },
  epic: {
    bpm: 58,
    bars: [
      [48, 55, 60, 64],
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [48, 55, 60, 64],
    ],
    bass: [24, 26, 22, 24],
    wave: 'sawtooth',
    cutoff: 1100,
    pad: 0.36,
    detune: 8,
  },
  electronic: {
    bpm: 96,
    bars: [
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ],
    bass: [33, 29, 36, 31],
    wave: 'sawtooth',
    cutoff: 1800,
    pad: 0.22,
    detune: 5,
    drums: true,
    arp: true,
  },
  rock: {
    bpm: 92,
    bars: [
      [55, 60, 64],
      [52, 57, 60],
      [55, 59, 62],
      [53, 57, 60],
    ],
    bass: [43, 48, 50, 45],
    wave: 'square',
    cutoff: 2200,
    pad: 0.34,
    detune: 8,
    drums: true,
    arp: true,
    reverse: true,
  },
  jazz: {
    bpm: 100,
    bars: [
      [55, 59, 62],
      [52, 55, 59],
      [50, 52, 55],
      [53, 57, 60],
    ],
    bass: [41, 45, 47, 38],
    wave: 'triangle',
    cutoff: 1100,
    pad: 0.3,
    detune: 6,
    drums: false,
    arp: true,
    reverse: false,
  },
  piano: {
    bpm: 70,
    bars: [
      [57, 62, 64],
      [53, 57, 62],
      [50, 57, 62],
      [48, 53, 55],
    ],
    bass: [40, 42, 34, 33],
    wave: 'triangle',
    cutoff: 2600,
    pad: 0.18,
    detune: 4,
    drums: false,
    arp: true,
    reverse: true,
  },
  latin: {
    bpm: 108,
    bars: [
      [52, 56, 59],
      [48, 52, 55],
      [55, 59, 62],
      [53, 57, 60],
    ],
    bass: [35, 38, 33, 31],
    wave: 'square',
    cutoff: 1600,
    pad: 0.28,
    detune: 6,
    drums: true,
    arp: true,
  },
};

interface CachedSource {
  el: HTMLAudioElement;
  node: MediaElementAudioSourceNode;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  dest: MediaStreamAudioDestinationNode | null = null;
  private sources = new Map<string, CachedSource>();
  private timers: number[] = [];
  private scheduler: number | null = null;
  private startedAt = 0;
  private offset = 0;
  private project: Project | null = null;
  private exportMode = false;
  private stopping = false;
  private scheduledUntil = 0;
  muted = false;

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ sampleRate: 48000 });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.dest);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  async start(project: Project, offset = 0, opts: { export?: boolean } = {}): Promise<void> {
    this.stop();
    this.project = project;
    this.offset = Math.max(0, offset);
    this.exportMode = Boolean(opts.export);
    this.stopping = false;
    const ctx = await this.ensureContext();
    this.startedAt = ctx.currentTime;
    if (this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(0.9, ctx.currentTime);
    }
    if (this.muted) this.master!.gain.value = 0.0001;
    if (project.music.enabled) {
      if (this.musicGain) this.musicGain.gain.value = Math.max(0, Math.min(1, project.music.volume)) * 0.32;
      this.startMusic(project);
    }
    this.startAudioClips(project);
  }

  private startMusic(project: Project) {
    if (!this.ctx || !this.musicGain) return;
    const cfg = MOODS[project.music.mood] || MOODS.cinematic;
    const beat = 60 / cfg.bpm;
    const barLen = beat * 4;
    const end = project.duration;
    const startOffset = this.offset;
    this.scheduledUntil = Math.floor(startOffset / barLen) * barLen;
    const scheduleBar = (barIndex: number) => {
      if (!this.ctx || !this.musicGain) return;
      const barStart = barIndex * barLen;
      if (barStart >= end) return;
      const when = this.startedAt + (barStart - startOffset);
      if (when < this.ctx.currentTime - 0.2) return;
      const chord = cfg.bars[((barIndex % cfg.bars.length) + cfg.bars.length) % cfg.bars.length];
      const bass = cfg.bass[((barIndex % cfg.bass.length) + cfg.bass.length) % cfg.bass.length];

      // pad voices
      chord.forEach((midi, i) => {
        if (!this.ctx || !this.musicGain) return;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cfg.cutoff;
        filter.Q.value = 0.4;
        osc.type = cfg.wave;
        osc2.type = cfg.wave;
        osc.frequency.value = freq(midi);
        osc2.frequency.value = freq(midi);
        osc.detune.value = -cfg.detune;
        osc2.detune.value = cfg.detune;
        const dur = barLen * 1.6;
        const peak = (cfg.pad / Math.max(3, chord.length)) * (i === chord.length - 1 ? 1 : 0.8);
        const t0 = Math.max(when, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + Math.min(1.6, dur * 0.35));
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t0);
        osc2.start(t0);
        osc.stop(t0 + dur + 0.1);
        osc2.stop(t0 + dur + 0.1);
      });

      // bass
      if (bass) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq(bass);
        const t0 = Math.max(when, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + barLen * 1.3);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t0);
        osc.stop(t0 + barLen * 1.35);
      }

      if (cfg.drums) this.playDrums(barIndex, barLen, when, cfg);
      if (cfg.arp) this.scheduleArp(barIndex, barLen, when, cfg);
    };

    const tick = () => {
      if (!this.ctx || !this.project) return;
      const elapsed = this.ctx.currentTime - this.startedAt + this.offset;
      const lookahead = 2.5;
      while (this.scheduledUntil < elapsed + lookahead && this.scheduledUntil < this.project.duration) {
        scheduleBar(Math.round(this.scheduledUntil / barLen));
        this.scheduledUntil += barLen;
      }
    };
    tick();
    this.scheduler = window.setInterval(tick, 700);
  }

  private playDrums(barIndex: number, barLen: number, when: number, cfg: MoodConfig) {
    if (!this.ctx || !this.musicGain) return;
    const beat = barLen / 4;
    const half = beat / 2;

    const kick = (t: number) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.1);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.1);
    };
    kick(when);
    kick(when + 2 * half);

    for (let i = 0; i < 8; i++) {
      const t = when + i * half * 0.5;
      const isHat = i % 2 === 0;
      const pitch = isHat ? 900 + Math.random() * 700 : 45 + Math.random() * 15;
      const dur = isHat ? 0.07 : 0.18;
      const amp = isHat ? 0.035 : (i === 3 || i === 7 ? 0.09 : 0.05);
      this.addClick(t, pitch, dur, amp);
    }
    if (barIndex % 4 === 2 && !cfg.arp) return;
  }

  private addClick(at: number, pitch: number, dur: number, amp: number) {
    if (!this.ctx || !this.musicGain || at < this.ctx.currentTime - 0.01) return;
    const t0 = Math.max(at, this.ctx.currentTime + 0.002);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    const lp = this.ctx.createBiquadFilter();
    osc.type = 'square';
    osc.frequency.setValueAtTime(pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.25, t0 + 0.05);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.05, t0 + dur);
    bp.type = 'highpass';
    bp.frequency.value = 1200;
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    g.gain.setValueAtTime(amp * 0.001, t0);
    g.gain.exponentialRampToValueAtTime(amp, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(amp * 0.3, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  private scheduleArp(barIndex: number, barLen: number, when: number, cfg: MoodConfig) {
    if (!this.ctx || !this.musicGain) return;
    const chord = cfg.bars[((barIndex % cfg.bars.length) + cfg.bars.length) % cfg.bars.length];
    const notes = [...chord].map((m) => freq(m)).sort((a, b) => (cfg.reverse ? b - a : a - b));
    const t0 = Math.max(when, this.ctx.currentTime + 0.002);
    const dur = barLen * 1.05;
    const steps = Math.max(3, notes.length);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.cutoff;
    osc.type = 'sawtooth';
    for (let i = 0; i < steps; i++) {
      const startT = t0 + (dur / steps) * i;
      const endT = t0 + (dur / steps) * (i + 1);
      if (i === 0) osc.frequency.setValueAtTime(notes[0], startT);
      osc.frequency.setValueAtTime(notes[Math.min(i, notes.length - 1)], startT);
      if (i > 0) osc.frequency.linearRampToValueAtTime(notes[Math.min(i, notes.length - 1)], startT);
      osc.frequency.linearRampToValueAtTime(notes[Math.min(i + 1, notes.length - 1)], endT);
    }
    g.gain.setValueAtTime(0.0002, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  private getSource(assetId: string): CachedSource | null {
    if (!this.ctx || !this.master) return null;
    const rt = getRuntime(assetId);
    if (!rt?.audio) return null;
    let cached = this.sources.get(assetId);
    if (!cached) {
      try {
        const node = this.ctx.createMediaElementSource(rt.audio);
        const gain = this.ctx.createGain();
        node.connect(gain);
        gain.connect(this.master);
        rt.audio.loop = false;
        cached = { el: rt.audio, node };
        this.sources.set(assetId, cached);
      } catch {
        return null;
      }
    }
    return cached;
  }

  private startAudioClips(project: Project) {
    if (!this.ctx || !this.master || !this.project) return;
    const elapsedToCtx = (t: number) => this.startedAt + (t - this.offset);
    for (const clip of project.clips) {
      if (clip.kind !== 'audio') continue;
      if (clip.trackId) {
        const track = project.tracks.find((t) => t.id === clip.trackId);
        if (track?.muted) continue;
      }
      if (clip.start + clip.duration <= this.offset) continue;
      const src = this.getSource(clip.assetId);
      if (!src) continue;
      const el = src.el;
      el.volume = Math.max(0, Math.min(1, clip.volume ?? 1));
      el.loop = false;

      const startDelay = Math.max(0, clip.start - this.offset);
      const activeOffset = Math.max(0, this.offset - clip.start);
      const run = () => {
        if (this.stopping) return;
        try {
          el.currentTime = Math.max(0, clip.inPoint + activeOffset);
        } catch { /* noop */ }
        el.play().catch(() => {});
        const remain = Math.max(0, clip.duration - activeOffset);
        const stopAt = performance.now() + remain * 1000;
        const t = window.setTimeout(() => {
          if (el.currentTime > 0) el.pause();
        }, Math.max(0, stopAt - performance.now()));
        this.timers.push(t);
        const when = elapsedToCtx(clip.start + clip.duration);
        if (this.ctx) {
          // quick fade at clip end to avoid clicks
          const fade = Math.min(0.4, remain * 0.2);
          try {
            el.volume = Math.max(0, Math.min(1, clip.volume ?? 1));
            const fadeStart = when - fade;
            if (fadeStart > this.ctx.currentTime) {
              this.timers.push(window.setTimeout(() => { el.volume = 0; }, (fadeStart - this.ctx.currentTime) * 1000));
            }
          } catch { /* noop */ }
        }
      };
      if (startDelay === 0) run();
      else this.timers.push(window.setTimeout(run, startDelay * 1000));
    }
  }

  getStream(): MediaStream | null {
    return this.dest?.stream || null;
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.9, this.ctx.currentTime + 0.08);
  }

  stop(): void {
    this.stopping = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.scheduler !== null) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    for (const [, src] of this.sources) {
      try { src.el.pause(); } catch { /* noop */ }
    }
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.muted ? 0.0001 : 0.9, t);
    }
    this.project = null;
    this.exportMode = false;
  }

  destroy(): void {
    this.stop();
    this.sources.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.dest = null;
    }
  }
}

export const previewAudio = new AudioEngine();
