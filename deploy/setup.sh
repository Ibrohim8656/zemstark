#!/usr/bin/env bash
# Zemstark — yangi Ubuntu (22.04 / 24.04) VPS serverga o'rnatish.
# Ishga tushirish (root sifatida):   bash zemstark/deploy/setup.sh
# Qayta ishga tushirish xavfsiz: ma'lumotlar saqlanib qoladi, sozlamalar eslab qolinadi.
set -euo pipefail

APP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${ZEM_ROOT:-}"            # faqat sinov uchun: barcha tizim yo'llari oldiga qo'shiladi
APP="$ROOT/opt/zemstark"
DATA="$ROOT/var/lib/zemstark"
ENVF="$ROOT/etc/zemstark.env"
PORT=3000

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mXato: %s\033[0m\n' "$*" >&2; exit 1; }
ask()  { # ask VAR "Savol" "standart"
  local __v="$1" __q="$2" __d="$3" __a=""
  if [ -t 0 ]; then read -rp "$__q [$__d]: " __a || true; fi
  printf -v "$__v" '%s' "${__a:-$__d}"
}

[ "$(id -u)" = 0 ] || die "root sifatida ishga tushiring:  sudo bash $0"
[ -f "$APP_SRC/server.js" ] || die "server.js topilmadi. Skriptni zemstark papkasi ichidan ishga tushiring."
if [ -r /etc/os-release ]; then . /etc/os-release; case "${ID:-}" in ubuntu|debian) ;; *) warn "Faqat Ubuntu/Debian'da sinalgan (${ID:-?})";; esac; fi

# ---------- 1. Sozlamalar ----------
OLD_DOMAIN="" OLD_CODE="" OLD_KEY="" OLD_GID="" OLD_GSEC="" OLD_TG=""
if [ -f "$ENVF" ]; then
  OLD_DOMAIN=$(sed -n 's/^ZEM_DOMAIN=//p' "$ENVF"); OLD_CODE=$(sed -n 's/^TEACHER_CODE=//p' "$ENVF")
  OLD_KEY=$(sed -n 's/^AI_KEY=//p' "$ENVF"); [ -n "$OLD_KEY" ] || OLD_KEY=$(sed -n 's/^ANTHROPIC_API_KEY=//p' "$ENVF"); OLD_GID=$(sed -n 's/^GOOGLE_CLIENT_ID=//p' "$ENVF"); OLD_GSEC=$(sed -n 's/^GOOGLE_CLIENT_SECRET=//p' "$ENVF")
  OLD_TG=$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' "$ENVF")
fi
say "Server IP manzili aniqlanmoqda"
command -v curl >/dev/null || { apt-get update -y >/dev/null; apt-get install -y curl >/dev/null; }
IP=$(curl -fsS4 --max-time 8 https://api.ipify.org 2>/dev/null || curl -fsS4 --max-time 8 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
[ -n "$IP" ] || die "IP manzilni aniqlab bo'lmadi"
echo "IP: $IP"
DEF_DOMAIN="${OLD_DOMAIN:-${IP//./-}.sslip.io}"
RAND_CODE=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
DEF_CODE="${OLD_CODE:-$RAND_CODE}"
echo
echo "Domeningiz bo'lmasa, Enter bosing — bepul ${IP//./-}.sslip.io manzili ishlatiladi."
ask ZEM_DOMAIN "Sayt manzili (domen)" "$DEF_DOMAIN"
ZEM_DOMAIN=$(printf '%s' "$ZEM_DOMAIN" | sed -E 's#^https?://##; s#/.*$##' | tr 'A-Z' 'a-z')
[[ "$ZEM_DOMAIN" =~ ^[a-z0-9.-]+$ ]] || die "Domen noto'g'ri: $ZEM_DOMAIN"
ask TEACHER_CODE "O'qituvchi ro'yxatdan o'tish kodi" "$DEF_CODE"
[[ "$TEACHER_CODE" =~ ^[A-Za-z0-9_-]{4,64}$ ]] || die "Kod faqat harf, raqam, - va _ dan iborat bo'lsin (4-64 belgi)"
KEY_HINT=$([ -n "$OLD_KEY" ] && echo "saqlangan" || echo "bo'sh")
echo
echo "AI yordamchi uchun kalit: bepul Groq kaliti (console.groq.com, gsk_ bilan boshlanadi), Gemini (AIza...) yoki Anthropic (sk-ant-...)."
ask KEY_IN "AI kaliti (keyin ham qo'shish mumkin)" "$KEY_HINT"
case "$KEY_IN" in "saqlangan") ANTHROPIC_API_KEY="$OLD_KEY";; "bo'sh"|"") ANTHROPIC_API_KEY="";; *) ANTHROPIC_API_KEY="$KEY_IN";; esac
[[ "$ANTHROPIC_API_KEY" =~ ^[A-Za-z0-9_-]*$ ]] || die "API kalit noto'g'ri belgilar o'z ichiga oladi"
echo
echo "Telegram bildirishnomalari uchun @BotFather'da bot yarating va tokenini qo'ying (yoki Enter — keyin ham qo'shish mumkin)."
TG_HINT=$([ -n "$OLD_TG" ] && echo "saqlangan" || echo "bo'sh")
ask TG_IN "Telegram bot tokeni" "$TG_HINT"
case "$TG_IN" in "saqlangan") TELEGRAM_BOT_TOKEN="$OLD_TG";; "bo'sh"|"") TELEGRAM_BOT_TOKEN="";; *) TELEGRAM_BOT_TOKEN="$TG_IN";; esac
[[ "$TELEGRAM_BOT_TOKEN" =~ ^([0-9]+:[A-Za-z0-9_-]+)?$ ]] || die "Telegram token noto'g'ri ko'rinishda (masalan: 123456789:AAE...)"

