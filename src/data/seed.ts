// Hayali (demo) veri üreticisi. Deterministik PRNG kullanır; tarihler "bugün"e
// göre göreli üretilir ki demo her zaman güncel görünsün.
import { CITIES, DEFAULT_ROLE_PERMISSIONS, LEAD_STAGES, SECTORS } from '@/lib/constants';
import { addDays, addMonths, buildSchedule, listPriceFor, today, uid } from '@/lib/utils';
import type {
  Activity, ActivityType, AuditEntry, BillingCycle, Customer, Database, Lead, LeadSource, Payment,
  ServicePackage, Subscription, Task, User,
} from './types';

export const DB_VERSION = 5;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed(): Database {
  const rnd = mulberry32(20261123);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
  const chance = (p: number) => rnd() < p;
  const T = today();
  const minDate = (a: string, b: string) => (a < b ? a : b);
  const iso = (d: string, h = int(8, 18), m = int(0, 59)) => new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();

  // ----- Kullanıcılar -----
  const users: User[] = [
    { id: 'u_admin', name: 'Murat Kahraman', email: 'murat@ornekgumruk.com', role: 'admin', title: 'Genel Müdür', phone: '0532 111 22 33', active: true, createdAt: iso(addDays(T, -720)) },
    { id: 'u_manager', name: 'Mehmet Kaya', email: 'mehmet@ornekgumruk.com', role: 'manager', title: 'Operasyon Müdürü', phone: '0533 222 33 44', active: true, createdAt: iso(addDays(T, -650)) },
    { id: 'u_sales1', name: 'Elif Demir', email: 'elif@ornekgumruk.com', role: 'sales', title: 'Kıdemli Satış Uzmanı', phone: '0535 333 44 55', active: true, createdAt: iso(addDays(T, -500)) },
    { id: 'u_sales2', name: 'Burak Şahin', email: 'burak@ornekgumruk.com', role: 'sales', title: 'Satış Temsilcisi', phone: '0536 444 55 66', active: true, createdAt: iso(addDays(T, -300)) },
    { id: 'u_acc', name: 'Zeynep Arslan', email: 'zeynep@ornekgumruk.com', role: 'accounting', title: 'Muhasebe Sorumlusu', phone: '0537 555 66 77', active: true, createdAt: iso(addDays(T, -420)) },
    { id: 'u_viewer', name: 'Can Öztürk', email: 'can@ornekgumruk.com', role: 'viewer', title: 'Stajyer', active: true, createdAt: iso(addDays(T, -60)) },
    { id: 'u_old', name: 'Selin Aydın', email: 'selin@ornekgumruk.com', role: 'sales', title: 'Satış Temsilcisi', active: false, createdAt: iso(addDays(T, -800)) },
  ];
  const owners = ['u_sales1', 'u_sales2', 'u_manager', 'u_sales1'];

  // ----- Hizmet paketleri -----
  const packages: ServicePackage[] = [
    { id: 'p_ith', code: 'ITH', name: 'İthalat Gümrük Müşavirliği', color: '#2563eb', monthlyPrice: 12500, yearlyPrice: 135000, active: true, createdAt: iso(addDays(T, -720)),
      description: 'İthalat beyannamelerinin hazırlanması, tarife/GTİP tespiti ve gümrük vergisi hesaplamaları.',
      features: ['Aylık 40 beyannameye kadar', 'GTİP & tarife danışmanlığı', 'Vergi / KDV hesaplama', 'Özel müşteri temsilcisi'] },
    { id: 'p_ihr', code: 'IHR', name: 'İhracat Beyanname Hizmetleri', color: '#0891b2', monthlyPrice: 9500, yearlyPrice: 102000, active: true, createdAt: iso(addDays(T, -720)),
      description: 'İhracat beyannamesi, e-ihracat ve dahilde işleme rejimi kapsamındaki işlemler.',
      features: ['Sınırsız ihracat beyannamesi', 'DİİB kapatma desteği', 'E-ihracat (ETGB)', 'KDV iadesi evrakı'] },
    { id: 'p_ant', code: 'ANT', name: 'Antrepo & Transit Rejim', color: '#7c3aed', monthlyPrice: 15000, yearlyPrice: 162000, active: true, createdAt: iso(addDays(T, -720)),
      description: 'Antrepo stok takibi, transit (NCTS) beyanları ve geçici depolama yönetimi.',
      features: ['NCTS transit beyanı', 'Antrepo stok raporlama', 'Teminat yönetimi', '7/24 operasyon hattı'] },
    { id: 'p_dtd', code: 'DTD', name: 'Dış Ticaret & Mevzuat Danışmanlığı', color: '#ea580c', monthlyPrice: 7500, yearlyPrice: 81000, active: true, createdAt: iso(addDays(T, -720)),
      description: 'Gümrük mevzuatı, teşvik, YYS (AEO) hazırlığı ve uyum denetimi danışmanlığı.',
      features: ['Aylık mevzuat bülteni', 'Teşvik & destek analizi', 'Ön denetim raporu', 'Eğitim (4 saat/ay)'] },
    { id: 'p_blg', code: 'BLG', name: 'Belge & Sertifika Hizmetleri', color: '#16a34a', monthlyPrice: 4500, yearlyPrice: 48000, active: true, createdAt: iso(addDays(T, -720)),
      description: 'Menşe şahadetnamesi, A.TR, EUR.1, form-A ve onaylı belge süreçleri.',
      features: ['A.TR / EUR.1 düzenleme', 'Menşe şahadetnamesi', 'Konsolosluk onayları', 'Dijital arşiv'] },
  ];

  // ----- Müşteriler -----
  const prefixes = ['Anadolu', 'Ege', 'Marmara', 'Akdeniz', 'Karadeniz', 'Toros', 'Kuzey', 'Yıldız', 'Atlas', 'Boğaziçi', 'Kapadokya', 'Mavi', 'Doruk', 'Lider', 'Avrasya', 'Orion', 'Delta', 'Nova', 'Meridyen', 'Liman', 'Körfez', 'Zirve', 'Başak', 'Ufuk', 'Safir', 'Efes', 'Selçuk', 'Pera', 'Galata', 'Asil', 'Tuna', 'Rota', 'Kartal', 'Zümrüt', 'Pusula', 'Sedef', 'Aksu', 'Çınar', 'Defne', 'Kaya', 'Ekin', 'Vizyon'];
  const sectorWord: Record<string, string> = {
    'Tekstil': 'Tekstil', 'Otomotiv Yan Sanayi': 'Otomotiv', 'Gıda': 'Gıda', 'Kimya': 'Kimya', 'Makine': 'Makina',
    'Elektronik': 'Elektronik', 'Mobilya': 'Mobilya', 'İnşaat Malzemeleri': 'Yapı', 'Medikal': 'Medikal',
    'E-ticaret': 'Dijital Ticaret', 'Tarım': 'Tarım Ürünleri', 'Lojistik': 'Lojistik', 'Ambalaj': 'Ambalaj', 'Enerji': 'Enerji',
  };
  const suffixes = ['A.Ş.', 'Ltd. Şti.', 'San. ve Tic. A.Ş.', 'İth. İhr. Ltd. Şti.'];
  const firstNames = ['Ahmet', 'Fatma', 'Mustafa', 'Emine', 'Ali', 'Hatice', 'Hasan', 'Zehra', 'Hüseyin', 'Merve', 'Murat', 'Seda', 'Kemal', 'Derya', 'Oğuz', 'Gizem', 'Serkan', 'Büşra', 'Tolga', 'Pınar', 'Emre', 'Cansu', 'Volkan', 'Ebru'];
  const lastNames = ['Yıldız', 'Çelik', 'Şimşek', 'Koç', 'Kurt', 'Özdemir', 'Aslan', 'Doğan', 'Kılıç', 'Arslan', 'Erdoğan', 'Polat', 'Aksoy', 'Tekin', 'Güneş', 'Korkmaz', 'Bulut', 'Karaca'];
  const titles = ['Dış Ticaret Müdürü', 'Satın Alma Müdürü', 'Genel Müdür', 'Finans Müdürü', 'Lojistik Sorumlusu', 'İhracat Uzmanı'];
  const taxOffices: Record<string, string> = { 'İstanbul': 'Kozyatağı', 'İzmir': 'Karşıyaka', 'Ankara': 'Çankaya', 'Mersin': 'Uray', 'Bursa': 'Nilüfer', 'Kocaeli': 'Tepecik' };
  const tagPool = ['VIP', 'Yoğun Hacim', 'AEO Adayı', 'Yeni', 'Sözleşme Yenileme', 'Çok Şubeli'];
  const weightedCities = ['İstanbul', 'İstanbul', 'İstanbul', 'İzmir', 'İzmir', 'Mersin', 'Mersin', 'Kocaeli', 'Bursa', 'Ankara', ...CITIES];
  const slug = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]/g, '');

  const customers: Customer[] = [];
  const payments: Payment[] = [];
  const horizon = addMonths(T, 12);

  for (let i = 0; i < 42; i++) {
    const sector = pick(SECTORS);
    const prefix = prefixes[i % prefixes.length];
    const companyName = `${prefix} ${sectorWord[sector]} ${pick(suffixes)}`;
    const city = pick(weightedCities);
    const fn = pick(firstNames); const ln = pick(lastNames);
    const status: Customer['status'] = i % 13 === 7 ? 'passive' : i % 17 === 5 ? 'suspended' : 'active';
    const startDate = addDays(T, -(status === 'active' ? int(5, 900) : int(300, 900)));
    const count = chance(0.45) ? 1 : chance(0.65) ? 2 : 3;
    const pkgIds = [...packages].sort(() => rnd() - 0.5).slice(0, count).map((p) => p.id);
    const subscriptions: Subscription[] = pkgIds.map((pid, k) => {
      const cycle: BillingCycle = chance(0.68) ? 'monthly' : 'yearly';
      const pkg = packages.find((p) => p.id === pid)!;
      const hasDiscount = chance(0.4);
      const percent = chance(0.75);
      return {
        id: uid('s_'),
        packageId: pid,
        billingCycle: cycle,
        startDate: k === 0 ? startDate : addDays(startDate, int(0, 120)),
        endDate: status === 'passive' ? addDays(T, -int(10, 90)) : undefined,
        listPrice: listPriceFor(pkg, cycle),
        discountType: (percent ? 'percent' : 'amount') as Subscription['discountType'],
        discountValue: hasDiscount ? (percent ? pick([5, 10, 15, 20]) : pick([500, 1000, 1500]) * (cycle === 'yearly' ? 6 : 1)) : 0,
        active: status !== 'passive',
      };
    }).map((s) => (s.startDate > T ? { ...s, startDate: T } : s));

    const id = `c_${String(i + 1).padStart(3, '0')}`;
    const createdAt = iso(startDate);
    customers.push({
      id, companyName, sector, city,
      taxNumber: String(int(1000000000, 9999999999)),
      taxOffice: taxOffices[city] ?? `${city} Merkez`,
      contactName: `${fn} ${ln}`,
      contactTitle: pick(titles),
      email: `${slug(fn)}.${slug(ln)}@${slug(prefix)}${slug(sectorWord[sector]).slice(0, 6)}.com.tr`,
      phone: `0${pick(['212', '216', '232', '324', '262', '224', '312'])} ${int(200, 999)} ${int(10, 99)} ${int(10, 99)}`,
      district: pick(['Merkez', 'Organize Sanayi', 'Serbest Bölge', 'Liman Bölgesi']),
      address: `${pick(['Atatürk', 'Cumhuriyet', 'İnönü', 'Gazi', 'Fevzi Çakmak'])} Cad. No:${int(1, 220)}`,
      website: `www.${slug(prefix)}${slug(sectorWord[sector]).slice(0, 6)}.com.tr`,
      startDate, status,
      ownerId: pick(owners),
      tags: chance(0.5) ? [pick(tagPool)] : [],
      notes: chance(0.3) ? 'Aylık hacim yüksek; beyanname süreleri kritik.' : undefined,
      subscriptions,
      createdAt, updatedAt: createdAt,
    });

    for (const s of subscriptions) {
      for (const row of buildSchedule(id, s, horizon)) {
        const past = row.dueDate < T;
        const overdue = past && (status === 'suspended' ? chance(0.6) : chance(0.06)) && row.dueDate > addDays(T, -75);
        const paid = past && !overdue;
        payments.push({
          ...row, id: uid('pay_'),
          status: paid ? 'paid' : 'pending',
          paidAt: paid ? iso(minDate(addDays(row.dueDate, int(-2, 5)), T)) : undefined,
          method: paid ? pick(['transfer', 'transfer', 'card', 'check'] as const) : undefined,
          invoiceNo: paid ? `GMR${row.dueDate.replace(/-/g, '').slice(0, 6)}${int(1000, 9999)}` : undefined,
        });
      }
    }
  }

  // ----- Potansiyel müşteriler -----
  const leadPrefixes = ['Altın', 'Gümüş', 'Kristal', 'Panorama', 'Aydın', 'Barış', 'Elit', 'Prestij', 'Titan', 'Sarp', 'Umut', 'Inci', 'Akya', 'Bera', 'Mira', 'Arya', 'Kumsal', 'Yaman', 'Nehir', 'Ilgaz', 'Tunç', 'Pera Global', 'Ada', 'Lotus'];
  const sources: LeadSource[] = ['website', 'referral', 'phone', 'fair', 'linkedin', 'email', 'other'];
  const leads: Lead[] = leadPrefixes.map((p, i) => {
    const stage = LEAD_STAGES[i % 6 === 4 ? 4 : i % 7 === 5 ? 5 : int(0, 3)];
    const sector = pick(SECTORS);
    const fn = pick(firstNames); const ln = pick(lastNames);
    const created = addDays(T, -int(1, 120));
    const nInterest = int(1, 3);
    return {
      id: `l_${String(i + 1).padStart(3, '0')}`,
      companyName: `${p} ${sectorWord[sector]} ${pick(suffixes)}`,
      sector, contactName: `${fn} ${ln}`, contactTitle: pick(titles),
      email: `${slug(fn)}@${slug(p)}${slug(sectorWord[sector]).slice(0, 5)}.com`,
      phone: `05${int(30, 55)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
      city: pick(weightedCities),
      source: pick(sources),
      stage: stage.key, probability: stage.probability,
      expectedCloseDate: addDays(T, int(-10, 75)),
      interests: [...packages].sort(() => rnd() - 0.5).slice(0, nInterest).map((pk) => ({
        packageId: pk.id, billingCycle: chance(0.6) ? 'monthly' : 'yearly',
        discountType: 'percent', discountValue: chance(0.3) ? pick([5, 10]) : 0,
      })),
      ownerId: pick(owners),
      tags: chance(0.35) ? [pick(['Sıcak', 'Fuar 2026', 'Fiyat Hassas', 'Kurumsal'])] : [],
      notes: chance(0.4) ? 'Mevcut müşavirlik firmasından memnun değil, teklif bekliyor.' : undefined,
      lostReason: stage.key === 'lost' ? pick(['Fiyat', 'Rakip firma ile devam', 'Bütçe ertelendi']) : undefined,
      createdAt: iso(created), updatedAt: iso(created),
    } satisfies Lead;
  });

  // ----- Aktiviteler -----
  const actTexts: Record<ActivityType, string[]> = {
    call: ['Aylık beyanname hacmi görüşüldü.', 'Fatura detayları için arandı.', 'Yeni sevkiyat planı hakkında bilgi alındı.', 'Teklif sonrası geri dönüş araması yapıldı.'],
    meeting: ['Ofiste tanışma toplantısı yapıldı.', 'Online toplantıda süreçler aktarıldı.', 'Yıllık sözleşme yenileme toplantısı.'],
    email: ['Fiyat teklifi e-posta ile gönderildi.', 'Mevzuat değişikliği bilgilendirmesi iletildi.', 'Eksik evrak listesi gönderildi.'],
    note: ['Karar verici: Genel Müdür.', 'Ödemelerde vade 30 gün talep ediyor.', 'Çin menşeli ürünlerde ek vergi sorusu var.'],
    system: ['Kayıt oluşturuldu.'],
  };
  const activities: Activity[] = [];
  const addActs = (entityType: 'customer' | 'lead', entityId: string, n: number, since: number) => {
    for (let k = 0; k < n; k++) {
      const type = pick(['call', 'meeting', 'email', 'note', 'call'] as ActivityType[]);
      activities.push({ id: uid('a_'), entityType, entityId, type, content: pick(actTexts[type]), userId: pick(owners), createdAt: iso(addDays(T, -int(0, since))) });
    }
  };
  customers.forEach((c) => addActs('customer', c.id, int(1, 4), 120));
  leads.forEach((l) => addActs('lead', l.id, int(1, 3), 40));

  // ----- Görevler -----
  const taskTemplates = [
    'Sözleşme yenileme görüşmesi', 'Teklif hazırla ve gönder', 'Geciken ödeme için ara', 'GTİP tespiti raporunu ilet',
    'YYS ön değerlendirme toplantısı', 'Fatura itirazını incele', 'Antrepo stok raporunu gönder', 'Tanışma toplantısı planla',
    'Mevzuat eğitimi organize et', 'Eksik vekaletname evrakını iste',
  ];
  const tasks: Task[] = Array.from({ length: 20 }, (_, i) => {
    const related = chance(0.5) ? customers[int(0, customers.length - 1)] : leads[int(0, leads.length - 1)];
    const isCust = 'subscriptions' in related;
    return {
      id: uid('t_'), title: pick(taskTemplates),
      description: chance(0.5) ? 'Detaylar müşteri kartındaki notlarda.' : undefined,
      dueDate: addDays(T, int(-4, 14)), priority: pick(['low', 'medium', 'high', 'medium'] as const),
      done: i % 5 === 0, assigneeId: i % 3 === 0 ? 'u_admin' : pick([...owners, 'u_acc']),
      relatedType: isCust ? 'customer' : 'lead', relatedId: related.id,
      createdBy: 'u_manager', createdAt: iso(addDays(T, -int(1, 20))),
    };
  });

  const audit: AuditEntry[] = [
    { id: uid('au_'), userId: 'u_admin', action: 'settings', entity: 'Bildirim', entityLabel: 'Bildirim ayarları güncellendi', createdAt: iso(addDays(T, -3)) },
    { id: uid('au_'), userId: 'u_sales1', action: 'create', entity: 'Müşteri', entityLabel: customers[3].companyName, createdAt: iso(addDays(T, -2)) },
    { id: uid('au_'), userId: 'u_acc', action: 'payment', entity: 'Ödeme', entityLabel: `${customers[5].companyName} tahsilatı`, createdAt: iso(addDays(T, -1)) },
  ];

  return {
    version: DB_VERSION,
    users, packages, customers, leads, payments, activities, tasks, audit,
    emails: [],
    rolePermissions: structuredClone(DEFAULT_ROLE_PERMISSIONS),
    notification: {
      enabled: true, frequency: 'daily', sendHour: 9, monthlyDay: 1, daysAhead: 7, includeOverdue: true,
      recipients: ['murat@ornekgumruk.com', 'zeynep@ornekgumruk.com'],
    },
    company: {
      name: 'Örnek Gümrük Müşavirliği Ltd. Şti.', email: 'info@ornekgumruk.com', phone: '0212 555 00 00',
      address: 'Halkalı Gümrük Müdürlüğü Karşısı, Küçükçekmece / İstanbul', taxNumber: '1234567890', currency: 'TRY', vatRate: 20,
    },
  };
}
