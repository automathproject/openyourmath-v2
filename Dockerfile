FROM node:18-alpine

WORKDIR /app

# Copie des fichiers de config
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Installation des dépendances
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copie du code source
COPY . .

# Build de l'application
RUN pnpm run build:app

EXPOSE 3000

# Démarrage de l'application
CMD ["node", "build/index.js"]
