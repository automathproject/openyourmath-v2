# Classification CPGE des exercices

Conception et état d'avancement. Les phases 0 (programmes officiels en
Markdown) et 1 (référentiel en base) sont réalisées. Le référentiel et les
rattachements relus appartiennent à exobase, et OpenYourMath les importe par
`pnpm sync:exobase` ([sync-exobase.md](sync-exobase.md)).

## Constat

La classification actuelle est un axe unique, porté par des macros du `.tex` et
stocké en colonnes texte mono-valuées (`scripts/schema.sql`) :

```text
niveau (L1…M1) → module → chapitre → sous-chapitre (+ thème libre)
```

Elle ne peut pas exprimer la place d'un exercice dans les classes
préparatoires :

- **Un exercice concerne plusieurs filières à la fois.** Un exercice sur les
  racines $n$-ièmes de l'unité relève de MPSI et de PCSI ; un exercice de
  réduction relève de MP, PC et PSI, mais pas au même endroit du programme.
  Une valeur unique de `niveau` ne peut pas porter cela.
- **Les programmes ne suivent pas le découpage universitaire.** Le programme
  est organisé en semestres (1re année), puis en sections et sous-sections
  lettrées. Leurs limites diffèrent de celles des chapitres exo7 : en MPSI, la
  trigonométrie est une sous-section de « Compléments de calcul algébrique et
  de trigonométrie », et les équations différentielles linéaires sont vues dès
  le premier semestre avec les primitives.
- **Le mélange existe déjà.** Les 115 exercices `crouzet/pcsi` ont
  `\niveau{PCSI}`, qui mêle niveau et filière. Le bouton « CPGE » de
  `SearchPageSidebar.svelte` ne filtre rien : aucune valeur `CPGE` n'existe.

## Principes

1. **Un second axe, orthogonal.** La classification CPGE s'ajoute à la
   classification universitaire sans la remplacer. Un exercice reste
   `L1 / Algèbre / Nombres complexes` et reçoit en plus des rattachements CPGE.
2. **Le référentiel, c'est le texte officiel.** Chaque nœud rattachable est une
   section ou une sous-section d'un programme publié au BO, avec un
   identifiant stable écrit dans le Markdown (`{#mpsi-mp2i.nombres-complexes.f}`).
   On ne crée pas de taxonomie « CPGE » maison : elle dériverait des textes, et
   l'on perdrait la possibilité de citer la ligne exacte du programme.
3. **Granularité : la sous-section.** C'est le grain que les professeurs
   utilisent (« MPSI, nombres complexes, f) racines $n$-ièmes »). Il est assez
   fin pour être utile et assez stable pour être étiqueté de façon fiable. Le
   rattachement à une section entière reste possible quand elle n'a pas de
   sous-section. Les lignes de contenu ne sont pas des nœuds : elles n'ont pas
   d'identifiant stable. On s'en sert comme contexte pour l'étiquetage.
4. **Multi-valué, par programme.** On rattache un exercice à autant de nœuds
   que nécessaire, dans chaque programme concerné. On ne tente pas de fusionner
   les programmes en une taxonomie commune. Une table de concordance entre
   sections voisines (MPSI ↔ PCSI ↔ PTSI, MP ↔ PSI ↔ PC ↔ PT, BCPST) sert
   seulement à proposer des rattachements.
5. **Filières et programmes sont distincts.** MPSI et MP2I partagent un même
   texte de mathématiques, de même que MP et MPI. À l'inverse, la filière
   BCPST a un texte par année. On filtre par filière, qui se résout en un ou
   plusieurs programmes : `MP2I → mpsi-mp2i`, `MPI → mp-mpi`,
   `BCPST → bcpst1, bcpst2`.
6. **Le contenu à exobase, le dérivé à OpenYourMath.** Un rattachement relu
   décrit l'exercice, comme `\module{}` ou `\chapitre{}`. Il doit suivre la
   source vers tous les exports, et se lire en ouvrant le `.tex`. exobase porte
   donc le référentiel, et les sources portent les rattachements relus dans la
   macro `\cpge{}`. OpenYourMath porte ce qui en dérive : la base, l'affichage et les
   propositions automatiques tant qu'elles ne sont pas relues, comme les autres
   métadonnées IA.

| Élément                                         | Dépôt        | Chemin                                                                      |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Programmes, `sources.json`, format              | exobase      | `content/referentials/cpge/`                                                |
| Validation de structure, téléchargement des PDF | exobase      | `tools/check_programmes_cpge.mjs`, `tools/import/fetch_programmes_cpge.mjs` |
| Correspondance chapitres → sections (phase 2)   | exobase      | `content/referentials/`, à côté de `amscc-exo7-compatibility.json`          |
| Rattachements relus                             | exobase      | `\cpge{}` des sources `.tex` (`content/FORMAT.md`)                          |
| Définition de `\cpge` pour la compilation       | Exercices    | `_preambules/general.tex`                                                   |
| Propositions non relues (phase 2)               | OpenYourMath | `content/metadata/<source>/<uuid>.json`, champ `cpge`                       |
| Analyseur, tables, build                        | OpenYourMath | `scripts/build-referentiel-cpge.js`                                         |
| Rendu KaTeX, instantané des identifiants        | OpenYourMath | `tests/build/referentiel-cpge.test.js`                                      |

