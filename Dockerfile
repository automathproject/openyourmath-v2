# ---- Stage 1: Base avec dépendances ----
# Utilise une image Node avec pnpm pré-installé.
# Cette étape est mise en cache et ne se ré-exécute que si pnpm-lock.yaml change.
FROM node:18-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch

# ---- Stage 2: Builder ----
# Cette étape construit l'application et la base de données.
FROM base AS builder
WORKDIR /app

# Copier TOUT le code source, y compris les répertoires non versionnés comme `cache/`
# C'EST L'ÉTAPE CLÉ : On part du principe que vous avez déjà lancé `pnpm build:cache` localement.
COPY . .

# Installer les dépendances (en mode offline pour la vitesse)
# et reconstruire les dépendances natives comme better-sqlite3 si nécessaire.
RUN pnpm install --offline --prod=false

# Exécuter les parties RAPIDES du build à l'intérieur du conteneur.
# On ne lance PAS parse-latex.js, car on a déjà copié son résultat (`cache/`).
# On lance build-tikz car il est rapide et a besoin des dépendances de dev.
RUN node scripts/build-tikz.js
RUN node scripts/build-db.js

# Construire l'application SvelteKit
RUN pnpm run build:app

# Nettoyer les dépendances de développement pour alléger l'image finale
RUN pnpm prune --prod

# ---- Stage 3: Production ----
# C'est l'image finale, très légère, qui sera déployée.
FROM node:18-alpine AS production
WORKDIR /app

# Définir l'environnement de production
ENV NODE_ENV=production

# Copier uniquement les artéfacts nécessaires depuis l'étape 'builder'
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copier la base de données et les artéfacts statiques
COPY --from=builder /app/data ./data
COPY --from=builder /app/static ./static

# Exposer le port sur lequel l'application SvelteKit écoute
EXPOSE 3000

# La commande pour démarrer le serveur Node.js de SvelteKit
# L'adaptateur-node génère un fichier index.js dans le dossier de build.
CMD [ "node", "build/index.js" ]