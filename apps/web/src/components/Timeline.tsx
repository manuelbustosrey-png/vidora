import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Film,
  Layers,
  Lock,
  Minus,
  Music,
  Plus,
  Scissors,
  Trash2,
  Type as TypeIcon,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Clip, TrackType } from '@/types';
import { useEditor } from '@/store/editor';
import { TRACK_META } from '@/lib/project';
import { getRuntime } from '@/lib/assets';
import { clamp, formatClock, hashString } from '@/lib/utils';

const ROW_H = 46;

const TRACK_ICON: Record<TrackType, typeof Film> = {
  video: Film,
  overlay: Layers,
  text: TypeIcon,
  audio: Music,
};

function clipGradient(clip: Clip): string {
  if (clip.kind === 'scene') {
    const [a = '#ff6a3d', b = '#8b5cf6', c = '#0a0a12'] = clip.palette;
    return `radial-gradient(120% 150% at 15% 10%, ${a}aa, transparent 55%), radial-gradient(120% 120% at 85% 90%, ${b}99, transparent 60%), ${c}`;
  }
  if (clip.kind === 'text') return 'linear-gradient(135deg, rgba(56,189,248,.35), rgba(56,189,248,.12))';
  if (clip.kind === 'audio') return 'linear-gradient(135deg, rgba(52,211,153,.35), rgba(52,211,153,.12))';
  return 'linear-gradient(135deg, rgba(255,106,61,.35), rgba(255,106,61,.12))';
}

function Waveform({ seed, count = 36 }: { seed: number; count?: number }) {
  const bars = useMemo(() => {
    let h = seed;
    return Array.from({ length: count }, () => {
      h = (h * 9301 + 49297) % 233280;
      const v = 0.18 + (h / 233280) * 0.82;
      return v;
    });
  }, [seed, count]);
  return (
    <div className="waveform" aria-hidden="true">
      {bars.map((v, i) => <span key={i} style={{ height: `${Math.round(v * 100)}%` }} />)}
    </div>
  );
}

