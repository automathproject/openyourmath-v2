#!/usr/bin/env node
// scripts/classify-cpge.js
//
// Étiquetage CPGE par LLM (phase 2, voir docs/classification-cpge.md).
// Pour chaque exercice, la table de correspondance chapitre → nœuds
// (content/referentials/cpge-correspondances.json) restreint les candidats ;
// le modèle choisit parmi eux les sous-sections du programme dont relève
// l'exercice, avec une confiance. Tout identifiant hors des candidats est
// rejeté.
//
// Le pilote n'écrit rien dans le contenu : les résultats vont dans
// reports/cpge-pilote/<modèle>.jsonl, un exercice par ligne, et une exécution
// interrompue reprend là où elle s'est arrêtée.
//
// Usage :
//   node scripts/classify-cpge.js --pilote                       # échantillon du pilote, Ollama
//   node scripts/classify-cpge.js --pilote --albert gpt-oss-120b # même échantillon, Albert
//   node scripts/classify-cpge.js --uuid cmlw --afficher         # un exercice, prompt et réponse
//   node scripts/classify-cpge.js --pilote-l2l3                  # extension L2-L3 (abstention)
//   node scripts/classify-cpge.js --pilote --estimer             # taille des prompts, sans appel
//   node scripts/classify-cpge.js --pilote --albert gpt-oss-120b --repli-local
//                                         # Albert, et Ollama quand Albert est saturé
//   node scripts/classify-cpge.js --pilote --albert gpt-oss-120b --alterner
//                                         # Albert et Ollama en parallèle, sur la même file
//   node scripts/classify-cpge.js --pilote --exporter DIR        # prompts par lots, pour un étiquetage hors script
//   node scripts/classify-cpge.js --pilote --reponses F.json --modele claude:claude-opus-5-5
//                                         # importe ces réponses (uuid → JSON) au lieu d'appeler un modèle
//   node scripts/classify-cpge.js --uuids a,b --preselection --exporter DIR
//                                         # tous les programmes, avec une présélection par exercice
//   options : --limit N, --concurrence N, --par-minute N (Albert : 9), --sortie FICHIER, --lot N

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { config as dotenvConfig } from 'dotenv';
import { collectReferentiel } from './build-referentiel-cpge.js';
import {
  loadCorrespondances, loadConcordance, indexNodes, buildCandidates, formatCandidates, formatSommaire, formatTexteOfficiel,
  horsProgramme, REGROUPEMENT_VERSION, FAMILLES
} from './utils/cpge-candidats.js';
import { PROJECT_ROOT } from './utils/content-paths.js';
import { chatMessages, withRetry, isQuotaExceeded } from '../src/lib/ia/albert.js';
import { ollamaEmbed } from '../src/lib/ia/ollama.js';
import { embeddingsGroupes, plusProches, vecteurBlob } from './utils/cpge-preselection.js';

const require = createRequire(import.meta.url);
dotenvConfig({ path: path.join(PROJECT_ROOT, '.env') });

const DB_PATH = path.join(PROJECT_ROOT, 'data/exercises.sqlite');
const TABLE_PATH = path.join(PROJECT_ROOT, 'content/referentials/cpge-correspondances.json');
const CONCORDANCE_PATH = path.join(PROJECT_ROOT, 'content/referentials/cpge/concordance.json');
const REPORT_DIR = path.join(PROJECT_ROOT, 'reports/cpge-pilote');

const args = process.argv.slice(2);
const option = name => args.find((_, i) => args[i - 1] === name);
const PILOTE = args.includes('--pilote');
const PILOTE_L2L3 = args.includes('--pilote-l2l3');
const AFFICHER = args.includes('--afficher');
const ESTIMER = args.includes('--estimer');
const UUID = option('--uuid');
// --uuids a,b,c : un jeu d'exercices choisis (cas difficiles d'une version précédente).
const UUIDS = option('--uuids')?.split(',').map(u => u.trim()).filter(Boolean);
const LIMIT = option('--limit') ? Number(option('--limit')) : Infinity;
const ALBERT_MODEL = option('--albert');
const OLLAMA_MODEL = process.env.OLLAMA_CHAT_MODEL || 'mistral-small3.2:24b';
// --exporter DIR : écrit les prompts par lots (un chapitre, au plus --lot
// exercices), pour un étiquetage hors script, par Opus dans une session
// Claude Code par exemple. --reponses FICHIER : importe ces réponses (objet
// uuid → réponse JSON) ; le traitement qui suit est celui des modèles appelés.
const EXPORTER = option('--exporter');
const LOT = Number(option('--lot') ?? 12);
const REPONSES_FILE = option('--reponses');
// --direct : pas de table de correspondance ; les candidats sont tous les
// programmes. Les lots donnent le sommaire, et le texte officiel complet est
// écrit à côté (texte-officiel.md), à relire pour chaque groupe retenu.
// --preselection : mode direct, plus une courte liste de départ par exercice,
// les candidats de la table (là où elle existe) et les groupes les plus proches
// du résumé de l'exercice par embeddings. Elle accélère sans borner : le
// modèle peut retenir tout groupe du sommaire. Une table vide n'exclut plus
// le chapitre ; elle signale une exclusion probable.
const PRESELECTION = args.includes('--preselection');
const PRESELECTION_K = Number(option('--preselection-k') ?? 15);
const DIRECT = args.includes('--direct') || PRESELECTION;
const CACHE_EMBEDDINGS = path.join(PROJECT_ROOT, 'cache/cpge/groupes-embeddings.json');
/** uuid → { groupes, raison } : présélection de chaque exercice. */
const PRESELECTIONS = new Map();
const MODEL = REPONSES_FILE ? (option('--modele') ?? 'externe')
  : ALBERT_MODEL ? `albert:${ALBERT_MODEL}` : `ollama:${OLLAMA_MODEL}`;
