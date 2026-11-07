# Animations interactives associées aux exercices

Un exercice peut renvoyer à une figure interactive (curseurs, courbes, lecture
pas à pas) produite à part, par exemple dans les diaporamas du cours OPTRN.
La source l'annonce par une commande, le site l'ouvre à la demande.

La page de l'animation suit le même chemin qu'un extrait Python appelé par
`\pythoncode` : elle est éditée avec l'exercice, puis synchronisée.

```text
Exercices                     exobase                              OpenYourMath
src/ebva.tex             →    content/exercises/amscc/ebva.tex  →  content/exercises/amscc/ebva.tex
code/python/<f>.py       →    content/code/amscc/python/<f>.py  →  content/code/amscc/python/<f>.py
animations/<nom>.html    →    content/animations/amscc/<nom>.html → content/animations/amscc/<nom>.html
```

`node scripts/sync-exercices.mjs --apply` (dans exobase) puis
`pnpm sync:exobase --apply` (ici) transportent la page comme le reste du contenu.

## Dans la source de l'exercice

```latex
\reponse{
  …
  \animation{ebva-directionnelle}{Dérivée directionnelle en l'origine : la formule du gradient donne une valeur fausse}
}
```

- **Nom** : lettres, chiffres, `-` et `_` ; il désigne `animations/<nom>.html` dans
  le dépôt d'édition, `content/animations/<source>/<nom>.html` ici. Il est **unique
  toutes sources confondues** : l'adresse publique `/animation/<nom>`, imprimée
  dans les PDF, ne porte pas la source. On le préfixe par l'uuid de l'exercice
  (`ebva-directionnelle`).
- **Légende** : texte simple, sans formule. Elle sert de titre à l'iframe et c'est
  la seule trace de l'animation dans un PDF, avec son adresse et son QR code.
- La commande se place dans le bloc que l'animation illustre : elle s'affiche à sa position.

## Charte de création

### Quand en faire une

- L'animation montre ce qu'une figure fixe ne peut pas montrer : l'effet d'un
  paramètre, un passage à la limite, une construction pas à pas, un
  contre-exemple que l'on explore.
- Elle sert un point précis de l'exercice. Une illustration générale du chapitre
  a sa place dans le cours, pas dans un exercice.
- Une seule idée par animation, une ou deux animations au plus par exercice.

### Où la placer

- Dans l'énoncé (`\texte`, `\question`), elle fait explorer et conjecturer : elle
  ne doit pas livrer la réponse.
- Dans la correction (`\reponse`), elle peut montrer le résultat, comme dans ebva
  où elle fait voir que la formule du gradient est en défaut.

### L'exercice tient sans elle

- Énoncé et correction sont complets sans l'animation : elle illustre, elle ne
  démontre pas. Aucune question ne s'appuie sur une information que seule
  l'animation donne.
- Sur papier, il ne reste que la légende, l'adresse et le QR code. Si une figure
  est nécessaire à la compréhension, une figure fixe (TikZ ou image)
  l'accompagne, comme la surface TikZ d'ebva.

### Nom et légende

- Nom `<uuid>-<idée>`, stable : il est imprimé dans les PDF, on ne le renomme pas
  et on ne le réutilise pas pour une autre figure.
- La légende dit ce que l'on observe, pas seulement le sujet : « la formule du
  gradient donne une valeur fausse, bien que les dérivées partielles existent »
  plutôt que « Dérivée directionnelle ». C'est tout ce que lit le lecteur du PDF.

### Contenu de la page

- Un court texte d'introduction : ce que l'on manipule, ce qu'il faut regarder.
- Les notations sont celles de l'exercice : mêmes lettres, même fonction.
- Chaque commande est nommée et affiche sa valeur courante ; les valeurs
  remarquables s'atteignent en un clic (les boutons `u ∝ (1,0)`, `(1,1)`… d'ebva).
- Rien ne bouge tout seul. Un mouvement automatique se lance par un bouton,
  se met en pause, et respecte `prefers-reduced-motion`.
- Utilisable à la souris, au doigt et au clavier : on préfère les contrôles
  natifs (`<input type="range">`, `<button>`).
- Lisible sur un téléphone en portrait (360 px de large). C'est la limite des
  pages extraites des diaporamas : voir « Limites connues ».
- Couleurs et police du site : voir « Charte graphique » ci-dessous.

### Contraintes techniques

Elles découlent de l'isolation de la page (voir « Isolation ») :

- un seul fichier HTML, styles et scripts compris, sans aucune ressource
  externe : le CSP la bloquerait (contrôlé par `check_animation_assets.py`) ;
- KaTeX depuis `/animation-vendor/katex/` (`katex.min.css`, `katex.min.js`,
  `contrib/auto-render.min.js`) ;
- hauteur signalée à chaque changement par
  `parent.postMessage({oym: 'animation-size', height}, '*')`, bornée entre 80 et
  1400 px par le lecteur ;
- ni cookies, ni `localStorage`, ni requête réseau : l'origine est opaque ;
- quelques dizaines de Kio (46 Kio pour ebva).

### Avant de proposer une animation

1. `python3 scripts/check_animation_assets.py` dans Exercices.
2. Le PDF d'Exercices compile et l'encadré se lit sans la page.
3. La page s'ouvre seule (`/animation/<nom>`), puis dans l'exercice, sur
   ordinateur et sur téléphone en portrait.

