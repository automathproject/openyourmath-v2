// Signalement d'erreur : parties d'un exercice, validation, composition du
// ticket et jetons signés (src/lib/signalement, src/lib/server/signalement).
import { describe, expect, it } from 'vitest';
import { partiesExercice } from '../../src/lib/signalement/types.js';
import { citer, composerTicket, validerSignalement } from '../../src/lib/server/signalement/ticket.js';
import { cheminLocal, signer, verifier } from '../../src/lib/server/signalement/session.js';

const exercise = {
  uuid: 'Kme5',
  title: 'Divisions euclidiennes',
  level: 'L1',
  module: 'Algèbre',
  chapter: 'Polynôme, fraction rationnelle',
  subchapter: 'Division euclidienne',
  source_path: 'exo7/1-L1/Kme5.tex',
  content: [
    { type: 'text' },
    { type: 'question' },
    { type: 'indication' },
    { type: 'reponse' },
    { type: 'question' },
    { type: 'reponse' },
    { type: 'reponse' }
  ]
};
const cpge = [{ programme: 'pcsi', titre: 'PCSI', noeuds: [{ id: 'pcsi.polynomes.b', titre: 'Division euclidienne', section: 'Polynômes' }] }];
const auteur = { fournisseur: 'forge', id: '42', login: 'prof.math', nom: 'Prof Math', profil: 'https://forge.example/prof.math' };

describe('partiesExercice', () => {
  it('numérote les questions, leurs réponses et indications comme à l’affichage', () => {
    expect(partiesExercice(exercise.content).map(p => p.libelle)).toEqual([
      'Énoncé (introduction)', 'Question 1', 'Indication 1', 'Réponse 1',
      'Question 2', 'Réponse 2', 'Réponse 2 (2)', 'Tout l’exercice'
    ]);
  });
});

describe('validerSignalement', () => {
  const valider = corps => validerSignalement(corps, { exercise, cpge });

  it('accepte une erreur de correction avec sa partie', () => {
    const v = valider({ type: 'solution', partie: 'reponse-2', ecrit: '6-9X', attendu: '6-7X', message: 'Le reste est faux.' });
    expect(v).toEqual({ ok: true, signalement: { type: 'solution', message: 'Le reste est faux.', partie: 'Réponse 2', ecrit: '6-9X', attendu: '6-7X' } });
  });

  it('refuse un type inconnu, un message trop court ou une partie absente', () => {
    expect(valider({ type: 'spam', message: 'assez long message' }).ok).toBe(false);
    expect(valider({ type: 'autre', message: 'court' }).ok).toBe(false);
    expect(valider({ type: 'enonce', partie: 'question-9', message: 'Hypothèse manquante ici.' }).ok).toBe(false);
  });

  it('écarte les robots qui remplissent le champ piège', () => {
    expect(valider({ type: 'autre', message: 'Un message assez long.', site: 'http://spam' }).ok).toBe(false);
  });

  it('ne garde que les rattachements CPGE réels de l’exercice', () => {
    const v = valider({ type: 'cpge', cpgeContestes: ['pcsi.polynomes.b', 'mp.inventé'], message: 'Hors programme de PCSI.' });
    expect(v.signalement.cpgeContestes.map(n => n.id)).toEqual(['pcsi.polynomes.b']);
    expect(valider({ type: 'cpge', cpgeContestes: ['mp.inventé'], message: 'Hors programme de PCSI.' }).ok).toBe(false);
  });

  it('demande un identifiant de doublon valide et différent de l’exercice', () => {
    expect(valider({ type: 'doublon', doublon: '#1IUZ', message: 'Même énoncé que 1IUZ.' }).signalement.doublon).toBe('1IUZ');
    expect(valider({ type: 'doublon', doublon: 'Kme5', message: 'Même énoncé que lui.' }).ok).toBe(false);
  });
});

describe('composerTicket', () => {
  it('compose titre, corps et étiquettes', () => {
    const { signalement } = validerSignalement(
      { type: 'solution', partie: 'reponse-2', ecrit: '6-9X', attendu: '6-7X', message: 'Le reste est faux.' },
      { exercise, cpge }
    );
    const ticket = composerTicket({
      exercise, signalement, auteur,
      origine: 'https://openyourmath.org',
      lienSource: chemin => `https://forge.example/automath/exobase/-/blob/main/${chemin}`
    });
    expect(ticket.titre).toBe('Kme5 · Erreur dans la correction — Divisions euclidiennes');
    expect(ticket.etiquettes).toEqual(['signalement', 'correction']);
    expect(ticket.corps).toContain('[`content/exercises/exo7/1-L1/Kme5.tex`](https://forge.example/automath/exobase/-/blob/main/content/exercises/exo7/1-L1/Kme5.tex)');
    expect(ticket.corps).toContain('**Partie concernée** : Réponse 2');
    expect(ticket.corps).toContain('### Ce qu’il faudrait écrire\n\n> 6-7X');
    expect(ticket.corps).toContain('par [prof.math](https://forge.example/prof.math) (Prof Math), compte de la forge');
  });
});

describe('citer', () => {
  it('neutralise mentions, renvois de tickets, images et HTML', () => {
    expect(citer('@admin voir #12\n![x](http://t.co/p.png) <script>')).toBe(
      '> @​admin voir #​12\n> !\\[x](http://t.co/p.png) &lt;script&gt;'
    );
  });
});

describe('jetons signés', () => {
  it('relit un jeton intact et rejette un jeton altéré, expiré ou d’un autre secret', () => {
    const jeton = signer({ login: 'prof.math' }, 'secret', 60);
    expect(verifier(jeton, 'secret').login).toBe('prof.math');
    expect(verifier(jeton, 'autre')).toBeNull();
    expect(verifier(jeton.replace(/.$/, c => (c === 'A' ? 'B' : 'A')), 'secret')).toBeNull();
    expect(verifier(signer({ login: 'x' }, 'secret', -1), 'secret')).toBeNull();
    expect(verifier(undefined, 'secret')).toBeNull();
  });

  it('n’accepte comme retour qu’un chemin local', () => {
    expect(cheminLocal('/exercise/Kme5?x=1')).toBe('/exercise/Kme5?x=1');
    expect(cheminLocal('//evil.example')).toBe('/');
    expect(cheminLocal('https://evil.example')).toBe('/');
  });
});
