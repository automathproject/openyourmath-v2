// src/lib/qcm/results.js
// Bilan d'une session en direct, tel que le renvoie sessionResults().

import { choiceLetter } from './source.js';

/** Libellé court d'une question : « Titre (2/4) » dans une série. */
export function questionLabel(question, index) {
  const part = question.of > 1 ? ` (${question.rank}/${question.of})` : '';
  return `Q${index + 1} – ${question.title}${part}`;
}

/** « A, C » pour une sélection de rangs. */
export function lettersOf(selection) {
  return (selection || []).map(choiceLetter).join(', ');
}

/** Nombre de questions posées : le dénominateur des scores (une question sautée sans être ouverte ne compte pas). */
export function askedCount(results) {
  return results.questions.filter((question) => question.asked !== false).length;
}

/** Pourcentage arrondi de bonnes réponses ; 0 quand personne n'a répondu. */
export function successRate(correct, answered) {
  return answered > 0 ? Math.round((100 * correct) / answered) : 0;
}

/** Questions justes d'un participant. */
export function participantScore(participant) {
  return participant.answers.filter((answer) => answer?.correct).length;
}

function csvCell(value) {
  let text = String(value ?? '');
  // Un tableur exécuterait une cellule qui commence par =, +, - ou @.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Bilan au format CSV, séparé par des points-virgules (tableurs français) :
 * une ligne par participant, une colonne par question, puis le score.
 */
export function resultsToCsv(results) {
  const header = ['Participant', ...results.questions.map(questionLabel), 'Score'];
  const key = ['Réponses justes', ...results.questions.map((question) => lettersOf(question.correct) || 'aucune'), ''];
  const asked = askedCount(results);
  const rows = results.participants.map((participant) => [
    participant.name,
    ...participant.answers.map((answer) => (answer ? lettersOf(answer.selection) || '(aucune)' : '')),
    `${participantScore(participant)}/${asked}`,
  ]);
  // BOM : sans lui, Excel lit l'UTF-8 comme du Latin-1.
  return '﻿' + [header, key, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