if [ "$ZEM_DOMAIN" != "${IP//./-}.sslip.io" ]; then
  RES=$(getent ahostsv4 "$ZEM_DOMAIN" | awk 'NR==1{print $1}' || true)
  [ "$RES" = "$IP" ] || warn "$ZEM_DOMAIN hozircha $IP ga yo'naltirilmagan (topildi: ${RES:-hech narsa}). DNS'da A yozuvini $IP ga qo'ying, aks holda HTTPS sertifikati olinmaydi."
fi

# ---------- 2. Paketlar ----------
say "Tizim paketlari o'rnatilmoqda"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw unzip debian-keyring debian-archive-keyring apt-transport-https

node_ok() { command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)'; }
if ! node_ok; then
  say "Node.js 24 LTS o'rnatilmoqda"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node_ok || die "Node.js 22.5+ o'rnatilmadi"
echo "Node.js $(node -v)"

if ! command -v caddy >/dev/null; then
  say "Caddy (HTTPS sertifikati avtomatik) o'rnatilmoqda"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > "$ROOT/etc/apt/sources.list.d/caddy-stable.list"
  apt-get update -y
  apt-get install -y caddy
fi

# ---------- 3. Dastur fayllari ----------
say "Dastur fayllari: $APP, ma'lumotlar: $DATA"
id zemstark >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin zemstark
mkdir -p "$APP/public" "$APP/deploy" "$DATA"
for f in server.js store.js core.js telegram.js reset-password.js turso-export.js package.json README.md DEPLOY.md; do
  if [ -f "$APP_SRC/$f" ]; then install -m 644 "$APP_SRC/$f" "$APP/$f"; fi
done
cp -a "$APP_SRC/public/." "$APP/public/"
cp -a "$APP_SRC/deploy/." "$APP/deploy/"
if [ -d "$APP_SRC/vazifalar" ]; then mkdir -p "$APP/vazifalar"; cp -a "$APP_SRC/vazifalar/." "$APP/vazifalar/"; fi
chown -R root:root "$APP"; chmod -R a+rX "$APP"
# avval shu kompyuterda ishlatilgan ma'lumotlar bo'lsa (data.sqlite / data.json) — faqat bo'sh serverga ko'chiriladi
if [ ! -e "$DATA/data.sqlite" ] && [ ! -e "$DATA/data.json" ]; then
  for f in data.sqlite data.json; do
    if [ -f "$APP_SRC/$f" ]; then cp -a "$APP_SRC/$f" "$DATA/$f"; echo "Mavjud ma'lumotlar ko'chirildi: $f"; fi
  done
  if [ -d "$APP_SRC/uploads" ]; then cp -a "$APP_SRC/uploads" "$DATA/"; fi
fi
chown -R zemstark:zemstark "$DATA"; chmod 750 "$DATA"

