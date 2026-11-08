# Animations interactives associées aux exercices

Un exercice peut renvoyer à une figure interactive (curseurs, courbes, lecture
pas à pas). La source l'annonce par une commande, le site l'ouvre à la demande.

Une figure est un **fichier JavaScript** écrit avec le **kit d'OpenYourMath**.
Le kit fait partie de la plateforme (repère, commandes, mise en page,
couleurs) ; le fichier de la figure est un contenu, rangé avec les exercices de
sa source. Il ne dépend d'aucun diaporama : OpenYourMath l'affiche, et un
diaporama ou une autre page peut le réutiliser (voir « Réutiliser une figure »).

Comme un extrait Python appelé par `\pythoncode`, la figure est éditée avec
l'exercice, puis synchronisée :

```text
Exercices                     exobase                              OpenYourMath
src/ebva.tex             →    content/exercises/amscc/ebva.tex  →  content/exercises/amscc/ebva.tex
code/python/<f>.py       →    content/code/amscc/python/<f>.py  →  content/code/amscc/python/<f>.py
animations/<nom>.js      →    content/animations/amscc/<nom>.js →  content/animations/amscc/<nom>.js
```

`node scripts/sync-exercices.mjs --apply` (dans exobase) puis
`pnpm sync:exobase --apply` (ici) transportent la figure comme le reste du contenu.

## Dans la source de l'exercice

```latex
\reponse{
  …
  \animation[\exercisespath img/pdf/ebva-tikz-1]{ebva-directionnelle}{Dérivée directionnelle en l'origine : la formule du gradient donne une valeur fausse}
}
```

- **Nom** : lettres, chiffres, `-` et `_` ; il désigne `animations/<nom>.js` dans
  le dépôt d'édition, `content/animations/<source>/<nom>.js` ici. Il est **unique
  toutes sources confondues** : l'adresse publique `/animation/<nom>`, imprimée
  dans les PDF, ne porte pas la source. On le préfixe par l'uuid de l'exercice
  (`ebva-directionnelle`).
- **Légende** : texte simple, sans formule. Elle sert de titre à l'iframe ; dans un
  PDF, elle accompagne l'image fixe, l'adresse et son QR code.
- **Image fixe** (facultative, entre crochets) : chemin écrit comme pour un
  `\includegraphics` d'Exercices (`\exercisespath img/pdf/<uuid>-tikz-<n>`, source
  dans `img/tikz/`). Le PDF l'imprime dans l'encadré ; le site en fait la vignette
  du lecteur, sur laquelle un clic ouvre aussi l'animation.
- La commande se place dans le bloc que l'animation illustre : elle s'affiche à sa position.

## Écrire une figure

Le fichier contient les mathématiques de la figure, ses commandes et ses
textes, et rien d'autre :

```js
// animations/ebva-directionnelle.js
OYMWidgets.define('ebva-directionnelle', {
  title: "Dérivée directionnelle en l'origine",        // titre de la page
  intro: 'On fait tourner la direction \\(u\\)…',       // texte au-dessus de la figure
  state: { deg: 63.4349 },                              // état initial

  mount(root, { kit, state }) {
    const [left, right] = kit.columns(root, { ratio: [2, 3] });
    const P = kit.plot(left, { w: 420, h: 420, x: [-1.4, 1.4], y: [-1.4, 1.4], labels: ['\\(x\\)', '\\(y\\)'] });
    const theta = kit.slider(right, { label: '\\(\\theta\\) =', min: 0, max: 360, step: 1, value: state.deg, onInput: draw });
    const out = kit.output(right);
    function draw() { /* calques du repère, puis kit.put(out, '<table>…</table>') */ }
    draw();
  },
});
```

- Le nom passé à `define` est celui du fichier (contrôlé).
- `mount` reçoit l'élément où dessiner et l'état initial : celui de `state`,
  remplacé par les attributs `data-*` de l'élément quand une autre page réutilise
  la figure (`<div data-widget="ebva-directionnelle" data-deg="45">`).
