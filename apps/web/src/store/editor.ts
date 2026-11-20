import { create } from 'zustand';
import { produce } from 'immer';
import type { AspectId, Clip, ClipFilter, Project, Track, TrackType } from '@/types';
import { ASPECTS } from '@/types';
import { clamp, uid } from '@/lib/utils';
import { clipKindToTrack, makeTrack } from '@/lib/project';

let lastSnapshot = 0;
let interactionOpen = false;

interface EditorState {
  project: Project | null;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  playhead: number;
  playing: boolean;
  zoom: number;
  past: Project[];
  future: Project[];
  dirty: boolean;

  setProject: (project: Project | null) => void;
  updateProject: (patch: Partial<Project> | ((p: Project) => void), force?: boolean) => void;
  setAspect: (aspect: AspectId) => void;
  setDuration: (seconds: number) => void;
  setMusic: (patch: Partial<Project['music']>) => void;

  addTrack: (type: TrackType) => string | null;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;

  addClip: (clip: Clip, force?: boolean) => void;
  updateClip: (id: string, patch: Partial<Clip>, force?: boolean) => void;
  updateFilter: (id: string, patch: Partial<ClipFilter>) => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  splitClip: (id: string, at: number) => void;
  moveClip: (id: string, start: number, trackId?: string) => void;
  selectClip: (id: string | null) => void;

  setPlayhead: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setZoom: (zoom: number) => void;

  beginInteraction: () => void;
  endInteraction: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

function snapshot(state: EditorState, force: boolean): Project[] {
  if (!state.project) return state.past;
  if (interactionOpen) return state.past;
  const now = Date.now();
  if (!force && now - lastSnapshot < 500) return state.past;
  lastSnapshot = now;
  return [...state.past.slice(-59), structuredClone(state.project)];
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  selectedClipId: null,
  selectedTrackId: null,
  playhead: 0,
  playing: false,
  zoom: 40,
  past: [],
  future: [],
  dirty: false,

  setProject: (project) => {
    lastSnapshot = 0;
    interactionOpen = false;
    set({
      project,
      selectedClipId: null,
      selectedTrackId: null,
      playhead: 0,
      playing: false,
      past: [],
      future: [],
      dirty: false,
      zoom: 40,
    });
  },

  updateProject: (patch, force = false) =>
    set((s) => {
      if (!s.project) return s;
      const past = snapshot(s, force);
      const project = produce(s.project, (draft) => {
        if (typeof patch === 'function') patch(draft);
        else Object.assign(draft, patch);
        draft.updatedAt = Date.now();
      });
      return { ...s, project, past, future: [], dirty: true };
    }),

  setAspect: (aspect) =>
    set((s) => {
      if (!s.project || s.project.aspect === aspect) return s;
      const past = snapshot(s, false);
      const size = ASPECTS[aspect];
      return {
        ...s,
        project: { ...s.project, aspect, width: size.width, height: size.height, updatedAt: Date.now() },
        past,
        future: [],
        dirty: true,
      };
    }),

  setDuration: (seconds) =>
    set((s) => {
      if (!s.project) return s;
      const duration = clamp(Math.round(seconds * 10) / 10, 5, 36000);
      const past = snapshot(s, false);
      return {
        ...s,
        project: { ...s.project, duration, updatedAt: Date.now() },
        past,
        future: [],
        dirty: true,
      };
    }),

  setMusic: (patch) =>
    set((s) => {
      if (!s.project) return s;
      const past = snapshot(s, false);
      return {
        ...s,
        project: { ...s.project, music: { ...s.project.music, ...patch }, updatedAt: Date.now() },
        past,
        future: [],
        dirty: true,
      };
    }),

  addTrack: (type) => {
    const p = get().project;
    if (!p) return null;
    const track = makeTrack(type);
    set((s) => ({
      ...s,
      project: { ...p, tracks: [...p.tracks, track], updatedAt: Date.now() },
      past: snapshot(s, true),
      future: [],
      dirty: true,
    }));
    return track.id;
  },

  updateTrack: (id, patch) =>
    set((s) => {
      if (!s.project) return s;
      return {
        ...s,
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        },
        dirty: true,
      };
    }),

  removeTrack: (id) =>
    set((s) => {
      if (!s.project || s.project.tracks.length <= 1) return s;
      return {
        ...s,
        project: {
          ...s.project,
          tracks: s.project.tracks.filter((t) => t.id !== id),
          clips: s.project.clips.filter((c) => c.trackId !== id),
        },
        selectedClipId: s.selectedClipId,
        past: snapshot(s, true),
        future: [],
        dirty: true,
      };
    }),

  addClip: (clip, force = true) =>
    set((s) => {
      if (!s.project) return s;
      const project = produce(s.project, (draft) => {
        draft.clips.push(clip);
        draft.duration = Math.max(draft.duration, clip.start + clip.duration);
        draft.updatedAt = Date.now();
      });
      return {
        ...s,
        project,
        selectedClipId: clip.id,
        past: snapshot(s, force),
        future: [],
        dirty: true,
      };
    }),

