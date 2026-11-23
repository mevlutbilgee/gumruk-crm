// Yaklaşan / geciken ödemeler özet e-postası (HTML). Aynı şablon
// workers/payment-reminder içinde sunucu tarafında da kullanılır.
import type { Database, Payment } from '@/data/types';
import { addDays, addMonths, diffDays, fmtDate, fmtMoney, today } from './utils';

export interface DigestRow { payment: Payment; company: string; packageName: string; days: number }

export function collectDigest(db: Database) {
  const T = today();
  const n = db.notification;
  const until = n.frequency === 'monthly' ? addMonths(T, 1) : addDays(T, n.daysAhead);
  const cust = new Map(db.customers.map((c) => [c.id, c]));
  const pkg = new Map(db.packages.map((p) => [p.id, p]));
  const toRow = (p: Payment): DigestRow => ({
    payment: p,
    company: cust.get(p.customerId)?.companyName ?? '—',
    packageName: pkg.get(p.packageId)?.name ?? '—',
    days: diffDays(p.dueDate, T),
  });
  const pending = db.payments.filter((p) => p.status === 'pending');
  const upcoming = pending.filter((p) => p.dueDate >= T && p.dueDate <= until).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(toRow);
  const overdue = n.includeOverdue ? pending.filter((p) => p.dueDate < T).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(toRow) : [];
  return { upcoming, overdue, until };
}

export function buildDigest(db: Database) {
  const { upcoming, overdue, until } = collectDigest(db);
  const sum = (r: DigestRow[]) => r.reduce((a, x) => a + x.payment.amount, 0);
  const label = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' }[db.notification.frequency];
  const subject = `[${label} Özet] ${upcoming.length} yaklaşan, ${overdue.length} geciken ödeme · ${fmtDate(today())}`;
  const table = (rows: DigestRow[], color: string) => rows.length === 0
    ? '<p style="color:#64748b;margin:8px 0 20px">Kayıt yok.</p>'
    : `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 24px">
        <thead><tr style="background:#f1f5f9;text-align:left">
          <th style="padding:8px">Firma</th><th style="padding:8px">Paket</th><th style="padding:8px">Dönem</th>
          <th style="padding:8px">Vade</th><th style="padding:8px;text-align:right">Tutar</th></tr></thead>
        <tbody>${rows.map((r) => `<tr style="border-bottom:1px solid #e2e8f0">
          <td style="padding:8px;font-weight:600">${r.company}</td><td style="padding:8px">${r.packageName}</td>
          <td style="padding:8px">${r.payment.periodLabel}</td>
          <td style="padding:8px;color:${color}">${fmtDate(r.payment.dueDate)} (${r.days >= 0 ? `${r.days} gün` : `${-r.days} gün gecikme`})</td>
          <td style="padding:8px;text-align:right;font-weight:600">${fmtMoney(r.payment.amount)}</td></tr>`).join('')}</tbody></table>`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:auto;color:#0f172a">
    <div style="background:#1d4ed8;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:12px;opacity:.8">${db.company.name}</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${label} Ödeme Özeti</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Merhaba, ${fmtDate(until)} tarihine kadar vadesi gelen ödemeler aşağıdadır.</p>
      <div style="display:flex;gap:12px;margin:16px 0">
        <div style="flex:1;background:#eff6ff;padding:12px;border-radius:8px"><div style="font-size:12px;color:#1d4ed8">Yaklaşan</div><div style="font-size:18px;font-weight:700">${fmtMoney(sum(upcoming))}</div></div>
        <div style="flex:1;background:#fef2f2;padding:12px;border-radius:8px"><div style="font-size:12px;color:#dc2626">Geciken</div><div style="font-size:18px;font-weight:700">${fmtMoney(sum(overdue))}</div></div>
      </div>
      <h3 style="margin:16px 0 0;font-size:15px">Yaklaşan Ödemeler (${upcoming.length})</h3>${table(upcoming, '#1d4ed8')}
      ${db.notification.includeOverdue ? `<h3 style="margin:0;font-size:15px;color:#dc2626">Geciken Ödemeler (${overdue.length})</h3>${table(overdue, '#dc2626')}` : ''}
      <p style="font-size:12px;color:#94a3b8">Bu e-posta GümrükCRM tarafından otomatik gönderilmiştir.</p>
    </div></div>`;
  return { subject, html, upcoming, overdue };
}
