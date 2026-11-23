// ---------------------------------------------------------------------------
// Domain modeli. Supabase şeması (supabase/migrations/0001_init.sql) ile birebir
// eşleşecek şekilde tasarlandı. camelCase <-> snake_case dönüşümü repository
// katmanında yapılır.
// ---------------------------------------------------------------------------

export type ID = string;

export type Role = 'admin' | 'manager' | 'sales' | 'accounting' | 'viewer';

export type Permission =
  | 'dashboard.view'
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.delete'
  | 'leads.view'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.delete'
  | 'payments.view'
  | 'payments.edit'
  | 'packages.view'
  | 'packages.manage'
  | 'tasks.view'
  | 'tasks.manage'
  | 'reports.view'
  | 'users.manage'
  | 'settings.manage'
  | 'audit.view'
  | 'export.data';

export interface User {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  title?: string;
  createdAt: string;
  lastLoginAt?: string;
  /** Yalnızca demo modunda: e-posta ile tuzlanmış SHA-256 şifre özeti */
  passwordHash?: string;
}

export type BillingCycle = 'monthly' | 'yearly';
export type DiscountType = 'percent' | 'amount';

export interface ServicePackage {
  id: ID;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  color: string;
  active: boolean;
  createdAt: string;
}

/** Müşterinin aldığı bir hizmet paketi (abonelik satırı). */
export interface Subscription {
  id: ID;
  packageId: ID;
  billingCycle: BillingCycle;
  startDate: string; // ISO yyyy-mm-dd
  endDate?: string;
  listPrice: number; // kayıt anındaki liste fiyatı (paketten)
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
}

export type CustomerStatus = 'active' | 'passive' | 'suspended';

export interface Customer {
  id: ID;
  companyName: string;
  taxNumber: string;
  taxOffice: string;
  sector: string;
  contactName: string;
  contactTitle?: string;
  email: string;
  phone: string;
  city: string;
  district?: string;
  address?: string;
  website?: string;
  startDate: string;
  status: CustomerStatus;
  ownerId: ID;
  tags: string[];
  notes?: string;
  subscriptions: Subscription[];
  createdAt: string;
  updatedAt: string;
}

export type LeadStage = 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type LeadSource = 'website' | 'referral' | 'phone' | 'fair' | 'linkedin' | 'email' | 'other';

export interface LeadInterest {
  packageId: ID;
  billingCycle: BillingCycle;
  discountType: DiscountType;
  discountValue: number;
}

export interface Lead {
  id: ID;
  companyName: string;
  sector: string;
  contactName: string;
  contactTitle?: string;
  email: string;
  phone: string;
  city: string;
  source: LeadSource;
  stage: LeadStage;
  probability: number; // %
  expectedCloseDate?: string;
  interests: LeadInterest[];
  ownerId: ID;
  tags: string[];
  notes?: string;
  lostReason?: string;
  convertedCustomerId?: ID;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'cancelled';

export interface Payment {
  id: ID;
  customerId: ID;
  subscriptionId: ID;
  packageId: ID;
  periodLabel: string;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
  method?: 'transfer' | 'card' | 'cash' | 'check';
  invoiceNo?: string;
}

export type ActivityType = 'call' | 'meeting' | 'email' | 'note' | 'system';

export interface Activity {
  id: ID;
  entityType: 'customer' | 'lead';
  entityId: ID;
  type: ActivityType;
  content: string;
  userId: ID;
  createdAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: ID;
  title: string;
  description?: string;
  dueDate: string;
  priority: TaskPriority;
  done: boolean;
  assigneeId: ID;
  relatedType?: 'customer' | 'lead';
  relatedId?: ID;
  createdBy: ID;
  createdAt: string;
}

export interface AuditEntry {
  id: ID;
  userId: ID;
  action: 'create' | 'update' | 'delete' | 'login' | 'convert' | 'payment' | 'settings' | 'email';
  entity: string;
  entityLabel: string;
  createdAt: string;
}

export type DigestFrequency = 'daily' | 'weekly' | 'monthly';

export interface NotificationSettings {
  enabled: boolean;
  frequency: DigestFrequency;
  sendHour: number; // 0-23
  monthlyDay: number; // 1-28, aylık özet için
  daysAhead: number; // kaç gün içindeki ödemeler
  includeOverdue: boolean;
  recipients: string[];
  lastDigestAt?: string;
}

export interface EmailLog {
  id: ID;
  to: string[];
  subject: string;
  html: string;
  kind: 'digest' | 'invite' | 'test' | 'reminder';
  status: 'sent' | 'simulated' | 'failed';
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  currency: 'TRY' | 'USD' | 'EUR';
  vatRate: number;
}

export interface Database {
  version: number;
  users: User[];
  packages: ServicePackage[];
  customers: Customer[];
  leads: Lead[];
  payments: Payment[];
  activities: Activity[];
  tasks: Task[];
  audit: AuditEntry[];
  emails: EmailLog[];
  rolePermissions: Record<Role, Permission[]>;
  notification: NotificationSettings;
  company: CompanySettings;
}
