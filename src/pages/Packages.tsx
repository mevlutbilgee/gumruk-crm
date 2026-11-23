import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { fmtMoney, monthlyValue } from '@/lib/utils';
import type { ServicePackage } from '@/data/types';
import { Badge, Field, Modal, PageHeader, Switch, useConfirm, useToast } from '@/components/ui';

const COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#0d9488', '#ca8a04'];
type Form = Omit<ServicePackage, 'id' | 'createdAt' | 'features'> & { id?: string; features: string };

export default function Packages() {
  const { can } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const packages = useDb((d) => d.packages);
  const customers = useDb((d) => d.customers);
  const [form, setForm] = useState<Form | null>(null);
  const manage = can('packages.manage');

  const stats = useMemo(() => {
    const m = new Map<string, { customers: number; mrr: number; monthly: number; yearly: number }>();
    for (const c of customers) for (const s of c.subscriptions) {
      if (!s.active) continue;
      const x = m.get(s.packageId) ?? { customers: 0, mrr: 0, monthly: 0, yearly: 0 };
      x.customers += 1; x.mrr += monthlyValue(s); x[s.billingCycle] += 1;
      m.set(s.packageId, x);
    }
    return m;
  }, [customers]);

  const open = (p?: ServicePackage) => setForm(p ? { ...p, features: p.features.join('\n') } : {
    code: '', name: '', description: '', monthlyPrice: 0, yearlyPrice: 0, features: '', color: COLORS[packages.length % COLORS.length], active: true,
  });

  const save = () => {
    if (!form) return;
    if (!form.name.trim() || !form.code.trim()) { toast('Paket adı ve kodu zorunludur.', 'error'); return; }
    if (form.monthlyPrice <= 0 || form.yearlyPrice <= 0) { toast('Aylık ve yıllık fiyat girin.', 'error'); return; }
    actions.savePackage({ ...form, code: form.code.toUpperCase(), features: form.features.split('\n').map((s) => s.trim()).filter(Boolean) });
    toast('Paket kaydedildi. Yeni fiyatlar sonraki müşteri kayıtlarında kullanılır.');
    setForm(null);
  };

  const remove = async (p: ServicePackage) => {
    if (!(await confirm({ title: 'Paket silinsin mi?', message: `“${p.name}” kalıcı olarak silinecek.`, confirmText: 'Sil', danger: true }))) return;
    const r = actions.deletePackage(p.id);
    toast(r.ok ? 'Paket silindi.' : r.error!, r.ok ? 'success' : 'error');
  };

  return (
    <>
      <PageHeader title="Hizmet Paketleri" description="İş kalemleri ve liste fiyatları. Müşteri kaydında bu fiyatlar baz alınır, indirim müşteri bazında uygulanır."
        actions={manage && <button className="btn btn-primary" onClick={() => open()}><Plus size={16} /> Yeni Paket</button>} />
      <div className="grid grid-3">
        {packages.map((p) => {
          const s = stats.get(p.id) ?? { customers: 0, mrr: 0, monthly: 0, yearly: 0 };
          const saving = Math.round((1 - p.yearlyPrice / (p.monthlyPrice * 12)) * 100);
          return (
            <div key={p.id} className="card pkg-card" style={{ opacity: p.active ? 1 : 0.65 }}>
              <div className="pkg-card__band" style={{ background: p.color }} />
              <div className="pkg-card__body">
                <div className="row-between">
                  <span className="pkg-pill"><i style={{ background: p.color }} />{p.code}</span>
                  {p.active ? <Badge tone="success" dot>Aktif</Badge> : <Badge>Pasif</Badge>}
                </div>
                <div>
                  <h3 style={{ fontSize: 16 }}>{p.name}</h3>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{p.description}</p>
                </div>
                <div className="pkg-card__prices">
                  <div className="pkg-card__price"><div className="l">Aylık</div><div className="v">{fmtMoney(p.monthlyPrice)}</div></div>
                  <div className="pkg-card__price"><div className="l">Yıllık {saving > 0 && <span className="text-success">· %{saving} avantaj</span>}</div><div className="v">{fmtMoney(p.yearlyPrice)}</div></div>
                </div>
                <ul>{p.features.map((f) => <li key={f}><Check size={14} />{f}</li>)}</ul>
                <div className="spacer" />
                <div className="row-between" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <Link to={`/customers?pkg=${p.id}`} className="row gap-sm" style={{ fontSize: 13 }}>
                    <Users size={14} /> {s.customers} müşteri <span className="subtle">({s.monthly} aylık · {s.yearly} yıllık)</span>
                  </Link>
                  <span className="strong num">{fmtMoney(s.mrr)}<span className="subtle">/ay</span></span>
                </div>
                {manage && (
                  <div className="row">
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => open(p)}><Pencil size={14} /> Düzenle</button>
                    <button className="btn btn-danger-ghost btn-sm btn-icon" onClick={() => remove(p)} aria-label="Sil"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Paketi Düzenle' : 'Yeni Hizmet Paketi'}
        subtitle="Fiyat değişiklikleri mevcut müşterilerin kayıtlı fiyatlarını değiştirmez."
        footer={<><button className="btn btn-secondary" onClick={() => setForm(null)}>Vazgeç</button><button className="btn btn-primary" onClick={save}>Kaydet</button></>}>
        {form && (
          <div className="form-grid">
            <Field label="Paket adı" required className="span-2"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Kod" required hint="Kısa kod, örn. ITH"><input className="input" value={form.code} maxLength={6} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Renk">
              <div className="row gap-sm" style={{ height: 36 }}>
                {COLORS.map((c) => (
                  <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c}
                    style={{ width: 24, height: 24, borderRadius: 6, background: c, border: form.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </Field>
            <Field label="Aylık fiyat (₺)" required><input type="number" min={0} className="input" value={form.monthlyPrice || ''} onChange={(e) => setForm({ ...form, monthlyPrice: Number(e.target.value) })} /></Field>
            <Field label="Yıllık fiyat (₺)" required hint={form.monthlyPrice > 0 ? `Aylık × 12 = ${fmtMoney(form.monthlyPrice * 12)}` : undefined}>
              <input type="number" min={0} className="input" value={form.yearlyPrice || ''} onChange={(e) => setForm({ ...form, yearlyPrice: Number(e.target.value) })} />
            </Field>
            <Field label="Açıklama" className="span-2"><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Özellikler" hint="Her satıra bir özellik" className="span-2"><textarea className="textarea" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></Field>
            <div className="row span-2"><Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} /> <span>Aktif (yeni kayıtlarda seçilebilir)</span></div>
          </div>
        )}
      </Modal>
    </>
  );
}
