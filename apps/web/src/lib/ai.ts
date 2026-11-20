import type { AiSettings, Clip, MusicMood, Project, SceneTemplate, Storyboard, StoryboardScene, TextClip } from '@/types';
import { chat, listModels } from './ollama';
import { clamp, hashString, uid } from './utils';
import type { Motion } from '@/types';

const TEMPLATES: SceneTemplate[] = ['aurora', 'nebula', 'grid', 'particles', 'waves', 'spotlight', 'skyline', 'editorial'];
const MOTIONS: Motion[] = ['kenburns', 'parallax', 'zoom-in', 'zoom-out', 'static'];

const PALETTES: Record<string, string[][]> = {
  cinematic: [
    ['#ff6a3d', '#ff2e63', '#080810'],
    ['#f59e0b', '#ef4444', '#0b0705'],
    ['#e2e8f0', '#64748b', '#07070c'],
  ],
  neon: [
    ['#22d3ee', '#a855f7', '#05060f'],
    ['#f472b6', '#22d3ee', '#080510'],
    ['#a3e635', '#06b6d4', '#050b08'],
  ],
  nature: [
    ['#34d399', '#0ea5e9', '#04100d'],
    ['#a3e635', '#facc15', '#0a1005'],
    ['#fbbf24', '#34d399', '#08110b'],
  ],
  luxury: [
    ['#e7c873', '#a8792d', '#0b0905'],
    ['#e2e8f0', '#94a3b8', '#08080c'],
    ['#f5d0a9', '#b45309', '#0f0a06'],
  ],
  space: [
    ['#8b5cf6', '#22d3ee', '#05040d'],
    ['#e879f9', '#6366f1', '#0a0512'],
    ['#38bdf8', '#a78bfa', '#03060f'],
  ],
};

const SCENE_NAMES = [
  ['El inicio', 'Todo comienza aquí.'],
  ['La mirada', 'Un detalle lo cambia todo.'],
  ['El pulso', 'La historia empieza a moverse.'],
  ['La tensión', 'Algo está a punto de romperse.'],
  ['El clímax', 'Todo converge en un instante.'],
  ['La calma', 'Después de la tormenta, claridad.'],
  ['El eco', 'Lo que queda cuando termina.'],
  ['Nuevo horizonte', 'El principio de otra historia.'],
];

function detectStyle(prompt: string): keyof typeof PALETTES {
  const p = prompt.toLowerCase();
  if (/(cyber|neón|neon|tech|futur|gaming|dj|synth|digital)/.test(p)) return 'neon';
  if (/(natur|bosque|mar|montañ|ocean|verde|animal|tierra|viaje)/.test(p)) return 'nature';
  if (/(lujo|premium|moda|perfume|marca|elegante|oro|joya)/.test(p)) return 'luxury';
  if (/(espacio|galaxia|planet|estrella|cosmos|universo|astronaut)/.test(p)) return 'space';
  return 'cinematic';
}

function detectMood(prompt: string): MusicMood {
  const p = prompt.toLowerCase();
  if (/(lofi|chill|tranqui|relax)/.test(p)) return 'lofi';
  if (/(épic|epic|tráiler|trailer|batalla|guerra|drama)/.test(p)) return 'epic';
  if (/(techno|electró|electro|club|fiesta|energía)/.test(p)) return 'electronic';
  if (/(ambient|medita|calma|sueño|etéreo)/.test(p)) return 'ambient';
  return 'cinematic';
}

function templatesForStyle(style: keyof typeof PALETTES): SceneTemplate[] {
  switch (style) {
    case 'neon': return ['grid', 'skyline', 'particles', 'spotlight', 'aurora'];
    case 'nature': return ['waves', 'aurora', 'particles', 'editorial', 'spotlight'];
    case 'luxury': return ['editorial', 'spotlight', 'aurora', 'waves'];
    case 'space': return ['nebula', 'aurora', 'particles', 'waves'];
    default: return ['aurora', 'spotlight', 'particles', 'waves', 'skyline', 'nebula', 'editorial'];
  }
}

