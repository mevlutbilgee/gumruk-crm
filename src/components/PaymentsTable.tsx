import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { PAYMENT_METHODS } from '@/lib/constants';
import { fmtDate, fmtMoney, isOverdue, relativeDays, today } from '@/lib/utils';
import type { Payment } from '@/data/types';
import { Badge, EmptyState, Field, Modal, PackagePill, Pagination, useConfirm, usePagination, useToast } from './ui';

export function paymentBadge(p: Payment) {
  if (p.status === 'paid') return <Badge tone="success" dot>Ödendi</Badge>;
  if (p.status === 'cancelled') return <Badge tone="neutral">İptal</Badge>;
  if (isOverdue(p)) return <Badge tone="danger" dot>Gecikmiş</Badge>;
  return <Badge tone="warning" dot>Bekliyor</Badge>;
}

export default function PaymentsTable({ rows, showCustomer = true, pageSize = 15 }: { rows: Payment[]; showCustomer?: boolean; pageSize?: number }) {
  const { can } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const customers = useDb((d) => d.customers);
  const packages = useDb((d) => d.packages);
  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const pkgMap = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const pg = usePagination(rows, pageSize);
  const [paying, setPaying] = useState<Payment | null>(null);
  const [form, setForm] = useState({ method: 'transfer' as NonNullable<Payment['method']>, paidAt: today(), invoiceNo: '' });

  if (rows.length === 0) return <EmptyState title="Ödeme kaydı yok" text="Seçili kriterlere uygun ödeme bulunamadı." />;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {showCustomer && <th>Müşteri</th>}
              <th>Paket</th>
              <th>Dönem</th>
              <th>Vade</th>
              <th className="right">Tutar</th>
              <th>Durum</th>
              <th>Tahsilat</th>
              {can('payments.edit') && <th className="actions" />}
            </tr>
          </thead>
          <tbody>
            {pg.slice.map((p) => {
              const c = custMap.get(p.customerId);
              const overdue = isOverdue(p);
              return (
                <tr key={p.id}>
                  {showCustomer && (
                    <td><div className="company-cell"><Link to={`/customers/${p.customerId}`}><div className="company-cell__name">{c?.companyName}</div></Link></div>
                      <div className="company-cell__sub">{c?.city}</div></td>
                  )}
                  <td><PackagePill pkg={pkgMap.get(p.packageId)} /></td>
                  <td className="nowrap">{p.periodLabel}</td>
                  <td className="nowrap">
                    <div className="num">{fmtDate(p.dueDate)}</div>
                    {p.status === 'pending' && <div className={overdue ? 'text-danger' : 'subtle'} style={{ fontSize: 12 }}>{relativeDays(p.dueDate)}</div>}
                  </td>
                  <td className="right num strong">{fmtMoney(p.amount)}</td>
                  <td>{paymentBadge(p)}</td>
                  <td className="nowrap" style={{ fontSize: 12.5 }}>
                    {p.status === 'paid' ? <><div>{fmtDate(p.paidAt)}</div><div className="subtle">{p.method && PAYMENT_METHODS[p.method]}{p.invoiceNo ? ` · ${p.invoiceNo}` : ''}</div></> : <span className="subtle">—</span>}
                  </td>
                  {can('payments.edit') && (
                    <td className="actions">
                      {p.status === 'pending' ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setPaying(p); setForm({ method: 'transfer', paidAt: today(), invoiceNo: '' }); }}>
                          <CheckCircle2 size={14} /> Tahsil et
                        </button>
                      ) : p.status === 'paid' ? (
                        <button className="btn btn-ghost btn-sm" title="Tahsilatı geri al" onClick={async () => {
                          if (await confirm({ title: 'Tahsilat geri alınsın mı?', message: 'Ödeme tekrar “bekliyor” durumuna dönecek.', confirmText: 'Geri al' })) {
                            actions.markUnpaid(p.id); toast('Tahsilat geri alındı.');
                          }
                        }}><RotateCcw size={14} /></button>
                      ) : null}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination {...pg} />

      <Modal open={!!paying} onClose={() => setPaying(null)} size="sm" title="Tahsilat Kaydet"
        subtitle={paying && `${custMap.get(paying.customerId)?.companyName} · ${paying.periodLabel} · ${fmtMoney(paying.amount)}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPaying(null)}>Vazgeç</button>
          <button className="btn btn-success" onClick={() => {
            if (!paying) return;
            actions.markPaid(paying.id, { method: form.method, paidAt: new Date(form.paidAt + 'T12:00:00').toISOString(), invoiceNo: form.invoiceNo || undefined });
            toast('Tahsilat kaydedildi.'); setPaying(null);
          }}><CheckCircle2 size={16} /> Ödendi olarak işaretle</button>
        </>}>
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Ödeme yöntemi">
            <select className="select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Ödeme tarihi">
            <input type="date" className="input" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
          </Field>
          <Field label="Fatura no" hint="İsteğe bağlı">
            <input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} placeholder="GMR2026…" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
