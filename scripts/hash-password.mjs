// Kullanım: npm run hash-password -- <e-posta> <şifre>
// Çıktıyı .env dosyasında VITE_ADMIN_PASSWORD_HASH değerine yazın.
import { createHash } from 'node:crypto';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Kullanım: npm run hash-password -- <e-posta> <şifre>');
  process.exit(1);
}
console.log(createHash('sha256').update(`${email.trim().toLowerCase()}:${password}`).digest('hex'));
