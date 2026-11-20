import type { ExportFormat, ExportOptions, Project } from '@/types';
import { renderFrame } from './renderer';
import { previewAudio } from './audio';
import { seekVideos, pauseAllMedia } from '@/lib/assets';
import { logger } from '@/lib/utils';

export type ExportPhase = 'preparing' | 'recording' | 'finalizing' | 'done' | 'cancelled' | 'error';

export interface ExportUpdate {
  phase: ExportPhase;
  progress: number;
  detail: string;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  mime: string;
  extension: 'mp4' | 'webm';
  size: number;
  duration: number;
}

function pickMime(format: ExportFormat): string {
  const mp4 = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
    'video/mp4',
  ];
  const webm = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const list = format === 'mp4' ? mp4 : format === 'webm' ? webm : [...mp4, ...webm];
  for (const m of list) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function bitrateFor(width: number, height: number, fps: number, quality: ExportOptions['quality']): number {
  const factor = quality === 'ultra' ? 0.3 : quality === 'high' ? 0.18 : 0.1;
  return Math.min(60_000_000, Math.round(width * height * fps * factor));
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function exportProject(
  project: Project,
  options: ExportOptions,
  onUpdate: (u: ExportUpdate) => void,
  signal?: AbortSignal
): Promise<ExportResult> {
  if (!canRecord()) throw new Error('Tu navegador no soporta grabación de canvas (MediaRecorder). Usa Chrome, Edge o Brave actualizado.');

  const duration = Math.max(1, Math.min(36000, options.minutes * 60));
  const width = Math.round(options.width / 2) * 2;
  const height = Math.round(options.height / 2) * 2;
  onUpdate({ phase: 'preparing', progress: 0, detail: 'Preparando lienzo y audio…' });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('No se pudo crear el contexto de render.');

  try { await document.fonts.ready; } catch { /* noop */ }

  // Preload / seek videos and wait for first frames
  seekVideos(project, 0, false);
  for (const clip of project.clips) {
    if (clip.kind === 'media') {
      // no-op: runtime handles preload
    }
  }
  renderFrame(ctx, project, 0);
  await new Promise((r) => setTimeout(r, 350));

  onUpdate({ phase: 'preparing', progress: 0.01, detail: 'Iniciando mezcla de audio…' });
  await previewAudio.start(project, 0, { export: true });

  const videoStream = canvas.captureStream(Math.max(12, Math.min(60, options.fps)));
  const audioStream = previewAudio.getStream();
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  const stream = new MediaStream(tracks);

  const mime = pickMime(options.format);
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: bitrateFor(width, height, options.fps, options.quality),
    audioBitsPerSecond: 192_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  let cancelled = false;
  const onAbort = () => { cancelled = true; };
  signal?.addEventListener('abort', onAbort, { once: true });

  let raf = 0;
  let lastProgress = 0;
  let stopResolve: (() => void) | null = null;
  const stopped = new Promise<void>((resolve) => { stopResolve = resolve; });

  recorder.onstop = () => {
    stopResolve?.();
  };
  recorder.onerror = (ev) => {
    logger.error('MediaRecorder error', ev);
    stopResolve?.();
  };

  try {
    recorder.start(500);
  } catch (e) {
    previewAudio.stop();
    throw new Error(`No se pudo iniciar la grabación: ${(e as Error).message}`);
  }

  onUpdate({ phase: 'recording', progress: 0.02, detail: 'Grabando en tiempo real…' });

  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const loop = () => {
      if (cancelled) {
        cancelAnimationFrame(raf);
        resolve();
        return;
      }
      const elapsed = (performance.now() - t0) / 1000;
      const t = Math.min(duration, elapsed);
      renderFrame(ctx, project, t);
      seekVideos(project, t, true);
      const progress = Math.min(1, t / duration);
      if (progress - lastProgress > 0.01 || progress >= 1) {
        lastProgress = progress;
        onUpdate({ phase: 'recording', progress: 0.02 + progress * 0.94, detail: `Grabando ${formatPct(progress)}` });
      }
      if (t >= duration) {
        resolve();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  cancelAnimationFrame(raf);
  previewAudio.stop();
  pauseAllMedia();

  if (cancelled) {
    try { recorder.stop(); } catch { /* noop */ }
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    signal?.removeEventListener('abort', onAbort);
    onUpdate({ phase: 'cancelled', progress: 0, detail: 'Exportación cancelada' });
    throw new DOMException('Exportación cancelada', 'AbortError');
  }

  onUpdate({ phase: 'finalizing', progress: 0.98, detail: 'Cerrando archivo…' });
  try {
    if (recorder.state !== 'inactive') recorder.stop();
  } catch { /* noop */ }
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  signal?.removeEventListener('abort', onAbort);

  const type = (mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (blob.size === 0) throw new Error('La grabación quedó vacía. Prueba otra vez con una resolución menor.');
  const url = URL.createObjectURL(blob);
  const extension: 'mp4' | 'webm' = type.includes('mp4') ? 'mp4' : 'webm';

  onUpdate({ phase: 'done', progress: 1, detail: '¡Video listo!' });
  return { blob, url, mime: type, extension, size: blob.size, duration };
}

function formatPct(p: number): string {
  return `${Math.floor(p * 100)}%`;
}

export function downloadName(project: Project, ext: string): string {
  const slug = (project.name || 'vidora')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'vidora';
  return `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
