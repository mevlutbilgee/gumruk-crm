// ---------------------------------------------------------------------------
// Basit, bağımlılıksız reaktif veri deposu.
// MOCK modda veriler localStorage'da tutulur. Supabase'e geçişte bu dosyadaki
// `actions` nesnesi aynı imzalarla `supabaseRepository` üzerinden çalışacak
// şekilde değiştirilebilir (bkz. src/data/supabase.ts ve README).
// ---------------------------------------------------------------------------
import { useRef, useSyncExternalStore } from 'react';
import { DB_VERSION, createSeed } from './seed';
import type {
  Activity, AuditEntry, Customer, Database, EmailLog, Lead, NotificationSettings, Payment, Permission, Role,
  ServicePackage, Task, User, CompanySettings,
} from './types';
import { addMonths, buildSchedule, today, uid } from '@/lib/utils';
import { buildDigest } from '@/lib/digest';

const KEY = 'gumruk-crm-db';
const SESSION_KEY = 'gumruk-crm-session';

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Database;
      if (db.version === DB_VERSION) return db;
    }
  } catch { /* yoksay */ }
  return createSeed();
}

let state: Database = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* kota vb. */ }
}

function set(updater: (db: Database) => Database) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a); const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Seçici tabanlı abonelik. Seçici yeni dizi/nesne döndürse bile sonuç sığ
 * karşılaştırmayla önbelleklenir; gereksiz render ve sonsuz döngü engellenir.
 */
export function useDb<T>(selector: (db: Database) => T): T {
  const cache = useRef<{ v: T } | null>(null);
  const get = () => {
    const v = selector(state);
    if (cache.current && shallowEqual(cache.current.v, v)) return cache.current.v;
    cache.current = { v };
    return v;
  };
  return useSyncExternalStore(subscribe, get);
}
export const getDb = () => state;

// ---------------- Oturum ----------------
let sessionUserId: string | null = (() => {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
})();
const sessionListeners = new Set<() => void>();
export function useSessionUser(): User | null {
  const id = useSyncExternalStore(
    (cb) => { sessionListeners.add(cb); listeners.add(cb); return () => { sessionListeners.delete(cb); listeners.delete(cb); }; },
    () => sessionUserId,
  );
  const users = useDb((d) => d.users);
  return users.find((u) => u.id === id && u.active) ?? null;
}
const me = () => sessionUserId ?? 'system';

function audit(action: AuditEntry['action'], entity: string, entityLabel: string): (db: Database) => Database {
  return (db) => ({
    ...db,
    audit: [{ id: uid('au_'), userId: me(), action, entity, entityLabel, createdAt: new Date().toISOString() }, ...db.audit].slice(0, 500),
  });
}
const pipe = (...fns: ((db: Database) => Database)[]) => (db: Database) => fns.reduce((acc, f) => f(acc), db);
const now = () => new Date().toISOString();

/** Müşteri kaydedildiğinde: ödenmemiş gelecek ödemeleri sil ve takvimi yeniden üret. */
function regenerateSchedule(db: Database, c: Customer): Payment[] {
  const T = today();
  const horizon = addMonths(T, 12);
  const kept = db.payments.filter((p) => p.customerId !== c.id || p.status === 'paid' || (p.dueDate < T && p.status === 'pending'));
  const existingKey = new Set(kept.filter((p) => p.customerId === c.id).map((p) => `${p.subscriptionId}|${p.dueDate}`));
  const fresh: Payment[] = [];
  if (c.status !== 'passive') {
    for (const s of c.subscriptions.filter((x) => x.active)) {
      for (const row of buildSchedule(c.id, s, horizon)) {
        if (row.dueDate < T) continue; // geçmiş dönemler yeniden üretilmez
        if (existingKey.has(`${s.id}|${row.dueDate}`)) continue;
        fresh.push({ ...row, id: uid('pay_'), status: 'pending' });
      }
    }
  }
  return [...kept, ...fresh];
}

