/* Vidora Desktop — copiloto conectado al estudio web y a Ollama local. */

const api = window.vidora;
const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const els = {
  studio: $('studio'),
  messages: $('messages'),
  welcome: $('welcome'),
  input: $('prompt-input'),
  send: $('send'),
  stop: $('stop'),
  pill: $('ollama-pill'),
  model: $('model-select'),
  url: $('studio-url'),
  dot: $('webview-dot'),
  loading: $('stage-loading'),
  loadingText: $('stage-loading-text'),
  toasts: $('toasts'),
  dialog: $('settings-dialog'),
  form: $('settings-form'),
  appInfo: $('app-info'),
  settingsPath: $('settings-path')
};

const state = {
  settings: null,
  status: 'checking',
  models: [],
  studioReady: false,
  busy: false,
  requestId: null,
  streamingId: null,
  messages: [],
  unsubToken: null,
  raf: false
};

const LANDSCAPES = [
  { id: 'beach', label: 'Playa', words: ['playa', 'oceano', 'océano', 'mar', 'costa', 'litoral', 'olas', 'arena', 'surf', 'caribe', 'amanecer', 'atardecer'] },
  { id: 'desert', label: 'Desierto', words: ['desierto', 'dunas', 'sahara', 'wadi', 'acantilado'] },
  { id: 'forest', label: 'Bosque', words: ['bosque', 'selva', 'jungla', 'verde', 'bosques', 'arbusto', 'cañón'] },
  { id: 'mountain', label: 'Montaña', words: ['montaña', 'montana', 'montañosa', 'cordillera', 'cumbre', 'pico', 'alpes', 'glaciar', 'nieve', 'nubes bajas'] },
  { id: 'city', label: 'Ciudad', words: ['ciudad', 'rascacielos', 'edificios', 'skyscraper', 'avenida', 'urbano', 'metrópolis', 'impresión urbana'] },
  { id: 'space', label: 'Espacio', words: ['espacio', 'galaxia', 'universo', 'cosmos', 'nebulosa', 'planetas', 'estrellas', 'órbita', 'astronauta'] },
  { id: 'field', label: 'Campo', words: ['pampa', 'llanura', 'pastizal', 'pradera', 'campo', 'ejido', 'colinas', 'granero', 'viñedo', 'trigo', 'fundo'] },
  { id: 'lake', label: 'Lago', words: ['lago', 'laguna', 'río', 'rio', 'arroyo', 'orilla', 'pantano', 'riberas', 'cuerpo de agua'] },
  { id: 'storm', label: 'Tormenta', words: ['tormenta', 'tormentas', 'lluvia', 'lluvioso', 'rayo', 'relámpago', 'huracán', 'niebla', 'electrifica'] },
  { id: 'underwater', label: 'Submarino', words: ['bajo el mar', 'arrecife', 'coral', 'buceo', 'submarino', 'peces', 'acuario', 'sotavento'] },
  { id: 'volcano', label: 'Volcán', words: ['volcán', 'volcan', 'lava', 'erupción', 'basalto', 'cráter'] },
  { id: 'winter', label: 'Invierno', words: ['invierno', 'nieve', 'hielo', 'ventisca'] },
  { id: 'tropical', label: 'Tropical', words: ['tropical', 'palmeras', 'isla', 'hawái', 'maldivas', 'ibiza', 'samba'] },
  { id: 'night', label: 'Noche', words: ['noche', 'nocturno', 'luna', 'estrellado', 'sereno', 'sin estrellas'] },
  { id: 'portrait', label: 'Retrato', words: ['retrato', 'rostro', 'persona', 'modelo', 'primer plano'] },
  { id: 'product', label: 'Producto', words: ['producto', 'marca', 'perfume', 'joya', 'reloj', 'café', 'elegante'] },
  { id: 'wedding', label: 'Boda', words: ['boda', 'matrimonio', 'pareja', 'romance', 'novia'] },
];

const LANDING_PALETTE_TEMPLATES = {
  beach: 'waves', desert: 'aurora', forest: 'aurora', mountain: 'aurora', city: 'grid',
  space: 'nebula', field: 'aurora', lake: 'waves', storm: 'aurora', underwater: 'aurora',
  volcano: 'aurora', winter: 'aurora', tropical: 'aurora', night: 'grid', portrait: 'spotlight',
  product: 'editorial', wedding: 'spotlight'
};

