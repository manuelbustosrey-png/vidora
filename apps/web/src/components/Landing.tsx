import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bot,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  Gauge,
  Layers,
  Laptop,
  Mic,
  MonitorPlay,
  Play,
  Plus,
  Scissors,
  Settings,
  Sparkles,
  Type,
  Wand2,
  Zap,
} from 'lucide-react';
import type { AspectId, Project } from '@/types';
import { ASPECTS } from '@/types';
import { Logo, DurationPicker, Badge } from './ui';
import { formatDate } from '@/lib/utils';

const FEATURES = [
  { icon: Wand2, title: 'Director IA', text: 'Convierte una frase en guion, escenas, paleta y música. Con Ollama, todo ocurre en tu equipo.' },
  { icon: Layers, title: 'Timeline multipista', text: 'Video, overlays, texto y audio con recorte, división, fundidos y arrastre preciso.' },
  { icon: Scissors, title: 'Edición real', text: 'Trim, split, filtros, transformaciones, tipografía cinética y control de opacidad.' },
  { icon: AudioLines, title: 'Música generativa', text: 'Bandas sonoras procedurales en cinco estados de ánimo, mezcladas en la exportación.' },
  { icon: MonitorPlay, title: 'Full calidad', text: 'Hasta 4K, 60 FPS y bitrate ajustable. Exporta MP4 o WebM directamente desde el navegador.' },
  { icon: Bot, title: 'Copiloto de escritorio', text: 'Una app Electron conectada al estudio: pídele cambios y los ejecuta sobre tu proyecto.' },
];

const TEMPLATES = [
  { name: 'Aurora', style: 'aurora', palette: ['#ff6a3d', '#8b5cf6', '#0a0a14'], tag: 'Cinematográfico' },
  { name: 'Nebulosa', style: 'nebula', palette: ['#8b5cf6', '#22d3ee', '#05040d'], tag: 'Espacio' },
  { name: 'Horizonte', style: 'grid', palette: ['#ff3d77', '#8b5cf6', '#080312'], tag: 'Synthwave' },
  { name: 'Bokeh', style: 'particles', palette: ['#f59e0b', '#ef4444', '#0b0705'], tag: 'Retrato' },
  { name: 'Océano', style: 'waves', palette: ['#34d399', '#0ea5e9', '#04100d'], tag: 'Naturaleza' },
  { name: 'Editorial', style: 'editorial', palette: ['#e7c873', '#a8792d', '#0b0905'], tag: 'Marca' },
];

const STEPS = [
  { n: '01', title: 'Escribe la idea', text: 'Una frase, un producto, una emoción. Elige minutos, formato y listo.' },
  { n: '02', title: 'La IA dirige', text: 'Ollama escribe el storyboard y Vidora compone escenas, ritmo, música y tipografía.' },
  { n: '03', title: 'Ajusta y exporta', text: 'Edita en el timeline, añade tus medios y descarga en la máxima calidad.' },
];

const FAQ = [
  ['¿Hay límite de duración?', 'No hay un límite artificial: el selector acepta desde 12 segundos hasta 600 minutos. La exportación se graba en tiempo real, así que un video de 30 minutos tarda aproximadamente 30 minutos en generarse.'],
  ['¿Necesito pagar una API?', 'No. La IA funciona con Ollama en tu ordenador. Si no está encendido, Vidora usa un director local de respaldo para que nunca te quedes sin crear.'],
  ['¿Los videos se suben a la nube?', 'No. Los proyectos, los medios y los ajustes viven en IndexedDB dentro de tu navegador. Nada sale de tu equipo salvo que tú lo exportes.'],
  ['¿Puedo usar mis propios clips?', 'Sí. Importa video, imágenes y audio y colócalos en la timeline. Puedes mezclarlos con las escenas generadas por la IA.'],
  ['¿Cómo se conecta la app de escritorio?', 'El copiloto Electron abre la web de Vidora en un panel y le envía órdenes por un puente seguro. Puedes pedirle «pon 3 minutos», «añade una escena» o «prepara la exportación».'],
];

