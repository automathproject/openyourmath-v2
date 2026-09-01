# Synchroniser le contenu depuis exobase

OpenYourMath importe les sources éditoriales depuis `exobase`, l'usine qui
porte les sources `.tex` de tout le corpus. Une correction de source découverte
dans OpenYourMath peut toutefois être remontée explicitement vers exobase.

```text
Exercices ←→ exobase ←→ OpenYourMath
édition       base partagée    cache, base, artefacts et publication
```

## Responsabilités

- **Exercices** : rédaction et correction des fichiers LaTeX AMSCC, de leurs images et de leurs sources graphiques ;
- **exobase** : version canonique de **toutes** les sources — `amscc`, `crouzet`, `exo7` et celles à venir — sous `content/exercises/<source>/`, `content/images/<source>/`, `content/code/<source>/python/` et `content/authors.json`. C'est là que se font la normalisation et les corrections de sources ;
- **OpenYourMath** : fichiers dérivés (`cache/`, `data/`, `static/artifacts/`) et métadonnées sémantiques sous `content/metadata/`. Il peut proposer une correction des sources, images ou scripts Python vers exobase, après relecture.

Les métadonnées sémantiques restent dans OpenYourMath parce qu’elles sont
produites par son pipeline d’indexation et dépendent de son `content_hash`.

Les métadonnées et les fichiers dérivés ne remontent jamais. Le référentiel
`content/authors.json` reste également géré dans exobase.

## Procédure

1. Dans `Exercices`, relire et committer les sources éditoriales.
2. Dans `exobase`, lancer `node scripts/sync-exercices.mjs`, relire le plan, puis `node scripts/sync-exercices.mjs --apply`. Vérifier et committer.
3. Dans OpenYourMath, lancer :

   ```bash
   pnpm sync:exobase
   pnpm sync:exobase:check
   pnpm sync:exobase --apply
   ```

4. Relire les changements, reconstruire le contenu et préparer les exercices modifiés :

   ```bash
   pnpm build:content
   pnpm exercise:prepare -- <uuid>
   ```

   Si des fichiers sous `content/code/` ont changé, utiliser
   `pnpm build:content:full` à la place : le cache incrémental ne dépend que
   du hash des sources `.tex`.

## Corriger une source détectée dans OpenYourMath

Après avoir corrigé un `.tex`, une image ou un script Python sous `content/`,
proposer d'abord la remontée sans rien écrire :

```bash
pnpm sync:exobase:push --check
```

Relire la liste, puis copier les corrections vers exobase :

```bash
pnpm sync:exobase:push --apply
```

Le dépôt exobase doit être propre avant cette commande. Relire ensuite son
diff, le committer, puis revenir dans OpenYourMath et relancer la synchro
normale avec `pnpm sync:exobase --apply` : cela enregistre le nouveau commit de
référence. Pour une source AMSCC, utiliser enfin depuis exobase la remontée
vers Exercices (`node scripts/sync-exercices.mjs --push --apply`), la relire et
la committer.

## Comment la synchro décide

La comparaison est à trois versions : l'état d'exobase, celui d'OpenYourMath, et
l'état de référence — le commit exobase enregistré dans
`content/provenance/exobase.json` par la dernière synchronisation.

| Situation | Décision |
| --- | --- |
| Corrigé dans exobase seulement | copié |
| Modifié ici seulement | préservé et signalé — à remonter dans exobase |
| Modifié des deux côtés | conflit : signalé, rien n'est copié |
| Absent ici | ajouté |
| Créé ici seulement | préservé et proposé uniquement par `--push` |

Un miroir strict suffirait tant que rien ne modifie les sources ici. La
troisième version est le filet : elle rend une modification locale accidentelle
visible au lieu de la détruire en silence. En régime normal, la colonne
« local » doit rester à zéro.

Tant qu'un conflit subsiste, la référence n'avance pas et le script sort en
code 1. `--force` donne autorité à exobase sur tout ce qui diffère ici, conflits
et modifications locales comprises ; l'aperçu liste nommément les fichiers
concernés sous « Écrasés par --force ».

Sans référence enregistrée — première exécution, ou historique exobase réécrit —
le script ne détruit rien : il préserve le côté OpenYourMath et enregistre le
commit courant.

`--apply` pour l'import exige qu'exobase n'ait pas de modification non committée,
sans quoi la référence enregistrée serait fausse. La remontée `--push --apply`
exige aussi un exobase propre, pour que son diff soit relisible. `--force` donne
autorité à exobase à l'import et ne peut pas être combiné avec `--push`.
Les sources sont découvertes dans
`content/exercises/` d'exobase, donc une nouvelle source est prise en compte
sans toucher au script. Les fichiers qui n'existent que dans OpenYourMath ne
sont jamais supprimés ; les suppressions et renommages faits dans exobase depuis
la référence sont signalés, jamais répercutés automatiquement.

Codes de sortie : `0` succès, `1` écart ou conflit, `2` usage, `3` erreur.

Pour utiliser une copie d’exobase ailleurs que dans le répertoire voisin,
définir `EXOBASE_ROOT=/chemin/vers/exobase`.
