import { useEffect, useState } from 'react';
import { actions, useDb, usePermissions } from '@/data/store';
import { addDays, today } from '@/lib/utils';
import type { Task, TaskPriority } from '@/data/types';
import { Field, Modal, useToast } from './ui';

export default function TaskModal({ open, onClose, task, relatedType, relatedId }: {
  open: boolean; onClose: () => void; task?: Task | null; relatedType?: 'customer' | 'lead'; relatedId?: string;
}) {
  const { user } = usePermissions();
  const toast = useToast();
  const users = useDb((d) => d.users.filter((u) => u.active));
  const customers = useDb((d) => d.customers);
  const leads = useDb((d) => d.leads);
  type F = Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'description'> & { description: string };
  const blank = (): F => ({
    title: '', description: '', dueDate: addDays(today(), 1), priority: 'medium' as TaskPriority, done: false,
    assigneeId: user?.id ?? '', relatedType, relatedId,
  });
  const [f, setF] = useState<F>(blank);
  useEffect(() => { if (open) setF(task ? { ...task, description: task.description ?? '' } : blank()); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const relatedValue = f.relatedType && f.relatedId ? `${f.relatedType}:${f.relatedId}` : '';
  const save = () => {
    if (!f.title.trim()) { toast('Görev başlığı girin.', 'error'); return; }
    actions.saveTask({ ...f, id: task?.id, title: f.title.trim(), description: f.description || undefined });
    toast(task ? 'Görev güncellendi.' : 'Görev oluşturuldu.');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Görevi Düzenle' : 'Yeni Görev'} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
      <button className="btn btn-primary" onClick={save}>Kaydet</button>
    </>}>
      <div className="form-grid">
        <Field label="Başlık" required className="span-2">
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
        </Field>
        <Field label="Son tarih">
          <input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Öncelik">
          <select className="select" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TaskPriority })}>
            <option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option>
          </select>
        </Field>
        <Field label="Atanan kişi">
          <select className="select" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="İlgili kayıt">
          <select className="select" value={relatedValue} disabled={!!relatedId && !task} onChange={(e) => {
            const [t, id] = e.target.value.split(':');
            setF({ ...f, relatedType: (t || undefined) as Task['relatedType'], relatedId: id || undefined });
          }}>
            <option value="">— Yok —</option>
            <optgroup label="Müşteriler">{customers.map((c) => <option key={c.id} value={`customer:${c.id}`}>{c.companyName}</option>)}</optgroup>
            <optgroup label="Potansiyel">{leads.map((l) => <option key={l.id} value={`lead:${l.id}`}>{l.companyName}</option>)}</optgroup>
          </select>
        </Field>
        <Field label="Açıklama" className="span-2">
          <textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
