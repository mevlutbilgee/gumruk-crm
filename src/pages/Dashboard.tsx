import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, Target, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDb, usePermissions } from '@/data/store';
import { ACTIVITY_LABELS, LEAD_STAGES } from '@/lib/constants';
import { addDays, addMonths, fmtCompact, fmtDate, fmtMoney, isOverdue, monthlyValue, relativeDays, timeAgo, today } from '@/lib/utils';
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from '@/components/ui';
import TaskList from '@/components/TaskList';
import { leadValue } from './Leads';

const monthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short' });

export default function Dashboard() {
  const { user, can } = usePermissions();
  const db = useDb((d) => d);
  const T = today();
  const pkgMap = useMemo(() => new Map(db.packages.map((p) => [p.id, p])), [db.packages]);
  const custMap = useMemo(() => new Map(db.customers.map((c) => [c.id, c])), [db.customers]);

  const k = useMemo(() => {
    const active = db.customers.filter((c) => c.status === 'active');
    const mrr = db.customers.reduce((a, c) => a + c.subscriptions.reduce((b, s) => b + monthlyValue(s), 0), 0);
    const newThisMonth = db.customers.filter((c) => c.startDate.slice(0, 7) === T.slice(0, 7)).length;
    const open = db.leads.filter((l) => !['won', 'lost'].includes(l.stage));
    const weighted = open.reduce((a, l) => a + leadValue(l, pkgMap) * l.probability / 100, 0);
    const overdue = db.payments.filter(isOverdue);
    const closed = db.leads.filter((l) => ['won', 'lost'].includes(l.stage));
    const winRate = closed.length ? Math.round((closed.filter((l) => l.stage === 'won').length / closed.length) * 100) : 0;
    return { active, mrr, newThisMonth, open, weighted, overdue, winRate };
  }, [db, T, pkgMap]);

  const cashflow = useMemo(() => {
    const out: { m: string; tahsil: number; beklenen: number; geciken: number }[] = [];
    for (let i = -5; i <= 3; i++) {
      const key = addMonths(T.slice(0, 8) + '01', i).slice(0, 7);
      const ps = db.payments.filter((p) => p.dueDate.slice(0, 7) === key);
      out.push({
        m: monthShort.format(new Date(key + '-01T00:00:00')),
        tahsil: ps.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0),
        beklenen: ps.filter((p) => p.status === 'pending' && p.dueDate >= T).reduce((a, p) => a + p.amount, 0),
        geciken: ps.filter(isOverdue).reduce((a, p) => a + p.amount, 0),
      });
    }
    return out;
  }, [db.payments, T]);

  const byPackage = useMemo(() => db.packages.map((p) => ({
    name: p.name, code: p.code, color: p.color,
    value: Math.round(db.customers.reduce((a, c) => a + c.subscriptions.filter((s) => s.packageId === p.id).reduce((b, s) => b + monthlyValue(s), 0), 0)),
  })).filter((x) => x.value > 0), [db.packages, db.customers]);

  const upcoming = db.payments.filter((p) => p.status === 'pending' && p.dueDate >= T && p.dueDate <= addDays(T, db.notification.daysAhead))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 7);
  const myTasks = db.tasks.filter((t) => t.assigneeId === user?.id && !t.done);
  const recent = [...db.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <>
      <PageHeader title={`${greet}, ${user?.name.split(' ')[0]} 👋`} description={`${fmtDate(T)} · İşletmenizin güncel durumu`}
        actions={can('customers.create') && <Link to="/customers/new" className="btn btn-primary">Yeni Müşteri</Link>} />

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Aktif müşteri" value={k.active.length} icon={<Building2 size={18} />} tone="primary"
          meta={<><span className="trend-up">+{k.newThisMonth}</span> bu ay · toplam {db.customers.length}</>} />
        <StatCard label="Aylık tekrarlayan gelir" value={fmtMoney(k.mrr)} icon={<TrendingUp size={18} />} tone="success" meta={`Yıllık ${fmtMoney(k.mrr * 12)}`} />
        <StatCard label="Açık fırsatlar (ağırlıklı)" value={fmtMoney(k.weighted)} icon={<Target size={18} />} tone="purple" meta={`${k.open.length} aday · kazanma oranı %${k.winRate}`} />
        <StatCard label="Gecikmiş alacak" value={fmtMoney(k.overdue.reduce((a, p) => a + p.amount, 0))} icon={<AlertTriangle size={18} />} tone="danger"
          meta={<Link to="/payments?status=overdue">{k.overdue.length} ödeme · detay →</Link>} />
      </div>

      <div className="grid grid-main" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card__head">
            <div><h3>Nakit Akışı</h3><div className="subtle">Son 6 ay tahsilat ve önümüzdeki 3 ay beklenen</div></div>
            <div className="legend"><span><i className="dot" style={{ background: '#16a34a' }} />Tahsil</span><span><i className="dot" style={{ background: '#93c5fd' }} />Beklenen</span><span><i className="dot" style={{ background: '#f87171' }} />Geciken</span></div>
          </div>
          <div className="card__body" style={{ height: 290 }}>
            <ResponsiveContainer>
              <BarChart data={cashflow} barSize={22}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => fmtCompact(v)} tickLine={false} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: 'rgba(100,116,139,.08)' }} content={({ active, payload, label }) => active && payload ? (
                  <div className="chart-tooltip"><div className="strong">{label}</div>{payload.map((p) => <div key={p.dataKey as string}>{p.name}: {fmtMoney(p.value as number)}</div>)}</div>
                ) : null} />
                <Bar dataKey="tahsil" name="Tahsil" stackId="a" fill="#16a34a" />
                <Bar dataKey="geciken" name="Geciken" stackId="a" fill="#f87171" />
                <Bar dataKey="beklenen" name="Beklenen" stackId="a" fill="#93c5fd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><div><h3>Paket Bazlı Gelir</h3><div className="subtle">Aylık tekrarlayan gelir dağılımı</div></div></div>
          <div className="card__body">
            <div style={{ height: 170 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byPackage} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                    {byPackage.map((p) => <Cell key={p.code} fill={p.color} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="chart-tooltip">{payload[0].name}: {fmtMoney(payload[0].value as number)}</div> : null} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {byPackage.map((p) => (
                <div key={p.code} className="row-between" style={{ fontSize: 13 }}>
                  <span className="row gap-sm"><span className="dot" style={{ background: p.color }} />{p.name}</span>
                  <span className="num strong">{fmtMoney(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card__head"><div><h3>Yaklaşan Ödemeler</h3><div className="subtle">{db.notification.daysAhead} gün içinde</div></div>
            <Link to="/payments" className="btn btn-ghost btn-sm">Tümü <ArrowRight size={14} /></Link></div>
          {upcoming.length === 0 ? <EmptyState icon={<Wallet size={22} />} title="Yaklaşan ödeme yok" /> : upcoming.map((p) => {
            const c = custMap.get(p.customerId);
            return (
              <Link to={`/customers/${p.customerId}`} key={p.id} className="list-item" style={{ textDecoration: 'none' }}>
                <span className="dot" style={{ background: pkgMap.get(p.packageId)?.color, width: 10, height: 10 }} />
                <div className="list-item__main"><div className="list-item__title">{c?.companyName}</div><div className="list-item__sub">{pkgMap.get(p.packageId)?.code} · {relativeDays(p.dueDate)}</div></div>
                <span className="strong num" style={{ color: 'var(--text)' }}>{fmtMoney(p.amount)}</span>
              </Link>
            );
          })}
        </div>
        <div className="card">
          <div className="card__head"><div><h3>Görevlerim</h3><div className="subtle">{myTasks.length} açık görev</div></div>
            <Link to="/tasks" className="btn btn-ghost btn-sm">Tümü <ArrowRight size={14} /></Link></div>
          <TaskList tasks={myTasks.slice(0, 6)} showRelated compact />
        </div>
        <div className="card">
          <div className="card__head"><h3>Satış Hunisi</h3><Link to="/leads" className="btn btn-ghost btn-sm">Pano <ArrowRight size={14} /></Link></div>
          <div className="card__body stack" style={{ gap: 14 }}>
            {LEAD_STAGES.filter((s) => s.key !== 'lost').map((s) => {
              const items = db.leads.filter((l) => l.stage === s.key);
              const max = Math.max(...LEAD_STAGES.map((x) => db.leads.filter((l) => l.stage === x.key).length), 1);
              return (
                <div key={s.key}>
                  <div className="row-between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span>{s.label} <span className="subtle">({items.length})</span></span>
                    <span className="num strong">{fmtMoney(items.reduce((a, l) => a + leadValue(l, pkgMap), 0))}</span>
                  </div>
                  <div className="progress"><span style={{ width: `${(items.length / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="card__head" style={{ borderTop: '1px solid var(--border)' }}><h3>Son Aktiviteler</h3></div>
          {recent.map((a) => {
            const u = db.users.find((x) => x.id === a.userId);
            const target = a.entityType === 'customer' ? custMap.get(a.entityId)?.companyName : db.leads.find((l) => l.id === a.entityId)?.companyName;
            return (
              <div className="list-item" key={a.id}>
                {u && <Avatar name={u.name} size="sm" />}
                <div className="list-item__main">
                  <div className="list-item__title" style={{ fontWeight: 500 }}><b>{u?.name.split(' ')[0]}</b> · {ACTIVITY_LABELS[a.type]} · {target}</div>
                  <div className="list-item__sub">{timeAgo(a.createdAt)}</div>
                </div>
                <Badge tone={a.entityType === 'customer' ? 'primary' : 'purple'}>{a.entityType === 'customer' ? 'Müşteri' : 'Aday'}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
