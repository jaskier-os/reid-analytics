#!/bin/sh

# Replace environment variables in nginx config
envsubst '${NGINX_HOST} ${NGINX_PORT}' < /etc/nginx/conf.d/default.conf-template > /etc/nginx/conf.d/default.conf

# Replace environment variables in htpasswd if needed
if [ -f /etc/nginx/.htpasswd-template ]; then
    envsubst < /etc/nginx/.htpasswd-template > /etc/nginx/.htpasswd
fi

# Execute the CMD
exec "$@"
