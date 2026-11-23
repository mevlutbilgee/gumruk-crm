import { useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/constants';
import { fmtDate, matches, timeAgo } from '@/lib/utils';
import { ADMIN_PASSWORD_HASH, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import type { Role, User } from '@/data/types';
import { Avatar, Badge, Field, Modal, PageHeader, StatCard, Switch, useConfirm, useToast } from '@/components/ui';

type Form = Omit<User, 'id' | 'createdAt'> & { id?: string };
const ROLE_TONE: Record<Role, 'danger' | 'purple' | 'primary' | 'info' | 'neutral'> = { admin: 'danger', manager: 'purple', sales: 'primary', accounting: 'info', viewer: 'neutral' };

export default function UsersPage() {
  const { user: me } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const users = useDb((d) => d.users);
  const customers = useDb((d) => d.customers);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [pw, setPw] = useState({ a: '', b: '', err: '' });
  const hasPassword = (u: User) => !!u.passwordHash || (u.id === 'u_admin' && !!ADMIN_PASSWORD_HASH);
  const savePassword = async () => {
    if (!pwUser) return;
    if (pw.a.length < MIN_PASSWORD_LENGTH) { setPw({ ...pw, err: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` }); return; }
    if (pw.a !== pw.b) { setPw({ ...pw, err: 'Şifreler eşleşmiyor.' }); return; }
    await actions.setPassword(pwUser.id, pw.a);
    toast(`${pwUser.name} için şifre belirlendi.`);
    setPwUser(null);
  };

  const rows = useMemo(() => users.filter((u) => matches(q, u.name, u.email, u.title) && (!role || u.role === role)), [users, q, role]);

  const save = () => {
    if (!form) return;
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) { setError('Ad ve geçerli bir e-posta zorunludur.'); return; }
    const r = actions.saveUser(form);
    if (!r.ok) { setError(r.error!); return; }
    toast(form.id ? 'Kullanıcı güncellendi.' : 'Kullanıcı eklendi. Giriş yapabilmesi için anahtar simgesinden şifre belirleyin.');
    setForm(null);
  };
  const remove = async (u: User) => {
    const owned = customers.filter((c) => c.ownerId === u.id).length;
    if (!(await confirm({ title: 'Kullanıcı silinsin mi?', danger: true, confirmText: 'Sil',
      message: <>“{u.name}” sistemden kaldırılacak.{owned > 0 && <> Sorumlu olduğu <b>{owned} müşteri</b> size devredilecek.</>} Geçmiş kayıtları korunur. Alternatif olarak hesabı pasif yapabilirsiniz.</> }))) return;
    const r = actions.deleteUser(u.id);
    toast(r.ok ? 'Kullanıcı silindi.' : r.error!, r.ok ? 'success' : 'error');
  };

  return (
    <>
      <PageHeader title="Kullanıcılar" description="Ekip üyeleri, rolleri ve erişim durumları. Rol yetkilerini Ayarlar → Roller & Yetkiler'den düzenleyebilirsiniz."
        actions={<button className="btn btn-primary" onClick={() => { setError(''); setForm({ name: '', email: '', phone: '', title: '', role: 'sales', active: true }); }}><UserPlus size={16} /> Kullanıcı Ekle</button>} />
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Toplam kullanıcı" value={users.length} icon={<ShieldCheck size={18} />} />
        <StatCard label="Aktif" value={users.filter((u) => u.active).length} icon={<ShieldCheck size={18} />} tone="success" />
        <StatCard label="Yönetici" value={users.filter((u) => u.role === 'admin').length} icon={<KeyRound size={18} />} tone="danger" />
        <StatCard label="Satış ekibi" value={users.filter((u) => u.role === 'sales').length} icon={<Plus size={18} />} tone="purple" />
      </div>
      <div className="card">
        <div className="filters">
          <div className="filters__search"><Search size={15} /><input className="input" placeholder="Ad, e-posta veya ünvan…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Tüm roller</option>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Kullanıcı</th><th>Rol</th><th>Telefon</th><th>Son giriş</th><th>Eklenme</th><th>Durum</th><th className="actions" /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><div className="company-cell"><Avatar name={u.name} /><div><div className="company-cell__name">{u.name} {u.id === me?.id && <span className="subtle">(siz)</span>}</div><div className="company-cell__sub">{u.email}{u.title ? ` · ${u.title}` : ''}</div></div></div></td>
                  <td><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="nowrap muted">{u.phone || '—'}</td>
                  <td className="nowrap muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Hiç'}{!hasPassword(u) && <div><Badge tone="warning">Şifre yok</Badge></div>}</td>
                  <td className="nowrap muted">{fmtDate(u.createdAt)}</td>
                  <td>
                    <Switch checked={u.active} disabled={u.id === me?.id} onChange={(v) => {
                      const r = actions.saveUser({ ...u, active: v });
                      toast(r.ok ? (v ? 'Kullanıcı aktifleştirildi.' : 'Kullanıcı pasifleştirildi.') : r.error!, r.ok ? 'success' : 'error');
                    }} />
                  </td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setError(''); setForm({ ...u }); }} aria-label="Düzenle"><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Şifre belirle" onClick={() => { setPw({ a: '', b: '', err: '' }); setPwUser(u); }}><KeyRound size={14} /></button>
                    {u.id !== me?.id && <button className="btn btn-danger-ghost btn-icon btn-sm" onClick={() => remove(u)} aria-label="Sil"><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}
        subtitle={!form?.id ? 'Kullanıcıya giriş bağlantısı içeren bir davet e-postası gönderilir.' : undefined}
        footer={<><button className="btn btn-secondary" onClick={() => setForm(null)}>Vazgeç</button><button className="btn btn-primary" onClick={save}>Kaydet</button></>}>
        {form && (
          <div className="form-grid">
            <Field label="Ad soyad" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="E-posta" required><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Ünvan"><input className="input" value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Telefon"><input className="input" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <div className="span-2">
              <div className="label" style={{ marginBottom: 8 }}>Rol</div>
              <div className="stack" style={{ gap: 8 }}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <label key={r} className="demo-user" style={{ cursor: form.id === me?.id ? 'not-allowed' : 'pointer', borderColor: form.role === r ? 'var(--primary)' : undefined, background: form.role === r ? 'var(--primary-soft)' : undefined }}>
                    <input type="radio" name="role" checked={form.role === r} disabled={form.id === me?.id} onChange={() => setForm({ ...form, role: r })} style={{ accentColor: 'var(--primary)' }} />
                    <span><div className="strong" style={{ fontSize: 13 }}>{ROLE_LABELS[r]}</div><div className="subtle">{ROLE_DESCRIPTIONS[r]}</div></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="row span-2"><Switch checked={form.active} disabled={form.id === me?.id} onChange={(v) => setForm({ ...form, active: v })} /> Aktif hesap</div>
            {error && <div className="callout tone-danger span-2">{error}</div>}
          </div>
        )}
      </Modal>
      <Modal open={!!pwUser} onClose={() => setPwUser(null)} size="sm" title="Şifre belirle" subtitle={pwUser && `${pwUser.name} · ${pwUser.email}`}
        footer={<><button className="btn btn-secondary" onClick={() => setPwUser(null)}>Vazgeç</button><button className="btn btn-primary" onClick={savePassword}>Kaydet</button></>}>
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Yeni şifre" hint={`En az ${MIN_PASSWORD_LENGTH} karakter`}>
            <input className="input" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value, err: '' })} autoFocus />
          </Field>
          <Field label="Yeni şifre (tekrar)" error={pw.err}>
            <input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value, err: '' })}
              onKeyDown={(e) => e.key === 'Enter' && savePassword()} />
          </Field>
          <div className="subtle">Demo modunda şifre yalnızca bu tarayıcıda, özet (hash) olarak saklanır.</div>
        </div>
      </Modal>
    </>
  );
}
