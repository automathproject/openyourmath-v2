// src/lib/server/classe/sessions.js
// Sessions de qcm en direct : un enseignant projette les questions, la classe
// répond depuis ses téléphones, sans compte.
//
// Tout l'état vit en mémoire dans le processus Node : une session est
// éphémère, et l'application tourne en une seule instance. Rien n'est écrit en
// base ni sur disque ; un redémarrage du serveur termine les sessions en cours.
//
// Le serveur de déploiement est petit : chaque dimension est bornée (sessions
// simultanées, participants par session, connexions ouvertes, durée de vie),
// et les bornes se règlent par variables d'environnement (voir limits()).

import crypto from 'node:crypto';
import { correctIndexes, isCorrectSelection, isSingleChoice, normalizeSelection } from '../../qcm/blocks.js';

/** Alphabet des codes de session : sans 0/O, 1/I/L, faciles à dicter et à recopier. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const NAME_MAX_LENGTH = 24;
const HEARTBEAT_MS = 25_000;
const SWEEP_MS = 60_000;
/** Délai minimal entre deux envois de statistiques à l'enseignant. */
const STATS_THROTTLE_MS = 700;

function envInt(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Bornes de charge, relues à chaque appel pour suivre l'environnement. */
export function limits() {
  return {
    /** Participants par session. */
    maxParticipants: envInt('CLASSE_MAX_PARTICIPANTS', 60, 1, 500),
    /** Sessions ouvertes en même temps. */
    maxSessions: envInt('CLASSE_MAX_SESSIONS', 8, 1, 200),
    /** Connexions temps réel ouvertes, toutes sessions confondues. */
    maxConnections: envInt('CLASSE_MAX_CONNEXIONS', 300, 1, 5000),
    /** Questions par session. */
    maxQuestions: envInt('CLASSE_MAX_QUESTIONS', 40, 1, 200),
    /** Durée de vie d'une session, en minutes. */
    maxMinutes: envInt('CLASSE_DUREE_MAX_MIN', 180, 5, 720),
    /** Fermeture d'une session sans activité, en minutes. */
    idleMinutes: envInt('CLASSE_INACTIVITE_MIN', 45, 1, 720),
  };
}

export class ClasseError extends Error {
  /**
   * @param {number} status code HTTP
   * @param {string} code   identifiant stable pour l'interface
   * @param {string} message message lisible
   */
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * État global, accroché à globalThis pour survivre aux rechargements à chaud
 * du serveur de développement.
 * @type {{ sessions: Map<string, any>, connections: number, timers: boolean }}
 */
const store = (globalThis.__oymClasse ??= { sessions: new Map(), connections: 0, timers: false });

function token() {
  return crypto.randomBytes(24).toString('base64url');
}

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function newCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    let code = '';
    for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    if (!store.sessions.has(code)) return code;
  }
  throw new ClasseError(503, 'code', 'Impossible de créer un code de session.');
}

/** Met un code saisi à la main sous sa forme canonique. */
export function normalizeCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

function cleanName(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
}

// ── Diffusion (Server-Sent Events) ─────────────────────────────────────────

