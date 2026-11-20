import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, AspectId } from '@/types';
import { ASPECTS } from '@/types';

interface SettingsStore extends Settings {
  setAi: (patch: Partial<Settings['ai']>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const isDev = import.meta.env.DEV;

export const DEFAULT_SETTINGS: Settings = {
  ai: {
    endpoint: isDev ? '/ollama' : 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.8,
    timeout: 120000,
  },
  author: 'Vidora Creator',
  defaultAspect: '16:9',
  defaultMinutes: 2,
  repoUrl: '',
  appUrl: '',
  reduceMotion: false,
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setSettings: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'vidora-settings',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<SettingsStore>;
        return {
          ...current,
          ...p,
          ai: { ...current.ai, ...(p.ai || {}) },
        };
      },
    }
  )
);

export function aspectSize(aspect: AspectId) {
  const a = ASPECTS[aspect];
  return { width: a.width, height: a.height };
}