  updateClip: (id, patch, force = false) =>
    set((s) => {
      if (!s.project) return s;
      const project = produce(s.project, (draft) => {
        const clip = draft.clips.find((c) => c.id === id);
        if (!clip) return;
        Object.assign(clip, patch);
        if (clip.kind === 'audio' || clip.kind === 'text' || clip.kind === 'scene' || clip.kind === 'media') {
          clip.start = Math.max(0, clip.start);
          clip.duration = Math.max(0.3, clip.duration);
        }
        draft.updatedAt = Date.now();
      });
      return { ...s, project, past: snapshot(s, force), future: [], dirty: true };
    }),

  updateFilter: (id, patch) =>
    set((s) => {
      if (!s.project) return s;
      return {
        ...s,
        project: {
          ...s.project,
          clips: s.project.clips.map((c) =>
            c.id === id ? { ...c, filter: { ...c.filter, ...patch } } : c
          ),
        },
        dirty: true,
      };
    }),

  removeClip: (id) =>
    set((s) => {
      if (!s.project) return s;
      return {
        ...s,
        project: {
          ...s.project,
          clips: s.project.clips.filter((c) => c.id !== id),
          updatedAt: Date.now(),
        },
        selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
        past: snapshot(s, true),
        future: [],
        dirty: true,
      };
    }),

  duplicateClip: (id) => {
    const s = get();
    if (!s.project) return;
    const src = s.project.clips.find((c) => c.id === id);
    if (!src) return;
    const copy = structuredClone(src);
    copy.id = uid('clip');
    copy.start = src.start + src.duration;
    copy.name = `${src.name} copia`;
    s.addClip(copy);
  },

  splitClip: (id, at) => {
    const s = get();
    if (!s.project) return;
    const clip = s.project.clips.find((c) => c.id === id);
    if (!clip) return;
    const offset = at - clip.start;
    if (offset <= 0.15 || offset >= clip.duration - 0.15) return;
    s.beginInteraction();
    set((state) => {
      if (!state.project) return state;
      const target = state.project.clips.find((c) => c.id === id);
      if (!target) return state;
      const left = { ...target, duration: offset, fadeOut: 0.2, name: `${target.name} A` };
      const right: Clip = {
        ...structuredClone(target),
        id: uid('clip'),
        start: at,
        duration: target.duration - offset,
        fadeIn: 0.2,
        name: `${target.name} B`,
      };
      if (right.kind === 'media' || right.kind === 'audio') {
        (right as { inPoint: number }).inPoint = (target as unknown as { inPoint: number }).inPoint + offset;
      }
      return {
        ...state,
        project: {
          ...state.project,
          clips: state.project.clips.map((c) => (c.id === id ? left : c)).concat(right),
          updatedAt: Date.now(),
        },
        selectedClipId: right.id,
        past: snapshot(state, true),
        future: [],
        dirty: true,
      };
    });
    s.endInteraction();
  },

  moveClip: (id, start, trackId) =>
    set((s) => {
      if (!s.project) return s;
      const clip = s.project.clips.find((c) => c.id === id);
      if (!clip) return s;
      const target = trackId ? s.project.tracks.find((t) => t.id === trackId) : null;
      const allowed = target ? clipKindToTrack(clip.kind).includes(target.type) : false;
      return {
        ...s,
        project: {
          ...s.project,
          clips: s.project.clips.map((c) =>
            c.id === id
              ? { ...c, start: Math.max(0, Math.round(start * 100) / 100), trackId: allowed ? trackId! : c.trackId }
              : c
          ),
          updatedAt: Date.now(),
        },
        dirty: true,
      };
    }),

  selectClip: (id) => {
    const clip = id ? get().project?.clips.find((c) => c.id === id) : null;
    set({ selectedClipId: id, selectedTrackId: clip?.trackId || null });
  },

  setPlayhead: (t) =>
    set((s) => ({ playhead: clamp(t, 0, s.project?.duration || 0), playing: false })),

  setPlaying: (playing) =>
    set((s) => {
      if (!s.project) return { playing: false };
      if (playing && s.playhead >= s.project.duration - 0.01) {
        return { playing: true, playhead: 0 };
      }
      return { playing };
    }),

  togglePlay: () =>
    set((s) => {
      if (!s.project) return { playing: false };
      if (!s.playing && s.playhead >= s.project.duration - 0.01) {
        return { playing: true, playhead: 0 };
      }
      return { playing: !s.playing };
    }),

  setZoom: (zoom) => set({ zoom: clamp(zoom, 6, 240) }),

  beginInteraction: () => {
    const s = get();
    if (!s.project) return;
    interactionOpen = true;
    set((state) => {
      if (!state.project) return state;
      return { ...state, past: [...state.past.slice(-59), structuredClone(state.project)], future: [] };
    });
  },
  endInteraction: () => {
    interactionOpen = false;
    lastSnapshot = Date.now();
  },

  undo: () =>
    set((s) => {
      if (!s.past.length || !s.project) return s;
      const previous = s.past[s.past.length - 1];
      return {
        ...s,
        project: previous,
        past: s.past.slice(0, -1),
        future: [structuredClone(s.project), ...s.future].slice(0, 60),
        playhead: Math.min(s.playhead, previous.duration),
        dirty: true,
        playing: false,
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length || !s.project) return s;
      const next = s.future[0];
      return {
        ...s,
        project: next,
        past: [...s.past, structuredClone(s.project)].slice(-60),
        future: s.future.slice(1),
        playhead: Math.min(s.playhead, next.duration),
        dirty: true,
        playing: false,
      };
    }),

  markSaved: () => {
    lastSnapshot = 0;
    set({ dirty: false });
  },
}));
