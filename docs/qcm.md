# QCM et sessions en direct

Les QCM sont un type de contenu à part entière, à côté des exercices. Ils
viennent d'exobase (`content/qcm/<source>/`, format décrit dans
`exobase/content/qcm/FORMAT.md`), gardent leur source LaTeX au format du paquet
[exo7qcm](https://github.com/exo7math/qcm-exo7), et se jouent sur le site :
seul, ou en classe dans une session en direct.

## Ce qu'est un contenu qcm

Un fichier `.tex` est un contenu qcm : l'unité que l'on cherche, que l'on
ajoute à une liste et que l'on joue. C'est

- une **question indépendante**, le cas général ;
- ou une **série ordonnée** (`\serie{ordonnee}`) : plusieurs questions qui
  partagent un énoncé et s'appuient les unes sur les autres.

L'ordre d'une série fait partie du contenu. Ses questions ne sont jamais des
fichiers séparés : sur le site, une question ne s'ouvre qu'une fois la
précédente validée, et une session en direct les joue dans l'ordre du fichier.

## Pipeline

```text
exobase/content/qcm/<source>/**/*.tex
        │  pnpm sync:exobase --apply
        ▼
content/qcm/<source>/**/*.tex
        │  pnpm build:qcm            (scripts/parse-qcm.js, un appel pandoc par fichier)
        ▼
cache/qcm/<source>/**/*.json        content_type: "qcm"
        │  pnpm build:db
        ▼
data/exercises.sqlite               table exercises, colonne content_type = 'qcm'
```

`pnpm build:content` enchaîne ces étapes. Les images (`\qimage{…}`) suivent le
chemin des `\includegraphics` : `content/images/<source>/<format>/` puis
`static/artifacts/images/<uuid>/`.

Un qcm entre dans la base comme un exercice dont les questions portent des
réponses à cocher. Dans `content_json`, chaque question donne deux blocs :

| Bloc | Contenu |
|---|---|
| `question` | `html` et `latex` : l'énoncé suivi des réponses lettrées, lisibles par tout ce qui ignore les qcm (recherche, aperçus, export LaTeX). Champ `qcm` : `stem_html`, `choices[{ html, correct, feedback_html }]`, `explanation_html`, `type`, `keepOrder`, `source` (LaTeX d'origine). |
| `reponse` | « Réponses justes : A, C. » puis les explications. |

Conséquences :

- la **recherche**, la navigation et les fiches traitent les qcm comme les
  exercices ; le filtre « QCM » de la recherche (`?qcm=1`, ou `qcm=0` pour les
  écarter) et la pastille « QCM » des résultats les distinguent ;
- les **listes sont mixtes** : exercices et qcm s'y mêlent, et l'export LaTeX
  imprime un qcm comme une question à cases, avec son corrigé ;
- les UUID sont tirés dans le même espace que ceux des exercices. Un doublon
  est écarté par `build-db.js`, et refusé en amont par
  `exobase/tools/validate/check_qcm_sources.py`.

L'affichage interactif est dans `src/lib/components/qcm/` (`QcmQuestion`,
`QcmChoices`) ; `ExerciseContent` s'en sert dès qu'un bloc porte `qcm`. Une
réponse est juste quand elle coche toutes les réponses justes, et elles seules
(`src/lib/qcm/blocks.js`). L'ordre des réponses est celui de la source : en
classe, tout le monde doit voir la même réponse « B ».

## Sessions en direct

Un enseignant projette les questions, la classe répond depuis ses téléphones.
Il n'y a **aucun compte** et rien n'est conservé.

1. Depuis une liste qui contient au moins un qcm (bouton « QCM en direct »), ou
   depuis la page d'un qcm (« Session en direct »), le site ouvre une session
   et affiche l'écran d'animation `/classe/<code>/animer`. Les exercices d'une
   liste mixte ne sont pas joués.
2. Les participants vont sur `/classe`, saisissent le code à six caractères (ou
   scannent le QR code) et choisissent un pseudonyme.
