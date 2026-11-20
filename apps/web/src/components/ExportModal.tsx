import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Film, MonitorPlay, RotateCcw, Square, X } from 'lucide-react';
import type { ExportFormat, ExportOptions, Project } from '@/types';
import { exportProject, downloadName, canRecord, type ExportResult } from '@/engine/export';
import { useEditor } from '@/store/editor';
import { downloadBlob, formatBytes, formatClock } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Modal, DurationPicker } from './ui';

type Quality = ExportOptions['quality'];

export default function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const setDuration = useEditor((s) => s.setDuration);
  const [minutes, setMinutes] = useState(2);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState<Quality>('high');
  const [format, setFormat] = useState<ExportFormat>('auto');
  const [phase, setPhase] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState('');
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    setMinutes(Math.round((project.duration / 60) * 10) / 10);
    setHeight(project.height >= 2000 ? 2160 : project.height >= 1400 ? 1440 : 1080);
    setFps(project.fps || 30);
    setPhase('idle');
    setResult(null);
    setError('');
    setProgress(0);
  }, [open, project?.id]);

  const resolutions = useMemo(() => {
    if (!project) return [];
    const ratio = project.width / project.height;
    return [720, 1080, 1440, 2160].map((h) => {
      const w = Math.round((h * ratio) / 2) * 2;
      return { label: h === 2160 ? '4K' : `${h}p`, h, w };
    });
  }, [project?.width, project?.height]);

  if (!project) return null;

  const chosen = resolutions.find((r) => r.h === height) || resolutions[1];
  const bitrate = Math.min(60_000_000, Math.round(chosen.w * chosen.h * fps * (quality === 'ultra' ? 0.3 : quality === 'high' ? 0.18 : 0.1)));
  const estimated = (bitrate / 8) * minutes * 60;

  const start = async () => {
    if (!canRecord()) {
      toast('Este navegador no puede grabar canvas. Usa Chrome o Edge.', 'error');
      return;
    }
    const totalDuration = Math.max(5, Math.round(minutes * 60));
    const snapshot: Project = { ...project, duration: totalDuration };
    setDuration(totalDuration);
    const options: ExportOptions = {
      width: chosen.w,
      height: chosen.h,
      fps,
      minutes,
      quality,
      format,
    };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('exporting');
    setProgress(0);
    setError('');
    try {
      const res = await exportProject(snapshot, options, (u) => {
        setProgress(u.progress);
        setDetail(u.detail);
      }, ctrl.signal);
      setResult(res);
      setPhase('done');
      toast('Video exportado. Ya puedes descargarlo.', 'success');
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPhase('idle');
        setProgress(0);
        toast('Exportación cancelada', 'info');
      } else {
        setPhase('error');
        setError((e as Error).message);
        toast(`Error al exportar: ${(e as Error).message}`, 'error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const close = () => {
    if (phase === 'exporting') {
      if (!confirm('Hay una exportación en curso. ¿Cancelarla y cerrar?')) return;
      abortRef.current?.abort();
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Exportar video" subtitle="Renderizado local con MediaRecorder · sin marcas de agua" wide>
      {phase === 'idle' && (
        <div className="export-body">
          <div className="export-main">
            <div className="export-block">
              <div className="export-label"><span>Duración</span><strong>{minutes} min · {formatClock(minutes * 60)}</strong></div>
              <DurationPicker minutes={minutes} onChange={setMinutes} />
              <p className="muted small">El video se graba en tiempo real. Un clip de 2 minutos tarda ~2 minutos. Hasta 600 minutos por proyecto.</p>
            </div>

            <div className="export-row">
              <div className="export-block">
                <div className="export-label"><span>Resolución</span><strong>{chosen.w} × {chosen.h}</strong></div>
                <div className="option-grid">
                  {resolutions.map((r) => (
                    <button key={r.h} className={`option-btn ${height === r.h ? 'active' : ''}`} onClick={() => setHeight(r.h)}>
                      <strong>{r.label}</strong><span>{r.w}×{r.h}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="export-block">
                <div className="export-label"><span>Fotogramas</span><strong>{fps} fps</strong></div>
                <div className="option-grid">
                  {[24, 30, 60].map((f) => (
                    <button key={f} className={`option-btn ${fps === f ? 'active' : ''}`} onClick={() => setFps(f)}>
                      <strong>{f}</strong><span>fps</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="export-block">
              <div className="export-label"><span>Calidad</span><strong>{(bitrate / 1_000_000).toFixed(0)} Mbps</strong></div>
              <div className="quality-row">
                {([
                  ['standard', 'Estándar', 'Archivos ligeros'],
                  ['high', 'Alta', 'Recomendada'],
                  ['ultra', 'Ultra', 'Máximo detalle'],
                ] as const).map(([id, label, hint]) => (
                  <button key={id} className={`quality-btn ${quality === id ? 'active' : ''}`} onClick={() => setQuality(id)}>
                    <span className="q-radio" />
                    <span><strong>{label}</strong><em>{hint}</em></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="export-block">
              <div className="export-label"><span>Formato</span><strong>{format === 'auto' ? 'Automático' : format.toUpperCase()}</strong></div>
              <div className="format-row">
                {(['auto', 'mp4', 'webm'] as ExportFormat[]).map((f) => (
                  <button key={f} className={`chip ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)}>
                    {f === 'auto' ? 'Auto' : f.toUpperCase()}
                  </button>
                ))}
                <span className="muted small">MP4 si el navegador lo soporta; si no, WebM de alta calidad.</span>
              </div>
            </div>
          </div>

          <aside className="export-summary">
            <div className="summary-screen">
              {project.cover ? <img src={project.cover} alt="" /> : <div className="summary-fallback"><Film size={28} /></div>}
              <span className="summary-time">{formatClock(minutes * 60)}</span>
            </div>
            <h3>{project.name}</h3>
            <div className="summary-rows">
              <div><span>Resolución</span><strong>{chosen.w} × {chosen.h}</strong></div>
              <div><span>FPS</span><strong>{fps}</strong></div>
              <div><span>Duración</span><strong>{formatClock(minutes * 60)}</strong></div>
              <div><span>Tamaño estimado</span><strong>{formatBytes(estimated)}</strong></div>
              <div><span>Música</span><strong>{project.music.enabled ? project.music.mood : 'No'}</strong></div>
            </div>
            {minutes > 10 && (
              <div className="export-warn"><AlertTriangle size={14} /> La exportación tardará aproximadamente {Math.ceil(minutes)} minutos.</div>
            )}
            <button className="btn btn-primary btn-block" onClick={start}><MonitorPlay size={16} /> Exportar ahora</button>
            <p className="muted small center">El video se genera en tu equipo. Nada se sube a la nube.</p>
          </aside>
        </div>
      )}

      {phase === 'exporting' && (
        <div className="export-progress">
          <div className="ep-ring" style={{ ['--p' as string]: `${Math.round(progress * 100)}%` }}>
            <div className="ep-inner">
              <strong>{Math.round(progress * 100)}%</strong>
              <span>grabando</span>
            </div>
          </div>
          <h3>{detail || 'Preparando la exportación…'}</h3>
          <p className="muted">No cierres esta pestaña. El render ocurre en tiempo real para mantener el audio y los videos sincronizados.</p>
          <div className="ep-bar"><span style={{ width: `${progress * 100}%` }} /></div>
          <div className="ep-meta"><span>{chosen.w} × {chosen.h} · {fps} fps</span><span>{formatClock(minutes * 60)}</span></div>
          <button className="btn btn-ghost" onClick={() => abortRef.current?.abort()}><Square size={13} /> Cancelar exportación</button>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="export-done">
          <div className="ed-head"><span className="ed-icon"><Check size={22} /></span><div><h3>Video listo</h3><p>{formatBytes(result.size)} · {result.extension.toUpperCase()} · {formatClock(result.duration)}</p></div></div>
          <video src={result.url} controls className="export-preview" />
          <div className="ed-actions">
            <button className="btn btn-primary" onClick={() => downloadBlob(result.blob, downloadName(project, result.extension))}>
              <Download size={16} /> Descargar {result.extension.toUpperCase()}
            </button>
            <button className="btn btn-ghost" onClick={() => { setPhase('idle'); setResult(null); }}>
              <RotateCcw size={15} /> Exportar otro
            </button>
            <button className="btn btn-ghost" onClick={onClose}><X size={15} /> Cerrar</button>
          </div>
          <p className="muted small">Si el reproductor no se ve, descarga el archivo. Algunos navegadores no reproducen MP4 grabados con MediaRecorder.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="export-error">
          <AlertTriangle size={30} />
          <h3>No se pudo exportar</h3>
          <p>{error}</p>
          <div className="ed-actions">
            <button className="btn btn-primary" onClick={() => setPhase('idle')}>Reintentar</button>
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
