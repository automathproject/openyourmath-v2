# OpenYourMath V2

Application web pour servir des exercices de mathématiques LaTeX avec recherche avancée.

## Démarrage rapide

### Développement local

```bash
# Installation des dépendances (Node 22 + pnpm via corepack)
pnpm install

# Générer le cache JSON et la base SQLite (à relancer quand le LaTeX change)
pnpm build:content

# Démarrer le serveur Vite (http://localhost:5173)
pnpm dev

# Variante: rebuild du contenu puis démarrer le serveur
pnpm dev:full
```

### Production (sans Docker)

```bash
# Build complet (contenu + bundle Node adapter)
pnpm build

# Vérifier le build localement
pnpm preview

# Lancer le serveur Node en production (PORT=3000 par défaut)
NODE_ENV=production node build
```

### Production (avec Docker)

```bash
# 1) Mettre à jour la version dans package.json (champ "version")
# Exemple: "2.3.2" -> "2.3.3"

# Préparer les artéfacts locaux si vous reconstruisez l'image
pnpm build:content:full

# 2) Construire + pousser l'image GHCR taggée avec package.json:version
pnpm docker:release

# 3) Démarrer la stack (Caddy + app) en mode interactif
pnpm docker:dev

# 4) Lancer en détaché (prod)
pnpm docker:prod

# Arrêt
docker compose down
```

Notes:
- `pnpm docker:build` et `pnpm docker:push` existent aussi si vous voulez séparer les étapes.
- Le tag Docker et la version affichée dans l'UI sont pilotés par `package.json` (`version`), sans variable `VERSION=...` à saisir manuellement.

## Structure

- `content/` : Sources LaTeX des exercices
- `cache/` : JSON cache versionnés 
- `build/` : Pipeline de build (LaTeX → JSON → SQLite)
- `src/` : Application SvelteKit
- `static/` : Assets statiques et artifacts

## Documentation

Voir `/docs` pour plus de détails.

- Scripts de debug/maintenance: `docs/debug-scripts.md`
