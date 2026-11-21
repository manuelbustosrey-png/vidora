import { Copy, Download, Film, Image, Layers, Music, RotateCcw, Scissors, Sparkles, Trash2, Type as TypeIcon } from 'lucide-react';
import type { Clip, SceneTemplate, TextAnimation } from '@/types';
import { ASPECTS, MUSIC_MOOD_LABELS, MUSIC_MOODS } from '@/types';
import { useEditor } from '@/store/editor';
import { downloadBlob, formatClock } from '@/lib/utils';
import { renderThumbnail } from '@/engine/renderer';
import { Slider, Toggle } from './ui';

const SCENES: Array<{ id: SceneTemplate; label: string }> = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'nebula', label: 'Nebulosa' },
  { id: 'grid', label: 'Horizonte' },
  { id: 'particles', label: 'Bokeh' },
  { id: 'waves', label: 'Olas' },
  { id: 'spotlight', label: 'Focos' },
  { id: 'skyline', label: 'Ciudad' },
  { id: 'editorial', label: 'Editorial' },
];

const ANIMATIONS: Array<{ id: TextAnimation; label: string }> = [
  { id: 'fade', label: 'Fundido' },
  { id: 'slide-up', label: 'Subida' },
  { id: 'typewriter', label: 'Máquina' },
  { id: 'pop', label: 'Pop' },
  { id: 'none', label: 'Ninguna' },
];

const KIND_META = {
  scene: { label: 'Escena IA', icon: Sparkles, color: '#ff6a3d' },
  media: { label: 'Medio', icon: Film, color: '#ff6a3d' },
  text: { label: 'Texto', icon: TypeIcon, color: '#38bdf8' },
  audio: { label: 'Audio', icon: Music, color: '#34d399' },
} as const;

