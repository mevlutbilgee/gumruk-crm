/**
 * GümrükCRM — Ödeme hatırlatma Worker'ı (Cloudflare Cron Trigger)
 *
 * Her saat başı tetiklenir. Supabase'teki notification_settings satırını okur;
 * etkinse ve saat/sıklık eşleşiyorsa yaklaşan + geciken ödemeleri toplayıp
 * Resend üzerinden yöneticilere özet e-postası gönderir ve email_log'a yazar.
 */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  TIMEZONE: string;
  /** Manuel tetikleme için ayrı bir gizli anahtar */
  RUN_TOKEN?: string;
}

interface Settings {
  enabled: boolean; frequency: 'daily' | 'weekly' | 'monthly'; send_hour: number; monthly_day: number;
  days_ahead: number; include_overdue: boolean; recipients: string[]; last_digest_at: string | null;
}
interface Row { due_date: string; amount: number; period_label: string; days_left: number; company_name: string; city: string; package_name: string }

const money = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

async function sb<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

function localParts(tz: string, d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, day: Number(p.day), weekday: p.weekday };
}

function shouldSend(s: Settings, tz: string, force: boolean) {
  if (force) return true;
  if (!s.enabled || s.recipients.length === 0) return false;
  const now = localParts(tz);
  if (now.hour !== s.send_hour) return false;
  if (s.last_digest_at && localParts(tz, new Date(s.last_digest_at)).date === now.date) return false;
  if (s.frequency === 'weekly' && now.weekday !== 'Mon') return false;
  if (s.frequency === 'monthly' && now.day !== s.monthly_day) return false;
  return true;
}

function render(title: string, upcoming: Row[], overdue: Row[], includeOverdue: boolean) {
  const table = (rows: Row[], color: string) => rows.length === 0 ? '<p style="color:#64748b">Kayıt yok.</p>' :
    `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 24px"><thead><tr style="background:#f1f5f9;text-align:left">
      <th style="padding:8px">Firma</th><th style="padding:8px">Paket</th><th style="padding:8px">Dönem</th><th style="padding:8px">Vade</th><th style="padding:8px;text-align:right">Tutar</th></tr></thead><tbody>
      ${rows.map((r) => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px;font-weight:600">${r.company_name}</td><td style="padding:8px">${r.package_name}</td>
      <td style="padding:8px">${r.period_label}</td><td style="padding:8px;color:${color}">${r.due_date} (${r.days_left >= 0 ? `${r.days_left} gün` : `${-r.days_left} gün gecikme`})</td>
      <td style="padding:8px;text-align:right;font-weight:600">${money(Number(r.amount))}</td></tr>`).join('')}</tbody></table>`;
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0f172a">
    <div style="background:#1d4ed8;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:700">${title}</div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <h3>Yaklaşan Ödemeler (${upcoming.length}) — ${money(upcoming.reduce((a, r) => a + Number(r.amount), 0))}</h3>${table(upcoming, '#1d4ed8')}
      ${includeOverdue ? `<h3 style="color:#dc2626">Geciken Ödemeler (${overdue.length}) — ${money(overdue.reduce((a, r) => a + Number(r.amount), 0))}</h3>${table(overdue, '#dc2626')}` : ''}
    </div></div>`;
}

async function run(env: Env, force = false) {
  const [s] = await sb<Settings[]>(env, 'notification_settings?id=eq.1&select=*');
  if (!s || !shouldSend(s, env.TIMEZONE, force)) return { skipped: true };

  const ahead = s.frequency === 'monthly' ? 31 : s.days_ahead;
  const upcoming = await sb<Row[]>(env, `v_payment_digest?days_left=gte.0&days_left=lte.${ahead}&order=due_date.asc`);
  const overdue = s.include_overdue ? await sb<Row[]>(env, 'v_payment_digest?days_left=lt.0&order=due_date.asc') : [];
  const label = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' }[s.frequency];
  const subject = `[${label} Özet] ${upcoming.length} yaklaşan, ${overdue.length} geciken ödeme`;
  const html = render(`${label} Ödeme Özeti`, upcoming, overdue, s.include_overdue);

  let status: 'sent' | 'failed' = 'sent';
  let error: string | null = null;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: s.recipients, subject, html }),
  });
  if (!res.ok) { status = 'failed'; error = await res.text(); }

  await sb(env, 'email_log', { method: 'POST', body: JSON.stringify({ to: s.recipients, subject, html, kind: 'digest', status, error }) });
  if (status === 'sent') {
    await sb(env, 'notification_settings?id=eq.1', { method: 'PATCH', body: JSON.stringify({ last_digest_at: new Date().toISOString() }) });
  }
  return { status, upcoming: upcoming.length, overdue: overdue.length };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env));
  },
  // Manuel tetikleme: POST /run  (Authorization: Bearer <RUN_TOKEN>)
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/run') {
      if (!env.RUN_TOKEN || req.headers.get('Authorization') !== `Bearer ${env.RUN_TOKEN}`) return new Response('Unauthorized', { status: 401 });
      return Response.json(await run(env, true));
    }
    return new Response('GümrükCRM payment reminder worker', { status: 200 });
  },
};
