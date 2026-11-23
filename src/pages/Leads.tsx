import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Columns3, Download, List, Plus, Search, Target } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { CITIES, LEAD_SOURCES, LEAD_STAGES, STAGE_MAP } from '@/lib/constants';
import { useQueryFilters } from '@/lib/hooks';
import { applyDiscount, cx, downloadCSV, fmtDate, fmtMoney, listPriceFor, matches } from '@/lib/utils';
import type { Lead, LeadStage, ServicePackage } from '@/data/types';
import { Avatar, Badge, EmptyState, PackagePill, PageHeader, Pagination, Segmented, SortTh, usePagination, useSort, useToast } from '@/components/ui';

/** Adayın tahmini yıllık değeri */
export const leadValue = (l: Lead, pkgMap: Map<string, ServicePackage>) =>
  l.interests.reduce((a, i) => {
    const net = applyDiscount(listPriceFor(pkgMap.get(i.packageId), i.billingCycle), i.discountType, i.discountValue);
    return a + (i.billingCycle === 'monthly' ? net * 12 : net);
  }, 0);

const KEYS = ['q', 'pkg', 'city', 'stage', 'source', 'owner', 'from', 'to', 'view'] as const;

export default function Leads() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const toast = useToast();
  const leads = useDb((d) => d.leads);
  const packages = useDb((d) => d.packages);
  const users = useDb((d) => d.users);
  const pkgMap = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const { values: f, set } = useQueryFilters(KEYS);
  const view = (f.view || 'board') as 'board' | 'list';
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  const filtered = useMemo(() => leads.filter((l) =>
    matches(f.q, l.companyName, l.contactName, l.email, l.phone) &&
    (!f.pkg || l.interests.some((i) => i.packageId === f.pkg)) &&
    (!f.city || l.city === f.city) && (!f.stage || l.stage === f.stage) &&
    (!f.source || l.source === f.source) && (!f.owner || l.ownerId === f.owner) &&
    (!f.from || l.createdAt.slice(0, 10) >= f.from) && (!f.to || l.createdAt.slice(0, 10) <= f.to),
  ), [leads, f.q, f.pkg, f.city, f.stage, f.source, f.owner, f.from, f.to]);

  const { sorted, sort, toggle } = useSort(filtered, { key: 'created', dir: 'desc' }, {
    name: (l) => l.companyName, city: (l) => l.city, value: (l) => leadValue(l, pkgMap), created: (l) => l.createdAt,
    close: (l) => l.expectedCloseDate ?? '', stage: (l) => LEAD_STAGES.findIndex((s) => s.key === l.stage),
  });
  const pg = usePagination(sorted, 12);
  const openPipeline = filtered.filter((l) => !['won', 'lost'].includes(l.stage));
  const weighted = openPipeline.reduce((a, l) => a + leadValue(l, pkgMap) * (l.probability / 100), 0);

  const drop = (stage: LeadStage) => {
    if (!dragId || !can('leads.edit')) return;
    const l = leads.find((x) => x.id === dragId);
    if (l && l.stage !== stage) {
      actions.moveLead(dragId, stage, STAGE_MAP[stage].probability);
      toast(`${l.companyName} → ${STAGE_MAP[stage].label}`);
    }
    setDragId(null); setOverStage(null);
  };

  const exportCsv = () => downloadCSV('potansiyel-musteriler.csv', [
    ['Firma', 'Yetkili', 'E-posta', 'Telefon', 'Şehir', 'Sektör', 'Kaynak', 'Aşama', 'Olasılık %', 'İlgilenilen Paketler', 'Tahmini Yıllık Değer', 'Tahmini Kapanış', 'Temsilci'],
    ...sorted.map((l) => [l.companyName, l.contactName, l.email, l.phone, l.city, l.sector, LEAD_SOURCES[l.source], STAGE_MAP[l.stage].label, l.probability,
      l.interests.map((i) => pkgMap.get(i.packageId)?.name).join(' | '), Math.round(leadValue(l, pkgMap)), l.expectedCloseDate ?? '', userMap.get(l.ownerId)?.name ?? '']),
  ]);

  return (
    <>
      <PageHeader title="Potansiyel Müşteriler"
        description={`${openPipeline.length} açık fırsat · Toplam huni ${fmtMoney(openPipeline.reduce((a, l) => a + leadValue(l, pkgMap), 0))} · Ağırlıklı ${fmtMoney(weighted)}`}
        actions={<>
          <Segmented value={view} onChange={(v) => set('view', v === 'board' ? '' : v)} options={[
            { value: 'board', label: <><Columns3 size={14} /> Pano</> }, { value: 'list', label: <><List size={14} /> Liste</> },
          ]} />
          {can('export.data') && <button className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>}
          {can('leads.create') && <Link to="/leads/new" className="btn btn-primary"><Plus size={16} /> Yeni Aday</Link>}
        </>}
      />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="filters" style={{ borderBottom: 0 }}>
          <div className="filters__search"><Search size={15} />
            <input className="input" placeholder="Firma, yetkili, e-posta…" value={f.q} onChange={(e) => set('q', e.target.value)} />
          </div>
          <select className="select" value={f.pkg} onChange={(e) => set('pkg', e.target.value)}>
            <option value="">Tüm iş kalemleri</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Tüm şehirler</option>{CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {view === 'list' && (
            <select className="select" value={f.stage} onChange={(e) => set('stage', e.target.value)}>
              <option value="">Tüm aşamalar</option>{LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          )}
          <select className="select" value={f.source} onChange={(e) => set('source', e.target.value)}>
            <option value="">Tüm kaynaklar</option>{Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="select" value={f.owner} onChange={(e) => set('owner', e.target.value)}>
            <option value="">Tüm temsilciler</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="date-range" title="Kayıt tarihi aralığı">
            <input type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} />
            <span className="subtle">–</span>
            <input type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} />
          </div>
        </div>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {LEAD_STAGES.map((s) => {
            const items = filtered.filter((l) => l.stage === s.key);
            return (
              <div key={s.key} className={cx('kanban__col', overStage === s.key && 'over')}
                onDragOver={(e) => { e.preventDefault(); setOverStage(s.key); }} onDragLeave={() => setOverStage(null)} onDrop={() => drop(s.key)}>
                <div className="kanban__head">
                  <span className="kanban__title"><Badge tone={s.tone} dot>{s.label}</Badge></span>
                  <span className="subtle">{items.length}</span>
                </div>
                <div className="kanban__sum">{fmtMoney(items.reduce((a, l) => a + leadValue(l, pkgMap), 0))} / yıl</div>
                <div className="kanban__list">
                  {items.map((l) => {
                    const owner = userMap.get(l.ownerId);
                    return (
                      <div key={l.id} className={cx('kcard', dragId === l.id && 'dragging')} draggable={can('leads.edit')}
                        onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOverStage(null); }}
                        onClick={() => navigate(`/leads/${l.id}`)}>
                        <div className="kcard__title">{l.companyName}</div>
                        <div className="subtle">{l.contactName} · {l.city}</div>
                        <div className="row wrap gap-sm" style={{ marginTop: 8 }}>
                          {l.interests.map((i) => <PackagePill key={i.packageId} pkg={pkgMap.get(i.packageId)} />)}
                        </div>
                        <div className="kcard__meta">
                          <span className="strong num" style={{ color: 'var(--text)' }}>{fmtMoney(leadValue(l, pkgMap))}</span>
                          {owner && <Avatar name={owner.name} size="sm" />}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <div className="subtle" style={{ textAlign: 'center', padding: 20 }}>Kart yok</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          {filtered.length === 0 ? <EmptyState icon={<Target size={24} />} title="Aday bulunamadı" /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <SortTh k="name" sort={sort} toggle={toggle}>Firma</SortTh>
                    <SortTh k="city" sort={sort} toggle={toggle}>Şehir</SortTh>
                    <th>İlgilendiği Paketler</th>
                    <SortTh k="stage" sort={sort} toggle={toggle}>Aşama</SortTh>
                    <th>Kaynak</th>
                    <SortTh k="value" sort={sort} toggle={toggle} className="right">Tahmini Değer</SortTh>
                    <SortTh k="close" sort={sort} toggle={toggle}>Tahmini Kapanış</SortTh>
                    <th>Temsilci</th>
                  </tr></thead>
                  <tbody>
                    {pg.slice.map((l) => (
                      <tr key={l.id} className="clickable" onClick={() => navigate(`/leads/${l.id}`)}>
                        <td><div className="company-cell"><Avatar name={l.companyName} /><div><div className="company-cell__name">{l.companyName}</div><div className="company-cell__sub">{l.contactName} · {l.sector}</div></div></div></td>
                        <td>{l.city}</td>
                        <td><div className="row wrap gap-sm">{l.interests.map((i) => <PackagePill key={i.packageId} pkg={pkgMap.get(i.packageId)} />)}</div></td>
                        <td><Badge tone={STAGE_MAP[l.stage].tone} dot>{STAGE_MAP[l.stage].label}</Badge></td>
                        <td className="muted">{LEAD_SOURCES[l.source]}</td>
                        <td className="right num strong">{fmtMoney(leadValue(l, pkgMap))}<div className="subtle">%{l.probability}</div></td>
                        <td className="num nowrap">{fmtDate(l.expectedCloseDate)}</td>
                        <td>{userMap.get(l.ownerId) && <Avatar name={userMap.get(l.ownerId)!.name} size="sm" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pg} />
            </>
          )}
        </div>
      )}
    </>
  );
}
