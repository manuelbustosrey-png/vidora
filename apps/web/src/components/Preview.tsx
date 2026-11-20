import { useEffect, useRef, useState } from 'react';
import { Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEditor } from '@/store/editor';
import { renderFrame } from '@/engine/renderer';
import { previewAudio } from '@/engine/audio';
import { seekVideos, pauseAllMedia } from '@/lib/assets';
import { formatTime } from '@/lib/utils';

export default function Preview() {
  const project = useEditor((s) => s.project);
  const playhead = useEditor((s) => s.playhead);
  const playing = useEditor((s) => s.playing);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [size, setSize] = useState({ w: 1280, h: 720 });

  // Keep internal canvas resolution in sync with the project aspect and container.
  useEffect(() => {
    if (!project) return;
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const maxW = Math.min(1600, Math.max(640, Math.round(rect.width * (window.devicePixelRatio > 1 ? 1.5 : 1))));
      const w = Math.min(maxW, project.width);
      const h = Math.round((w * project.height) / project.width);
      setSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project?.width, project?.height, project?.id]);

  // Draw when paused or when project changes.
  useEffect(() => {
    if (!project) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    if (!playing) {
      seekVideos(project, playhead, false);
      renderFrame(ctx, project, playhead);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, playhead, size.w, size.h, playing]);

  // Playback loop
  useEffect(() => {
    if (!playing || !project) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    canvas.width = size.w;
    canvas.height = size.h;
    let raf = 0;
    let cancelled = false;
    const startHead = useEditor.getState().playhead;
    const start = performance.now();
    previewAudio.start(project, startHead).catch(() => {});

    const loop = () => {
      if (cancelled) return;
      const p = useEditor.getState().project;
      if (!p) return;
      const t = startHead + (performance.now() - start) / 1000;
      if (t >= p.duration) {
        renderFrame(ctx, p, p.duration);
        seekVideos(p, p.duration, false);
        previewAudio.stop();
        pauseAllMedia();
        useEditor.setState({ playhead: p.duration, playing: false });
        return;
      }
      renderFrame(ctx, p, t);
      seekVideos(p, t, true);
      useEditor.setState({ playhead: t });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      previewAudio.stop();
      pauseAllMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, project?.id]);

  useEffect(() => {
    previewAudio.setMuted(muted);
  }, [muted]);

  if (!project) return null;

  const ratio = project.width / project.height;

  return (
    <section className="preview-panel">
      <div className="preview-topbar">
        <div className="preview-breadcrumb">
          <span className="live-dot" /> Vista previa
          <em>{project.width} × {project.height}</em>
        </div>
        <div className="preview-top-actions">
          <span className={`render-badge ${playing ? 'active' : ''}`}>{playing ? 'Reproduciendo' : 'Listo'}</span>
          <button className="icon-btn" title="Reiniciar" onClick={() => setPlayhead(0)}><RotateCcw size={15} /></button>
        </div>
      </div>

      <div className="preview-stage">
        <div
          ref={wrapRef}
          className="preview-frame"
          style={{ aspectRatio: `${ratio}`, maxWidth: `min(100%, calc((100vh - 350px) * ${ratio}))` }}
        >
          <canvas ref={canvasRef} width={size.w} height={size.h} onClick={() => setPlaying(!playing)} />
          <button className="big-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? <Pause size={26} /> : <Play size={26} />}
          </button>
          <div className="frame-corners"><span /><span /><span /><span /></div>
        </div>
      </div>

      <div className="transport">
        <div className="transport-left">
          <button className="icon-btn" onClick={() => setPlayhead(Math.max(0, playhead - 5))} title="-5 s"><SkipBack size={16} /></button>
          <button className="transport-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button className="icon-btn" onClick={() => setPlayhead(Math.min(project.duration, playhead + 5))} title="+5 s"><SkipForward size={16} /></button>
          <span className="time-readout">
            <strong>{formatTime(playhead, true, project.fps)}</strong>
            <em>/ {formatTime(project.duration)}</em>
          </span>
        </div>
        <div className="transport-right">
          <span className="fps-chip">{project.fps} fps</span>
          <button className="icon-btn" onClick={() => setMuted(!muted)} title={muted ? 'Activar sonido' : 'Silenciar'}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            className="icon-btn"
            title="Pantalla completa"
            onClick={() => {
              const el = wrapRef.current?.parentElement;
              if (!el) return;
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              else el.requestFullscreen?.().catch(() => {});
            }}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
