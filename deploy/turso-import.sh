#!/usr/bin/env bash
# Bepul hostingdagi (Turso) ma'lumotlarni VPS'ga ko'chirish. setup.sh dan KEYIN, saytda hali hech kim ro'yxatdan o'tmagan holda ishlating.
# Ishlatish:  bash /opt/zemstark/deploy/turso-import.sh 'libsql://zemstark-....turso.io' 'TOKEN'
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "root sifatida ishga tushiring"; exit 1; }
[ -n "${2:-}" ] || { echo "Ishlatish: bash $0 <LIBSQL_URL> <LIBSQL_TOKEN>"; exit 1; }
APP=/opt/zemstark DATA=/var/lib/zemstark
systemctl stop zemstark
trap 'systemctl start zemstark' EXIT
TS=$(date +%F-%H%M%S)
if [ -f "$DATA/data.sqlite" ]; then mkdir -p "$DATA/backups"; mv "$DATA/data.sqlite" "$DATA/backups/before-import-$TS.sqlite"; rm -f "$DATA/data.sqlite-wal" "$DATA/data.sqlite-shm"; fi
sudo -u zemstark env DATA_DIR="$DATA" LIBSQL_URL="$1" LIBSQL_TOKEN="$2" node "$APP/turso-export.js"