function sceneStyle(palette: string[], template: string): React.CSSProperties {
  const [a, b, c] = palette;
  if (template === 'grid') {
    return { background: `linear-gradient(180deg, #06030f 0%, #2b0f3f 55%, #06030f 100%)`, ['--a' as string]: a, ['--b' as string]: b };
  }
  if (template === 'editorial') {
    return { background: `linear-gradient(120deg, ${c} 0%, ${c} 58%, ${b} 58%, ${b} 100%)`, ['--a' as string]: a };
  }
  return { background: `radial-gradient(120% 90% at 25% 20%, ${a}55, transparent 55%), radial-gradient(100% 100% at 80% 75%, ${b}66, transparent 60%), ${c}` };
}

export default function Landing({
  projects,
  onGenerate,
  onOpenProjects,
  onOpenProject,
  onSettings,
  onDemo,
}: {
  projects: Project[];
  onGenerate: (prompt: string, minutes: number, aspect: AspectId) => void;
  onOpenProjects: () => void;
  onOpenProject: (id: string) => void;
  onSettings: () => void;
  onDemo: () => void;
}) {
  const [prompt, setPrompt] = useState('Un viaje cinematográfico entre auroras boreales y ciudades de neón');
  const [minutes, setMinutes] = useState(1);
  const [aspect, setAspect] = useState<AspectId>('16:9');
  const recent = projects.slice(0, 3);

  const submit = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt.trim(), minutes, aspect);
  };

  return (
    <div className="landing">
      <div className="bg-grain" />
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      <header className="site-nav">
        <a className="nav-brand" href="#/"><Logo size={28} /></a>
        <nav className="nav-links">
          <a href="#producto">Producto</a>
          <a href="#estudio">Estudio</a>
          <a href="#ia-local">IA local</a>
          <a href="#escritorio">Escritorio</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-actions">
          <button className="btn btn-ghost btn-sm" onClick={onSettings}><Settings size={15} /> Ajustes</button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenProjects}><FolderOpen size={15} /> Proyectos</button>
          <button className="btn btn-primary btn-sm" onClick={() => document.getElementById('crear')?.scrollIntoView({ behavior: 'smooth' })}>
            Crear gratis <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> IA local · Ollama · Sin suscripción</div>
            <h1>
              De una idea a un<br />
              video <em>cinematográfico</em>.
            </h1>
            <p className="hero-sub">
              Vidora es tu estudio de video con inteligencia artificial. Escribe lo que imaginas,
              deja que el director IA componga las escenas y edita todo con un timeline profesional.
            </p>

            <div className="composer" id="crear">
              <div className="composer-head">
                <span className="composer-label"><Sparkles size={15} /> Idea del video</span>
                <span className="composer-hint">⌘ + Enter para crear</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
                }}
                rows={3}
                placeholder="Describe tu video: historia, producto, atmósfera…"
              />
              <div className="composer-controls">
                <div className="composer-minutes">
                  <span>Duración</span>
                  <DurationPicker minutes={minutes} onChange={setMinutes} compact />
                </div>
                <select value={aspect} onChange={(e) => setAspect(e.target.value as AspectId)} aria-label="Formato">
                  {Object.values(ASPECTS).map((a) => <option key={a.id} value={a.id}>{a.id} · {a.label.split('·')[1]?.trim()}</option>)}
                </select>
                <button className="btn btn-primary composer-submit" onClick={submit} disabled={!prompt.trim()}>
                  <Clapperboard size={16} /> Crear video <ArrowRight size={16} />
                </button>
              </div>
              <div className="composer-chips">
                {['Tráiler de marca de lujo', 'Naturaleza en calma', 'Cyberpunk nocturno', 'Viaje espacial'].map((c) => (
                  <button key={c} onClick={() => setPrompt(c)}>{c}</button>
                ))}
                <button className="demo-link" onClick={onDemo}><Play size={11} /> Ver demo</button>
              </div>
            </div>

            <div className="hero-stats">
              <div><strong>4K</strong><span>exportación</span></div>
              <div><strong>0 €</strong><span>IA local</span></div>
              <div><strong>∞</strong><span>minutos</span></div>
              <div><strong>6</strong><span>pistas de edición</span></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="stage-card">
              <div className="stage-screen">
                <div className="stage-scene">
                  <div className="stage-aurora s1" />
                  <div className="stage-aurora s2" />
                  <div className="stage-aurora s3" />
                  <div className="stage-stars" />
                  <div className="stage-copy">
                    <span className="stage-kicker">UN CORTO DE VIDORA</span>
                    <h2>Luces<br /><em>del norte</em></h2>
                    <p>Bajo el cielo, todo se vuelve posible.</p>
                  </div>
                  <div className="stage-hud">
                    <span className="rec"><i /> REC</span>
                    <span>00:12:04</span>
                    <span>4K · 24fps</span>
                  </div>
                </div>
              </div>
              <div className="stage-timeline">
                <div className="mini-ruler"><span /><span /><span /><span /><span /><span /><span /><span /></div>
                <div className="mini-track">
                  <div className="mini-clip clip-a" style={{ width: '36%' }}><span>ESC 01 · AURORA</span></div>
                  <div className="mini-clip clip-b" style={{ width: '28%' }}><span>ESC 02 · NEBULOSA</span></div>
                  <div className="mini-clip clip-c" style={{ width: '24%' }}><span>ESC 03 · CIUDAD</span></div>
                </div>
                <div className="mini-track small">
                  <div className="mini-clip clip-text" style={{ width: '22%' }}>TÍTULO</div>
                  <div className="mini-clip clip-text" style={{ width: '18%', left: '52%' }}>CTA</div>
                </div>
                <div className="mini-playhead" />
              </div>
            </div>
            <div className="float-card fc-ai">
              <div className="fc-icon"><Sparkles size={16} /></div>
              <div><strong>Director IA</strong><span>Storyboard listo · 8 escenas</span></div>
            </div>
            <div className="float-card fc-render">
              <div className="fc-icon green"><Gauge size={16} /></div>
              <div><strong>Exportación 4K</strong><span>3840 × 2160 · 60 fps</span></div>
            </div>
            <div className="float-card fc-desktop">
              <div className="fc-icon violet"><Laptop size={16} /></div>
              <div><strong>Copiloto conectado</strong><span>«pon 3 minutos y exporta»</span></div>
            </div>
          </div>
        </section>

        <section className="logo-strip" aria-label="Características">
          <span><Sparkles size={14} /> Ollama</span>
          <span><Film size={14} /> WebCodecs</span>
          <span><Laptop size={14} /> Electron</span>
          <span><Zap size={14} /> IndexedDB</span>
          <span><Download size={14} /> MP4 / WebM</span>
          <span><Mic size={14} /> Voz y música</span>
        </section>

        {recent.length > 0 && (
          <section className="recent-strip">
            <div className="section-heading compact">
              <h2>Tus últimos proyectos</h2>
              <button className="link-btn" onClick={onOpenProjects}>Ver todos <ArrowRight size={14} /></button>
            </div>
            <div className="recent-grid">
              {recent.map((p) => (
                <button key={p.id} className="recent-card" onClick={() => onOpenProject(p.id)}>
                  <div className="recent-thumb" style={{ backgroundImage: p.cover ? `url(${p.cover})` : undefined }}>
                    {!p.cover && <div className="recent-placeholder"><Film size={22} /></div>}
                    <span className="recent-duration">{Math.floor(p.duration / 60)}:{String(Math.floor(p.duration % 60)).padStart(2, '0')}</span>
                  </div>
                  <div className="recent-meta">
                    <strong>{p.name}</strong>
                    <span>{formatDate(p.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="section" id="producto">
          <div className="section-heading">
            <span className="eyebrow static">Todo el estudio, en tu navegador</span>
            <h2>No es un generador.<br /><em>Es un estudio completo.</em></h2>
            <p className="section-sub">La velocidad de la IA con el control de un editor profesional. Sin subir tus archivos a ningún servidor.</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="feature-card">
                <div className="feature-icon"><f.icon size={20} /></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section studio-showcase" id="estudio">
          <div className="showcase-copy">
            <span className="eyebrow static">El estudio</span>
            <h2>Un timeline que<br /><em>se siente tuyo.</em></h2>
            <p>Arrastra clips, corta con la barra espaciadora, ajusta el color, anima titulares y mezcla tu propia música. Cada cambio queda guardado automáticamente.</p>
            <ul className="check-list">
              <li><span>01</span> Escenas procedurales en 8 estilos cinematográficos</li>
              <li><span>02</span> Texto cinético con tipografía editorial</li>
              <li><span>03</span> Fundidos, movimiento de cámara y filtros</li>
              <li><span>04</span> Importa video, imágenes y audio locales</li>
              <li><span>05</span> Exporta con la duración que elijas</li>
            </ul>
            <button className="btn btn-primary" onClick={onOpenProjects}>Abrir el estudio <ArrowRight size={16} /></button>
          </div>
          <div className="showcase-app">
            <div className="sa-top"><span className="dot" /><span className="dot" /><span className="dot" /><em>vidora · estudio</em></div>
            <div className="sa-body">
              <div className="sa-left">
                <div className="sa-panel-title">Escenas</div>
                {TEMPLATES.slice(0, 4).map((t) => (
                  <div className="sa-thumb" key={t.name} style={sceneStyle(t.palette, t.style)}><span>{t.name}</span></div>
                ))}
              </div>
              <div className="sa-canvas">
                <div className="sa-frame">
                  <div className="stage-aurora s1" /><div className="stage-aurora s2" /><div className="stage-stars" />
                  <div className="sa-caption">El futuro se <em>escribe</em>.</div>
                  <div className="sa-lines" />
                </div>
              </div>
            </div>
            <div className="sa-timeline">
              <div className="sa-track"><div className="sa-clip c1" /><div className="sa-clip c2" /><div className="sa-clip c3" /></div>
              <div className="sa-track"><div className="sa-clip c4" /><div className="sa-clip c5" /></div>
              <div className="sa-track"><div className="sa-clip c6" /></div>
              <div className="sa-playhead" />
            </div>
          </div>
        </section>

        <section className="section" id="plantillas">
          <div className="section-heading">
            <span className="eyebrow static">Plantillas vivas</span>
            <h2>Ocho universos.<br /><em>Un mismo lienzo.</em></h2>
          </div>
          <div className="template-grid">
            {TEMPLATES.map((t, i) => (
              <button key={t.name} className="template-card" style={sceneStyle(t.palette, t.style)} onClick={onDemo}>
                <span className="template-tag">{t.tag}</span>
                <span className="template-sheen" />
                {t.style === 'grid' && <span className="tpl-sun" />}
                {t.style === 'editorial' && <span className="tpl-circle" />}
                <span className="template-name">{t.name}</span>
                <span className="template-add"><Plus size={14} /> Usar estilo</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section local-ai" id="ia-local">
          <div className="local-ai-inner">
            <div className="local-copy">
              <span className="eyebrow static">Privado por diseño</span>
              <h2>Tu IA. Tu GPU.<br /><em>Tus reglas.</em></h2>
              <p>Vidora habla con <strong>Ollama</strong> directamente desde el navegador. El guion, el storyboard y las ideas nunca pasan por un servidor externo. Instalas un modelo una vez y creas sin cuotas ni suscripciones.</p>
              <div className="local-actions">
                <a className="btn btn-primary" href="https://ollama.com/download" target="_blank" rel="noreferrer"><Download size={16} /> Instalar Ollama</a>
                <button className="btn btn-ghost" onClick={onSettings}><Settings size={16} /> Configurar</button>
              </div>
              <div className="privacy-row">
                <span><Badge tone="green">Local</Badge> Zero telemetría</span>
                <span><Badge tone="violet">Ollama</Badge> Llama 3, Qwen, Mistral…</span>
                <span><Badge tone="amber">Fallback</Badge> Director offline incluido</span>
              </div>
            </div>
            <div className="terminal-card">
              <div className="terminal-head"><span className="dot red" /><span className="dot amber" /><span className="dot green" /><em>ollama</em></div>
              <pre><code><span className="t-muted">$</span> ollama pull llama3.2{'\n'}
<span className="t-muted">$</span> npm run dev{'\n'}
<span className="t-green">✓</span> Vidora conectada en localhost:11434{'\n'}
<span className="t-muted">›</span> prompt: "tráiler de una marca de perfumes"{'\n'}
<span className="t-violet">director</span> storyboard de 8 escenas · 62 s{'\n'}
<span className="t-green">✓</span> proyecto listo en el estudio</code></pre>
              <div className="terminal-foot"><Sparkles size={13} /> 100% en tu máquina · sin claves API</div>
            </div>
          </div>
        </section>

        <section className="section desktop-section" id="escritorio">
          <div className="desktop-copy">
            <span className="eyebrow static">Nuevo · Copiloto de escritorio</span>
            <h2>Una IA que vive<br /><em>en tu escritorio.</em></h2>
            <p>El copiloto de Vidora es una app Electron con chat, acceso directo al estudio y un puente de órdenes. Pídele que cambie la duración, añada una escena o prepare la exportación: se ejecuta al instante en la web conectada.</p>
            <div className="desktop-actions">
              <button className="btn btn-primary" onClick={onOpenProjects}><Laptop size={16} /> Abrir el estudio</button>
              <button className="btn btn-ghost" onClick={onSettings}><Settings size={16} /> Configurar conexión</button>
            </div>
            <div className="command-list">
              <div><code>«pon 3 minutos»</code><span>ajusta la duración real del proyecto</span></div>
              <div><code>«añade una escena de nebulosa»</code><span>inserta un clip al final del timeline</span></div>
              <div><code>«prepara la exportación en 4K»</code><span>abre el panel con la configuración elegida</span></div>
            </div>
          </div>
          <div className="desktop-mock">
            <div className="dm-window">
              <div className="dm-title"><span className="dm-avatar">V</span><div><strong>Vidora Copilot</strong><em>Ollama · llama3.2 · conectado</em></div><span className="dm-dot" /></div>
              <div className="dm-chat">
                <div className="dm-msg user">Prepara un video de 2 minutos sobre el océano y ponle subtítulos.</div>
                <div className="dm-msg bot">
                  <span className="dm-tag"><Sparkles size={11} /> Copiloto</span>
                  <p>Hecho. Ajusto la duración a 2:00, activo la plantilla <em>Olas</em> y añado los subtítulos de cada escena al timeline.</p>
                  <div className="dm-actions"><span>✓ set_duration</span><span>✓ add_scene</span><span>✓ add_captions</span></div>
                </div>
                <div className="dm-msg user">Perfecto. Expórtalo en 4K.</div>
                <div className="dm-typing"><span /><span /><span /></div>
              </div>
              <div className="dm-input"><span>Escribe una orden…</span><kbd>⏎</kbd></div>
            </div>
            <div className="dm-pill"><MonitorPlay size={13} /> Estudio conectado · localhost:5173</div>
          </div>
        </section>

        <section className="section steps-section">
          <div className="section-heading">
            <span className="eyebrow static">Cómo funciona</span>
            <h2>Tres pasos.<br /><em>Cero fricción.</em></h2>
          </div>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <article key={s.n} className="step-card">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section faq-section" id="faq">
          <div className="faq-copy">
            <span className="eyebrow static">Preguntas</span>
            <h2>Lo que necesitas<br /><em>saber.</em></h2>
            <p>Todo lo importante sobre la IA local, la duración y la privacidad.</p>
            <button className="btn btn-ghost" onClick={onOpenProjects}>Empezar ahora <ArrowUpRight size={15} /></button>
          </div>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}<span>+</span></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="cta-scene" />
          <div className="final-cta-inner">
            <span className="eyebrow static"><Sparkles size={13} /> Empieza en segundos</span>
            <h2>Tu próxima historia<br /><em>empieza con una frase.</em></h2>
            <div className="final-actions">
              <button className="btn btn-primary btn-lg" onClick={() => document.getElementById('crear')?.scrollIntoView({ behavior: 'smooth' })}>
                Crear video gratis <ArrowRight size={17} />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={onOpenProjects}><FolderOpen size={17} /> Ver mis proyectos</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <Logo size={30} />
          <p>Estudio de video con IA local. Hecho para creadores que quieren control.</p>
        </div>
        <div className="footer-cols">
          <div><strong>Producto</strong><a href="#producto">Funciones</a><a href="#estudio">Estudio</a><a href="#plantillas">Plantillas</a><a href="#escritorio">Escritorio</a></div>
          <div><strong>Recursos</strong><a href="https://ollama.com" target="_blank" rel="noreferrer">Ollama</a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a><a href="#faq">FAQ</a></div>
          <div><strong>Privacidad</strong><span>Sin telemetría</span><span>Datos en tu navegador</span><span>Sin claves API</span></div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Vidora. Creado con IA local.</span>
          <span className="footer-status"><i /> Todos los sistemas locales</span>
        </div>
      </footer>
    </div>
  );
}