function cleanSubject(prompt: string): string {
  const cleaned = prompt
    .replace(/^\s*(por favor,?\s*)?(crea|crear|genera|generar|haz|hacer|video|vídeo|un|una|el|la|los|las)\s+/gi, '')
    .replace(/[.。]+$/g, '')
    .trim();
  return (cleaned || prompt || 'una historia original').slice(0, 90);
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .slice(0, 7)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function fallbackStoryboard(prompt: string, minutes: number, count = 6): Storyboard {
  const style = detectStyle(prompt);
  const mood = detectMood(prompt);
  const subject = cleanSubject(prompt);
  const palettes = PALETTES[style];
  const templates = templatesForStyle(style);
  const title = titleCase(subject) || 'Sin título';
  const sceneCount = clamp(count || Math.round((minutes * 60) / 9), 4, 18);
  const sceneSeconds = (minutes * 60) / sceneCount;
  const scenes: StoryboardScene[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const name = SCENE_NAMES[i % SCENE_NAMES.length];
    const isFirst = i === 0;
    const isLast = i === sceneCount - 1;
    const subtitle = isFirst
      ? `Una historia sobre ${subject}.`
      : isLast
        ? 'Y entonces, todo tuvo sentido.'
        : `${name[1]} ${i % 3 === 0 ? subject.split(' ').slice(0, 5).join(' ') + '.' : ''}`.trim();
    scenes.push({
      title: name[0],
      subtitle,
      template: templates[i % templates.length],
      palette: palettes[i % palettes.length],
      duration: clamp(sceneSeconds, 3, 12),
      motion: MOTIONS[i % MOTIONS.length],
    });
  }

  return {
    title,
    logline: `Una pieza audiovisual sobre ${subject}.`,
    style,
    mood,
    scenes,
    fallback: true,
  };
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('La IA no devolvió JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeScene(raw: unknown, index: number): StoryboardScene | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const template = String(r.template || '') as SceneTemplate;
  const motion = String(r.motion || '') as Motion;
  let palette = Array.isArray(r.palette) ? r.palette.map(String).filter((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) : [];
  if (palette.length < 2) palette = PALETTES.cinematic[index % PALETTES.cinematic.length];
  return {
    title: String(r.title || '').slice(0, 80) || `Escena ${index + 1}`,
    subtitle: String(r.subtitle || r.text || '').slice(0, 160),
    template: TEMPLATES.includes(template) ? template : TEMPLATES[index % TEMPLATES.length],
    palette: palette.slice(0, 4),
    duration: clamp(Number(r.duration) || 6, 2, 15),
    motion: MOTIONS.includes(motion) ? motion : 'kenburns',
    voiceover: r.voiceover ? String(r.voiceover).slice(0, 300) : undefined,
  };
}

export interface GenerateResult {
  storyboard: Storyboard;
  usedAI: boolean;
  error?: string;
  model?: string;
}

export async function generateStoryboard(
  prompt: string,
  minutes: number,
  aspect: string,
  settings: AiSettings,
  onStatus?: (s: string) => void
): Promise<GenerateResult> {
  const sceneTarget = clamp(Math.round((minutes * 60) / 9), 4, 16);
  const fallback = () => fallbackStoryboard(prompt, minutes, sceneTarget);

  onStatus?.('Comprobando Ollama local…');
  const tags = await listModels(settings, 3500);
  if (!tags.ok) {
    return { storyboard: fallback(), usedAI: false, error: `No se pudo conectar con Ollama (${tags.error}). He generado un storyboard local.` };
  }
  let model = settings.model;
  if (tags.models.length && !tags.models.some((m) => m.name === model || m.name.startsWith(model + ':'))) {
    model = tags.models[0].name;
    onStatus?.(`Usando el modelo disponible: ${model}`);
  }

  const system = `Eres Vidora Director, un director de cine y guionista experto. Conviertes ideas en storyboards visuales para videos cortos y cinematográficos.
Responde SIEMPRE con JSON válido, sin markdown ni texto extra.
Esquema exacto:
{
  "title": "título de 2 a 6 palabras",
  "logline": "una frase de 10 a 20 palabras",
  "style": "una palabra (cinematic, neon, nature, luxury, space)",
  "mood": "cinematic | ambient | lofi | epic | electronic",
  "scenes": [
    {
      "title": "2 a 5 palabras",
      "subtitle": "frase de 6 a 16 palabras, evocadora",
      "template": "aurora | nebula | grid | particles | waves | spotlight | skyline | editorial",
      "palette": ["#color1", "#color2", "#colorFondoOscuro"],
      "duration": 4,
      "motion": "kenburns | parallax | zoom-in | zoom-out | static",
      "voiceover": "una o dos frases de narración"
    }
  ]
}
Reglas: exactamente ${sceneTarget} escenas. Paletas oscuras y cinematográficas. Varía plantillas. El texto debe estar en español. No repitas títulos.`;

  const user = `Idea: ${prompt}
Duración total: ${minutes} minutos
Formato: ${aspect}
Número de escenas: ${sceneTarget}
Crea un storyboard coherente con progresión narrativa (inicio, desarrollo, clímax, cierre).`;

  try {
    onStatus?.(`Escribiendo el guion con ${model}…`);
    const raw = await chat({
      settings: { ...settings, model },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      json: true,
      temperature: 0.9,
    });
    const parsed = extractJson(raw) as Record<string, unknown>;
    const scenesRaw = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const scenes = scenesRaw.map((s, i) => normalizeScene(s, i)).filter(Boolean) as StoryboardScene[];
    if (!scenes.length) throw new Error('El JSON no contenía escenas válidas');
    const mood = String(parsed.mood || '') as MusicMood;
    const sb: Storyboard = {
      title: String(parsed.title || titleCase(cleanSubject(prompt))).slice(0, 90),
      logline: String(parsed.logline || '').slice(0, 240),
      style: String(parsed.style || 'cinematic'),
      mood: ['cinematic', 'ambient', 'lofi', 'epic', 'electronic'].includes(mood) ? mood : 'cinematic',
      scenes,
    };
    return { storyboard: sb, usedAI: true, model };
  } catch (e) {
    return {
      storyboard: fallback(),
      usedAI: false,
      error: `La IA local no pudo completar el guion (${(e as Error).message}). He usado el director local de respaldo.`,
    };
  }
}

export async function improvePrompt(prompt: string, settings: AiSettings): Promise<string> {
  const raw = await chat({
    settings,
    messages: [
      { role: 'system', content: 'Eres un experto en prompts para cine generativo. Reescribe la idea del usuario en 2-3 frases: añade atmósfera, luz, cámara, paleta y emoción. Responde solo con el prompt mejorado, en español, sin comillas.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.9,
    onToken: () => {},
  });
  return raw.trim().replace(/^["']|["']$/g, '');
}

export async function generateSeo(project: Project, settings: AiSettings): Promise<string> {
  const scenes = project.clips.filter((c) => c.kind === 'scene').map((c) => (c as { title: string; subtitle: string }).title).join(' · ');
  return chat({
    settings,
    messages: [
      { role: 'system', content: 'Eres un estratega de contenido. Devuelve en texto plano: 1 título atractivo, 1 descripción de 2 frases, 10 hashtags y 3 ideas de thumbnail. En español, conciso.' },
      { role: 'user', content: `Proyecto: ${project.name}\nIdea: ${project.prompt}\nEscenas: ${scenes}\nDuración: ${Math.round(project.duration)}s` },
    ],
    temperature: 0.8,
  });
}

export interface AgentAction {
  type: string;
  minutes?: number;
  text?: string;
  mood?: string;
  template?: string;
  title?: string;
  duration?: number;
}

export function extractActions(text: string): { clean: string; actions: AgentAction[] } {
  const actions: AgentAction[] = [];
  const clean = text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (match, body) => {
    const t = String(body).trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && typeof item === 'object' && typeof item.action === 'string') {
            actions.push({
              type: item.action,
              minutes: Number(item.minutes) || undefined,
              text: item.text,
              mood: item.mood,
              template: typeof item.template === 'string' ? item.template : undefined,
              title: typeof item.title === 'string' ? item.title : undefined,
              duration: Number(item.duration) || undefined,
            });
          }
        }
        return '';
      } catch {
        return match;
      }
    }
    return match;
  });
  return { clean: clean.trim(), actions };
}

export function buildCaptionClips(project: Project): TextClip[] {
  const scenes = project.clips
    .filter((c) => c.kind === 'scene')
    .sort((a, b) => a.start - b.start) as Array<Clip & { kind: 'scene'; title: string; subtitle: string }>;
  const captions: TextClip[] = [];
  for (const scene of scenes) {
    const text = scene.subtitle || scene.title;
    if (!text) continue;
    captions.push({
      id: uid('clip'),
      trackId: '',
      kind: 'text',
      name: `Subtítulo · ${scene.title || 'escena'}`,
      start: scene.start + Math.min(0.8, scene.duration * 0.1),
      duration: Math.min(4.5, Math.max(1.6, scene.duration - 1)),
      fadeIn: 0.25,
      fadeOut: 0.25,
      opacity: 0.95,
      filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0 },
      text,
      fontFamily: 'Sora',
      fontSize: 30,
      fontWeight: 500,
      color: '#ffffff',
      align: 'center',
      x: 0.5,
      y: 0.86,
      animation: 'fade',
      uppercase: false,
      letterSpacing: 0,
      background: true,
      width: 0.8,
    });
  }
  return captions;
}

export function demoAgentReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('duración') || p.includes('minuto')) {
    return 'Puedo ajustar la duración desde el panel de exportación o el campo de minutos del proyecto. Dime, por ejemplo: «pon 3 minutos» y lo aplico.';
  }
  if (p.includes('escena')) {
    return 'En el panel izquierdo tienes plantillas de escena (aurora, nebulosa, grid, olas…). También puedes pedirme «añade una escena de nebulosa» y la inserto al final del timeline.';
  }
  if (p.includes('export') || p.includes('descarg')) {
    return 'Abre «Exportar» arriba a la derecha: eliges minutos, resolución (hasta 4K), FPS y calidad. La exportación se graba en tiempo real y se descarga al terminar.';
  }
  if (p.includes('hola') || p.includes('ayuda')) {
    return 'Soy tu copiloto local. Puedo escribir guiones, crear escenas, poner subtítulos, ajustar duración y preparar la exportación. Conecta Ollama para respuestas reales con tu modelo local.';
  }
  return `Entendido: «${prompt.slice(0, 180)}». Cuando Ollama esté conectado podré razonar y ejecutar acciones sobre el proyecto. Mientras tanto, prueba a generar un video desde el prompt del estudio.`;
}
