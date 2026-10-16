#!/bin/sh
# Container start: bind Apache to the platform's $PORT, fill in platform
# defaults, prepare Laravel, migrate, optionally seed demo data
# (idempotent), then serve.
set -e

PORT="${PORT:-8080}"

# mod_php needs the prefork MPM, and only one MPM may be loaded.
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*
[ -e /etc/apache2/mods-enabled/mpm_prefork.load ] || a2enmod mpm_prefork >/dev/null
sed -ri "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Render provides the public address; use it unless set explicitly.
if [ -n "$RENDER_EXTERNAL_URL" ]; then
  export APP_URL="${APP_URL:-$RENDER_EXTERNAL_URL}"
  export FRONTEND_URL="${FRONTEND_URL:-$RENDER_EXTERNAL_URL}"
  export SANCTUM_STATEFUL_DOMAINS="${SANCTUM_STATEFUL_DOMAINS:-$RENDER_EXTERNAL_HOSTNAME}"
fi

# Platforms that generate a random secret give raw base64; Laravel wants the prefix.
case "$APP_KEY" in
  base64:*|"") ;;
  *) export APP_KEY="base64:$APP_KEY" ;;
esac

# Managed MySQL (e.g. Aiven) requires TLS: accept the CA certificate as text.
if [ -n "$DB_SSL_CA" ]; then
  printf '%s\n' "$DB_SSL_CA" > /var/www/html/storage/db-ca.pem
  export MYSQL_ATTR_SSL_CA=/var/www/html/storage/db-ca.pem
fi

php artisan storage:link --force >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

# The database may still be starting on first boot.
tries=0
until php artisan migrate --force; do
  tries=$((tries + 1))
  if [ "$tries" -ge 10 ]; then echo "Database not reachable; giving up." >&2; exit 1; fi
  echo "Waiting for database ($tries/10)..."; sleep 3
done

if [ "${SEED_DEMO:-false}" = "true" ]; then
  php artisan db:seed --class=DemoPharmacySeeder --force
fi

chown -R www-data:www-data storage bootstrap/cache
exec apache2-foreground
