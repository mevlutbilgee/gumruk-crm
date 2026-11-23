import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Download, Filter, Plus, Search, X } from 'lucide-react';
import { useDb, usePermissions } from '@/data/store';
import { CITIES, CUSTOMER_STATUS, CYCLE_LABELS } from '@/lib/constants';
import { useQueryFilters } from '@/lib/hooks';
import { downloadCSV, fmtDate, fmtMoney, matches, monthlyValue, subscriptionNet } from '@/lib/utils';
import type { Customer } from '@/data/types';
import { Avatar, Badge, EmptyState, PackagePill, PageHeader, Pagination, SortTh, usePagination, useSort } from '@/components/ui';

const FILTER_KEYS = ['q', 'pkg', 'city', 'status', 'cycle', 'owner', 'from', 'to'] as const;

export default function Customers() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const customers = useDb((d) => d.customers);
  const packages = useDb((d) => d.packages);
  const users = useDb((d) => d.users);
  const pkgMap = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const { values: f, set, clear, activeCount } = useQueryFilters(FILTER_KEYS);

  const filtered = useMemo(() => customers.filter((c) =>
    matches(f.q, c.companyName, c.contactName, c.email, c.taxNumber, c.phone) &&
    (!f.pkg || c.subscriptions.some((s) => s.packageId === f.pkg && s.active)) &&
    (!f.city || c.city === f.city) &&
    (!f.status || c.status === f.status) &&
    (!f.cycle || c.subscriptions.some((s) => s.billingCycle === f.cycle && s.active)) &&
    (!f.owner || c.ownerId === f.owner) &&
    (!f.from || c.startDate >= f.from) &&
    (!f.to || c.startDate <= f.to),
  ), [customers, f.q, f.pkg, f.city, f.status, f.cycle, f.owner, f.from, f.to]);

  const mrr = (c: Customer) => c.subscriptions.reduce((a, s) => a + monthlyValue(s), 0);
  const { sorted, sort, toggle } = useSort(filtered, { key: 'created', dir: 'desc' }, {
    name: (c) => c.companyName, city: (c) => c.city, start: (c) => c.startDate, mrr, created: (c) => c.createdAt,
  });
  const pg = usePagination(sorted, 12);
  const totalMrr = filtered.reduce((a, c) => a + mrr(c), 0);
  const usedCities = useMemo(() => [...new Set([...customers.map((c) => c.city), ...CITIES])].sort((a, b) => a.localeCompare(b, 'tr')), [customers]);

  const exportCsv = () => downloadCSV(`musteriler-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Firma', 'Vergi No', 'Vergi Dairesi', 'Sektör', 'Yetkili', 'E-posta', 'Telefon', 'Şehir', 'Başlangıç', 'Durum', 'Paketler', 'Aylık Değer (TL)', 'Temsilci'],
    ...sorted.map((c) => [
      c.companyName, c.taxNumber, c.taxOffice, c.sector, c.contactName, c.email, c.phone, c.city, c.startDate,
      CUSTOMER_STATUS[c.status].label,
      c.subscriptions.map((s) => `${pkgMap.get(s.packageId)?.name} (${CYCLE_LABELS[s.billingCycle]}, ${subscriptionNet(s)} TL)`).join(' | '),
      Math.round(mrr(c)), userMap.get(c.ownerId)?.name ?? '',
    ]),
  ]);

  const chips: { k: (typeof FILTER_KEYS)[number]; label: string }[] = [];
  if (f.pkg) chips.push({ k: 'pkg', label: `Paket: ${pkgMap.get(f.pkg)?.name}` });
  if (f.city) chips.push({ k: 'city', label: `Şehir: ${f.city}` });
  if (f.status) chips.push({ k: 'status', label: `Durum: ${CUSTOMER_STATUS[f.status as Customer['status']]?.label}` });
  if (f.cycle) chips.push({ k: 'cycle', label: `Periyot: ${CYCLE_LABELS[f.cycle as 'monthly']}` });
  if (f.owner) chips.push({ k: 'owner', label: `Temsilci: ${userMap.get(f.owner)?.name}` });
  if (f.from) chips.push({ k: 'from', label: `Başlangıç ≥ ${fmtDate(f.from)}` });
  if (f.to) chips.push({ k: 'to', label: `Başlangıç ≤ ${fmtDate(f.to)}` });

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description={`${customers.length} kayıtlı müşteri · filtrelenen ${filtered.length} müşterinin aylık değeri ${fmtMoney(totalMrr)}`}
        actions={<>
          {can('export.data') && <button className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>}
          {can('customers.create') && <Link to="/customers/new" className="btn btn-primary"><Plus size={16} /> Yeni Müşteri</Link>}
        </>}
      />
      <div className="card">
        <div className="filters">
          <div className="filters__search">
            <Search size={15} />
            <input className="input" placeholder="Firma, yetkili, vergi no, telefon…" value={f.q} onChange={(e) => set('q', e.target.value)} />
          </div>
          <select className="select" value={f.pkg} onChange={(e) => set('pkg', e.target.value)}>
            <option value="">Tüm iş kalemleri</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Tüm şehirler</option>
            {usedCities.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)} style={{ minWidth: 120 }}>
            <option value="">Tüm durumlar</option>
            {Object.entries(CUSTOMER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="select" value={f.cycle} onChange={(e) => set('cycle', e.target.value)} style={{ minWidth: 120 }}>
            <option value="">Aylık + Yıllık</option>
            <option value="monthly">Aylık</option>
            <option value="yearly">Yıllık</option>
          </select>
          <select className="select" value={f.owner} onChange={(e) => set('owner', e.target.value)}>
            <option value="">Tüm temsilciler</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="date-range" title="Başlangıç tarihi aralığı">
            <input type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="Başlangıç (en erken)" />
            <span className="subtle">–</span>
            <input type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="Başlangıç (en geç)" />
          </div>
        </div>
        {chips.length > 0 && (
          <div className="filters__active">
            <Filter size={14} className="muted" />
            {chips.map((c) => (
              <span key={c.k} className="filter-chip">{c.label}<button onClick={() => set(c.k, '')} aria-label="Kaldır"><X size={12} /></button></span>
            ))}
            {activeCount > 1 && <button className="btn btn-ghost btn-sm" onClick={clear}>Tümünü temizle</button>}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 size={24} />} title="Müşteri bulunamadı" text="Filtreleri değiştirerek tekrar deneyin."
            action={activeCount > 0 ? <button className="btn btn-secondary" onClick={clear}>Filtreleri temizle</button> : undefined} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh k="name" sort={sort} toggle={toggle}>Firma</SortTh>
                    <SortTh k="city" sort={sort} toggle={toggle}>Şehir</SortTh>
                    <th>Hizmet Paketleri</th>
                    <SortTh k="start" sort={sort} toggle={toggle}>Başlangıç</SortTh>
                    <SortTh k="mrr" sort={sort} toggle={toggle} className="right">Aylık Değer</SortTh>
                    <th>Durum</th>
                    <th>Temsilci</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.slice.map((c) => {
                    const owner = userMap.get(c.ownerId);
                    return (
                      <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                        <td>
                          <div className="company-cell">
                            <Avatar name={c.companyName} />
                            <div style={{ minWidth: 0 }}>
                              <div className="company-cell__name">{c.companyName}</div>
                              <div className="company-cell__sub">{c.contactName} · {c.sector}</div>
                            </div>
                          </div>
                        </td>
                        <td className="nowrap">{c.city}</td>
                        <td>
                          <div className="row wrap gap-sm">
                            {c.subscriptions.filter((s) => s.active).map((s) => (
                              <PackagePill key={s.id} pkg={pkgMap.get(s.packageId)} suffix={s.billingCycle === 'monthly' ? 'Aylık' : 'Yıllık'} />
                            ))}
                            {c.subscriptions.every((s) => !s.active) && <span className="subtle">—</span>}
                          </div>
                        </td>
                        <td className="nowrap num">{fmtDate(c.startDate)}</td>
                        <td className="right num strong">{fmtMoney(mrr(c))}</td>
                        <td><Badge tone={CUSTOMER_STATUS[c.status].tone} dot>{CUSTOMER_STATUS[c.status].label}</Badge></td>
                        <td>{owner && <div className="row gap-sm"><Avatar name={owner.name} size="sm" /><span className="nowrap" style={{ fontSize: 13 }}>{owner.name}</span></div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} />
          </>
        )}
      </div>
    </>
  );
}
