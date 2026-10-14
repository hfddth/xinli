#!/usr/bin/env bash
set -euo pipefail

archive="/root/xinli-deploy.zip"
site_root="/www/wwwroot/xinli"
backup_root="/root/xinli-backup-$(date +%Y%m%d-%H%M%S)"

test -f "$archive"
if test -d "$site_root"; then
  cp -a "$site_root" "$backup_root"
fi

mkdir -p "$site_root" /opt/mind-explorer
install -d -o nginx -g nginx -m 0750 /var/lib/mind-explorer
unzip -o "$archive" -d "$site_root"
install -m 0644 "$site_root/backend/report_service.py" /opt/mind-explorer/report_service.py
install -m 0644 "$site_root/backend/mind-explorer-report.service" /etc/systemd/system/mind-explorer-report.service
install -m 0644 "$site_root/deploy/xinli.conf" /etc/nginx/conf.d/xinli.conf

systemctl daemon-reload
systemctl enable --now mind-explorer-report.service
nginx -t
systemctl reload nginx

curl -fsS http://127.0.0.1:8000/health
echo
echo "DEPLOY_OK backup=$backup_root"
