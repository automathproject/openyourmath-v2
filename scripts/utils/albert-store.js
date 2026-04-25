// scripts/utils/albert-store.js
// Versioning des métadonnées générées par Albert (coûteuses à régénérer).
// Les fichiers JSON sont commités dans git sous content/metadata/{uuid}.json.
// Ils survivent à pnpm clean et permettent de reconstruire la DB sans rappeler l'API.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALBERT_DIR = path.resolve(__dirname, '../../content/metadata');

/**
 * Sauvegarde les métadonnées Albert d'un exercice dans le store versionné.
 *
 * @param {string} uuid
 * @param {{
 *   summary: string,
 *   concepts: string[],
 *   methods: string[],
 *   objects: string[],
 *   content_hash: string,
 *   model: string,
 *   indexed_at: string
 * }} data
 */
export function saveAlbertMetadata(uuid, data) {
  fs.mkdirSync(ALBERT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ALBERT_DIR, `${uuid}.json`),
    JSON.stringify(data, null, 2) + '\n'
  );
}

/**
 * Charge les métadonnées Albert d'un exercice depuis le store versionné.
 * Retourne null si le fichier n'existe pas.
 *
 * @param {string} uuid
 * @returns {object|null}
 */
export function loadAlbertMetadata(uuid) {
  const filePath = path.join(ALBERT_DIR, `${uuid}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Charge toutes les métadonnées Albert versionnées.
 * Utilisé par build-db.js pour peupler les colonnes Pipeline B sans appeler l'API.
 *
 * @returns {Map<string, object>} uuid → metadata
 */
export function loadAllAlbertMetadata() {
  const result = new Map();
  if (!fs.existsSync(ALBERT_DIR)) return result;

  for (const file of fs.readdirSync(ALBERT_DIR)) {
    if (!file.endsWith('.json')) continue;
    const uuid = file.slice(0, -5);
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ALBERT_DIR, file), 'utf8'));
      result.set(uuid, data);
    } catch {
      // fichier corrompu : on l'ignore silencieusement
    }
  }

  return result;
}

/**
 * Supprime les métadonnées Albert d'un exercice du store versionné.
 * À utiliser quand un exercice est supprimé du contenu.
 *
 * @param {string} uuid
 */
export function deleteAlbertMetadata(uuid) {
  const filePath = path.join(ALBERT_DIR, `${uuid}.json`);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // déjà absent
  }
}
