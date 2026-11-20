import type { AssetMeta, AssetRuntime, Project } from '@/types';
import { getAsset, getAssetBlob, listAssets, saveAsset } from './storage';
import { uid, logger } from './utils';

const runtimes = new Map<string, AssetRuntime>();

export function getRuntime(id: string): AssetRuntime | undefined {
  return runtimes.get(id);
}

export function getRuntimeCount(): number {
  return runtimes.size;
}

function makeRuntime(meta: AssetMeta, url: string): AssetRuntime {
  const rt: AssetRuntime = { meta, url };
  if (meta.type === 'image') {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    rt.image = img;
  } else if (meta.type === 'video') {
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    rt.video = v;
  } else {
    const a = document.createElement('audio');
    a.src = url;
    a.preload = 'auto';
    rt.audio = a;
  }
  runtimes.set(meta.id, rt);
  return rt;
}

export async function hydrateProjectAssets(project: Project): Promise<AssetMeta[]> {
  const needed = new Set<string>();
  for (const clip of project.clips) {
    if (clip.kind === 'media' || clip.kind === 'audio') needed.add(clip.assetId);
  }
  const metas: AssetMeta[] = [];
  for (const id of needed) {
    if (runtimes.has(id)) {
      metas.push(runtimes.get(id)!.meta);
      continue;
    }
    const meta = await getAsset(id);
    const blob = await getAssetBlob(id);
    if (!meta || !blob) continue;
    const url = URL.createObjectURL(blob);
    const rt = makeRuntime(meta, url);
    metas.push(rt.meta);
  }
  return metas;
}

export async function projectAssets(projectId: string): Promise<AssetMeta[]> {
  return listAssets(projectId);
}

export function metaFromFile(file: File, projectId: string): Promise<AssetMeta> {
  return new Promise((resolve) => {
    const type: AssetMeta['type'] = file.type.startsWith('video')
      ? 'video'
      : file.type.startsWith('audio')
        ? 'audio'
        : 'image';
    const base: AssetMeta = {
      id: uid('ast'),
      projectId,
      name: file.name,
      type,
      mime: file.type,
      size: file.size,
      createdAt: Date.now(),
    };
    if (type === 'image') {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        base.width = img.naturalWidth;
        base.height = img.naturalHeight;
        URL.revokeObjectURL(url);
        resolve(base);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(base);
      };
      img.src = url;
    } else {
      const el = document.createElement(type === 'video' ? 'video' : 'audio');
      const url = URL.createObjectURL(file);
      el.preload = 'metadata';
      el.onloadedmetadata = () => {
        base.duration = Number.isFinite(el.duration) ? el.duration : 0;
        if (type === 'video') {
          base.width = (el as HTMLVideoElement).videoWidth;
          base.height = (el as HTMLVideoElement).videoHeight;
        }
        URL.revokeObjectURL(url);
        resolve(base);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(base);
      };
      el.src = url;
    }
  });
}

export async function importFile(file: File, projectId: string): Promise<AssetMeta> {
  const meta = await metaFromFile(file, projectId);
  await saveAsset(meta, file);
  const url = URL.createObjectURL(file);
  makeRuntime(meta, url);
  logger.info('asset imported', meta.name, meta.type);
  return meta;
}

export function revokeAllAssets(): void {
  for (const [, rt] of runtimes) {
    URL.revokeObjectURL(rt.url);
    rt.video?.removeAttribute('src');
    rt.audio?.removeAttribute('src');
  }
  runtimes.clear();
}

export function revokeAsset(id: string): void {
  const rt = runtimes.get(id);
  if (!rt) return;
  URL.revokeObjectURL(rt.url);
  rt.video?.removeAttribute('src');
  rt.audio?.removeAttribute('src');
  runtimes.delete(id);
}

export function seekVideos(project: Project, time: number, playing: boolean): void {
  for (const clip of project.clips) {
    if (clip.kind !== 'media') continue;
    const rt = runtimes.get(clip.assetId);
    if (!rt?.video) continue;
    const active = time >= clip.start && time <= clip.start + clip.duration;
    if (!active) {
      if (!rt.video.paused) rt.video.pause();
      continue;
    }
    const target = clip.inPoint + (time - clip.start);
    if (playing) {
      if (Math.abs(rt.video.currentTime - target) > 0.45) {
        try { rt.video.currentTime = Math.max(0, target); } catch { /* noop */ }
      }
      if (rt.video.paused) rt.video.play().catch(() => {});
    } else {
      if (!rt.video.paused) rt.video.pause();
      if (Math.abs(rt.video.currentTime - target) > 0.04) {
        try { rt.video.currentTime = Math.max(0, target); } catch { /* noop */ }
      }
    }
  }
}

export function pauseAllMedia(): void {
  for (const [, rt] of runtimes) {
    if (rt.video && !rt.video.paused) rt.video.pause();
  }
}