const TEMPLATE_WORDS = [
  ['nebula', ['nebulosa', 'espacio', 'galaxia', 'estrellas', 'cosmos', 'planeta']],
  ['aurora', ['aurora', 'cielo', 'noche', 'luna', 'lunar', 'aurora boreal']],
  ['waves', ['océano', 'oceano', 'mar', 'costa', 'olas', 'agua']],
  ['particles', ['partículas', 'particulas', 'polvo', 'magia', 'energía', 'energia']],
  ['spotlight', ['retrato', 'rostro', 'bokeh', 'foco', 'luz', 'persona']],
  ['skyline', ['ciudad', 'skyscraper', 'edificios', 'urbano']],
  ['editorial', ['marca', 'producto', 'elegante', 'revista', 'moda']],
  ['grid', ['neón', 'neon', 'retro', 'cyber', 'digital']]
];

const MOOD_WORDS = [
  ['lofi', ['lofi', 'lo-fi', 'chill', 'relax', 'relajado', 'tranqui']],
  ['epic', ['épico', 'epico', 'épica', 'epica', 'trailer', 'tráiler', 'batalla', 'guerra', 'intenso', 'grande']],
  ['electronic', ['electrónica', 'electronica', 'techno', 'house', 'edm', 'club', 'fiesta', 'synth']],
  ['rock', ['rock', 'guitarra eléctrica', 'metal', 'punk', 'hard rock', 'sólida', 'intenso ritmo']],
  ['jazz', ['jazz', 'saxofón', 'saxofon', 'bossa nova', 'blues', 'swing']],
  ['piano', ['piano', 'balada', 'acústico', 'melancólico', 'melancolico', 'intimo', 'íntimo']],
  ['latin', ['cumbia', 'salsa', 'merengue', 'bachata', 'reggaetón', 'reggaeton', 'tango', 'bolero', 'folklore', 'latina']],
  ['ambient', ['ambiente', 'ambient', 'calma', 'etéreo', 'etereo', 'sueño', 'calma total']],
  ['cinematic', ['cinematográfico', 'cinematografico', 'cine', 'emotivo', 'banda sonor']]
];

function normText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const MOOD_LABEL = {
  lofi: 'Lo-fi', epic: 'Épico', electronic: 'Electrónica', rock: 'Rock',
  jazz: 'Jazz', piano: 'Piano / balada', latin: 'Latino', ambient: 'Ambient', cinematic: 'Cine'
};

function pick(words, t) {
  for (const item of Array.from(words)) {
    const entry = Array.isArray(item) ? item : [item.id, item.words];
    const [id, variants] = entry;
    if (!variants) continue;
    const found = variants.some((w) => new RegExp(`(?:^|\\s)${escapeRegex(normText(String(w)).toLowerCase())}(?=\\s|$)`, 'i').test(t));
    if (found) return id;
  }
  return '';
}

function escapeRegex(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ACTION_HELP = {
  set_duration: 'Cambiar duración',
  add_scene: 'Añadir escena',
  add_text: 'Añadir texto',
  set_mood: 'Cambiar música',
  set_landscape: 'Reformar paisaje',
  play: 'Reproducir',
  pause: 'Pausar',
  export: 'Abrir exportación',
  new_project: 'Nuevo proyecto',
  generate: 'Generar video'
};

const PROJECT_ACTIONS = new Set(['set_duration', 'add_scene', 'add_text', 'set_mood', 'set_landscape', 'play', 'pause', 'export']);

/* ---------------- Utilidades de UI ---------------- */

function toast(message, kind = '') {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  els.toasts.append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(4px)';
    node.style.transition = '0.25s ease';
    setTimeout(() => node.remove(), 260);
  }, 3600);
}

function setDot(kind) {
  els.dot.className = `dot ${kind}`;
}

function setLoading(visible, title, text) {
  if (title) els.loading.querySelector('h2').textContent = title;
  if (text) els.loadingText.textContent = text;
  els.loading.classList.toggle('done', !visible);
}

function normalizeUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/* ---------------- Render de mensajes ---------------- */

function scheduleRender() {
  if (state.raf) return;
  state.raf = true;
  setTimeout(() => {
    state.raf = false;
    renderMessages();
  }, 16);
}

function nearBottom() {
  const el = els.messages;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 90;
}