## Modèle de données

### Référentiel : `content/referentials/cpge/`

Importé d'exobase, avec les autres référentiels (AMSCC, Exo7, tables de
compatibilité) :

```text
content/referentials/cpge/
├── README.md               format des programmes
├── sources.json            liens vers les annexes officielles (BO 2021)
├── concordance.json        sous-sections équivalentes entre filières, et leurs écarts
└── programmes/
    ├── mpsi-mp2i.md        MPSI, MP2I — 1re année
    ├── pcsi.md             PCSI       — 1re année
    ├── ptsi.md             PTSI       — 1re année
    ├── bcpst1.md           BCPST      — 1re année
    ├── mp-mpi.md           MP, MPI    — 2e année
    ├── pc.md               PC         — 2e année
    ├── psi.md              PSI        — 2e année
    ├── pt.md               PT         — 2e année
    └── bcpst2.md           BCPST      — 2e année
```

Les PDF officiels ne sont versionnés nulle part. exobase les télécharge au
besoin dans `sources/raw/cpge/` (répertoire ignoré par Git).

Le Markdown est la source de vérité. `scripts/utils/parse-programme-cpge.js`
l'analyse : chaque titre `###` ou `####` qui porte un identifiant devient un
nœud.

```json
{
  "id": "mpsi-mp2i.nombres-complexes.f",
  "programme": "mpsi-mp2i",
  "type": "sous-section",
  "parent_id": "mpsi-mp2i.nombres-complexes",
  "partie": "Premier semestre",
  "semestre": 1,
  "lettre": "f",
  "titre": "f) Racines $n$-ièmes",
  "texte": null,
  "contenus": [
    {
      "contenu": "Description des racines $n$-ièmes de l’unité, …",
      "commentaire": "Notation $\\mathbb{U}_n$.<br>Représentation géométrique."
    }
  ],
  "ordre": 15
}
```

- **Filières et année.** Elles sont portées par le programme (front matter),
  pas par le nœud.
- **Parties.** Une partie « A - », « B - » est une section dont `parent_id`
  désigne la section générale. L'arbre est donc programme → section générale
  → partie → sous-section, ou programme → section → sous-section.
- **Contenu du nœud.** `texte` reçoit le bandeau et les notes, en Markdown.
  `contenus` reçoit les lignes du tableau.

Les 9 programmes donnent 881 nœuds : 210 sections et 671 sous-sections.

Deux garde-fous protègent les identifiants :

- **Au build.** `scripts/build-referentiel-cpge.js` échoue si un rattachement
  renvoie à un identifiant absent du référentiel.
- **Aux tests.** L'instantané versionné `tests/build/__snapshots__/cpge-identifiants.txt`
  liste tous les identifiants. Toute modification fait échouer les tests
  jusqu'à la mise à jour délibérée de l'instantané (`npx vitest run -u`).
  Elle apparaît alors dans le diff.

Lors d'une future réforme des programmes, on ajoute un nouveau jeu de fichiers
(par exemple `programmes/2027/`). L'ancien reste en place tant que des
rattachements pointent dessus.

### Rattachements

**Relus : la macro `\cpge{}` de la source.** Elle reçoit une liste
d'identifiants séparés par des virgules, à côté des autres métadonnées :

```latex
\niveau{L1}
\module{Algèbre}
\chapitre{Nombres complexes}
\cpge{mpsi-mp2i.nombres-complexes.f, pcsi.nombres-complexes.f}
```

- **Ce que la macro contient.** Seuls les identifiants y figurent, sans
  origine ni confiance : ce qui est dans la source est relu, par définition.
- **Validation.** Les deux validateurs de sources, `tools/check_exercise_sources.py`
  dans exobase et `pnpm test:tex` ici, refusent un identifiant mal formé ou
  répété (`invalid-cpge`) et un identifiant absent du référentiel
  (`unknown-cpge-node`).
- **Compilation.** Le préambule du dépôt Exercices définit `\cpge` comme une
  commande sans effet. Sans cette définition, un exercice qui la porte ne
  compile plus.
- **Analyse et édition.** L'analyseur LaTeX ignore la macro. Le build la lit
  directement dans les `.tex`, comme les fiches lisent `\exo7id{}`. L'éditeur
  `/create` la conserve quand il rouvre une source.
- **En base.** Les rattachements relus prennent l'origine `source`, avec
  `valide = 1`.