function send(stream, event, data) {
  try {
    stream.controller.enqueue(stream.encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  } catch {
    dropStream(stream);
  }
}

function dropStream(stream) {
  if (stream.closed) return;
  stream.closed = true;
  store.connections = Math.max(0, store.connections - 1);
  stream.session.streams.delete(stream);
  try {
    stream.controller.close();
  } catch {
    // déjà fermé par le client
  }
  if (stream.role === 'participant') scheduleStats(stream.session);
}

function ensureTimers() {
  if (store.timers) return;
  store.timers = true;
  const heartbeat = setInterval(() => {
    for (const session of store.sessions.values()) {
      for (const stream of [...session.streams]) {
        try {
          stream.controller.enqueue(stream.encoder.encode(': ping\n\n'));
        } catch {
          dropStream(stream);
        }
      }
    }
  }, HEARTBEAT_MS);
  const sweep = setInterval(sweepSessions, SWEEP_MS);
  heartbeat.unref?.();
  sweep.unref?.();
}

/** Ferme les sessions trop vieilles ou restées sans activité. */
export function sweepSessions(now = Date.now()) {
  const { maxMinutes, idleMinutes } = limits();
  for (const session of [...store.sessions.values()]) {
    const tooOld = now - session.createdAt > maxMinutes * 60_000;
    const idle = now - session.lastActivity > idleMinutes * 60_000;
    if (tooOld || idle) closeSession(session, tooOld ? 'duree' : 'inactivite');
  }
}

function closeSession(session, reason) {
  session.phase = 'ended';
  for (const stream of [...session.streams]) {
    // Chaque participant repart avec la revue des questions corrigées : la page
    // la garde affichée une fois la connexion fermée.
    const participant = stream.role === 'participant' ? session.participants.get(stream.participantId) : null;
    send(stream, 'fin', participant ? { reason, ...participantRecap(session, participant) } : { reason });
    dropStream(stream);
  }
  if (session.statsTimer) clearTimeout(session.statsTimer);
  store.sessions.delete(session.code);
}

// ── Vues de l'état ──────────────────────────────────────────────────────────

function publicQuestion(question) {
  return {
    rank: question.rank,
    of: question.of,
    title: question.title,
    context_html: question.context_html,
    stem_html: question.stem_html,
    single: isSingleChoice(question),
    type: question.type,
    choices: question.choices.map((choice) => ({ html: choice.html })),
  };
}

function connectedParticipants(session) {
  const ids = new Set();
  for (const stream of session.streams) if (stream.role === 'participant') ids.add(stream.participantId);
  return ids;
}

function questionStats(session, index) {
  const question = session.questions[index];
  if (!question) return null;
  const counts = question.choices.map(() => 0);
  let answered = 0;
  let correct = 0;
  for (const participant of session.participants.values()) {
    const selection = participant.answers.get(index);
    if (!selection) continue;
    answered++;
    for (const choice of selection) counts[choice]++;
    if (isCorrectSelection(question.choices, selection)) correct++;
  }
  return { answered, correct, counts };
}

function scoreOf(session, participant) {
  let correct = 0;
  for (const [index, selection] of participant.answers) {
    if (session.revealed.has(index) && isCorrectSelection(session.questions[index].choices, selection)) correct++;
  }
  return correct;
}

function baseState(session) {
  return {
    code: session.code,
    title: session.title,
    phase: session.phase,
    index: session.index,
    total: session.questions.length,
    participants: session.participants.size,
    maxParticipants: session.maxParticipants,
    corrected: session.revealed.size,
  };
}

function correction(session, index) {
  const question = session.questions[index];
  return { correct: correctIndexes(question.choices), explanation_html: question.explanation_html };
}

/**
 * Revue personnelle d'un participant : les questions corrigées, avec sa
 * réponse, les réponses justes et les explications. Jamais une question que
 * la classe n'a pas vue corrigée.
 */
function participantRecap(session, participant) {
  const review = [];
  session.questions.forEach((question, index) => {
    if (!session.revealed.has(index)) return;
    const answer = participant.answers.get(index) ?? null;
    review.push({
      index,
      title: question.title,
      rank: question.rank,
      of: question.of,
      context_html: question.context_html,
      stem_html: question.stem_html,
      choices: question.choices.map((choice) => ({
        html: choice.html,
        correct: Boolean(choice.correct),
        ...(choice.feedback_html && { feedback_html: choice.feedback_html }),
      })),
      explanation_html: question.explanation_html,
      answer,
      ok: answer !== null && isCorrectSelection(question.choices, answer),
    });
  });
  return {
    review,
    me: { name: participant.name, score: scoreOf(session, participant), answered: participant.answers.size },
  };
}

/** Ce qu'un participant a le droit de voir : jamais les réponses justes avant la correction. */
function participantState(session, participant) {
  const state = baseState(session);
  if (session.phase === 'review') return { ...state, ...participantRecap(session, participant) };
  const question = session.questions[session.index];
  if (question && session.phase !== 'lobby' && session.phase !== 'ended') {
    state.question = publicQuestion(question);
    state.answer = participant.answers.get(session.index) ?? null;
    if (session.phase === 'revealed') state.correction = correction(session, session.index);
  }
  state.me = { name: participant.name, score: scoreOf(session, participant), answered: participant.answers.size };
  return state;
}

function hostState(session) {
  const state = baseState(session);
  const connected = connectedParticipants(session);
  const reviewing = session.phase === 'review';
  // Pendant le bilan, la question affichée est celle que l'on revoit, pas celle du déroulé.
  const focus = reviewing ? session.reviewIndex : session.index;
  const question = focus === null ? null : session.questions[focus];
  if (question) {
    state.question = publicQuestion(question);
    state.correction = correction(session, focus);
    state.stats = questionStats(session, focus);
  }
  state.reviewIndex = reviewing ? session.reviewIndex : null;
  state.asked = session.asked.size;
  state.connected = connected.size;
  state.outline = session.questions.map((item, index) => {
    const entry = { title: item.title, rank: item.rank, of: item.of, done: session.revealed.has(index), asked: session.asked.has(index) };
    if (reviewing) {
      const { answered, correct } = questionStats(session, index);
      Object.assign(entry, { answered, correct });
    }
    return entry;
  });
  state.roster = [...session.participants.values()].map((participant) => ({
    name: participant.name,
    score: scoreOf(session, participant),
    answered: participant.answers.size,
    online: connected.has(participant.id),
  }));
  return state;
}

function stateFor(session, stream) {
  if (stream.role === 'host') return hostState(session);
  const participant = session.participants.get(stream.participantId);
  return participant ? participantState(session, participant) : baseState(session);
}

function broadcast(session) {
  for (const stream of [...session.streams]) send(stream, 'etat', stateFor(session, stream));
}

function broadcastHost(session) {
  const state = hostState(session);
  for (const stream of [...session.streams]) if (stream.role === 'host') send(stream, 'etat', state);
}

/** Regroupe les mises à jour destinées à l'enseignant : une réponse par élève ne vaut pas un envoi. */
function scheduleStats(session) {
  if (session.statsTimer || session.phase === 'ended') return;
  session.statsTimer = setTimeout(() => {
    session.statsTimer = null;
    if (store.sessions.has(session.code)) broadcastHost(session);
  }, STATS_THROTTLE_MS);
  session.statsTimer.unref?.();
}

// ── API ─────────────────────────────────────────────────────────────────────

/** Occupation courante, pour la page d'accueil et la supervision. */
export function occupancy() {
  let participants = 0;
  for (const session of store.sessions.values()) participants += session.participants.size;
  return { sessions: store.sessions.size, participants, connections: store.connections, limits: limits() };
}

/**
 * Ouvre une session.
 * @param {{ title?: string, questions: Array<object> }} input questions issues de qcmQuestionsOf()
 * @returns {{ code: string, hostToken: string }}
 */
export function createSession({ title = '', questions }) {
  sweepSessions();
  const bounds = limits();
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ClasseError(400, 'vide', 'Cette liste ne contient aucune question de QCM.');
  }
  if (questions.length > bounds.maxQuestions) {
    throw new ClasseError(400, 'trop-de-questions', `Une session est limitée à ${bounds.maxQuestions} questions (${questions.length} demandées).`);
  }
  if (store.sessions.size >= bounds.maxSessions) {
    throw new ClasseError(503, 'complet', 'Trop de sessions sont ouvertes en ce moment. Réessayez dans quelques minutes.');
  }

  const session = {
    code: newCode(),
    hostToken: token(),
    title: cleanName(title).slice(0, 80) || 'QCM en direct',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    maxParticipants: bounds.maxParticipants,
    questions,
    index: -1,
    /** 'lobby' → 'open' → 'closed' → 'revealed' → … → 'review' (bilan) → 'ended' */
    phase: 'lobby',
    /** Questions ouvertes au moins une fois : celles que la classe a vues. */
    asked: new Set(),
    revealed: new Set(),
    /** Pendant le bilan : question revue (null : vue d'ensemble). */
    reviewIndex: null,
    participants: new Map(),
    streams: new Set(),
    statsTimer: null,
  };
  store.sessions.set(session.code, session);
  ensureTimers();
  return { code: session.code, hostToken: session.hostToken };
}

