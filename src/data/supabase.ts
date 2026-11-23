// Supabase bağlantısı — şimdilik pasif. VITE_DATA_MODE=supabase yapıldığında
// kullanılacak istemci ve örnek repository fonksiyonları.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Customer } from './types';

export const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'mock';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase ortam değişkenleri eksik (.env.example dosyasına bakın).');
    client = createClient(url, key);
  }
  return client;
}

// snake_case <-> camelCase
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const mapKeys = <T,>(obj: Record<string, unknown>, fn: (k: string) => string) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), v])) as T;

/** Örnek: müşterileri abonelikleriyle birlikte çekmek. */
export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase()
    .from('customers')
    .select('*, subscriptions(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const c = mapKeys<Customer>(row, toCamel);
    c.subscriptions = ((row.subscriptions ?? []) as Record<string, unknown>[]).map((s: Record<string, unknown>) => mapKeys(s, toCamel));
    return c;
  });
}

export async function upsertCustomer(c: Customer) {
  const { subscriptions, ...rest } = c;
  const sb = supabase();
  const { error } = await sb.from('customers').upsert(mapKeys<Record<string, unknown>>(rest as unknown as Record<string, unknown>, toSnake));
  if (error) throw error;
  const { error: e2 } = await sb.from('subscriptions').upsert(
    subscriptions.map((s) => ({ ...mapKeys<Record<string, unknown>>(s as unknown as Record<string, unknown>, toSnake), customer_id: c.id })),
  );
  if (e2) throw e2;
  // Ödeme takvimi DB tarafında trigger ile üretilir (generate_payment_schedule).
}