export default function Inspector() {
  const project = useEditor((s) => s.project);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const updateClip = useEditor((s) => s.updateClip);
  const updateFilter = useEditor((s) => s.updateFilter);
  const removeClip = useEditor((s) => s.removeClip);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const splitClip = useEditor((s) => s.splitClip);
  const beginInteraction = useEditor((s) => s.beginInteraction);
  const endInteraction = useEditor((s) => s.endInteraction);
  const updateProject = useEditor((s) => s.updateProject);
  const setAspect = useEditor((s) => s.setAspect);
  const setDuration = useEditor((s) => s.setDuration);
  const setMusic = useEditor((s) => s.setMusic);
  const playhead = useEditor((s) => s.playhead);

  if (!project) return null;
  const clip = project.clips.find((c) => c.id === selectedClipId) || null;

  const set = (patch: Record<string, unknown>) => {
    if (!clip) return;
    updateClip(clip.id, patch as Partial<Clip>);
  };

  return (
    <aside className="inspector">
      {!clip && (
        <div className="inspector-body">
          <div className="inspector-head">
            <div><span className="panel-kicker">Proyecto</span><h3>Ajustes generales</h3></div>
          </div>

          <div className="insp-group">
            <label className="field"><span className="field-label">Nombre</span>
              <input value={project.name} onChange={(e) => updateProject({ name: e.target.value })} />
            </label>
            <div className="grid-2 tight">
              <label className="field"><span className="field-label">Formato</span>
                <select value={project.aspect} onChange={(e) => setAspect(e.target.value as typeof project.aspect)}>
                  {Object.values(ASPECTS).map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                </select>
              </label>
              <label className="field"><span className="field-label">FPS</span>
                <select value={project.fps} onChange={(e) => updateProject({ fps: Number(e.target.value) })}>
                  <option value={24}>24</option><option value={25}>25</option><option value={30}>30</option><option value={50}>50</option><option value={60}>60</option>
                </select>
              </label>
            </div>
            <div className="grid-2 tight">
              <label className="field"><span className="field-label">Duración (min)</span>
                <input type="number" min={0.1} max={600} step={0.5} value={Math.round((project.duration / 60) * 100) / 100}
                  onChange={(e) => setDuration((Number(e.target.value) || 1) * 60)} />
              </label>
              <label className="field"><span className="field-label">Resolución</span>
                <input value={`${project.width}×${project.height}`} readOnly />
              </label>
            </div>
            <div className="stat-line"><span>Duración</span><strong>{formatClock(project.duration)}</strong></div>
            <div className="stat-line"><span>Clips</span><strong>{project.clips.length}</strong></div>
            <div className="stat-line"><span>Pistas</span><strong>{project.tracks.length}</strong></div>
          </div>

          <div className="insp-group">
            <span className="insp-title">Imagen</span>
            <label className="field"><span className="field-label">Color de fondo</span>
              <div className="color-row">
                <input type="color" value={project.background} onChange={(e) => updateProject({ background: e.target.value })} />
                <input value={project.background} onChange={(e) => updateProject({ background: e.target.value })} />
              </div>
            </label>
            <label className="field"><span className="field-label">Grano de película</span>
              <Slider value={project.grain} min={0} max={100} onStart={beginInteraction} onChange={(v) => updateProject({ grain: v })} />
            </label>
            <div className="switch-row"><span>Viñeta cinematográfica</span><Toggle checked={project.vignette} onChange={(v) => updateProject({ vignette: v })} /></div>
          </div>

          <div className="insp-group">
            <span className="insp-title"><Music size={14} /> Música generativa</span>
            <div className="switch-row"><span>Activar banda sonora</span><Toggle checked={project.music.enabled} onChange={(v) => setMusic({ enabled: v })} /></div>
            <label className="field"><span className="field-label">Ambiente</span>
              <select value={project.music.mood} onChange={(e) => setMusic({ mood: e.target.value as typeof project.music.mood })}>
                {MUSIC_MOODS.map((m) => <option key={m} value={m}>{MUSIC_MOOD_LABELS[m]}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Volumen</span>
              <Slider value={project.music.volume * 100} min={0} max={100} onStart={beginInteraction} onChange={(v) => setMusic({ volume: v / 100 })} suffix="%" />
            </label>
          </div>

          <div className="insp-group">
            <span className="insp-title">Proyecto</span>
            <button className="btn btn-ghost btn-block btn-sm" onClick={() => {
              const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
              downloadBlob(blob, `${project.name.replace(/[^\w-]+/g, '-')}.vidora.json`);
            }}><Download size={14} /> Descargar proyecto (.json)</button>
            <button className="btn btn-ghost btn-block btn-sm" onClick={() => {
              const cover = renderThumbnail(project, Math.min(playhead, project.duration - 0.1), 640);
              updateProject({ cover });
            }}><Image size={14} /> Usar frame actual como portada</button>
          </div>
        </div>
      )}

      {clip && (
        <div className="inspector-body">
          <div className="inspector-head">
            <div>
              <span className="panel-kicker" style={{ color: KIND_META[clip.kind].color }}>
                {KIND_META[clip.kind].label}
              </span>
              <h3>{clip.name}</h3>
            </div>
            <div className="insp-actions">
              <button className="icon-btn" title="Duplicar" onClick={() => duplicateClip(clip.id)}><Copy size={14} /></button>
              <button className="icon-btn" title="Dividir en playhead" onClick={() => splitClip(clip.id, playhead)}><Scissors size={14} /></button>
              <button className="icon-btn danger" title="Eliminar" onClick={() => removeClip(clip.id)}><Trash2 size={14} /></button>
            </div>
          </div>

          <div className="insp-group">
            <label className="field"><span className="field-label">Nombre del clip</span>
              <input value={clip.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <div className="grid-3 tight">
              <label className="field"><span className="field-label">Inicio (s)</span>
                <input type="number" min={0} step={0.1} value={Math.round(clip.start * 100) / 100} onChange={(e) => set({ start: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="field"><span className="field-label">Duración</span>
                <input type="number" min={0.3} step={0.1} value={Math.round(clip.duration * 100) / 100} onChange={(e) => set({ duration: Math.max(0.3, Number(e.target.value)) })} />
              </label>
              <label className="field"><span className="field-label">Opacidad</span>
                <input type="number" min={0} max={100} value={Math.round(clip.opacity * 100)} onChange={(e) => set({ opacity: Number(e.target.value) / 100 })} />
              </label>
            </div>
            <div className="grid-2 tight">
              <label className="field"><span className="field-label">Fundido entrada (s)</span>
                <input type="number" min={0} max={5} step={0.1} value={clip.fadeIn} onChange={(e) => set({ fadeIn: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="field"><span className="field-label">Fundido salida (s)</span>
                <input type="number" min={0} max={5} step={0.1} value={clip.fadeOut} onChange={(e) => set({ fadeOut: Math.max(0, Number(e.target.value)) })} />
              </label>
            </div>
          </div>

          {clip.kind === 'scene' && (
            <div className="insp-group">
              <span className="insp-title"><Layers size={14} /> Escena generada</span>
              <label className="field"><span className="field-label">Plantilla</span>
                <select value={clip.template} onChange={(e) => set({ template: e.target.value })}>
                  {SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label className="field"><span className="field-label">Título</span>
                <input value={clip.title} onChange={(e) => set({ title: e.target.value })} />
              </label>
              <label className="field"><span className="field-label">Subtítulo</span>
                <textarea rows={2} value={clip.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
              </label>
              <div className="switch-row"><span>Mostrar texto en escena</span><Toggle checked={clip.showText} onChange={(v) => set({ showText: v })} /></div>
              <label className="field"><span className="field-label">Movimiento de cámara</span>
                <select value={clip.motion} onChange={(e) => set({ motion: e.target.value })}>
                  <option value="kenburns">Ken Burns</option>
                  <option value="parallax">Parallax</option>
                  <option value="zoom-in">Zoom in</option>
                  <option value="zoom-out">Zoom out</option>
                  <option value="static">Estático</option>
                </select>
              </label>
              <div className="field">
                <span className="field-label">Paleta</span>
                <div className="palette-row">
                  {[0, 1, 2].map((i) => (
                    <input key={i} type="color" value={clip.palette[i] || '#000000'} onChange={(e) => {
                      const palette = [...clip.palette];
                      palette[i] = e.target.value;
                      set({ palette });
                    }} />
                  ))}
                  <button className="icon-btn" title="Nueva semilla" onClick={() => set({ seed: Math.floor(Math.random() * 100000) })}><RotateCcw size={13} /></button>
                </div>
              </div>
            </div>
          )}

          {clip.kind === 'text' && (
            <div className="insp-group">
              <span className="insp-title"><TypeIcon size={14} /> Tipografía</span>
              <label className="field"><span className="field-label">Texto</span>
                <textarea rows={3} value={clip.text} onChange={(e) => set({ text: e.target.value })} />
              </label>
              <div className="grid-2 tight">
                <label className="field"><span className="field-label">Fuente</span>
                  <select value={clip.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
                    <option value="Sora">Sora</option>
                    <option value="Instrument Serif">Instrument Serif</option>
                  </select>
                </label>
                <label className="field"><span className="field-label">Peso</span>
                  <select value={clip.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) })}>
                    <option value={300}>300</option><option value={400}>400</option><option value={500}>500</option><option value={600}>600</option><option value={700}>700</option>
                  </select>
                </label>
              </div>
              <div className="grid-3 tight">
                <label className="field"><span className="field-label">Tamaño</span>
                  <input type="number" min={8} max={300} value={clip.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
                </label>
                <label className="field"><span className="field-label">Interletra</span>
                  <input type="number" min={-10} max={40} value={clip.letterSpacing} onChange={(e) => set({ letterSpacing: Number(e.target.value) })} />
                </label>
                <label className="field"><span className="field-label">Color</span>
                  <input type="color" value={clip.color} onChange={(e) => set({ color: e.target.value })} />
                </label>
              </div>
              <div className="grid-2 tight">
                <label className="field"><span className="field-label">Animación</span>
                  <select value={clip.animation} onChange={(e) => set({ animation: e.target.value })}>
                    {ANIMATIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </label>
                <label className="field"><span className="field-label">Alineación</span>
                  <select value={clip.align} onChange={(e) => set({ align: e.target.value })}>
                    <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
                  </select>
                </label>
              </div>
              <div className="grid-3 tight">
                <label className="field"><span className="field-label">X</span>
                  <input type="number" min={0} max={1} step={0.01} value={clip.x} onChange={(e) => set({ x: Number(e.target.value) })} />
                </label>
                <label className="field"><span className="field-label">Y</span>
                  <input type="number" min={0} max={1} step={0.01} value={clip.y} onChange={(e) => set({ y: Number(e.target.value) })} />
                </label>
                <label className="field"><span className="field-label">Ancho</span>
                  <input type="number" min={0.1} max={1} step={0.01} value={clip.width} onChange={(e) => set({ width: Number(e.target.value) })} />
                </label>
              </div>
              <div className="switch-row"><span>Mayúsculas</span><Toggle checked={clip.uppercase} onChange={(v) => set({ uppercase: v })} /></div>
              <div className="switch-row"><span>Fondo oscuro</span><Toggle checked={clip.background} onChange={(v) => set({ background: v })} /></div>
            </div>
          )}

          {clip.kind === 'media' && (
            <div className="insp-group">
              <span className="insp-title"><Film size={14} /> Medio</span>
              <label className="field"><span className="field-label">Ajuste</span>
                <select value={clip.fit} onChange={(e) => set({ fit: e.target.value })}>
                  <option value="cover">Cubrir</option><option value="contain">Contener</option>
                </select>
              </label>
              <label className="field"><span className="field-label">Punto de entrada (s)</span>
                <input type="number" min={0} step={0.1} value={clip.inPoint} onChange={(e) => set({ inPoint: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="field"><span className="field-label">Escala</span>
                <Slider value={clip.scale * 100} min={10} max={300} step={1} onStart={beginInteraction} onChange={(v) => set({ scale: v / 100 })} suffix="%" />
              </label>
              <label className="field"><span className="field-label">Posición X</span>
                <Slider value={clip.x * 100} min={-100} max={100} onStart={beginInteraction} onChange={(v) => set({ x: v / 100 })} suffix="%" />
              </label>
              <label className="field"><span className="field-label">Posición Y</span>
                <Slider value={clip.y * 100} min={-100} max={100} onStart={beginInteraction} onChange={(v) => set({ y: v / 100 })} suffix="%" />
              </label>
              <label className="field"><span className="field-label">Rotación</span>
                <Slider value={clip.rotation} min={-180} max={180} onStart={beginInteraction} onChange={(v) => set({ rotation: v })} suffix="°" />
              </label>
            </div>
          )}

          {clip.kind === 'audio' && (
            <div className="insp-group">
              <span className="insp-title"><Music size={14} /> Audio</span>
              <label className="field"><span className="field-label">Volumen</span>
                <Slider value={(clip.volume ?? 1) * 100} min={0} max={100} onStart={beginInteraction} onChange={(v) => set({ volume: v / 100 })} suffix="%" />
              </label>
              <label className="field"><span className="field-label">Punto de entrada (s)</span>
                <input type="number" min={0} step={0.1} value={clip.inPoint} onChange={(e) => set({ inPoint: Math.max(0, Number(e.target.value)) })} />
              </label>
              <div className="switch-row"><span>Repetir hasta el final</span><Toggle checked={clip.loop} onChange={(v) => set({ loop: v })} /></div>
            </div>
          )}

          <div className="insp-group">
            <div className="insp-title-row">
              <span className="insp-title">Color y filtros</span>
              <button className="link-btn" onClick={() => updateFilter(clip.id, { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 })}>Restablecer</button>
            </div>
            <label className="field"><span className="field-label">Brillo</span>
              <Slider value={clip.filter.brightness} min={0} max={200} onStart={beginInteraction} onChange={(v) => updateFilter(clip.id, { brightness: v })} suffix="%" />
            </label>
            <label className="field"><span className="field-label">Contraste</span>
              <Slider value={clip.filter.contrast} min={0} max={200} onStart={beginInteraction} onChange={(v) => updateFilter(clip.id, { contrast: v })} suffix="%" />
            </label>
            <label className="field"><span className="field-label">Saturación</span>
              <Slider value={clip.filter.saturate} min={0} max={200} onStart={beginInteraction} onChange={(v) => updateFilter(clip.id, { saturate: v })} suffix="%" />
            </label>
            <label className="field"><span className="field-label">Desenfoque</span>
              <Slider value={clip.filter.blur} min={0} max={30} onStart={beginInteraction} onChange={(v) => updateFilter(clip.id, { blur: v })} suffix="px" />
            </label>
            <label className="field"><span className="field-label">Rotación de tono</span>
              <Slider value={clip.filter.hue} min={-180} max={180} onStart={beginInteraction} onChange={(v) => updateFilter(clip.id, { hue: v })} suffix="°" />
            </label>
          </div>

          <div className="insp-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => endInteraction()} style={{ display: 'none' }}>fin</button>
            <span>Clip seleccionado</span>
            <button className="btn btn-ghost btn-sm" onClick={() => useEditor.getState().selectClip(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </aside>
  );
}
