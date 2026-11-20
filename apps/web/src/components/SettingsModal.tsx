import { useEffect, useState } from 'react';
import { Check, Cloud, Download, HardDrive, Link2, MonitorDown, RefreshCw, Sparkles, Terminal, Trash2 } from 'lucide-react';
import { Modal, Field, Spinner, Badge, Slider } from './ui';
import { useSettings } from '@/store/settings';
import { listModels, type OllamaModel } from '@/lib/ollama';
import { countStorage } from '@/lib/storage';
import { toast } from '@/lib/toast';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const [endpoint, setEndpoint] = useState(settings.ai.endpoint);
  const [model, setModel] = useState(settings.ai.model);
  const [temperature, setTemperature] = useState(settings.ai.temperature);
  const [timeout, setTimeoutMs] = useState(settings.ai.timeout);
  const [repo, setRepo] = useState(settings.repoUrl);
  const [appUrl, setAppUrl] = useState(settings.appUrl);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [storage, setStorage] = useState<{ projects: number; assets: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setEndpoint(settings.ai.endpoint);
    setModel(settings.ai.model);
    setTemperature(settings.ai.temperature);
    setTimeoutMs(settings.ai.timeout);
    setRepo(settings.repoUrl);
    setAppUrl(settings.appUrl);
    setStatus(null);
    countStorage().then(setStorage).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const test = async () => {
    setTesting(true);
    setStatus(null);
    const res = await listModels({ ...settings.ai, endpoint, model }, 6000);
    setTesting(false);
    if (res.ok) {
      setModels(res.models);
      const found = res.models.find((m) => m.name === model || m.name.startsWith(`${model}:`));
      setStatus({
        ok: true,
        message: res.models.length
          ? `Conectado · ${res.models.length} modelo(s) disponibles${found ? '' : ' · el modelo elegido no está instalado'}`
          : 'Conectado, pero no hay modelos instalados todavía.',
      });
      if (!found && res.models[0]) setModel(res.models[0].name);
    } else {
      setStatus({ ok: false, message: `Sin conexión con Ollama: ${res.error}` });
    }
  };

  const save = () => {
    settings.setAi({ endpoint: endpoint.trim(), model: model.trim(), temperature, timeout: Math.max(10000, timeout) });
    settings.setSettings({ repoUrl: repo.trim(), appUrl: appUrl.trim() });
    toast('Ajustes guardados', 'success');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajustes" subtitle="IA local, conexión con GitHub y preferencias del estudio." wide>
      <section className="settings-section">
        <div className="settings-head">
          <div className="settings-title"><Sparkles size={18} /> Inteligencia artificial local <Badge tone="green">Ollama</Badge></div>
          <button className="btn btn-ghost btn-sm" onClick={test} disabled={testing}>
            {testing ? <Spinner /> : <RefreshCw size={14} />} Probar conexión
          </button>
        </div>
        {status && <div className={`inline-status ${status.ok ? 'ok' : 'bad'}`}>{status.message}</div>}
        <div className="grid-2">
          <Field label="Endpoint de Ollama" hint="dev: /ollama · prod: http://localhost:11434">
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="http://localhost:11434" spellCheck={false} />
          </Field>
          <Field label="Modelo">
            <div className="input-row">
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama3.2" spellCheck={false} />
              <a className="icon-btn" title="Instalar modelo" href="https://ollama.com/library" target="_blank" rel="noreferrer"><Download size={16} /></a>
            </div>
          </Field>
        </div>
        {models.length > 0 && (
          <div className="model-list">
            {models.map((m) => (
              <button key={m.name} className={`model-chip ${m.name === model ? 'active' : ''}`} onClick={() => setModel(m.name)}>
                {m.name === model && <Check size={12} />} {m.name}
                {m.details?.parameter_size && <em>{m.details.parameter_size}</em>}
              </button>
            ))}
          </div>
        )}
        <div className="grid-2">
          <Field label={`Creatividad · ${temperature.toFixed(2)}`}>
            <Slider value={temperature} min={0} max={1.2} step={0.05} onChange={setTemperature} />
          </Field>
          <Field label="Tiempo máximo de respuesta (s)">
            <input type="number" min={10} max={600} value={Math.round(timeout / 1000)} onChange={(e) => setTimeoutMs(Number(e.target.value) * 1000)} />
          </Field>
        </div>
        <div className="callout">
          <Terminal size={16} />
          <div>
            <strong>Si la web no conecta con Ollama</strong>
            <p>Permite el origen y reinicia Ollama:</p>
            <code>setx OLLAMA_ORIGINS "*"</code>
            <p className="muted">Luego ejecuta <code>ollama serve</code> y descarga un modelo: <code>ollama pull llama3.2</code>. En desarrollo, la URL <code>/ollama</code> ya usa un proxy sin CORS.</p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-head">
          <div className="settings-title"><Link2 size={18} /> Conexión con GitHub / escritorio</div>
        </div>
        <div className="grid-2">
          <Field label="URL del repositorio" hint="Para el botón ‘Ver en GitHub’ del escritorio">
            <div className="input-row">
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/usuario/vidora" />
              <Cloud size={16} className="input-icon" />
            </div>
          </Field>
          <Field label="URL pública de la web" hint="GitHub Pages o tu dominio">
            <div className="input-row">
              <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://usuario.github.io/vidora/" />
              <MonitorDown size={16} className="input-icon" />
            </div>
          </Field>
        </div>
        <p className="muted small">El copiloto de escritorio abre esta URL en su panel «Estudio» y le envía órdenes en tiempo real.</p>
      </section>

      <section className="settings-section">
        <div className="settings-head">
          <div className="settings-title"><HardDrive size={18} /> Almacenamiento local</div>
        </div>
        <div className="storage-row">
          <div><strong>{storage?.projects ?? '—'}</strong><span>Proyectos</span></div>
          <div><strong>{storage?.assets ?? '—'}</strong><span>Medios importados</span></div>
          <div><strong>IndexedDB</strong><span>Tus datos no salen del navegador</span></div>
        </div>
        <div className="danger-row">
          <div>
            <strong>Restablecer preferencias</strong>
            <p className="muted small">No borra proyectos ni medios.</p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (confirm('¿Restablecer todos los ajustes?')) {
                settings.reset();
                toast('Ajustes restablecidos', 'success');
                onClose();
              }
            }}
          >
            <Trash2 size={14} /> Restablecer
          </button>
        </div>
      </section>

      <footer className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save}>Guardar ajustes</button>
      </footer>
    </Modal>
  );
}
