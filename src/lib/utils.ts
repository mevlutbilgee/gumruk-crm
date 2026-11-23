import type { BillingCycle, DiscountType, Payment, ServicePackage, Subscription } from '@/data/types';

export const uid = (prefix = '') =>
  prefix + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

// ---------- Tarih yardımcıları (yerel saat, yyyy-mm-dd) ----------
export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const today = () => toISODate(new Date());
export const parseDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
export const addMonths = (s: string, n: number) => {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
};
export const diffDays = (a: string, b: string) =>
  Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
export const fmtDate = (s?: string) => (s ? dateFmt.format(s.length > 10 ? new Date(s) : parseDate(s)) : '—');
export const fmtDateTime = (s?: string) => (s ? dateTimeFmt.format(new Date(s)) : '—');
export const fmtMonth = (s: string) => monthFmt.format(parseDate(s));

export const relativeDays = (s: string) => {
  const d = diffDays(s, today());
  if (d === 0) return 'Bugün';
  if (d === 1) return 'Yarın';
  if (d === -1) return 'Dün';
  return d > 0 ? `${d} gün sonra` : `${-d} gün gecikti`;
};

export const timeAgo = (iso: string) => {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'az önce';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün önce`;
  return fmtDate(iso);
};

// ---------- Para ----------
const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
export const fmtMoney = (n: number, precise = false) => (precise ? money2 : money).format(n || 0);
export const fmtCompact = (n: number) =>
  new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// ---------- Fiyatlandırma ----------
export const listPriceFor = (pkg: ServicePackage | undefined, cycle: BillingCycle) =>
  pkg ? (cycle === 'monthly' ? pkg.monthlyPrice : pkg.yearlyPrice) : 0;

export const applyDiscount = (price: number, type: DiscountType, value: number) => {
  const v = Math.max(0, value || 0);
  const net = type === 'percent' ? price * (1 - Math.min(v, 100) / 100) : price - v;
  return Math.max(0, Math.round(net * 100) / 100);
};

export const subscriptionNet = (s: Pick<Subscription, 'listPrice' | 'discountType' | 'discountValue'>) =>
  applyDiscount(s.listPrice, s.discountType, s.discountValue);

/** Aylık tekrarlayan gelir (MRR) katkısı. */
export const monthlyValue = (s: Subscription) => {
  if (!s.active) return 0;
  const net = subscriptionNet(s);
  return s.billingCycle === 'monthly' ? net : net / 12;
};

// ---------- Ödeme planı üretimi ----------
/**
 * Bir aboneliğin ödeme takvimini üretir. Başlangıçtan `horizon` tarihine kadar
 * her dönem için bir ödeme satırı. Supabase tarafında aynı mantık
 * `generate_payment_schedule` fonksiyonunda vardır.
 */
export function buildSchedule(customerId: string, s: Subscription, horizon: string): Omit<Payment, 'id' | 'status'>[] {
  const out: Omit<Payment, 'id' | 'status'>[] = [];
  const step = s.billingCycle === 'monthly' ? 1 : 12;
  const end = s.endDate && s.endDate < horizon ? s.endDate : horizon;
  let due = s.startDate;
  let i = 0;
  const amount = subscriptionNet(s);
  while (due <= end && i < 240) {
    out.push({
      customerId,
      subscriptionId: s.id,
      packageId: s.packageId,
      dueDate: due,
      amount,
      periodLabel: s.billingCycle === 'monthly' ? fmtMonth(due) : `${parseDate(due).getFullYear()} yıllık`,
    });
    i += 1;
    due = addMonths(s.startDate, step * i);
  }
  return out;
}

export const isOverdue = (p: Payment) => p.status === 'pending' && p.dueDate < today();

// ---------- Diğer ----------
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toLocaleUpperCase('tr-TR')).join('');

export const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
export const matches = (q: string, ...fields: (string | undefined)[]) => {
  const n = trLower(q.trim());
  return !n || fields.some((f) => f && trLower(f).includes(n));
};

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0d9488', '#4f46e5'];
export const colorFor = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