- Les formules s'écrivent `\\( … \\)` dans les chaînes JavaScript ; KaTeX les rend.
- Une figure de diaporama OPTRN se convertit en recopiant son dessin : le repère
  et les commandes du kit portent les mêmes noms que ceux de `slides/_commun/kit.js`.

### Le kit

`src/lib/widgets/kit.js` et `kit.css`. Un script autonome, sans dépendance
autre que KaTeX, qui définit `OYMWidgets` :

| Élément | Rôle |
|---|---|
| `kit.columns(parent, { ratio })` | deux colonnes, empilées quand la figure a moins de 720 px de large |
| `kit.plot(parent, { w, h, x, y, margins, labels, ticks, grid, maxWidth, title })` | repère SVG à la largeur du conteneur (`w`, `h` : proportions du viewBox) |
| `P.layer(nom, clip)` | calque vidé à chaque appel, découpé au cadre ; on y redessine ce qui bouge |
| `P.graph(g, f, a, b, { n, cls })` | graphe de f, coupé aux asymptotes et aux sauts |
| `P.fn`, `P.poly`, `P.dot`, `P.line`, `P.arrow`, `P.math`, `P.text`, `P.contours`, `P.heat`, `P.at` | tracés, étiquettes KaTeX, lignes de niveau, carte de couleur, position du pointeur |
| `kit.controls(parent, { column })` | rangée de commandes |
| `kit.slider`, `kit.button`, `kit.segmented` | curseur avec sa valeur, bouton, boutons exclusifs |
| `kit.ticker(ms)` | lecture pas à pas, lancée par un bouton (ralentie avec `prefers-reduced-motion`) |
| `kit.output(parent)`, `kit.put(el, html)` | zone de lecture des valeurs, remplie en HTML avec formules |
| `kit.fmt(x, d)`, `kit.tn(x, d)` | nombre à la française, pour le texte ou pour une formule |
| `kit.html`, `kit.svg`, `kit.math` | créer un élément, rendre les formules d'un élément |

Classes de tracé : `curve` et `gr` (vert d'eau), `path` (orange), `ref`
(pointillés gris), `red`, `lvl` (lignes de niveau), `pt` (point orange ; `pt t`
vert d'eau, `pt k` encre) ; pour le texte, `t` (vert d'eau) et `o` (orange). Pour
la lecture : `ok`, `bad`, `wr` et les encadrés `oym-status` (`o`, `r`).

### Voir la figure pendant qu'on l'écrit

Copier le fichier dans `content/animations/amscc/` puis ouvrir
`http://localhost:5173/animation/<nom>` avec `pnpm dev` : en développement, la
route relit le fichier à chaque requête, un rechargement suffit. La figure
arrive ensuite par les synchronisations, qui la trouvent identique.

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
- Sur papier, il ne reste que l'encadré. On lui donne une **image fixe**
  (`\animation[image]`) : un état parlant de l'animation, de préférence son état
  initial, avec les valeurs qu'elle affiche (pour ebva, les deux courbes en
  fonction de θ et la direction u ∝ (1,2)). On la dessine en **TikZ ou
  pgfplots** : vectorielle, elle passe aussi dans l'export PDF d'OpenYourMath,
  où une image matricielle sans source TikZ est omise. Couleurs du site et
  styles de trait distincts (plein, tirets), pour rester lisible en noir et blanc.

### Nom et légende

- Nom `<uuid>-<idée>`, stable : il est imprimé dans les PDF, on ne le renomme pas
  et on ne le réutilise pas pour une autre figure.
- La légende dit ce que l'on observe, pas seulement le sujet : « la formule du
  gradient donne une valeur fausse, bien que les dérivées partielles existent »
  plutôt que « Dérivée directionnelle ». Avec l'image fixe, c'est ce que lit le
  lecteur du PDF.

### Contenu de la figure

