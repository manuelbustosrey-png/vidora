import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AspectId, DesktopCommand, Project } from '@/types';
import { createProject, storyboardToProject } from '@/lib/project';
import { fallbackStoryboard } from '@/lib/ai';
import { deleteProject, getProject, listProjects, saveProject } from '@/lib/storage';
import { installDesktopBridge } from '@/lib/desktop';
import { toast, type ToastDetail, type ToastKind } from '@/lib/toast';
import { uid } from '@/lib/utils';
import Landing from '@/components/Landing';
import Dashboard from '@/components/Dashboard';
import Studio from '@/components/Studio';
import SettingsModal from '@/components/SettingsModal';
import { Logo } from '@/components/ui';

type Route = { name: 'home' } | { name: 'projects' } | { name: 'studio'; id: string };

function parseHash(): Route {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'projects') return { name: 'projects' };
  if (parts[0] === 'studio' && parts[1]) return { name: 'studio', id: parts[1] };
  return { name: 'home' };
}

export function navigate(path: string): void {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (location.hash === target) return;
  location.hash = target;
}

function Toaster() {
  const [items, setItems] = useState<Array<ToastDetail & { id: string; kind: ToastKind }>>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const item = { ...detail, id: uid('toast'), kind: detail.kind || 'info' } as ToastDetail & { id: string; kind: ToastKind };
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, detail.duration || 4200);
    };
    window.addEventListener('vidora:toast', handler);
    return () => window.removeEventListener('vidora:toast', handler);
  }, []);

  return (
    <div className="toaster">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span className="toast-dot" />
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Cerrar">×</button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [projects, setProjects] = useState<Project[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const routeRef = useRef(route);
  routeRef.current = route;

  const refresh = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    refresh();
    const uninstall = installDesktopBridge();
    if (!location.hash) navigate('/');
    return () => {
      window.removeEventListener('hashchange', onHash);
      uninstall();
    };
  }, [refresh]);

  const openProject = useCallback(async (id: string) => {
    const p = await getProject(id);
    if (!p) {
      toast('No encuentro ese proyecto. Puede que se haya borrado.', 'error');
      navigate('/projects');
      return;
    }
    navigate(`/studio/${id}`);
  }, []);

  const createAndOpen = useCallback(
    async (opts: Parameters<typeof createProject>[0], pending?: { prompt: string; minutes: number; aspect: AspectId }) => {
      const project = createProject(opts);
      await saveProject(project);
      await refresh();
      if (pending) sessionStorage.setItem('vidora:pending', JSON.stringify(pending));
      navigate(`/studio/${project.id}`);
      return project;
    },
    [refresh]
  );

  const startGeneration = useCallback(
    async (prompt: string, minutes: number, aspect: AspectId) => {
      const name = prompt.trim().slice(0, 52) || 'Video con IA';
      sessionStorage.setItem('vidora:pending', JSON.stringify({ prompt, minutes, aspect }));
      await createAndOpen({ name, prompt, minutes, aspect, aiGenerated: true }, { prompt, minutes, aspect });
      toast('Generando tu video con el director IA…', 'info');
    },
    [createAndOpen]
  );

  const handleDemo = useCallback(async () => {
    const prompt = 'Un viaje cinematográfico entre auroras boreales, ciudades de neón y océanos de luz';
    const sb = fallbackStoryboard(prompt, 1, 8);
    const p = storyboardToProject(sb, { minutes: 1, aspect: '16:9', prompt, name: 'Demo · Luces del norte' });
    await saveProject(p);
    await refresh();
    navigate(`/studio/${p.id}`);
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      const p = projects.find((x) => x.id === id);
      if (!p) return;
      if (!confirm(`¿Borrar «${p.name}»? Esta acción no se puede deshacer.`)) return;
      await deleteProject(id);
      await refresh();
      toast('Proyecto eliminado', 'success');
      if (routeRef.current.name === 'studio' && routeRef.current.id === id) navigate('/projects');
    },
    [projects, refresh]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const p = await getProject(id);
      if (!p) return;
      const copy: Project = structuredClone(p);
      copy.id = uid('prj');
      copy.name = `${p.name} · copia`;
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      await saveProject(copy);
      await refresh();
      toast('Proyecto duplicado', 'success');
    },
    [refresh]
  );

  const handleCommand = useCallback(
    (cmd: DesktopCommand) => {
      if (cmd.action === 'new_project') {
        createAndOpen({ name: 'Nuevo proyecto' });
      } else if (cmd.action === 'generate') {
        const prompt = String(cmd.payload?.prompt || 'Una historia cinematográfica');
        const minutes = Number(cmd.payload?.minutes) || 1;
        const aspect = (cmd.payload?.aspect as AspectId) || '16:9';
        startGeneration(prompt, minutes, aspect);
      }
    },
    [createAndOpen, startGeneration]
  );

  useEffect(() => {
    const handler = (e: Event) => handleCommand((e as CustomEvent<DesktopCommand>).detail);
    window.addEventListener('vidora:command', handler);
    return () => window.removeEventListener('vidora:command', handler);
  }, [handleCommand]);

  const current = useMemo(() => {
    if (route.name !== 'studio') return null;
    return route.id;
  }, [route]);

  return (
    <>
      {route.name === 'home' && (
        <Landing
          projects={projects}
          onGenerate={startGeneration}
          onOpenProjects={() => navigate('/projects')}
          onOpenProject={openProject}
          onSettings={() => setSettingsOpen(true)}
          onDemo={handleDemo}
        />
      )}

      {route.name === 'projects' && (
        <Dashboard
          projects={projects}
          loading={loading}
          onOpen={openProject}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onGenerate={startGeneration}
          onNew={() => createAndOpen({ name: 'Nuevo proyecto' })}
          onHome={() => navigate('/')}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {route.name === 'studio' && current && (
        <Studio
          key={current}
          projectId={current}
          onBack={() => navigate('/projects')}
          onHome={() => navigate('/')}
          onSettings={() => setSettingsOpen(true)}
          onProjectsChanged={refresh}
        />
      )}

      {route.name === 'studio' && !current && (
        <div className="center-screen">
          <Logo size={34} />
          <p>Proyecto no encontrado.</p>
          <button className="btn btn-primary" onClick={() => navigate('/projects')}>Volver a proyectos</button>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster />
    </>
  );
}