3. Pour chaque question, l'enseignant **ouvre** les réponses, voit en direct
   combien ont répondu, **clôt**, ce qui affiche la répartition, puis **montre
   la correction**. La répartition reste cachée tant que les réponses sont
   ouvertes, pour ne pas orienter la classe ; chacun peut changer sa réponse
   jusqu'à la clôture.
4. À la fin, l'enseignant voit le bilan par participant et par question, et
   peut le télécharger en CSV. Il n'existe que sur sa page.

### Fonctionnement

- L'état vit **en mémoire** dans le processus Node
  (`src/lib/server/classe/sessions.js`) : pas de table, pas de fichier. Un
  redémarrage du serveur termine les sessions en cours. Cela suppose une seule
  instance de l'application, ce qui est le cas du déploiement Docker.
- Le temps réel passe par des *Server-Sent Events*
  (`/api/classe/<code>/flux`) : une connexion HTTP longue par personne, sans
  serveur WebSocket ; Caddy la relaie telle quelle. L'état est poussé à chaque
  changement, et les statistiques destinées à l'enseignant sont regroupées
  (un envoi au plus toutes les 0,7 s).
- Les rôles tiennent à un **cookie** `HttpOnly` propre à la session, posé à la
  création (enseignant) ou à l'entrée (participant). Seul le navigateur qui a
  ouvert la session peut l'animer.
- Les réponses justes ne quittent le serveur qu'au moment de la correction : le
  flux d'un participant ne contient ni `correct`, ni statistiques, ni liste des
  autres participants.

| Route | Rôle |
|---|---|
| `POST /api/classe` | ouvrir une session à partir d'une liste d'UUID |
| `GET /api/classe/<code>` | renseignements publics (titre, places) |
| `POST /api/classe/<code>` | entrer avec un pseudonyme |
| `GET /api/classe/<code>/flux` | flux d'état (`?role=hote` pour l'enseignant) |
| `POST /api/classe/<code>/reponse` | répondre à la question en cours |
| `POST /api/classe/<code>/pilotage` | `open`, `close`, `reveal`, `next`, `prev`, `goto`, `end` |
| `GET /api/classe/<code>/resultats` | bilan (`?format=csv`) |

### Plafonds de charge

Le serveur de déploiement est petit : chaque dimension est bornée, et une
demande au-delà est refusée avec un message clair plutôt que de dégrader tout
le site. Les valeurs se règlent par variables d'environnement
(`docker-compose.yml`).

| Variable | Défaut | Effet |
|---|---|---|
| `CLASSE_MAX_PARTICIPANTS` | 60 | participants par session ; les suivants sont refusés à l'entrée |
| `CLASSE_MAX_SESSIONS` | 8 | sessions ouvertes en même temps |
| `CLASSE_MAX_CONNEXIONS` | 300 | connexions temps réel ouvertes, toutes sessions confondues |
| `CLASSE_MAX_QUESTIONS` | 40 | questions par session |
| `CLASSE_DUREE_MAX_MIN` | 180 | durée de vie d'une session |
| `CLASSE_INACTIVITE_MIN` | 45 | fermeture d'une session sans activité |

Ordre de grandeur : une connexion ouverte coûte quelques kilo-octets et un
message toutes les 25 s ; une session de 60 personnes garde en mémoire ses
questions (HTML déjà composé) et une réponse par personne et par question. Les
défauts tiennent largement sur un VPS d'un cœur et 1 Go ; `CLASSE_MAX_CONNEXIONS`
est le garde-fou global à baisser en premier si la machine est partagée.

Pour une salle derrière une seule adresse IP (cas courant), les limites de
débit par adresse sont larges à l'entrée et ne visent que la création de
sessions en rafale (10 par 10 minutes).

## Tests

```bash
npx vitest run tests/build/qcm.test.js tests/build/classe.test.js
```

`qcm.test.js` couvre la lecture des sources, la conversion en blocs, la
correction et l'export CSV ; `classe.test.js` le déroulé d'une session, les
droits de chacun et les plafonds.
