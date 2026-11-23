import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Pencil, Plus, Trash2 } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { PRIORITY } from '@/lib/constants';
import { cx, fmtDate, relativeDays, today } from '@/lib/utils';
import type { Task } from '@/data/types';
import { Avatar, Badge, EmptyState } from './ui';
import TaskModal from './TaskModal';

export default function TaskList({ tasks, relatedType, relatedId, showRelated, compact }: {
  tasks: Task[]; relatedType?: 'customer' | 'lead'; relatedId?: string; showRelated?: boolean; compact?: boolean;
}) {
  const { can } = usePermissions();
  const users = useDb((d) => d.users);
  const customers = useDb((d) => d.customers);
  const leads = useDb((d) => d.leads);
  const [modal, setModal] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const T = today();
  const canEdit = can('tasks.manage');
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate));

  const relatedLabel = (t: Task) => {
    if (!t.relatedId) return null;
    if (t.relatedType === 'customer') { const c = customers.find((x) => x.id === t.relatedId); return c && <Link to={`/customers/${c.id}`}>{c.companyName}</Link>; }
    const l = leads.find((x) => x.id === t.relatedId); return l && <Link to={`/leads/${l.id}`}>{l.companyName}</Link>;
  };

  return (
    <>
      {canEdit && relatedId && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ open: true, task: null })}><Plus size={14} /> Görev ekle</button>
        </div>
      )}
      {sorted.length === 0 ? <EmptyState title="Görev yok" text="Takip edilecek görev bulunmuyor." /> : sorted.map((t) => {
        const u = users.find((x) => x.id === t.assigneeId);
        const late = !t.done && t.dueDate < T;
        return (
          <div key={t.id} className={cx('list-item', t.done && 'task-done')}>
            <button className="btn btn-ghost btn-icon btn-sm" disabled={!canEdit} onClick={() => actions.toggleTask(t.id)} aria-label="Tamamla">
              {t.done ? <CheckCircle2 size={19} color="var(--success)" /> : <Circle size={19} color="var(--text-3)" />}
            </button>
            <div className="list-item__main">
              <div className="list-item__title">{t.title}</div>
              <div className="list-item__sub row wrap gap-sm">
                <span className={late ? 'text-danger' : undefined}>{fmtDate(t.dueDate)} · {relativeDays(t.dueDate)}</span>
                {showRelated && relatedLabel(t) && <>· {relatedLabel(t)}</>}
              </div>
            </div>
            {!compact && <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>}
            {u && <Avatar name={u.name} size="sm" />}
            {canEdit && !compact && (
              <div className="row gap-sm">
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal({ open: true, task: t })} aria-label="Düzenle"><Pencil size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => actions.deleteTask(t.id)} aria-label="Sil"><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        );
      })}
      <TaskModal open={modal.open} task={modal.task} onClose={() => setModal({ open: false })} relatedType={relatedType} relatedId={relatedId} />
    </>
  );
}