# ---------- 4. Sozlamalar fayli ----------
umask 077
{
  echo "NODE_ENV=production"
  echo "HOST=127.0.0.1"
  echo "PORT=$PORT"
  echo "DATA_DIR=$DATA"
  echo "BASE_URL=https://$ZEM_DOMAIN"
  echo "ZEM_DOMAIN=$ZEM_DOMAIN"
  echo "TEACHER_CODE=$TEACHER_CODE"
  echo "AI_KEY=$ANTHROPIC_API_KEY"
  echo "TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN"
  echo "TZ_NAME=Asia/Tashkent"
  if [ -n "$OLD_GID" ]; then echo "GOOGLE_CLIENT_ID=$OLD_GID"; fi
  if [ -n "$OLD_GSEC" ]; then echo "GOOGLE_CLIENT_SECRET=$OLD_GSEC"; fi
} > "$ENVF"
chmod 600 "$ENVF"
umask 022

# ---------- 5. Xizmat (systemd) ----------
say "Zemstark xizmati sozlanmoqda"
mkdir -p "$ROOT/etc/systemd/system" "$ROOT/etc/caddy" "$ROOT/etc/cron.weekly"
cat > "$ROOT/etc/systemd/system/zemstark.service" <<EOF
[Unit]
Description=Zemstark (English & IELTS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zemstark
Group=zemstark
EnvironmentFile=$ENVF
WorkingDirectory=$APP
ExecStart=$(command -v node) $APP/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
EOF

# ---------- 6. HTTPS (Caddy) ----------
say "HTTPS sozlanmoqda: https://$ZEM_DOMAIN"
cat > "$ROOT/etc/caddy/Caddyfile" <<EOF
$ZEM_DOMAIN {
	encode zstd gzip
	request_body {
		max_size 70MB
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		Permissions-Policy "camera=(self), microphone=(self), fullscreen=(self)"
		-Server
	}
	reverse_proxy 127.0.0.1:$PORT
}
EOF
caddy validate --config "$ROOT/etc/caddy/Caddyfile" --adapter caddyfile >/dev/null || die "Caddyfile xato"

# ---------- 7. Xavfsizlik devori ----------
say "Firewall: faqat SSH, 80 va 443 portlari ochiq"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# ---------- 8. Haftalik fayllar zaxirasi ----------
cat > "$ROOT/etc/cron.weekly/zemstark-uploads" <<'EOF'
#!/bin/sh
# Zemstark: yuklangan fayllar (audio, rasmlar) haftalik zaxirasi, oxirgi 4 tasi saqlanadi
D=/var/lib/zemstark; B=/var/lib/zemstark-files-backup
mkdir -p "$B" && [ -d "$D/uploads" ] && tar czf "$B/uploads-$(date +%F).tgz" -C "$D" uploads
ls -1t "$B"/uploads-*.tgz 2>/dev/null | tail -n +5 | xargs -r rm -f
EOF
chmod 755 "$ROOT/etc/cron.weekly/zemstark-uploads"

# ---------- 9. Ishga tushirish ----------
say "Ishga tushirilmoqda"
systemctl daemon-reload
systemctl enable zemstark >/dev/null 2>&1
systemctl restart zemstark
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
ok=""
for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1 && { ok=1; break; }; sleep 1; done
[ -n "$ok" ] || { journalctl -u zemstark -n 30 --no-pager; die "Zemstark ishga tushmadi (yuqoridagi jurnalga qarang)"; }
https_ok=""
for _ in $(seq 1 45); do curl -fsS --max-time 5 "https://$ZEM_DOMAIN/api/config" >/dev/null 2>&1 && { https_ok=1; break; }; sleep 2; done

cat <<EOF

============================================================
  Zemstark o'rnatildi
============================================================
  Sayt manzili:       https://$ZEM_DOMAIN
  O'qituvchi kodi:    $TEACHER_CODE
  AI yordamchi:       $([ -n "$ANTHROPIC_API_KEY" ] && echo yoqilgan || echo "o'chiq")
  Telegram:           $([ -n "$TELEGRAM_BOT_TOKEN" ] && echo yoqilgan || echo "o'chiq")
  Ma'lumotlar:        $DATA   (kunlik zaxira: $DATA/backups)
$([ -n "$https_ok" ] && echo "  HTTPS:              ishlayapti" || echo "  HTTPS:              sertifikat hali olinmagan — 1-2 daqiqa kuting yoki DNS/portlarni tekshiring:
                      journalctl -u caddy -n 50 --no-pager")

  Foydali buyruqlar:
    systemctl status zemstark          — holati
    journalctl -u zemstark -f          — jurnal (log)
    systemctl restart zemstark         — qayta ishga tushirish
    bash $APP/deploy/setup.sh          — sozlamalarni o'zgartirish (domen, kod, AI kaliti, Telegram)
    bash $APP/deploy/reset-password.sh EMAIL — parolni tiklash (masalan, o'qituvchi unutsa)
============================================================
EOF