**Proposés (phase 2) : `content/metadata/<source>/<uuid>.json`, dans
OpenYourMath.** L'étiquetage automatique écrit ses propositions dans les
métadonnées sémantiques de l'exercice, sous un champ `cpge`. Elles suivent le
même cycle de vie que le résumé et les concepts : rattachées au `content_hash`,
recalculées quand l'énoncé change. `origine` dit comment la proposition a été
obtenue : `llm`, `concordance` (propagée depuis une filière voisine) ou
`chapitre` (déduite du chapitre universitaire). Une proposition acceptée à la
relecture est ajoutée au `\cpge{}` de la source, puis remonte dans exobase par
`pnpm sync:exobase:push`, comme une correction de source. Elle n'est ensuite
plus jamais écrasée par un traitement automatique.

### SQLite

Les tables sont définies dans `scripts/schema.sql` et remplies par
`pnpm build:referentiel-cpge`, dernière étape de `pnpm build:content`.
`pnpm check:referentiel-cpge` vérifie sans écrire. Chaque construction
reconstruit les tables entièrement.

| Table             | Contenu                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `cpge_programmes` | un texte officiel : titre, année, BO, NOR, liens, empreinte du Markdown |
| `cpge_filieres`   | filière → programme (`MP2I → mpsi-mp2i`, `BCPST → bcpst1` et `bcpst2`)  |
| `cpge_noeuds`     | les nœuds ci-dessus, `contenus` en JSON                                 |
| `exercise_cpge`   | rattachement exercice ↔ nœud : origine, confiance, validation           |

`exercise_cpge` est la table d'association, sur le modèle de
`exercise_authors`. Un rattachement dont l'exercice est absent de la base
n'est pas écrit. Il reste dans son fichier et revient quand l'exercice est
publié.

Pour filtrer une section entière, on suit `parent_id`, pas le préfixe de
l'identifiant : celui d'une partie « A - » ne prolonge pas celui de sa section
générale.

```sql
WITH RECURSIVE sous(id) AS (
  SELECT :section
  UNION ALL SELECT n.id FROM cpge_noeuds n JOIN sous ON n.parent_id = sous.id
)
SELECT uuid FROM exercise_cpge WHERE noeud_id IN (SELECT id FROM sous);
```

## Alimentation

1. **A priori par chapitre.** Une table de correspondance entre chapitres
   universitaires et sections candidates, rangée dans exobase à côté de
   `amscc-exo7-compatibility.json`, sur le même modèle : une décision par
   chapitre, y compris « pas d'équivalent ». Elle part des référentiels Exo7 et
   AMSCC, maintenant importés dans `content/referentials/`, et sert à
   restreindre les candidats.
2. **Étiquetage par LLM.** On étend le pipeline B (`index-exercises.js`,
   Ollama puis Albert). Le modèle reçoit l'énoncé, le résumé et les concepts
   déjà calculés, ainsi que les seules sous-sections candidates, avec leurs
   lignes de contenu comme contexte. Il renvoie des identifiants et une
   confiance. Tout identifiant absent du référentiel est rejeté.
3. **Concordance.** On propage les rattachements vers les sections voisines
   des autres programmes, avec une confiance réduite.
4. **Validation humaine.** Une vue de relecture par section de programme
   permet d'accepter ou de rejeter les propositions en série. Les
   rattachements acceptés remontent dans exobase.
5. **crouzet/pcsi.** Ces exercices suivent un cours de PCSI. Leurs 9 chapitres
   se rattachent directement aux sections `pcsi.*` (origine `chapitre`). Ces
   rattachements sont écrits dans leur `\cpge{}` après relecture, avec la
   correction
   `\niveau{PCSI} → L1`. D'ici là, les requêtes traitent `PCSI` comme un alias
   hérité.

## Pilote de la phase 2

Le pilote porte sur 324 exercices : les 115 exercices crouzet, et un tirage
reproductible de 70 exercices exo7 de L1 par chapitre (nombres complexes,
suites, polynômes), réparti au prorata des sous-chapitres.

- **Table de correspondance** : `content/referentials/cpge-correspondances.json`,
  limitée aux 12 chapitres du pilote. Elle est créée dans OpenYourMath et
  remontera dans exobase (`pnpm sync:exobase:push`) une fois validée.
- **Candidats** : `scripts/utils/cpge-candidats.js` déplie la table en
  sous-sections et les regroupe par famille de programmes (1re année MPSI,
  PCSI, PTSI ; BCPST1 ; 2e année MP, PC, PSI, PT ; BCPST2).
  - Dans une famille, les sous-sections de même notion forment un groupe : même
    titre, ou titre proche par ses mots.
  - Le modèle choisit un groupe. Le premier programme du groupe reçoit
    l'origine `llm`, les autres l'origine `concordance`.
