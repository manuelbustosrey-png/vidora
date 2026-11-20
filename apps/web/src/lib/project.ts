import type { AspectId, Clip, Motion, Project, SceneClip, SceneTemplate, Storyboard, Track, TrackType } from '@/types';
import { ASPECTS } from '@/types';
import { uid } from './utils';

export const TRACK_ORDER: TrackType[] = ['video', 'overlay', 'text', 'audio'];

export const TRACK_META: Record<TrackType, { label: string; color: string; icon: string }> = {
  video: { label: 'Video', color: '#ff6a3d', icon: 'film' },
  overlay: { label: 'Overlay', color: '#8b5cf6', icon: 'layers' },
  text: { label: 'Texto', color: '#38bdf8', icon: 'type' },
  audio: { label: 'Audio', color: '#34d399', icon: 'music' },
};

export function makeTrack(type: TrackType, name?: string): Track {
  return {
    id: uid('trk'),
    type,
    name: name || TRACK_META[type].label,
    muted: false,
    hidden: false,
    locked: false,
  };
}

export function makeSceneClip(trackId: string, start: number, duration: number, scene: Partial<SceneClip> = {}): SceneClip {
  return {
    id: uid('clip'),
    trackId,
    kind: 'scene',
    name: scene.title || scene.template || 'Escena IA',
    start,
    duration,
    fadeIn: 0.5,
    fadeOut: 0.5,
    opacity: 1,
    filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
    template: 'aurora',
    palette: ['#ff6a3d', '#8b5cf6', '#101018'],
    title: '',
    subtitle: '',
    motion: 'kenburns',
    showText: true,
    seed: Math.floor(Math.random() * 10000),
    ...scene,
  };
}

export interface CreateProjectOptions {
  name?: string;
  prompt?: string;
  minutes?: number;
  aspect?: AspectId;
  aiGenerated?: boolean;
  scene?: boolean;
}

export function createProject(opts: CreateProjectOptions = {}): Project {
  const aspect = opts.aspect || '16:9';
  const size = ASPECTS[aspect];
  const duration = Math.max(10, (opts.minutes || 2) * 60);
  const tracks = TRACK_ORDER.map((t) => makeTrack(t));
  const videoTrack = tracks[0];
  const clips: Clip[] = [];
  if (opts.scene !== false) {
    clips.push(
      makeSceneClip(videoTrack.id, 0, Math.min(8, duration), {
        title: opts.prompt ? opts.prompt.slice(0, 80) : 'Tu primera escena',
        subtitle: 'Escribe un prompt y deja que Vidora dirija',
        palette: ['#ff6a3d', '#8b5cf6', '#0b0b14'],
        motion: 'kenburns',
        template: 'aurora',
      })
    );
  }
  return {
    id: uid('prj'),
    name: opts.name || 'Proyecto sin título',
    prompt: opts.prompt || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    aspect,
    width: size.width,
    height: size.height,
    fps: 30,
    duration,
    background: '#050508',
    grain: 18,
    vignette: true,
    music: { enabled: true, mood: 'cinematic', volume: 0.4 },
    tracks,
    clips,
    aiGenerated: opts.aiGenerated || false,
  };
}

const TEMPLATES: SceneTemplate[] = ['aurora', 'nebula', 'grid', 'particles', 'waves', 'spotlight', 'skyline', 'editorial'];
const MOTIONS: Motion[] = ['kenburns', 'parallax', 'zoom-in', 'zoom-out', 'static'];

const PALETTES: string[][] = [
  ['#ff6a3d', '#ff3d77', '#0a0a12'],
  ['#22d3ee', '#6366f1', '#05070f'],
  ['#f59e0b', '#ef4444', '#0b0705'],
  ['#34d399', '#0ea5e9', '#04100d'],
  ['#e879f9', '#8b5cf6', '#0d0614'],
  ['#f472b6', '#facc15', '#140810'],
  ['#e2e8f0', '#94a3b8', '#08080c'],
];

