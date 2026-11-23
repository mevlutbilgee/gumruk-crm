import { Fragment, useMemo, useState } from 'react';
import { BellRing, Building, Database, Eye, FileClock, Mail, RotateCcw, Save, Send, ShieldCheck, X } from 'lucide-react';
import { actions, getDb, useDb } from '@/data/store';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS as DEFAULTS, PERMISSION_GROUPS, ROLE_LABELS } from '@/lib/constants';
import { buildDigest } from '@/lib/digest';
import { cx, fmtDateTime, timeAgo } from '@/lib/utils';
import type { CompanySettings, EmailLog, NotificationSettings, Role } from '@/data/types';
import { Avatar, Badge, EmptyState, Field, Modal, PageHeader, Pagination, Segmented, Switch, useConfirm, usePagination, useToast } from '@/components/ui';

type Tab = 'notifications' | 'emails' | 'roles' | 'company' | 'audit' | 'data';
const TABS: { k: Tab; label: string; icon: JSX.Element }[] = [
  { k: 'notifications', label: 'Bildirimler', icon: <BellRing size={15} /> },
  { k: 'emails', label: 'E-posta Kayıtları', icon: <Mail size={15} /> },
  { k: 'roles', label: 'Roller & Yetkiler', icon: <ShieldCheck size={15} /> },
  { k: 'company', label: 'Firma Bilgileri', icon: <Building size={15} /> },
  { k: 'audit', label: 'Denetim Kaydı', icon: <FileClock size={15} /> },
  { k: 'data', label: 'Veri', icon: <Database size={15} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('notifications');
  return (
    <>
      <PageHeader title="Ayarlar" description="Bildirimler, yetkiler ve sistem yapılandırması." />
      <div className="tabs">
        {TABS.map((t) => <button key={t.k} className={cx('tab', tab === t.k && 'active')} onClick={() => setTab(t.k)}>{t.icon}{t.label}</button>)}
      </div>
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'emails' && <EmailsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'company' && <CompanyTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'data' && <DataTab />}
    </>
  );
}