const CONCURRENCE = Number(option('--concurrence') ?? (ALBERT_MODEL ? 2 : 1));
// Albert accepte 10 requêtes par minute et par clé : on reste en dessous.
const PAR_MINUTE = Number(option('--par-minute') ?? (ALBERT_MODEL ? 9 : Infinity));
// Version du pilote (consignes, table de correspondance et regroupement) : un
// fichier de résultats par version, pour ne pas mélanger les passages.
const PILOTE_VERSION = 9;
const sortieDe = model => path.join(REPORT_DIR, `${model.replace(/[^a-z0-9.-]+/gi, '_')}.v${PILOTE_VERSION}.jsonl`);
const SORTIE = option('--sortie') ??
  (DIRECT ? sortieDe(MODEL).replace(/\.jsonl$/, PRESELECTION ? '.preselection.jsonl' : '.direct.jsonl') : sortieDe(MODEL));
// --repli-local : quand Albert est saturé (quota journalier, 429 ou 5xx
// persistants), l'exercice passe au modèle local, dont le résultat va dans son
// propre fichier. Un exercice traité par l'un ou l'autre n'est pas repris.
// --alterner : en plus, un worker local puise dans la même file qu'Albert,
// pour aller plus vite et économiser son quota (implique --repli-local).
const ALTERNER = Boolean(ALBERT_MODEL) && args.includes('--alterner');
const REPLI_LOCAL = ALTERNER || (Boolean(ALBERT_MODEL) && args.includes('--repli-local'));
const MODEL_LOCAL = `ollama:${OLLAMA_MODEL}`;
const SORTIE_LOCAL = sortieDe(MODEL_LOCAL);
// Albert est réessayé après ce délai : 30 min après un quota épuisé, 5 min sinon.
const PAUSE_QUOTA_MS = 30 * 60_000;
const PAUSE_SATURATION_MS = 5 * 60_000;

// Échantillon du pilote : tous les exercices crouzet, et dans exo7 L1 un tirage
// reproductible de PAR_CHAPITRE exercices par chapitre, réparti entre les
// sous-chapitres au prorata de leur taille.
const PILOTE_EXO7 = ['Nombres complexes', 'Suite', 'Polynôme, fraction rationnelle'];
const PAR_CHAPITRE = 70;

// Extension L2-L3 : des chapitres qui recoupent la 2e année, d'autres qui ne la
// recoupent qu'en partie, d'autres sans équivalent en CPGE. Elle mesure si la
// table écarte les derniers et si le modèle sait ne rien retenir.
const PILOTE_L2L3_CHAPITRES = [
  ['L2', "Réduction d'endomorphisme, polynôme annulateur"],
  ['L2', 'Série entière'],
  ['L2', 'Topologie'],
  ['L3', 'Espace topologique, espace métrique'],
  ['L3', 'Fonction holomorphe'],
  ['L3', 'Théorème de Sylow']
];
const PAR_CHAPITRE_L2L3 = 17;
// Extrait des contenus du programme par candidat : assez pour situer la
// sous-section, assez court pour tenir dans le contexte et le quota d'Albert.
// Pour un étiquetage hors script (--exporter, --reponses), les contenus sont
// complets : coupés, ils masquent 40 % du texte des programmes. --contenus N
// fixe la coupure.
const CONTENUS_MAX = Number(option('--contenus') ?? (EXPORTER || REPONSES_FILE ? Infinity : 260));

const SYSTEM = `Tu es professeur de mathématiques en classes préparatoires scientifiques. \
Tu situes des exercices dans les programmes officiels de mathématiques des CPGE. \
Tu réponds uniquement par un objet JSON valide.`;

function openDb() {
  const mod = require('better-sqlite3');
  const Database = mod.default || mod;
  return new Database(DB_PATH, { readonly: true });
}

const hash = value => crypto.createHash('sha1').update(value).digest('hex');