- Un court texte d'introduction (`intro`) : ce que l'on manipule, ce qu'il faut regarder.
- Les notations sont celles de l'exercice : mêmes lettres, même fonction.
- Chaque commande est nommée et affiche sa valeur courante ; les valeurs
  remarquables s'atteignent en un clic (les boutons `u ∝ (1,0)`, `(1,1)`… d'ebva).
- Rien ne bouge tout seul. Un mouvement automatique se lance par un bouton
  (`kit.ticker`) et s'arrête.
- On s'en tient aux commandes du kit : elles se manipulent à la souris, au doigt
  et au clavier.
- Lisible sur un téléphone en portrait (360 px de large) : les colonnes du kit
  s'empilent, mais un repère très large y devient petit. On garde des
  proportions modestes (ebva : 560 × 250 pour le graphe en θ).
- Ni couleur ni police en dur : les classes du kit les prennent au site.

### Contraintes techniques

Elles découlent de l'isolation de la page (voir « Isolation ») :

- un seul fichier, qui ne charge rien : ni adresse, ni `fetch`, ni `import()`,
  ni `<script>` (contrôlé par `check_animation_assets.py`) ;
- ni cookies, ni `localStorage` : l'origine est opaque ;
- quelques kilooctets (4,5 Kio pour ebva).

### Avant de proposer une animation

1. `python3 scripts/check_animation_assets.py` dans Exercices.
2. Le PDF d'Exercices compile ; l'encadré et son image fixe se lisent sans la figure.
3. La figure s'ouvre seule (`/animation/<nom>`), puis dans l'exercice, sur
   ordinateur et sur téléphone en portrait.

## Version imprimée

`\animation` produit un encadré placé là où la commande apparaît : l'image fixe
s'il y en a une (centrée, à 0,6 de la largeur), puis la légende, l'adresse
`https://openyourmath.org/animation/<nom>` et un QR code de cette adresse (paquet
`qrcode`). `\animationcadre{figure}{nom}{légende}` compose l'encadré ;
`\animation[chemin]{nom}{légende}` l'appelle avec `\includegraphics`. La définition
existe en deux exemplaires, à garder identiques :

- `Exercices/_preambules/general.tex`, pour les PDF d'Exercices ;
- `src/lib/latex/export.js`, pour l'export LaTeX et PDF des listes d'OpenYourMath,
  qui n'ajoute `graphicx`, `hyperref`, `qrcode` et la définition que si une
  animation est présente.

À l'export, l'image fixe suit les règles des figures : sa source TikZ, quand le
parseur l'a retrouvée, est recopiée dans `\animationcadre` ; sinon le fichier
accompagne le document. Pour le compilateur en ligne, qui ne reçoit que du
texte, une image sans source TikZ est omise : l'encadré garde la légende,
l'adresse et le QR code.

## Ce que fait chaque maillon

| Étape | Fichier | Rôle |
|---|---|---|
| Kit | `src/lib/widgets/kit.js`, `kit.css` | `OYMWidgets` : enregistrement, affichage dans `[data-widget]`, repère, commandes, mise en page, couleurs du site, hauteur signalée au lecteur |
| Parseur | `scripts/parse-latex.js`, `src/lib/animations.js`, `scripts/utils/image-artifacts.js` | pandoc ignore la commande : un emplacement `.oym-animation` la remplace dans le HTML, `artifacts.animations` liste les noms ; l'image fixe est publiée comme une figure et devient `data-poster` |
| Lecteur | `src/lib/actions/animationFrames.js` (appelé par `MathRenderer`) | une vignette (l'image fixe) et un bouton ▶ ; l'iframe ne s'ouvre, et la page ne se charge, qu'au clic |
| Synchronisation | `scripts/sync-exobase.js` | importe `animations/<source>/*.js` d'exobase, comme `code/<source>/python/` |
| Page isolée | `src/routes/animation/[name]/+server.js`, `src/lib/widgets/page.js` | retrouve la source du nom (`indexAnimationPages`), assemble KaTeX, le kit et la figure, et sert la page avec une politique CSP `sandbox allow-scripts` |
| KaTeX | `src/routes/animation-vendor/katex/[...path]/+server.js` | copie de KaTeX du site, avec `Access-Control-Allow-Origin` |
| Export LaTeX | `src/lib/latex/export.js` | définit `\animation` : encadré avec l'image fixe, la légende, l'adresse et son QR code (voir « Version imprimée ») |
| Contrôle | `pnpm check:animations` | figure existante, enregistrée sous le nom de son fichier, propre à une seule source et bien rangée ; légende présente et sans formule |

## Isolation

Le fichier d'une figure est du JavaScript arbitraire. La page est servie dans un
bac à sable sans `allow-same-origin` : elle tourne dans une origine opaque, sans
accès aux cookies, au stockage ni à la page qui l'embarque (vérifié dans
Chromium). Elle ne peut que signaler sa hauteur à la page, par `postMessage`,
accepté uniquement de cette iframe. Le CSP interdit toute requête réseau autre
que le site lui-même, et `frame-ancestors 'self'` réserve l'intégration en
iframe au site.

