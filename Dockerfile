# ./Dockerfile (Version corrigée pour les dépendances natives)

# ---- Stage 1: Builder ----
# Ce stage sert à construire nos artéfacts (DB, SVGs) et le build SvelteKit
FROM node:18-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

# On copie d'abord les fichiers de dépendances pour utiliser le cache Docker
COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch
RUN pnpm install --prod=false

# On copie le reste (code source de l'app et artéfacts pré-construits)
COPY . .

# On exécute les builds
# REMARQUE : Ces étapes sont optionnelles si vous préférez les faire localement
# Mais les laisser ici garantit que tout est construit dans le même environnement.
# Pour le moment, nous les gardons commentées car vous les faites localement.
# RUN pnpm build:content 

# Construire l'application SvelteKit
RUN pnpm run build:app

# ---- Stage 2: Production ----
# Ce stage crée l'image finale, propre et légère
FROM node:18-alpine AS production
RUN npm install -g pnpm@9
WORKDIR /app
ENV NODE_ENV=production

# On copie les fichiers de manifeste de dépendances
COPY package.json pnpm-lock.yaml ./

# On installe UNIQUEMENT les dépendances de production.
# C'est l'étape clé. `better-sqlite3` sera téléchargé et compilé
# proprement pour cet environnement final.
RUN pnpm install --prod

# On copie les artéfacts de build et de contenu depuis le stage 'builder'
COPY --from=builder /app/build ./build
COPY --from=builder /app/data ./data
COPY --from=builder /app/static ./static

EXPOSE 3000
CMD [ "node", "build/index.js" ]