const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_SETTINGS = {
  studioUrl: 'https://manuelbustosrey-png.github.io/vidora/',
  host: 'http://127.0.0.1:11434',
  model: 'llama3.2',
  temperature: 0.7
};

const controllers = new Map();
let settingsPath = null;
let mainWindow = null;

function settingsFile() {
  if (!settingsPath) settingsPath = path.join(app.getPath('userData'), 'settings.json');
  return settingsPath;
}

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsFile(), 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(patch) {
  const merged = { ...readSettings(), ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2), 'utf8');
  } catch (error) {
    console.error('No se pudo guardar la configuración:', error);
  }
  return merged;
}

function normalizeHost(host) {
  const value = String(host || DEFAULT_SETTINGS.host).trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

function createWindow() {
  const smoke = process.argv.includes('--smoke');
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    backgroundColor: '#07070b',
    title: 'Vidora Copilot',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  if (smoke) {
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      try {
        const info = await mainWindow.webContents.executeJavaScript(
          `({ title: document.title, webview: Boolean(document.getElementById('studio')), url: document.getElementById('studio')?.getURL?.() || '', settings: Boolean(window.vidora), dot: document.getElementById('webview-dot')?.className, loading: document.getElementById('stage-loading')?.className, pill: document.getElementById('ollama-pill')?.textContent })`
        );
        console.log('SMOKE_OK', JSON.stringify(info));

        if (process.argv.includes('--smoke-bridge') || process.argv.includes('--smoke-chat')) {
          const guest = require('electron').webContents.getAllWebContents().find((wc) => wc.getType() === 'webview');
          if (!guest) throw new Error('webview guest no encontrado');
          await guest.executeJavaScript(
            `window.postMessage({ source: 'vidora-desktop', type: 'command', command: { action: 'new_project' } }, '*'); true`
          );
          await new Promise((resolve) => setTimeout(resolve, 2500));
          const created = await guest.executeJavaScript(
            `({ hash: location.hash, state: window.__vidoraGetState ? window.__vidoraGetState() : null })`
          );
          console.log('SMOKE_PROJECT', JSON.stringify(created));
          await guest.executeJavaScript(
            `window.postMessage({ source: 'vidora-desktop', type: 'command', command: { action: 'set_duration', minutes: 5 } }, '*'); true`
          );
          await new Promise((resolve) => setTimeout(resolve, 700));
          const changed = await guest.executeJavaScript(
            `window.__vidoraGetState ? window.__vidoraGetState() : null`
          );
          console.log('SMOKE_COMMAND', JSON.stringify(changed));

          if (process.argv.includes('--smoke-chat')) {
            await mainWindow.webContents.executeJavaScript(
              `(() => { const ta = document.getElementById('prompt-input'); ta.value = 'Pon la duración en 3 minutos y añade una escena de océano de 5 segundos'; document.getElementById('send').click(); return true; })()`
            );
            await new Promise((resolve) => setTimeout(resolve, 2600));
            const chat = await mainWindow.webContents.executeJavaScript(
              `({ messages: Array.from(document.querySelectorAll('.msg')).map((m) => m.innerText.slice(0, 240)), chips: Array.from(document.querySelectorAll('.action-chip')).map((c) => c.textContent) })`
            );
            const chatState = await guest.executeJavaScript('window.__vidoraGetState ? window.__vidoraGetState() : null');
            console.log('SMOKE_CHAT', JSON.stringify({ chat, duration: chatState?.project?.duration, scenes: chatState?.project?.scenes }));
          }
        }
      } catch (error) {
        console.log('SMOKE_FAIL', error instanceof Error ? error.message : String(error));
      }
      setTimeout(() => app.quit(), 800);
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('settings:get', () => ({ ...readSettings(), settingsPath: settingsFile() }));

ipcMain.handle('settings:set', (_event, patch) => {
  const safe = {};
  if (patch && typeof patch === 'object') {
    if (typeof patch.studioUrl === 'string') safe.studioUrl = patch.studioUrl;
    if (typeof patch.host === 'string') safe.host = patch.host;
    if (typeof patch.model === 'string') safe.model = patch.model;
    if (typeof patch.temperature === 'number') safe.temperature = Math.min(2, Math.max(0, patch.temperature));
  }
  return writeSettings(safe);
});

ipcMain.handle('app:info', () => ({
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  settingsPath: settingsFile()
}));

ipcMain.handle('app:openExternal', async (_event, url) => {
  if (typeof url === 'string' && /^https?:/i.test(url)) await shell.openExternal(url);
  return true;
});

ipcMain.handle('ollama:tags', async (_event, host) => {
  const base = normalizeHost(host);
  const started = Date.now();
  try {
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models.map((m) => m.name).filter(Boolean) : [];
    return { ok: true, models, latency: Date.now() - started, host: base };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), host: base };
  }
});

ipcMain.handle('ollama:chat', async (event, payload) => {
  const requestId = String(payload?.requestId || `req_${Date.now()}`);
  const host = normalizeHost(payload?.host);
  const model = String(payload?.model || DEFAULT_SETTINGS.model);
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const temperature = Number.isFinite(payload?.temperature) ? payload.temperature : DEFAULT_SETTINGS.temperature;
  const controller = new AbortController();
  controllers.set(requestId, controller);

  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true, options: { temperature } }),
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Ollama respondió ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) {
          try {
            const parsed = JSON.parse(line);
            const token = parsed?.message?.content || parsed?.response || '';
            if (token) {
              full += token;
              if (!event.sender.isDestroyed()) event.sender.send('ollama:token', { requestId, token });
            }
          } catch {
            /* línea parcial o keep-alive */
          }
        }
        index = buffer.indexOf('\n');
      }
    }

    return { ok: true, content: full, model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, aborted: controller.signal.aborted };
  } finally {
    controllers.delete(requestId);
  }
});

ipcMain.on('ollama:abort', (_event, requestId) => {
  const controller = controllers.get(String(requestId));
  if (controller) controller.abort();
});
