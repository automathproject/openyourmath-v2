# Animations interactives associées aux exercices

Un exercice peut renvoyer à une figure interactive (curseurs, courbes, lecture
pas à pas) produite à part, par exemple dans les diaporamas du cours OPTRN.
La source l'annonce par une commande, le site l'ouvre à la demande.

## Dans la source de l'exercice

```latex
\reponse{
  …
  \animation{ebva-directionnelle}{Dérivée directionnelle en l'origine : la formule du gradient donne une valeur fausse}
}
```

- **Nom** : lettres, chiffres, `-` et `_` ; il désigne `content/animations/<nom>.html`.
- **Légende** : texte simple, sans formule. Elle sert de titre à l'iframe et c'est
  la seule trace de l'animation dans l'export PDF, avec son adresse publique.
- La commande se place dans le bloc que l'animation illustre : elle s'affiche à sa position.

## Ce que fait chaque maillon

| Étape | Fichier | Rôle |
|---|---|---|
| Parseur | `scripts/parse-latex.js`, `src/lib/animations.js` | pandoc ignore la commande : un emplacement `.oym-animation` la remplace dans le HTML, `artifacts.animations` liste les noms |
| Lecteur | `src/lib/actions/animationFrames.js` (appelé par `MathRenderer`) | une vignette ▶ ; l'iframe ne s'ouvre, et la page ne se charge, qu'au clic |
| Page isolée | `src/routes/animation/[name]/+server.js` | sert `content/animations/<nom>.html` avec une politique CSP `sandbox allow-scripts` |
| KaTeX | `src/routes/animation-vendor/katex/[...path]/+server.js` | copie de KaTeX du site, avec `Access-Control-Allow-Origin` |
| Export LaTeX | `src/lib/latex/export.js` | définit `\animation` : encadré avec la légende et l'adresse `https://openyourmath.org/animation/<nom>` |
| Contrôle | `pnpm check:animations` | page existante, nom valide, légende présente et sans formule |

## Isolation

Le HTML d'une animation est du JavaScript arbitraire. La page est servie dans un
bac à sable sans `allow-same-origin` : elle tourne dans une origine opaque, sans
accès aux cookies, au stockage ni à la page qui l'embarque (vérifié dans
Chromium). Elle ne peut que signaler sa hauteur à la page, par `postMessage`,
accepté uniquement de cette iframe. Le CSP interdit toute requête réseau autre
que le site lui-même.

Les pages sont incluses dans le paquet du serveur (`import.meta.glob`) : ajouter
ou modifier une animation demande de **reconstruire l'application**, pas
seulement le contenu.

## Produire une animation à partir d'un diaporama OPTRN

```bash
pnpm extract:animation --deck ../cours-OPTRN/slides/td1-s1-fonctions \
  --widget directionnelle --name ebva-directionnelle
```

Le script réunit la feuille de style du gabarit, `kit.js`, `widgets.js` et le
texte d'introduction de la figure en une page autonome, réduite pour tenir dans
son cadre. La page est générée : on la régénère plutôt que de la modifier.

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

- Les figures des diaporamas sont dessinées pour 1280×720 : dans une colonne
  étroite, elles sont réduites (environ 0,3 sur un téléphone en portrait) et
  peu lisibles. Le bouton « Plein écran » est le contournement ; une version
  adaptée aux petits écrans reste à concevoir.
- Rien n'est encore prévu pour `prefers-reduced-motion` : les figures actuelles
  réagissent aux curseurs et ne s'animent pas d'elles-mêmes.
- `content/animations/` n'est pas repris par `sync:exobase` : les pages vivent
  pour l'instant dans OpenYourMath seulement.
