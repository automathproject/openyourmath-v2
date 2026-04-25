// scripts/utils/albert-store.js
// Versioning des métadonnées générées par Albert (coûteuses à régénérer).
// Les fichiers JSON sont commités dans git sous content/metadata/{uuid}.json.
// Ils survivent à pnpm clean et permettent de reconstruire la DB sans rappeler l'API.

import fs from 'fs';
import path from 'path';
import { getMetadataPath, METADATA_ROOT } from './content-paths.js';

/**
 * Sauvegarde les métadonnées Albert d'un exercice dans le store versionné.
 *
 * @param {string} uuid
 * @param {{
 *   source_path?: string,
 *   summary: string,
 *   concepts: string[],
 *   methods: string[],
 *   objects: string[],
 *   content_hash: string,
 *   model: string,
 *   indexed_at: string
 * }} data
 * @param {{ sourcePath?: string }} options
 */
export function saveAlbertMetadata(uuid, data, options = {}) {
  const filePath = getMetadataPath(uuid, options.sourcePath || data.source_path || '');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
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
  const fileName = `${uuid}.json`;
  const filePath = path.join(METADATA_ROOT, fileName);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    // Fallback récursif pour les métadonnées rangées selon source_path.
  }

  if (!fs.existsSync(METADATA_ROOT)) return null;

  function find(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = find(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
    }
    return null;
  }

  const nestedPath = find(METADATA_ROOT);
  if (!nestedPath) return null;

  try {
    return JSON.parse(fs.readFileSync(nestedPath, 'utf8'));
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
  if (!fs.existsSync(METADATA_ROOT)) return result;

  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      const uuid = entry.name.slice(0, -5);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        result.set(uuid, data);
      } catch {
        // fichier corrompu : on l'ignore silencieusement
      }
    }
  }

  scan(METADATA_ROOT);

  return result;
}

/**
 * Supprime les métadonnées Albert d'un exercice du store versionné.
 * À utiliser quand un exercice est supprimé du contenu.
 *
 * @param {string} uuid
 */
export function deleteAlbertMetadata(uuid) {
  if (!fs.existsSync(METADATA_ROOT)) return;

  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name === `${uuid}.json`) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // déjà absent
        }
      }
    }
  }

  scan(METADATA_ROOT);
}
