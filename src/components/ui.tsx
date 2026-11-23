import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Inbox, X, XCircle } from 'lucide-react';
import type { Tone } from '@/lib/constants';
import { colorFor, cx, initials } from '@/lib/utils';
import type { ServicePackage } from '@/data/types';

export function Badge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={cx('badge', `tone-${tone}`, dot && 'badge-dot')}>{children}</span>;
}

export function Avatar({ name, size }: { name: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={cx('avatar', size && `avatar-${size}`)} style={{ background: colorFor(name) }} title={name}>
      {initials(name)}
    </span>
  );
}

export function PackagePill({ pkg, suffix }: { pkg?: ServicePackage; suffix?: string }) {
  if (!pkg) return null;
  return (
    <span className="pkg-pill" title={pkg.name}>
      <i style={{ background: pkg.color }} />
      {pkg.code}{suffix ? ` · ${suffix}` : ''}
    </span>
  );
}

export function PageHeader({ title, description, actions, crumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="breadcrumb">{crumbs}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'primary', meta }: { label: string; value: ReactNode; icon: ReactNode; tone?: Tone; meta?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        <span className={cx('stat__icon', `tone-${tone}`)}>{icon}</span>
      </div>
      <div className="stat__value">{value}</div>
      {meta && <div className="stat__meta">{meta}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon ?? <Inbox size={24} />}</div>
      <h4>{title}</h4>
      {text && <p style={{ margin: '0 0 14px' }}>{text}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', size && `modal-${size}`)} role="dialog" aria-modal="true">
        <div className="modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="subtle" style={{ marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Kapat"><X size={16} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Onay diyaloğu ----------------
interface ConfirmOpts { title: string; message: ReactNode; confirmText?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

// ---------------- Toast ----------------
type ToastKind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const [confirm, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), []);
  const close = (v: boolean) => { confirm?.resolve(v); setConfirm(null); };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={ask}>
        {children}
        <Modal open={!!confirm} onClose={() => close(false)} size="sm" title={
          <span className="row">{confirm?.danger && <AlertTriangle size={18} color="var(--danger)" />}{confirm?.title}</span>
        } footer={<>
          <button className="btn btn-secondary" onClick={() => close(false)}>Vazgeç</button>
          <button className={cx('btn', confirm?.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)} autoFocus>
            {confirm?.confirmText ?? 'Onayla'}
          </button>
        </>}>
          <div className="muted">{confirm?.message}</div>
        </Modal>
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={cx('toast', `toast--${t.kind}`)}>
              {t.kind === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
              {t.msg}
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

// ---------------- Form öğeleri ----------------
export function Field({ label, required, hint, error, children, className }: {
  label?: ReactNode; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cx('field', className)}>
      {label && <label className={cx(required && 'req')}>{label}</label>}
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button type="button" key={o.value} className={cx(value === o.value && 'active')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function ChipSelect<T extends string>({ value, onChange, options }: { value: T[]; onChange: (v: T[]) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="chip-select">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button type="button" key={o.value} className={cx('chip-option', on && 'selected')}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------- Sıralama & sayfalama ----------------
export type SortState<K extends string> = { key: K; dir: 'asc' | 'desc' };

export function useSort<T, K extends string>(rows: T[], initial: SortState<NoInfer<K>>, getters: Record<K, (r: T) => string | number>) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const g = getters[sort.key];
    const out = [...rows].sort((a, b) => {
      const x = g(a); const y = g(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr');
      return sort.dir === 'asc' ? r : -r;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  return { sorted, sort, toggle };
}

export function SortTh<K extends string>({ k, sort, toggle, children, className }: { k: K; sort: SortState<K>; toggle: (k: K) => void; children: ReactNode; className?: string }) {
  const active = sort.key === k;
  return (
    <th className={cx('sortable', className)} onClick={() => toggle(k)}>
      <span className="th-inner">
        {children}
        {active ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
      </span>
    </th>
  );
}

export function usePagination<T>(rows: T[], size = 15) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  return { page: cur, pages, setPage, slice: rows.slice((cur - 1) * size, cur * size), total: rows.length, size };
}

export function Pagination({ page, pages, setPage, total, size }: { page: number; pages: number; setPage: (n: number) => void; total: number; size: number }) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="pagination">
      <span>{total} kayıttan {from}–{to} arası</span>
      <div className="pagination__pages">
        <button className="btn btn-ghost btn-sm btn-icon" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Önceki"><ChevronLeft size={16} /></button>
        {nums.map((n, i) => (
          <span key={n} className="row gap-sm">
            {i > 0 && nums[i - 1] !== n - 1 && <span className="subtle">…</span>}
            <button className={cx('btn btn-sm', n === page ? 'btn-primary' : 'btn-ghost')} style={{ minWidth: 30 }} onClick={() => setPage(n)}>{n}</button>
          </span>
        ))}
        <button className="btn btn-ghost btn-sm btn-icon" disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Sonraki"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="card">
      <EmptyState icon={<XCircle size={24} />} title="Bu sayfaya erişim yetkiniz yok" text="Gerekli yetki için sistem yöneticinize başvurun." />
    </div>
  );
}
