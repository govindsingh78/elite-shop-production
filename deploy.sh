#!/usr/bin/env bash
# Runs on the EC2 server after the latest code has been pulled.
set -euo pipefail

APP_DIR=/var/www/elite-shop-production
PHP_FPM=php8.5-fpm

cd "$APP_DIR"

# Put the site in maintenance mode, and always bring it back up, even if a step fails
php artisan down --retry=15 || true
trap 'php artisan up' EXIT

composer install --no-dev --optimize-autoloader --no-interaction

# Build frontend assets only if the project has a package.json
if [ -f package.json ]; then
  npm ci
  npm run build
fi

php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache

sudo systemctl reload "$PHP_FPM"

echo "Deploy finished: $(git log -1 --pretty='%h %s')"
