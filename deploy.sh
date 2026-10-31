#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/var/www/html/elite-shop-production
BACKEND_DIR=$REPO_DIR/e-street-backend
FRONTEND_DIR=$REPO_DIR/e-shop-frontend

# ---------- Laravel backend first ----------
# The new PHP code is live as soon as git resets, so its migrations and caches must follow straight away,
# even if the frontend build below fails.
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
# Category banners: not in git, so this makes the folder and lets PHP write to it.
sudo mkdir -p public/uploads/categories
sudo chown -R ubuntu:www-data public/uploads/categories
sudo chmod -R 775 public/uploads/categories
# Database backups hold customers' details: only the app may read them.
sudo mkdir -p storage/app/private/backups
sudo chown -R ubuntu:www-data storage/app/private/backups
sudo chmod -R u=rwX,g=rwX,o= storage/app/private/backups
# Backups use the MySQL client tools. A failed install mustn't stop a deploy: Server & health says what's missing.
if ! command -v mysqldump >/dev/null; then
  sudo apt-get install -y mysql-client || echo "Couldn't install mysql-client, so database backups won't run yet."
fi
sudo systemctl reload php8.5-fpm

# Laravel's scheduler runs Admin › Server & health's checks (alerts about a full disk or new problems, and
# nightly clean-ups). It runs as the web server's user, so the logs and files it writes stay writable by PHP.
# Added on the first deploy; later deploys leave the crontab as it is.
CRON_LINE="* * * * * cd $BACKEND_DIR && php artisan schedule:run >> /dev/null 2>&1"
CURRENT_CRON=$(sudo crontab -u www-data -l 2>/dev/null || true)
if ! grep -qF "artisan schedule:run" <<< "$CURRENT_CRON"; then
  printf '%s\n%s\n' "$CURRENT_CRON" "$CRON_LINE" | sed '/^$/d' | sudo crontab -u www-data -
  echo "Scheduler added to www-data's crontab."
fi

php artisan up
trap - EXIT

# ---------- React website ----------
# GitHub Actions builds the website (this server hasn't the memory to) and passes the files in as $1,
# a .tgz of the dist folder. Nginx serves e-shop-frontend/dist.
SITE_ARCHIVE="${1:-}"
if [ -n "$SITE_ARCHIVE" ]; then
  cd "$FRONTEND_DIR"
  rm -rf dist.new dist.old
  mkdir dist.new
  tar -xzf "$SITE_ARCHIVE" -C dist.new --strip-components=1
  # Swap the new files in at once, so visitors never see a half-copied site.
  if [ -d dist ]; then mv dist dist.old; fi
  mv dist.new dist
  rm -rf dist.old "$SITE_ARCHIVE"
  # Only needed for building here, which no longer happens: free the disk space.
  rm -rf node_modules
else
  echo "Website not updated: it is built by GitHub Actions on each push (Actions › Deploy to AWS EC2 › Run workflow to redo it)."
fi

echo "Deploy finished: $(git -C "$REPO_DIR" log -1 --pretty='%h %s')"
