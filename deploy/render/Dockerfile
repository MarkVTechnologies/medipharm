# MediPharm — single-container demo image (used by render.yaml).
# Build context: repository root.
# The SPA is built and placed in Laravel's public/, so screens and API share
# one origin. Production on cPanel keeps them separate (see README).

FROM node:22-alpine AS spa
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# dist/.htaccess is for cPanel's public_html; Laravel's public/.htaccess must win here.
RUN npm run build && rm -f dist/.htaccess

FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev unzip \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql intl zip gd bcmath opcache \
 && (a2dismod -f mpm_event mpm_worker >/dev/null 2>&1 || true) \
 && a2enmod mpm_prefork rewrite headers expires \
 && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf \
 && echo 'ServerName localhost' > /etc/apache2/conf-available/servername.conf && a2enconf servername \
 && printf '<Directory /var/www/html/public/assets>\n  Header set Cache-Control "public, max-age=31536000, immutable"\n</Directory>\n' > /etc/apache2/conf-available/spa-assets.conf && a2enconf spa-assets \
 && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
 && printf 'memory_limit=256M\nupload_max_filesize=20M\npost_max_size=25M\nexpose_php=Off\n' > "$PHP_INI_DIR/conf.d/medipharm.ini"

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY server/composer.json server/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY server/ ./
# SPA files go next to index.php. Apache's DirectoryIndex prefers index.html,
# so "/" opens the app; deep links fall through to Laravel's SPA fallback.
COPY --from=spa /app/dist/ ./public/
RUN composer dump-autoload --optimize --no-dev \
 && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/public bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && sed -i 's/\r$//' docker/entrypoint.sh \
 && chmod +x docker/entrypoint.sh

ENTRYPOINT ["docker/entrypoint.sh"]
