import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { clamp } from '@/lib/utils';

export function Logo({ size = 24, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff6a3d" />
            <stop offset=".55" stopColor="#ff3d77" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#0b0b11" stroke="rgba(255,255,255,.08)" />
        <path d="M17 18c0-2.2 1.8-4 4-4h4v36h-4a4 4 0 0 1-4-4V18Zm12-4h7.5c6 0 10.5 3.8 10.5 9.2 0 3-1.4 5.4-3.9 7 3.4 1.5 5.4 4.3 5.4 7.9 0 5.9-4.6 10-11 10H29V14Z" fill="url(#vg)" />
      </svg>
      {wordmark && <span className="logo-word">vidora</span>}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className = '',
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}{hint && <em>{hint}</em>}</span>
      {children}
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onStart,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onStart?: () => void;
  suffix?: string;
}) {
  return (
    <div className="slider-row">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}{suffix || ''}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="toggle-knob" />
      {label && <span className="toggle-label">{label}</span>}
    </button>
  );
}

const DURATION_PRESETS = [1, 2, 3, 5, 10, 15, 30, 60];

export function DurationPicker({
  minutes,
  onChange,
  compact = false,
}: {
  minutes: number;
  onChange: (m: number) => void;
  compact?: boolean;
}) {
  const customRef = useRef<HTMLInputElement>(null);
  const isPreset = DURATION_PRESETS.includes(minutes);
  return (
    <div className={`duration-picker ${compact ? 'compact' : ''}`}>
      <div className="duration-presets">
        {DURATION_PRESETS.map((m) => (
          <button
            type="button"
            key={m}
            className={`chip ${minutes === m ? 'active' : ''}`}
            onClick={() => onChange(m)}
          >
            {m}′
          </button>
        ))}
        <button
          type="button"
          className={`chip ${!isPreset ? 'active' : ''}`}
          onClick={() => {
            customRef.current?.focus();
            customRef.current?.select();
          }}
        >
          Otro
        </button>
      </div>
      {!compact && (
        <div className="duration-custom">
          <input
            ref={customRef}
            type="number"
            min={0.2}
            max={600}
            step={0.5}
            value={minutes}
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0.2, 0.2, 600))}
          />
          <span>minutos · sin límite práctico</span>
        </div>
      )}
      {compact && (
        <div className="duration-custom compact-input">
          <input
            type="number"
            min={0.2}
            max={600}
            step={0.5}
            value={minutes}
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0.2, 0.2, 600))}
          />
          <span>min</span>
        </div>
      )}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Cargando" />;
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'amber' | 'red' | 'violet' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
