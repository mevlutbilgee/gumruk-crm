#!/usr/bin/env bash
# GitHub Pages'e yayın: derler ve dist/ içeriğini gh-pages dalına gönderir.
# Admin şifre özeti yereldeki .env dosyasından (VITE_ADMIN_PASSWORD_HASH) okunur.
# Kullanım: npm run deploy:pages
set -euo pipefail

REPO_NAME="${REPO_NAME:-gumruk-crm}"
REMOTE_URL="$(git remote get-url origin)"

if ! grep -q '^VITE_ADMIN_PASSWORD_HASH=.\+' .env 2>/dev/null; then
  echo "HATA: .env içinde VITE_ADMIN_PASSWORD_HASH tanımlı değil (README > Giriş)." >&2
  exit 1
fi

VITE_BASE="/${REPO_NAME}/" npm run build
cp dist/index.html dist/404.html   # SPA: derin bağlantılar için
touch dist/.nojekyll

TMP="$(mktemp -d)"
cp -R dist/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name || echo deploy)" \
    -c user.email="$(git -C "$OLDPWD" config user.email || echo deploy@localhost)" \
    commit -q -m "Pages yayını $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -q -f "$REMOTE_URL" gh-pages
cd - >/dev/null
rm -rf "$TMP"
echo "Yayınlandı → gh-pages dalı"
