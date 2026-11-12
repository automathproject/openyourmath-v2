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
  const rows = results.participants.map((participant) => {
    const score = participant.answers.filter((answer) => answer?.correct).length;
    return [
      participant.name,
      ...participant.answers.map((answer) => (answer ? lettersOf(answer.selection) || '(aucune)' : '')),
      `${score}/${results.questions.length}`,
    ];
  });
  // BOM : sans lui, Excel lit l'UTF-8 comme du Latin-1.
  return '﻿' + [header, key, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