function selectExercises(db) {
  const columns = 'uuid, title, level, module, chapter, subchapter, summary, concepts, methods, content_json, content_hash, source_path';
  if (UUID) return db.prepare(`SELECT ${columns} FROM exercises WHERE uuid = ?`).all(UUID);
  if (UUIDS) return UUIDS.map(u => db.prepare(`SELECT ${columns} FROM exercises WHERE uuid = ?`).get(u)).filter(Boolean);
  if (PILOTE_L2L3) return sample(db, columns, PILOTE_L2L3_CHAPITRES, PAR_CHAPITRE_L2L3);
  if (!PILOTE) throw new Error('Préciser --pilote, --pilote-l2l3 ou --uuid.');

  const crouzet = db.prepare(`SELECT ${columns} FROM exercises WHERE source_path LIKE 'crouzet/%' ORDER BY source_path`).all();
  const exo7 = [];
  for (const chapter of PILOTE_EXO7) {
    const rows = db.prepare(`SELECT ${columns} FROM exercises WHERE organization = 'exo7' AND level = 'L1' AND chapter = ?`).all(chapter);
    const bySub = new Map();
    for (const row of rows) {
      const key = row.subchapter || '';
      if (!bySub.has(key)) bySub.set(key, []);
      bySub.get(key).push(row);
    }
    for (const group of bySub.values()) {
      group.sort((a, b) => hash(a.uuid).localeCompare(hash(b.uuid)));
      const quota = Math.max(1, Math.round((PAR_CHAPITRE * group.length) / rows.length));
      exo7.push(...group.slice(0, quota));
    }
  }
  return [...crouzet, ...exo7];
}

/** Tirage reproductible de `count` exercices exo7 par chapitre, au prorata des sous-chapitres. */
function sample(db, columns, chapters, count) {
  const out = [];
  for (const [level, chapter] of chapters) {
    const rows = db.prepare(`SELECT ${columns} FROM exercises WHERE organization = 'exo7' AND level = ? AND chapter = ?`).all(level, chapter);
    const bySub = new Map();
    for (const row of rows) {
      const key = row.subchapter || '';
      if (!bySub.has(key)) bySub.set(key, []);
      bySub.get(key).push(row);
    }
    const picked = [];
    for (const group of bySub.values()) {
      group.sort((a, b) => hash(a.uuid).localeCompare(hash(b.uuid)));
      picked.push(...group.slice(0, Math.max(1, Math.round((count * group.length) / rows.length))));
    }
    out.push(...picked.sort((a, b) => hash(a.uuid).localeCompare(hash(b.uuid))).slice(0, count));
  }
  return out;
}

function sourceOf(row) {
  return row.source_path.split('/')[0];
}

const BLOCK_LABELS = { text: 'Énoncé', question: 'Question', indication: 'Indication', reponse: 'Réponse' };

/** Énoncé en LaTeX : énoncé et questions d'abord, réponses tronquées plus court. */
function exerciseText(row) {
  let blocks = [];
  try {
    blocks = JSON.parse(row.content_json);
  } catch {
    return '';
  }
  const parts = [];
  let statement = 0;
  let answers = 0;
  for (const block of blocks) {
    if (!block.latex) continue;
    const label = BLOCK_LABELS[block.type] ?? 'Bloc';
    const isAnswer = block.type === 'reponse' || block.type === 'indication';
    const budget = isAnswer ? 800 - answers : 2000 - statement;
    if (budget <= 0) continue;
    const text = block.latex.replace(/\s+/g, ' ').trim().slice(0, budget);
    if (isAnswer) answers += text.length;
    else statement += text.length;
    parts.push(`${label} : ${text}`);
  }
  return parts.join('\n');
}

/** Vrai si l'exercice a un énoncé, commentaires LaTeX retirés. */
function hasStatement(row) {
  let blocks = [];
  try {
    blocks = JSON.parse(row.content_json);
  } catch {
    return false;
  }
  return blocks.some(block => (block.latex ?? '').replace(/(^|[^\\])%.*$/gm, '$1').trim());
}

function list(value) {
  try {
    return JSON.parse(value ?? '[]').join(', ');
  } catch {
    return '';
  }
}

/** Partie du prompt propre à l'exercice. */
function exercisePart(row) {
  return `Titre : ${row.title}
Classement universitaire : ${row.level} / ${row.module} / ${row.chapter}${row.subchapter ? ` / ${row.subchapter}` : ''}
Résumé : ${row.summary ?? '(aucun)'}
Concepts : ${list(row.concepts)}
Méthodes : ${list(row.methods)}

${exerciseText(row)}${preselectionPart(row)}`;
}

/** Présélection de l'exercice, en mode --preselection : point de départ, pas une limite. */
function preselectionPart(row) {
  const p = PRESELECTIONS.get(row.uuid);
  if (!p) return '';
  const raison = p.raison
    ? `\nLa table de correspondance ne propose aucun programme pour ce chapitre (${p.raison}) : l'exercice est probablement hors CPGE, à vérifier.`
    : '';
  return `\n\nPrésélection pour cet exercice (point de départ, pas une limite) :\n${formatSommaire(p.groupes)}${raison}`;
}

function buildPrompt(row, groups, index) {
  return `Exercice à situer dans les programmes de CPGE.\n\n${exercisePart(row)}\n\n${chapterPart(groups, index)}`;
}