function renderMessages() {
  const stick = nearBottom();
  els.messages.replaceChildren();

  if (!state.messages.length) {
    els.messages.append(els.welcome);
    if (stick) els.messages.scrollTop = els.messages.scrollHeight;
    return;
  }

  for (const message of state.messages) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${message.role}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (message.role === 'assistant' && state.busy && !message.content) {
      const thinking = document.createElement('span');
      thinking.className = 'thinking';
      thinking.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
      bubble.append(thinking);
    } else {
      bubble.textContent = message.content;
    }
    wrap.append(bubble);

    if (message.commands?.length) {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      for (const cmd of message.commands) {
        const chip = document.createElement('span');
        chip.className = `action-chip${cmd.ok ? '' : ' failed'}`;
        chip.textContent = `${cmd.ok ? '✓' : '!'} ${commandLabel(cmd)}`;
        if (!cmd.ok && cmd.reason) chip.title = cmd.reason;
        actions.append(chip);
      }
      wrap.append(actions);
    }

    if (message.role === 'assistant' && message.meta && message.content) {
      const meta = document.createElement('span');
      meta.className = 'msg-meta';
      meta.textContent = message.meta;
      wrap.append(meta);
    }

    els.messages.append(wrap);
  }

  if (stick) els.messages.scrollTop = els.messages.scrollHeight;
}

function commandLabel(cmd) {
  const base = ACTION_HELP[cmd.action] || cmd.action;
  if (cmd.action === 'set_duration') return `${base} · ${cmd.minutes} min`;
  if (cmd.action === 'add_scene') return `${base} · ${cmd.template || 'escena'}`;
  if (cmd.action === 'add_text') return `${base} · «${String(cmd.text || '').slice(0, 26)}»`;
  if (cmd.action === 'set_mood') return `${base} · ${cmd.mood || ''}`;
  if (cmd.action === 'generate') return `${base} · ${String(cmd.prompt || '').slice(0, 28)}`;
  return base;
}

/* ---------------- Puente con el estudio ---------------- */

async function waitForBridge(timeout = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const ok = await els.studio.executeJavaScript('typeof window.__vidoraGetState === "function"', true);
      if (ok) return true;
    } catch {
      /* el webview aún no está listo */
    }
    await delay(250);
  }
  return false;
}

async function onStudioLoaded() {
  let current = '';
  try {
    current = els.studio.getURL ? els.studio.getURL() : '';
  } catch {
    current = '';
  }
  if (!/^https?:/i.test(current)) return; // about:blank inicial

  const wasReady = state.studioReady;
  setDot('loading');
  setLoading(true, 'Conectando con el estudio…');
  const ok = await waitForBridge(9000);
  state.studioReady = ok;
  if (ok) {
    setDot('on');
    setLoading(false);
    if (!wasReady) toast('Estudio conectado', 'ok');
  } else {
    setDot('off');
    setLoading(
      true,
      'No encuentro el estudio',
      'Inicia el servidor web de Vidora (npm run dev) o escribe la URL publicada en GitHub en Ajustes.'
    );
  }
}

async function getStudioState() {
  if (!state.studioReady) return { ready: false };
  try {
    const value = await els.studio.executeJavaScript(
      'window.__vidoraGetState ? window.__vidoraGetState() : { ready: false }',
      true
    );
    return value || { ready: false };
  } catch {
    return { ready: false };
  }
}

async function execCommand(command, studioState) {
  if (PROJECT_ACTIONS.has(command.action) && studioState && studioState.ready === false) {
    return { ok: false, reason: 'Abre un proyecto en el estudio para ejecutar esta acción.' };
  }
  if (!state.studioReady) {
    const ok = await waitForBridge(4000);
    state.studioReady = ok;
    if (!ok) return { ok: false, reason: 'El estudio no está conectado.' };
  }
  try {
    const { action, payload: _payload, ...rest } = command;
    const wire = JSON.stringify({ action, payload: _payload || rest });
    await els.studio.executeJavaScript(
      `window.postMessage({ source: 'vidora-desktop', type: 'command', command: ${wire} }, '*'); true;`,
      true
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function runCommands(commands, studioState) {
  const results = [];
  for (const command of commands) {
    const result = await execCommand(command, studioState);
    results.push({ ...command, ...result });
    if (!result.ok) toast(result.reason || 'No se pudo ejecutar la acción', 'err');
  }
  return results;
}

/* ---------------- Parseo de acciones ---------------- */

function extractCommands(text) {
  const commands = [];
  const pattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = pattern.exec(text))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        if (item && typeof item === 'object' && typeof item.action === 'string') {
          commands.push(item);
        }
      }
    } catch {
      /* bloque no válido: se deja como texto */
    }
  }
  const clean = text.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
  return { clean, commands };
}