export default function Timeline() {
  const project = useEditor((s) => s.project);
  const playhead = useEditor((s) => s.playhead);
  const zoom = useEditor((s) => s.zoom);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const setZoom = useEditor((s) => s.setZoom);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const selectClip = useEditor((s) => s.selectClip);
  const beginInteraction = useEditor((s) => s.beginInteraction);
  const endInteraction = useEditor((s) => s.endInteraction);
  const moveClip = useEditor((s) => s.moveClip);
  const updateClip = useEditor((s) => s.updateClip);
  const splitClip = useEditor((s) => s.splitClip);
  const removeClip = useEditor((s) => s.removeClip);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const updateTrack = useEditor((s) => s.updateTrack);
  const removeTrack = useEditor((s) => s.removeTrack);
  const addTrack = useEditor((s) => s.addTrack);
  const setDuration = useEditor((s) => s.setDuration);

  const innerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headsRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [seekDrag, setSeekDrag] = useState(false);

  const duration = Math.max(project?.duration ?? 60, 20);
  const width = Math.max(duration * zoom + 60, 600);
  const ticks = useMemo(() => {
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const minPx = 64;
    const step = candidates.find((c) => c * zoom >= minPx) || 600;
    const list: number[] = [];
    for (let t = 0; t <= duration + step; t += step) list.push(Math.round(t * 10) / 10);
    return { step, list };
  }, [zoom, duration]);

  const durationX = (project?.duration ?? 0) * zoom;
  const playheadX = Math.min(playhead, project?.duration ?? 0) * zoom;

  // Keep the playhead visible while playing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (playheadX < el.scrollLeft) el.scrollLeft = Math.max(0, playheadX - 80);
    else if (playheadX > el.scrollLeft + el.clientWidth - 60) el.scrollLeft = playheadX - el.clientWidth + 120;
  }, [playheadX]);

  if (!project) return null;

  const seek = (clientX: number) => {
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = clamp((clientX - rect.left) / zoom, 0, project.duration);
    setPlayhead(t);
  };

  const startClipDrag = (e: React.PointerEvent, clip: Clip, mode: 'move' | 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    selectClip(clip.id);
    beginInteraction();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { start: clip.start, duration: clip.duration, inPoint: 'inPoint' in clip ? clip.inPoint : 0, trackId: clip.trackId };
    const trackIndex = project.tracks.findIndex((t) => t.id === clip.trackId);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const state = useEditor.getState();
      if (!state.project) return;
      if (mode === 'move') {
        const dy = ev.clientY - startY;
        const offset = Math.round(dy / ROW_H);
        const target = state.project.tracks[clamp(trackIndex + offset, 0, state.project.tracks.length - 1)];
        moveClip(clip.id, Math.max(0, orig.start + dx), target?.id);
      } else if (mode === 'right') {
        const nd = Math.max(0.3, orig.duration + dx);
        updateClip(clip.id, { duration: Math.round(nd * 100) / 100 });
      } else {
        const delta = Math.max(-orig.start, Math.min(orig.duration - 0.3, dx));
        const patch: Partial<Clip> = {
          start: Math.round((orig.start + delta) * 100) / 100,
          duration: Math.round((orig.duration - delta) * 100) / 100,
        };
        if (clip.kind === 'media' || clip.kind === 'audio') {
          (patch as { inPoint?: number }).inPoint = Math.max(0, orig.inPoint + delta);
        }
        updateClip(clip.id, patch);
      }
    };
    const onUp = () => {
      endInteraction();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  const startDurationDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    beginInteraction();
    const startX = e.clientX;
    const orig = project.duration;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const next = clamp(orig + (ev.clientX - startX) / zoom, 5, 36000);
      setDuration(Math.round(next * 10) / 10);
    };
    const onUp = () => {
      endInteraction();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  return (
    <section className="timeline-panel">
      <div className="timeline-toolbar">
        <div className="tl-tools">
          <button className="tool-btn" title="Dividir en el playhead (S)" disabled={!selectedClipId} onClick={() => selectedClipId && splitClip(selectedClipId, playhead)}>
            <Scissors size={15} /><span>Dividir</span>
          </button>
          <button className="tool-btn" title="Duplicar (Ctrl+D)" disabled={!selectedClipId} onClick={() => selectedClipId && duplicateClip(selectedClipId)}>
            <Copy size={15} /><span>Duplicar</span>
          </button>
          <button className="tool-btn danger" title="Eliminar (Supr)" disabled={!selectedClipId} onClick={() => selectedClipId && removeClip(selectedClipId)}>
            <Trash2 size={15} /><span>Eliminar</span>
          </button>
          <div className="tool-sep" />
          <div className="add-track-wrap">
            <button className="tool-btn" onClick={() => setAddOpen(!addOpen)}><Plus size={15} /><span>Pista</span></button>
            {addOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setAddOpen(false)} />
                <div className="dropdown up">
                  <button onClick={() => { const id = addTrack('video'); setAddOpen(false); if (id) selectClip(null); }}><Film size={14} /> Pista de video</button>
                  <button onClick={() => { addTrack('overlay'); setAddOpen(false); }}><Layers size={14} /> Overlay</button>
                  <button onClick={() => { addTrack('text'); setAddOpen(false); }}><TypeIcon size={14} /> Texto</button>
                  <button onClick={() => { addTrack('audio'); setAddOpen(false); }}><Music size={14} /> Audio</button>
                </div>
              </>
            )}
          </div>
          <span className="tl-tip">Espacio: play · S: dividir · Supr: borrar</span>
        </div>
        <div className="tl-zoom">
          <button className="icon-btn" onClick={() => setZoom(zoom / 1.35)} title="Alejar"><ZoomOut size={15} /></button>
          <input type="range" min={6} max={200} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom de timeline" />
          <button className="icon-btn" onClick={() => setZoom(zoom * 1.35)} title="Acercar"><ZoomIn size={15} /></button>
        </div>
      </div>

      <div className="timeline-body">
        <div className="track-heads" ref={headsRef}>
          <div className="heads-spacer">
            <span>Pistas</span>
            <em>{formatClock(project.duration)}</em>
          </div>
          {project.tracks.map((track) => {
            const Icon = TRACK_ICON[track.type];
            return (
              <div key={track.id} className={`track-head track-${track.type}`} style={{ height: ROW_H }}>
                <span className="track-color" />
                <Icon size={14} className="track-icon" />
                <span className="track-name" title={track.name}>{track.name}</span>
                <div className="track-actions">
                  <button title={track.muted ? 'Activar' : 'Silenciar'} onClick={() => updateTrack(track.id, { muted: !track.muted })} className={track.muted ? 'off' : ''}>
                    {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                  <button title={track.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => updateTrack(track.id, { hidden: !track.hidden })} className={track.hidden ? 'off' : ''}>
                    {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button title={track.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => updateTrack(track.id, { locked: !track.locked })} className={track.locked ? 'off' : ''}>
                    {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <button title="Eliminar pista" onClick={() => { if (confirm(`¿Eliminar la pista «${track.name}» y sus clips?`)) removeTrack(track.id); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="track-add" style={{ height: ROW_H }}>
            <button onClick={() => { addTrack('text'); }}>
              <Plus size={13} /> Añadir pista
            </button>
          </div>
        </div>

        <div
          className="timeline-scroll"
          ref={scrollRef}
          onScroll={(e) => { if (headsRef.current) headsRef.current.scrollTop = (e.target as HTMLElement).scrollTop; }}
        >
          <div className="timeline-inner" ref={innerRef} style={{ width }}>
            <div
              className="ruler"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                setSeekDrag(true);
                seek(e.clientX);
              }}
              onPointerMove={(e) => { if (seekDrag) seek(e.clientX); }}
              onPointerUp={() => setSeekDrag(false)}
            >
              {ticks.list.map((t) => (
                <div key={t} className="tick" style={{ left: t * zoom }}>
                  <span>{formatClock(t)}</span>
                </div>
              ))}
              <div className="playhead-head" style={{ left: playheadX }} />
            </div>

            <div className="lanes">
              {project.tracks.map((track) => {
                const clips = project.clips.filter((c) => c.trackId === track.id);
                return (
                  <div
                    key={track.id}
                    className={`lane lane-${track.type}`}
                    style={{ height: ROW_H }}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget) {
                        selectClip(null);
                        seek(e.clientX);
                      }
                    }}
                  >
                    {clips.map((clip) => {
                      const left = clip.start * zoom;
                      const w = Math.max(18, clip.duration * zoom);
                      const selected = selectedClipId === clip.id;
                      const isMedia = clip.kind === 'media';
                      const rt = isMedia ? getRuntime(clip.assetId) : null;
                      const thumb = rt?.meta.type === 'image' ? rt.url : null;
                      return (
                        <div
                          key={clip.id}
                          className={`tl-clip ${selected ? 'selected' : ''} ${track.locked ? 'locked' : ''} clip-${clip.kind}`}
                          style={{ left, width: w, background: clipGradient(clip) }}
                          onPointerDown={(e) => { if (!track.locked) startClipDrag(e, clip, 'move'); }}
                          onDoubleClick={() => selectClip(clip.id)}
                          title={`${clip.name} · ${clip.duration.toFixed(1)}s`}
                        >
                          {thumb && <span className="clip-thumb" style={{ backgroundImage: `url(${thumb})` }} />}
                          <div className="clip-content">
                            <strong>{clip.name}</strong>
                            {w > 90 && <span>{clip.kind === 'scene' ? 'Escena IA' : clip.kind === 'text' ? 'Texto' : clip.kind === 'audio' ? 'Audio' : 'Medio'} · {clip.duration.toFixed(1)}s</span>}
                          </div>
                          {clip.kind === 'audio' && <Waveform seed={hashString(clip.id)} />}
                          {clip.fadeIn > 0 && <span className="fade fade-in" style={{ width: Math.min(w / 3, clip.fadeIn * zoom) }} />}
                          {clip.fadeOut > 0 && <span className="fade fade-out" style={{ width: Math.min(w / 3, clip.fadeOut * zoom) }} />}
                          {!track.locked && (
                            <>
                              <span className="trim-handle left" onPointerDown={(e) => startClipDrag(e, clip, 'left')} />
                              <span className="trim-handle right" onPointerDown={(e) => startClipDrag(e, clip, 'right')} />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="playhead-line" style={{ left: playheadX }} />
            <div className="duration-line" style={{ left: durationX }}>
              <button className="duration-grip" onPointerDown={startDurationDrag} title="Arrastra para cambiar la duración">
                <span />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
