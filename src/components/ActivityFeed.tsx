import { useState } from 'react';
import { Mail, MessageSquareText, Phone, Settings2, Trash2, Users } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { ACTIVITY_LABELS } from '@/lib/constants';
import { fmtDateTime, timeAgo } from '@/lib/utils';
import type { ActivityType } from '@/data/types';
import { EmptyState, Segmented } from './ui';

const ICONS: Record<ActivityType, { icon: JSX.Element; tone: string }> = {
  call: { icon: <Phone size={14} />, tone: 'tone-success' },
  meeting: { icon: <Users size={14} />, tone: 'tone-purple' },
  email: { icon: <Mail size={14} />, tone: 'tone-info' },
  note: { icon: <MessageSquareText size={14} />, tone: 'tone-warning' },
  system: { icon: <Settings2 size={14} />, tone: 'tone-neutral' },
};

export default function ActivityFeed({ entityType, entityId, canEdit }: { entityType: 'customer' | 'lead'; entityId: string; canEdit: boolean }) {
  const all = useDb((d) => d.activities);
  const users = useDb((d) => d.users);
  const { user } = usePermissions();
  const items = all.filter((a) => a.entityType === entityType && a.entityId === entityId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [type, setType] = useState<Exclude<ActivityType, 'system'>>('note');
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    actions.addActivity({ entityType, entityId, type, content: text.trim() });
    setText('');
  };

  return (
    <div className="stack">
      {canEdit && (
        <div className="card card__body" style={{ padding: 16 }}>
          <div className="row-between wrap" style={{ marginBottom: 10 }}>
            <Segmented value={type} onChange={setType} options={[
              { value: 'note', label: <><MessageSquareText size={13} /> Not</> },
              { value: 'call', label: <><Phone size={13} /> Arama</> },
              { value: 'meeting', label: <><Users size={13} /> Toplantı</> },
              { value: 'email', label: <><Mail size={13} /> E-posta</> },
            ]} />
          </div>
          <textarea className="textarea" placeholder={`${ACTIVITY_LABELS[type]} detayı…`} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }} />
          <div className="row-between" style={{ marginTop: 10 }}>
            <span className="subtle">⌘/Ctrl + Enter ile kaydet</span>
            <button className="btn btn-primary btn-sm" onClick={add} disabled={!text.trim()}>Ekle</button>
          </div>
        </div>
      )}
      <div className="card card__body">
        {items.length === 0 ? <EmptyState title="Henüz aktivite yok" text="Görüşme, toplantı ve notlar burada görünür." /> : (
          <div className="timeline">
            {items.map((a) => {
              const u = users.find((x) => x.id === a.userId);
              return (
                <div className="timeline__item" key={a.id}>
                  <div className={`timeline__icon ${ICONS[a.type].tone}`}>{ICONS[a.type].icon}</div>
                  <div className="timeline__body">
                    <div className="row-between">
                      <span className="strong" style={{ fontSize: 13 }}>{ACTIVITY_LABELS[a.type]}</span>
                      {canEdit && (a.userId === user?.id || user?.role === 'admin') && a.type !== 'system' && (
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => actions.deleteActivity(a.id)} aria-label="Sil"><Trash2 size={13} /></button>
                      )}
                    </div>
                    <div style={{ marginTop: 2 }}>{a.content}</div>
                    <div className="timeline__meta" title={fmtDateTime(a.createdAt)}>{u?.name ?? 'Sistem'} · {timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