/* ---------------- Fallback local sin Ollama ---------------- */

function titleCase(value) {
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean[0].toUpperCase() + clean.slice(1) : '';
}

function localDirector(text, studioState) {
  const t = normText(text).toLowerCase();
  const commands = [];
  const notes = [];

  const explicitMinutes = t.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos)\b/);
  const seconds = t.match(/(\d+(?:[.,]\d+)?)\s*(?:seg|segundo|segundos|s)\b/);
  const wantsDuration = /(duraci[oó]n|dura|minuto|min|segundo|seg)\b/.test(t);
  if (explicitMinutes && wantsDuration) {
    const minutes = Math.max(0.2, Number(explicitMinutes[1].replace(',', '.')));
    commands.push({ action: 'set_duration', minutes });
    notes.push(`Ajusto la duración a ${minutes} minuto${minutes === 1 ? '' : 's'}.`);
  } else if (seconds && wantsDuration) {
    const minutes = Math.max(0.2, Number(seconds[1].replace(',', '.')) / 60);
    commands.push({ action: 'set_duration', minutes });
    notes.push(`Ajusto la duración a ${Math.round(minutes * 60)} segundos.`);
  }

  const land = pick(LANDSCAPES, t);
  if (land && /(paisaje|escenas?)\b/.test(t)) {
    const landLabel = LANDSCAPES.find((l) => l.id === land)?.label || land;
    commands.push({ action: 'set_landscape', landscape: land });
    notes.push(`Reformo el paisaje a ${landLabel}.`);
  }

  if (/escena/.test(t) && /(a[ñn]ade|agrega|inserta|crea|pon)/.test(t)) {
    const template = (land && LANDING_PALETTE_TEMPLATES[land]) || pick(TEMPLATE_WORDS, t) || 'aurora';
    const seconds = t.match(/(\d+(?:[.,]\d+)?)\s*(?:seg|segundo|segundos|s)\b/);
    const titleMatch = text.match(/escena\s+(?:de\s+|sobre\s+)?([^.,;]+?)(?:\s+de\s+\d+(?:[.,]\d+)?\s*(?:seg|segundos?|s)\b|$)/i);
    const title = titleMatch ? titleCase(titleMatch[1]) : '';
    commands.push({ action: 'add_scene', template, title, duration: seconds ? Math.max(2, Number(seconds[1].replace(',', '.'))) : 6 });
    notes.push(`Añado una escena ${template}${title ? `, «${title}»` : ''}.`);
  }

  if (/(texto|t[ií]tulo|subt[ií]tulo|r[oó]tulo)/.test(t) && /(a[ñn]ade|agrega|pon|escribe|coloca)/.test(t)) {
    const quoted = text.match(/["“«']([^"”»']{2,80})["”»']/);
    const value = quoted ? quoted[1] : text.replace(/.*(?:texto|t[ií]tulo|subt[ií]tulo|r[oó]tulo)\s*(?:que\s+diga\s*)?/i, '').trim();
    if (value) {
      commands.push({ action: 'add_text', text: value });
      notes.push(`Coloco el texto «${value}».`);
    }
  }

  const genre = pick(MOOD_WORDS, t);
  if (genre) {
    commands.push({ action: 'set_mood', mood: genre });
    notes.push(`Cambio la música a ${MOOD_LABEL[genre] || genre}.`);
  }

  if (/(reproduce|reproducir|play|dale play)/.test(t)) {
    commands.push({ action: 'play' });
    notes.push('Le doy play a la vista previa.');
  }
  if (/(pausa|pausar|det[eé]n)/.test(t)) {
    commands.push({ action: 'pause' });
    notes.push('Pauso la reproducción.');
  }
  if (/(exporta|exportar|renderiza|render|descarga el video|exportame)/.test(t)) {
    commands.push({ action: 'export' });
    notes.push('Abro el panel de exportación en el estudio.');
  }
  if (/(nuevo proyecto|proyecto nuevo|crea un proyecto)/.test(t)) {
    commands.push({ action: 'new_project' });
    notes.push('Creo un proyecto nuevo.');
  }
  if (/(genera|generar|crea un video|haz un video)/.test(t) && !/proyecto/.test(t)) {
    const prompt = text.replace(/.*(?:genera|generar|crea un video|haz un video)\s*(?:sobre\s+|de\s+)?/i, '').trim() || text;
    commands.push({ action: 'generate', prompt, minutes: explicitMinutes ? Number(explicitMinutes[1].replace(',', '.')) : seconds ? Math.max(0.2, Number(seconds[1].replace(',', '.')) / 60) : 1 });
    notes.push('Lanzo la generación del video con el director local.');
  }

  let reply = notes.length ? notes.join(' ') : '';
  if (!reply) {
    reply = 'Estoy en modo local porque Ollama no responde. Puedo cambiar la duración, añadir escenas, colocar texto, ajustar la música, reproducir o exportar. Dime, por ejemplo: «añade una escena de océano de 5 segundos».';
  }
  if (studioState && studioState.ready && studioState.project) {
    const p = studioState.project;
    reply += `\n\nProyecto actual: «${p.name}» · ${p.minutes} min · ${p.scenes} escenas.`;
  } else {
    reply += '\n\nNo hay un proyecto abierto en el estudio. Abre o crea uno para que las acciones tengan efecto.';
  }
  return { reply, commands };
}

