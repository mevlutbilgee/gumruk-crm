import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDb, usePermissions } from '@/data/store';
import { addDays, today } from '@/lib/utils';
import { PageHeader, Segmented } from '@/components/ui';
import TaskList from '@/components/TaskList';
import TaskModal from '@/components/TaskModal';

export default function Tasks() {
  const { user, can } = usePermissions();
  const tasks = useDb((d) => d.tasks);
  const users = useDb((d) => d.users);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [open, setOpen] = useState(false);
  const T = today();

  const filtered = useMemo(() => tasks.filter((t) =>
    (scope === 'all' ? (!assignee || t.assigneeId === assignee) : t.assigneeId === user?.id) &&
    (status === 'all' || (status === 'open' ? !t.done : t.done)) && (!priority || t.priority === priority),
  ), [tasks, scope, status, assignee, priority, user?.id]);

  const groups = status === 'done' ? [{ title: 'Tamamlananlar', items: filtered }] : [
    { title: 'Gecikmiş', items: filtered.filter((t) => !t.done && t.dueDate < T) },
    { title: 'Bugün', items: filtered.filter((t) => !t.done && t.dueDate === T) },
    { title: 'Bu hafta', items: filtered.filter((t) => !t.done && t.dueDate > T && t.dueDate <= addDays(T, 7)) },
    { title: 'Daha sonra', items: filtered.filter((t) => !t.done && t.dueDate > addDays(T, 7)) },
    ...(status === 'all' ? [{ title: 'Tamamlananlar', items: filtered.filter((t) => t.done) }] : []),
  ];

  return (
    <>
      <PageHeader title="Görevler" description="Takip, arama ve toplantı hatırlatmaları."
        actions={can('tasks.manage') && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Yeni Görev</button>} />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="filters" style={{ borderBottom: 0 }}>
          <Segmented value={scope} onChange={setScope} options={[{ value: 'mine', label: 'Bana atananlar' }, { value: 'all', label: 'Tüm ekip' }]} />
          <Segmented value={status} onChange={setStatus} options={[{ value: 'open', label: 'Açık' }, { value: 'done', label: 'Tamamlanan' }, { value: 'all', label: 'Tümü' }]} />
          {scope === 'all' && (
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Tüm kişiler</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Tüm öncelikler</option><option value="high">Yüksek</option><option value="medium">Orta</option><option value="low">Düşük</option>
          </select>
        </div>
      </div>
      <div className="stack">
        {groups.filter((g) => g.items.length > 0 || g.title === 'Bugün').map((g) => (
          <div className="card" key={g.title}>
            <div className="card__head"><h3 className={g.title === 'Gecikmiş' ? 'text-danger' : undefined}>{g.title} <span className="subtle">({g.items.length})</span></h3></div>
            <TaskList tasks={g.items} showRelated />
          </div>
        ))}
      </div>
      <TaskModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