## Version imprimée

`\animation` produit un encadré avec la légende, l'adresse
`https://openyourmath.org/animation/<nom>` et un QR code de cette adresse
(paquet `qrcode`), placé là où la commande apparaît. La définition existe en deux
exemplaires, à garder identiques :

- `Exercices/_preambules/general.tex`, pour les PDF d'Exercices ;
- `src/lib/latex/export.js`, pour l'export LaTeX et PDF des listes d'OpenYourMath,
  qui n'ajoute `hyperref`, `qrcode` et la définition que si une animation est
  présente.

Aucune image de l'animation n'est produite : d'où la règle d'une figure fixe à
côté quand elle est nécessaire.

## Ce que fait chaque maillon

| Étape | Fichier | Rôle |
|---|---|---|
| Parseur | `scripts/parse-latex.js`, `src/lib/animations.js` | pandoc ignore la commande : un emplacement `.oym-animation` la remplace dans le HTML, `artifacts.animations` liste les noms |
| Lecteur | `src/lib/actions/animationFrames.js` (appelé par `MathRenderer`) | une vignette ▶ ; l'iframe ne s'ouvre, et la page ne se charge, qu'au clic |
| Synchronisation | `scripts/sync-exobase.js` | importe `animations/<source>/` d'exobase, comme `code/<source>/python/` |
| Page isolée | `src/routes/animation/[name]/+server.js` | retrouve la source du nom (`indexAnimationPages`) et sert la page avec une politique CSP `sandbox allow-scripts` |
| KaTeX | `src/routes/animation-vendor/katex/[...path]/+server.js` | copie de KaTeX du site, avec `Access-Control-Allow-Origin` |
| Export LaTeX | `src/lib/latex/export.js` | définit `\animation` : encadré avec la légende, l'adresse et son QR code (voir « Version imprimée ») |
| Contrôle | `pnpm check:animations` | page existante, nom valide et propre à une seule source, page bien rangée, légende présente et sans formule |

## Isolation

Le HTML d'une animation est du JavaScript arbitraire. La page est servie dans un
bac à sable sans `allow-same-origin` : elle tourne dans une origine opaque, sans
accès aux cookies, au stockage ni à la page qui l'embarque (vérifié dans
Chromium). Elle ne peut que signaler sa hauteur à la page, par `postMessage`,
accepté uniquement de cette iframe. Le CSP interdit toute requête réseau autre
que le site lui-même.

Les pages sont incluses dans le paquet du serveur (`import.meta.glob`) : ajouter
ou modifier une animation demande de **reconstruire l'application**, pas
seulement le contenu. `pnpm sync:exobase --apply` le rappelle quand il en copie.

## Produire une animation à partir d'un diaporama OPTRN

```bash
pnpm extract:animation --deck ../../cours/cours-OPTRN/slides/td1-s1-fonctions \
  --widget directionnelle --name ebva-directionnelle \
  --title "Dérivée directionnelle : 4 contre 2 (exercice ebva)" \
  --out ../../exercices/Exercices/animations
```

Le script réunit la feuille de style du gabarit, `kit.js`, `widgets.js` et le
texte d'introduction de la figure en une page autonome, réduite pour tenir dans
son cadre. Il écrit dans le dossier `animations/` du dépôt d'édition (`--out`),
jamais directement ici : la page arrive par les synchronisations. La page est
générée : on la régénère plutôt que de la modifier.

### Ajouter une animation à un exercice

1. Générer la page dans `Exercices/animations/` (ci-dessus), ou y déposer une
   page écrite à la main qui respecte la charte de création.
2. Ajouter `\animation{<nom>}{<légende>}` dans le bloc de l'exercice qu'elle
   illustre ; le PDF d'Exercices compile la commande (`_preambules/general.tex`).
3. Committer dans Exercices, puis synchroniser exobase et OpenYourMath.
4. Ici : `pnpm check:animations`, `pnpm build:content`, reconstruire l'application.

### Charte graphique

La page reprend celle du site : `OYM_PALETTE` (dans `scripts/extract-animation.js`)
remplace chaque couleur des diaporamas par un jeton de `src/app.css`
(vert d'eau `brand-600`, orange `accent-600`, encre `interface-text-primary`,
filets `interface-border-primary`…), y compris dans les figures dessinées en
JavaScript. La police est celle du site (`Source Sans Pro`, sans-serif). Deux
écarts assumés :

- le texte teinté prend `brand-700` et `accent-700`, car `brand-600` et `accent-600`
  n'atteignent que 3,8:1 et 4,4:1 sur le fond ;
- le gris des légendes est `#557583` (4,9:1) plutôt que `text-muted` (3,7:1).

Pour changer l'aspect de toutes les animations, on modifie cette table puis on
régénère les pages.

## Limites connues

- Aucun gabarit n'existe pour une page écrite à la main : l'extracteur ne couvre
  que les diaporamas OPTRN.
- Les figures des diaporamas sont dessinées pour 1280×720 : dans une colonne
  étroite, elles sont réduites (environ 0,3 sur un téléphone en portrait) et
  peu lisibles. Le bouton « Plein écran » est le contournement ; une version
  adaptée aux petits écrans reste à concevoir.
- Rien n'est encore prévu pour `prefers-reduced-motion` : les figures actuelles
  réagissent aux curseurs et ne s'animent pas d'elles-mêmes.
