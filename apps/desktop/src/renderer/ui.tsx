import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { USER_VISIBLE_APP_INFO } from '@ppt/domain/renderer';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{actions && <div className="header-actions">{actions}</div>}</div>;
}

export function Button({ children, tone = 'default', type, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'primary' | 'danger' }) {
  return <button type={type ?? 'button'} className={`button ${tone}`} {...props}>{children}</button>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state" role="status"><span aria-hidden="true">◇</span><strong>{title}</strong><p>{body}</p></div>;
}

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!; const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}><div className="modal-header"><div><span className="eyebrow">{USER_VISIBLE_APP_INFO.releaseLabel}</span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{subtitle}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label={`${title} penceresini kapat`}>×</button></div>{children}</section></div>;
}

export function Surface({ children, className = '', as = 'article' }: { children: ReactNode; className?: string; as?: 'article' | 'section' | 'aside' }) {
  const Element = as;
  return <Element className={`panel surface ${className}`.trim()}>{children}</Element>;
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action && <div className="header-actions">{action}</div>}</div>;
}

export function StatRow({ value, label, action }: { value: ReactNode; label: ReactNode; action?: ReactNode }) {
  return <div className="context-stat stat-row"><div><strong>{value}</strong><span>{label}</span></div>{action && <div className="stat-row-action">{action}</div>}</div>;
}

export function StatusMessage({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  const urgent = tone === 'danger';
  return <div className={`status-message ${tone}`} role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} aria-atomic="true">{children}</div>;
}

export function VisuallyHidden({ children, as = 'span' }: { children: ReactNode; as?: 'span' | 'div' }) {
  const Element = as;
  return <Element className="visually-hidden">{children}</Element>;
}
