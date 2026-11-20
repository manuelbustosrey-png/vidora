import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AudioLines,
  Bot,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Type as TypeIcon,
  Upload,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';
import type { AgentAction } from '@/lib/ai';
import { buildCaptionClips, demoAgentReply, generateSeo, improvePrompt, extractActions } from '@/lib/ai';
import type { AiSettings, AssetMeta, AspectId, Clip, SceneTemplate, Storyboard, TextClip, TrackType } from '@/types';
import { ASPECTS } from '@/types';
import { useEditor } from '@/store/editor';
import { useSettings } from '@/store/settings';
import { listModels } from '@/lib/ollama';
import { chat, type ChatMessage } from '@/lib/ollama';
import { importFile, projectAssets, getRuntime } from '@/lib/assets';
import { TRACK_META, makeSceneClip } from '@/lib/project';
import { formatClock, uid } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Badge, DurationPicker, Spinner } from './ui';

const TABS = [
  { id: 'ai', label: 'IA', icon: Sparkles },
  { id: 'media', label: 'Medios', icon: Film },
  { id: 'scenes', label: 'Escenas', icon: Clapperboard },
  { id: 'text', label: 'Texto', icon: TypeIcon },
  { id: 'audio', label: 'Audio', icon: AudioLines },
] as const;

type TabId = (typeof TABS)[number]['id'];

const SCENE_TEMPLATES: Array<{ id: SceneTemplate; name: string; tag: string; palette: string[] }> = [
  { id: 'aurora', name: 'Aurora', tag: 'Cinematográfico', palette: ['#ff6a3d', '#8b5cf6', '#0a0a14'] },
  { id: 'nebula', name: 'Nebulosa', tag: 'Espacio', palette: ['#8b5cf6', '#22d3ee', '#05040d'] },
  { id: 'grid', name: 'Horizonte', tag: 'Synthwave', palette: ['#ff3d77', '#8b5cf6', '#080312'] },
  { id: 'particles', name: 'Bokeh', tag: 'Retrato', palette: ['#f59e0b', '#ef4444', '#0b0705'] },
  { id: 'waves', name: 'Olas', tag: 'Naturaleza', palette: ['#34d399', '#0ea5e9', '#04100d'] },
  { id: 'spotlight', name: 'Focos', tag: 'Escenario', palette: ['#e2e8f0', '#f59e0b', '#08080c'] },
  { id: 'skyline', name: 'Ciudad', tag: 'Urbano', palette: ['#f472b6', '#facc15', '#140810'] },
  { id: 'editorial', name: 'Editorial', tag: 'Marca', palette: ['#e7c873', '#a8792d', '#0b0905'] },
];

const STYLE_CHIPS = [
  { label: 'Cinematográfico', text: 'estética cinematográfica, luz dramática, grano de película' },
  { label: 'Neón', text: 'estética cyberpunk, neones, lluvia, reflejos' },
  { label: 'Naturaleza', text: 'naturaleza, luz dorada, cámara lenta, texturas orgánicas' },
  { label: 'Lujo', text: 'editorial de lujo, minimalismo, oro, mármol, elegante' },
  { label: 'Espacio', text: 'cosmos, nebulosas, estrellas, escala épica' },
];