/** Lot d'exercices d'un même chapitre : candidats et consignes donnés une fois. */
function formatLot(key, rows, groups, index) {
  if (DIRECT) return formatLotDirect(rows, groups);
  return `${SYSTEM}

Lot d'exercices du chapitre « ${key} ». Traite chaque exercice séparément, avec les candidats et les consignes \
donnés une seule fois à la fin du lot.

${rows.map(row => `# Exercice ${row.uuid}\n\n${exercisePart(row)}`).join('\n\n')}

# Candidats et consignes, communs aux exercices du lot

${chapterPart(groups, index)}

Pour ce lot, réponds par un seul objet JSON dont les clés sont les identifiants des exercices \
(${rows.map(row => row.uuid).join(', ')}) et les valeurs la réponse décrite ci-dessus pour chacun.
`;
}

/** Lot de l'étiquetage direct : sommaire de tous les programmes, consignes. */
function formatLotDirect(rows, groups) {
  const consignes = chapterPart(groups, null, { direct: true });
  return `${SYSTEM}

Lot d'exercices à situer dans les programmes de CPGE. Traite chaque exercice séparément, avec le sommaire et les consignes \
donnés une seule fois à la fin du lot.

${rows.map(row => `# Exercice ${row.uuid}\n\n${exercisePart(row)}`).join('\n\n')}

# Sommaire des programmes et consignes, communs aux exercices du lot

${consignes}

Pour ce lot, réponds par un seul objet JSON dont les clés sont les identifiants des exercices \
(${rows.map(row => row.uuid).join(', ')}) et les valeurs la réponse décrite ci-dessus pour chacun.
`;
}

/** Partie du prompt commune à un chapitre : candidats, exclusions, consignes. */
function chapterPart(groups, index, { direct = false } = {}) {
  const exclusions = direct ? [] : horsProgramme(groups, index);
  // En mode direct, le modèle voit le sommaire et relit le texte officiel.
  const contenus = direct ? 'le texte officiel' : 'les contenus affichés';
  // Familles affichées, dans l'ordre : le modèle répond pour chacune, sans quoi
  // il s'arrête à la première (BCPST négligée en v4 et v5).
  const familles = [...new Set(groups.map(group => group.famille))]
    .map(id => FAMILLES.find(f => f.id === id)?.libelle ?? id);
  const exemple = familles.map((famille, i) => ({
    famille,
    rattachements: i === 0 ? [{ groupe: 'G3', confiance: 0.9, justification: '…', filieres: ['MP/MPI'] }] : []
  }));
  const liste = direct
    ? `Sommaire de tous les programmes de mathématiques de CPGE, par famille (code, filières, section › sous-section). \
Les familles découpent différemment les mêmes notions : un groupe vaut pour toutes les filières qu'il cite. \
Le texte officiel complet de chaque groupe (contenus et commentaires, dont les mentions « hors programme ») est dans le fichier \
texte-officiel.md, sous le titre « ### G… » du groupe : ${PRESELECTION
    ? "pars des groupes présélectionnés pour l'exercice, et cherche dans le sommaire si l'exercice fait travailler une notion qu'ils ne couvrent pas ; relis le"
    : 'repère d’abord dans le sommaire les groupes plausibles, puis relis leur'} \
texte officiel avant de les retenir.
${formatSommaire(groups)}`
    : `Sous-sections candidates, par famille de programmes (code, filières, section › sous-section, puis contenus du programme). \
Les familles découpent différemment les mêmes notions : un groupe vaut pour toutes les filières qu'il cite.
${formatCandidates(groups, { maxChars: CONTENUS_MAX })}`;
  return `${liste}
${exclusions.length ? `\nPoints que ces programmes déclarent hors programme (chaque mention ne vaut que pour les filières indiquées : une notion exclue d'une filière peut être au programme d'une autre) :\n${exclusions.map(x => `- ${x}`).join('\n')}\n` : ''}
Question préalable : un élève de CPGE (1re ou 2e année, toutes filières) pourrait-il traiter cet exercice avec les seuls outils de son programme, tels que les ${direct ? 'décrit le texte officiel' : 'décrivent les contenus ci-dessus'} ?
- L'exercice relève de la CPGE s'il est au programme d'AU MOINS UNE filière : une notion exclue d'une filière (PC, PSI…) mais au programme d'une autre (MP…) ne suffit pas à répondre false.
${direct ? '' : "- Les candidats ne montrent qu'une partie des programmes : une notion absente des extraits affichés (dérivée, discriminant, coefficients binomiaux…) n'est pas pour autant hors programme.\n"}- Réponds "releve_cpge": false dès que l'exercice emploie ou demande un terme, une notion ou un résultat qui ne figure au programme d'aucune filière (par exemple : espace topologique ou métrique général, connexité autre que par arcs, fonction holomorphe, décomposition de Dunford, birapport, division suivant les puissances croissantes, enveloppe convexe, fonctions hyperboliques réciproques), même si le reste de l'exercice est au programme. Une seule question suffit.
- Un terme hors programme que l'énoncé définit lui-même à partir de notions du programme (« involutive », équipotence définie par les bijections…) n'exclut pas l'exercice ; employé sans définition, il l'exclut (différence symétrique Δ, par exemple).
- Un résultat hors programme que l'exercice établit sans le nommer, avec les outils du programme, n'exclut pas l'exercice.
- Un terme ancien ou une notation hors programme qui désigne une notion du programme (« projection de base F et de direction G », E* pour les formes linéaires) n'exclut pas l'exercice si celui-ci se rédige entièrement avec les notions du programme.
- Un terme hors programme présent seulement dans une remarque ou un aparté de la réponse (« magma », par exemple) exclut aussi l'exercice.
- Borne supérieure ou inférieure dans un ensemble ordonné autre que R, non définie par l'énoncé : exclut. Plus grand ou plus petit élément : n'exclut pas.
- Un énoncé qui ne précise pas la dimension se lit en dimension finie s'il y est traitable ; si la dimension infinie demande un résultat hors programme, signale-le dans "remarque".
- Une notion élémentaire de collège ou de lycée employée sans définition (polygone convexe, diagonale…) n'exclut pas l'exercice.
- Une méthode de résolution hors programme n'exclut pas l'exercice si une autre voie, au programme, permet de le traiter.
- Réponds true si tout ce que l'exercice emploie ou demande figure au programme d'au moins une filière, même s'il demande de l'initiative.
- Si la réponse est false, ne retiens aucune sous-section, et cite dans "motif" le terme ou la notion hors programme.