- **Étiquetage** : `pnpm classify:cpge --pilote` avec le modèle local (Ollama),
  ou `--albert gpt-oss-120b`. Albert est limité à 10 requêtes par minute et à
  1,28 million de jetons d'entrée par jour, et le script reste sous ce débit.
  - Les résultats vont dans `reports/cpge-pilote/<modèle>.v<regroupement>.jsonl`,
    et une exécution interrompue reprend là où elle s'est arrêtée.
  - Rien n'est écrit dans le contenu.
- **Bilan** : `pnpm report:cpge-pilote` donne, par modèle et par chapitre, la
  couverture par filière, le nombre de rattachements, les confiances, les
  exercices hors programme et l'accord entre modèles.
- **Relecture humaine** : une page de relecture partagée présente chaque
  exercice avec les propositions des deux modèles. Chaque relecteur y accepte,
  rejette ou ajoute des sous-sections, et les décisions servent à mesurer la
  précision de chaque modèle.

Le premier regroupement (v1, archivé dans `reports/cpge-pilote/v1/`) exigeait
des titres identiques, sections comprises. Il a mis en évidence deux défauts :

- aucun rattachement PCSI ni PTSI sur les polynômes, dont les titres diffèrent
  de ceux de MPSI ;
- BCPST presque jamais retenu (8 %), ses candidats étant relégués en fin de
  liste.

Le regroupement v2 porte la couverture PCSI et PTSI à 98 % et plus, et la
couverture BCPST1 à 73 % avec `gpt-oss-120b` et 42 % avec Mistral Small en
local.

Une relecture IA des 324 exercices (Opus 5.5, tenue à part de la relecture
humaine) a ensuite trouvé trois défauts récurrents :

- des prérequis évidents proposés comme objet de l'exercice ;
- la 2e année presque toujours proposée à tort (9 % de propositions
  acceptées) ;
- des trous dans la table de correspondance : continuité, dérivabilité,
  séries, arithmétique…

La v3 y répond :

- **Consignes.** Le prompt écarte les prérequis et ne retient une famille que
  si la notion figure dans ses contenus. Le modèle juge d'après l'énoncé, pas
  d'après le résumé généré. Un énoncé vide n'est pas soumis au modèle.
- **Table.** Elle retire la 2e année des chapitres de L1 et ajoute les sections
  manquantes.
- **Regroupement.** Deux sous-sections de même titre (« Divisibilité et
  division euclidienne » dans ℤ et dans K[X]) sont départagées par leur section.
- **Taille des prompts.** Les extraits de programme sont plus courts, pour
  tenir dans le contexte du modèle local et dans le quota quotidien d'Albert ;
  `--estimer` mesure les prompts sans appeler de modèle.

Comparées à la relecture IA, les propositions acceptées passent de 70 % à
75 % (gpt-oss) et 76 % (Mistral). En contrepartie, les rattachements retrouvés
passent de 91 % à 86 % (gpt-oss) et de 82 % à 73 % (Mistral, devenu très
prudent sur BCPST). Les résultats v1 et v2 sont archivés dans
`reports/cpge-pilote/v1/` et `v2/`.

Tous les exercices de la base ne relèvent pas d'un programme de CPGE. La
table n'est qu'un accélérateur : un chapitre sans équivalent (fonctions
holomorphes, théorèmes de Sylow) y figure avec une liste vide, et ses
exercices sont écartés sans appel au modèle. Pour les autres chapitres, c'est
au modèle de reconnaître un exercice hors programme.

Une extension L2-L3 du pilote (`pnpm classify:cpge --pilote-l2l3` : 101
exercices de six chapitres) mesure cette capacité :

- la table écarte bien les 34 exercices des chapitres sans équivalent ;
- sur les 7 exercices hors CPGE des autres chapitres (topologie générale,
  espaces métriques…), gpt-oss ne s'abstient que 2 fois ;
- il ne s'abstient à tort que sur 1 des 55 exercices au programme.

La page de relecture enregistre désormais l'abstention explicitement (« Ne
relève d'aucun programme de CPGE »). Elle se distingue d'un candidat manquant
dans la table : un exercice au programme dont la sous-section n'est pas
proposée.

La v4 demande d'abord au modèle si l'exercice relève de la CPGE
(`releve_cpge`, avec un motif), avant tout rattachement. Le prompt rappelle
aussi les mentions « hors programme » des sections candidates, chacune
précédée de sa filière. Avec gpt-oss, les exercices hors CPGE écartés passent
de 2 sur 9 à 6 sur 9, mais 13 exercices au programme sur 329 sont écartés à
tort. Deux confusions expliquent ces erreurs :

- une exclusion propre à une filière appliquée à toutes ;
- une notion absente des extraits affichés prise pour une notion hors
  programme.

La v5 corrige la consigne en ce sens. `--uuids` permet de la tester d'abord
sur un jeu de cas difficiles.

### Concordance de 2e année

