import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Globe, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { CUSTOMER_STATUS, CYCLE_LABELS } from '@/lib/constants';
import { cx, fmtDate, fmtMoney, isOverdue, monthlyValue, subscriptionNet } from '@/lib/utils';
import { Avatar, Badge, EmptyState, PageHeader, useConfirm, useToast } from '@/components/ui';
import PaymentsTable from '@/components/PaymentsTable';
import ActivityFeed from '@/components/ActivityFeed';
import TaskList from '@/components/TaskList';

type Tab = 'overview' | 'payments' | 'activity' | 'tasks';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();
  const c = useDb((d) => d.customers.find((x) => x.id === id));
  const allPayments = useDb((d) => d.payments);
  const allTasks = useDb((d) => d.tasks);
  const packages = useDb((d) => d.packages);
  const users = useDb((d) => d.users);
  const activityCount = useDb((d) => d.activities.filter((a) => a.entityType === 'customer' && a.entityId === id).length);
  const [tab, setTab] = useState<Tab>('overview');

  const payments = useMemo(() => allPayments.filter((p) => p.customerId === id).sort((a, b) => b.dueDate.localeCompare(a.dueDate)), [allPayments, id]);
  const tasks = useMemo(() => allTasks.filter((t) => t.relatedType === 'customer' && t.relatedId === id), [allTasks, id]);

  if (!c) return <div className="card"><EmptyState title="Müşteri bulunamadı" action={<Link to="/customers" className="btn btn-secondary">Listeye dön</Link>} /></div>;

  const pkgMap = new Map(packages.map((p) => [p.id, p]));
  const owner = users.find((u) => u.id === c.ownerId);
  const mrr = c.subscriptions.reduce((a, s) => a + monthlyValue(s), 0);
  const paid = payments.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0);
  const overdue = payments.filter(isOverdue);
  const next = [...payments].filter((p) => p.status === 'pending' && !isOverdue(p)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const remove = async () => {
    if (await confirm({ title: 'Müşteri silinsin mi?', message: <>“{c.companyName}” ile birlikte tüm ödeme, aktivite ve görev kayıtları kalıcı olarak silinecek.</>, confirmText: 'Sil', danger: true })) {
      actions.deleteCustomer(c.id);
      toast('Müşteri silindi.');
      navigate('/customers');
    }
  };

  return (
    <>
      <PageHeader crumbs={<><Link to="/customers">Müşteriler</Link> / <span>{c.companyName}</span></>} title="" />
      <div className="card" style={{ marginTop: -18, marginBottom: 20 }}>
        <div className="profile">
          <Avatar name={c.companyName} size="lg" />
          <div className="profile__main">
            <div className="profile__name">{c.companyName} <Badge tone={CUSTOMER_STATUS[c.status].tone} dot>{CUSTOMER_STATUS[c.status].label}</Badge>
              {c.tags.map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
            <div className="profile__meta">
              <span><MapPin size={14} /> {c.city}{c.district ? ` / ${c.district}` : ''}</span>
              {c.email && <span><Mail size={14} /> <a href={`mailto:${c.email}`}>{c.email}</a></span>}
              {c.phone && <span><Phone size={14} /> <a href={`tel:${c.phone}`}>{c.phone}</a></span>}
              {c.website && <span><Globe size={14} /> {c.website}</span>}
            </div>
          </div>
          <div className="row">
            {can('customers.edit') && <Link to={`/customers/${c.id}/edit`} className="btn btn-secondary"><Pencil size={15} /> Düzenle</Link>}
            {can('customers.delete') && <button className="btn btn-danger-ghost" onClick={remove}><Trash2 size={15} /> Sil</button>}
          </div>
        </div>
        <div className="profile__stats">
          <div className="profile__stat"><div className="v">{fmtMoney(mrr)}</div><div className="l">Aylık değer (MRR)</div></div>
          <div className="profile__stat"><div className="v">{fmtMoney(mrr * 12)}</div><div className="l">Yıllık değer</div></div>
          <div className="profile__stat"><div className="v text-success">{fmtMoney(paid)}</div><div className="l">Toplam tahsilat</div></div>
          <div className="profile__stat"><div className={cx('v', overdue.length > 0 && 'text-danger')}>{fmtMoney(overdue.reduce((a, p) => a + p.amount, 0))}</div><div className="l">Geciken ({overdue.length})</div></div>
          <div className="profile__stat"><div className="v">{next ? fmtDate(next.dueDate) : '—'}</div><div className="l">Sonraki ödeme {next ? `· ${fmtMoney(next.amount)}` : ''}</div></div>
        </div>
      </div>

      <div className="tabs">
        {([['overview', 'Genel Bakış'], ['payments', 'Ödemeler', payments.length], ['activity', 'Aktiviteler', activityCount], ['tasks', 'Görevler', tasks.filter((t) => !t.done).length]] as const).map(([k, l, n]) => (
          <button key={k} className={cx('tab', tab === k && 'active')} onClick={() => setTab(k)}>{l}{n !== undefined && <span className="count">{n}</span>}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-main">
          <div className="card">
            <div className="card__head"><div><h3>Hizmet Paketleri</h3><div className="subtle">Müşteriye özel fiyat ve indirimler</div></div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Paket</th><th>Periyot</th><th>Başlangıç</th><th className="right">Liste</th><th className="right">İndirim</th><th className="right">Net</th><th>Durum</th></tr></thead>
                <tbody>
                  {c.subscriptions.map((s) => {
                    const p = pkgMap.get(s.packageId);
                    const net = subscriptionNet(s);
                    return (
                      <tr key={s.id}>
                        <td><div className="row"><span className="dot" style={{ background: p?.color }} /><span className="strong">{p?.name}</span></div></td>
                        <td>{CYCLE_LABELS[s.billingCycle]}</td>
                        <td className="num nowrap">{fmtDate(s.startDate)}</td>
                        <td className="right num">{fmtMoney(s.listPrice)}</td>
                        <td className="right num text-success">{s.discountValue > 0 ? (s.discountType === 'percent' ? `%${s.discountValue}` : `−${fmtMoney(s.discountValue)}`) : '—'}</td>
                        <td className="right num strong">{fmtMoney(net)}</td>
                        <td>{s.active ? <Badge tone="success">Aktif</Badge> : <Badge>Sonlandı {s.endDate ? fmtDate(s.endDate) : ''}</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="stack">
            <div className="card">
              <div className="card__head"><h3>Firma Bilgileri</h3></div>
              <div className="card__body">
                <dl className="dl">
                  <dt>Yetkili</dt><dd>{c.contactName}{c.contactTitle ? <div className="subtle">{c.contactTitle}</div> : null}</dd>
                  <dt>Sektör</dt><dd>{c.sector}</dd>
                  <dt>Vergi no</dt><dd className="num">{c.taxNumber || '—'}</dd>
                  <dt>Vergi dairesi</dt><dd>{c.taxOffice || '—'}</dd>
                  <dt>Adres</dt><dd>{c.address || '—'}</dd>
                  <dt>Müşteri tarihi</dt><dd>{fmtDate(c.startDate)}</dd>
                  <dt>Temsilci</dt><dd>{owner ? <div className="row gap-sm"><Avatar name={owner.name} size="sm" />{owner.name}</div> : '—'}</dd>
                </dl>
              </div>
            </div>
            {c.notes && <div className="card"><div className="card__head"><h3>Notlar</h3></div><div className="card__body" style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div></div>}
          </div>
        </div>
      )}
      {tab === 'payments' && <div className="card"><PaymentsTable rows={payments} showCustomer={false} /></div>}
      {tab === 'activity' && <ActivityFeed entityType="customer" entityId={c.id} canEdit={can('customers.edit')} />}
      {tab === 'tasks' && <div className="card"><TaskList tasks={tasks} relatedType="customer" relatedId={c.id} /></div>}
    </>
  );
}