Consignes, si l'exercice relève de la CPGE :
- Choisis les sous-sections dont les notions sont l'objet de l'exercice ou indispensables pour le résoudre, c'est-à-dire ce que l'exercice fait réellement travailler.
- Ne retiens pas un simple prérequis : la définition d'une suite ou d'une limite, une fonction usuelle ou une formule de trigonométrie utilisées en passant, une notion qui ne sert qu'à exprimer le résultat.
- Examine chaque famille séparément, dans l'ordre : ${familles.join(' ; ')}. Pour chacune, demande-toi si l'exercice relève de son programme. Si la notion figure dans ${contenus} de cette famille, retiens le groupe correspondant, même si tu l'as déjà retenue dans une autre famille. Les programmes n'ont pas la même étendue : une famille peut ne couvrir qu'une partie de l'exercice, ou pas du tout.
- Ne retiens un groupe que si la notion figure bien dans ${contenus} de ce groupe : chaque famille a son propre programme, plus ou moins étendu (BCPST en particulier).
- Un groupe de 2e année ne se retient que si l'exercice dépasse le programme de 1re année.
- Dans une famille, le plus souvent une ou deux sous-sections, jamais plus de trois.
- Certains groupes indiquent des « écarts entre filières » : des notions au programme de certaines filières du groupe seulement. Pour un tel groupe, donne toujours "filieres" : les filières dont le programme contient tout ce que l'exercice utilise de ce groupe (par exemple ["MP/MPI"] s'il utilise une notion propre à MP/MPI, ou toutes les filières du groupe s'il n'utilise aucune des notions en écart). Pour un groupe sans écart, omets "filieres".
- Juge d'après l'énoncé et la réponse : le résumé, les concepts et les méthodes ont été produits automatiquement et peuvent être inexacts.
- Si l'énoncé est vide, n'est qu'un texte de remplissage, ou ne relève d'aucun ${direct ? 'groupe' : 'candidat'}, ne retiens rien.
- "confiance" est entre 0 et 1 : 0.9 et plus si le rattachement est évident, 0.5 s'il est discutable.
- "justification" : une phrase courte.

Réponds par ce JSON, sans autre texte, en commençant par la question préalable. "familles" contient une entrée par famille affichée, dans l'ordre, avec ses rattachements (liste vide si l'exercice ne relève pas de cette famille) :
${JSON.stringify({ releve_cpge: true, motif: 'une phrase', familles: exemple, remarque: '' })}`;
}

async function callOllama(messages) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/v1\/?$/, '');
  // API native : elle seule permet de fixer num_ctx. Au-delà de 8192, le modèle
  // 24B ne tient plus en mémoire sur la machine de développement.
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(600_000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: 0, num_ctx: 8192 }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Ollama : ${data.error}`);
  if (data.prompt_eval_count >= 8192) throw new Error(`prompt tronqué (${data.prompt_eval_count} jetons)`);
  return data.message.content;
}

let nextSlot = 0;
/** Espace les appels pour respecter PAR_MINUTE, tous workers confondus. */
async function throttle() {
  if (!Number.isFinite(PAR_MINUTE)) return;
  const interval = 60_000 / PAR_MINUTE;
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + interval;
  if (slot > now) await new Promise(resolve => setTimeout(resolve, slot - now));
}

let albertEnPauseJusqua = 0;
// Un seul appel local à la fois : le modèle 24B ne tient qu'une fois en mémoire.
let fileLocale = Promise.resolve();
function callLocal(messages) {
  const call = fileLocale.then(() => callOllama(messages));
  fileLocale = call.catch(() => {});
  return call;
}

