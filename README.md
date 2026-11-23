# GümrükCRM

Gümrük müşavirliği / dış ticaret hizmeti veren firmalar için B2B CRM yönetim paneli.
React + TypeScript + Vite ile yazıldı; veritabanı olarak **Supabase**, barındırma ve
zamanlanmış e-postalar için **Cloudflare** (Pages + Workers Cron) hedeflenmiştir.

> Şu an **demo modunda** çalışır: tüm veriler hayalidir ve tarayıcının `localStorage`
> alanında tutulur. Supabase bağlantısı için aşağıdaki "Supabase'e geçiş" bölümüne bakın.

## Hızlı başlangıç

```bash
npm install
npm run dev        # http://localhost:5173
```

Demo kullanıcıları (şifre hepsi için `demo123`):

| Kullanıcı | E-posta | Rol |
|---|---|---|
| Ayşe Yılmaz | admin@ornekgumruk.com | Yönetici (Admin) |
| Mehmet Kaya | mehmet@ornekgumruk.com | Müdür |
| Elif Demir | elif@ornekgumruk.com | Satış Temsilcisi |
| Burak Şahin | burak@ornekgumruk.com | Satış Temsilcisi |
| Zeynep Arslan | zeynep@ornekgumruk.com | Muhasebe |
| Can Öztürk | can@ornekgumruk.com | Görüntüleyici |

Demo verisini sıfırlamak için: **Ayarlar → Veri → Sıfırla**.

## Özellikler

**Müşteriler**
- Firma adı, vergi no/dairesi, sektör, yetkili, iletişim, şehir/ilçe/adres, başlangıç tarihi, durum, temsilci, etiket, not
- Birden çok **hizmet paketi (iş kalemi)**; her biri için **aylık / yıllık** periyot ve başlangıç tarihi
- Fiyatlar paket liste fiyatından gelir; müşteri kaydında satır bazında **indirim (% veya ₺)** girilir
- Aylık karşılık (MRR), yıllık toplam ve verilen indirim anlık hesaplanır
- Filtreler: arama, **iş kalemi**, **şehir**, **başlangıç tarih aralığı**, durum, periyot, temsilci (URL'de saklanır, paylaşılabilir)
- Sıralama, sayfalama, CSV dışa aktarma
- Müşteri kartı: paketler, ödeme planı, aktivite zaman çizelgesi, görevler

**Potansiyel müşteriler (hizmet almayan firmalar)**
- Aynı bilgilerle kayıt + ilgilendiği paketler ve teklif indirimi
- Satış hunisi: Yeni → İletişim → Teklif → Müzakere → Kazanıldı / Kaybedildi
- Sürükle-bırak **Kanban panosu** ve liste görünümü, kazanma olasılığı, ağırlıklı huni değeri
- Tek tıkla **müşteriye dönüştürme** (paketler aboneliğe, geçmiş aktiviteler müşteri kartına taşınır)

**Ödemeler & bildirimler**
- Abonelik periyoduna göre **otomatik ödeme planı** (12 ay ileri)
- Yaklaşan / gecikmiş / ödenen sekmeleri, tahsilat kaydı (yöntem, tarih, fatura no), geri alma
- Admin'e **günlük, haftalık veya aylık** e-posta özeti: gönderim saati, kaç gün öncesi, geciken dahil mi, alıcı listesi
- E-posta önizleme, test gönderimi, e-posta kayıtları; üst bardaki bildirim zili

**Kullanıcılar & yetkiler**
- Kullanıcı ekleme (davet e-postası), düzenleme, pasifleştirme, silme (müşterileri devredilir), şifre sıfırlama
- 5 rol: Admin, Müdür, Satış, Muhasebe, Görüntüleyici
- **Düzenlenebilir yetki matrisi** (20 izin); menü, buton ve sayfalar yetkiye göre gizlenir
- Son admin silinemez / pasifleştirilemez; kullanıcı kendini silemez

**Standart CRM özellikleri**
- Gösterge paneli: KPI'lar, nakit akışı grafiği, paket bazlı gelir, yaklaşan ödemeler, görevlerim, huni, son aktiviteler
- Görevler (öncelik, atama, ilgili kayıt, gecikmiş/bugün/bu hafta gruplaması)
- Aktivite kaydı (arama, toplantı, e-posta, not)
- Raporlar: aylık tahsilat, yeni müşteri, paket performansı, şehir/sektör dağılımı, kaynak dönüşümü, temsilci performansı
- Global arama (⌘K / Ctrl+K), denetim kaydı (audit log), açık/koyu tema, mobil uyumlu arayüz, JSON yedek

## Proje yapısı

```
src/
  data/        types.ts (domain modeli), seed.ts (hayali veri), store.ts (depo + aksiyonlar), supabase.ts
  lib/         constants.ts (roller, yetkiler, etiketler), utils.ts (tarih/para/fiyat), digest.ts (e-posta şablonu)
  components/  Layout, ui (Modal, Toast, Badge…), PackageLinesEditor, PaymentsTable, ActivityFeed, Task*
  pages/       Dashboard, Customers, CustomerForm/Detail, Leads, LeadForm/Detail, Payments, Packages,
               Tasks, Reports, Users, Settings, Login
  styles/      global.css (token tabanlı tasarım sistemi, açık/koyu tema)
supabase/migrations/0001_init.sql   Tablolar, enum'lar, RLS politikaları, ödeme planı trigger'ı
workers/payment-reminder/           Cloudflare Worker (cron) — ödeme özet e-postası (Resend)
```

## Supabase'e geçiş

1. Supabase projesi oluşturun, `supabase/migrations/0001_init.sql` dosyasını çalıştırın
   (`supabase db push` veya SQL Editor).
2. `.env.example` → `.env` kopyalayın, `VITE_DATA_MODE=supabase` ve URL/anon key'i girin.
3. `src/data/store.ts` içindeki `actions` fonksiyonları aynı imzayla Supabase çağrılarına
   bağlanır (örnekler: `src/data/supabase.ts` → `fetchCustomers`, `upsertCustomer`).
   Oturum açma `supabase.auth.signInWithPassword`, kullanıcı daveti `auth.admin.inviteUserByEmail`
   (Edge Function / Worker üzerinden) ile yapılır.
4. Ödeme planı DB tarafında `generate_payment_schedule` trigger'ı ile üretilir; yetkiler
   `role_permissions` tablosu + RLS (`has_perm()`) ile sunucuda zorunlu tutulur.

## Cloudflare

**Panel (Pages):** Build komutu `npm run build`, çıktı klasörü `dist`. SPA yönlendirmesi
`public/_redirects` ile hazır. Ortam değişkenlerini Pages ayarlarından girin.

**E-posta Worker'ı:**

```bash
cd workers/payment-reminder
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

Worker her saat başı çalışır; panelden ayarlanan saat ve sıklık (günlük/haftalık/aylık)
eşleştiğinde özet e-postayı gönderir ve `email_log` tablosuna yazar.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tip kontrolü + üretim derlemesi |
| `npm run preview` | Derlenmiş çıktıyı önizle |
| `npm run typecheck` | Yalnızca TypeScript kontrolü |