/* ---------------- Chat ---------------- */

function buildSystemPrompt(studioState) {
  const context = JSON.stringify(studioState || { ready: false }).slice(0, 2600);
  return `Eres Vidora Copilot Desktop, el copiloto del estudio de video local Vidora. Trabajas junto al usuario mientras edita en el estudio embebido.
Responde en español, breve y útil (máximo 120 palabras). No uses markdown salvo el bloque json de acciones.
Puedes ejecutar acciones reales sobre el proyecto incluyendo UN bloque de código json con una acción o una lista de acciones. Después explica en una frase lo que haces.
Ejemplos:
\`\`\`json
{"action":"set_duration","minutes":3}
\`\`\`
\`\`\`json
[{"action":"add_scene","template":"nebula","title":"Ciudad de neón","duration":6},{"action":"set_mood","mood":"electronic"}]
\`\`\`
Acciones válidas:
- set_duration (minutes: número)
- add_scene (template: aurora|nebula|grid|particles|waves|spotlight|skyline|editorial, title: texto, duration: segundos)
- add_text (text: texto)
- set_mood (mood: cinematic|ambient|lofi|epic|electronic|rock|jazz|piano|latin)
- set_landscape (landscape: beach|desert|forest|mountain|city|space|field|lake|storm|underwater|volcano|winter|tropical|night|portrait|product|wedding)
- play, pause, export
- new_project
- generate (prompt: texto, minutes: número)
No inventes acciones fuera de la lista. No uses bloques json si no vas a ejecutar nada.
Estado actual del estudio: ${context}`;
}

function pushMessage(role, content, extra = {}) {
  const message = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    ...extra
  };
  state.messages.push(message);
  scheduleRender();
  return message;
}

function historyForOllama() {
  return state.messages
    .filter((m) => m.content && !m.pending)
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content }));
}

function setBusy(busy) {
  state.busy = busy;
  els.send.classList.toggle('hidden', busy);
  els.stop.classList.toggle('hidden', !busy);
  els.input.disabled = busy;
}

