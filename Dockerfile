# ./Dockerfile (Version corrigée)

# ---- Stage 1: Base avec dépendances ----
FROM node:18-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch

# ---- Stage 2: Builder ----
FROM base AS builder
WORKDIR /app

# Copier TOUT le code source ET les artéfacts pré-construits (`cache/`, `static/artifacts/`, `data/`)
# grâce au fichier .dockerignore.
COPY . .

# Installer toutes les dépendances
RUN pnpm install --offline --prod=false

# Construire l'application SvelteKit
RUN pnpm run build:app

# Nettoyer les dépendances de développement
RUN pnpm prune --prod

# ---- Stage 3: Production ----
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copier les artéfacts nécessaires depuis l'étape 'builder'
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/data ./data
COPY --from=builder /app/static ./static

EXPOSE 3000
CMD [ "node", "build/index.js" ]