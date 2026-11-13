// tests/build/classe.test.js
// Sessions de qcm en direct (src/lib/server/classe/sessions.js) : déroulé,
// droits de chacun, et plafonds qui protègent le serveur.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ClasseError,
  control,
  createSession,
  getSession,
  joinSession,
  limits,
  normalizeCode,
  occupancy,
  openStream,
  resetForTests,
  resultsFor,
  submitAnswer,
  sweepSessions,
} from '../../src/lib/server/classe/sessions.js';

const question = (title, correct, extra = {}) => ({
  uuid: 'Ab12',
  title,
  rank: 1,
  of: 1,
  ordered: false,
  context_html: '',
  stem_html: `<p>${title}</p>`,
  type: 'onetoall',
  choices: correct.map((isCorrect, index) => ({ html: `choix ${index}`, correct: isCorrect })),
  explanation_html: '<p>Parce que.</p>',
  ...extra,
});

const QUESTIONS = [question('Première', [false, true, true]), question('Seconde', [true, false], { type: 'onlyone' })];
const ENV_KEYS = ['CLASSE_MAX_PARTICIPANTS', 'CLASSE_MAX_SESSIONS', 'CLASSE_MAX_CONNEXIONS', 'CLASSE_MAX_QUESTIONS', 'CLASSE_DUREE_MAX_MIN', 'CLASSE_INACTIVITE_MIN'];

/** Lit les messages déjà émis sur un flux, sans attendre les suivants. */
async function readEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const result = await Promise.race([reader.read(), new Promise((resolve) => setTimeout(() => resolve(null), 20))]);
    if (!result || result.done) break;
    text += decoder.decode(result.value);
  }
  reader.releaseLock();
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('event:'))
    .map((chunk) => ({ event: /^event: (.*)$/m.exec(chunk)[1], data: JSON.parse(/^data: (.*)$/m.exec(chunk)[1]) }));
}

const expectError = (run, code) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ClasseError);
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`erreur « ${code} » attendue`);
};

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  resetForTests();
});
afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  resetForTests();
});

