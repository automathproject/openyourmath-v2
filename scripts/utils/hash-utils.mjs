// build/utils/hash-utils.mjs
import fs from 'fs';
import crypto from 'crypto';

const fsPromises = fs.promises;

/**
 * Calcule le hash SHA256 d'un fichier
 */
/**
 * Calcule le hash d'un fichier pour détecter les changements
 */
async function calculateFileHash(filePath) {
  const content = await fsPromises.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calcule le hash d'une chaîne de caractères
 */
export function calculateStringHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Calcule le hash d'un objet JSON (hash du contenu sérialisé)
 */
export function calculateObjectHash(obj) {
  const serialized = JSON.stringify(obj, null, 0); // Sans indentation pour cohérence
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Valide l'intégrité d'un fichier contre son hash attendu
 */
export async function validateFileHash(filePath, expectedHash) {
  try {
    const actualHash = await calculateFileHash(filePath);
    return {
      valid: actualHash === expectedHash,
      actualHash,
      expectedHash
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      expectedHash
    };
  }
}

/**
 * Compare les hash de deux fichiers
 */
export async function compareFileHashes(file1, file2) {
  try {
    const [hash1, hash2] = await Promise.all([
      calculateFileHash(file1),
      calculateFileHash(file2)
    ]);
    
    return {
      identical: hash1 === hash2,
      hash1,
      hash2
    };
  } catch (error) {
    return {
      identical: false,
      error: error.message
    };
  }
}

/**
 * Génère un hash court pour les IDs (basé sur le contenu)
 */
export function generateShortHash(content, length = 8) {
  const fullHash = calculateStringHash(content);
  return fullHash.substring(0, length);
}

/**
 * Valide l'intégrité d'un cache JSON
 */
export async function validateCacheIntegrity(cachePath, sourceHash = null) {
  try {
    const cacheContent = await fsPromises.readFile(cachePath, 'utf8');
    const cacheData = JSON.parse(cacheContent);
    
    const validation = {
      valid: true,
      errors: []
    };

    // Vérifier la présence des champs essentiels
    const requiredFields = ['uuid', 'title', 'content', 'source_hash', 'updated_at'];
    for (const field of requiredFields) {
      if (!(field in cacheData)) {
        validation.valid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Vérifier la cohérence du hash source si fourni
    if (sourceHash && cacheData.source_hash !== sourceHash) {
      validation.valid = false;
      validation.errors.push(`Source hash mismatch: expected ${sourceHash}, got ${cacheData.source_hash}`);
    }

    // Vérifier la structure du contenu
    if (Array.isArray(cacheData.content)) {
      cacheData.content.forEach((block, index) => {
        if (!block.id || !block.type || !block.html) {
          validation.valid = false;
          validation.errors.push(`Invalid content block at index ${index}`);
        }
      });
    } else {
      validation.valid = false;
      validation.errors.push('Content field must be an array');
    }

    return validation;

  } catch (error) {
    return {
      valid: false,
      errors: [`Cannot validate cache file: ${error.message}`]
    };
  }
}

/**
 * Calcule un hash de "signature" pour un exercice (métadonnées + contenu)
 */
export function calculateExerciseSignature(exerciseData) {
  // Créer une signature basée sur les éléments clés
  const signature = {
    uuid: exerciseData.uuid,
    title: exerciseData.title,
    chapter: exerciseData.chapter,
    contentHashes: exerciseData.content?.map(block => 
      calculateStringHash(block.latex || block.html)
    ) || []
  };
  
  return calculateObjectHash(signature);
}

/**
 * Vérifie si deux exercices sont identiques (même signature)
 */
export function areExercicesIdentical(exercise1, exercise2) {
  const sig1 = calculateExerciseSignature(exercise1);
  const sig2 = calculateExerciseSignature(exercise2);
  return sig1 === sig2;
}

/**
 * Génère un rapport d'intégrité pour un ensemble de fichiers
 */
export async function generateIntegrityReport(files) {
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    validFiles: 0,
    invalidFiles: 0,
    errors: []
  };

  for (const file of files) {
    try {
      const validation = await validateCacheIntegrity(file.path, file.expectedHash);
      
      if (validation.valid) {
        report.validFiles++;
      } else {
        report.invalidFiles++;
        report.errors.push({
          file: file.path,
          errors: validation.errors
        });
      }
    } catch (error) {
      report.invalidFiles++;
      report.errors.push({
        file: file.path,
        errors: [error.message]
      });
    }
  }

  return report;
}

/**
 * Nettoie et normalise un hash (supprime espaces, convertit en lowercase)
 */
export function normalizeHash(hash) {
  if (typeof hash !== 'string') {
    throw new Error('Hash must be a string');
  }
  return hash.trim().toLowerCase();
}

/**
 * Vérifie si un hash est valide (format SHA256)
 */
export function isValidHash(hash) {
  if (typeof hash !== 'string') return false;
  const normalized = normalizeHash(hash);
  return /^[a-f0-9]{64}$/.test(normalized);
}

/**
 * Calcule un hash incrémental basé sur les timestamps et contenus
 */
export async function calculateIncrementalHash(filePaths) {
  const fileInfos = [];
  
  for (const filePath of filePaths) {
    try {
      const stats = await fsPromises.stat(filePath);
      const hash = await calculateFileHash(filePath);
      
      fileInfos.push({
        path: filePath,
        mtime: stats.mtime.getTime(),
        size: stats.size,
        hash: hash
      });
    } catch (error) {
      // Fichier manquant ou inaccessible
      fileInfos.push({
        path: filePath,
        error: error.message
      });
    }
  }
  
  // Trier par chemin pour cohérence
  fileInfos.sort((a, b) => a.path.localeCompare(b.path));
  
  return calculateObjectHash(fileInfos);
}

/**
 * Utilitaire pour vérifier l'intégrité d'un dossier complet
 */
export async function validateDirectoryIntegrity(dirPath, manifestPath = null) {
  const result = {
    valid: true,
    scannedFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    missingFiles: 0,
    unexpectedFiles: 0,
    errors: []
  };

  try {
    // Lire le manifeste s'il existe
    let manifest = null;
    if (manifestPath && await fsPromises.access(manifestPath).then(() => true).catch(() => false)) {
      const manifestContent = await fsPromises.readFile(manifestPath, 'utf8');
      manifest = JSON.parse(manifestContent);
    }

    // Scanner les fichiers actuels
    const files = await scanDirectory(dirPath);
    result.scannedFiles = files.length;

    // Valider chaque fichier
    for (const file of files) {
      try {
        if (file.endsWith('.json')) {
          const validation = await validateCacheIntegrity(file);
          if (validation.valid) {
            result.validFiles++;
          } else {
            result.invalidFiles++;
            result.valid = false;
            result.errors.push({
              file: file,
              type: 'invalid_content',
              errors: validation.errors
            });
          }
        } else {
          // Autres types de fichiers
          const hash = await calculateFileHash(file);
          if (manifest && manifest.files[file] && manifest.files[file] !== hash) {
            result.invalidFiles++;
            result.valid = false;
            result.errors.push({
              file: file,
              type: 'hash_mismatch',
              expected: manifest.files[file],
              actual: hash
            });
          } else {
            result.validFiles++;
          }
        }
      } catch (error) {
        result.invalidFiles++;
        result.valid = false;
        result.errors.push({
          file: file,
          type: 'validation_error',
          error: error.message
        });
      }
    }

    // Vérifier les fichiers manquants (si manifeste disponible)
    if (manifest) {
      const expectedFiles = Object.keys(manifest.files);
      const actualFiles = files.map(f => path.relative(dirPath, f));
      
      for (const expectedFile of expectedFiles) {
        if (!actualFiles.includes(expectedFile)) {
          result.missingFiles++;
          result.valid = false;
          result.errors.push({
            file: expectedFile,
            type: 'missing_file'
          });
        }
      }
      
      for (const actualFile of actualFiles) {
        if (!expectedFiles.includes(actualFile)) {
          result.unexpectedFiles++;
          // Note: les fichiers inattendus ne rendent pas le dossier invalide
        }
      }
    }

  } catch (error) {
    result.valid = false;
    result.errors.push({
      type: 'directory_scan_error',
      error: error.message
    });
  }

  return result;
}

/**
 * Scanner récursif d'un dossier
 */
async function scanDirectory(dirPath) {
  const files = [];
  
  async function scan(currentPath) {
    const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dirPath);
  return files;
}