import { Plus, Trash2 } from 'lucide-react';
import { useDb } from '@/data/store';
import type { BillingCycle, DiscountType } from '@/data/types';
import { applyDiscount, fmtMoney, listPriceFor } from '@/lib/utils';
import { Field, Switch } from './ui';

export interface PackageLine {
  key: string;
  packageId: string;
  billingCycle: BillingCycle;
  startDate?: string;
  discountType: DiscountType;
  discountValue: number;
  active?: boolean;
  /** Mevcut abonelikte kayıtlı liste fiyatı (fiyat değişse bile korunur) */
  lockedPrice?: number;
}

export const lineListPrice = (l: PackageLine, pkgPrice: number) => l.lockedPrice ?? pkgPrice;

/** Hizmet paketi satırları — fiyatlar paketlerden gelir, satır bazında indirim girilir. */
export default function PackageLinesEditor({ lines, onChange, withStartDate, withActive }: {
  lines: PackageLine[]; onChange: (l: PackageLine[]) => void; withStartDate?: boolean; withActive?: boolean;
}) {
  const packages = useDb((d) => d.packages);
  const pkgMap = new Map(packages.map((p) => [p.id, p]));
  const update = (key: string, patch: Partial<PackageLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const available = packages.filter((p) => p.active);

  const add = () => {
    const used = new Set(lines.map((l) => l.packageId));
    const next = available.find((p) => !used.has(p.id)) ?? available[0];
    if (!next) return;
    onChange([...lines, {
      key: Math.random().toString(36).slice(2), packageId: next.id, billingCycle: 'monthly',
      startDate: withStartDate ? new Date().toISOString().slice(0, 10) : undefined,
      discountType: 'percent', discountValue: 0, active: true,
    }]);
  };

  let monthly = 0; let yearlyTotal = 0; let discountTotal = 0;
  for (const l of lines) {
    if (l.active === false) continue;
    const list = lineListPrice(l, listPriceFor(pkgMap.get(l.packageId), l.billingCycle));
    const net = applyDiscount(list, l.discountType, l.discountValue);
    discountTotal += (list - net) * (l.billingCycle === 'monthly' ? 12 : 1);
    monthly += l.billingCycle === 'monthly' ? net : net / 12;
    yearlyTotal += l.billingCycle === 'monthly' ? net * 12 : net;
  }

  return (
    <div className="sub-editor">
      {lines.length === 0 && <div className="callout tone-info">Henüz paket eklenmedi. Müşterinin aldığı iş kalemlerini aşağıdan ekleyin.</div>}
      {lines.map((l) => {
        const pkg = pkgMap.get(l.packageId);
        const pkgPrice = listPriceFor(pkg, l.billingCycle);
        const list = lineListPrice(l, pkgPrice);
        const net = applyDiscount(list, l.discountType, l.discountValue);
        return (
          <div className="sub-row" key={l.key} style={l.active === false ? { opacity: 0.6 } : undefined}>
            <Field label="İş kalemi / Paket">
              <select className="select" value={l.packageId} onChange={(e) => update(l.key, { packageId: e.target.value, lockedPrice: undefined })}>
                {packages.map((p) => <option key={p.id} value={p.id} disabled={!p.active && p.id !== l.packageId}>{p.name}{!p.active ? ' (pasif)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Periyot">
              <select className="select" value={l.billingCycle} onChange={(e) => update(l.key, { billingCycle: e.target.value as BillingCycle, lockedPrice: undefined })}>
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
              </select>
            </Field>
            {withStartDate ? (
              <Field label="Başlangıç">
                <input type="date" className="input" value={l.startDate ?? ''} onChange={(e) => update(l.key, { startDate: e.target.value })} />
              </Field>
            ) : <div />}
            <Field label="İndirim">
              <div className="input-group">
                <input type="number" min={0} max={l.discountType === 'percent' ? 100 : list} className="input" value={l.discountValue || ''} placeholder="0"
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    update(l.key, { discountValue: l.discountType === 'percent' ? Math.min(100, v) : Math.min(list, v) });
                  }} />
                <select className="select" value={l.discountType} onChange={(e) => {
                  const t = e.target.value as DiscountType;
                  update(l.key, { discountType: t, discountValue: t === 'percent' ? Math.min(100, l.discountValue) : l.discountValue });
                }}>
                  <option value="percent">%</option>
                  <option value="amount">₺</option>
                </select>
              </div>
            </Field>
            <div className="sub-row__price">
              {net !== list && <div className="old">{fmtMoney(list)}</div>}
              <div className="net">{fmtMoney(net)}</div>
              <div className="subtle">{l.billingCycle === 'monthly' ? '/ ay' : '/ yıl'}{l.lockedPrice !== undefined && l.lockedPrice !== pkgPrice ? ' · eski fiyat' : ''}</div>
            </div>
            <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
              {withActive && <span title="Aktif"><Switch checked={l.active !== false} onChange={(v) => update(l.key, { active: v })} /></span>}
              <button type="button" className="btn btn-danger-ghost btn-icon btn-sm" onClick={() => onChange(lines.filter((x) => x.key !== l.key))} aria-label="Satırı sil">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
      <div className="row-between wrap">
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}><Plus size={15} /> Paket ekle</button>
        {lines.length > 0 && (
          <div className="summary-box">
            <div><div className="l">Aylık karşılık</div><div className="v">{fmtMoney(monthly)}</div></div>
            <div><div className="l">Yıllık toplam</div><div className="v">{fmtMoney(yearlyTotal)}</div></div>
            {discountTotal > 0 && <div><div className="l">Yıllık indirim</div><div className="v" style={{ color: 'var(--success)' }}>−{fmtMoney(discountTotal)}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}
