# Vidora

**Estudio de creación de video con IA local y copiloto de escritorio.**

Vidora convierte una idea en un video cinematográfico usando un modelo local de Ollama (o un director local de respaldo cuando Ollama no está disponible). Incluye timeline multipista, edición completa, audio generativo y exportación de alta calidad sin subir nada a la nube.

- **Web:** Vite + React 19 + TypeScript.
- **IA local:** Ollama (`/api/chat`) con fallback offline determinista.
- **Escritorio:** Electron con el estudio embebido y un copiloto conectado por comandos.
- **Persistencia:** IndexedDB (proyectos y medios) + autoguardado.
- **Exportación:** `canvas.captureStream` + `MediaRecorder` (MP4 si el navegador lo soporta; si no, WebM).

---

## Requisitos

| Herramienta | Versión |
| --- | --- |
| Node.js | 20 o superior |
| npm | 10 o superior |
| Navegador | Chrome, Edge o Brave actualizado (para grabar canvas) |
| Ollama | Opcional, recomendado para IA real |

## Instalación

```bash
git clone <tu-repo> vidora
cd vidora
npm run install:all
```

`install:all` instala las dependencias de `apps/web` y `apps/desktop`.

## Uso rápido

### 1. Estudio web

```bash
npm run dev
```

Abre `http://127.0.0.1:5173/`.

Desde la landing puedes escribir una idea, elegir duración (1, 2, 3, 5, 10… minutos o un valor propio) y formato. También puedes abrir un proyecto vacío o la demo incluida.

En el estudio:

- **IA:** genera un storyboard con el director local o con Ollama; chat copiloto con acciones reales (duración, escenas, texto, paisajes, géneros, reproducir/pausar/exportar, generar); subtítulos automáticos, voz y SEO.
- **Medios:** importa imágenes, videos y audio; se guardan en IndexedDB.
- **Escenas:** añade plantillas procedurales (aurora, nebula, grid, partículas, olas, spotlight, skyline, editorial).
- **Paisajes y música:** el prompt se lee para detectar un paisaje concreto (playa, desierto, montaña, bosque, ciudad, espacio, pampa, retrato, boda…) y un género musical (rock, jazz, piano, latino, electrónica, épico, ambient, lo-fi…); el storyboard usa paletas y plantillas del paisaje y la música suma ritmos y arpegios.
- **Timeline:** pistas de video, overlay, texto y audio; arrastrar, recortar, dividir (S), duplicar (Ctrl+D), eliminar (Supr) y zoom.
- **Inspector:** formato, FPS, duración, resolución, fondo, grano, viñeta y música.
- **Exportar:** 720p, 1080p, 1440p o 4K; 24/30/60 fps; calidad estándar, alta o ultra; MP4/WebM automático.

### 2. Copiloto de escritorio

En otra terminal (no necesita el servidor local si usas el estudio publicado):

```bash
npm run desktop
```

La app de escritorio abre el estudio embebido y un chat lateral. Por defecto carga el estudio publicado en `https://manuelbustosrey-png.github.io/vidora/`; para trabajar contra el servidor local cambia **Ajustes → URL del estudio** a `http://127.0.0.1:5173/`. El copiloto puede cambiar la duración, añadir escenas, colocar texto, ajustar la música, reproducir, pausar, exportar, crear proyectos o lanzar una generación. Los comandos se envían al estudio mediante un puente `postMessage` aislado.

Sin Ollama, el copiloto usa el **director local** y sigue ejecutando acciones.

### 3. Producción

```bash
npm run build          # build del estudio web en apps/web/dist
npm run desktop:build  # instalador de escritorio en apps/desktop/release
```

---

## Configurar Ollama

1. Instala Ollama desde <https://ollama.com/download>.
2. Descarga un modelo:

   ```bash
   ollama pull llama3.2
   ```

3. Arranca el servidor:

   ```bash
   ollama serve
   ```

4. En Vidora abre **Ajustes → IA local**:
   - En desarrollo el endpoint por defecto es `/ollama` (proxy de Vite).
   - Para conectar directo usa `http://localhost:11434`.
   - Elige el modelo detectado y ajusta la temperatura.

### CORS para el estudio publicado

Cuando el estudio corre en GitHub Pages, el navegador llama a Ollama directamente. Habilita el origen:

**PowerShell**

```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

**Bash / macOS / Linux**

```bash
OLLAMA_ORIGINS=* ollama serve
```

También puedes usar los scripts incluidos:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ollama-setup.ps1
```

```bash
bash scripts/ollama-setup.sh
```

