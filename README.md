# OpenYourMath V2

Application web pour servir des exercices de mathématiques LaTeX avec recherche avancée.

## Démarrage rapide

```bash
# Installation
pnpm install

# Développement
pnpm dev

# Build complet (nécessite LaTeX/Pandoc)
pnpm build

# Docker développement
docker-compose -f docker-compose.dev.yml up
```

## Structure

- `content/` : Sources LaTeX des exercices
- `cache/` : JSON cache versionnés 
- `build/` : Pipeline de build (LaTeX → JSON → SQLite)
- `src/` : Application SvelteKit
- `static/` : Assets statiques et artifacts

## Documentation

Voir `/docs` pour plus de détails.
