# Scripts de debug et maintenance

Ce projet fournit des scripts Node pour inspecter et maintenir le cache d'exercices et tester le mode de build incrémental.

Prérequis:
- Exécuter les commandes depuis la racine du projet
- Node.js disponible dans le PATH

Chemins par défaut:
- Dossier cache par défaut: `cache/exercises`
- Les scripts sont dans `scripts/debug/`

## 1) `debug-cache.js` — inspection et maintenance

Usage général:

```bash
node scripts/debug/debug-cache.js <commande> [cache-dir]
```

Commandes disponibles:
- `debug` / `status`: affiche l'état détaillé du cache (métadonnées, premiers fichiers, etc.)
- `cleanup`: supprime les entrées invalides des métadonnées (chemins invalides, fichiers manquants)
- `validate`: vérifie l'intégrité de chaque entrée (UUID, hash, structure)
- `repair`: exécute `cleanup`, puis tente de réparer les incohérences détectées
- `stats`: affiche les statistiques globales du cache

Options utiles:
- `--debug`: verbosité accrue (logs supplémentaires)

Exemples:
```bash
node scripts/debug/debug-cache.js debug
node scripts/debug/debug-cache.js stats
node scripts/debug/debug-cache.js cleanup cache/exercises
node scripts/debug/debug-cache.js repair --debug
```

## 2) `clean-cache.js` — régénère des métadonnées « propres » (dry‑run par défaut)

Objectif: reconstruire un fichier de métadonnées propre à partir de l'état actuel du dossier cache, en supprimant doublons et chemins invalides. Par défaut, n'écrit rien: il faut passer `--apply` pour sauvegarder.

Usage:
```bash
node scripts/debug/clean-cache.js [cache-dir] [--apply] [--debug]
```

Exemples:
```bash
# Aperçu (dry-run)
node scripts/debug/clean-cache.js

# Écrire les nouvelles métadonnées
node scripts/debug/clean-cache.js cache/exercises --apply
```

## 3) `test-incrementals.js` — test du build incrémental

Ce script:
- lance un build complet,
- relance un build incrémental (doit « skipper »),
- modifie un fichier LaTeX de test,
- relance le build incrémental (doit traiter 1 fichier),
- vérifie la présence du JSON attendu dans `cache/exercises`,
- nettoie les fichiers de test.

Usage:
```bash
node scripts/debug/test-incrementals.js [--debug]
```

Notes:
- Le script invoque `node scripts/parse-latex.js ...` et suppose les chemins par défaut du projet.
- Il crée/efface `content/exercises/test-incremental.tex` et `cache/exercises/test-incremental.json`.

