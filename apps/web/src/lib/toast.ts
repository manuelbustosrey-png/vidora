export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export interface ToastDetail {
  message: string;
  kind?: ToastKind;
  duration?: number;
}

export function toast(message: string, kind: ToastKind = 'info', duration = 4200): void {
  window.dispatchEvent(new CustomEvent<ToastDetail>('vidora:toast', { detail: { message, kind, duration } }));
}