async function sendMessage() {
  const text = els.input.value.trim();
  if (!text || state.busy) return;

  els.input.value = '';
  els.input.style.height = 'auto';
  pushMessage('user', text);

  const studioState = await getStudioState();
  const assistant = pushMessage('assistant', '', { pending: true });
  state.streamingId = assistant.id;
  setBusy(true);
  scheduleRender();

  if (state.status !== 'on') {
    await delay(420);
    const result = localDirector(text, studioState);
    assistant.content = result.reply;
    assistant.pending = false;
    assistant.meta = 'Director local · sin Ollama';
    assistant.commands = await runCommands(result.commands, studioState);
    setBusy(false);
    scheduleRender();
    return;
  }

  const requestId = `req_${Date.now()}`;
  state.requestId = requestId;
  const settings = await api.getSettings();
  const result = await api.chat({
    requestId,
    host: settings.host,
    model: settings.model,
    temperature: settings.temperature,
    messages: [{ role: 'system', content: buildSystemPrompt(studioState) }, ...historyForOllama()]
  });

  if (state.requestId !== requestId) return;
  state.requestId = null;

  if (!result.ok) {
    const local = localDirector(text, studioState);
    const note = result.aborted ? 'Respuesta detenida.' : `No pude hablar con Ollama (${result.error}).`;
    assistant.content = assistant.content.trim()
      ? `${assistant.content}\n\n${note}`
      : `${local.reply}\n\n${note}`;
    assistant.meta = 'Director local · sin Ollama';
    assistant.commands = await runCommands(local.commands, studioState);
  } else {
    const finalText = result.content || assistant.content;
    const parsed = extractCommands(finalText);
    assistant.content = parsed.clean || finalText;
    assistant.meta = `Ollama · ${result.model || settings.model}`;
    assistant.commands = await runCommands(parsed.commands, studioState);
  }

  assistant.pending = false;
  setBusy(false);
  state.streamingId = null;
  scheduleRender();
}

function stopStreaming() {
  if (state.requestId) {
    api.abort(state.requestId);
    const message = state.messages.find((m) => m.id === state.streamingId);
    if (message && !message.content) message.content = '(respuesta detenida)';
    state.requestId = null;
  }
  setBusy(false);
  state.streamingId = null;
  scheduleRender();
}

/* ---------------- Ollama ---------------- */

async function refreshStatus(showToast = false) {
  if (!state.settings) return;
  state.status = 'checking';
  els.pill.className = 'pill checking';
  els.pill.textContent = 'Comprobando Ollama…';
  els.model.disabled = true;

  const result = await api.ollamaTags(state.settings.host);
  if (result.ok) {
    state.status = 'on';
    state.models = result.models;
    els.pill.className = 'pill on';
    els.pill.textContent = result.models.length
      ? `Ollama · ${result.models.length} modelo${result.models.length === 1 ? '' : 's'}`
      : 'Ollama conectado · sin modelos';
    els.pill.title = `${result.host} · ${result.latency} ms`;
    fillModels(result.models);
    if (showToast) toast('Ollama conectado', 'ok');
  } else {
    state.status = 'off';
    state.models = [];
    els.pill.className = 'pill off';
    els.pill.textContent = 'Ollama no detectado';
    els.pill.title = `${state.settings.host} · ${result.error}`;
    els.model.disabled = true;
    els.model.replaceChildren(new Option('Director local', ''));
    if (showToast) toast(`Sin conexión con Ollama: ${result.error}`, 'err');
  }
}

function fillModels(models) {
  els.model.replaceChildren();
  if (!models.length) {
    els.model.append(new Option('Sin modelos', ''));
    els.model.disabled = true;
    return;
  }
  for (const name of models) els.model.append(new Option(name, name));
  const known = models.some((m) => m === state.settings.model || m.startsWith(`${state.settings.model}:`));
  if (!known) {
    state.settings.model = models[0];
    api.setSettings({ model: models[0] });
  }
  els.model.value = models.find((m) => m === state.settings.model || m.startsWith(`${state.settings.model}:`)) || models[0];
  els.model.disabled = false;
}

/* ---------------- Ajustes ---------------- */

function openSettings() {
  if (!state.settings) return;
  $('setting-url').value = state.settings.studioUrl;
  $('setting-host').value = state.settings.host;
  $('setting-model').value = state.settings.model;
  $('setting-temp').value = String(state.settings.temperature);
  $('temp-value').textContent = Number(state.settings.temperature).toFixed(1);
  els.dialog.showModal();
}

async function saveSettings() {
  const studioUrl = normalizeUrl($('setting-url').value) || 'http://127.0.0.1:5173/';
  const host = normalizeUrl($('setting-host').value) || 'http://127.0.0.1:11434';
  const model = $('setting-model').value.trim() || 'llama3.2';
  const temperature = Number($('setting-temp').value);

  state.settings = await api.setSettings({ studioUrl, host, model, temperature });
  els.url.value = state.settings.studioUrl;
  els.dialog.close();

  loadStudio(state.settings.studioUrl);
  refreshStatus(true);
  toast('Ajustes guardados', 'ok');
}

/* ---------------- Webview ---------------- */

