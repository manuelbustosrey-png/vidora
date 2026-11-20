import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clapperboard,
  Clock,
  Copy,
  Film,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { AspectId, Project } from '@/types';
import { ASPECTS } from '@/types';
import { formatDate } from '@/lib/utils';
import { Logo, DurationPicker, EmptyState } from './ui';

const QUICK = [
  { name: 'Aurora', prompt: 'Un corto cinematográfico sobre auroras boreales y silencio', palette: ['#ff6a3d', '#8b5cf6', '#0a0a14'] },
  { name: 'Neón', prompt: 'Una noche cyberpunk entre neones, lluvia y multitudes', palette: ['#22d3ee', '#a855f7', '#05060f'] },
  { name: 'Océano', prompt: 'El océano al amanecer, olas lentas y luz dorada', palette: ['#34d399', '#0ea5e9', '#04100d'] },
  { name: 'Marca', prompt: 'Video editorial de lujo para una marca de perfumes', palette: ['#e7c873', '#a8792d', '#0b0905'] },
];

export default function Dashboard({
  projects,
  loading,
  onOpen,
  onDelete,
  onDuplicate,
  onGenerate,
  onNew,
  onHome,
  onSettings,
}: {
  projects: Project[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onGenerate: (prompt: string, minutes: number, aspect: AspectId) => void;
  onNew: () => void;
  onHome: () => void;
  onSettings: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [minutes, setMinutes] = useState(2);
  const [aspect, setAspect] = useState<AspectId>('16:9');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'ai' | 'manual'>('all');
  const [menu, setMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matches = !query.trim() || `${p.name} ${p.prompt}`.toLowerCase().includes(query.toLowerCase());
      const type = tab === 'all' || (tab === 'ai' ? p.aiGenerated : !p.aiGenerated);
      return matches && type;
    });
  }, [projects, query, tab]);

  return (
    <div className="dashboard">
      <header className="dash-nav">
        <button className="nav-brand" onClick={onHome}><Logo size={28} /></button>
        <div className="dash-nav-right">
          <label className="search-box">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar proyectos…" />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={onSettings}><Settings size={15} /> Ajustes</button>
          <button className="btn btn-primary btn-sm" onClick={onNew}><Plus size={15} /> Proyecto</button>
        </div>
      </header>

      <main className="dash-main">
        <button className="back-link" onClick={onHome}><ArrowLeft size={14} /> Volver al inicio</button>

        <section className="dash-hero">
          <div>
            <span className="eyebrow static"><Sparkles size={13} /> Estudio</span>
            <h1>¿Qué vamos a<br /><em>crear hoy?</em></h1>
            <p>Describe tu idea. El director IA escribirá el storyboard y montará el primer corte.</p>
          </div>
          <div className="dash-composer">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Ej. Tráiler de 2 minutos sobre una marca de café de especialidad, luz cálida y cámara lenta…"
            />
            <div className="dash-composer-row">
              <DurationPicker minutes={minutes} onChange={setMinutes} compact />
              <select value={aspect} onChange={(e) => setAspect(e.target.value as AspectId)}>
                {Object.values(ASPECTS).map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
              </select>
              <button
                className="btn btn-primary"
                disabled={!prompt.trim()}
                onClick={() => onGenerate(prompt.trim(), minutes, aspect)}
              >
                <Wand2 size={16} /> Generar
              </button>
            </div>
          </div>
        </section>

        <section className="quick-styles">
          {QUICK.map((q) => (
            <button key={q.name} className="quick-style" onClick={() => onGenerate(q.prompt, 1, aspect)}>
              <span className="quick-thumb" style={{ background: `radial-gradient(90% 100% at 20% 20%, ${q.palette[0]}88, transparent 60%), radial-gradient(80% 80% at 80% 80%, ${q.palette[1]}77, transparent 60%), ${q.palette[2]}` }} />
              <span><strong>{q.name}</strong><em>1 min · IA</em></span>
              <ArrowRight size={14} />
            </button>
          ))}
        </section>

        <section className="projects-section">
          <div className="projects-head">
            <h2>Tus proyectos <span>{projects.length}</span></h2>
            <div className="tabs tabs-inline">
              <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todos</button>
              <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>Con IA</button>
              <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>Manuales</button>
            </div>
          </div>

          {loading ? (
            <div className="project-grid">
              {[0, 1, 2].map((i) => <div key={i} className="project-card skeleton" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={26} />}
              title={projects.length ? 'Sin resultados' : 'Tu estudio está vacío'}
              text={projects.length ? 'Prueba con otra búsqueda o crea un proyecto nuevo.' : 'Crea tu primer video con una idea de una frase. El director IA hará el resto.'}
              action={<button className="btn btn-primary" onClick={onNew}><Plus size={15} /> Crear proyecto vacío</button>}
            />
          ) : (
            <div className="project-grid">
              {filtered.map((p) => (
                <article key={p.id} className="project-card">
                  <button className="project-cover" onClick={() => onOpen(p.id)}>
                    {p.cover ? (
                      <img src={p.cover} alt="" />
                    ) : (
                      <div className="cover-fallback">
                        <Film size={26} />
                        <span>{p.aspect}</span>
                      </div>
                    )}
                    <span className="project-duration"><Clock size={11} /> {Math.floor(p.duration / 60)}:{String(Math.floor(p.duration % 60)).padStart(2, '0')}</span>
                    {p.aiGenerated && <span className="project-ai"><Sparkles size={11} /> IA</span>}
                    <span className="cover-play"><Clapperboard size={18} /></span>
                  </button>
                  <div className="project-meta">
                    <div className="project-title">
                      <button onClick={() => onOpen(p.id)}>{p.name}</button>
                      <em>{formatDate(p.updatedAt)} · {p.aspect}</em>
                    </div>
                    <div className="project-menu">
                      <button className="icon-btn" aria-label="Más opciones" onClick={() => setMenu(menu === p.id ? null : p.id)}>
                        <MoreHorizontal size={16} />
                      </button>
                      {menu === p.id && (
                        <>
                          <div className="menu-backdrop" onClick={() => setMenu(null)} />
                          <div className="dropdown">
                            <button onClick={() => { setMenu(null); onOpen(p.id); }}><Clapperboard size={14} /> Abrir</button>
                            <button onClick={() => { setMenu(null); onDuplicate(p.id); }}><Copy size={14} /> Duplicar</button>
                            <button className="danger" onClick={() => { setMenu(null); onDelete(p.id); }}><Trash2 size={14} /> Eliminar</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dash-tip">
          <div className="dash-tip-icon"><Sparkles size={20} /></div>
          <div>
            <strong>Consejo del director</strong>
            <p>Describe luz, cámara y emoción, no solo el tema. «Luz cálida de atardecer, cámara lenta, grano de película» funciona mucho mejor que «un video bonito».</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onSettings}>Configurar Ollama <ArrowRight size={14} /></button>
        </section>
      </main>
    </div>
  );
}