function NotificationsTab() {
  const toast = useToast();
  const saved = useDb((d) => d.notification);
  const [n, setN] = useState<NotificationSettings>(saved);
  const [recipient, setRecipient] = useState('');
  const [preview, setPreview] = useState(false);
  const digest = useMemo(() => (preview ? buildDigest({ ...getDb(), notification: n }) : null), [preview, n]);
  const dirty = JSON.stringify(n) !== JSON.stringify(saved);

  const addRecipient = () => {
    const e = recipient.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { toast('Geçerli bir e-posta girin.', 'error'); return; }
    if (!n.recipients.includes(e)) setN({ ...n, recipients: [...n.recipients, e] });
    setRecipient('');
  };

  return (
    <div className="grid grid-main">
      <div className="card">
        <div className="card__head">
          <div><h3>Ödeme Hatırlatma E-postaları</h3><div className="subtle">Yaklaşan ve geciken ödemeler yöneticilere özet olarak gönderilir.</div></div>
          <Switch checked={n.enabled} onChange={(v) => setN({ ...n, enabled: v })} />
        </div>
        <div className="form-section" style={{ opacity: n.enabled ? 1 : 0.55 }}>
          <div className="form-grid">
            <Field label="Gönderim sıklığı" className="span-2">
              <Segmented value={n.frequency} onChange={(v) => setN({ ...n, frequency: v })} options={[
                { value: 'daily', label: 'Günlük' }, { value: 'weekly', label: 'Haftalık (Pazartesi)' }, { value: 'monthly', label: 'Aylık' },
              ]} />
            </Field>
            <Field label="Gönderim saati">
              <select className="select" value={n.sendHour} onChange={(e) => setN({ ...n, sendHour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </Field>
            {n.frequency === 'monthly' ? (
              <Field label="Ayın günü" hint="Aylık özet, bir sonraki 1 ayı kapsar.">
                <select className="select" value={n.monthlyDay} onChange={(e) => setN({ ...n, monthlyDay: Number(e.target.value) })}>
                  {Array.from({ length: 28 }, (_, d) => <option key={d + 1} value={d + 1}>{d + 1}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Kaç gün öncesinden" hint="Bu süre içinde vadesi gelen ödemeler listelenir.">
                <select className="select" value={n.daysAhead} onChange={(e) => setN({ ...n, daysAhead: Number(e.target.value) })}>
                  {[1, 3, 5, 7, 10, 14, 30].map((d) => <option key={d} value={d}>{d} gün</option>)}
                </select>
              </Field>
            )}
            <label className="check span-2"><input type="checkbox" checked={n.includeOverdue} onChange={(e) => setN({ ...n, includeOverdue: e.target.checked })} /> Geciken ödemeleri de ekle</label>
            <Field label="Alıcılar" className="span-2" hint="Özet e-postası bu adreslere gönderilir.">
              <div className="row wrap gap-sm" style={{ marginBottom: 8 }}>
                {n.recipients.map((r) => (
                  <span key={r} className="filter-chip">{r}<button onClick={() => setN({ ...n, recipients: n.recipients.filter((x) => x !== r) })}><X size={12} /></button></span>
                ))}
                {n.recipients.length === 0 && <span className="subtle">Alıcı yok</span>}
              </div>
              <div className="row">
                <input className="input" placeholder="ornek@firma.com" value={recipient} onChange={(e) => setRecipient(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())} />
                <button className="btn btn-secondary" onClick={addRecipient}>Ekle</button>
              </div>
            </Field>
          </div>
        </div>
        <div className="card__foot row-between wrap">
          <span className="subtle">Son gönderim: {saved.lastDigestAt ? fmtDateTime(saved.lastDigestAt) : 'Henüz yok'}</span>
          <div className="row">
            <button className="btn btn-secondary" onClick={() => setPreview(true)}><Eye size={15} /> Önizle</button>
            <button className="btn btn-secondary" onClick={() => { actions.saveNotification(n); actions.sendDigest('test'); toast('Test e-postası oluşturuldu → E-posta Kayıtları'); }}><Send size={15} /> Test gönder</button>
            <button className="btn btn-primary" disabled={!dirty} onClick={() => { actions.saveNotification(n); toast('Bildirim ayarları kaydedildi.'); }}><Save size={15} /> Kaydet</button>
          </div>
        </div>
      </div>
      <div className="stack">
        <div className="card card__body">
          <h3 style={{ fontSize: 14.5, marginBottom: 10 }}>Nasıl çalışır?</h3>
          <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 13 }}>
            <li>Her müşteri aboneliği için periyoda göre (aylık/yıllık) ödeme planı otomatik oluşur.</li>
            <li>Cloudflare Worker cron'u her saat başı çalışır, ayarlardaki saat ve sıklık eşleşirse özet hazırlar.</li>
            <li>Özet; Resend (veya SMTP) üzerinden alıcılara gönderilir ve e-posta kaydına yazılır.</li>
          </ol>
          <div className="callout tone-warning" style={{ marginTop: 14 }}>
            <BellRing size={16} />
            <span>Demo modunda e-postalar gerçekten gönderilmez; panel açıldığında zamanlayıcı simüle edilir ve sonuç “E-posta Kayıtları” sekmesine düşer.</span>
          </div>
        </div>
      </div>
      <Modal open={preview} onClose={() => setPreview(false)} size="lg" title="E-posta önizleme" subtitle={digest?.subject}>
        {digest && <iframe className="email-frame" title="önizleme" srcDoc={digest.html} />}
      </Modal>
    </div>
  );
}

function EmailsTab() {
  const emails = useDb((d) => d.emails);
  const pg = usePagination(emails, 12);
  const [view, setView] = useState<EmailLog | null>(null);
  const kinds: Record<EmailLog['kind'], string> = { digest: 'Özet', test: 'Test', invite: 'Davet', reminder: 'Hatırlatma' };
  return (
    <div className="card">
      {emails.length === 0 ? <EmptyState icon={<Mail size={22} />} title="Henüz e-posta yok" text="Bildirimler sekmesinden test e-postası gönderebilirsiniz." /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Konu</th><th>Alıcılar</th><th>Tür</th><th>Durum</th><th>Tarih</th><th className="actions" /></tr></thead>
              <tbody>{pg.slice.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setView(e)}>
                  <td className="strong">{e.subject}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{e.to.join(', ')}</td>
                  <td><Badge tone="primary">{kinds[e.kind]}</Badge></td>
                  <td><Badge tone={e.status === 'failed' ? 'danger' : e.status === 'sent' ? 'success' : 'warning'}>{e.status === 'simulated' ? 'Simüle edildi' : e.status === 'sent' ? 'Gönderildi' : 'Hata'}</Badge></td>
                  <td className="nowrap muted">{timeAgo(e.createdAt)}</td>
                  <td className="actions"><Eye size={15} className="muted" /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <Pagination {...pg} />
        </>
      )}
      <Modal open={!!view} onClose={() => setView(null)} size="lg" title={view?.subject} subtitle={view && `${view.to.join(', ')} · ${fmtDateTime(view.createdAt)}`}>
        {view && <iframe className="email-frame" title="e-posta" srcDoc={view.html} />}
      </Modal>
    </div>
  );
}

function RolesTab() {
  const toast = useToast();
  const perms = useDb((d) => d.rolePermissions);
  const users = useDb((d) => d.users);
  const roles = Object.keys(ROLE_LABELS) as Role[];
  const toggle = (r: Role, p: (typeof ALL_PERMISSIONS)[number]) => {
    const cur = perms[r];
    actions.setRolePermissions(r, cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  };
  return (
    <div className="card">
      <div className="card__head"><div><h3>Rol Yetki Matrisi</h3><div className="subtle">Değişiklikler anında uygulanır. Yönetici rolü her zaman tam yetkilidir.</div></div>
        <button className="btn btn-secondary btn-sm" onClick={() => { roles.forEach((r) => r !== 'admin' && actions.setRolePermissions(r, [...(DEFAULTS[r] ?? [])])); toast('Varsayılan yetkiler yüklendi.'); }}><RotateCcw size={14} /> Varsayılana dön</button>
      </div>
      <div className="table-wrap">
        <table className="table perm-table table-compact">
          <thead><tr><th>Yetki</th>{roles.map((r) => <th key={r}>{ROLE_LABELS[r]}<div style={{ textTransform: 'none', fontWeight: 500 }}>{users.filter((u) => u.role === r).length} kişi</div></th>)}</tr></thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.group}>
                <tr className="group-row"><td colSpan={roles.length + 1}>{g.group}</td></tr>
                {g.items.map((it) => (
                  <tr key={it.key}>
                    <td>{it.label}<div className="subtle" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{it.key}</div></td>
                    {roles.map((r) => (
                      <td key={r}><input type="checkbox" style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} checked={r === 'admin' || perms[r].includes(it.key)} disabled={r === 'admin'} onChange={() => toggle(r, it.key)} /></td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyTab() {
  const toast = useToast();
  const saved = useDb((d) => d.company);
  const [c, setC] = useState<CompanySettings>(saved);
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <div className="form-section">
        <div className="form-grid">
          <Field label="Firma ünvanı" className="span-2"><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="E-posta"><input className="input" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
          <Field label="Telefon"><input className="input" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
          <Field label="Vergi no"><input className="input" value={c.taxNumber} onChange={(e) => setC({ ...c, taxNumber: e.target.value })} /></Field>
          <Field label="KDV oranı (%)"><input type="number" className="input" value={c.vatRate} onChange={(e) => setC({ ...c, vatRate: Number(e.target.value) })} /></Field>
          <Field label="Adres" className="span-2"><textarea className="textarea" value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
        </div>
      </div>
      <div className="card__foot" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => { actions.saveCompany(c); toast('Firma bilgileri kaydedildi.'); }}><Save size={15} /> Kaydet</button>
      </div>
    </div>
  );
}

function AuditTab() {
  const audit = useDb((d) => d.audit);
  const users = useDb((d) => d.users);
  const [filter, setFilter] = useState('');
  const rows = audit.filter((a) => !filter || a.action === filter);
  const pg = usePagination(rows, 20);
  const labels: Record<string, [string, 'success' | 'primary' | 'danger' | 'info' | 'warning' | 'purple' | 'neutral']> = {
    create: ['Oluşturma', 'success'], update: ['Güncelleme', 'primary'], delete: ['Silme', 'danger'], login: ['Giriş', 'neutral'],
    convert: ['Dönüştürme', 'purple'], payment: ['Ödeme', 'info'], settings: ['Ayar', 'warning'], email: ['E-posta', 'info'],
  };
  return (
    <div className="card">
      <div className="filters">
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tüm işlemler</option>{Object.entries(labels).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="subtle">{rows.length} kayıt</span>
      </div>
      <div className="table-wrap">
        <table className="table table-compact">
          <thead><tr><th>Kullanıcı</th><th>İşlem</th><th>Kayıt</th><th>Açıklama</th><th>Zaman</th></tr></thead>
          <tbody>{pg.slice.map((a) => {
            const u = users.find((x) => x.id === a.userId);
            const [l, tone] = labels[a.action] ?? [a.action, 'neutral'];
            return (
              <tr key={a.id}>
                <td><div className="row gap-sm">{u && <Avatar name={u.name} size="sm" />}<span className="nowrap">{u?.name ?? 'Sistem'}</span></div></td>
                <td><Badge tone={tone}>{l}</Badge></td>
                <td className="muted">{a.entity}</td>
                <td>{a.entityLabel}</td>
                <td className="nowrap muted" title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <Pagination {...pg} />
    </div>
  );
}

function DataTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const counts = useDb((d) => ({ c: d.customers.length, l: d.leads.length, p: d.payments.length, a: d.activities.length }));
  const backup = () => {
    const blob = new Blob([JSON.stringify(getDb(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gumruk-crm-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  return (
    <div className="grid grid-2">
      <div className="card card__body">
        <h3 style={{ fontSize: 14.5 }}>Veri Özeti</h3>
        <dl className="dl" style={{ marginTop: 14 }}>
          <dt>Müşteri</dt><dd>{counts.c}</dd><dt>Potansiyel müşteri</dt><dd>{counts.l}</dd>
          <dt>Ödeme kaydı</dt><dd>{counts.p}</dd><dt>Aktivite</dt><dd>{counts.a}</dd>
        </dl>
        <div className="divider" />
        <button className="btn btn-secondary" onClick={backup}><Database size={15} /> JSON yedeği indir</button>
      </div>
      <div className="card card__body">
        <h3 style={{ fontSize: 14.5 }}>Demo Verisini Sıfırla</h3>
        <p className="muted" style={{ fontSize: 13 }}>Tarayıcıda saklanan tüm değişiklikler silinir ve hayali veriler yeniden oluşturulur. Supabase bağlandığında bu bölüm devre dışı kalır.</p>
        <button className="btn btn-danger" onClick={async () => {
          if (await confirm({ title: 'Demo verisi sıfırlansın mı?', message: 'Tüm yerel değişiklikler kaybolacak.', danger: true, confirmText: 'Sıfırla' })) { actions.resetDemo(); toast('Demo verisi sıfırlandı.'); }
        }}><RotateCcw size={15} /> Sıfırla</button>
      </div>
    </div>
  );
}