/** Appelle le modèle ; renvoie la réponse brute et le modèle qui l'a produite. */
async function callModel(messages, { local = false } = {}) {
  if (!ALBERT_MODEL) return { raw: await callOllama(messages), model: MODEL };
  if (local) return { raw: await callLocal(messages), model: MODEL_LOCAL };
  if (REPLI_LOCAL && Date.now() < albertEnPauseJusqua) return { raw: await callLocal(messages), model: MODEL_LOCAL };
  await throttle();
  try {
    const raw = await withRetry(() => chatMessages(messages, {
      model: ALBERT_MODEL,
      temperature: 0,
      // gpt-oss compte son raisonnement dans ce plafond : à 2000, des réponses
      // longues arrivaient tronquées ou vides.
      maxTokens: 4000,
      jsonMode: true,
      timeoutMs: 180_000
    }), { maxAttempts: 4, delayMs: 20_000 });
    return { raw, model: MODEL };
  } catch (error) {
    const quota = isQuotaExceeded(error);
    if (!REPLI_LOCAL || !(quota || /429|50[0-9]|timeout|aborted/i.test(error.message))) throw error;
    const pause = quota ? PAUSE_QUOTA_MS : PAUSE_SATURATION_MS;
    if (Date.now() >= albertEnPauseJusqua) {
      console.log(`   ⇄ Albert ${quota ? 'a épuisé son quota' : 'est saturé'} : modèle local pendant ${pause / 60_000} min`);
    }
    albertEnPauseJusqua = Math.max(albertEnPauseJusqua, Date.now() + pause);
    return { raw: await callLocal(messages), model: MODEL_LOCAL };
  }
}

function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('réponse vide');
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error(`réponse non JSON : ${cleaned.slice(0, 120)}`);
  }
}

/**
 * Traduit la réponse du modèle en propositions par nœud. Le premier programme
 * d'un groupe reçoit l'origine « llm », les autres « concordance » : le
 * modèle n'a lu que les contenus du premier.
 */
const FILIERE_VERS_PROGRAMME = {
  MP: ['mp-mpi'], MPI: ['mp-mpi'], 'MP/MPI': ['mp-mpi'], PC: ['pc'], PSI: ['psi'], PT: ['pt'],
  MPSI: ['mpsi-mp2i'], MP2I: ['mpsi-mp2i'], 'MPSI/MP2I': ['mpsi-mp2i'], PCSI: ['pcsi'], PTSI: ['ptsi'],
  BCPST: ['bcpst1', 'bcpst2'], BCPST1: ['bcpst1'], BCPST2: ['bcpst2']
};
const normFiliere = f => String(f).toUpperCase().replace(/\s+/g, '');

function toPropositions(answer, groups) {
  const byCode = new Map(groups.map(group => [group.code, group]));
  const propositions = [];
  const rejets = [];
  // Réponse par famille (v6) ou liste unique (versions précédentes, modèles qui s'en écartent).
  const items = [
    ...(Array.isArray(answer.rattachements) ? answer.rattachements : []),
    ...(Array.isArray(answer.familles) ? answer.familles.flatMap(f => (Array.isArray(f?.rattachements) ? f.rattachements : [])) : [])
  ];
  for (const item of items.slice(0, 12)) {
    // Certains modèles recopient toute la ligne du candidat : seul le code en tête compte.
    const code = String(item.groupe ?? '').trim().match(/^G\d+/)?.[0];
    const group = byCode.get(code);
    if (!group) {
      rejets.push(item.groupe);
      continue;
    }
    const confiance = Math.min(1, Math.max(0, Number(item.confiance) || 0));
    // Filières retenues par le modèle pour ce groupe (toutes s'il n'en donne pas).
    const voulues = Array.isArray(item.filieres) && item.filieres.length
      ? new Set(item.filieres.flatMap(f => FILIERE_VERS_PROGRAMME[normFiliere(f)] ?? []))
      : null;
    const noeuds = voulues ? group.noeuds.filter(n => voulues.has(n.split('.')[0])) : group.noeuds;
    // Groupe à écarts sans filières précisées : la propagation est à vérifier,
    // l'exercice peut reposer sur une notion absente d'une des filières.
    const ecartsNonTranches = !voulues && group.ecarts?.length > 0;
    (noeuds.length ? noeuds : group.noeuds).forEach((noeud, i) => {
      propositions.push({
        noeud,
        origine: i === 0 ? 'llm' : 'concordance',
        ...(ecartsNonTranches && i > 0 ? { a_verifier: 'ecarts' } : {}),
        confiance,
        groupe: group.code,
        justification: String(item.justification ?? '').slice(0, 300)
      });
    });
  }
  return { propositions, rejets };
}

function loadDone(file) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
    .map(line => JSON.parse(line)).filter(entry => !entry.erreur).map(entry => entry.uuid));
}

