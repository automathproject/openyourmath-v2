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
//   options : --limit N, --concurrence N, --par-minute N (Albert : 9), --sortie FICHIER

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { config as dotenvConfig } from 'dotenv';
import { collectReferentiel } from './build-referentiel-cpge.js';
import { loadCorrespondances, indexNodes, buildCandidates, formatCandidates, REGROUPEMENT_VERSION } from './utils/cpge-candidats.js';
import { PROJECT_ROOT } from './utils/content-paths.js';
import { chatMessages, withRetry } from '../src/lib/ia/albert.js';

const require = createRequire(import.meta.url);
dotenvConfig({ path: path.join(PROJECT_ROOT, '.env') });

const DB_PATH = path.join(PROJECT_ROOT, 'data/exercises.sqlite');
const TABLE_PATH = path.join(PROJECT_ROOT, 'content/referentials/cpge-correspondances.json');
const REPORT_DIR = path.join(PROJECT_ROOT, 'reports/cpge-pilote');

const args = process.argv.slice(2);
const option = name => args.find((_, i) => args[i - 1] === name);
const PILOTE = args.includes('--pilote');
const AFFICHER = args.includes('--afficher');
const UUID = option('--uuid');
const LIMIT = option('--limit') ? Number(option('--limit')) : Infinity;
const ALBERT_MODEL = option('--albert');
const OLLAMA_MODEL = process.env.OLLAMA_CHAT_MODEL || 'mistral-small3.2:24b';
const MODEL = ALBERT_MODEL ? `albert:${ALBERT_MODEL}` : `ollama:${OLLAMA_MODEL}`;
const CONCURRENCE = Number(option('--concurrence') ?? (ALBERT_MODEL ? 2 : 1));
// Albert accepte 10 requêtes par minute et par clé : on reste en dessous.
const PAR_MINUTE = Number(option('--par-minute') ?? (ALBERT_MODEL ? 9 : Infinity));
const SORTIE = option('--sortie') ??
  path.join(REPORT_DIR, `${MODEL.replace(/[^a-z0-9.-]+/gi, '_')}.v${REGROUPEMENT_VERSION}.jsonl`);

// Échantillon du pilote : tous les exercices crouzet, et dans exo7 L1 un tirage
// reproductible de PAR_CHAPITRE exercices par chapitre, réparti entre les
// sous-chapitres au prorata de leur taille.
const PILOTE_EXO7 = ['Nombres complexes', 'Suite', 'Polynôme, fraction rationnelle'];
const PAR_CHAPITRE = 70;

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
  if (!PILOTE) throw new Error('Préciser --pilote ou --uuid.');

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
    const budget = isAnswer ? 1200 - answers : 2500 - statement;
    if (budget <= 0) continue;
    const text = block.latex.replace(/\s+/g, ' ').trim().slice(0, budget);
    if (isAnswer) answers += text.length;
    else statement += text.length;
    parts.push(`${label} : ${text}`);
  }
  return parts.join('\n');
}

function list(value) {
  try {
    return JSON.parse(value ?? '[]').join(', ');
  } catch {
    return '';
  }
}