const TEXT_PRESETS = [
  {
    id: 'title', label: 'Título principal', hint: 'Serif editorial · centrado', data: {
      text: 'Tu historia empieza aquí', fontFamily: 'Instrument Serif' as const, fontSize: 100, fontWeight: 400,
      color: '#ffffff', align: 'center' as const, x: 0.5, y: 0.45, animation: 'slide-up' as const, uppercase: false,
      letterSpacing: -1, background: false, width: 0.78,
    },
  },
  {
    id: 'subtitle', label: 'Subtítulo', hint: 'Sora · centrado', data: {
      text: 'Una idea que merece ser contada.', fontFamily: 'Sora' as const, fontSize: 34, fontWeight: 400,
      color: '#e9e4d8', align: 'center' as const, x: 0.5, y: 0.58, animation: 'fade' as const, uppercase: false,
      letterSpacing: 0.5, background: false, width: 0.62,
    },
  },
  {
    id: 'cta', label: 'Llamada a la acción', hint: 'Con fondo · abajo', data: {
      text: 'Sígueme para más', fontFamily: 'Sora' as const, fontSize: 30, fontWeight: 600,
      color: '#ffffff', align: 'center' as const, x: 0.5, y: 0.88, animation: 'pop' as const, uppercase: true,
      letterSpacing: 2, background: true, width: 0.7,
    },
  },
  {
    id: 'quote', label: 'Cita', hint: 'Serif grandes', data: {
      text: '«Lo importante no es lo que ves, sino lo que sientes.»', fontFamily: 'Instrument Serif' as const, fontSize: 62, fontWeight: 400,
      color: '#ffffff', align: 'center' as const, x: 0.5, y: 0.5, animation: 'fade' as const, uppercase: false,
      letterSpacing: -0.5, background: false, width: 0.76,
    },
  },
  {
    id: 'credit', label: 'Crédito', hint: 'Pequeño · abajo izquierda', data: {
      text: 'Dirección · Tu nombre', fontFamily: 'Sora' as const, fontSize: 22, fontWeight: 400,
      color: '#d9d4c8', align: 'left' as const, x: 0.06, y: 0.92, animation: 'fade' as const, uppercase: true,
      letterSpacing: 2.5, background: false, width: 0.5,
    },
  },
  {
    id: 'letterbox', label: 'Cinta / capítulo', hint: 'Minimal · superior', data: {
      text: 'CAPÍTULO 01 · EL COMIENZO', fontFamily: 'Sora' as const, fontSize: 20, fontWeight: 500,
      color: '#ffffff', align: 'left' as const, x: 0.06, y: 0.08, animation: 'typewriter' as const, uppercase: true,
      letterSpacing: 4, background: false, width: 0.6,
    },
  },
];

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending?: boolean;
  error?: boolean;
}

function gradient(palette: string[]): string {
  return `radial-gradient(110% 130% at 20% 15%, ${palette[0]}aa, transparent 58%), radial-gradient(110% 120% at 80% 85%, ${palette[1]}88, transparent 62%), ${palette[2]}`;
}

