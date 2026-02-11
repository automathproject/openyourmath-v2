# ./Dockerfile
# ---- Stage 1: Builder ----
# Ce stage sert à construire le build SvelteKit
# Le contenu (DB, SVGs) est construit localement avant Docker
FROM node:22-alpine AS builder

# Installer les dépendances système minimales pour better-sqlite3 et le build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && corepack enable \
    && addgroup -g 1001 -S nodejs \
    && adduser -S sveltekit -u 1001

WORKDIR /app

# Copier les fichiers de dépendances pour utiliser le cache Docker
COPY --chown=sveltekit:nodejs pnpm-lock.yaml package.json ./
# Copier le dossier scripts pour le hook preinstall
COPY --chown=sveltekit:nodejs scripts ./scripts

# Corepack va automatiquement installer la bonne version de pnpm selon package.json
# Installer les dépendances avec cache optimisé
RUN pnpm fetch && \
    pnpm install --frozen-lockfile --prod=false

# Copier le code source ET les artéfacts pré-construits localement
COPY --chown=sveltekit:nodejs . .

# Construire l'application SvelteKit uniquement
# Le build de contenu (pnpm build:content) est fait localement avant Docker
RUN pnpm run build:app

# ---- Stage 2: Production ----
# Ce stage crée l'image finale, propre et légère
FROM node:22-alpine AS production

# Installer uniquement les dépendances système nécessaires pour better-sqlite3 en production
RUN apk add --no-cache \
    sqlite \
    && corepack enable \
    && addgroup -g 1001 -S nodejs \
    && adduser -S sveltekit -u 1001

WORKDIR /app

# Variables d'environnement pour la production
ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"
ENV PORT=3000

# Copier les fichiers de manifeste de dépendances
COPY --chown=sveltekit:nodejs package.json pnpm-lock.yaml ./

# Installer UNIQUEMENT les dépendances de production
# Corepack utilisera automatiquement la version pnpm@9 définie dans package.json
# better-sqlite3 sera installé et compilé pour cet environnement
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild better-sqlite3 && \
    pnpm store prune && \
    rm -rf ~/.pnpm-store

# Copier les artéfacts de build depuis le stage 'builder'
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/data ./data
COPY --from=builder --chown=sveltekit:nodejs /app/static ./static

# Passer à l'utilisateur non-root
USER sveltekit

# Exposer le port
EXPOSE 3000

# Healthcheck pour vérifier que l'app fonctionne
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Commande de démarrage avec gestion propre des signaux
CMD ["node", "build/index.js"]