import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDb, usePermissions } from '@/data/store';
import { LEAD_SOURCES } from '@/lib/constants';
import { addMonths, downloadCSV, fmtCompact, fmtMoney, isOverdue, monthlyValue, today } from '@/lib/utils';
import { PageHeader, Segmented } from '@/components/ui';
import { leadValue } from './Leads';

const monthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' });
const Tip = ({ active, payload, label, money = true }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; money?: boolean }) =>
  active && payload ? <div className="chart-tooltip"><div className="strong">{label}</div>{payload.map((p) => <div key={p.name}>{p.name}: {money ? fmtMoney(p.value) : p.value}</div>)}</div> : null;

export default function Reports() {
  const { can } = usePermissions();
  const db = useDb((d) => d);
  const [range, setRange] = useState<'6' | '12' | '24'>('12');
  const T = today();
  const pkgMap = useMemo(() => new Map(db.packages.map((p) => [p.id, p])), [db.packages]);
  const n = Number(range);

  const monthly = useMemo(() => Array.from({ length: n }, (_, i) => {
    const key = addMonths(T.slice(0, 8) + '01', i - n + 1).slice(0, 7);
    return {
      m: monthShort.format(new Date(key + '-01T00:00:00')),
      Tahsilat: db.payments.filter((p) => p.status === 'paid' && (p.paidAt ?? '').slice(0, 7) === key).reduce((a, p) => a + p.amount, 0),
      'Yeni müşteri': db.customers.filter((c) => c.startDate.slice(0, 7) === key).length,
    };
  }), [db.payments, db.customers, n, T]);

  const groupBy = (keyFn: (c: (typeof db.customers)[number]) => string) => {
    const m = new Map<string, { count: number; mrr: number }>();
    db.customers.forEach((c) => {
      const k = keyFn(c); const x = m.get(k) ?? { count: 0, mrr: 0 };
      x.count += 1; x.mrr += c.subscriptions.reduce((a, s) => a + monthlyValue(s), 0); m.set(k, x);
    });
    return [...m.entries()].map(([name, v]) => ({ name, ...v, mrr: Math.round(v.mrr) })).sort((a, b) => b.mrr - a.mrr);
  };
  const byCity = useMemo(() => groupBy((c) => c.city), [db.customers]); // eslint-disable-line react-hooks/exhaustive-deps
  const bySector = useMemo(() => groupBy((c) => c.sector), [db.customers]); // eslint-disable-line react-hooks/exhaustive-deps

  const byPackage = useMemo(() => db.packages.map((p) => {
    const subs = db.customers.flatMap((c) => c.subscriptions.filter((s) => s.packageId === p.id && s.active));
    const disc = subs.reduce((a, s) => a + (s.listPrice - (s.discountType === 'percent' ? s.listPrice * (1 - s.discountValue / 100) : s.listPrice - s.discountValue)) * (s.billingCycle === 'monthly' ? 12 : 1), 0);
    return { name: p.name, color: p.color, count: subs.length, monthly: subs.filter((s) => s.billingCycle === 'monthly').length, yearly: subs.filter((s) => s.billingCycle === 'yearly').length,
      mrr: Math.round(subs.reduce((a, s) => a + monthlyValue(s), 0)), discount: Math.round(disc) };
  }), [db.packages, db.customers]);

  const bySource = useMemo(() => Object.entries(LEAD_SOURCES).map(([k, label]) => {
    const ls = db.leads.filter((l) => l.source === k);
    const won = ls.filter((l) => l.stage === 'won').length;
    return { label, total: ls.length, won, rate: ls.length ? Math.round((won / ls.length) * 100) : 0, value: ls.reduce((a, l) => a + leadValue(l, pkgMap), 0) };
  }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total), [db.leads, pkgMap]);

  const byOwner = useMemo(() => db.users.map((u) => {
    const cs = db.customers.filter((c) => c.ownerId === u.id);
    const ls = db.leads.filter((l) => l.ownerId === u.id && !['won', 'lost'].includes(l.stage));
    return { name: u.name, customers: cs.length, mrr: Math.round(cs.reduce((a, c) => a + c.subscriptions.reduce((b, s) => b + monthlyValue(s), 0), 0)), pipeline: ls.reduce((a, l) => a + leadValue(l, pkgMap), 0),
      overdue: db.payments.filter((p) => isOverdue(p) && cs.some((c) => c.id === p.customerId)).reduce((a, p) => a + p.amount, 0) };
  }).filter((x) => x.customers + x.pipeline > 0).sort((a, b) => b.mrr - a.mrr), [db, pkgMap]);

  const totalMrr = byPackage.reduce((a, p) => a + p.mrr, 0);

  return (
    <>
      <PageHeader title="Raporlar" description="Gelir, müşteri dağılımı ve satış performansı."
        actions={<>
          <Segmented value={range} onChange={setRange} options={[{ value: '6', label: '6 ay' }, { value: '12', label: '12 ay' }, { value: '24', label: '24 ay' }]} />
          {can('export.data') && <button className="btn btn-secondary" onClick={() => downloadCSV('paket-raporu.csv', [['Paket', 'Abone', 'Aylık', 'Yıllık', 'MRR', 'Yıllık indirim'], ...byPackage.map((p) => [p.name, p.count, p.monthly, p.yearly, p.mrr, p.discount])])}><Download size={16} /> CSV</button>}
        </>} />

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card__head"><div><h3>Aylık Tahsilat</h3><div className="subtle">Son {n} ay · toplam {fmtMoney(monthly.reduce((a, m) => a + m.Tahsilat, 0))}</div></div></div>
          <div className="card__body" style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={monthly}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<Tip />} />
                <Area dataKey="Tahsilat" stroke="#2563eb" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><div><h3>Yeni Müşteri Kazanımı</h3><div className="subtle">Aylık yeni müşteri sayısı</div></div></div>
          <div className="card__body" style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} barSize={18}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                <Tooltip content={<Tip money={false} />} cursor={{ fill: 'rgba(100,116,139,.08)' }} />
                <Bar dataKey="Yeni müşteri" fill="#0891b2" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card__head"><div><h3>İş Kalemi (Paket) Performansı</h3><div className="subtle">Toplam MRR {fmtMoney(totalMrr)}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Paket</th><th className="right">Abone</th><th className="right">Aylık / Yıllık</th><th className="right">MRR</th><th style={{ width: '22%' }}>Pay</th><th className="right">Verilen yıllık indirim</th></tr></thead>
            <tbody>{byPackage.map((p) => (
              <tr key={p.name}>
                <td><span className="row"><span className="dot" style={{ background: p.color }} /><span className="strong">{p.name}</span></span></td>
                <td className="right num">{p.count}</td>
                <td className="right num">{p.monthly} / {p.yearly}</td>
                <td className="right num strong">{fmtMoney(p.mrr)}</td>
                <td><div className="row"><div className="progress" style={{ flex: 1 }}><span style={{ width: `${totalMrr ? (p.mrr / totalMrr) * 100 : 0}%`, background: p.color }} /></div><span className="subtle num" style={{ width: 36 }}>%{totalMrr ? Math.round((p.mrr / totalMrr) * 100) : 0}</span></div></td>
                <td className="right num text-success">{fmtMoney(p.discount)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <BreakdownCard title="Şehirlere Göre" rows={byCity} />
        <BreakdownCard title="Sektörlere Göre" rows={bySector} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card__head"><h3>Aday Kaynak Performansı</h3></div>
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>Kaynak</th><th className="right">Aday</th><th className="right">Kazanılan</th><th className="right">Dönüşüm</th><th className="right">Huni Değeri</th></tr></thead>
              <tbody>{bySource.map((s) => <tr key={s.label}><td className="strong">{s.label}</td><td className="right num">{s.total}</td><td className="right num">{s.won}</td><td className="right num">%{s.rate}</td><td className="right num">{fmtMoney(s.value)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h3>Temsilci Performansı</h3></div>
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>Temsilci</th><th className="right">Müşteri</th><th className="right">MRR</th><th className="right">Açık huni</th><th className="right">Geciken</th></tr></thead>
              <tbody>{byOwner.map((o) => <tr key={o.name}><td className="strong nowrap">{o.name}</td><td className="right num">{o.customers}</td><td className="right num">{fmtMoney(o.mrr)}</td><td className="right num">{fmtMoney(o.pipeline)}</td><td className="right num text-danger">{o.overdue ? fmtMoney(o.overdue) : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { name: string; count: number; mrr: number }[] }) {
  const max = Math.max(...rows.map((r) => r.mrr), 1);
  return (
    <div className="card">
      <div className="card__head"><h3>{title}</h3><span className="subtle">Müşteri · MRR</span></div>
      <div className="card__body stack" style={{ gap: 12, maxHeight: 360, overflowY: 'auto' }}>
        {rows.map((r) => (
          <div key={r.name}>
            <div className="row-between" style={{ fontSize: 13, marginBottom: 5 }}>
              <span>{r.name} <span className="subtle">({r.count})</span></span><span className="num strong">{fmtMoney(r.mrr)}</span>
            </div>
            <div className="progress"><span style={{ width: `${(r.mrr / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