> Si Ollama no responde, Vidora lo indica en la interfaz y activa el director local. No se pierde ninguna función de edición.

---

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila `apps/web` y publica `dist` en Pages.

1. Crea un repositorio en GitHub y sube la rama `main`:

   ```bash
   git remote add origin https://github.com/<usuario>/<repo>.git
   git push -u origin main
   ```

2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` publica el estudio en:

   ```text
   https://<usuario>.github.io/<repo>/
   ```

   El workflow calcula `VITE_BASE=/<repo>/` automáticamente. El enrutado usa hash (`#/studio/...`), así que las rutas profundas funcionan sin configuración extra.

4. En el copiloto de escritorio, abre **Ajustes → URL del estudio** y pega tu URL de Pages.

Para un dominio propio o una ruta distinta, cambia `VITE_BASE` en el workflow.

---

## Estructura del proyecto

```text
vidora/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ components/   # Landing, Dashboard, Studio, Timeline, Inspector…
│  │  │  ├─ engine/       # renderer procedural, audio y exportación
│  │  │  ├─ lib/          # IA, Ollama, proyecto, IndexedDB, bridge de escritorio
│  │  │  ├─ store/        # Zustand + Immer (editor, ajustes)
│  │  │  └─ styles/       # sistema de diseño
│  │  └─ vite.config.ts
│  └─ desktop/
│     ├─ electron/        # main + preload (IPC seguro)
│     └─ renderer/        # copiloto, ajustes y webview del estudio
├─ scripts/               # arranque de Ollama
├─ .github/workflows/     # despliegue en GitHub Pages
└─ package.json           # scripts raíz
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo del estudio web |
| `npm run build` | Build de producción del estudio |
| `npm run preview` | Sirve el build localmente |
| `npm run desktop` | Abre el copiloto Electron |
| `npm run desktop:build` | Genera el instalador de escritorio |
| `npm run install:all` | Instala web y escritorio |

## Atajos del estudio

| Atajo | Acción |
| --- | --- |
| `Espacio` | Reproducir / pausar |
| `S` | Dividir clip en el playhead |
| `Ctrl+D` | Duplicar clip |
| `Supr` | Eliminar clip |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Deshacer / rehacer |
| `←` / `→` | Mover el playhead un frame |
| `Ctrl+Enter` (escritorio) | Enviar mensaje al copiloto |

---

## Notas y límites

- La generación visual es **procedural** (plantillas, paletas, movimiento y texto sobre canvas), no un modelo de difusión. Esto permite duración ilimitada y render local sin GPU dedicada.
- La exportación graba **en tiempo real**; un video de 2 minutos tarda aproximadamente 2 minutos. Mantén la pestaña o ventana visible durante la grabación.
- El formato MP4 depende de los códecs soportados por el navegador. Si no está disponible, Vidora exporta WebM de alta calidad.
- La voz usa las voces del sistema para la vista previa; la música generativa se mezcla en la exportación.
- Los proyectos y medios viven en el navegador (IndexedDB). Usa **Descargar proyecto (.json)** para respaldarlos.
- La duración máxima configurable es de 10 horas por proyecto; la exportación admite hasta 600 minutos por archivo.
- Los instaladores de escritorio no están firmados: Windows SmartScreen o macOS Gatekeeper pueden pedir confirmación.

## Solución de problemas

### El copiloto no conecta con el estudio

- Comprueba que `npm run dev` esté en marcha y que `http://127.0.0.1:5173/` abra en el navegador.
- En **Ajustes → URL del estudio**, usa la URL correcta (local o la de GitHub Pages).
- La primera carga tras arrancar Vite puede tardar unos segundos mientras optimiza dependencias.

### Electron no arranca o falta el binario

Algunas versiones de npm bloquean los scripts de instalación. Si `npm run desktop` falla porque no encuentra Electron:

```bash
cd apps/desktop
node node_modules/electron/install.js
npx electron --version
```

### Ollama no aparece

- Verifica `http://localhost:11434/api/tags` en el navegador.
- En desarrollo, Vidora usa el proxy `/ollama`; si cambiaste el endpoint a `http://localhost:11434`, asegúrate de que Ollama acepta peticiones del origen del estudio (`OLLAMA_ORIGINS=*`).
- Sin Ollama, el director local sigue funcionando: la app lo indica con el aviso «Ollama no detectado».

### La exportación va lenta o se corta

La grabación es en tiempo real. Mantén la pestaña visible, cierra pestañas que consuman CPU y elige una resolución menor si el equipo no sostiene 4K/60.

## Licencia

MIT © 2026 Vidora.
