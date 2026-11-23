-- ===========================================================================
-- GümrükCRM — Supabase şeması
-- Uygulama: supabase db push  (veya SQL Editor'e yapıştırın)
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------- Enum'lar ----------
create type user_role       as enum ('admin', 'manager', 'sales', 'accounting', 'viewer');
create type billing_cycle   as enum ('monthly', 'yearly');
create type discount_type   as enum ('percent', 'amount');
create type customer_status as enum ('active', 'passive', 'suspended');
create type lead_stage      as enum ('new', 'contacted', 'proposal', 'negotiation', 'won', 'lost');
create type lead_source     as enum ('website', 'referral', 'phone', 'fair', 'linkedin', 'email', 'other');
create type payment_status  as enum ('pending', 'paid', 'cancelled');
create type activity_type   as enum ('call', 'meeting', 'email', 'note', 'system');
create type task_priority   as enum ('low', 'medium', 'high');
create type digest_frequency as enum ('daily', 'weekly', 'monthly');

-- ---------- Profiller (auth.users ile 1-1) ----------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  email         text not null unique,
  phone         text,
  title         text,
  role          user_role not null default 'viewer',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Rol → yetki eşlemesi (Ayarlar > Roller & Yetkiler ekranı)
create table role_permissions (
  role        user_role primary key,
  permissions text[] not null default '{}'
);

-- ---------- Hizmet paketleri ----------
create table packages (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text not null default '',
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  yearly_price  numeric(12,2) not null check (yearly_price >= 0),
  features      text[] not null default '{}',
  color         text not null default '#2563eb',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- Müşteriler ----------
create table customers (
  id            uuid primary key default gen_random_uuid(),
  company_name  text not null,
  tax_number    text,
  tax_office    text,
  sector        text,
  contact_name  text not null,
  contact_title text,
  email         text,
  phone         text,
  city          text not null,
  district      text,
  address       text,
  website       text,
  start_date    date not null default current_date,
  status        customer_status not null default 'active',
  owner_id      uuid references profiles(id) on delete set null,
  tags          text[] not null default '{}',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customers_city_idx   on customers(city);
create index customers_start_idx  on customers(start_date);
create index customers_owner_idx  on customers(owner_id);
create index customers_search_idx on customers using gin (to_tsvector('simple', company_name || ' ' || coalesce(contact_name,'')));

-- Müşteri ↔ paket (abonelik). Fiyat kayıt anında paketten kopyalanır, indirim satır bazında.
create table subscriptions (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  package_id     uuid not null references packages(id) on delete restrict,
  billing_cycle  billing_cycle not null,
  start_date     date not null,
  end_date       date,
  list_price     numeric(12,2) not null,
  discount_type  discount_type not null default 'percent',
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  active         boolean not null default true,
  constraint percent_max check (discount_type <> 'percent' or discount_value <= 100)
);
create index subscriptions_customer_idx on subscriptions(customer_id);
create index subscriptions_package_idx  on subscriptions(package_id);

-- ---------- Potansiyel müşteriler ----------
create table leads (
  id                   uuid primary key default gen_random_uuid(),
  company_name         text not null,
  sector               text,
  contact_name         text not null,
  contact_title        text,
  email                text,
  phone                text,
  city                 text,
  source               lead_source not null default 'other',
  stage                lead_stage not null default 'new',
  probability          int not null default 10 check (probability between 0 and 100),
  expected_close_date  date,
  owner_id             uuid references profiles(id) on delete set null,
  tags                 text[] not null default '{}',
  notes                text,
  lost_reason          text,
  converted_customer_id uuid references customers(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index leads_stage_idx on leads(stage);

create table lead_interests (
  lead_id        uuid not null references leads(id) on delete cascade,
  package_id     uuid not null references packages(id) on delete cascade,
  billing_cycle  billing_cycle not null default 'monthly',
  discount_type  discount_type not null default 'percent',
  discount_value numeric(12,2) not null default 0,
  primary key (lead_id, package_id)
);

-- ---------- Ödemeler ----------
create table payments (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  package_id      uuid not null references packages(id),
  period_label    text not null,
  due_date        date not null,
  amount          numeric(12,2) not null,
  status          payment_status not null default 'pending',
  paid_at         timestamptz,
  method          text check (method in ('transfer','card','cash','check')),
  invoice_no      text,
  unique (subscription_id, due_date)
);
create index payments_due_idx on payments(status, due_date);

-- ---------- Aktivite, görev, denetim ----------
create table activities (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer','lead')),
  entity_id   uuid not null,
  type        activity_type not null,
  content     text not null,
  user_id     uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index activities_entity_idx on activities(entity_type, entity_id, created_at desc);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  due_date     date not null,
  priority     task_priority not null default 'medium',
  done         boolean not null default false,
  assignee_id  uuid references profiles(id) on delete set null,
  related_type text check (related_type in ('customer','lead')),
  related_id   uuid,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table audit_log (
  id           bigserial primary key,
  user_id      uuid references profiles(id) on delete set null,
  action       text not null,
  entity       text not null,
  entity_label text not null,
  created_at   timestamptz not null default now()
);

-- ---------- Ayarlar & e-posta kaydı ----------
create table notification_settings (
  id              int primary key default 1 check (id = 1), -- tek satır
  enabled         boolean not null default true,
  frequency       digest_frequency not null default 'daily',
  send_hour       int not null default 9 check (send_hour between 0 and 23),
  monthly_day     int not null default 1 check (monthly_day between 1 and 28),
  days_ahead      int not null default 7,
  include_overdue boolean not null default true,
  recipients      text[] not null default '{}',
  last_digest_at  timestamptz
);
insert into notification_settings (id) values (1);

create table company_settings (
  id         int primary key default 1 check (id = 1),
  name       text not null default '',
  email      text, phone text, address text, tax_number text,
  currency   text not null default 'TRY',
  vat_rate   numeric(5,2) not null default 20
);
insert into company_settings (id) values (1);

create table email_log (
  id         uuid primary key default gen_random_uuid(),
  "to"       text[] not null,
  subject    text not null,
  html       text not null,
  kind       text not null check (kind in ('digest','invite','test','reminder')),
  status     text not null check (status in ('sent','simulated','failed')),
  error      text,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Fonksiyonlar & tetikleyiciler
-- ===========================================================================

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger customers_touch before update on customers for each row execute function touch_updated_at();
create trigger leads_touch     before update on leads     for each row execute function touch_updated_at();

create or replace function subscription_net(s subscriptions) returns numeric language sql immutable as $$
  select greatest(0, case when s.discount_type = 'percent'
    then s.list_price * (1 - least(s.discount_value, 100) / 100)
    else s.list_price - s.discount_value end)::numeric(12,2)
$$;

-- Abonelik eklenince/değişince gelecekteki ödenmemiş planı yeniden üretir (12 ay ileri).
create or replace function generate_payment_schedule() returns trigger language plpgsql as $$
declare
  step interval := case when new.billing_cycle = 'monthly' then interval '1 month' else interval '1 year' end;
  horizon date := (current_date + interval '12 months')::date;
  d date := new.start_date;
  i int := 0;
  net numeric := subscription_net(new);
begin
  delete from payments where subscription_id = new.id and status = 'pending' and due_date >= current_date;
  if not new.active then return new; end if;
  while d <= coalesce(least(new.end_date, horizon), horizon) and i < 240 loop
    if d >= current_date then
      insert into payments (customer_id, subscription_id, package_id, period_label, due_date, amount)
      values (new.customer_id, new.id, new.package_id,
              case when new.billing_cycle = 'monthly' then to_char(d, 'TMMonth YYYY') else to_char(d, 'YYYY') || ' yıllık' end,
              d, net)
      on conflict (subscription_id, due_date) do nothing;
    end if;
    i := i + 1;
    d := (new.start_date + step * i)::date;
  end loop;
  return new;
end $$;
create trigger subscriptions_schedule after insert or update on subscriptions
  for each row execute function generate_payment_schedule();

-- Yetki kontrolü yardımcıları (RLS'te kullanılır)
create or replace function current_role_name() returns user_role language sql stable security definer as $$
  select role from profiles where id = auth.uid() and active
$$;
create or replace function has_perm(p text) returns boolean language sql stable security definer as $$
  select coalesce(
    (select current_role_name() = 'admin')
    or exists (select 1 from role_permissions rp where rp.role = current_role_name() and p = any(rp.permissions)),
    false)
$$;

-- Yeni auth kullanıcısı → profil
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email,
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'viewer'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table profiles              enable row level security;
alter table role_permissions      enable row level security;
alter table packages              enable row level security;
alter table customers             enable row level security;
alter table subscriptions         enable row level security;
alter table leads                 enable row level security;
alter table lead_interests        enable row level security;
alter table payments              enable row level security;
alter table activities            enable row level security;
alter table tasks                 enable row level security;
alter table audit_log             enable row level security;
alter table notification_settings enable row level security;
alter table company_settings      enable row level security;
alter table email_log             enable row level security;

create policy "profiles read"   on profiles for select using (auth.uid() is not null);
create policy "profiles manage" on profiles for all using (has_perm('users.manage')) with check (has_perm('users.manage'));
create policy "roles read"      on role_permissions for select using (auth.uid() is not null);
create policy "roles manage"    on role_permissions for all using (current_role_name() = 'admin');

create policy "packages read"   on packages for select using (has_perm('packages.view'));
create policy "packages manage" on packages for all using (has_perm('packages.manage')) with check (has_perm('packages.manage'));

create policy "customers read"   on customers for select using (has_perm('customers.view'));
create policy "customers insert" on customers for insert with check (has_perm('customers.create'));
create policy "customers update" on customers for update using (has_perm('customers.edit'));
create policy "customers delete" on customers for delete using (has_perm('customers.delete'));
create policy "subs read"  on subscriptions for select using (has_perm('customers.view'));
create policy "subs write" on subscriptions for all using (has_perm('customers.edit') or has_perm('customers.create'))
  with check (has_perm('customers.edit') or has_perm('customers.create'));

create policy "leads read"   on leads for select using (has_perm('leads.view'));
create policy "leads insert" on leads for insert with check (has_perm('leads.create'));
create policy "leads update" on leads for update using (has_perm('leads.edit'));
create policy "leads delete" on leads for delete using (has_perm('leads.delete'));
create policy "interests read"  on lead_interests for select using (has_perm('leads.view'));
create policy "interests write" on lead_interests for all using (has_perm('leads.edit') or has_perm('leads.create'))
  with check (has_perm('leads.edit') or has_perm('leads.create'));

create policy "payments read"   on payments for select using (has_perm('payments.view'));
create policy "payments update" on payments for update using (has_perm('payments.edit'));

create policy "activities read"  on activities for select using (has_perm('customers.view') or has_perm('leads.view'));
create policy "activities write" on activities for insert with check (user_id = auth.uid());
create policy "activities delete" on activities for delete using (user_id = auth.uid() or current_role_name() = 'admin');

create policy "tasks read"  on tasks for select using (has_perm('tasks.view'));
create policy "tasks write" on tasks for all using (has_perm('tasks.manage')) with check (has_perm('tasks.manage'));

create policy "audit read"   on audit_log for select using (has_perm('audit.view'));
create policy "audit insert" on audit_log for insert with check (user_id = auth.uid());

create policy "notif read"   on notification_settings for select using (auth.uid() is not null);
create policy "notif manage" on notification_settings for update using (has_perm('settings.manage'));
create policy "company read"   on company_settings for select using (auth.uid() is not null);
create policy "company manage" on company_settings for update using (has_perm('settings.manage'));
create policy "email read" on email_log for select using (has_perm('settings.manage'));
-- email_log'a yalnızca service_role (Cloudflare Worker) yazar; RLS service_role'ü atlar.

-- Varsayılan rol yetkileri (src/lib/constants.ts ile aynı)
insert into role_permissions (role, permissions) values
  ('manager', array['dashboard.view','customers.view','customers.create','customers.edit','customers.delete','leads.view','leads.create','leads.edit','leads.delete','payments.view','payments.edit','packages.view','packages.manage','tasks.view','tasks.manage','reports.view','audit.view','export.data']),
  ('sales', array['dashboard.view','customers.view','customers.create','customers.edit','leads.view','leads.create','leads.edit','packages.view','payments.view','tasks.view','tasks.manage']),
  ('accounting', array['dashboard.view','customers.view','payments.view','payments.edit','packages.view','reports.view','export.data','tasks.view']),
  ('viewer', array['dashboard.view','customers.view','leads.view','packages.view','payments.view','tasks.view']);

-- Örnek paketler
insert into packages (code, name, description, monthly_price, yearly_price, color, features) values
  ('ITH', 'İthalat Gümrük Müşavirliği', 'İthalat beyannameleri, GTİP tespiti ve vergi hesaplamaları.', 12500, 135000, '#2563eb', array['Aylık 40 beyannameye kadar','GTİP & tarife danışmanlığı','Vergi / KDV hesaplama','Özel müşteri temsilcisi']),
  ('IHR', 'İhracat Beyanname Hizmetleri', 'İhracat beyannamesi, e-ihracat ve DİİB işlemleri.', 9500, 102000, '#0891b2', array['Sınırsız ihracat beyannamesi','DİİB kapatma desteği','E-ihracat (ETGB)','KDV iadesi evrakı']),
  ('ANT', 'Antrepo & Transit Rejim', 'Antrepo stok takibi, NCTS transit beyanları.', 15000, 162000, '#7c3aed', array['NCTS transit beyanı','Antrepo stok raporlama','Teminat yönetimi','7/24 operasyon hattı']),
  ('DTD', 'Dış Ticaret & Mevzuat Danışmanlığı', 'Mevzuat, teşvik, YYS (AEO) hazırlığı.', 7500, 81000, '#ea580c', array['Aylık mevzuat bülteni','Teşvik & destek analizi','Ön denetim raporu','Eğitim (4 saat/ay)']),
  ('BLG', 'Belge & Sertifika Hizmetleri', 'Menşe şahadetnamesi, A.TR, EUR.1 süreçleri.', 4500, 48000, '#16a34a', array['A.TR / EUR.1 düzenleme','Menşe şahadetnamesi','Konsolosluk onayları','Dijital arşiv']);

-- Raporlama görünümü: yaklaşan & geciken ödemeler (Worker bunu okur)
create or replace view v_payment_digest as
select p.id, p.due_date, p.amount, p.period_label, p.status,
       (p.due_date - current_date) as days_left,
       c.company_name, c.city, pk.name as package_name
from payments p
join customers c on c.id = p.customer_id
join packages pk on pk.id = p.package_id
where p.status = 'pending';
