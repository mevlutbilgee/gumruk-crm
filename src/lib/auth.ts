// Demo (mock) modu için şifre doğrulama. Şifreler düz metin olarak saklanmaz;
// e-posta ile tuzlanmış SHA-256 özeti tutulur. Admin şifresinin özeti repoya
// girmeyen .env dosyasındaki VITE_ADMIN_PASSWORD_HASH değişkeninden okunur.
// Supabase'e geçildiğinde bu dosyanın yerini Supabase Auth alır.

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashPassword = (email: string, password: string) => sha256Hex(`${email.trim().toLowerCase()}:${password}`);

/** Oturum belirteci: şifre özetinden türetilir; şifre değişince eski oturumlar geçersiz olur. */
export const sessionToken = (userId: string, passwordHash: string) => sha256Hex(`session:${userId}:${passwordHash}`);

export const ADMIN_PASSWORD_HASH = (import.meta.env.VITE_ADMIN_PASSWORD_HASH ?? '').trim().toLowerCase();

export const MIN_PASSWORD_LENGTH = 8;
