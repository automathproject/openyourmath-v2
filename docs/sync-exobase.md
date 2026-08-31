# Synchroniser le contenu depuis exobase

OpenYourMath ne modifie pas les sources éditoriales : il les importe depuis
`exobase`, l'usine qui possède les sources `.tex` de toutes les sources du
corpus.

```text
Exercices → exobase → OpenYourMath
édition      usine       cache, base, artefacts et publication
```

## Responsabilités

- **Exercices** : rédaction et correction des fichiers LaTeX AMSCC, de leurs images et de leurs sources graphiques ;
- **exobase** : version canonique de **toutes** les sources — `amscc`, `crouzet`, `exo7` et celles à venir — sous `content/exercises/<source>/`, `content/images/<source>/`, `content/code/<source>/python/` et `content/authors.json`. C'est là que se font la normalisation et les corrections de sources ;
- **OpenYourMath** : fichiers dérivés (`cache/`, `data/`, `static/artifacts/`) et métadonnées sémantiques sous `content/metadata/`.

Les métadonnées sémantiques restent dans OpenYourMath parce qu’elles sont
produites par son pipeline d’indexation et dépendent de son `content_hash`.

Corollaire : **aucun `.tex` de `content/exercises/` ne doit être modifié ici.**
Une correction de source se fait dans exobase, puis redescend par la synchro.

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

`--apply` exige qu'exobase n'ait pas de modification non committée, sans quoi la
référence enregistrée serait fausse. Les sources sont découvertes dans
`content/exercises/` d'exobase, donc une nouvelle source est prise en compte
sans toucher au script. Les fichiers qui n'existent que dans OpenYourMath ne
sont jamais supprimés ; les suppressions et renommages faits dans exobase depuis
la référence sont signalés, jamais répercutés automatiquement.

Codes de sortie : `0` succès, `1` écart ou conflit, `2` usage, `3` erreur.

Pour utiliser une copie d’exobase ailleurs que dans le répertoire voisin,
définir `EXOBASE_ROOT=/chemin/vers/exobase`.
