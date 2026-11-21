import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  Clapperboard,
  Download,
  LayoutPanelLeft,
  Monitor,
  Redo2,
  Settings,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import type { AgentAction } from '@/lib/ai';
import { generateStoryboard, LANDMARKS } from '@/lib/ai';
import type { AspectId, DesktopCommand, MusicMood, Project, SceneClip, SceneTemplate, Storyboard, TextClip } from '@/types';
import { MUSIC_MOODS } from '@/types';
import { useEditor } from '@/store/editor';
import { useSettings } from '@/store/settings';
import { getProject, saveProject } from '@/lib/storage';
import { hydrateProjectAssets } from '@/lib/assets';
import { createProject, makeSceneClip, storyboardToProject } from '@/lib/project';
import { renderThumbnail } from '@/engine/renderer';
import { registerStateProvider, isEmbeddedDesktop } from '@/lib/desktop';
import { toast } from '@/lib/toast';
import { formatClock, uid } from '@/lib/utils';
import LeftPanel from './LeftPanel';
import Preview from './Preview';
import Timeline from './Timeline';
import Inspector from './Inspector';
import ExportModal from './ExportModal';
import { Logo, Spinner } from './ui';

const SCENE_PALETTES: Record<string, string[]> = {
  aurora: ['#ff6a3d', '#8b5cf6', '#0a0a14'],
  nebula: ['#8b5cf6', '#22d3ee', '#05040d'],
  grid: ['#ff3d77', '#8b5cf6', '#080312'],
  particles: ['#f59e0b', '#ef4444', '#0b0705'],
  waves: ['#34d399', '#0ea5e9', '#04100d'],
  spotlight: ['#e2e8f0', '#f59e0b', '#08080c'],
  skyline: ['#f472b6', '#facc15', '#140810'],
  editorial: ['#e7c873', '#a8792d', '#0b0905'],
};

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export default function Studio({
  projectId,
  onBack,
  onHome,
  onSettings,
  onProjectsChanged,
}: {
  projectId: string;
  onBack: () => void;
  onHome: () => void;
  onSettings: () => void;
  onProjectsChanged: () => void;
}) {
  const project = useEditor((s) => s.project);
  const dirty = useEditor((s) => s.dirty);
  const playhead = useEditor((s) => s.playhead);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const setProject = useEditor((s) => s.setProject);
  const updateProject = useEditor((s) => s.updateProject);
  const setDuration = useEditor((s) => s.setDuration);
  const setMusic = useEditor((s) => s.setMusic);
  const addClip = useEditor((s) => s.addClip);
  const addTrack = useEditor((s) => s.addTrack);
  const removeClip = useEditor((s) => s.removeClip);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const markSaved = useEditor((s) => s.markSaved);
  const settings = useSettings();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [exportOpen, setExportOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'left' | 'right' | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState('');
  const [lastStoryboard, setLastStoryboard] = useState<Storyboard | null>(null);
  const pendingRan = useRef(false);
  const saveTimer = useRef<number | null>(null);

  // Load project
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProject(projectId).then(async (p) => {
      if (cancelled) return;
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProject(p);
      await hydrateProjectAssets(p);
      if (!cancelled) {
        setLoading(false);
        setSaveState('saved');
      }
    });
    return () => { cancelled = true; };
  }, [projectId, setProject]);

  // Autosave
  useEffect(() => {
    if (!project || !dirty) return;
    setSaveState('dirty');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const snapshot = useEditor.getState().project;
      if (!snapshot) return;
      setSaveState('saving');
      try {
        await saveProject(snapshot);
        markSaved();
        setSaveState('saved');
        onProjectsChanged();
      } catch {
        setSaveState('error');
      }
    }, 750);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, dirty]);

  // Desktop state bridge
  useEffect(() => {
    registerStateProvider(() => {
      const st = useEditor.getState();
      const p = st.project;
      return {
        ready: Boolean(p),
        project: p
          ? {
              id: p.id,
              name: p.name,
              duration: p.duration,
              minutes: Math.round((p.duration / 60) * 100) / 100,
              aspect: p.aspect,
              width: p.width,
              height: p.height,
              fps: p.fps,
              scenes: p.clips.filter((c) => c.kind === 'scene').length,
              clips: p.clips.length,
              tracks: p.tracks.map((t) => ({ name: t.name, type: t.type, clips: p.clips.filter((c) => c.trackId === t.id).length })),
              music: p.music,
            }
          : null,
        playhead: st.playhead,
        playing: st.playing,
        selectedClipId: st.selectedClipId,
      };
    });
    return () => registerStateProvider(null);
  }, []);

  const addSceneAtPlayhead = useCallback(
    (template: SceneTemplate, palette: string[], duration = 6, title = '') => {
      const state = useEditor.getState();
      const p = state.project;
      if (!p) return;
      const track = p.tracks.find((t) => t.type === 'video');
      if (!track) return;
      const clip = makeSceneClip(track.id, state.playhead, duration, {
        template,
        palette,
        title: title || '',
        subtitle: '',
        name: title || `Escena ${template}`,
        seed: Math.floor(Math.random() * 100000),
      });
      addClip(clip);
      toast(`Escena ${template} añadida`, 'success');
    },
    [addClip]
  );

  const addTextAtPlayhead = useCallback(
    (preset: { label: string; data: Record<string, unknown> }, text?: string) => {
      const state = useEditor.getState();
      const p = state.project;
      if (!p) return;
      let track = p.tracks.find((t) => t.type === 'text');
      if (!track) {
        const id = addTrack('text');
        if (!id) return;
        track = useEditor.getState().project?.tracks.find((t) => t.id === id);
      }
      if (!track) return;
      const clip: TextClip = {
        id: uid('clip'),
        trackId: track.id,
        kind: 'text',
        name: preset.label,
        start: state.playhead,
        duration: Math.min(4.5, Math.max(1.2, p.duration - state.playhead)),
        fadeIn: 0.3,
        fadeOut: 0.4,
        opacity: 1,
        filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
        text: text || String(preset.data.text || 'Tu texto aquí'),
        fontFamily: (preset.data.fontFamily as TextClip['fontFamily']) || 'Sora',
        fontSize: Number(preset.data.fontSize) || 48,
        fontWeight: Number(preset.data.fontWeight) || 500,
        color: String(preset.data.color || '#ffffff'),
        align: (preset.data.align as TextClip['align']) || 'center',
        x: Number(preset.data.x) || 0.5,
        y: Number(preset.data.y) || 0.5,
        animation: (preset.data.animation as TextClip['animation']) || 'fade',
        uppercase: Boolean(preset.data.uppercase),
        letterSpacing: Number(preset.data.letterSpacing) || 0,
        background: Boolean(preset.data.background),
        width: Number(preset.data.width) || 0.7,
      };
      addClip(clip);
      toast(`Texto «${clip.name}» añadido`, 'success');
    },
    [addClip, addTrack]
  );

  const addCaptions = useCallback(async () => {
    const { buildCaptionClips } = await import('@/lib/ai');
    const state = useEditor.getState();
    const p = state.project;
    if (!p) return;
    const existing = p.clips.filter((c) => c.kind === 'text' && c.name.startsWith('Subtítulo'));
    if (existing.length && !confirm(`Ya hay ${existing.length} subtítulos. ¿Reemplazarlos?`)) return;
    existing.forEach((c) => removeClip(c.id));
    let track = p.tracks.find((t) => t.type === 'text');
    if (!track) {
      const id = addTrack('text');
      if (!id) return;
      track = useEditor.getState().project?.tracks.find((t) => t.id === id);
    }
    if (!track) return;
    const clips = buildCaptionClips(p);
    clips.forEach((c) => {
      c.trackId = track!.id;
      addClip(c, false);
    });
    toast(`${clips.length} subtítulos generados`, 'success');
  }, [addClip, addTrack, removeClip]);

  const runGeneration = useCallback(
    async (prompt: string, minutes: number, aspect: AspectId) => {
      const current = useEditor.getState().project;
      if (!current) return;
      const total = Math.max(0.2, minutes);
      setGenerating(true);
      setGenStage('Analizando tu idea…');
      const started = performance.now();
      try {
        const result = await generateStoryboard(prompt, total, aspect, settings.ai, setGenStage);
        setGenStage('Montando el timeline…');
        const base = storyboardToProject(result.storyboard, {
          minutes: total,
          aspect,
          prompt,
          name: current.name && !/sin título|nuevo proyecto|video con ia/i.test(current.name) ? current.name : result.storyboard.title,
        });
        base.id = current.id;
        base.createdAt = current.createdAt;
        base.aiGenerated = true;
        try { await document.fonts.ready; } catch { /* noop */ }
        base.cover = renderThumbnail(base, Math.min(1.2, base.duration * 0.2), 640);
        const wait = Math.max(0, 900 - (performance.now() - started));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        setProject(base);
        setLastStoryboard(result.storyboard);
        await saveProject(base);
        onProjectsChanged();
        toast(result.usedAI ? `Guion generado con ${result.model || 'Ollama'}. Proyecto montado.` : 'Proyecto montado con el director local.', result.usedAI ? 'success' : 'info');
        if (result.error) toast(result.error, 'warning', 7000);
      } catch (e) {
        toast(`No se pudo generar: ${(e as Error).message}`, 'error');
      } finally {
        setGenerating(false);
        setGenStage('');
      }
    },
    [settings.ai, setProject, onProjectsChanged]
  );

  // Pending generation requested from landing/dashboard
  useEffect(() => {
    if (loading || pendingRan.current) return;
    const raw = sessionStorage.getItem('vidora:pending');
    if (!raw) return;
    pendingRan.current = true;
    sessionStorage.removeItem('vidora:pending');
    try {
      const pending = JSON.parse(raw) as { prompt: string; minutes: number; aspect: AspectId };
      if (pending.prompt) {
        runGeneration(pending.prompt, pending.minutes || 1, pending.aspect || '16:9');
      }
    } catch { /* noop */ }
  }, [loading, runGeneration]);

  const handleAgentAction = useCallback(
    (action: AgentAction) => {
      const state = useEditor.getState();
      const p = state.project;
      if (!p) return;
      switch (action.type) {
        case 'set_duration':
          if (action.minutes) {
            setDuration(action.minutes * 60);
            toast(`Duración ajustada a ${action.minutes} minutos`, 'success');
          }
          break;
        case 'generate':
          if (action.prompt) {
            void runGeneration(action.prompt, action.minutes || Math.max(1, Math.round(p.duration / 60)), (action.aspect as AspectId) || p.aspect);
          }
          break;
        case 'add_scene': {
          const template = (action.template as SceneTemplate) || (action.mood as SceneTemplate) || 'aurora';
          addSceneAtPlayhead(
            template,
            SCENE_PALETTES[template] || SCENE_PALETTES.aurora,
            action.duration || 6,
            action.title || action.text || ''
          );
          break;
        }
        case 'add_text':
          if (action.text) addTextAtPlayhead({ label: 'Texto IA', data: { fontSize: 64, fontFamily: 'Sora', y: 0.5 } }, action.text);
          break;
        case 'set_mood':
          if (action.mood && MUSIC_MOODS.includes(action.mood as MusicMood)) {
            setMusic({ mood: action.mood as MusicMood, enabled: true });
          }
          break;
        case 'set_landscape': {
          const land = LANDMARKS.find((l) => l.id === action.landscape);
          if (!land) break;
          const sceneClips = p.clips.filter((c) => c.kind === 'scene') as SceneClip[];
          sceneClips.forEach((c, i) => useEditor.getState().updateClip(c.id, {
            template: land.templates[i % land.templates.length],
            palette: land.palettes[i % land.palettes.length],
          }));
          setMusic({ mood: land.defaultMood, enabled: true });
          toast(`Reformo el paisaje a ${land.label}`, 'success');
          break;
        }
        case 'play': useEditor.getState().setPlaying(true); break;
        case 'pause': useEditor.getState().setPlaying(false); break;
        case 'export': setExportOpen(true); break;
        default:
          toast(`Acción desconocida: ${action.type}`, 'warning');
      }
    },
    [addSceneAtPlayhead, addTextAtPlayhead, runGeneration, setDuration, setMusic]
  );

  // Desktop commands
  useEffect(() => {
    const handler = (e: Event) => {
      const cmd = (e as CustomEvent<DesktopCommand>).detail;
      const payload = cmd.payload || {};
      switch (cmd.action) {
        case 'set_duration':
          if (payload.minutes) {
            setDuration(Number(payload.minutes) * 60);
            toast(`Duración: ${payload.minutes} min`, 'success');
          }
          break;
        case 'generate': {
          const prompt = String(payload.prompt || '').trim();
          if (prompt) {
            const st = useEditor.getState();
            void runGeneration(prompt, Number(payload.minutes) || 2, ((String(payload.aspect) || '') || (st.project?.aspect ?? '16:9')) as AspectId);
          }
          break;
        }
        case 'play': useEditor.getState().setPlaying(true); break;
        case 'pause': useEditor.getState().setPlaying(false); break;
        case 'export': setExportOpen(true); break;
        case 'add_text':
          addTextAtPlayhead({ label: 'Texto copiloto', data: { fontSize: 72, fontFamily: 'Instrument Serif', y: 0.48 } }, String(payload.text || 'Texto desde el copiloto'));
          break;
        case 'add_scene': {
          const template = String(payload.template || 'nebula') as SceneTemplate;
          addSceneAtPlayhead(template, SCENE_PALETTES[template] || SCENE_PALETTES.aurora, Number(payload.duration) || 6, String(payload.title || ''));
          break;
        }
        case 'set_mood':
          if (payload.mood && MUSIC_MOODS.includes(String(payload.mood) as MusicMood)) {
            setMusic({ mood: String(payload.mood) as MusicMood, enabled: true });
          }
          break;
        case 'set_landscape': {
          const land = LANDMARKS.find((l) => l.id === String(payload.landscape || ''));
          const p = useEditor.getState().project;
          if (land && p) {
            const sceneClips = p.clips.filter((c) => c.kind === 'scene') as SceneClip[];
            sceneClips.forEach((c, i) => useEditor.getState().updateClip(c.id, {
              template: land.templates[i % land.templates.length],
              palette: land.palettes[i % land.palettes.length],
            }));
            setMusic({ mood: land.defaultMood, enabled: true });
            toast(`Reformo el paisaje a ${land.label}`, 'success');
          }
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('vidora:command', handler);
    return () => window.removeEventListener('vidora:command', handler);
  }, [addSceneAtPlayhead, addTextAtPlayhead, runGeneration, setDuration, setMusic]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      const st = useEditor.getState();
      if (!st.project) return;
      if (e.code === 'Space') {
        e.preventDefault();
        st.togglePlay();
      } else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey && st.selectedClipId) {
        e.preventDefault();
        st.splitClip(st.selectedClipId, st.playhead);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedClipId) {
        e.preventDefault();
        st.removeClip(st.selectedClipId);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo(); else st.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && st.selectedClipId) {
        e.preventDefault();
        st.duplicateClip(st.selectedClipId);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportOpen(true);
      } else if (e.key === 'ArrowLeft') {
        st.setPlayhead(Math.max(0, st.playhead - (e.shiftKey ? 5 : 1)));
      } else if (e.key === 'ArrowRight') {
        st.setPlayhead(Math.min(st.project.duration, st.playhead + (e.shiftKey ? 5 : 1)));
      } else if (e.key === 'Escape') {
        st.selectClip(null);
        setMobilePanel(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!project) return;
    document.title = `${project.name} · Vidora`;
    return () => { document.title = 'Vidora — Video con IA local'; };
  }, [project?.name]);

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner size={28} />
        <p>Cargando estudio…</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="center-screen">
        <Logo size={38} />
        <h2>No encontramos ese proyecto</h2>
        <button className="btn btn-primary" onClick={onBack}>Volver a proyectos</button>
      </div>
    );
  }

  const minutes = Math.round((project.duration / 60) * 10) / 10;

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="sh-left">
          <button className="icon-btn" onClick={onBack} title="Volver a proyectos"><ArrowLeft size={17} /></button>
          <button className="sh-brand" onClick={onHome} title="Inicio"><Logo size={24} /></button>
          <div className="project-name-wrap">
            <input
              className="project-name"
              value={project.name}
              onChange={(e) => updateProject({ name: e.target.value })}
              spellCheck={false}
              aria-label="Nombre del proyecto"
            />
            <span className={`save-state ${saveState}`}>
              {saveState === 'saving' ? <><Spinner size={10} /> Guardando</> : saveState === 'dirty' ? 'Sin guardar' : saveState === 'error' ? 'Error al guardar' : <><Check size={11} /> Guardado</>}
            </span>
          </div>
        </div>

        <div className="sh-center">
          <div className="history-controls">
            <button className="icon-btn" onClick={undo} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
            <button className="icon-btn" onClick={redo} title="Rehacer (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
          </div>
          <span className="sh-divider" />
          <span className="sh-duration" title="Duración del proyecto"><Clapperboard size={13} /> {formatClock(project.duration)}</span>
          <select
            className="sh-aspect"
            value={project.aspect}
            onChange={(e) => useEditor.getState().setAspect(e.target.value as AspectId)}
            title="Formato"
          >
            {['16:9', '9:16', '1:1', '4:5', '21:9'].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {isEmbeddedDesktop() && <span className="desktop-badge"><Monitor size={12} /> Copiloto</span>}
        </div>

        <div className="sh-right">
          <button className="btn btn-ghost btn-sm mobile-only" onClick={() => setMobilePanel(mobilePanel === 'left' ? null : 'left')}><Sparkles size={15} /> IA</button>
          <button className="btn btn-ghost btn-sm desktop-hide-sm" onClick={() => setMobilePanel(mobilePanel === 'right' ? null : 'right')}><LayoutPanelLeft size={15} /> Propiedades</button>
          <button className="btn btn-ghost btn-sm" onClick={onSettings} title="Ajustes"><Settings size={15} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setExportOpen(true)}><Download size={15} /> Exportar</button>
        </div>
      </header>

      <div className={`studio-workspace mobile-${mobilePanel || 'none'}`}>
        <LeftPanel
          generating={generating}
          onGenerate={runGeneration}
          onAgentAction={handleAgentAction}
          onAddScene={(template, palette, duration) => addSceneAtPlayhead(template, palette, duration)}
          onAddText={addTextAtPlayhead}
          onAddCaptions={addCaptions}
          onOpenExport={() => setExportOpen(true)}
          onOpenSettings={onSettings}
          lastStoryboard={lastStoryboard}
        />
        <main className="studio-center">
          <Preview />
        </main>
        <Inspector />
      </div>

      <Timeline />

      {mobilePanel && <button className="mobile-scrim" onClick={() => setMobilePanel(null)} aria-label="Cerrar panel" />}

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />

      {generating && (
        <div className="generating-overlay">
          <div className="gen-card">
            <div className="gen-orbit">
              <div className="gen-ring r1" />
              <div className="gen-ring r2" />
              <div className="gen-core"><Wand2 size={24} /></div>
            </div>
            <h2>El director IA está trabajando</h2>
            <p className="gen-stage">{genStage || 'Preparando…'}</p>
            <div className="gen-steps">
              {['Analizando tu idea', 'Escribiendo el guion', 'Diseñando las escenas', 'Montando el timeline'].map((s, i) => (
                <span key={s} className={genStage.toLowerCase().includes(s.split(' ')[0].toLowerCase()) || i === 0 ? 'active' : ''}>{s}</span>
              ))}
            </div>
            <div className="gen-bar"><span /></div>
            <p className="muted small">Todo ocurre en tu equipo · Ollama + render local</p>
            <button className="icon-btn gen-close" onClick={() => setGenerating(false)} aria-label="Cerrar"><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
