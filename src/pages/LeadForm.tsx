import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Package, Save, TrendingUp } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { CITIES, LEAD_SOURCES, LEAD_STAGES, SECTORS, STAGE_MAP } from '@/lib/constants';
import { addDays, today } from '@/lib/utils';
import type { Lead, LeadSource, LeadStage } from '@/data/types';
import { EmptyState, Field, PageHeader, useToast } from '@/components/ui';
import PackageLinesEditor, { type PackageLine } from '@/components/PackageLinesEditor';

type Form = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'interests' | 'tags'> & { tags: string };

export default function LeadForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = usePermissions();
  const existing = useDb((d) => d.leads.find((l) => l.id === id));
  const users = useDb((d) => d.users.filter((u) => u.active));
  const [form, setForm] = useState<Form>(() => existing ? { ...existing, tags: existing.tags.join(', ') } : {
    companyName: '', sector: SECTORS[0], contactName: '', contactTitle: '', email: '', phone: '', city: 'İstanbul',
    source: 'website', stage: 'new', probability: 10, expectedCloseDate: addDays(today(), 30), ownerId: user?.id ?? '', tags: '', notes: '',
  });
  const [lines, setLines] = useState<PackageLine[]>(() => (existing?.interests ?? []).map((i, k) => ({ key: String(k), ...i })));
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (id && !existing) return <div className="card"><EmptyState title="Aday bulunamadı" /></div>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = 'Firma adı zorunludur.';
    if (!form.contactName.trim()) e.contactName = 'Yetkili kişi zorunludur.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Geçerli bir e-posta girin.';
    if (form.stage === 'lost' && !form.lostReason?.trim()) e.lostReason = 'Kaybedilme nedenini girin.';
    setErrors(e);
    if (Object.keys(e).length) { toast('Lütfen işaretli alanları kontrol edin.', 'error'); return; }
    const saved = actions.saveLead({
      ...form, id: existing?.id,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      interests: lines.map((l) => ({ packageId: l.packageId, billingCycle: l.billingCycle, discountType: l.discountType, discountValue: l.discountValue || 0 })),
    });
    toast(existing ? 'Aday güncellendi.' : 'Potansiyel müşteri kaydedildi.');
    navigate(`/leads/${saved.id}`);
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        crumbs={<><Link to="/leads">Potansiyel Müşteriler</Link> / <span>{existing?.companyName ?? 'Yeni'}</span></>}
        title={existing ? 'Adayı Düzenle' : 'Yeni Potansiyel Müşteri'}
        description="Henüz hizmet almayan firmaları kaydedin, ilgilendikleri paketleri ve teklif indirimlerini belirleyin."
        actions={<>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Vazgeç</button>
          <button type="submit" className="btn btn-primary"><Save size={16} /> Kaydet</button>
        </>}
      />
      <div className="card">
        <div className="form-section">
          <div className="form-section__title"><Building2 size={16} /> Firma & İletişim</div>
          <div className="form-section__desc">Aday firmanın temel bilgileri.</div>
          <div className="form-grid-3">
            <Field label="Firma adı" required error={errors.companyName} className="span-2">
              <input className={`input ${errors.companyName ? 'invalid' : ''}`} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </Field>
            <Field label="Sektör">
              <select className="select" value={form.sector} onChange={(e) => set('sector', e.target.value)}>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Yetkili adı soyadı" required error={errors.contactName}>
              <input className={`input ${errors.contactName ? 'invalid' : ''}`} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Ünvan"><input className="input" value={form.contactTitle ?? ''} onChange={(e) => set('contactTitle', e.target.value)} /></Field>
            <Field label="Şehir">
              <select className="select" value={form.city} onChange={(e) => set('city', e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="E-posta" error={errors.email}><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Telefon"><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Kaynak">
              <select className="select" value={form.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
                {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title"><TrendingUp size={16} /> Satış Süreci</div>
          <div className="form-section__desc">Huni aşaması, kapanma olasılığı ve sorumlu temsilci.</div>
          <div className="form-grid-3">
            <Field label="Aşama">
              <select className="select" value={form.stage} onChange={(e) => { const s = e.target.value as LeadStage; setForm((f) => ({ ...f, stage: s, probability: STAGE_MAP[s].probability })); }}>
                {LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label={`Kazanma olasılığı: %${form.probability}`}>
              <input type="range" min={0} max={100} step={5} value={form.probability} onChange={(e) => set('probability', Number(e.target.value))} style={{ accentColor: 'var(--primary)', height: 36 }} />
            </Field>
            <Field label="Tahmini kapanış">
              <input type="date" className="input" value={form.expectedCloseDate ?? ''} onChange={(e) => set('expectedCloseDate', e.target.value)} />
            </Field>
            <Field label="Sorumlu temsilci">
              <select className="select" value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </Field>
            <Field label="Etiketler" hint="Virgülle ayırın" className="span-2"><input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
            {form.stage === 'lost' && (
              <Field label="Kaybedilme nedeni" required error={errors.lostReason} className="span-3">
                <input className="input" value={form.lostReason ?? ''} onChange={(e) => set('lostReason', e.target.value)} />
              </Field>
            )}
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title"><Package size={16} /> İlgilendiği Paketler & Teklif</div>
          <div className="form-section__desc">Teklif edilecek paketler. Müşteriye dönüştürüldüğünde bu satırlar aboneliğe çevrilir.</div>
          <PackageLinesEditor lines={lines} onChange={setLines} />
        </div>

        <div className="form-section">
          <Field label="Notlar"><textarea className="textarea" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </div>
    </form>
  );
}
