import type {
  ActivityType, BillingCycle, CustomerStatus, LeadSource, LeadStage, Permission, Role, TaskPriority,
} from '@/data/types';

export const CITIES = [
  'Adana', 'Ankara', 'Antalya', 'Bursa', 'Denizli', 'Edirne', 'Gaziantep', 'Hatay', 'İstanbul', 'İzmir',
  'Kayseri', 'Kocaeli', 'Konya', 'Manisa', 'Mersin', 'Samsun', 'Tekirdağ', 'Trabzon', 'Van', 'Zonguldak',
];

export const SECTORS = [
  'Tekstil', 'Otomotiv Yan Sanayi', 'Gıda', 'Kimya', 'Makine', 'Elektronik', 'Mobilya', 'İnşaat Malzemeleri',
  'Medikal', 'E-ticaret', 'Tarım', 'Lojistik', 'Ambalaj', 'Enerji',
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Yönetici (Admin)',
  manager: 'Müdür',
  sales: 'Satış Temsilcisi',
  accounting: 'Muhasebe',
  viewer: 'Görüntüleyici',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Tüm modüllere tam erişim, kullanıcı ve yetki yönetimi.',
  manager: 'Müşteri, aday, paket ve raporları yönetir; kullanıcı yönetemez.',
  sales: 'Müşteri ve aday kaydı açar, düzenler, görev ve aktivite girer.',
  accounting: 'Ödemeleri takip eder, tahsilat işler, raporları görür.',
  viewer: 'Yalnızca okuma yetkisi.',
};

export const PERMISSION_GROUPS: { group: string; items: { key: Permission; label: string }[] }[] = [
  { group: 'Genel', items: [
    { key: 'dashboard.view', label: 'Gösterge panelini görüntüle' },
    { key: 'reports.view', label: 'Raporları görüntüle' },
    { key: 'export.data', label: 'Veri dışa aktar (CSV)' },
  ] },
  { group: 'Müşteriler', items: [
    { key: 'customers.view', label: 'Görüntüle' },
    { key: 'customers.create', label: 'Oluştur' },
    { key: 'customers.edit', label: 'Düzenle' },
    { key: 'customers.delete', label: 'Sil' },
  ] },
  { group: 'Potansiyel Müşteriler', items: [
    { key: 'leads.view', label: 'Görüntüle' },
    { key: 'leads.create', label: 'Oluştur' },
    { key: 'leads.edit', label: 'Düzenle' },
    { key: 'leads.delete', label: 'Sil' },
  ] },
  { group: 'Finans', items: [
    { key: 'payments.view', label: 'Ödemeleri görüntüle' },
    { key: 'payments.edit', label: 'Tahsilat işle' },
  ] },
  { group: 'Hizmet Paketleri', items: [
    { key: 'packages.view', label: 'Görüntüle' },
    { key: 'packages.manage', label: 'Paket & fiyat yönet' },
  ] },
  { group: 'Görevler', items: [
    { key: 'tasks.view', label: 'Görüntüle' },
    { key: 'tasks.manage', label: 'Oluştur / düzenle' },
  ] },
  { group: 'Yönetim', items: [
    { key: 'users.manage', label: 'Kullanıcı yönetimi' },
    { key: 'settings.manage', label: 'Ayarlar & bildirimler' },
    { key: 'audit.view', label: 'Denetim kaydı' },
  ] },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  manager: ALL_PERMISSIONS.filter((p) => !['users.manage', 'settings.manage'].includes(p)),
  sales: [
    'dashboard.view', 'customers.view', 'customers.create', 'customers.edit',
    'leads.view', 'leads.create', 'leads.edit', 'packages.view', 'payments.view', 'tasks.view', 'tasks.manage',
  ],
  accounting: [
    'dashboard.view', 'customers.view', 'payments.view', 'payments.edit', 'packages.view', 'reports.view',
    'export.data', 'tasks.view',
  ],
  viewer: ['dashboard.view', 'customers.view', 'leads.view', 'packages.view', 'payments.view', 'tasks.view'],
};

export const CYCLE_LABELS: Record<BillingCycle, string> = { monthly: 'Aylık', yearly: 'Yıllık' };

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; tone: Tone }> = {
  active: { label: 'Aktif', tone: 'success' },
  passive: { label: 'Pasif', tone: 'neutral' },
  suspended: { label: 'Askıda', tone: 'warning' },
};

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

export const LEAD_STAGES: { key: LeadStage; label: string; tone: Tone; probability: number }[] = [
  { key: 'new', label: 'Yeni', tone: 'info', probability: 10 },
  { key: 'contacted', label: 'İletişime Geçildi', tone: 'primary', probability: 25 },
  { key: 'proposal', label: 'Teklif Verildi', tone: 'purple', probability: 50 },
  { key: 'negotiation', label: 'Müzakere', tone: 'warning', probability: 75 },
  { key: 'won', label: 'Kazanıldı', tone: 'success', probability: 100 },
  { key: 'lost', label: 'Kaybedildi', tone: 'danger', probability: 0 },
];
export const STAGE_MAP = Object.fromEntries(LEAD_STAGES.map((s) => [s.key, s])) as Record<LeadStage, (typeof LEAD_STAGES)[number]>;

export const LEAD_SOURCES: Record<LeadSource, string> = {
  website: 'Web Sitesi', referral: 'Referans', phone: 'Telefon', fair: 'Fuar',
  linkedin: 'LinkedIn', email: 'E-posta', other: 'Diğer',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: 'Telefon Görüşmesi', meeting: 'Toplantı', email: 'E-posta', note: 'Not', system: 'Sistem',
};

export const PRIORITY: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: 'Düşük', tone: 'neutral' },
  medium: { label: 'Orta', tone: 'warning' },
  high: { label: 'Yüksek', tone: 'danger' },
};

export const PAYMENT_METHODS = { transfer: 'Havale/EFT', card: 'Kredi Kartı', cash: 'Nakit', check: 'Çek' } as const;