// ---------------- Aksiyonlar ----------------
export const actions = {
  login(email: string, password: string): { ok: true } | { ok: false; error: string } {
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return { ok: false, error: 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.' };
    if (!user.active) return { ok: false, error: 'Hesabınız pasif durumda. Yöneticinize başvurun.' };
    if (password !== 'demo123') return { ok: false, error: 'Şifre hatalı. (Demo şifresi: demo123)' };
    sessionUserId = user.id;
    try { localStorage.setItem(SESSION_KEY, user.id); } catch { /* */ }
    set(pipe((db) => ({ ...db, users: db.users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: now() } : u)) }), audit('login', 'Oturum', user.name)));
    sessionListeners.forEach((l) => l());
    return { ok: true };
  },
  logout() {
    sessionUserId = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
    sessionListeners.forEach((l) => l());
    listeners.forEach((l) => l());
  },
  resetDemo() {
    state = createSeed();
    persist();
    listeners.forEach((l) => l());
  },

  // ---- Müşteriler ----
  saveCustomer(input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Customer {
    const exists = input.id ? state.customers.find((c) => c.id === input.id) : undefined;
    const c: Customer = exists
      ? { ...exists, ...input, id: exists.id, updatedAt: now() }
      : { ...input, id: uid('c_'), createdAt: now(), updatedAt: now() };
    set(pipe(
      (db) => ({ ...db, customers: exists ? db.customers.map((x) => (x.id === c.id ? c : x)) : [c, ...db.customers] }),
      (db) => ({ ...db, payments: regenerateSchedule(db, c) }),
      (db) => exists ? db : ({ ...db, activities: [{ id: uid('a_'), entityType: 'customer', entityId: c.id, type: 'system', content: 'Müşteri kaydı oluşturuldu.', userId: me(), createdAt: now() }, ...db.activities] }),
      audit(exists ? 'update' : 'create', 'Müşteri', c.companyName),
    ));
    return c;
  },
  deleteCustomer(id: string) {
    const c = state.customers.find((x) => x.id === id);
    set(pipe(
      (db) => ({
        ...db,
        customers: db.customers.filter((x) => x.id !== id),
        payments: db.payments.filter((p) => p.customerId !== id),
        activities: db.activities.filter((a) => !(a.entityType === 'customer' && a.entityId === id)),
        tasks: db.tasks.filter((t) => !(t.relatedType === 'customer' && t.relatedId === id)),
      }),
      audit('delete', 'Müşteri', c?.companyName ?? id),
    ));
  },

  // ---- Adaylar ----
  saveLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Lead {
    const exists = input.id ? state.leads.find((l) => l.id === input.id) : undefined;
    const l: Lead = exists ? { ...exists, ...input, id: exists.id, updatedAt: now() } : { ...input, id: uid('l_'), createdAt: now(), updatedAt: now() };
    set(pipe(
      (db) => ({ ...db, leads: exists ? db.leads.map((x) => (x.id === l.id ? l : x)) : [l, ...db.leads] }),
      audit(exists ? 'update' : 'create', 'Aday', l.companyName),
    ));
    return l;
  },
  moveLead(id: string, stage: Lead['stage'], probability: number) {
    const l = state.leads.find((x) => x.id === id);
    if (!l || l.stage === stage) return;
    set(pipe(
      (db) => ({ ...db, leads: db.leads.map((x) => (x.id === id ? { ...x, stage, probability, updatedAt: now() } : x)) }),
      (db) => ({ ...db, activities: [{ id: uid('a_'), entityType: 'lead', entityId: id, type: 'system', content: `Aşama değişti → ${stage}`, userId: me(), createdAt: now() }, ...db.activities] }),
      audit('update', 'Aday', `${l.companyName} aşaması güncellendi`),
    ));
  },
  deleteLead(id: string) {
    const l = state.leads.find((x) => x.id === id);
    set(pipe(
      (db) => ({ ...db, leads: db.leads.filter((x) => x.id !== id), activities: db.activities.filter((a) => !(a.entityType === 'lead' && a.entityId === id)) }),
      audit('delete', 'Aday', l?.companyName ?? id),
    ));
  },
  /** Adayı müşteriye dönüştürür: abonelikler ilgi duyulan paketlerden oluşturulur. */
  convertLead(id: string): Customer | null {
    const l = state.leads.find((x) => x.id === id);
    if (!l) return null;
    const T = today();
    const c = actions.saveCustomer({
      companyName: l.companyName, sector: l.sector, contactName: l.contactName, contactTitle: l.contactTitle,
      email: l.email, phone: l.phone, city: l.city, taxNumber: '', taxOffice: '', startDate: T, status: 'active',
      ownerId: l.ownerId, tags: l.tags, notes: l.notes,
      subscriptions: l.interests.map((i) => {
        const pkg = state.packages.find((p) => p.id === i.packageId);
        return {
          id: uid('s_'), packageId: i.packageId, billingCycle: i.billingCycle, startDate: T,
          listPrice: pkg ? (i.billingCycle === 'monthly' ? pkg.monthlyPrice : pkg.yearlyPrice) : 0,
          discountType: i.discountType, discountValue: i.discountValue, active: true,
        };
      }),
    });
    set(pipe(
      (db) => ({
        ...db,
        leads: db.leads.map((x) => (x.id === id ? { ...x, stage: 'won', probability: 100, convertedCustomerId: c.id, updatedAt: now() } : x)),
        // Aday geçmişi müşteri kartına da kopyalanır
        activities: [
          ...db.activities,
          ...db.activities.filter((a) => a.entityType === 'lead' && a.entityId === id)
            .map((a) => ({ ...a, id: uid('a_'), entityType: 'customer' as const, entityId: c.id })),
        ],
      }),
      audit('convert', 'Aday', `${l.companyName} müşteriye dönüştürüldü`),
    ));
    return c;
  },

  // ---- Aktivite ----
  addActivity(a: Omit<Activity, 'id' | 'createdAt' | 'userId'>) {
    set((db) => ({ ...db, activities: [{ ...a, id: uid('a_'), userId: me(), createdAt: now() }, ...db.activities] }));
  },
  deleteActivity(id: string) {
    set((db) => ({ ...db, activities: db.activities.filter((a) => a.id !== id) }));
  },

  // ---- Paketler ----
  savePackage(input: Omit<ServicePackage, 'id' | 'createdAt'> & { id?: string }) {
    const exists = input.id ? state.packages.find((p) => p.id === input.id) : undefined;
    const p: ServicePackage = exists ? { ...exists, ...input, id: exists.id } : { ...input, id: uid('p_'), createdAt: now() };
    set(pipe(
      (db) => ({ ...db, packages: exists ? db.packages.map((x) => (x.id === p.id ? p : x)) : [...db.packages, p] }),
      audit(exists ? 'update' : 'create', 'Paket', p.name),
    ));
  },
  deletePackage(id: string): { ok: boolean; error?: string } {
    const used = state.customers.some((c) => c.subscriptions.some((s) => s.packageId === id));
    if (used) return { ok: false, error: 'Bu paket müşterilerde kullanılıyor. Silmek yerine pasif yapabilirsiniz.' };
    const p = state.packages.find((x) => x.id === id);
    set(pipe((db) => ({ ...db, packages: db.packages.filter((x) => x.id !== id) }), audit('delete', 'Paket', p?.name ?? id)));
    return { ok: true };
  },

  // ---- Ödemeler ----
  markPaid(id: string, data: { method: Payment['method']; paidAt: string; invoiceNo?: string }) {
    const p = state.payments.find((x) => x.id === id);
    const c = state.customers.find((x) => x.id === p?.customerId);
    set(pipe(
      (db) => ({ ...db, payments: db.payments.map((x) => (x.id === id ? { ...x, status: 'paid', ...data } : x)) }),
      audit('payment', 'Ödeme', `${c?.companyName ?? ''} · ${p?.periodLabel ?? ''} tahsil edildi`),
    ));
  },
  markUnpaid(id: string) {
    set(pipe(
      (db) => ({ ...db, payments: db.payments.map((x) => (x.id === id ? { ...x, status: 'pending', paidAt: undefined, method: undefined, invoiceNo: undefined } : x)) }),
      audit('payment', 'Ödeme', 'Tahsilat geri alındı'),
    ));
  },

  // ---- Görevler ----
  saveTask(input: Omit<Task, 'id' | 'createdAt' | 'createdBy'> & { id?: string }) {
    const exists = input.id ? state.tasks.find((t) => t.id === input.id) : undefined;
    const t: Task = exists ? { ...exists, ...input, id: exists.id } : { ...input, id: uid('t_'), createdAt: now(), createdBy: me() };
    set((db) => ({ ...db, tasks: exists ? db.tasks.map((x) => (x.id === t.id ? t : x)) : [t, ...db.tasks] }));
  },
  toggleTask(id: string) {
    set((db) => ({ ...db, tasks: db.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  },
  deleteTask(id: string) {
    set((db) => ({ ...db, tasks: db.tasks.filter((t) => t.id !== id) }));
  },

  // ---- Kullanıcılar ----
  saveUser(input: Omit<User, 'id' | 'createdAt'> & { id?: string }): { ok: boolean; error?: string } {
    const email = input.email.trim().toLowerCase();
    if (state.users.some((u) => u.email.toLowerCase() === email && u.id !== input.id)) return { ok: false, error: 'Bu e-posta zaten kayıtlı.' };
    const exists = input.id ? state.users.find((u) => u.id === input.id) : undefined;
    if (exists && exists.role === 'admin' && (input.role !== 'admin' || !input.active)) {
      const admins = state.users.filter((u) => u.role === 'admin' && u.active);
      if (admins.length <= 1) return { ok: false, error: 'Sistemde en az bir aktif yönetici kalmalıdır.' };
    }
    const u: User = exists ? { ...exists, ...input, email } : { ...input, email, id: uid('u_'), createdAt: now() };
    set(pipe(
      (db) => ({ ...db, users: exists ? db.users.map((x) => (x.id === u.id ? u : x)) : [...db.users, u] }),
      audit(exists ? 'update' : 'create', 'Kullanıcı', u.name),
    ));
    if (!exists) {
      actions.logEmail({
        to: [u.email], kind: 'invite', subject: `${state.company.name} CRM davetiyesi`,
        html: `<p>Merhaba ${u.name},</p><p>${state.company.name} CRM paneline <b>${u.role}</b> rolüyle davet edildiniz.</p><p>Giriş için bağlantı: <a href="#">Panele git</a></p>`,
      });
    }
    return { ok: true };
  },
  deleteUser(id: string): { ok: boolean; error?: string } {
    if (id === sessionUserId) return { ok: false, error: 'Kendi hesabınızı silemezsiniz.' };
    const u = state.users.find((x) => x.id === id);
    if (u?.role === 'admin' && state.users.filter((x) => x.role === 'admin' && x.active).length <= 1)
      return { ok: false, error: 'Son yönetici silinemez.' };
    const fallback = sessionUserId ?? 'u_admin';
    set(pipe(
      (db) => ({
        ...db,
        users: db.users.filter((x) => x.id !== id),
        customers: db.customers.map((c) => (c.ownerId === id ? { ...c, ownerId: fallback } : c)),
        leads: db.leads.map((l) => (l.ownerId === id ? { ...l, ownerId: fallback } : l)),
        tasks: db.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: fallback } : t)),
      }),
      audit('delete', 'Kullanıcı', u?.name ?? id),
    ));
    return { ok: true };
  },
  setRolePermissions(role: Role, perms: Permission[]) {
    if (role === 'admin') return; // admin her zaman tam yetkili
    set(pipe((db) => ({ ...db, rolePermissions: { ...db.rolePermissions, [role]: perms } }), audit('settings', 'Yetki', `${role} rol yetkileri güncellendi`)));
  },

  // ---- Ayarlar & Bildirimler ----
  saveNotification(n: NotificationSettings) {
    set(pipe((db) => ({ ...db, notification: n }), audit('settings', 'Bildirim', 'Bildirim ayarları güncellendi')));
  },
  saveCompany(c: CompanySettings) {
    set(pipe((db) => ({ ...db, company: c }), audit('settings', 'Firma', 'Firma bilgileri güncellendi')));
  },
  logEmail(e: Omit<EmailLog, 'id' | 'createdAt' | 'status'>) {
    set((db) => ({ ...db, emails: [{ ...e, id: uid('e_'), status: 'simulated' as const, createdAt: now() }, ...db.emails].slice(0, 200) }));
  },
  /** Ödeme özet e-postasını oluşturur ve (mock modda) e-posta kaydına yazar. */
  sendDigest(kind: 'digest' | 'test' = 'digest') {
    const d = buildDigest(state);
    actions.logEmail({ to: state.notification.recipients, subject: d.subject, html: d.html, kind });
    set(pipe((db) => ({ ...db, notification: { ...db.notification, lastDigestAt: now() } }), audit('email', 'Bildirim', d.subject)));
  },
  /**
   * Zamanlayıcı simülasyonu: Uygulama açıldığında, ayarlara göre bugün özet
   * gönderilmesi gerekiyorsa gönderir. Prod'da bu işi Cloudflare Worker cron'u yapar.
   */
  runScheduler() {
    const n = state.notification;
    if (!n.enabled || n.recipients.length === 0) return;
    const T = new Date();
    if (T.getHours() < n.sendHour) return;
    const last = n.lastDigestAt ? new Date(n.lastDigestAt) : null;
    const sameDay = last && last.toDateString() === T.toDateString();
    if (sameDay) return;
    if (n.frequency === 'weekly' && T.getDay() !== 1) return;
    if (n.frequency === 'monthly' && T.getDate() !== n.monthlyDay) return;
    actions.sendDigest('digest');
  },
};

// Yetki kontrolü
export function usePermissions() {
  const user = useSessionUser();
  const perms = useDb((d) => d.rolePermissions);
  const list = user ? (user.role === 'admin' ? null : perms[user.role] ?? []) : [];
  return {
    user,
    can: (p: Permission) => (list === null ? true : list.includes(p)),
  };
}
