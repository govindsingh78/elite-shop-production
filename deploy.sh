#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/var/www/html/elite-shop-production
BACKEND_DIR=$REPO_DIR/e-street-backend
FRONTEND_DIR=$REPO_DIR/e-shop-frontend

# ---------- React frontend (build first, so the site stays up while it builds) ----------
cd "$FRONTEND_DIR"
npm ci
npm run build          # change "dist" to "build" in Nginx if your output folder is build

# ---------- Laravel backend ----------
cd "$BACKEND_DIR"
php artisan down --retry=15 || true
trap 'cd "$BACKEND_DIR" && php artisan up' EXIT

composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
sudo chown -R ubuntu:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
sudo systemctl reload php8.5-fpm

echo "Deploy finished: $(git -C "$REPO_DIR" log -1 --pretty='%h %s')"