export function storyboardToProject(sb: Storyboard, opts: { minutes?: number; aspect?: AspectId; name?: string; prompt?: string }): Project {
  const aspect = opts.aspect || '16:9';
  const size = ASPECTS[aspect];
  const total = Math.max(10, (opts.minutes || Math.max(1, Math.round(sb.scenes.reduce((a, s) => a + s.duration, 0) / 60))) * 60);
  const tracks = TRACK_ORDER.map((t) => makeTrack(t));
  const video = tracks[0];
  const overlay = tracks[1];
  const text = tracks[2];
  const audio = tracks[3];
  const clips: Clip[] = [];

  const sceneTotal = sb.scenes.reduce((a, s) => a + (s.duration || 5), 0) || 1;
  const scale = total / sceneTotal;
  let cursor = 0;
  const count = sb.scenes.length || 1;

  sb.scenes.forEach((scene, i) => {
    const dur = Math.max(1.5, (scene.duration || 5) * scale);
    clips.push(
      makeSceneClip(video.id, cursor, dur, {
        name: scene.title || `Escena ${i + 1}`,
        template: TEMPLATES.includes(scene.template) ? scene.template : 'aurora',
        palette: scene.palette?.length >= 2 ? scene.palette : PALETTES[i % PALETTES.length],
        title: scene.title || '',
        subtitle: scene.subtitle || '',
        motion: MOTIONS.includes(scene.motion) ? scene.motion : 'kenburns',
        showText: true,
        seed: i * 733 + 17,
      })
    );
    cursor += dur;
  });

  // Intro title card
  clips.push({
    id: uid('clip'),
    trackId: text.id,
    kind: 'text',
    name: 'Título principal',
    start: 0.6,
    duration: Math.min(4.5, total * 0.16),
    fadeIn: 0.4,
    fadeOut: 0.6,
    opacity: 1,
    filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
    text: sb.title,
    fontFamily: 'Instrument Serif',
    fontSize: 108,
    fontWeight: 400,
    color: '#ffffff',
    align: 'center',
    x: 0.5,
    y: 0.44,
    animation: 'slide-up',
    uppercase: false,
    letterSpacing: -1,
    background: false,
    width: 0.78,
  });

  clips.push({
    id: uid('clip'),
    trackId: text.id,
    kind: 'text',
    name: 'Logline',
    start: 1.4,
    duration: Math.min(3.6, total * 0.12),
    fadeIn: 0.4,
    fadeOut: 0.4,
    opacity: 0.9,
    filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
    text: sb.logline,
    fontFamily: 'Sora',
    fontSize: 30,
    fontWeight: 400,
    color: '#e7e2d8',
    align: 'center',
    x: 0.5,
    y: 0.56,
    animation: 'fade',
    uppercase: false,
    letterSpacing: 1,
    background: false,
    width: 0.62,
  });

  // Outro card
  if (total > 12) {
    clips.push({
      id: uid('clip'),
      trackId: text.id,
      kind: 'text',
      name: 'Cierre',
      start: Math.max(0, total - 4.2),
      duration: 3.6,
      fadeIn: 0.5,
      fadeOut: 0.5,
      opacity: 1,
      filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
      text: 'Vidora',
      fontFamily: 'Instrument Serif',
      fontSize: 72,
      fontWeight: 400,
      color: '#ffffff',
      align: 'center',
      x: 0.5,
      y: 0.9,
      animation: 'fade',
      uppercase: false,
      letterSpacing: 6,
      background: false,
      width: 0.7,
    });
  }

  // Decorative overlay bar
  clips.push({
    id: uid('clip'),
    trackId: overlay.id,
    kind: 'text',
    name: 'Firma de autor',
    start: 0,
    duration: total,
    fadeIn: 0.8,
    fadeOut: 0.8,
    opacity: 0.55,
    filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
    text: 'HECHO CON VIDORA · IA LOCAL',
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: 500,
    color: '#ffffff',
    align: 'left',
    x: 0.055,
    y: 0.945,
    animation: 'none',
    uppercase: true,
    letterSpacing: 3,
    background: false,
    width: 0.5,
  });

  return {
    id: uid('prj'),
    name: opts.name || sb.title || 'Video IA',
    prompt: opts.prompt || sb.logline,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    aspect,
    width: size.width,
    height: size.height,
    fps: 30,
    duration: total,
    background: '#050508',
    grain: 20,
    vignette: true,
    music: { enabled: true, mood: sb.mood || 'cinematic', volume: 0.38 },
    tracks,
    clips,
    aiGenerated: true,
  };
}

export function clipKindToTrack(kind: Clip['kind']): TrackType[] {
  if (kind === 'text') return ['text', 'overlay'];
  if (kind === 'audio') return ['audio'];
  return ['video', 'overlay'];
}

export function findTrack(project: Project, id: string): Track | undefined {
  return project.tracks.find((t) => t.id === id);
}

export function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.start - b.start || a.duration - b.duration);
}
