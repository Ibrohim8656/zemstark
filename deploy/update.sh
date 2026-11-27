#!/usr/bin/env bash
# Zemstark — yangi versiyani o'rnatish. Ma'lumotlar va sozlamalar o'zgarmaydi.
# Ishlatish (yangi zemstark.zip serverga yuklangach):
#   unzip -o zemstark.zip && bash zemstark/deploy/update.sh
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${ZEM_ROOT:-}"; APP="$ROOT/opt/zemstark" DATA="$ROOT/var/lib/zemstark" PORT=3000
[ "$(id -u)" = 0 ] || { echo "root sifatida ishga tushiring: sudo bash $0"; exit 1; }
[ -f "$ROOT/etc/zemstark.env" ] || { echo "Zemstark hali o'rnatilmagan. Avval: bash $SRC/deploy/setup.sh"; exit 1; }
[ -f "$SRC/server.js" ] || { echo "server.js topilmadi: $SRC"; exit 1; }

echo "==> Yangilashdan oldin zaxira nusxa"
TS=$(date +%F-%H%M%S); mkdir -p "$DATA/backups"
if [ -f "$DATA/data.sqlite" ]; then
  # ishlab turgan bazaning izchil nusxasi
  node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync(process.argv[1]).exec(\"VACUUM INTO '\"+process.argv[2]+\"'\")" "$DATA/data.sqlite" "$DATA/backups/pre-update-$TS.sqlite" 2>/dev/null \
    || cp -a "$DATA/data.sqlite" "$DATA/backups/pre-update-$TS.sqlite"
elif [ -f "$DATA/data.json" ]; then
  cp -a "$DATA/data.json" "$DATA/backups/pre-update-$TS.json"
fi
chown -R zemstark:zemstark "$DATA/backups"
mkdir -p "$APP/previous" && cp -a "$APP"/*.js "$APP/public" "$APP/previous/" 2>/dev/null || true

echo "==> Fayllar yangilanmoqda"
for f in server.js store.js core.js telegram.js reset-password.js turso-export.js package.json README.md DEPLOY.md; do
  if [ -f "$SRC/$f" ]; then install -m 644 "$SRC/$f" "$APP/$f"; fi
done
cp -a "$SRC/public/." "$APP/public/"
cp -a "$SRC/deploy/." "$APP/deploy/"
if [ -d "$SRC/vazifalar" ]; then mkdir -p "$APP/vazifalar"; cp -a "$SRC/vazifalar/." "$APP/vazifalar/"; fi
chmod -R a+rX "$APP"

echo "==> Qayta ishga tushirilmoqda"
systemctl restart zemstark
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then echo "Tayyor. Yangi versiya ishlayapti."; exit 0; fi
  sleep 1
done
echo "Yangi versiya ishga tushmadi. Eski versiyaga qaytarilmoqda..."
journalctl -u zemstark -n 25 --no-pager || true
cp -a "$APP/previous/." "$APP/" && systemctl restart zemstark
echo "Eski versiya tiklandi. Yuqoridagi xato matnini yuboring."
exit 1