describe('déroulé d’une session', () => {
  it('ouvre, recueille les réponses, corrige et donne le bilan', () => {
    const { code, hostToken } = createSession({ title: 'Essai', questions: QUESTIONS });
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const ada = joinSession(code, '  Ada   Lovelace ');
    const bob = joinSession(code, '');
    expect(ada.name).toBe('Ada Lovelace');
    expect(bob.name).toBe('Participant 2');

    // Avant l'ouverture, aucune réponse n'est acceptée.
    expectError(() => submitAnswer(code, ada.token, 0, [1]), 'ferme');

    control(code, hostToken, 'open');
    expect(submitAnswer(code, ada.token, 0, [2, 1, 1, 7]).answer).toEqual([1, 2]);
    submitAnswer(code, bob.token, 0, [1]);
    // Une réponse se corrige tant que la question est ouverte.
    expect(submitAnswer(code, bob.token, 0, [0]).answer).toEqual([0]);
    // On ne répond qu'à la question en cours.
    expectError(() => submitAnswer(code, ada.token, 1, [0]), 'ferme');

    control(code, hostToken, 'close');
    expectError(() => submitAnswer(code, ada.token, 0, [1]), 'ferme');
    control(code, hostToken, 'reveal');

    control(code, hostToken, 'next');
    expect(getSession(code).phase).toBe('open');
    // Réponse unique : une seule case est retenue.
    expect(submitAnswer(code, ada.token, 1, [0, 1]).answer).toEqual([0]);
    control(code, hostToken, 'reveal');

    const results = resultsFor(code, hostToken);
    expect(results.questions[0].stats).toEqual({ answered: 2, correct: 1, counts: [1, 1, 1] });
    expect(results.participants.map((participant) => participant.answers.map((answer) => answer?.correct ?? null))).toEqual([
      [true, true],
      [false, null],
    ]);

    const ended = control(code, hostToken, 'end');
    expect(ended.ended).toBe(true);
    expect(ended.results.participants).toHaveLength(2);
    expectError(() => getSession(code), 'introuvable');
  });

  it('différencie deux pseudonymes identiques', () => {
    const { code } = createSession({ questions: QUESTIONS });
    expect(joinSession(code, 'Zoé').name).toBe('Zoé');
    expect(joinSession(code, 'zoé').name).toBe('zoé (2)');
    expect(joinSession(code, '<b>Zoé</b>').name).toBe('bZoé/b');
  });

  it('accepte un code saisi en minuscules ou avec des espaces', () => {
    const { code } = createSession({ questions: QUESTIONS });
    expect(normalizeCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `)).toBe(code);
    expect(getSession(code.toLowerCase()).code).toBe(code);
  });
});

describe('bilan', () => {
  const THREE = [...QUESTIONS, question('Troisième', [true, false])];

  it('corrige ce qui a été posé, garde la session ouverte et donne à chacun sa revue', async () => {
    const { code, hostToken } = createSession({ questions: THREE });
    const ada = joinSession(code, 'Ada');
    expectError(() => control(code, hostToken, 'review'), 'bilan');

    control(code, hostToken, 'open');
    submitAnswer(code, ada.token, 0, [1, 2]);
    control(code, hostToken, 'reveal');
    control(code, hostToken, 'next');
    // La seconde est posée, jamais corrigée ; la troisième n'est jamais ouverte.
    submitAnswer(code, ada.token, 1, [1]);

    const participant = openStream(code, { participantToken: ada.token });
    const host = openStream(code, { hostToken });
    await readEvents(participant);
    await readEvents(host);

    control(code, hostToken, 'review');
    const session = getSession(code);
    expect(session.phase).toBe('review');
    expect([...session.revealed].sort()).toEqual([0, 1]);
    expectError(() => submitAnswer(code, ada.token, 1, [0]), 'ferme');

    const mine = (await readEvents(participant)).at(-1).data;
    expect(mine.question).toBeUndefined();
    expect(mine.me).toMatchObject({ score: 1 });
    expect(mine.review.map((item) => [item.index, item.answer, item.ok])).toEqual([
      [0, [1, 2], true],
      [1, [1], false],
    ]);
    expect(mine.review[1].choices.map((choice) => choice.correct)).toEqual([true, false]);

    const overview = (await readEvents(host)).at(-1).data;
    expect(overview.reviewIndex).toBeNull();
    expect(overview.question).toBeUndefined();
    expect(overview.outline.map(({ asked, answered, correct }) => ({ asked, answered, correct }))).toEqual([
      { asked: true, answered: 1, correct: 1 },
      { asked: true, answered: 1, correct: 0 },
      { asked: false, answered: 0, correct: 0 },
    ]);

    // Revoir une question ne renvoie rien aux participants.
    control(code, hostToken, 'review', 1);
    expect((await readEvents(host)).at(-1).data).toMatchObject({ reviewIndex: 1, correction: { correct: [0] } });
    expect(await readEvents(participant)).toEqual([]);

    // Reprendre le déroulé, puis terminer : la revue part avec le message de fin.
    control(code, hostToken, 'goto', 2);
    expect(getSession(code).phase).toBe('open');
    expect(resultsFor(code, hostToken).questions.map((item) => item.asked)).toEqual([true, true, true]);
    control(code, hostToken, 'end');
    const fin = (await readEvents(participant)).find(({ event }) => event === 'fin').data;
    expect(fin.reason).toBe('fin');
    expect(fin.review.map((item) => item.index)).toEqual([0, 1]);
  });
});

describe('droits', () => {
  it('réserve le pilotage et le bilan à la personne qui anime', () => {
    const { code, hostToken } = createSession({ questions: QUESTIONS });
    const ada = joinSession(code, 'Ada');
    expectError(() => control(code, ada.token, 'open'), 'interdit');
    expectError(() => control(code, '', 'end'), 'interdit');
    expectError(() => resultsFor(code, ada.token), 'interdit');
    expectError(() => submitAnswer(code, hostToken, 0, [0]), 'inconnu');
    expectError(() => openStream(code, { participantToken: 'inconnu' }), 'inconnu');
  });

  it('ne montre les réponses justes aux participants qu’à la correction', async () => {
    const { code, hostToken } = createSession({ questions: QUESTIONS });
    const ada = joinSession(code, 'Ada');
    const participant = openStream(code, { participantToken: ada.token });
    const host = openStream(code, { hostToken });

    control(code, hostToken, 'open');
    submitAnswer(code, ada.token, 0, [1, 2]);
    control(code, hostToken, 'close');

    const before = await readEvents(participant);
    for (const { data } of before) {
      expect(JSON.stringify(data)).not.toContain('"correct"');
      expect(data.correction).toBeUndefined();
      expect(data.stats).toBeUndefined();
      expect(data.roster).toBeUndefined();
    }
    expect(before.at(-1).data).toMatchObject({ phase: 'closed', answer: [1, 2] });
    expect(before.at(-1).data.question.choices).toEqual([{ html: 'choix 0' }, { html: 'choix 1' }, { html: 'choix 2' }]);

    control(code, hostToken, 'reveal');
    const after = await readEvents(participant);
    expect(after.at(-1).data.correction).toEqual({ correct: [1, 2], explanation_html: '<p>Parce que.</p>' });
    expect(after.at(-1).data.me).toMatchObject({ name: 'Ada', score: 1 });

    // L'enseignant, lui, voit la répartition et la correction dès le départ.
    const hostEvents = await readEvents(host);
    expect(hostEvents.at(-1).data.stats).toEqual({ answered: 1, correct: 1, counts: [0, 1, 1] });
    expect(hostEvents.at(-1).data.roster).toEqual([{ name: 'Ada', score: 1, answered: 1, online: true }]);
  });
});

describe('plafonds', () => {
  it('refuse les participants au-delà de la capacité de la session', () => {
    process.env.CLASSE_MAX_PARTICIPANTS = '2';
    const { code } = createSession({ questions: QUESTIONS });
    joinSession(code, 'Ada');
    joinSession(code, 'Bob');
    expectError(() => joinSession(code, 'Cléo'), 'complet');
    expect(getSession(code).participants.size).toBe(2);
  });

  it('limite le nombre de sessions simultanées et de questions', () => {
    process.env.CLASSE_MAX_SESSIONS = '2';
    process.env.CLASSE_MAX_QUESTIONS = '3';
    createSession({ questions: QUESTIONS });
    const second = createSession({ questions: QUESTIONS });
    expectError(() => createSession({ questions: QUESTIONS }), 'complet');
    // Une session terminée libère sa place.
    control(second.code, second.hostToken, 'end');
    expect(createSession({ questions: QUESTIONS }).code).toHaveLength(6);

    expectError(() => createSession({ questions: [...QUESTIONS, ...QUESTIONS] }), 'trop-de-questions');
    expectError(() => createSession({ questions: [] }), 'vide');
  });

  it('limite les connexions ouvertes et remplace celles d’un onglet rechargé', async () => {
    process.env.CLASSE_MAX_CONNEXIONS = '3';
    const { code, hostToken } = createSession({ questions: QUESTIONS });
    const ada = joinSession(code, 'Ada');
    const streams = [openStream(code, { hostToken })];
    // Trois ouvertures par la même personne : la plus ancienne est fermée.
    for (let i = 0; i < 3; i++) streams.push(openStream(code, { participantToken: ada.token }));
    for (const stream of streams) await readEvents(stream);
    expect(occupancy().connections).toBe(3);

    const bob = joinSession(code, 'Bob');
    expectError(() => openStream(code, { participantToken: bob.token }), 'sature');
  });

  it('ferme une session trop vieille ou inactive', () => {
    process.env.CLASSE_DUREE_MAX_MIN = '60';
    process.env.CLASSE_INACTIVITE_MIN = '10';
    const old = createSession({ questions: QUESTIONS });
    const idle = createSession({ questions: QUESTIONS });
    const active = createSession({ questions: QUESTIONS });
    const now = Date.now();
    getSession(old.code).createdAt = now - 61 * 60_000;
    getSession(old.code).lastActivity = now;
    getSession(idle.code).lastActivity = now - 11 * 60_000;
    sweepSessions(now);
    expectError(() => getSession(old.code), 'introuvable');
    expectError(() => getSession(idle.code), 'introuvable');
    expect(getSession(active.code).code).toBe(active.code);
  });

  it('borne les réglages lus dans l’environnement', () => {
    process.env.CLASSE_MAX_PARTICIPANTS = '100000';
    process.env.CLASSE_MAX_SESSIONS = 'abc';
    expect(limits().maxParticipants).toBe(500);
    expect(limits().maxSessions).toBe(8);
  });
});
