import { useSearchParams } from 'react-router-dom';

/** Filtre değerlerini URL'de tutar — paylaşılabilir / geri tuşu uyumlu filtreler. */
export function useQueryFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const set = (k: K, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const clear = () => setParams(new URLSearchParams(), { replace: true });
  const activeCount = keys.filter((k) => values[k]).length;
  return { values, set, clear, activeCount };
}