export function getSession(code) {
  const session = store.sessions.get(normalizeCode(code));
  if (!session) throw new ClasseError(404, 'introuvable', 'Session introuvable ou terminée.');
  return session;
}

/** Renseignements visibles avant d'entrer. */
export function sessionSummary(code) {
  return baseState(getSession(code));
}

export function isHost(session, hostToken) {
  return sameToken(session.hostToken, hostToken);
}

export function findParticipant(session, participantToken) {
  if (typeof participantToken !== 'string' || !participantToken) return null;
  for (const participant of session.participants.values()) {
    if (sameToken(participant.token, participantToken)) return participant;
  }
  return null;
}

/**
 * Fait entrer un participant.
 * @returns {{ token: string, name: string }}
 */
export function joinSession(code, rawName) {
  const session = getSession(code);
  if (session.phase === 'ended') throw new ClasseError(410, 'terminee', 'Cette session est terminée.');
  if (session.participants.size >= session.maxParticipants) {
    throw new ClasseError(403, 'complet', `Cette session est complète (${session.maxParticipants} participants).`);
  }
  let name = cleanName(rawName) || `Participant ${session.participants.size + 1}`;
  const taken = new Set([...session.participants.values()].map((participant) => participant.name.toLowerCase()));
  if (taken.has(name.toLowerCase())) {
    let suffix = 2;
    while (taken.has(`${name} (${suffix})`.toLowerCase())) suffix++;
    name = `${name} (${suffix})`;
  }
  const participant = { id: crypto.randomUUID(), token: token(), name, joinedAt: Date.now(), answers: new Map() };
  session.participants.set(participant.id, participant);
  session.lastActivity = Date.now();
  scheduleStats(session);
  return { token: participant.token, name: participant.name };
}

