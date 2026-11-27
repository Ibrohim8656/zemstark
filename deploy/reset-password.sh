#!/usr/bin/env bash
# Zemstark — foydalanuvchi parolini tiklash (masalan, o'qituvchi parolini unutsa).
# Ishlatish:  bash /opt/zemstark/deploy/reset-password.sh ustoz@example.com
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "root sifatida ishga tushiring: sudo bash $0 <email yoki login>"; exit 1; }
[ -n "${1:-}" ] || { echo "Ishlatish: bash $0 <email yoki login>"; exit 1; }
APP=/opt/zemstark DATA=/var/lib/zemstark
systemctl stop zemstark
trap 'systemctl start zemstark' EXIT
sudo -u zemstark env DATA_DIR="$DATA" node "$APP/reset-password.js" "$1"