Le regroupement par titres rapproche des sous-sections de MP, PC, PSI et PT
qui portent le même nom sans couvrir les mêmes notions. Le lemme de
décomposition des noyaux en est un exemple : il est au programme de MP, mais
pas de PC ni de PSI. La table `cpge/concordance.json` remplace ce
regroupement pour la famille tronc-2. Elle a été établie par Opus 5.5 à partir
des programmes officiels, puis relue par une seconde passe d'Opus 5.5. Un
enseignant en a contrôlé un échantillon de 23 éléments, tous jugés corrects.
Elle contient :

- 60 groupes de sous-sections équivalentes ;
- 50 sous-sections propres à un seul programme ;
- 86 écarts. Chacun indique une notion, les filières où elle figure, celles où
  elle ne figure pas, la nature de l'écart (contenu absent, hors programme
  explicite, restriction en commentaire) et la citation du programme.

Elle ne sert qu'à présenter les candidats. Elle ne décide pas si un exercice
relève de la CPGE, et ne remplace pas la table de correspondance par chapitre.

À l'étiquetage, chaque groupe affiche ses écarts, réduits aux filières
présentes parmi les candidats. Pour un groupe à écarts, le modèle doit
indiquer les filières concernées (`filieres`), et seuls leurs nœuds sont
retenus. S'il ne le fait pas, la propagation est marquée `a_verifier:
"ecarts"` : un premier essai avec gpt-oss montre que le modèle précise bien
les filières pour une notion propre à MP, mais pas toujours pour un écart
plus discret, comme le théorème de Cayley-Hamilton, absent du programme de PT.
La 1re année garde le regroupement par titres, en attendant une concordance
MPSI, PCSI, PTSI construite de la même façon.

### Résultats de la v5

La v5 a tourné sur tout le pilote (L1 et L2-L3). gpt-oss a traité 333
exercices, et mistral-small3.2 en local 58, en parallèle (`--alterner`). Face
à la relecture d'Opus 5.5 :

| Version | Précision | Rappel | Hors CPGE écartés | Écartés à tort |
| ------- | --------- | ------ | ----------------- | -------------- |
| v3      | 67 %      | 81 %   | 2 sur 7           | 0 sur 371      |
| v4      | 70 %      | 70 %   | 6 sur 7           | 13 sur 329     |
| v5      | 70 %      | 69 %   | 6 sur 7           | 7 sur 371      |

Opus a relu les propositions de la v3, ce qui avantage la v3 dans cette
comparaison. 76 groupes proposés par la v5 sur 1009 n'ont pas d'avis
d'Opus et comptent ici comme des erreurs. Sur les seuls groupes jugés, la
précision de la v5 est de 74 %.

La baisse du rappel depuis la v4 vient surtout de BCPST. Des exercices sur
les suites ou les nombres complexes, au programme de BCPST 1re année, ne lui
sont plus rattachés : 219 exercices proposaient BCPST 1re année en v3, 103 en
v5. Sur 147 propagations, le modèle n'a pas précisé les filières alors que le
groupe avait des écarts ; elles restent à vérifier.

### v6 : une réponse par famille, étiquetage par Opus

Pour corriger la baisse sur BCPST, la v6 demande une réponse par famille
affichée, dans l'ordre, avec une liste vide si l'exercice ne relève pas de
cette famille. Le modèle n'est plus épinglé à un modèle local ou à Albert :
l'étiquetage est fait par Opus 5.5 dans une session Claude Code.
`--exporter` écrit les prompts par lots d'un même chapitre, et `--reponses`
réimporte les réponses avec le même traitement que celui des modèles
appelés.

Sur le pilote, avec les mêmes contenus que gpt-oss (tronqués à 260
caractères), et face à la relecture d'Opus 5.5 de la v3 :

| Version        | Précision | Rappel | Hors CPGE écartés | Écartés à tort |
| -------------- | --------- | ------ | ----------------- | -------------- |
| v5, gpt-oss    | 70 %      | 69 %   | 6 sur 7           | 7 sur 371      |
| v6, Opus 5.5   | 91 %      | 78 %   | 7 sur 7           | 5 sur 371      |

La référence est elle aussi une production d'Opus. Ces chiffres mesurent
donc sa cohérence, pas sa justesse : un contrôle humain sur échantillon reste
nécessaire. Les cinq exclusions en désaccord sont des cas limites : critère
de Cauchy, et exercices posés dans un espace topologique général mais
faisables dans un espace normé.

Les étiqueteurs signalent deux limites du pilote :

- La coupure des contenus à 260 caractères masque environ 40 % du texte des
  programmes : les coefficients binomiaux, la limite monotone en BCPST, etc.
- Des candidats manquent dans la table de correspondance : second degré,
  formule du binôme, division euclidienne, familles libres, sommes
  télescopiques, lemme de Cesàro, valeurs d'adhérence…

### v7 : contenus complets et table complétée

La v7 reprend la consigne de la v6, avec deux changements. Les contenus du
programme sont complets, et la table est complétée de 68 nœuds, d'après les
candidats manquants que les étiqueteurs ont signalés. Les notions absentes
de tous les programmes ne sont pas ajoutées (lemme de Cesàro, valeurs
d'adhérence, barycentre…). Les chapitres de L2-L3 peuvent maintenant citer
la 1re année.

| Version | Précision | Précision, groupes jugés | Rappel | Sans rattachement |
| ------- | --------- | ------------------------ | ------ | ----------------- |
| v6      | 91 %      | 95 %                     | 78 %   | 12                |
| v7      | 84 %      | 94 %                     | 78 %   | 7                 |

La précision baisse parce que la référence, faite sur les candidats de la
v3, ne juge pas 107 groupes de la v7. Parmi eux, 55 portent sur des
candidats ajoutés à la table. Sur les groupes jugés, la précision est stable.
Les deux passages d'Opus donnent le même verdict CPGE pour les 391
exercices. Ils proposent des rattachements identiques pour 62 % d'entre eux,
avec un recouvrement moyen de 0,83 (indice de Jaccard). Seul un contrôle
humain peut maintenant départager les cas où ils divergent.

### Étiquetage direct, sans table de correspondance

Avec `--direct`, les candidats sont tous les programmes : 355 groupes, avec
les mêmes regroupements entre filières. Les lots donnent le sommaire des
programmes, et le texte officiel complet (contenus et commentaires) est
écrit à côté. Le modèle repère les groupes plausibles dans le sommaire, puis
relit leur texte officiel avant de les retenir. Le chapitre universitaire de
l'exercice n'intervient plus.

Essai sur les 40 exercices de l'échantillon de contrôle, comparés à la v7 :

- même verdict CPGE pour 39 exercices. XhZo, sur la connexité de l'ensemble
  des valeurs d'adhérence, est jugé hors CPGE par la v7 et en CPGE en direct ;
- rattachements identiques pour 22 exercices, recouvrement moyen de 0,74 ;
- autant de groupes retenus (90 pour la v7, 91 en direct) ;
- 10 exercices rattachés hors des candidats de la table, dont les exercices
  mal classés à la source : Pmj5 (fonctions de deux variables), dOCG,
  7Jo3 (dénombrabilité).

### Présélection par embeddings

La table de correspondance ne doit servir qu'à accélérer. `--preselection`
donne à chaque exercice une liste de départ : les candidats de la table, là
où elle existe, et les 15 groupes les plus proches de son résumé, par
similarité entre le vecteur bge-m3 du résumé (stocké en base) et celui du
texte officiel de chaque groupe. Le lot contient aussi le sommaire de tous
les programmes et leur texte officiel complet : le modèle peut retenir
n'importe quel groupe. Une table vide n'écarte plus le chapitre, elle
signale une exclusion probable.

Les vecteurs des groupes sont gardés en cache (`cache/cpge/`). Sur le pilote,
la liste de départ contient 97 % des rattachements relus (contre 88 % pour la
table seule et 81 % pour les 20 plus proches seuls).

Contrôle humain des 40 exercices de l'échantillon, avec les propositions de
la table et du mode direct présentées ensemble, à l'aveugle :

| Méthode      | Précision | Rappel | Verdict CPGE juste |
| ------------ | --------- | ------ | ------------------ |
| table (v7)   | 89 %      | 83 %   | 38 sur 40          |
| direct       | 88 %      | 83 %   | 39 sur 40          |
| présélection | 88 %      | 83 %   | 38 sur 40          |

Les trois méthodes se valent, mais ne se trompent pas sur les mêmes
exercices : elles diffèrent sur 21 exercices. En présélection, 99 des 102
groupes retenus figuraient dans la liste de départ. 11 groupes proposés
seulement par la présélection n'ont pas encore d'avis.

### v8 : un terme hors programme exclut l'exercice

Jusqu'à la v7, un exercice n'était écarté que si l'essentiel reposait sur une
notion hors programme, et une question isolée qui dépassait le programme ne
l'excluait pas. À partir de la v8, un exercice est hors CPGE dès qu'il emploie
ou demande un terme, une notion ou un résultat qui ne figure au programme
d'aucune filière : espace topologique général, connexité autre que par arcs,
fonction holomorphe, décomposition de Dunford, birapport… Une seule question
suffit. Une méthode de résolution hors programme n'exclut pas l'exercice si
une autre voie, au programme, permet de le traiter. Une notion au programme
d'une seule filière (la dénombrabilité en MP, par exemple) ne l'exclut pas
non plus. Le motif cite le terme en cause.

Un terme hors programme que l'énoncé définit lui-même n'exclut pas
l'exercice ; employé sans définition, il l'exclut (la différence
symétrique, par exemple). Un résultat hors programme établi sans être nommé
(la décomposition de Dunford démontrée à partir des sous-espaces
caractéristiques) n'exclut pas non plus l'exercice.

Mesure sur les 63 exercices dont le relecteur a donné le verdict (après
correction de deux verdicts, XhZo et buqo, à la lumière de la règle) : la
v8 écarte 11 des 12 exercices hors CPGE, sans écarter à tort aucun des 51
autres. Le seul manqué est dOCG. Avant la règle, le modèle n'en écartait que
4 sur 10.

Un exercice au programme mais trop difficile, ou hors de l'esprit d'une
filière (BCPST, PTSI…), reste en CPGE. Les pages de relecture permettent de le
noter filière par filière.

La v9 ajoute trois règles que le relecteur a tranchées sur les cas incertains
de l'algèbre de L1 :

- Un terme ancien ou une notation hors programme qui désigne une notion du
  programme (« projection de base F et de direction G », E\* pour les formes
  linéaires) n'exclut pas l'exercice si celui-ci se rédige entièrement avec
  les notions du programme.
- Un terme hors programme présent seulement dans une remarque ou un aparté
  de la réponse exclut l'exercice (« (L(E), ∘) est un magma », srFD).
- Borne supérieure ou inférieure dans un ensemble ordonné autre que R, non
  définie : exclut. Plus grand ou plus petit élément : n'exclut pas.
- Un énoncé qui ne précise pas la dimension se lit en dimension finie s'il y
  est traitable. Si la dimension infinie demande un résultat hors programme
  (l'existence d'un supplémentaire), l'énoncé est signalé.
- Une notion élémentaire de collège ou de lycée employée sans définition
  (polygone convexe, diagonale) n'exclut pas.

Un exercice au contenu défectueux (données absentes, mots corrompus, réponse
fausse) est étiqueté selon son intention, et signalé dans le ticket exobase
de révision des contenus.

### Deux passages et relecture des divergences

Deux chapitres absents de la table ont été étiquetés deux fois, de façon
indépendante, en mode présélection (v7) : « Injection, surjection,
bijection » (L1, 39 exercices) et « Système linéaire à coefficients
constants » (L3, 18 exercices). Les deux passages concordent sur 36
exercices. Les 21 autres ont été relus, avec 5 exercices concordants tirés
au hasard comme contrôle.

- Les 5 contrôles concordants sont justes : la concordance des deux passages
  peut dispenser de relecture.
- 5 exercices jugés en CPGE par les deux passages sont hors CPGE pour le
  relecteur, chacun à cause d'un terme hors programme : limsup et lemme de
  Gronwall (6VBf), puits (LIno), portrait de phase (S8NR), matrice
  semi-simple (SslJ, ckKK). C'est la règle de la v8.
- Hors de ces 5 exercices, sur les rattachements :

| Méthode            | Précision | Rappel |
| ------------------ | --------- | ------ |
| passage A          | 94 %      | 90 %   |
| passage B          | 93 %      | 96 %   |
| union des deux     | 91 %      | 100 %  |
| intersection       | 96 %      | 86 %   |

Relire les seules divergences (37 % des exercices) donne un étiquetage
complet. 8 rattachements ont été marqués « trop difficile », dont 7 en
BCPST 1re année.

#### Algèbre de L1 : trois chapitres en deux passages (v8)

« Application linéaire » (145 exercices), « Arithmétique dans Z » (164) et
« Dénombrement » (86) ont été étiquetés en deux passages par Opus. Les deux
passages concordent sur 209 exercices, qui gardent la proposition de A. Les
186 exercices divergents ont été confiés à un arbitre, avec la consigne
`reports/cpge-pilote/arbitrage-algebre-l1/consigne-arbitre.md` : Opus pour
les lots 1 à 10 (150 exercices), Haiku 5.5 pour les lots 11 à 13 (36
exercices). Pour chaque groupe proposé par A ou B, l'arbitre décide de le
garder ou de le retirer. Il précise les filières, note celles où l'exercice
est trop difficile et marque l'exercice « incertain » quand sa décision
dépend d'une question de règle encore ouverte.

`scripts/assembler-arbitrage-cpge.js` produit les réponses finales.
Elles sont importées par `classify-cpge.js --reponses`, puis annotées avec
l'origine de chaque décision (`decision`), les filières jugées trop
difficiles (`difficile`) et les cas incertains (`incertain`,
`raison_incertitude`). Le résultat est
`reports/cpge-pilote/claude_opus-5-5+haiku-5-5.algebre-l1.final.jsonl`.

16 exercices étaient incertains, dont 9 à cause d'une question de règle
ouverte. Une fois les règles de la v9 tranchées, les décisions du relecteur
(`arbitrage-algebre-l1/regles-tranchees.json`, option `--tranchees`)
remplacent celles des arbitres. Elles s'appliquent aussi à deux exercices où
les passages concordaient : fdhp revient en CPGE (E\* se lit « forme
linéaire »), srFD en sort (« magma » en aparté).

- 5 exercices sont hors CPGE : division suivant les puissances croissantes
  (7tyn), magma (srFD), bornes supérieure et inférieure dans un ensemble
  ordonné quelconque (qlIT, drxQ), formule du crible nommée et demandée
  (WXS3).
- Les 7 derniers incertains ont été tranchés par le relecteur : données
  absentes (2Ks0), énoncé corrompu (cWuh), dimension non précisée (Oemy,
  XXss) et réponse fausse (Dniq) sont étiquetés et signalés dans
  [exobase#4](https://github.com/automathproject/exobase/issues/4) ; les
  rattachements de BErY et v8uq sont ceux de l'arbitre. Il ne reste aucun
  exercice incertain.
- 11 exercices ont au moins une filière notée « trop difficile ».
- Les arbitres n'appliquaient pas encore la règle de l'aparté : d'autres
  exercices gardés en CPGE peuvent contenir un terme hors programme dans une
  remarque de leur réponse.

### Essai d'étiquetage de masse avec Haiku 5.5 (v9)

Avant d'étiqueter le reste de la base (7 839 exercices), un essai a porté
sur deux chapitres exo7 de L1 entiers : « Polynôme, fraction rationnelle »
(213 exercices) et « Fonctions circulaires et hyperboliques inverses » (79).
Il a été fait en un seul passage, sans arbitrage, par des sous-agents
Haiku 5.5, avec des lots de 15 exercices et 4 agents en parallèle.
Le résultat est
`reports/cpge-pilote/claude_claude-haiku-5-5.v9.exo7-l1-essai.jsonl`.

- Coût : 3,5 M de tokens, soit environ 12 000 par exercice, et un peu plus
  de 3 minutes par lot.
- Aucune erreur d'import, aucun groupe rejeté.
- 18 exercices sont hors CPGE. 9 emploient les fonctions hyperboliques
  réciproques, que le programme exclut explicitement. Les 9 autres font
  intervenir l'irréductibilité sur Z ou Q[i], la caractéristique d'un corps,
  l'anneau principal, l'enveloppe convexe ou la détermination continue de
  l'argument.
- En un seul passage, les verdicts ne sont pas toujours cohérents d'un lot
  à l'autre. Les 7 exercices qui demandent une division suivant les
  puissances croissantes ont été gardés, alors que l'arbitrage de l'algèbre
  de L1 en avait exclu un (7tyn). « Enveloppe convexe » excluait 09nK, mais
  pas LGKF ni Zmuc.
- Le relecteur a tranché : la division suivant les puissances croissantes
  et l'enveloppe convexe excluent, et elles figurent désormais parmi les
  exemples de la règle d'exclusion. Les 7 exercices et LGKF (enveloppe
  convexe non définie dans la réponse) passent hors CPGE, soit 26 en tout.
  Zmuc reste en CPGE : son énoncé définit l'enveloppe convexe par les
  barycentres à coefficients positifs.

## Intégration dans l'application

- **Navigation `/browse`** : un onglet « Prépa » en plus de la navigation par
  niveau. On y parcourt filière → semestre (1re année) → section →
  sous-section, avec des compteurs. La page de section affiche le bandeau du
  programme officiel en introduction, un contenu que l'on a déjà gratuitement.
- **Recherche** : paramètres `filiere=PCSI` et `cpge=<nœud>`, où le nœud est
  une section ou une sous-section. Le bouton « CPGE » de la barre latérale devient « a au moins un
  rattachement ».
- **Page d'exercice** : des badges « MPSI · S1 · Nombres complexes — f)
  Racines n-ièmes » renvoient vers le texte du programme.
- **Éditeur `/create`** : un champ de rattachements CPGE avec autocomplétion
  sur les nœuds, et des suggestions de `metadataTask()` fondées sur le
  référentiel plutôt que sur la base.
- **Fiches** : on peut générer automatiquement une fiche par section de
  programme (les exercices validés dans l'ordre du texte officiel).

## Phases

| Phase | Contenu                                                                                  | État    |
| ----- | ---------------------------------------------------------------------------------------- | ------- |
| 0     | Programmes officiels (9 textes, 11 filières) convertis en Markdown structuré             | fait    |
| 1     | Analyseur Markdown → nœuds, tables SQLite, tests (unicité et stabilité des identifiants) | fait    |
| 2     | A priori par chapitre, étiquetage LLM, concordance, rattachement de crouzet/pcsi         | pilote  |
| 3     | Navigation « Prépa », filtres de recherche, badges                                       | à faire |
| 4     | Éditeur `/create` et vue de validation                                                   | à faire |

## Questions ouvertes

- **Autres filières.** On peut ajouter TSI, TPC, TB ou ECG en ajoutant des
  fichiers de programme, sans changer le modèle.
- **Le référentiel universitaire** (TODO du README) existe déjà dans exobase
  (`content/referentials/amscc/referentiel.md`) et arrive maintenant avec la
  synchronisation. Il reste à le brancher de la même manière : analyseur,
  table, identifiants stables.
