import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Search, Send, Wallet } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { CITIES } from '@/lib/constants';
import { useQueryFilters } from '@/lib/hooks';
import { addDays, cx, downloadCSV, fmtMoney, isOverdue, matches, today } from '@/lib/utils';
import { PageHeader, StatCard, useToast } from '@/components/ui';
import PaymentsTable from '@/components/PaymentsTable';

const KEYS = ['status', 'q', 'pkg', 'city', 'from', 'to'] as const;
type Status = '' | 'upcoming' | 'overdue' | 'paid' | 'pending';

export default function Payments() {
  const { can } = usePermissions();
  const toast = useToast();
  const payments = useDb((d) => d.payments);
  const customers = useDb((d) => d.customers);
  const packages = useDb((d) => d.packages);
  const daysAhead = useDb((d) => d.notification.daysAhead);
  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const { values: f, set } = useQueryFilters(KEYS);
  const status = (f.status === 'all' ? '' : f.status || 'upcoming') as Status;
  const T = today();
  const monthEnd = addDays(T, 30);

  const base = useMemo(() => payments.filter((p) => {
    const c = custMap.get(p.customerId);
    return matches(f.q, c?.companyName, p.invoiceNo) && (!f.pkg || p.packageId === f.pkg) && (!f.city || c?.city === f.city)
      && (!f.from || p.dueDate >= f.from) && (!f.to || p.dueDate <= f.to);
  }), [payments, custMap, f.q, f.pkg, f.city, f.from, f.to]);

  const groups = useMemo(() => ({
    upcoming: base.filter((p) => p.status === 'pending' && p.dueDate >= T && p.dueDate <= addDays(T, 60)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    overdue: base.filter(isOverdue).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    paid: base.filter((p) => p.status === 'paid').sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')),
    pending: base.filter((p) => p.status === 'pending').sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  }), [base, T]);
  const rows = status === '' ? [...base].sort((a, b) => b.dueDate.localeCompare(a.dueDate)) : groups[status];

  const sum = (arr: typeof payments) => arr.reduce((a, p) => a + p.amount, 0);
  const thisMonth = T.slice(0, 7);
  const collectedMonth = sum(payments.filter((p) => p.status === 'paid' && (p.paidAt ?? '').slice(0, 7) === thisMonth));
  const dueSoon = payments.filter((p) => p.status === 'pending' && p.dueDate >= T && p.dueDate <= addDays(T, daysAhead));
  const due30 = payments.filter((p) => p.status === 'pending' && p.dueDate >= T && p.dueDate <= monthEnd);
  const overdueAll = payments.filter(isOverdue);

  const exportCsv = () => downloadCSV('odemeler.csv', [
    ['Müşteri', 'Şehir', 'Paket', 'Dönem', 'Vade', 'Tutar', 'Durum', 'Ödeme Tarihi', 'Fatura No'],
    ...rows.map((p) => [custMap.get(p.customerId)?.companyName ?? '', custMap.get(p.customerId)?.city ?? '', packages.find((x) => x.id === p.packageId)?.name ?? '',
      p.periodLabel, p.dueDate, p.amount, p.status === 'paid' ? 'Ödendi' : isOverdue(p) ? 'Gecikmiş' : 'Bekliyor', p.paidAt?.slice(0, 10) ?? '', p.invoiceNo ?? '']),
  ]);

  const tabs: { k: Status; label: string; n: number }[] = [
    { k: 'upcoming', label: 'Yaklaşan (60 gün)', n: groups.upcoming.length },
    { k: 'overdue', label: 'Gecikmiş', n: groups.overdue.length },
    { k: 'pending', label: 'Tüm bekleyenler', n: groups.pending.length },
    { k: 'paid', label: 'Ödenenler', n: groups.paid.length },
    { k: '', label: 'Tümü', n: base.length },
  ];

  return (
    <>
      <PageHeader title="Ödemeler & Tahsilat" description="Abonelik periyotlarına göre otomatik oluşturulan ödeme planı."
        actions={<>
          {can('settings.manage') && <button className="btn btn-secondary" onClick={() => { actions.sendDigest('digest'); toast('Ödeme özeti e-postası oluşturuldu (demo).'); }}><Send size={16} /> Özeti şimdi gönder</button>}
          {can('export.data') && <button className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>}
        </>} />
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard label={`${daysAhead} gün içinde vadesi gelen`} value={fmtMoney(sum(dueSoon))} icon={<CalendarClock size={18} />} tone="warning" meta={`${dueSoon.length} ödeme`} />
        <StatCard label="30 gün içinde beklenen" value={fmtMoney(sum(due30))} icon={<Wallet size={18} />} tone="primary" meta={`${due30.length} ödeme`} />
        <StatCard label="Gecikmiş alacak" value={fmtMoney(sum(overdueAll))} icon={<AlertTriangle size={18} />} tone="danger" meta={`${overdueAll.length} ödeme · ${new Set(overdueAll.map((p) => p.customerId)).size} müşteri`} />
        <StatCard label="Bu ay tahsil edilen" value={fmtMoney(collectedMonth)} icon={<CheckCircle2 size={18} />} tone="success" />
      </div>
      <div className="card">
        <div className="tabs" style={{ padding: '0 12px', marginBottom: 0 }}>
          {tabs.map((t) => (
            <button key={t.k || 'all'} className={cx('tab', status === t.k && 'active')} onClick={() => set('status', t.k === 'upcoming' ? '' : t.k || 'all')}>
              {t.label}<span className="count">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <div className="filters__search"><Search size={15} /><input className="input" placeholder="Müşteri veya fatura no…" value={f.q} onChange={(e) => set('q', e.target.value)} /></div>
          <select className="select" value={f.pkg} onChange={(e) => set('pkg', e.target.value)}>
            <option value="">Tüm iş kalemleri</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Tüm şehirler</option>{CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="date-range" title="Vade tarihi aralığı">
            <input type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} />
            <span className="subtle">–</span>
            <input type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} />
          </div>
        </div>
        <PaymentsTable rows={rows} />
      </div>
    </>
  );
}
