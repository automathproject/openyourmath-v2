# Signalement d'erreur

La page d'exercice et « Ma liste » (hors vues élève, puisque le lien demande
un compte) proposent sous l'exercice un lien discret « Signaler une erreur ».
Le formulaire guide la personne en trois étapes :

1. **Problème** : erreur dans l'énoncé, dans la correction, coquille,
   affichage, classement, rattachement CPGE, doublon ou autre
   (`src/lib/signalement/types.js`).
2. **Précisions** demandées par ce type : partie de l'exercice (Question n,
   Réponse n…), passage écrit et passage attendu, classement proposé,
   rattachements CPGE à retirer, identifiant du doublon ; puis le message.
3. **Envoi**, après connexion avec un compte de la forge ou de GitHub.

## Où arrivent les tickets

| Connexion | Dépôt des tickets |
| --- | --- |
| Forge des communs numériques éducatifs (personnels de l'Éducation nationale) | [automath/exobase](https://forge.apps.education.fr/automath/exobase) |
| GitHub | [automathproject/exobase](https://github.com/automathproject/exobase) |

Les deux dépôts portent les mêmes sources (exobase est poussé sur les deux) ;
seules les files de tickets sont distinctes.

La connexion ne lit que le profil (portée `read_user` sur la forge, aucune
portée sur GitHub) ; le jeton du fournisseur sert une fois puis est oublié.
Le ticket est créé par un jeton propre au dépôt, qui ne peut rien d'autre, et
signé de l'identifiant de la personne. L'identité vérifiée est gardée 30 jours
dans un cookie signé `httpOnly` (`oym_signalement`).

Le ticket contient le lien vers l'exercice et vers sa source `.tex`, le
classement actuel, le type, la partie concernée et les précisions, avec les
étiquettes `signalement` et le type. Le texte saisi est cité après
neutralisation (pas de mention `@`, de renvoi `#12`, d'image distante ni de
HTML).

Garde-fous : `state` et PKCE pour la connexion, 10 signalements par heure et
par compte, 30 par heure et par adresse, champ piège pour les robots.

## Configuration

Variables du `.env` (transmises au conteneur par `docker-compose.yml`). Un
fournisseur n'est proposé que si ses trois variables sont présentes ; sans
aucun fournisseur, l'encart n'apparaît pas.

| Variable | Rôle |
| --- | --- |
| `SIGNALEMENT_SESSION_SECRET` | Signature des cookies (`openssl rand -hex 32`, propre à chaque machine) |
| `FORGE_OAUTH_CLIENT_ID`, `FORGE_OAUTH_CLIENT_SECRET` | Application OAuth du groupe automath sur la forge, portée `read_user` |
| `SIGNALEMENT_FORGE_TOKEN` | Jeton d'accès du projet automath/exobase, rôle Planner, portée `api` |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | OAuth App GitHub, sans portée |
| `SIGNALEMENT_GITHUB_TOKEN` | Jeton fin limité à automathproject/exobase, Issues en lecture et écriture |

Facultatives : `FORGE_URL`, `SIGNALEMENT_FORGE_PROJET`,
`SIGNALEMENT_GITHUB_DEPOT`.

Adresses de retour à déclarer dans les applications OAuth :
`https://openyourmath.org/signalement/retour/forge` et
`https://openyourmath.org/signalement/retour/github` (plus
`http://localhost:5188/…` pour le développement).

Pour écrire un secret dans le `.env` sans qu'il apparaisse à l'écran ni dans
l'historique du shell :

```bash
sed -i '/^NOM_VARIABLE=/d' .env; read -rs -p "Valeur : " V; echo; printf 'NOM_VARIABLE=%s\n' "$V" >> .env; unset V; chmod 600 .env
```

Le jeton du projet forge expire le 2027-10-23 : le renouveler avant cette date
(Paramètres › Jetons d'accès du projet).