async function main() {
  const referentiel = collectReferentiel();
  if (referentiel.errors.length) throw new Error(`référentiel invalide : ${referentiel.errors[0]}`);
  const index = indexNodes(referentiel.nodes);
  const racines = referentiel.nodes.filter(node => !node.parent_id).map(node => node.id);
  const table = DIRECT ? { get: () => racines } : loadCorrespondances(TABLE_PATH);
  const concordance = loadConcordance(CONCORDANCE_PATH);

  const db = openDb();
  const exercises = selectExercises(db);
  const vecteurs = PRESELECTION
    ? new Map(exercises.map(row => [row.uuid, db.prepare('SELECT embedding_summary FROM exercise_embeddings WHERE uuid = ?').get(row.uuid)])
      .filter(([, r]) => r).map(([uuid, r]) => [uuid, vecteurBlob(r.embedding_summary)]))
    : null;
  db.close();
  if (PRESELECTION) {
    const groups = buildCandidates(racines, index, { concordance });
    const vecs = await embeddingsGroupes(groups, index, { embed: ollamaEmbed, cacheFile: CACHE_EMBEDDINGS });
    const correspondances = loadCorrespondances(TABLE_PATH);
    const raisons = new Map(JSON.parse(fs.readFileSync(TABLE_PATH, 'utf8')).correspondances
      .map(c => [`${c.source}|${c.chapitre}`, c.raison]));
    for (const row of exercises) {
      const key = `${sourceOf(row)}|${row.chapter}`;
      const noeuds = correspondances.get(key) ?? [];
      const deTable = groups.filter(g => g.noeuds.some(n => noeuds.some(a => n === a || n.startsWith(`${a}.`))));
      const proches = vecteurs.has(row.uuid) ? plusProches(vecteurs.get(row.uuid), groups, vecs, PRESELECTION_K) : [];
      const choisis = new Set([...deTable, ...proches]);
      PRESELECTIONS.set(row.uuid, {
        groupes: groups.filter(g => choisis.has(g)),
        raison: correspondances.has(key) && !noeuds.length ? raisons.get(key) ?? 'sans équivalent' : null
      });
    }
  }
  const reponses = REPONSES_FILE ? JSON.parse(fs.readFileSync(REPONSES_FILE, 'utf8')) : null;
  // Exercice qui demande un modèle : chapitre avec des candidats, énoncé non vide.
  const besoinModele = row => {
    const noeuds = table.get(`${sourceOf(row)}|${row.chapter}`);
    return Boolean(noeuds && buildCandidates(noeuds, index, { concordance }).length && hasStatement(row));
  };

  if (ESTIMER) {
    const sizes = exercises.filter(row => table.get(`${sourceOf(row)}|${row.chapter}`)?.length).map(row => {
      const groups = buildCandidates(table.get(`${sourceOf(row)}|${row.chapter}`), index, { concordance });
      return Math.round((SYSTEM.length + buildPrompt(row, groups, index).length) / 3.2);
    }).sort((a, b) => a - b);
    const total = sizes.reduce((s, x) => s + x, 0);
    console.log(`${sizes.length} prompts · ≈ ${total} jetons d'entrée en tout · moyenne ${Math.round(total / sizes.length)} · ` +
      `médiane ${sizes[sizes.length >> 1]} · max ${sizes.at(-1)}`);
    return;
  }

  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  const done = AFFICHER ? new Set() : loadDone(SORTIE);
  if (REPLI_LOCAL) for (const uuid of loadDone(SORTIE_LOCAL)) done.add(uuid);
  const todo = exercises.filter(row => !done.has(row.uuid))
    // Import : seulement les exercices qui ont une réponse, et ceux que le script traite seul.
    .filter(row => !reponses || reponses[row.uuid] !== undefined || !besoinModele(row))
    .slice(0, LIMIT);

  if (EXPORTER) {
    fs.mkdirSync(EXPORTER, { recursive: true });
    const parChapitre = new Map();
    for (const row of todo.filter(besoinModele)) {
      // Mode direct : mêmes candidats pour tous, les lots ne suivent pas les chapitres.
      const key = DIRECT ? 'direct' : `${sourceOf(row)}|${row.chapter}`;
      (parChapitre.get(key) ?? parChapitre.set(key, []).get(key)).push(row);
    }
    let n = 0;
    for (const [key, rows] of parChapitre) {
      const groups = buildCandidates(DIRECT ? racines : table.get(key), index, { concordance });
      for (let i = 0; i < rows.length; i += LOT) {
        const nom = `lot-${String(++n).padStart(3, '0')}.md`;
        fs.writeFileSync(path.join(EXPORTER, nom), formatLot(key, rows.slice(i, i + LOT), groups, index));
      }
    }
    if (DIRECT) {
      const groups = buildCandidates(racines, index, { concordance });
      fs.writeFileSync(path.join(EXPORTER, 'texte-officiel.md'), `${formatTexteOfficiel(groups, index)}\n`);
    }
    console.log(`${n} lot(s), ${[...parChapitre.values()].flat().length} exercice(s), écrits dans ${EXPORTER}`);
    return;
  }
  console.log(`🎓 Étiquetage CPGE — ${MODEL}`);
  console.log(`   ${exercises.length} exercice(s) sélectionné(s), ${done.size} déjà traité(s), ${todo.length} à traiter`);
  console.log(`   Sortie : ${path.relative(PROJECT_ROOT, SORTIE)}`);
  if (REPLI_LOCAL) console.log(`   Repli : ${MODEL_LOCAL} → ${path.relative(PROJECT_ROOT, SORTIE_LOCAL)}`);

  let next = 0;
  let finished = 0;
  const started = Date.now();

  async function worker(local = false) {
    while (next < todo.length) {
      const row = todo[next++];
      const key = `${sourceOf(row)}|${row.chapter}`;
      const entry = {
        uuid: row.uuid,
        source: sourceOf(row),
        niveau: row.level,
        chapitre: row.chapter,
        sous_chapitre: row.subchapter,
        titre: row.title,
        content_hash: row.content_hash,
        pilote: PILOTE_VERSION,
        contenus: Number.isFinite(CONTENUS_MAX) ? CONTENUS_MAX : 'complets',
        candidats_par: PRESELECTION ? 'programmes complets, avec présélection' : DIRECT ? 'programmes complets' : 'table de correspondance',
        ...(PRESELECTION ? { preselection: PRESELECTIONS.get(row.uuid)?.groupes.map(g => g.noeuds[0]) ?? [] } : {}),
        regroupement: REGROUPEMENT_VERSION,
        modele: MODEL,
        date: new Date().toISOString()
      };
      const t0 = Date.now();
      try {
        const noeuds = table.get(key);
        if (!noeuds) throw new Error(`chapitre absent de la table de correspondance : ${key}`);
        const groups = buildCandidates(noeuds, index, { concordance });
        if (!groups.length) {
          // Chapitre sans équivalent en CPGE : la table l'écarte, sans appel au modèle.
          Object.assign(entry, {
            candidats: 0, propositions: [], rejets: [], hors_programme: true,
            remarque: 'chapitre sans équivalent en CPGE', exclu_par_table: true
          });
          entry.duree_ms = 0;
          if (!AFFICHER) fs.appendFileSync(SORTIE, `${JSON.stringify(entry)}\n`);
          finished++;
          console.log(`[${finished}/${todo.length}] ${row.uuid} — chapitre sans équivalent en CPGE, aucun appel`);
          continue;
        }
        if (!hasStatement(row)) {
          // Énoncé vide (brouillon, TODO) : le modèle ne s'appuierait que sur le
          // chapitre et sur un résumé sans fondement.
          Object.assign(entry, { candidats: groups.length, propositions: [], rejets: [], hors_programme: false, remarque: 'énoncé vide' });
          entry.duree_ms = 0;
          if (!AFFICHER) fs.appendFileSync(SORTIE, `${JSON.stringify(entry)}\n`);
          finished++;
          console.log(`[${finished}/${todo.length}] ${row.uuid} — énoncé vide, aucun appel`);
          continue;
        }
        const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(row, groups, index) }];
        if (AFFICHER) console.log(`\n----- prompt -----\n${messages[1].content}`);
        const { raw, model } = reponses
          ? { raw: JSON.stringify(reponses[row.uuid]), model: MODEL }
          : await callModel(messages, { local });
        entry.modele = model;
        if (AFFICHER) console.log(`\n----- réponse -----\n${raw}`);
        const answer = parseJson(raw);
        // Exercice jugé hors CPGE : aucun rattachement, quoi que le modèle liste ensuite.
        const releve = answer.releve_cpge !== false;
        const { propositions, rejets } = releve ? toPropositions(answer, groups) : { propositions: [], rejets: [] };
        Object.assign(entry, {
          candidats: groups.length,
          releve_cpge: releve,
          motif: String(answer.motif ?? '').slice(0, 300),
          propositions,
          rejets,
          hors_programme: !releve || answer.hors_programme === true,
          remarque: String(answer.remarque ?? '').slice(0, 300)
        });
      } catch (error) {
        entry.erreur = error.message.slice(0, 300);
      }
      entry.duree_ms = Date.now() - t0;
      if (!AFFICHER) fs.appendFileSync(entry.modele === MODEL_LOCAL && REPLI_LOCAL ? SORTIE_LOCAL : SORTIE, `${JSON.stringify(entry)}\n`);
      finished++;
      const choisis = entry.propositions?.filter(p => p.origine === 'llm').map(p => `${p.noeud} (${p.confiance})`).join(', ');
      const eta = ((Date.now() - started) / finished) * (todo.length - finished) / 60000;
      console.log(`[${finished}/${todo.length}] ${row.uuid} ${entry.erreur ? `✗ ${entry.erreur}` : choisis || '— aucun'}` +
        `${entry.hors_programme ? ' [hors programme]' : ''}${REPLI_LOCAL && entry.modele === MODEL_LOCAL ? ' [local]' : ''} · ${(entry.duree_ms / 1000).toFixed(1)} s · reste ≈ ${eta.toFixed(0)} min`);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCE, todo.length) }, () => worker());
  if (ALTERNER) workers.push(worker(true));
  await Promise.all(workers);
}

main().catch(error => {
  console.error('💥', error.message);
  process.exit(1);
});
