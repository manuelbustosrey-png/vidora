export type TrackType = 'video' | 'overlay' | 'text' | 'audio';

export type SceneTemplate =
  | 'aurora'
  | 'nebula'
  | 'grid'
  | 'particles'
  | 'waves'
  | 'spotlight'
  | 'skyline'
  | 'editorial';

export type Motion = 'kenburns' | 'parallax' | 'zoom-in' | 'zoom-out' | 'static';

export type TextAnimation = 'fade' | 'slide-up' | 'typewriter' | 'pop' | 'none';

export type MusicMood = 'cinematic' | 'ambient' | 'lofi' | 'epic' | 'electronic' | 'rock' | 'jazz' | 'piano' | 'latin';

export const MUSIC_MOODS: MusicMood[] = ['cinematic', 'ambient', 'lofi', 'epic', 'electronic', 'rock', 'jazz', 'piano', 'latin'];

export const MUSIC_MOOD_LABELS: Record<MusicMood, string> = {
  cinematic: 'Cinematográfico',
  ambient: 'Ambient',
  lofi: 'Lo-fi',
  epic: 'Épico',
  electronic: 'Electrónico',
  rock: 'Rock',
  jazz: 'Jazz',
  piano: 'Piano / balada',
  latin: 'Latino',
};

export type AspectId = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export interface AspectPreset {
  id: AspectId;
  label: string;
  width: number;
  height: number;
  ratio: number;
}

export const ASPECTS: Record<AspectId, AspectPreset> = {
  '16:9': { id: '16:9', label: '16:9 · Horizontal', width: 1920, height: 1080, ratio: 16 / 9 },
  '9:16': { id: '9:16', label: '9:16 · Reels / Shorts', width: 1080, height: 1920, ratio: 9 / 16 },
  '1:1': { id: '1:1', label: '1:1 · Cuadrado', width: 1080, height: 1080, ratio: 1 },
  '4:5': { id: '4:5', label: '4:5 · Feed', width: 1080, height: 1350, ratio: 4 / 5 },
  '21:9': { id: '21:9', label: '21:9 · Cine', width: 2560, height: 1080, ratio: 21 / 9 },
};

export interface ClipFilter {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
  hue: number;
}

export interface BaseClip {
  id: string;
  trackId: string;
  name: string;
  start: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  opacity: number;
  filter: ClipFilter;
  volume?: number;
}

export interface SceneClip extends BaseClip {
  kind: 'scene';
  template: SceneTemplate;
  palette: string[];
  title: string;
  subtitle: string;
  motion: Motion;
  showText: boolean;
  seed: number;
}

export interface MediaClip extends BaseClip {
  kind: 'media';
  assetId: string;
  fit: 'cover' | 'contain';
  inPoint: number;
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

export interface TextClip extends BaseClip {
  kind: 'text';
  text: string;
  fontFamily: 'Sora' | 'Instrument Serif';
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  x: number;
  y: number;
  animation: TextAnimation;
  uppercase: boolean;
  letterSpacing: number;
  background: boolean;
  width: number;
}

export interface AudioClip extends BaseClip {
  kind: 'audio';
  assetId: string;
  inPoint: number;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
}

export type Clip = SceneClip | MediaClip | TextClip | AudioClip;

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface MusicSettings {
  enabled: boolean;
  mood: MusicMood;
  volume: number;
}

export interface Project {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  aspect: AspectId;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
  grain: number;
  vignette: boolean;
  music: MusicSettings;
  tracks: Track[];
  clips: Clip[];
  cover?: string;
  aiGenerated?: boolean;
}

export interface AssetMeta {
  id: string;
  projectId?: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  mime: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface AssetRuntime {
  meta: AssetMeta;
  url: string;
  image?: HTMLImageElement;
  video?: HTMLVideoElement;
  audio?: HTMLAudioElement;
}

export interface StoryboardScene {
  title: string;
  subtitle: string;
  template: SceneTemplate;
  palette: string[];
  duration: number;
  motion: Motion;
  voiceover?: string;
}

export interface Storyboard {
  title: string;
  logline: string;
  style: string;
  mood: MusicMood;
  scenes: StoryboardScene[];
  fallback?: boolean;
}

export interface AiSettings {
  endpoint: string;
  model: string;
  temperature: number;
  timeout: number;
}

export interface Settings {
  ai: AiSettings;
  author: string;
  defaultAspect: AspectId;
  defaultMinutes: number;
  repoUrl: string;
  appUrl: string;
  reduceMotion: boolean;
}

export type ExportFormat = 'auto' | 'mp4' | 'webm';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  minutes: number;
  quality: 'standard' | 'high' | 'ultra';
  format: ExportFormat;
}

export interface DesktopCommand {
  action:
    | 'generate'
    | 'set_duration'
    | 'play'
    | 'pause'
    | 'export'
    | 'add_text'
    | 'add_scene'
    | 'open_panel'
    | 'set_mood'
    | 'set_landscape'
    | 'new_project'
    | 'get_state';
  payload?: Record<string, unknown>;
}
