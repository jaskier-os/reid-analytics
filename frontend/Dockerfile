### STAGE 1: Build ###
FROM node:20-slim AS builder

WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package.json package-lock.json ./
ADD patches ./patches

RUN npm ci && \
    npm rebuild esbuild && \
    npx patch-package || true

COPY . .

RUN npm run build

### STAGE 2: Setup ###
FROM nginx:1.27-alpine

RUN apk update && apk upgrade \
    && apk add --no-cache apache2-utils \
    && rm -rf /var/cache/apk/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/nginx/nginx.conf /etc/nginx/conf.d/default.conf-template
COPY --from=builder /app/nginx/.htpasswd /etc/nginx/.htpasswd-template

COPY ./docker-entrypoint.sh .
RUN ["chmod", "+x", "./docker-entrypoint.sh"]

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