function buildPrompt(row, groups) {
  return `Exercice à situer dans les programmes de CPGE.

Titre : ${row.title}
Classement universitaire : ${row.level} / ${row.module} / ${row.chapter}${row.subchapter ? ` / ${row.subchapter}` : ''}
Résumé : ${row.summary ?? '(aucun)'}
Concepts : ${list(row.concepts)}
Méthodes : ${list(row.methods)}

${exerciseText(row)}

Sous-sections candidates, par famille de programmes (code, filières, section › sous-section, puis contenus du programme). \
Les familles découpent différemment les mêmes notions : un groupe vaut pour toutes les filières qu'il cite.
${formatCandidates(groups)}

Consignes :
- Choisis les sous-sections dont les notions sont l'objet de l'exercice ou indispensables pour le résoudre. N'en retiens pas une qui n'est qu'évoquée au passage.
- Examine chaque famille séparément : si la notion figure au programme de plusieurs familles, retiens-la dans chacune (par exemple un groupe de la 1re année MPSI, PCSI, PTSI et le chapitre correspondant de BCPST).
- Dans une famille, le plus souvent une ou deux sous-sections, jamais plus de trois.
- Si l'exercice demande des notions absentes de toutes les candidates (hors programme, ou relevant d'un autre chapitre), dis-le avec "hors_programme": true, et ne retiens que les candidates vraiment pertinentes, éventuellement aucune.
- "confiance" est entre 0 et 1 : 0.9 et plus si le rattachement est évident, 0.5 s'il est discutable.
- "justification" : une phrase courte.

Réponds par ce JSON, sans autre texte :
{"rattachements": [{"groupe": "G3", "confiance": 0.9, "justification": "…"}], "hors_programme": false, "remarque": ""}`;
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

async function callModel(messages) {
  await throttle();
  if (!ALBERT_MODEL) return callOllama(messages);
  return withRetry(() => chatMessages(messages, {
    model: ALBERT_MODEL,
    temperature: 0,
    maxTokens: 2000,
    jsonMode: true,
    timeoutMs: 180_000
  }), { maxAttempts: 4, delayMs: 20_000 });
}

function parseJson(text) {
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
function toPropositions(answer, groups) {
  const byCode = new Map(groups.map(group => [group.code, group]));
  const propositions = [];
  const rejets = [];
  for (const item of (answer.rattachements ?? []).slice(0, 10)) {
    // Certains modèles recopient toute la ligne du candidat : seul le code en tête compte.
    const code = String(item.groupe ?? '').trim().match(/^G\d+/)?.[0];
    const group = byCode.get(code);
    if (!group) {
      rejets.push(item.groupe);
      continue;
    }
    const confiance = Math.min(1, Math.max(0, Number(item.confiance) || 0));
    group.noeuds.forEach((noeud, i) => {
      propositions.push({
        noeud,
        origine: i === 0 ? 'llm' : 'concordance',
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
  const table = loadCorrespondances(TABLE_PATH);

  const db = openDb();
  const exercises = selectExercises(db);
  db.close();

  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  const done = AFFICHER ? new Set() : loadDone(SORTIE);
  const todo = exercises.filter(row => !done.has(row.uuid)).slice(0, LIMIT);
  console.log(`🎓 Étiquetage CPGE — ${MODEL}`);
  console.log(`   ${exercises.length} exercice(s) sélectionné(s), ${done.size} déjà traité(s), ${todo.length} à traiter`);
  console.log(`   Sortie : ${path.relative(PROJECT_ROOT, SORTIE)}`);

  let next = 0;
  let finished = 0;
  const started = Date.now();

  async function worker() {
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
        regroupement: REGROUPEMENT_VERSION,
        modele: MODEL,
        date: new Date().toISOString()
      };
      const t0 = Date.now();
      try {
        const noeuds = table.get(key);
        if (!noeuds) throw new Error(`chapitre absent de la table de correspondance : ${key}`);
        const groups = buildCandidates(noeuds, index);
        const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(row, groups) }];
        if (AFFICHER) console.log(`\n----- prompt -----\n${messages[1].content}`);
        const raw = await callModel(messages);
        if (AFFICHER) console.log(`\n----- réponse -----\n${raw}`);
        const answer = parseJson(raw);
        const { propositions, rejets } = toPropositions(answer, groups);
        Object.assign(entry, {
          candidats: groups.length,
          propositions,
          rejets,
          hors_programme: answer.hors_programme === true,
          remarque: String(answer.remarque ?? '').slice(0, 300)
        });
      } catch (error) {
        entry.erreur = error.message.slice(0, 300);
      }
      entry.duree_ms = Date.now() - t0;
      if (!AFFICHER) fs.appendFileSync(SORTIE, `${JSON.stringify(entry)}\n`);
      finished++;
      const choisis = entry.propositions?.filter(p => p.origine === 'llm').map(p => `${p.noeud} (${p.confiance})`).join(', ');
      const eta = ((Date.now() - started) / finished) * (todo.length - finished) / 60000;
      console.log(`[${finished}/${todo.length}] ${row.uuid} ${entry.erreur ? `✗ ${entry.erreur}` : choisis || '— aucun'}` +
        `${entry.hors_programme ? ' [hors programme]' : ''} · ${(entry.duree_ms / 1000).toFixed(1)} s · reste ≈ ${eta.toFixed(0)} min`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCE, todo.length) }, worker));
}

main().catch(error => {
  console.error('💥', error.message);
  process.exit(1);
});
