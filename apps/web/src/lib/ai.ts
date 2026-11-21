import { MUSIC_MOOD_LABELS, MUSIC_MOODS } from '@/types';
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

/* --- Detección de paisajes y géneros musicales --- */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function wordRe(w: string): RegExp {
  const esc = stripAccents(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${esc}(?=\\s|$)`, 'i');
}

export interface Landmark {
  id: string;
  label: string;
  templates: SceneTemplate[];
  palettes: string[][];
  defaultMood: MusicMood;
  names: Array<[string, string]>;
  words: string[];
}

function L(
  id: string,
  label: string,
  templates: SceneTemplate[],
  palettes: string[][],
  defaultMood: MusicMood,
  names: Array<[string, string]>,
  words: string[],
): Landmark {
  return { id, label, templates, palettes, defaultMood, names, words };
}

export const LANDMARKS: Landmark[] = [
  L('beach', 'Playa', ['waves', 'aurora', 'spotlight', 'skyline', 'particles'], [
    ['#7dd3fc', '#22d3ee', '#020617'],
    ['#fcd34d', '#38bdf8', '#041022'],
    ['#0ea5e9', '#0f172a', '#0b1020'],
  ], 'ambient', [
    ['La marisma', 'El horizonte se desliza.'],
    ['Playa al atardecer', 'Arena y olas susurrantes.'],
    ['Tierra desierta', 'Brisa que marca la orilla.'],
    ['Azul intenso sobre el océano.', 'Reflejo del sol en la arena.'],
  ], ['playa', 'oceano', 'océano', 'mar', 'costa', 'litoral', 'olas', 'arena', 'surf', 'caribe', 'amanecer', 'atardecer', 'azul profundo']),
  L('desert', 'Desierto', ['aurora', 'spotlight', 'editorial', 'grid', 'particles'], [
    ['#f97316', '#e3b341', '#0c0400'],
    ['#b45309', '#fbbf24', '#1a0c05'],
    ['#e2e8f0', '#8a5a2d', '#0b0804'],
  ], 'epic', [
    ['El Espíritu del desierto', 'Calor y piel de sal.'],
    ['Dunes', 'Silencio roto por el viento.'],
    ['El horizonte cristalino', 'Calor que impacta.'],
    ['Cimbreo del desierto', 'A través de la crestería.'],
  ], ['desierto', 'desiertos', 'arenosa', 'dunas', 'sahara', 'wadi', 'fuego del desierto', 'acantilado']),
  L('forest', 'Bosque', ['aurora', 'waves', 'spotlight', 'editorial', 'particles'], [
    ['#166534', '#22c55e', '#052e16'],
    ['#fbbf24', '#86efac', '#071a0f'],
    ['#0a2310', '#14532d', '#06150e'],
  ], 'ambient', [
    ['Inicios del verde', 'Estación de las nubes.'],
    ['El bosque antiguo', 'Una sombra con historia.'],
    ['Niebla emponzoñada', 'Entre las hojas.'],
  ], ['bosque', 'selva', 'jungla', 'forestales', 'bosques', 'arbusto', 'verde profundo', 'cañón', 'profundo']),
  L('mountain', 'Montaña', ['aurora', 'spotlight', 'editorial', 'grid', 'waves'], [
    ['#0f172a', '#38bdf8', '#060d14'],
    ['#e2e8f0', '#64748b', '#07070c'],
    ['#0a3e3e', '#1e4c4c', '#052121'],
  ], 'epic', [
    ['El pico', 'La altura del mundo.'],
    ['Mina de alto y claro', 'La montaña al atardecer.'],
    ['Altiplano', 'La tierra que duerme.'],
  ], ['montaña', 'montana', 'montañosa', 'montañosas', 'cordillera', 'cumbre', 'pico', 'alpes', 'glaciar', 'nieve', 'nubes bajas', 'pulgadas de hielo', 'sierra']),
  L('city', 'Ciudad', ['grid', 'skyline', 'editorial', 'aurora', 'particles'], [
    ['#020617', '#374151', '#0a0f1f'],
    ['#22d3ee', '#a855f7', '#0f1626'],
    ['#1f2a3a', '#2a2f3a', '#05060a'],
  ], 'electronic', [
    ['Neón dormido', 'Retroiluminación de la mejor retirada.'],
    ['El río del concreto', 'Lujos en movimiento.'],
    ['Ciudad sin fin', 'Estrellas que te encadenan.'],
  ], ['ciudad', 'urbano', 'calles', 'neón', 'neon', 'rascacielos', 'edificios', 'skyscraper', 'avenida', 'metrópolis', 'concrete', 'torre arquitectónica', 'impresión urbana']),
  L('space', 'Espacio', ['nebula', 'aurora', 'particles', 'skyline', 'waves'], [
    ['#0b0d17', '#8b5cf6', '#03060f'],
    ['#0ea5e9', '#6366f1', '#0c1a2e'],
    ['#1a3a5c', '#8b5cf6', '#020617'],
  ], 'ambient', [
    ['El horizonte cristalino', 'Luz que impacta.'],
    ['El cosmos despierto', 'Mar de estrellas.'],
    ['Luz de la aurora', 'A través de la mente.'],
  ], ['espacio', 'espacial', 'galaxia', 'universo', 'cosmos', 'nebulosa', 'planetas', 'estrellas', 'órbita', 'astronauta', 'marte', 'luna', 'quasar', 'travesía interestelar', 'dorso de la historia']),
  L('field', 'Campo', ['aurora', 'waves', 'editorial', 'spotlight', 'grid'], [
    ['#ffa726', '#ffcc80', '#1b1a12'],
    ['#a3e635', '#facc15', '#21280f'],
    ['#fbbf24', '#84cc16', '#0f0f0a'],
  ], 'ambient', [
    ['Inicio de la cosecha', 'Tierra de oro.'],
    ['Caminos del mediodía', 'Fuegos sobre el horizonte.'],
    ['El pampa vecino', 'Estrellas sobre la frontera.'],
  ], ['pampa', 'llanura', 'pastizal', 'pradera', 'campo', 'ejido', 'colinas', 'granero', 'viñedo', 'trigo', 'fundo', 'campo de trigo', 'horizonte de trigo', 'fundo pobre']),
  L('lake', 'Lago', ['aurora', 'waves', 'spotlight', 'editorial', 'grid'], [
    ['#22d3ee', '#38bdf8', '#020617'],
    ['#a855f7', '#7dd3fc', '#050a12'],
    ['#14532d', '#06b6d4', '#050b0f'],
  ], 'ambient', [
    ['Reflejo marino', 'Vendo sobre el lago.'],
    ['Yacimiento estelar', 'Familias de olas.'],
    ['Gota y resplandor', 'Filo sobre el lago.'],
  ], ['lago', 'laguna', 'río', 'rio', 'arroyo', 'orilla', 'pantano', 'lagos', 'riberas', 'lago de agua', 'cuerpo de agua']),
  L('storm', 'Tormenta', ['aurora', 'particles', 'grid', 'skyline', 'waves'], [
    ['#475569', '#94a3b8', '#020617'],
    ['#0ea5e9', '#38bdf8', '#0a1622'],
    ['#1e3a5c', '#0ea5e9', '#050912'],
  ], 'epic', [
    ['Ventisca de la historia', 'Lámina en movimiento.'],
    ['Luz de la tormenta', 'Tiempo en la arena.'],
    ['Cielo lúgubre', 'El fin de la lluvia.'],
  ], ['tormenta', 'tormentas', 'lluvia', 'lluvioso', 'rayo', 'relámpago', 'huracán', 'niebla', 'electrifica', 'lluvia nocturna']),
  L('underwater', 'Submarino', ['aurora', 'particles', 'waves', 'spotlight', 'nebula'], [
    ['#0ea5e9', '#38bdf8', '#041022'],
    ['#22c55e', '#7dd3fc', '#0f2822'],
    ['#111827', '#6b7280', '#040108'],
  ], 'ambient', [
    ['Reflejo', 'Continuación de la puesta de sol.'],
    ['El horizonte cristalino', 'Estrellas sobre el agua.'],
    ['Coralina', 'Estrellas bajo el agua.'],
  ], ['bajo el mar', 'arrecife', 'coral', 'buceo', 'submarino', 'peces', 'acuario', 'sotavento', 'cayo', 'estrellado del mar']),
  L('volcano', 'Volcán', ['aurora', 'grid', 'particles', 'spotlight'], [
    ['#b91c1c', '#ef4444', '#030004'],
    ['#f97316', '#eab308', '#1c0a02'],
    ['#451a03', '#a16207', '#0b0502'],
  ], 'epic', [
    ['El estallido de la historia', 'Magma dorado.'],
    ['Boceto del volcán', 'Rima sobre la montaña.'],
    ['Noche incandescente', 'La línea de la erupción.'],
  ], ['volcán', 'volcan', 'lava', 'erupción', 'fuego en la noche', 'basalto', 'cráter', 'intenso arriba']),
  L('winter', 'Invierno', ['aurora', 'spotlight', 'editorial', 'grid', 'waves'], [
    ['#f472b6', '#e2e8f0', '#050a14'],
    ['#a855f7', '#22d3ee', '#0c1020'],
    ['#94a3b8', '#2a3640', '#06060e'],
  ], 'ambient', [
    ['Magia invernal', 'Tradición bajo la nieve.'],
    ['Casita en los retes', 'Calor de la chimenea.'],
    ['Viento suave', 'Despierta la calma.'],
  ], ['invierno', 'nieve', 'hielo', 'ventisca', 'niebla de invierno', 'retroiluminación']),
  L('tropical', 'Tropical', ['aurora', 'waves', 'spotlight', 'editorial'], [
    ['#f472b6', '#facc15', '#0a0414'],
    ['#34d399', '#22d3ee', '#003717'],
    ['#fbbf24', '#34b0c4', '#1a1407'],
  ], 'latin', [
    ['Viento premium', 'Fuegos en el horizonte.'],
    ['Suelto en la arboleda', 'Palmeras al centro.'],
    ['Playa solita', 'Bajo el sol de luna.'],
  ], ['tropical', 'palmeras', 'isla', 'hawái', 'maldivas', 'ibiza', 'samba', 'intensa cinta de arboleda']),
  L('night', 'Noche', ['aurora', 'grid', 'skyline', 'spotlight', 'waves'], [
    ['#0f172a', '#1e40af', '#020617'],
    ['#a5f3fc', '#8b5cf6', '#0b1224'],
    ['#475569', '#1d4ed8', '#0f0f13'],
  ], 'ambient', [
    ['Sueño nocturno', 'Dulces sueños a través de la noche.'],
    ['Estafeta de luna', 'Fierro sobre el río.'],
  ], ['noche', 'nocturno', 'luna', 'estrellado', 'sereno', 'oscuridad']),
  L('portrait', 'Retrato', ['spotlight', 'editorial', 'aurora', 'grid'], [
    ['#0f172a', '#e2e8f0', '#020617'],
    ['#f472b6', '#38bdf8', '#081225'],
    ['#111827', '#475569', '#02060b'],
  ], 'piano', [
    ['El rostro de la historia', 'Foco sobre la cara.'],
    ['Ojo que impacta', 'Luz de una persona.'],
    ['Primer plano', 'Intimidad en cámara.'],
  ], ['retrato', 'rostro', 'persona', 'modelo', 'cara', 'portrait']),
  L('product', 'Producto', ['editorial', 'spotlight', 'aurora', 'skyline'], [
    ['#0f172a', '#e2e8f0', '#020617'],
    ['#94a3b8', '#f472b6', '#05070b'],
    ['#475569', '#e2e8f0', '#020407'],
  ], 'cinematic', [
    ['Mujer de estilo', 'Encuentro con el producto.'],
    ['Primer encuentro', 'Rojo intensivo y elegante.'],
    ['Estudio sin adornos', 'El producto al centro.'],
  ], ['producto', 'marca', 'perfume', 'zapatilla', 'reloj', 'joya', 'acabado mate', 'devCosmetic', 'café']),
  L('wedding', 'Boda', ['spotlight', 'aurora', 'editorial', 'waves', 'particles'], [
    ['Esquina del bazar', 'Noche rosada sobre el agua.'],
    ['Puesto de las novias', 'Praga sobre el campo.'],
    ['Lo que sorprende', 'Estar en el centro de la cámara.'],
  ], 'piano', [
    ['Vestido doBLO', 'Un gesto frontal.'],
    ['Tradición y fe', 'Pago con luz.'],
  ], ['boda', 'bodas', 'matrimonio', 'pareja', 'romance', 'novia', 'novio', 'wedding']),
];

const MOOD_RULES: Array<[MusicMood, string[]]> = [
  ['rock', ['rock', 'guitarra eléctrica', 'guitarras electricas', 'metal', 'punk', 'hard rock', 'electrifying']],
  ['jazz', ['jazz', 'saxofón', 'saxofon', 'saxofones', 'bossa nova', 'swing', 'blues', 'tono jazz']],
  ['piano', ['piano', 'pianos', 'balada', 'acústico', 'acustico', 'melancólico', 'melancolico', 'intimo', 'íntimo', 'tono piano', 'melodía triste']],
  ['latin', ['cumbia', 'salsa', 'merengue', 'bachata', 'reggaetón', 'reggaeton', 'tango', 'bolero', 'folklore', 'folclor', 'chacarera', 'zamba', 'vidalita', 'latina', 'ritmo de fiesta latina']],
  ['electronic', ['electrónica', 'electronica', 'techno', 'house', 'edm', 'rave', 'dubstep', 'trap', 'sintetizador', 'club', 'fiesta', 'trance', 'synth', 'synthwave', 'cyberpunk', 'cyberspace', 'energía eléctrica']],
  ['lofi', ['lofi', 'lo-fi', 'chill', 'relax', 'relajante', 'tranqui', 'estudio', 'beats']],
  ['epic', ['épico', 'epico', 'épica', 'epica', 'trailer', 'tráiler', 'batalla', 'guerra', 'heroico', 'orquestal', 'dramático', 'dramatico', 'adrenalina', 'intenso', 'grande']],
  ['ambient', ['ambient', 'meditación', 'meditacion', 'etéreo', 'etereo', 'calma', 'sueño', 'drone', 'atmosférico', 'atmosferico', 'sombras bajas']],
  ['cinematic', ['cinematográfico', 'cinematografico', 'cine', 'emotivo', 'banda sonor', 'orquesta', 'score']],
];

const TEMPLATE_WORDS: Array<[SceneTemplate, string[]]> = [
  ['aurora', ['aurora', 'cielo', 'lunar', 'luna', 'aurora boreal']],
  ['nebula', ['nebulosa', 'espacio', 'galaxia', 'estrellas', 'cosmos', 'universo', 'planeta']],
  ['grid', ['neón', 'neon', 'retro', 'cyber', 'pixel', 'digital']],
  ['particles', ['partículas', 'particulas', 'polvo', 'magia', 'energía', 'energia']],
  ['spotlight', ['retrato', 'rostro', 'persona', 'bokeh', 'foco', 'luz', 'portrait']],
  ['skyline', ['ciudad', 'skyscraper', 'edificios', 'urbano', 'metrópolis']],
  ['editorial', ['marca', 'producto', 'elegante', 'satinada', 'revista', 'moda']],
  ['waves', ['océano', 'oceano', 'costa', 'olas', 'lago', 'río', 'rio', 'agua']],
];

const GENERIC_NAMES: Array<[string, string]> = [
  ['El inicio', 'Todo comienza aquí.'],
  ['La mirada', 'Un detalle lo cambia todo.'],
  ['El pulso', 'La historia empieza a moverse.'],
  ['La tensión', 'Algo está a punto de romperse.'],
  ['El clímax', 'Todo converge en un instante.'],
  ['La calma', 'Después de la tormenta, claridad.'],
  ['El eco', 'Lo que queda cuando termina.'],
  ['Nuevo horizonte', 'El principio de otra historia.'],
];

export function findLandmark(p: string): Landmark | null {
  for (const l of LANDMARKS) {
    for (const w of l.words) if (wordRe(w).test(p)) return l;
  }
  return null;
}

function findGenre(p: string): MusicMood | null {
  for (const [mood, words] of MOOD_RULES) {
    if (words.some((w) => wordRe(w).test(p))) return mood;
  }
  return null;
}

function findTemplate(p: string, idx: number, land: Landmark | null): SceneTemplate {
  const entry = TEMPLATE_WORDS.find(([, words]) => words.some((w) => wordRe(w).test(p)));
  if (entry) return entry[0];
  if (land) return land.templates[idx % land.templates.length];
  return TEMPLATES[idx % TEMPLATES.length];
}

export interface PromptAnalysis {
  landscape: Landmark | null;
  landscapeLabel: string;
  mood: MusicMood;
  moodLabel: string;
  style: string;
  subject: string;
  templates: SceneTemplate[];
  palettes: string[][];
  names: Array<[string, string]>;
}

/**
 * Analiza el prompt del usuario: paisaje, género musical, estilo, tema y las
 * plantillas/paletas que se van a usar.
 */
export function analyzePrompt(prompt: string): PromptAnalysis {
  const p = stripAccents(prompt || '');
  const land = findLandmark(p);
  const mood = findGenre(p) || (land ? land.defaultMood : 'cinematic');
  const subject = cleanSubject(prompt);
  return {
    landscape: land,
    landscapeLabel: land ? land.label : '',
    mood,
    moodLabel: MUSIC_MOOD_LABELS[mood] || mood,
    style: 'cinematic',
    subject,
    templates: land ? land.templates : TEMPLATES,
    palettes: land ? land.palettes : PALETTES.cinematic,
    names: land ? land.names : GENERIC_NAMES,
  };
}

function durationSecondsFrom(t: string): number | null {
  const s = t.match(/(\d+(?:[.,]\d+)?)\s*(?:segundos?|segs?|s)\b/);
  return s ? Math.max(12, Number(s[1].replace(',', '.'))) : null;
}

function durationMinutesFrom(t: string): number | null {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:minutos?|min)\b/);
  return m ? Math.max(0.2, Number(m[1].replace(',', '.'))) : null;
}

/**
 * Copiloto local: ejecuta acciones sobre el estudio sin Ollama.
 * Devuelve el texto de la respuesta al usuario y las acciones a aplicar.
 */
export function localAgentReply(prompt: string): { text: string; actions: AgentAction[] } {
  const t = stripAccents(prompt || '');
  const actions: AgentAction[] = [];
  const notes: string[] = [];

  const durWords = /(?:duración|dura|durar|minutos?|segundos?)\b/.test(t);
  const secs = durationSecondsFrom(t);
  const mins = durationMinutesFrom(t);
  if (mins) {
    actions.push({ type: 'set_duration', minutes: mins });
    notes.push(`Ajusto la duración a ${mins} minutos.`);
  } else if (secs && durWords) {
    const minutes = Math.max(0.2, secs / 60);
    actions.push({ type: 'set_duration', minutes });
    notes.push(`Ajusto la duración a ${Math.round(minutes)} minutos (${secs} segundos).`);
  }

  const land = findLandmark(t);
  const addCmd = /(?:añade|agrega|inserta|crea|pon|añádeme)\b/.test(t);
  if (land && /(?:paisaje|paisajes|escenas?|cambia|corrige|ajusta|aplica|reforma|refresca|mejora|reemplaza|actualiza)\b/.test(t)) {
    actions.push({ type: 'set_landscape', landscape: land.id });
    notes.push(`Reformo el paisaje a ${land.label}.`);
  }

  if (/escena/.test(t) && addCmd) {
    const template = findTemplate(t, 0, land);
    const titleMatch = t.match(/escena\s+(?:de\s+|sobre\s+|nueva\s+)?([^.,;]+)/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 40) : '';
    const dur = secs && /segundos?/.test(t) ? Math.max(2, secs) : 6;
    actions.push({ type: 'add_scene', template, title, duration: dur });
    notes.push(`Añado una escena ${template}${title ? `, «${title}»` : ''}.`);
  }

  const genre = findGenre(t);
  if (genre && /(?:m[uú]sica|banda sonor|ambiente|género|mood|tema|tono)\b/.test(t)) {
    actions.push({ type: 'set_mood', mood: genre });
    notes.push(`Cambio la música a ${MUSIC_MOOD_LABELS[genre] || genre}.`);
  }

  const textMatch = t.match(/["“«']([^"”»']{2,80})["”»']/) || t.match(/\btexto\s+(?:que\s+diga\s+)?([^.,;]+)/i);
  if (/\b(?:texto|t[ií]tulo|subt[ií]tulo|r[oó]tulo|cinta)\b/.test(t) && /(?:añade|agrega|pon|escribe|coloca)\b/.test(t) && textMatch?.[1]) {
    actions.push({ type: 'add_text', text: textMatch[1].trim() });
    notes.push(`Coloco el texto «${textMatch[1].trim()}».`);
  }

  if (/\b(?:reproduce|reproducir|play|dale play)\b/.test(t)) {
    actions.push({ type: 'play' });
    notes.push('Le doy play a la vista previa.');
  }
  if (/\b(?:pausa|pausar|det[eé]n)\b/.test(t) && !/det[eé]ngo/.test(t)) {
    actions.push({ type: 'pause' });
    notes.push('Pauso la reproducción.');
  }
  if (/\b(?:exporta|exportar|renderiza|render|descarga el video)\b/.test(t)) {
    actions.push({ type: 'export' });
    notes.push('Abro el panel de exportación.');
  }
  const genMatch = t.match(/(?:genera|generar|crea un video|haz un video)\s+(?:sobre\s+|de\s+)?([^.,;]+)/i);
  if (/\b(?:genera|generar|crea un video|haz un video)\b/.test(t) && !/proyecto/i.test(t)) {
    actions.push({ type: 'generate', prompt: (genMatch?.[1] || t).trim().slice(0, 160), minutes: mins || 1 });
    notes.push('Lanzo la generación del video con el director local.');
  }

  if (!notes.length) notes.push('Entendido. ¿En qué te ayudo más?');
  return { text: notes.join(' '), actions };
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
  const a = analyzePrompt(prompt);
  const subject = a.subject;
  const palettes = a.palettes;
  const templates = a.templates;
  const names = a.names;
  const title = titleCase(subject) || 'Sin título';
  const sceneCount = clamp(count || Math.round((minutes * 60) / 9), 4, 18);
  const sceneSeconds = (minutes * 60) / sceneCount;
  const scenes: StoryboardScene[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const [title, subtitle] = names[i % names.length];
    const isFirst = i === 0;
    const isLast = i === sceneCount - 1;
    const extra = isFirst
      ? `Una historia sobre ${subject}.`
      : isLast
        ? 'Y entonces, todo tuvo sentido.'
        : i % 3 === 0 && subject ? `${title} de ${subject.split(' ').slice(0, 5).join(' ')}.` : subtitle;
    scenes.push({
      title: title || `Escena ${i + 1}`,
      subtitle: (extra || subtitle).slice(0, 160),
      template: templates[i % templates.length],
      palette: palettes[i % palettes.length],
      duration: clamp(sceneSeconds, 3, 12),
      motion: MOTIONS[i % MOTIONS.length],
    });
  }

  return {
    title,
    logline: `Una pieza audiovisual sobre ${subject}.`,
    style: a.style,
    mood: a.mood,
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

function normalizeScene(raw: unknown, index: number, land: Landmark | null = null): StoryboardScene | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const template = String(r.template || '') as SceneTemplate;
  const motion = String(r.motion || '') as Motion;
  let palette = Array.isArray(r.palette) ? r.palette.map(String).filter((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) : [];
  if (palette.length < 2) palette = (land ? land.palettes : PALETTES.cinematic)[index % (land ? land.palettes.length : PALETTES.cinematic.length)];
  const sceneNames = land ? land.names : GENERIC_NAMES;
  const genericTitle = String(r.title || '').slice(0, 80);
  const fallbackName = sceneNames[index % sceneNames.length] || GENERIC_NAMES[index % GENERIC_NAMES.length];
  const isGeneric = /^escena\s+\d/i.test(genericTitle) || !genericTitle;
  return {
    title: (isGeneric ? fallbackName[0] : genericTitle) || `Escena ${index + 1}`,
    subtitle: (String(r.subtitle || r.text || '').slice(0, 160) || (isGeneric ? fallbackName[1] : '')),
    template: land ? land.templates[index % land.templates.length] : (TEMPLATES.includes(template) ? template : TEMPLATES[index % TEMPLATES.length]),
    palette: land ? land.palettes[index % land.palettes.length] : palette.slice(0, 4),
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
  "mood": "cinematic | ambient | lofi | epic | electronic | rock | jazz | piano | latin",
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
    const analysis = analyzePrompt(prompt);
    const land = findLandmark(stripAccents(prompt));
    const mood = (findGenre(prompt) || land?.defaultMood || String(parsed.mood || '') || 'cinematic') as MusicMood;
    const scenes = scenesRaw.map((s, i) => normalizeScene(s, i, land)).filter(Boolean) as StoryboardScene[];
    if (!scenes.length) throw new Error('El JSON no contenía escenas válidas');
    const sb: Storyboard = {
      title: String(parsed.title || analysis.subject).slice(0, 90),
      logline: String(parsed.logline || '').slice(0, 240),
      style: 'cinematic',
      mood: MUSIC_MOODS.includes(mood) ? mood : 'cinematic',
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
  landscape?: string;
  aspect?: string;
  prompt?: string;
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
