import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightLeft, Calendar, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { CYCLE_LABELS, LEAD_SOURCES, LEAD_STAGES, STAGE_MAP } from '@/lib/constants';
import { applyDiscount, cx, fmtDate, fmtMoney, listPriceFor } from '@/lib/utils';
import { Avatar, Badge, EmptyState, PageHeader, useConfirm, useToast } from '@/components/ui';
import ActivityFeed from '@/components/ActivityFeed';
import TaskList from '@/components/TaskList';
import { leadValue } from './Leads';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();
  const l = useDb((d) => d.leads.find((x) => x.id === id));
  const packages = useDb((d) => d.packages);
  const users = useDb((d) => d.users);
  const allTasks = useDb((d) => d.tasks);
  const tasks = useMemo(() => allTasks.filter((t) => t.relatedType === 'lead' && t.relatedId === id), [allTasks, id]);
  const [tab, setTab] = useState<'activity' | 'tasks'>('activity');

  if (!l) return <div className="card"><EmptyState title="Aday bulunamadı" action={<Link to="/leads" className="btn btn-secondary">Listeye dön</Link>} /></div>;
  const pkgMap = new Map(packages.map((p) => [p.id, p]));
  const owner = users.find((u) => u.id === l.ownerId);
  const stage = STAGE_MAP[l.stage];
  const canEdit = can('leads.edit');

  const convert = async () => {
    if (!(await confirm({ title: 'Müşteriye dönüştür', message: <>“{l.companyName}” müşteri olarak kaydedilecek ve {l.interests.length} paket için ödeme planı oluşturulacak. Vergi bilgilerini müşteri kartından tamamlayabilirsiniz.</>, confirmText: 'Dönüştür' }))) return;
    const c = actions.convertLead(l.id);
    if (c) { toast('Aday müşteriye dönüştürüldü.'); navigate(`/customers/${c.id}/edit`); }
  };
  const remove = async () => {
    if (await confirm({ title: 'Aday silinsin mi?', message: `“${l.companyName}” kalıcı olarak silinecek.`, confirmText: 'Sil', danger: true })) {
      actions.deleteLead(l.id); toast('Aday silindi.'); navigate('/leads');
    }
  };

  const activeStages = LEAD_STAGES.filter((s) => s.key !== 'lost');
  const idx = activeStages.findIndex((s) => s.key === l.stage);

  return (
    <>
      <PageHeader crumbs={<><Link to="/leads">Potansiyel Müşteriler</Link> / <span>{l.companyName}</span></>} title="" />
      <div className="card" style={{ marginTop: -18, marginBottom: 20 }}>
        <div className="profile">
          <Avatar name={l.companyName} size="lg" />
          <div className="profile__main">
            <div className="profile__name">{l.companyName} <Badge tone={stage.tone} dot>{stage.label}</Badge>{l.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
            <div className="profile__meta">
              <span><MapPin size={14} /> {l.city}</span>
              {l.email && <span><Mail size={14} /> <a href={`mailto:${l.email}`}>{l.email}</a></span>}
              {l.phone && <span><Phone size={14} /> {l.phone}</span>}
              <span><Calendar size={14} /> Kayıt: {fmtDate(l.createdAt)}</span>
            </div>
          </div>
          <div className="row wrap">
            {l.convertedCustomerId ? (
              <Link to={`/customers/${l.convertedCustomerId}`} className="btn btn-secondary">Müşteri kartına git</Link>
            ) : can('customers.create') && l.stage !== 'lost' && (
              <button className="btn btn-success" onClick={convert}><ArrowRightLeft size={15} /> Müşteriye dönüştür</button>
            )}
            {canEdit && <Link to={`/leads/${l.id}/edit`} className="btn btn-secondary"><Pencil size={15} /> Düzenle</Link>}
            {can('leads.delete') && <button className="btn btn-danger-ghost" onClick={remove}><Trash2 size={15} /></button>}
          </div>
        </div>
        {/* Aşama ilerlemesi */}
        <div style={{ padding: '0 22px 20px' }}>
          <div className="row" style={{ gap: 4 }}>
            {activeStages.map((s, i) => (
              <button key={s.key} disabled={!canEdit || !!l.convertedCustomerId}
                onClick={() => { actions.moveLead(l.id, s.key, s.probability); toast(`Aşama: ${s.label}`); }}
                style={{
                  flex: 1, height: 34, border: 0, cursor: canEdit ? 'pointer' : 'default', fontSize: 12, fontWeight: 600,
                  borderRadius: i === 0 ? '8px 0 0 8px' : i === activeStages.length - 1 ? '0 8px 8px 0' : 0,
                  background: l.stage !== 'lost' && i <= idx ? 'var(--primary)' : 'var(--surface-3)',
                  color: l.stage !== 'lost' && i <= idx ? '#fff' : 'var(--text-2)',
                }}>{s.label}</button>
            ))}
            {canEdit && l.stage !== 'lost' && !l.convertedCustomerId && (
              <button className="btn btn-danger-ghost btn-sm" onClick={() => navigate(`/leads/${l.id}/edit`)}>Kaybedildi</button>
            )}
          </div>
          {l.stage === 'lost' && <div className="callout tone-danger" style={{ marginTop: 10 }}>Kaybedildi · Neden: {l.lostReason ?? '—'}</div>}
        </div>
        <div className="profile__stats">
          <div className="profile__stat"><div className="v">{fmtMoney(leadValue(l, pkgMap))}</div><div className="l">Tahmini yıllık değer</div></div>
          <div className="profile__stat"><div className="v">%{l.probability}</div><div className="l">Kazanma olasılığı</div></div>
          <div className="profile__stat"><div className="v">{fmtMoney(leadValue(l, pkgMap) * l.probability / 100)}</div><div className="l">Ağırlıklı değer</div></div>
          <div className="profile__stat"><div className="v">{fmtDate(l.expectedCloseDate)}</div><div className="l">Tahmini kapanış</div></div>
        </div>
      </div>

      <div className="grid grid-main">
        <div>
          <div className="tabs">
            <button className={cx('tab', tab === 'activity' && 'active')} onClick={() => setTab('activity')}>Aktiviteler</button>
            <button className={cx('tab', tab === 'tasks' && 'active')} onClick={() => setTab('tasks')}>Görevler <span className="count">{tasks.filter((t) => !t.done).length}</span></button>
          </div>
          {tab === 'activity' ? <ActivityFeed entityType="lead" entityId={l.id} canEdit={canEdit} /> : <div className="card"><TaskList tasks={tasks} relatedType="lead" relatedId={l.id} /></div>}
        </div>
        <div className="stack">
          <div className="card">
            <div className="card__head"><h3>Teklif Edilen Paketler</h3></div>
            {l.interests.length === 0 ? <EmptyState title="Paket seçilmedi" /> : l.interests.map((i) => {
              const p = pkgMap.get(i.packageId);
              const list = listPriceFor(p, i.billingCycle);
              const net = applyDiscount(list, i.discountType, i.discountValue);
              return (
                <div className="list-item" key={i.packageId}>
                  <span className="dot" style={{ background: p?.color, width: 10, height: 10 }} />
                  <div className="list-item__main"><div className="list-item__title">{p?.name}</div><div className="list-item__sub">{CYCLE_LABELS[i.billingCycle]}{i.discountValue ? ` · ${i.discountType === 'percent' ? `%${i.discountValue}` : fmtMoney(i.discountValue)} indirim` : ''}</div></div>
                  <div className="right"><div className="strong num">{fmtMoney(net)}</div>{net !== list && <div className="subtle" style={{ textDecoration: 'line-through' }}>{fmtMoney(list)}</div>}</div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <div className="card__head"><h3>Detaylar</h3></div>
            <div className="card__body">
              <dl className="dl">
                <dt>Yetkili</dt><dd>{l.contactName}{l.contactTitle && <div className="subtle">{l.contactTitle}</div>}</dd>
                <dt>Sektör</dt><dd>{l.sector}</dd>
                <dt>Kaynak</dt><dd>{LEAD_SOURCES[l.source]}</dd>
                <dt>Temsilci</dt><dd>{owner?.name ?? '—'}</dd>
                <dt>Son güncelleme</dt><dd>{fmtDate(l.updatedAt)}</dd>
                {l.notes && <><dt>Notlar</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{l.notes}</dd></>}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
