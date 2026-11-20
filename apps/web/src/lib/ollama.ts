import type { AiSettings } from '@/types';

export interface OllamaModel {
  name: string;
  size?: number;
  details?: { family?: string; parameter_size?: string; quantization_level?: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function base(endpoint: string): string {
  return (endpoint || 'http://localhost:11434').replace(/\/+$/, '');
}

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

export async function listModels(settings: AiSettings, timeout = 5000): Promise<{ ok: boolean; models: OllamaModel[]; error?: string }> {
  const { signal, clear } = timeoutSignal(timeout);
  try {
    const res = await fetch(`${base(settings.endpoint)}/api/tags`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models: OllamaModel[] = (data.models || []).map((m: OllamaModel) => ({
      name: m.name,
      size: m.size,
      details: m.details,
    }));
    return { ok: true, models };
  } catch (e) {
    return { ok: false, models: [], error: (e as Error).message };
  } finally {
    clear();
  }
}

export interface ChatOptions {
  settings: AiSettings;
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export async function chat({ settings, messages, json = false, temperature, signal, onToken }: ChatOptions): Promise<string> {
  const url = `${base(settings.endpoint)}/api/chat`;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), settings.timeout || 120000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: Boolean(onToken),
        format: json ? 'json' : undefined,
        options: {
          temperature: temperature ?? settings.temperature ?? 0.8,
          num_ctx: 4096,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama respondió ${res.status}. ${text.slice(0, 200)}`);
    }

    if (!onToken) {
      const data = await res.json();
      return String(data?.message?.content || '');
    }

    if (!res.body) throw new Error('Sin stream de respuesta');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          const token = obj?.message?.content || '';
          if (token) {
            full += token;
            onToken(token);
          }
        } catch { /* partial */ }
      }
    }
    if (buffer.trim()) {
      try {
        const obj = JSON.parse(buffer.trim());
        const token = obj?.message?.content || '';
        if (token) { full += token; onToken(token); }
      } catch { /* noop */ }
    }
    return full;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('La IA tardó demasiado o se canceló la operación.');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function pullModel(settings: AiSettings, onStatus: (s: string) => void): Promise<void> {
  const res = await fetch(`${base(settings.endpoint)}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: settings.model, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar ${settings.model}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.status) onStatus(obj.status + (obj.percent ? ` ${Math.round(obj.percent)}%` : ''));
      } catch { /* noop */ }
    }
  }
}