/** Enregistre ou remplace la réponse d'un participant à la question en cours. */
export function submitAnswer(code, participantToken, questionIndex, selection) {
  const session = getSession(code);
  const participant = findParticipant(session, participantToken);
  if (!participant) throw new ClasseError(401, 'inconnu', "Vous n'êtes pas inscrit à cette session.");
  if (session.phase !== 'open' || questionIndex !== session.index) {
    throw new ClasseError(409, 'ferme', 'Les réponses à cette question sont closes.');
  }
  const question = session.questions[session.index];
  let cleaned = normalizeSelection(selection, question.choices.length);
  if (isSingleChoice(question)) cleaned = cleaned.slice(0, 1);
  participant.answers.set(session.index, cleaned);
  session.lastActivity = Date.now();
  scheduleStats(session);
  return { answer: cleaned };
}

/**
 * Commande de l'enseignant.
 * - open   : ouvre (ou rouvre) les réponses à la question en cours ; depuis l'accueil, lance la première
 * - close  : clôt les réponses, la répartition devient visible
 * - reveal : montre la correction à tous
 * - next / prev / goto : change de question, réponses ouvertes ; depuis le bilan, reprend le déroulé
 * - review : bilan ; corrige toutes les questions posées, puis revoit la question `index`
 *            (sans index : vue d'ensemble). La session reste ouverte.
 * - end    : termine la session ; chaque participant garde sa revue
 */