let loadedUrl = '';

function loadStudio(url) {
  const target = normalizeUrl(url);
  if (!target) return;
  loadedUrl = target;
  els.url.value = target;
  state.studioReady = false;
  setDot('loading');
  setLoading(true, 'Conectando con el estudio…', `Cargando ${hostOf(target)}…`);
  try {
    els.studio.setAttribute('src', target);
  } catch {
    els.studio.src = target;
  }
}

function reloadStudio() {
  try {
    els.studio.reload();
  } catch {
    loadStudio(loadedUrl || state.settings.studioUrl);
  }
}

function initWebview() {
  els.studio.addEventListener('dom-ready', () => onStudioLoaded());
  els.studio.addEventListener('did-fail-load', (event) => {
    if (event.errorCode === -3) return; // carga cancelada
    state.studioReady = false;
    setDot('off');
    setLoading(true, 'No se pudo cargar el estudio', `${event.errorDescription || 'Error'} · ${hostOf(loadedUrl)}`);
  });
  els.studio.addEventListener('did-navigate', () => {
    state.studioReady = false;
    onStudioLoaded();
  });
  els.studio.addEventListener('did-navigate-in-page', () => {
    /* la app web cambia de ruta con hash; el bridge sigue activo */
  });
}

/* ---------------- Arranque ---------------- */

async function init() {
  state.settings = await api.getSettings();
  els.url.value = state.settings.studioUrl;
  $('setting-temp').addEventListener('input', (event) => {
    $('temp-value').textContent = Number(event.target.value).toFixed(1);
  });

  const info = await api.appInfo();
  els.appInfo.textContent = `Electron ${info.versions.electron} · Chrome ${info.versions.chrome}`;
  els.settingsPath.textContent = info.settingsPath;

  initWebview();
  await delay(150);
  loadStudio(state.settings.studioUrl);
  refreshStatus();
  setInterval(() => refreshStatus(), 20000);

  els.unsubToken = api.onToken(({ requestId, token }) => {
    if (requestId !== state.requestId) return;
    const message = state.messages.find((m) => m.id === state.streamingId);
    if (!message) return;
    message.content += token;
    scheduleRender();
  });

  els.send.addEventListener('click', sendMessage);
  els.stop.addEventListener('click', stopStreaming);
  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  els.input.addEventListener('input', () => {
    els.input.style.height = 'auto';
    els.input.style.height = `${Math.min(150, els.input.scrollHeight)}px`;
  });

  $('suggestions').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    els.input.value = chip.dataset.prompt || chip.textContent;
    sendMessage();
  });

  $('clear-chat').addEventListener('click', () => {
    if (state.busy) stopStreaming();
    state.messages = [];
    renderMessages();
  });

  $('open-settings').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', () => els.dialog.close());
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveSettings();
  });
  els.dialog.addEventListener('click', (event) => {
    if (event.target === els.dialog) els.dialog.close();
  });

  $('test-connection').addEventListener('click', async () => {
    const host = normalizeUrl($('setting-host').value);
    const result = await api.ollamaTags(host);
    if (result.ok) {
      toast(`Conexión correcta · ${result.models.length} modelos · ${result.latency} ms`, 'ok');
    } else {
      toast(`No se pudo conectar: ${result.error}`, 'err');
    }
  });

  els.url.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.target.blur();
    const url = normalizeUrl(event.target.value);
    if (!url) return;
    api.setSettings({ studioUrl: url });
    state.settings.studioUrl = url;
    loadStudio(url);
  });

  els.url.addEventListener('blur', () => {
    const url = normalizeUrl(els.url.value);
    if (url && url !== loadedUrl) {
      api.setSettings({ studioUrl: url });
      state.settings.studioUrl = url;
      loadStudio(url);
    }
  });

  $('reload-studio').addEventListener('click', reloadStudio);
  $('external-studio').addEventListener('click', () => {
    api.openExternal(loadedUrl || state.settings.studioUrl);
  });

  $('model-select').addEventListener('change', (event) => {
    state.settings.model = event.target.value;
    api.setSettings({ model: event.target.value });
    toast(`Modelo: ${event.target.value}`, 'ok');
  });

  renderMessages();
}

init().catch((error) => {
  toast(`Error al iniciar: ${error instanceof Error ? error.message : String(error)}`, 'err');
  console.error(error);
});
