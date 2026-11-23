import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, Building2, CalendarClock, CheckSquare, ChevronDown, LayoutDashboard, LogOut, Menu, Moon, Package,
  Search, Settings, Ship, Sun, Target, UserCog, Users, Wallet,
} from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { DATA_MODE } from '@/data/supabase';
import { ROLE_LABELS } from '@/lib/constants';
import { addDays, cx, fmtMoney, matches, relativeDays, today } from '@/lib/utils';
import type { Permission } from '@/data/types';
import { Avatar } from './ui';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('gumruk-crm-theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('gumruk-crm-theme', theme); } catch { /* */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))] as const;
}

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);
  return ref;
}

export default function Layout() {
  const { user, can } = usePermissions();
  const [theme, toggleTheme] = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  useEffect(() => { actions.runScheduler(); }, []);

  const T = today();
  const overdueCount = useDb((d) => d.payments.filter((p) => p.status === 'pending' && p.dueDate < T).length);
  const openTasks = useDb((d) => d.tasks.filter((t) => !t.done && t.assigneeId === user?.id).length);
  const leadCount = useDb((d) => d.leads.filter((l) => !['won', 'lost'].includes(l.stage)).length);

  const nav: { to: string; label: string; icon: JSX.Element; perm: Permission; count?: number; alert?: boolean }[][] = [
    [
      { to: '/', label: 'Gösterge Paneli', icon: <LayoutDashboard size={18} />, perm: 'dashboard.view' },
      { to: '/customers', label: 'Müşteriler', icon: <Building2 size={18} />, perm: 'customers.view' },
      { to: '/leads', label: 'Potansiyel Müşteriler', icon: <Target size={18} />, perm: 'leads.view', count: leadCount },
      { to: '/payments', label: 'Ödemeler', icon: <Wallet size={18} />, perm: 'payments.view', count: overdueCount, alert: overdueCount > 0 },
      { to: '/tasks', label: 'Görevler', icon: <CheckSquare size={18} />, perm: 'tasks.view', count: openTasks || undefined },
    ],
    [
      { to: '/packages', label: 'Hizmet Paketleri', icon: <Package size={18} />, perm: 'packages.view' },
      { to: '/reports', label: 'Raporlar', icon: <BarChart3 size={18} />, perm: 'reports.view' },
    ],
    [
      { to: '/users', label: 'Kullanıcılar', icon: <Users size={18} />, perm: 'users.manage' },
      { to: '/settings', label: 'Ayarlar', icon: <Settings size={18} />, perm: 'settings.manage' },
    ],
  ];
  const sections = ['Ana Menü', 'Hizmetler & Analiz', 'Yönetim'];

  return (
    <div className="app">
      <aside className={cx('sidebar', mobileOpen && 'open')}>
        <div className="sidebar__brand">
          <div className="sidebar__logo"><Ship size={18} /></div>
          <div>
            <div className="sidebar__name">GümrükCRM</div>
            <div className="sidebar__tag">Müşteri Yönetim Paneli</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          {nav.map((group, gi) => {
            const items = group.filter((i) => can(i.perm));
            if (!items.length) return null;
            return (
              <div key={gi}>
                <div className="sidebar__section">{sections[gi]}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => cx('navlink', isActive && 'active')}>
                    {i.icon}<span>{i.label}</span>
                    {!!i.count && <span className={cx('navlink__count', i.alert && 'navlink__count--alert')}>{i.count}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar__foot">
          <div className="sidebar__mode">
            <span className="dot" style={{ background: DATA_MODE === 'mock' ? '#f59e0b' : '#22c55e' }} />
            <span>{DATA_MODE === 'mock' ? 'Demo modu · yerel veri' : 'Supabase bağlı'}</span>
          </div>
        </div>
      </aside>
      <div className={cx('overlay', mobileOpen && 'open')} onClick={() => setMobileOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon burger" onClick={() => setMobileOpen(true)} aria-label="Menü"><Menu size={20} /></button>
          <GlobalSearch />
          <div className="topbar__actions">
            <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Tema değiştir">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="content">
          {user && <Outlet />}
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const { can } = usePermissions();
  const customers = useDb((d) => d.customers);
  const leads = useDb((d) => d.leads);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const c = can('customers.view') ? customers.filter((x) => matches(q, x.companyName, x.contactName, x.email, x.taxNumber, x.city)).slice(0, 6)
      .map((x) => ({ id: x.id, group: 'Müşteriler', title: x.companyName, sub: `${x.contactName} · ${x.city}`, to: `/customers/${x.id}` })) : [];
    const l = can('leads.view') ? leads.filter((x) => matches(q, x.companyName, x.contactName, x.email, x.city)).slice(0, 5)
      .map((x) => ({ id: x.id, group: 'Potansiyel Müşteriler', title: x.companyName, sub: `${x.contactName} · ${x.city}`, to: `/leads/${x.id}` })) : [];
    return [...c, ...l];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, customers, leads]);

  const go = (to: string) => { navigate(to); setOpen(false); setQ(''); inputRef.current?.blur(); };

  return (
    <div className="topbar__search" ref={ref}>
      <Search size={16} />
      <input ref={inputRef} className="input" placeholder="Firma, yetkili, vergi no ara…" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) go(results[active].to);
          if (e.key === 'Escape') setOpen(false);
        }} />
      <span className="topbar__kbd">⌘K</span>
      {open && q.trim().length >= 2 && (
        <div className="search-results">
          {results.length === 0 && <div className="subtle" style={{ padding: 12 }}>“{q}” için sonuç bulunamadı.</div>}
          {results.map((r, i) => (
            <div key={r.id}>
              {(i === 0 || results[i - 1].group !== r.group) && <div className="search-results__group">{r.group}</div>}
              <div className={cx('search-results__item', i === active && 'active')} onMouseEnter={() => setActive(i)} onMouseDown={() => go(r.to)}>
                <Avatar name={r.title} size="sm" />
                <div style={{ minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: 13 }}>{r.title}</div>
                  <div className="subtle">{r.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const navigate = useNavigate();
  const { user, can } = usePermissions();
  const T = today();
  const daysAhead = useDb((d) => d.notification.daysAhead);
  const payments = useDb((d) => d.payments);
  const customers = useDb((d) => d.customers);
  const tasks = useDb((d) => d.tasks);

  const items = useMemo(() => {
    const cust = new Map(customers.map((c) => [c.id, c.companyName]));
    const out: { key: string; tone: string; title: string; sub: string; to: string }[] = [];
    if (can('payments.view')) {
      payments.filter((p) => p.status === 'pending' && p.dueDate < T).slice(0, 5).forEach((p) =>
        out.push({ key: p.id, tone: 'var(--danger)', title: `${cust.get(p.customerId)} · ${fmtMoney(p.amount)}`, sub: `Geciken ödeme · ${relativeDays(p.dueDate)}`, to: `/payments?status=overdue` }));
      payments.filter((p) => p.status === 'pending' && p.dueDate >= T && p.dueDate <= addDays(T, daysAhead))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6).forEach((p) =>
          out.push({ key: p.id, tone: 'var(--warning)', title: `${cust.get(p.customerId)} · ${fmtMoney(p.amount)}`, sub: `Yaklaşan ödeme · ${relativeDays(p.dueDate)}`, to: `/payments?status=upcoming` }));
    }
    tasks.filter((t) => !t.done && t.assigneeId === user?.id && t.dueDate <= addDays(T, 1)).slice(0, 4).forEach((t) =>
      out.push({ key: t.id, tone: 'var(--primary)', title: t.title, sub: `Görev · ${relativeDays(t.dueDate)}`, to: '/tasks' }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, customers, tasks, user?.id, daysAhead]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn btn-ghost btn-icon icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Bildirimler">
        <Bell size={18} />
        {items.length > 0 && <span className="icon-btn__badge">{items.length}</span>}
      </button>
      {open && (
        <div className="popover" style={{ width: 360 }}>
          <div className="row-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong>Bildirimler</strong>
            <span className="subtle"><CalendarClock size={12} style={{ verticalAlign: -2 }} /> {daysAhead} gün içinde</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 0' }}>
            {items.length === 0 && <div className="subtle" style={{ padding: 16 }}>Yeni bildirim yok 🎉</div>}
            {items.map((i) => (
              <button key={i.key} className="menu-item" onClick={() => { navigate(i.to); setOpen(false); }}>
                <span className="dot" style={{ background: i.tone }} />
                <span style={{ minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 290 }}>{i.title}</div>
                  <div className="subtle">{i.sub}</div>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, can } = usePermissions();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn btn-ghost" style={{ height: 42, paddingLeft: 6 }} onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.name} />
        <span style={{ textAlign: 'left', lineHeight: 1.2 }} className="hide-sm">
          <div className="strong" style={{ fontSize: 13, color: 'var(--text)' }}>{user.name}</div>
          <div className="subtle" style={{ fontSize: 11.5 }}>{ROLE_LABELS[user.role]}</div>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="popover" style={{ padding: '6px 0' }}>
          <div style={{ padding: '6px 14px 10px' }}>
            <div className="strong">{user.name}</div>
            <div className="subtle">{user.email}</div>
          </div>
          <div className="menu-sep" />
          {can('users.manage') && <button className="menu-item" onClick={() => { navigate('/users'); setOpen(false); }}><UserCog size={16} /> Kullanıcı yönetimi</button>}
          {can('settings.manage') && <button className="menu-item" onClick={() => { navigate('/settings'); setOpen(false); }}><Settings size={16} /> Ayarlar</button>}
          <button className="menu-item" onClick={() => { actions.logout(); navigate('/login'); }}><LogOut size={16} /> Çıkış yap</button>
        </div>
      )}
    </div>
  );
}
