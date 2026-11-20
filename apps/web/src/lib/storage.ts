import type { AssetMeta, Project } from '@/types';

const DB_NAME = 'vidora-db';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | void> {
  return openDB().then(
    (db) =>
      new Promise<T | void>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const req = run(s);
        let result: T | undefined;
        if (req) req.onsuccess = () => { result = req.result; };
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export async function listProjects(): Promise<Project[]> {
  const all = (await tx<Project[]>('projects', 'readonly', (s) => s.getAll())) || [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await tx<Project>('projects', 'readonly', (s) => s.get(id))) || undefined;
}

export async function saveProject(project: Project): Promise<void> {
  const clean = { ...project, updatedAt: Date.now() };
  await tx('projects', 'readwrite', (s) => s.put(clean));
}

export async function deleteProject(id: string): Promise<void> {
  const project = await getProject(id);
  await tx('projects', 'readwrite', (s) => s.delete(id));
  if (project) {
    for (const clip of project.clips) {
      if ('assetId' in clip && clip.assetId) {
        const meta = await getAsset(clip.assetId);
        if (meta) await deleteAsset(clip.assetId);
      }
    }
  }
}

export async function saveAsset(meta: AssetMeta, blob: Blob): Promise<void> {
  await tx('assets', 'readwrite', (s) => s.put(meta));
  await tx('blobs', 'readwrite', (s) => s.put(blob, meta.id));
}

export async function getAsset(id: string): Promise<AssetMeta | undefined> {
  return (await tx<AssetMeta>('assets', 'readonly', (s) => s.get(id))) || undefined;
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
  return (await tx<Blob>('blobs', 'readonly', (s) => s.get(id))) || undefined;
}

export async function deleteAsset(id: string): Promise<void> {
  await tx('assets', 'readwrite', (s) => s.delete(id));
  await tx('blobs', 'readwrite', (s) => s.delete(id));
}

export async function listAssets(projectId?: string): Promise<AssetMeta[]> {
  const all = (await tx<AssetMeta[]>('assets', 'readonly', (s) => s.getAll())) || [];
  return projectId ? all.filter((a) => !a.projectId || a.projectId === projectId) : all;
}

export async function countStorage(): Promise<{ projects: number; assets: number }> {
  const projects = (await listProjects()).length;
  const assets = (await listAssets()).length;
  return { projects, assets };
}