export default function LeftPanel({
  generating,
  onGenerate,
  onAgentAction,
  onAddScene,
  onAddText,
  onAddCaptions,
  onOpenExport,
  onOpenSettings,
  lastStoryboard,
}: {
  generating: boolean;
  onGenerate: (prompt: string, minutes: number, aspect: AspectId) => void;
  onAgentAction: (action: AgentAction) => void;
  onAddScene: (template: SceneTemplate, palette: string[], duration: number) => void;
  onAddText: (preset: (typeof TEXT_PRESETS)[number], text?: string) => void;
  onAddCaptions: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  lastStoryboard: Storyboard | null;
}) {
  const project = useEditor((s) => s.project);
  const playhead = useEditor((s) => s.playhead);
  const setMusic = useEditor((s) => s.setMusic);
  const updateProject = useEditor((s) => s.updateProject);
  const addClip = useEditor((s) => s.addClip);
  const settings = useSettings();
  const [tab, setTab] = useState<TabId>('ai');
  const [prompt, setPrompt] = useState(project?.prompt || '');
  const [minutes, setMinutes] = useState(Math.max(0.2, Math.round(((project?.duration || 120) / 60) * 10) / 10));
  const [aspect, setAspect] = useState<AspectId>(project?.aspect || '16:9');
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [conn, setConn] = useState<{ state: 'checking' | 'on' | 'off'; label: string; models: string[] }>({ state: 'checking', label: 'Comprobando…', models: [] });
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Soy tu copiloto local. Puedo escribir guiones, añadir escenas, poner subtítulos, cambiar la duración o preparar la exportación. ¿Qué creamos?' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [improving, setImproving] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const aiSettings: AiSettings = settings.ai;

  const check = async () => {
    setConn({ state: 'checking', label: 'Comprobando…', models: [] });
    const res = await listModels(aiSettings, 4000);
    if (res.ok) {
      const names = res.models.map((m) => m.name);
      const current = names.find((n) => n === aiSettings.model || n.startsWith(`${aiSettings.model}:`)) || names[0];
      setConn({ state: 'on', label: current ? `Conectado · ${current}` : 'Conectado · sin modelos', models: names });
      if (current && current !== aiSettings.model) settings.setAi({ model: current });
    } else {
      setConn({ state: 'off', label: 'Ollama no detectado', models: [] });
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.ai.endpoint]);

  useEffect(() => {
    if (!project) return;
    projectAssets(project.id).then(setAssets).catch(() => {});
  }, [project?.id]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (project) {
      setPrompt((prev) => prev || project.prompt || '');
      setAspect(project.aspect);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const scenes = useMemo(() => project?.clips.filter((c) => c.kind === 'scene') || [], [project?.clips]);

  if (!project) return null;

  const addAssetClip = (meta: AssetMeta) => {
    const type: TrackType = meta.type === 'audio' ? 'audio' : 'video';
    const track = project.tracks.find((t) => t.type === type) || project.tracks[0];
    if (!track) return;
    const duration = meta.type === 'image' ? 5 : Math.max(1, Math.min(meta.duration || 5, 600));
    const clip: Clip =
      meta.type === 'audio'
        ? {
            id: uid('clip'), trackId: track.id, kind: 'audio', name: meta.name, start: playhead, duration,
            fadeIn: 0.3, fadeOut: 0.6, opacity: 1, filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
            assetId: meta.id, inPoint: 0, loop: false, volume: 0.85,
          }
        : {
            id: uid('clip'), trackId: track.id, kind: 'media', name: meta.name, start: playhead, duration,
            fadeIn: 0.3, fadeOut: 0.3, opacity: 1, filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
            assetId: meta.id, fit: 'cover', inPoint: 0, scale: 1, x: 0, y: 0, rotation: 0,
          };
    addClip(clip);
    toast(`«${meta.name}» añadido al playhead`, 'success');
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^(video|image|audio)\//.test(f.type));
    if (!list.length) {
      toast('Formato no soportado. Usa video, imagen o audio.', 'warning');
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        const meta = await importFile(file, project.id);
        setAssets((prev) => [meta, ...prev]);
        addAssetClip(meta);
      }
      toast(`${list.length} archivo(s) importados`, 'success');
    } catch (e) {
      toast(`No se pudo importar: ${(e as Error).message}`, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '', pending: true }]);
    setThinking(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (conn.state !== 'on') {
      const reply = demoAgentReply(text);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.pending) copy[copy.length - 1] = { role: 'assistant', content: reply };
        return copy;
      });
      setThinking(false);
      return;
    }

    const context = `Nombre: ${project.name}\nDuración: ${Math.round(project.duration)}s\nFormato: ${project.aspect}\nEscenas: ${scenes.length}\nClips totales: ${project.clips.length}\nPrompt original: ${project.prompt}`;
    const system: ChatMessage = {
      role: 'system',
      content: `Eres Vidora Copilot, un asistente de edición de video integrado en el estudio. Responde en español, breve y útil.
Puedes ejecutar acciones reales sobre el proyecto. Si el usuario pide algo que corresponda a una acción, incluye UN bloque de código json con esta forma y explica en una frase lo que haces:
\`\`\`json
{"action":"set_duration","minutes":3}
\`\`\`
Acciones válidas: set_duration (minutes), add_scene (template: aurora|nebula|grid|particles|waves|spotlight|skyline|editorial, title), add_text (text), set_mood (mood: cinematic|ambient|lofi|epic|electronic), play, pause, export.
No inventes acciones fuera de la lista. No uses bloques json si no vas a ejecutar nada.
Estado del proyecto:
${context}`,
    };
    let full = '';
    try {
      await chat({
        settings: aiSettings,
        messages: [system, ...messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })), { role: 'user', content: text }],
        temperature: 0.7,
        signal: ctrl.signal,
        onToken: (token) => {
          full += token;
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.pending) copy[copy.length - 1] = { role: 'assistant', content: full };
            return copy;
          });
        },
      });
      const { clean, actions } = extractActions(full);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last) {
          copy[copy.length - 1] = {
            role: 'assistant',
            content: clean || (actions.length ? 'Ejecutando la acción…' : full),
          };
        }
        return copy;
      });
      for (const action of actions) onAgentAction(action);
    } catch (e) {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last) copy[copy.length - 1] = { role: 'assistant', content: demoAgentReply(text), error: true };
        return copy;
      });
      toast(`IA local: ${(e as Error).message}`, 'warning');
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  };

  const quickImprove = async () => {
    if (!prompt.trim()) return;
    setImproving(true);
    try {
      const better = await improvePrompt(prompt, aiSettings);
      setPrompt(better);
      updateProject({ prompt: better });
      toast('Prompt mejorado por la IA', 'success');
    } catch {
      const enhanced = `${prompt.trim()}, estética cinematográfica, luz dramática, cámara lenta, grano de película, paleta cohesiva, atmósfera inmersiva`;
      setPrompt(enhanced);
      updateProject({ prompt: enhanced });
      toast('Ollama no está activo: he añadido una mejora cinematográfica local.', 'info');
    } finally {
      setImproving(false);
    }
  };

  const makeSeo = async () => {
    setThinking(true);
    try {
      const text = await generateSeo(project, aiSettings);
      setMessages((prev) => [...prev, { role: 'user', content: 'Genera título, descripción y hashtags para este video.' }, { role: 'assistant', content: text }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'No pude conectar con Ollama para generar el SEO. Actívalo en Ajustes y vuelve a intentarlo.', error: true }]);
    } finally {
      setThinking(false);
    }
  };

  const speak = () => {
    const text = scenes
      .map((c) => (c.kind === 'scene' ? [c.title, c.subtitle].filter(Boolean).join('. ') : ''))
      .filter(Boolean)
      .join('. ') || project.prompt;
    if (!('speechSynthesis' in window)) {
      toast('Tu navegador no soporta voz.', 'warning');
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.95;
    speechSynthesis.speak(u);
    toast('Leyendo el guion en voz alta (solo vista previa)', 'info');
  };

  const submitGenerate = () => {
    if (!prompt.trim()) {
      toast('Escribe una idea para generar el video.', 'warning');
      return;
    }
    updateProject({ prompt });
    onGenerate(prompt.trim(), minutes, aspect);
  };

  return (
    <aside className="left-panel">
      <div className="panel-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} title={t.label}>
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="panel-scroll">
        {tab === 'ai' && (
          <div className="ai-panel">
            <div className={`conn-card ${conn.state}`}>
              <div className="conn-left">
                <span className={`conn-dot ${conn.state}`} />
                <div>
                  <strong>{conn.state === 'on' ? 'IA local conectada' : conn.state === 'off' ? 'Modo director local' : 'Conectando…'}</strong>
                  <em>{conn.label}</em>
                </div>
              </div>
              <div className="conn-actions">
                <button className="icon-btn" onClick={check} title="Reconectar"><RefreshCw size={13} className={conn.state === 'checking' ? 'spin' : ''} /></button>
                <button className="icon-btn" onClick={onOpenSettings} title="Ajustes de IA"><Settings size={13} /></button>
              </div>
            </div>
            {conn.state === 'off' && (
              <button className="install-hint" onClick={onOpenSettings}>
                <Sparkles size={14} />
                <span>Activa Ollama para IA real. Mientras tanto, el director local generará el storyboard.</span>
                <ChevronRight size={14} />
              </button>
            )}

            <div className="panel-section">
              <div className="section-title"><Wand2 size={15} /> Director IA</div>
              <textarea className="prompt-box" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe luz, cámara, emoción y tema…" />
              <div className="style-chips">
                {STYLE_CHIPS.map((s) => (
                  <button key={s.label} onClick={() => setPrompt((p) => `${p.trim().replace(/,\s*$/, '')}, ${s.text}`)}>{s.label}</button>
                ))}
              </div>
              <div className="gen-row">
                <DurationPicker minutes={minutes} onChange={setMinutes} compact />
                <select value={aspect} onChange={(e) => setAspect(e.target.value as AspectId)}>
                  {Object.values(ASPECTS).map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-block" onClick={submitGenerate} disabled={generating}>
                {generating ? <Spinner /> : <Sparkles size={16} />}
                {generating ? 'Dirigiendo…' : 'Generar video'}
              </button>
              <div className="gen-actions">
                <button className="link-btn" onClick={quickImprove} disabled={improving}>{improving ? 'Mejorando…' : 'Mejorar prompt'}</button>
                <button className="link-btn" onClick={() => { setPrompt('Una historia visual sobre '); }}>Empezar de cero</button>
              </div>
              {lastStoryboard && (
                <div className="storyboard-summary">
                  <div className="sb-head">
                    <span><Check size={12} /> Guion generado</span>
                    <Badge tone={lastStoryboard.fallback ? 'amber' : 'green'}>{lastStoryboard.fallback ? 'Local' : 'Ollama'}</Badge>
                  </div>
                  <strong>{lastStoryboard.title}</strong>
                  <p>{lastStoryboard.logline}</p>
                  <span className="muted small">{lastStoryboard.scenes.length} escenas · {lastStoryboard.mood}</span>
                </div>
              )}
            </div>

            <div className="panel-section chat-section">
              <div className="section-title">
                <Bot size={15} /> Copiloto
                <span className="section-title-right">{messages.length - 1} mensajes</span>
              </div>
              <div className="chat-log" ref={chatRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.role} ${m.error ? 'error' : ''}`}>
                    {m.role === 'assistant' && <span className="chat-avatar"><Bot size={12} /></span>}
                    <div className="chat-bubble">
                      {m.content || (m.pending ? <span className="typing"><i /><i /><i /></span> : '')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="chat-quick">
                <button onClick={onAddCaptions}><TypeIcon size={12} /> Subtítulos</button>
                <button onClick={speak}><Volume2 size={12} /> Voz</button>
                <button onClick={makeSeo}><Zap size={12} /> SEO</button>
                <button onClick={onOpenExport}><Download size={12} /> Exportar</button>
              </div>
              <div className="chat-input">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Pide algo: «pon 2 minutos»…"
                />
                <button className="chat-send" onClick={send} disabled={!input.trim() || thinking} aria-label="Enviar">
                  {thinking ? <Loader2 size={15} className="spin" /> : <ArrowUp size={15} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'media' && (
          <div className="panel-section">
            <div className="section-title"><Film size={15} /> Biblioteca de medios</div>
            <div
              className={`dropzone ${uploading ? 'busy' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Spinner size={20} /> : <Upload size={20} />}
              <strong>{uploading ? 'Importando…' : 'Arrastra archivos aquí'}</strong>
              <span>Video · imagen · audio · se guardan en tu navegador</span>
            </div>
            <input ref={fileRef} type="file" hidden multiple accept="video/*,image/*,audio/*" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            <div className="asset-grid">
              {assets.map((a) => {
                const rt = getRuntime(a.id);
                const thumb = a.type === 'image' ? rt?.url : undefined;
                return (
                  <button key={a.id} className="asset-card" onClick={() => addAssetClip(a)} title={`Añadir «${a.name}» al playhead`}>
                    <span className="asset-thumb" style={{ backgroundImage: thumb ? `url(${thumb})` : undefined }}>
                      {!thumb && (a.type === 'video' ? <Film size={18} /> : a.type === 'audio' ? <AudioLines size={18} /> : <ImageIcon size={18} />)}
                    </span>
                    <span className="asset-name">{a.name}</span>
                    <span className="asset-meta">{a.duration ? formatClock(a.duration) : a.type}</span>
                  </button>
                );
              })}
              {assets.length === 0 && <p className="muted small pad">Aún no has importado medios. Las escenas IA no necesitan archivos.</p>}
            </div>
            <div className="panel-divider" />
            <div className="section-title"><ImageIcon size={15} /> Escena desde medio</div>
            <p className="muted small">Puedes importar un video o imagen y colocarlo en el timeline. Se renderiza en la exportación a resolución completa.</p>
          </div>
        )}

        {tab === 'scenes' && (
          <div className="panel-section">
            <div className="section-title"><Clapperboard size={15} /> Plantillas de escena</div>
            <p className="muted small">Haz clic para añadir al playhead. Cada escena se genera en tiempo real, sin archivos.</p>
            <div className="scene-grid">
              {SCENE_TEMPLATES.map((s) => (
                <button key={s.id} className="scene-card" style={{ background: gradient(s.palette) }} onClick={() => onAddScene(s.id, s.palette, 6)}>
                  <span className="scene-tag">{s.tag}</span>
                  <span className="scene-name">{s.name}</span>
                  <span className="scene-add"><Plus size={12} /> Añadir</span>
                </button>
              ))}
            </div>
            <div className="panel-divider" />
            <div className="section-title"><Mic size={15} /> Narración</div>
            <p className="muted small">La voz usa el sintetizador del navegador para previsualizar. Para exportar voz, importa un audio grabado.</p>
            <button className="btn btn-ghost btn-block btn-sm" onClick={speak}><Volume2 size={14} /> Leer guion en voz alta</button>
          </div>
        )}

        {tab === 'text' && (
          <div className="panel-section">
            <div className="section-title"><TypeIcon size={15} /> Texto y titulares</div>
            <div className="text-preset-list">
              {TEXT_PRESETS.map((p) => (
                <button key={p.id} className="text-preset" onClick={() => onAddText(p)}>
                  <span className="tp-preview">{p.id === 'title' ? 'Aa' : p.id === 'quote' ? '«»' : 'T'}</span>
                  <span><strong>{p.label}</strong><em>{p.hint}</em></span>
                  <Plus size={14} />
                </button>
              ))}
            </div>
            <div className="panel-divider" />
            <div className="section-title"><TypeIcon size={15} /> Subtítulos automáticos</div>
            <p className="muted small">Crea subtítulos a partir de los textos de cada escena, sincronizados en el timeline.</p>
            <button className="btn btn-primary btn-block btn-sm" onClick={onAddCaptions}><Sparkles size={14} /> Generar subtítulos</button>
          </div>
        )}

        {tab === 'audio' && (
          <div className="panel-section">
            <div className="section-title"><Music size={15} /> Música generativa</div>
            <div className="mood-grid">
              {(['cinematic', 'ambient', 'lofi', 'epic', 'electronic'] as const).map((m) => (
                <button key={m} className={`mood-card ${project.music.mood === m ? 'active' : ''}`} onClick={() => setMusic({ mood: m, enabled: true })}>
                  <span className="mood-bars">{[0, 1, 2, 3].map((i) => <i key={i} style={{ height: `${30 + ((i * 17) % 60)}%` }} />)}</span>
                  <span>{m === 'cinematic' ? 'Cine' : m === 'ambient' ? 'Ambient' : m === 'lofi' ? 'Lo-fi' : m === 'epic' ? 'Épico' : 'Electro'}</span>
                </button>
              ))}
            </div>
            <div className="switch-row"><span>Música activada</span>
              <button className={`toggle ${project.music.enabled ? 'on' : ''}`} onClick={() => setMusic({ enabled: !project.music.enabled })}><span className="toggle-knob" /></button>
            </div>
            <label className="field"><span className="field-label">Volumen · {Math.round(project.music.volume * 100)}%</span>
              <input type="range" min={0} max={100} value={project.music.volume * 100} onChange={(e) => setMusic({ volume: Number(e.target.value) / 100 })} />
            </label>
            <div className="panel-divider" />
            <div className="section-title"><Upload size={15} /> Audio propio</div>
            <button className="btn btn-ghost btn-block btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Importar audio</button>
            <input ref={fileRef} type="file" hidden multiple accept="audio/*" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            <div className="asset-grid small">
              {assets.filter((a) => a.type === 'audio').map((a) => (
                <button key={a.id} className="asset-card" onClick={() => addAssetClip(a)}>
                  <span className="asset-thumb"><AudioLines size={16} /></span>
                  <span className="asset-name">{a.name}</span>
                </button>
              ))}
            </div>
            <div className="panel-divider" />
            <div className="section-title"><Mic size={15} /> Guion de voz</div>
            <p className="muted small">Genera un guion narrado a partir de las escenas y descárgalo para grabarlo.</p>
            <div className="two-actions">
              <button className="btn btn-ghost btn-sm" onClick={speak}><Volume2 size={13} /> Escuchar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const text = scenes.map((c) => c.kind === 'scene' ? `${c.title}\n${c.subtitle}` : '').filter(Boolean).join('\n\n');
                const blob = new Blob([text || project.prompt], { type: 'text/plain;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'guion-vidora.txt';
                a.click();
              }}><Download size={13} /> Descargar</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel-footer">
        <span className={`conn-mini ${conn.state}`}><i /> {conn.state === 'on' ? conn.label : conn.state === 'off' ? 'IA local offline' : 'Conectando'}</span>
        <button className="link-btn" onClick={onOpenSettings}>Ajustes</button>
      </div>
    </aside>
  );
}