export function control(code, hostToken, action, index) {
  const session = getSession(code);
  if (!isHost(session, hostToken)) throw new ClasseError(403, 'interdit', 'Réservé à la personne qui anime la session.');
  session.lastActivity = Date.now();
  const last = session.questions.length - 1;
  const wasReviewing = session.phase === 'review';
  const goTo = (target) => {
    session.index = Math.min(last, Math.max(0, target));
    session.phase = session.revealed.has(session.index) ? 'revealed' : 'open';
    session.asked.add(session.index);
  };

  switch (action) {
    case 'open':
      if (session.index < 0) goTo(0);
      else session.phase = 'open';
      session.asked.add(session.index);
      session.revealed.delete(session.index);
      break;
    case 'close':
      if (session.phase === 'open') session.phase = 'closed';
      break;
    case 'reveal':
      if (session.index >= 0 && !wasReviewing) {
        session.phase = 'revealed';
        session.revealed.add(session.index);
      }
      break;
    case 'next':
      goTo(session.index + 1);
      break;
    case 'prev':
      goTo(session.index - 1);
      break;
    case 'goto':
      if (!Number.isInteger(index)) throw new ClasseError(400, 'action', 'Question inconnue.');
      goTo(index);
      break;
    case 'review':
      if (session.asked.size === 0) throw new ClasseError(409, 'bilan', "Aucune question n'a encore été posée.");
      if (index !== undefined && index !== null && !Number.isInteger(index)) throw new ClasseError(400, 'action', 'Question inconnue.');
      session.phase = 'review';
      session.reviewIndex = Number.isInteger(index) ? Math.min(last, Math.max(0, index)) : null;
      // Le bilan vaut correction de tout ce qui a été posé.
      for (const asked of session.asked) session.revealed.add(asked);
      break;
    case 'end': {
      const results = sessionResults(session);
      closeSession(session, 'fin');
      return { ended: true, results };
    }
    default:
      throw new ClasseError(400, 'action', 'Commande inconnue.');
  }
  // Feuilleter le bilan ne change rien pour les participants, qui ont déjà leur revue.
  if (wasReviewing && session.phase === 'review') broadcastHost(session);
  else broadcast(session);
  return { ended: false };
}

/** Bilan d'une session : une ligne par participant, une colonne par question. */
export function sessionResults(session) {
  return {
    title: session.title,
    questions: session.questions.map((question, index) => ({
      title: question.title,
      rank: question.rank,
      of: question.of,
      correct: correctIndexes(question.choices),
      asked: session.asked.has(index),
      stats: questionStats(session, index),
    })),
    participants: [...session.participants.values()].map((participant) => ({
      name: participant.name,
      answers: session.questions.map((question, index) => {
        const selection = participant.answers.get(index);
        if (!selection) return null;
        return { selection, correct: isCorrectSelection(question.choices, selection) };
      }),
    })),
  };
}

export function resultsFor(code, hostToken) {
  const session = getSession(code);
  if (!isHost(session, hostToken)) throw new ClasseError(403, 'interdit', 'Réservé à la personne qui anime la session.');
  return sessionResults(session);
}

/**
 * Ouvre le flux temps réel d'un participant ou de l'enseignant.
 * @param {string} code
 * @param {{ hostToken?: string, participantToken?: string }} credentials
 * @returns {ReadableStream<Uint8Array>}
 */
export function openStream(code, { hostToken, participantToken }) {
  const session = getSession(code);
  const role = hostToken && isHost(session, hostToken) ? 'host' : 'participant';
  const participant = role === 'participant' ? findParticipant(session, participantToken) : null;
  if (role === 'participant' && !participant) {
    throw new ClasseError(401, 'inconnu', "Vous n'êtes pas inscrit à cette session.");
  }
  // Un onglet rechargé remplace le précédent : deux flux au plus par personne.
  const mine = [...session.streams].filter((stream) =>
    role === 'host' ? stream.role === 'host' : stream.participantId === participant.id);
  for (const stale of mine.slice(0, Math.max(0, mine.length - 1))) dropStream(stale);

  // Plafond vérifié après ce ménage : recharger sa page libère sa propre place.
  if (store.connections >= limits().maxConnections) {
    throw new ClasseError(503, 'sature', 'Le serveur est saturé. Réessayez dans un instant.');
  }

  const stream = {
    session,
    role,
    participantId: participant?.id ?? null,
    encoder: new TextEncoder(),
    controller: null,
    closed: false,
  };

  return new ReadableStream({
    start(controller) {
      stream.controller = controller;
      store.connections++;
      session.streams.add(stream);
      controller.enqueue(stream.encoder.encode('retry: 3000\n\n'));
      send(stream, 'etat', stateFor(session, stream));
      if (role === 'participant') scheduleStats(session);
    },
    cancel() {
      dropStream(stream);
    },
  });
}

/** Remet tout à zéro : réservé aux tests. */
export function resetForTests() {
  for (const session of [...store.sessions.values()]) closeSession(session, 'test');
  store.connections = 0;
}
