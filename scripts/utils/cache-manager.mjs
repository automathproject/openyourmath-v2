// scripts/utils/cache-manager.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const fsPromises = fs.promises;

/**
 * Gestionnaire de cache intelligent pour OpenYourMath V2
 * Permet le build incrémental et le partage multi-machines via Git
 */
export class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    this.metaFile = path.join(cacheDir, '.cache-meta.json');
  }

  /**
   * Calcule le hash SHA256 d'un fichier
   */
  async calculateFileHash(filePath) {
    try {
      const content = await fsPromises.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  /**
   * Charge les métadonnées du cache
   */
  async loadMetadata() {
    try {
      const content = await fsPromises.readFile(this.metaFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {
        version: "1.0.0",
        last_update: "",
        total_exercises: 0,
        hash_algorithm: "sha256",
        files: {}
      };
    }
  }

  /**
   * Sauvegarde les métadonnées du cache
   */
  async saveMetadata(metadata) {
    await fsPromises.mkdir(this.cacheDir, { recursive: true });
    await fsPromises.writeFile(
      this.metaFile, 
      JSON.stringify(metadata, null, 2), 
      'utf8'
    );
  }

  /**
   * Vérifie si un fichier cache est à jour par rapport au source
   */
  /**
   * Vérifie si un fichier cache est à jour par rapport au source
   */
  async isUpToDate(sourcePath, cachePath) {
    try {
      // 1. Vérifier l'existence du fichier cache. S'il n'existe pas, il n'est pas à jour.
      const cacheExists = await fsPromises.access(cachePath).then(() => true).catch(() => false);
      if (!cacheExists) {
        return false;
      }

      // 2. (Optionnel mais rapide) Comparer les timestamps. Si la source est plus récente, il n'est pas à jour.
      const sourceStats = await fsPromises.stat(sourcePath);
      const cacheStats = await fsPromises.stat(cachePath);
      
      if (cacheStats.mtime < sourceStats.mtime) {
        return false;
      }

      // 3. VÉRIFICATION CORRIGÉE : Utiliser le hash pour une comparaison fiable.
      const metadata = await this.loadMetadata();
      
      // La clé DOIT être générée de la même manière que dans la fonction `save`.
      const cacheKey = path.relative(this.cacheDir, cachePath);
      const fileInfo = metadata.files[cacheKey];
      
      // Si aucune métadonnée n'existe pour ce fichier, il doit être traité.
      if (!fileInfo) {
        return false;
      }
      
      // On compare le hash actuel du fichier source avec le hash stocké.
      // C'est la vérification la plus fiable.
      const currentHash = await this.calculateFileHash(sourcePath);
      return currentHash === fileInfo.source_hash;

    } catch (error) {
      // En cas d'erreur (ex: fichier source supprimé mais cache existant), on force la reconstruction.
      return false;
    }
  }

  /**
   * Sauvegarde un fichier dans le cache avec métadonnées
   */
  async save(cachePath, data) {
    // Créer le dossier de destination
    await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
    
    // Sauvegarder le JSON
    await fsPromises.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
    
    // Mettre à jour les métadonnées
    const metadata = await this.loadMetadata();
    const relativeCachePath = path.relative(this.cacheDir, cachePath);
    
    metadata.files[relativeCachePath] = {
      source_hash: data.source_hash,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at,
      uuid: data.uuid,
      title: data.title
    };
    
    await this.saveMetadata(metadata);
  }

  /**
   * Charge un fichier depuis le cache
   */
  async load(cachePath) {
    try {
      const content = await fsPromises.readFile(cachePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Met à jour les métadonnées globales après un build
   */
  async updateMetadata(stats) {
    const metadata = await this.loadMetadata();
    
    metadata.last_update = new Date().toISOString();
    metadata.total_exercises = Object.keys(metadata.files).length;
    metadata.build_stats = {
      processed: stats.processed,
      skipped: stats.skipped,
      errors: stats.errors,
      timestamp: new Date().toISOString()
    };
    
    await this.saveMetadata(metadata);
  }

  /**
   * Nettoie les entrées obsolètes du cache
   */
  async cleanup() {
    const metadata = await this.loadMetadata();
    const validFiles = {};
    
    for (const [filePath, fileInfo] of Object.entries(metadata.files)) {
      const fullPath = path.join(this.cacheDir, filePath);
      const exists = await fsPromises.access(fullPath).then(() => true).catch(() => false);
      
      if (exists) {
        validFiles[filePath] = fileInfo;
      }
    }
    
    metadata.files = validFiles;
    metadata.total_exercises = Object.keys(validFiles).length;
    
    await this.saveMetadata(metadata);
    
    console.log(`🧹 Cache cleanup: ${Object.keys(metadata.files).length - Object.keys(validFiles).length} orphaned entries removed`);
  }

  /**
   * Récupère les statistiques du cache
   */
  async getStats() {
    const metadata = await this.loadMetadata();
    
    return {
      totalFiles: Object.keys(metadata.files).length,
      lastUpdate: metadata.last_update,
      version: metadata.version,
      buildStats: metadata.build_stats || null
    };
  }

  /**
   * Trouve tous les fichiers cache pour un pattern donné
   */
  async findCacheFiles(pattern = '**/*.json') {
    const glob = await import('glob');
    const cacheFiles = await glob.glob(pattern, { cwd: this.cacheDir });
    
    return cacheFiles.map(file => ({
      path: path.join(this.cacheDir, file),
      relativePath: file
    }));
  }

  /**
   * Valide l'intégrité de tout le cache
   */
  async validateIntegrity() {
    const metadata = await this.loadMetadata();
    const issues = [];
    
    for (const [filePath, fileInfo] of Object.entries(metadata.files)) {
      const fullPath = path.join(this.cacheDir, filePath);
      
      try {
        const data = await this.load(fullPath);
        
        // Vérifier cohérence UUID
        if (data.uuid !== fileInfo.uuid) {
          issues.push(`UUID mismatch in ${filePath}: ${data.uuid} vs ${fileInfo.uuid}`);
        }
        
        // Vérifier hash source si disponible
        if (data.source_hash && data.source_hash !== fileInfo.source_hash) {
          issues.push(`Source hash mismatch in ${filePath}`);
        }
        
      } catch (error) {
        issues.push(`Cannot read cache file ${filePath}: ${error.message}`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues: issues,
      totalFiles: Object.keys(metadata.files).length
    };
  }
}