Les figures sont incluses dans le paquet du serveur (`import.meta.glob`) : en
production, ajouter ou modifier une figure demande de **reconstruire
l'application**, pas seulement le contenu. `pnpm sync:exobase --apply` le
rappelle quand il en copie.

## Réutiliser une figure

Une figure ne dépend que du kit : toute page qui charge `kit.css`, `kit.js`,
KaTeX (facultatif) et le fichier de la figure peut l'afficher.

```html
<link rel="stylesheet" href="kit.css">
<div data-widget="ebva-directionnelle" data-deg="45"></div>
<script src="kit.js"></script>
<script src="ebva-directionnelle.js"></script>
<script>OYMWidgets.mountAll();</script>
```

`mountAll` affiche chaque `[data-widget]` une seule fois ; `mount(élément)`
affiche un élément ajouté plus tard. Pour un diaporama autonome, `build.py`
recopie ces fichiers en ligne, comme il le fait aujourd'hui de
`_commun/kit.js`.

## Ajouter une animation à un exercice

1. Écrire la figure dans `Exercices/animations/<nom>.js` (voir « Écrire une
   figure ») et la regarder dans le serveur de développement.
2. Dessiner l'image fixe dans `Exercices/img/tikz/<uuid>-tikz-<n>.tex` et la
   compiler (`make img/pdf/<…>.pdf img/svg/<…>.svg`).
3. Ajouter `\animation[\exercisespath img/pdf/<uuid>-tikz-<n>]{<nom>}{<légende>}`
   dans le bloc de l'exercice qu'elle illustre ; le PDF d'Exercices compile la
   commande (`_preambules/general.tex`).
4. Committer dans Exercices, puis synchroniser exobase et OpenYourMath.
5. Ici : `pnpm check:animations`, `pnpm build:content`, reconstruire l'application.

## Charte graphique

`kit.css` reprend les jetons de `src/app.css` (vert d'eau `brand-600`, orange
`accent-600`, encre `interface-text-primary`, filets `interface-border-primary`…)
et la police du site (`Source Sans Pro`), limités aux éléments `.oym-widget`
pour ne pas toucher une page qui accueille la figure. Deux écarts assumés :

- le texte teinté prend `brand-700` et `accent-700`, car `brand-600` et `accent-600`
  n'atteignent que 3,8:1 et 4,4:1 sur le fond ;
- le gris des légendes est `#557583` (4,9:1) plutôt que `text-muted` (3,7:1).

Pour changer l'aspect de toutes les figures, on modifie `kit.css`.

## Limites connues

- Les diaporamas OPTRN n'utilisent pas encore le kit : leurs figures restent
  dans leur `widgets.js`, et la slide d'ebva garde sa propre copie.
- Les étiquettes d'un repère suivent sa réduction : sur un téléphone, un repère
  large reste lisible mais petit. Le bouton « Plein écran » du lecteur aide.
- L'intégration en iframe hors du site est interdite (`frame-ancestors 'self'`) ;
  une autre page réutilise la figure par ses fichiers.
