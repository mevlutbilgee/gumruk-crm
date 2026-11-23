/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'mock' | 'supabase';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ADMIN_PASSWORD_HASH?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
