import type { DesktopCommand } from '@/types';
import { toast } from './toast';

type StateProvider = () => Record<string, unknown>;

let provider: StateProvider | null = null;

export function registerStateProvider(fn: StateProvider | null): void {
  provider = fn;
}

export function installDesktopBridge(): () => void {
  const onMessage = (event: MessageEvent) => {
    const data = event.data;
    if (!data || data.source !== 'vidora-desktop') return;
    if (data.type === 'command' && data.command?.action) {
      const raw = data.command as DesktopCommand & Record<string, unknown>;
      const payload =
        raw.payload && typeof raw.payload === 'object'
          ? raw.payload
          : Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'action' && key !== 'payload'));
      const cmd: DesktopCommand = { action: raw.action, payload };
      window.dispatchEvent(new CustomEvent<DesktopCommand>('vidora:command', { detail: cmd }));
    }
  };
  window.addEventListener('message', onMessage);

  (window as unknown as { __vidoraGetState?: StateProvider }).__vidoraGetState = () => {
    try {
      return provider ? provider() : { ready: false };
    } catch {
      return { ready: false };
    }
  };
  (window as unknown as { __vidoraToast?: (m: string, k?: string) => void }).__vidoraToast = (m, k) =>
    toast(m, (k as 'info') || 'info');

  return () => window.removeEventListener('message', onMessage);
}

export function isEmbeddedDesktop(): boolean {
  return /Electron/i.test(navigator.userAgent);
}
