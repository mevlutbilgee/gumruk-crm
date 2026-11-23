import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Package, Save, UserRound } from 'lucide-react';
import { actions, useDb, usePermissions } from '@/data/store';
import { CITIES, SECTORS } from '@/lib/constants';
import { listPriceFor, today, uid } from '@/lib/utils';
import type { Customer, CustomerStatus } from '@/data/types';
import { EmptyState, Field, PageHeader, useToast } from '@/components/ui';
import PackageLinesEditor, { type PackageLine } from '@/components/PackageLinesEditor';

type Form = Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'subscriptions' | 'tags'> & { tags: string };

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = usePermissions();
  const existing = useDb((d) => d.customers.find((c) => c.id === id));
  const packages = useDb((d) => d.packages);
  const users = useDb((d) => d.users.filter((u) => u.active));

  const [form, setForm] = useState<Form>(() => existing
    ? { ...existing, tags: existing.tags.join(', ') }
    : {
      companyName: '', taxNumber: '', taxOffice: '', sector: SECTORS[0], contactName: '', contactTitle: '', email: '', phone: '',
      city: 'İstanbul', district: '', address: '', website: '', startDate: today(), status: 'active', ownerId: user?.id ?? '', tags: '', notes: '',
    });
  const [lines, setLines] = useState<PackageLine[]>(() => (existing?.subscriptions ?? []).map((s) => ({
    key: s.id, packageId: s.packageId, billingCycle: s.billingCycle, startDate: s.startDate, discountType: s.discountType,
    discountValue: s.discountValue, active: s.active, lockedPrice: s.listPrice,
  })));
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (id && !existing) return <div className="card"><EmptyState title="Müşteri bulunamadı" action={<Link to="/customers" className="btn btn-secondary">Listeye dön</Link>} /></div>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = 'Firma adı zorunludur.';
    if (!form.contactName.trim()) e.contactName = 'Yetkili kişi zorunludur.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Geçerli bir e-posta girin.';
    if (form.taxNumber && !/^\d{10,11}$/.test(form.taxNumber)) e.taxNumber = 'Vergi no 10, TCKN 11 haneli olmalıdır.';
    if (!form.city) e.city = 'Şehir seçin.';
    if (!form.startDate) e.startDate = 'Başlangıç tarihi zorunludur.';
    if (lines.length === 0) e.lines = 'En az bir hizmet paketi ekleyin.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) { toast('Lütfen işaretli alanları kontrol edin.', 'error'); return; }
    const pkgMap = new Map(packages.map((p) => [p.id, p]));
    const saved = actions.saveCustomer({
      ...form,
      id: existing?.id,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      subscriptions: lines.map((l) => {
        const prev = existing?.subscriptions.find((s) => s.id === l.key);
        return {
          id: prev?.id ?? uid('s_'),
          packageId: l.packageId,
          billingCycle: l.billingCycle,
          startDate: l.startDate || form.startDate,
          listPrice: l.lockedPrice ?? listPriceFor(pkgMap.get(l.packageId), l.billingCycle),
          discountType: l.discountType,
          discountValue: l.discountValue || 0,
          active: l.active !== false,
          endDate: l.active === false ? prev?.endDate ?? today() : undefined,
        };
      }),
    });
    toast(existing ? 'Müşteri güncellendi.' : 'Müşteri oluşturuldu, ödeme planı hazırlandı.');
    navigate(`/customers/${saved.id}`);
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        crumbs={<><Link to="/customers">Müşteriler</Link> / <span>{existing ? existing.companyName : 'Yeni'}</span></>}
        title={existing ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
        description="Firma bilgileri, alınan hizmet paketleri ve müşteriye özel indirimler."
        actions={<>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Vazgeç</button>
          <button type="submit" className="btn btn-primary"><Save size={16} /> Kaydet</button>
        </>}
      />
      <div className="card">
        <div className="form-section">
          <div className="form-section__title"><Building2 size={16} /> Firma Bilgileri</div>
          <div className="form-section__desc">Fatura ve sözleşmelerde kullanılacak resmi bilgiler.</div>
          <div className="form-grid-3">
            <Field label="Firma adı" required error={errors.companyName} className="span-2">
              <input className={`input ${errors.companyName ? 'invalid' : ''}`} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Örn. Anadolu Tekstil A.Ş." />
            </Field>
            <Field label="Sektör">
              <select className="select" value={form.sector} onChange={(e) => set('sector', e.target.value)}>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Vergi no / TCKN" error={errors.taxNumber}>
              <input className={`input ${errors.taxNumber ? 'invalid' : ''}`} inputMode="numeric" value={form.taxNumber} onChange={(e) => set('taxNumber', e.target.value.replace(/\D/g, ''))} maxLength={11} />
            </Field>
            <Field label="Vergi dairesi">
              <input className="input" value={form.taxOffice} onChange={(e) => set('taxOffice', e.target.value)} />
            </Field>
            <Field label="Web sitesi">
              <input className="input" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="www.firma.com.tr" />
            </Field>
            <Field label="Şehir" required error={errors.city}>
              <select className="select" value={form.city} onChange={(e) => set('city', e.target.value)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="İlçe / Bölge">
              <input className="input" value={form.district ?? ''} onChange={(e) => set('district', e.target.value)} />
            </Field>
            <Field label="Adres">
              <input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title"><UserRound size={16} /> Yetkili Kişi & Hesap</div>
          <div className="form-section__desc">Birincil iletişim kişisi ve müşteriden sorumlu temsilci.</div>
          <div className="form-grid-3">
            <Field label="Yetkili adı soyadı" required error={errors.contactName}>
              <input className={`input ${errors.contactName ? 'invalid' : ''}`} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Ünvan">
              <input className="input" value={form.contactTitle ?? ''} onChange={(e) => set('contactTitle', e.target.value)} />
            </Field>
            <Field label="E-posta" error={errors.email}>
              <input className={`input ${errors.email ? 'invalid' : ''}`} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Telefon">
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0212 000 00 00" />
            </Field>
            <Field label="Hizmet başlangıç tarihi" required error={errors.startDate}>
              <input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Durum">
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value as CustomerStatus)}>
                <option value="active">Aktif</option>
                <option value="suspended">Askıda</option>
                <option value="passive">Pasif</option>
              </select>
            </Field>
            <Field label="Sorumlu temsilci">
              <select className="select" value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Etiketler" hint="Virgülle ayırın: VIP, Yoğun Hacim" className="span-2">
              <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title"><Package size={16} /> Hizmet Paketleri & İndirim</div>
          <div className="form-section__desc">Fiyatlar “Hizmet Paketleri” sayfasındaki liste fiyatlarından gelir. Her paket için aylık/yıllık periyot ve müşteriye özel indirim (% veya ₺) girebilirsiniz.</div>
          <PackageLinesEditor lines={lines} onChange={setLines} withStartDate withActive={!!existing} />
          {errors.lines && <div className="error" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{errors.lines}</div>}
        </div>

        <div className="form-section">
          <Field label="Notlar">
            <textarea className="textarea" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Müşteriye dair önemli notlar…" />
          </Field>
        </div>
      </div>
    </form>
  );
}
