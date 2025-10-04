// scripts/utils/cache-manager.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const fsPromises = fs.promises;

const DEFAULT_METADATA = {
  version: "1.0.0",
  last_update: "",
  total_exercises: 0,
  hash_algorithm: "sha256",
  files: {}
};

/**
 * Gestionnaire de cache intelligent pour OpenYourMath V2
 * Permet le build incrémental et le partage multi-machines via Git
 */
export class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = path.resolve(cacheDir);
    this.metaFile = path.join(this.cacheDir, '.cache-meta.json');
    this.metadata = null;
    this.metadataLoaded = false;
    this.metadataDirty = false;
  }

  /**
   * Génère une clé de cache normalisée basée sur le chemin relatif du cache
   * Cette clé sera cohérente entre isUpToDate() et save()
   */
  generateCacheKey(cachePath) {
    // Normaliser le chemin et utiliser des séparateurs Unix pour la cohérence multi-OS
    const relativePath = path.relative(this.cacheDir, cachePath);
    return relativePath.replace(/\\/g, '/'); // Convertir \ en / pour Windows
  }

  /**
   * Calcule le hash SHA256 d'un fichier
   */
  async calculateFileHash(filePath) {
    try {
      const content = await fsPromises.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      if (process.argv.includes('--debug')) {
        console.warn(`⚠️  Cannot calculate hash for ${filePath}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Charge les métadonnées du cache
   */
  async loadMetadata() {
    if (this.metadataLoaded) {
      return this.metadata;
    }

    try {
      const content = await fsPromises.readFile(this.metaFile, 'utf8');
      this.metadata = JSON.parse(content);
    } catch (error) {
      this.metadata = { ...DEFAULT_METADATA };
    }

    this.metadataLoaded = true;
    this.metadataDirty = false;

    return this.metadata;
  }

  /**
   * Sauvegarde les métadonnées du cache
   */
  async saveMetadata(metadata, options = {}) {
    const { flush = true } = options;

    this.metadata = metadata;
    this.metadataLoaded = true;
    this.metadataDirty = true;

    if (flush) {
      await this.flushMetadata();
    }
  }

  /**
   * Écrit les métadonnées sur disque si nécessaire
   */
  async flushMetadata() {
    if (!this.metadataLoaded || !this.metadataDirty) {
      return;
    }

    await fsPromises.mkdir(this.cacheDir, { recursive: true });
    await fsPromises.writeFile(
      this.metaFile,
      JSON.stringify(this.metadata, null, 2),
      'utf8'
    );

    this.metadataDirty = false;
  }

  /**
   * CORRIGÉ : Vérifie si un fichier cache est à jour par rapport au source
   */
  async isUpToDate(sourcePath, cachePath) {
    const debug = process.argv.includes('--debug');
    
    if (debug) {
      console.log(`🔍 Checking if up-to-date:`);
      console.log(`   Source: ${sourcePath}`);
      console.log(`   Cache:  ${cachePath}`);
    }

    try {
      // 1. Vérifier l'existence du fichier cache
      const cacheExists = await fsPromises.access(cachePath).then(() => true).catch(() => false);
      if (!cacheExists) {
        if (debug) console.log(`   ❌ Cache file doesn't exist`);
        return false;
      }

      // 2. Vérifier l'existence du fichier source
      const sourceExists = await fsPromises.access(sourcePath).then(() => true).catch(() => false);
      if (!sourceExists) {
        if (debug) console.log(`   ❌ Source file doesn't exist`);
        return false;
      }

      // 3. Charger les métadonnées et générer la clé de manière cohérente
      const metadata = await this.loadMetadata();
      const cacheKey = this.generateCacheKey(cachePath);
      const fileInfo = metadata.files[cacheKey];
      
      if (debug) {
        console.log(`   Cache key: "${cacheKey}"`);
        console.log(`   File info exists: ${!!fileInfo}`);
        if (fileInfo) {
          console.log(`   Stored UUID: ${fileInfo.uuid}`);
          console.log(`   Stored hash: ${fileInfo.source_hash?.substring(0, 8)}...`);
        }
      }

      // Si aucune métadonnée n'existe pour ce fichier, il doit être traité
      if (!fileInfo) {
        if (debug) console.log(`   ❌ No metadata found for this file`);
        return false;
      }

      // 4. Comparer les hash (méthode la plus fiable)
      const currentSourceHash = await this.calculateFileHash(sourcePath);
      if (!currentSourceHash) {
        if (debug) console.log(`   ❌ Cannot calculate source hash`);
        return false;
      }

      const isUpToDate = currentSourceHash === fileInfo.source_hash;
      
      if (debug) {
        console.log(`   Current hash:  ${currentSourceHash.substring(0, 8)}...`);
        console.log(`   Stored hash:   ${fileInfo.source_hash?.substring(0, 8)}...`);
        console.log(`   Up to date:    ${isUpToDate}`);
      }

      return isUpToDate;

    } catch (error) {
      if (debug) {
        console.log(`   ❌ Error during check: ${error.message}`);
      }
      // En cas d'erreur, on force la reconstruction pour être sûr
      return false;
    }
  }

  /**
   * CORRIGÉ : Sauvegarde un fichier dans le cache avec métadonnées
   */
  async save(cachePath, data) {
    const debug = process.argv.includes('--debug');
    
    // Créer le dossier de destination
    await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
    
    // Sauvegarder le JSON
    await fsPromises.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
    
    // Mettre à jour les métadonnées avec la clé cohérente
    const metadata = await this.loadMetadata();
    const cacheKey = this.generateCacheKey(cachePath);
    
    if (debug) {
      console.log(`💾 Saving cache metadata:`);
      console.log(`   Cache path: ${cachePath}`);
      console.log(`   Cache key:  "${cacheKey}"`);
      console.log(`   UUID: ${data.uuid}`);
      console.log(`   Source hash: ${data.source_hash?.substring(0, 8)}...`);
    }
    
    metadata.files[cacheKey] = {
      source_hash: data.source_hash,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at,
      uuid: data.uuid,
      title: data.title
    };
    
    await this.saveMetadata(metadata, { flush: false });
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
    
    await this.saveMetadata(metadata, { flush: false });
  }

  /**
   * NOUVEAU : Affiche l'état du cache pour debugging
   */
  async debugCacheState() {
    console.log('\n🔍 Cache Debug Information:');
    console.log(`Cache directory: ${this.cacheDir}`);
    
    const metadata = await this.loadMetadata();
    console.log(`\nMetadata file: ${this.metaFile}`);
    console.log(`Total cached files: ${Object.keys(metadata.files).length}`);
    console.log(`Last update: ${metadata.last_update}`);
    
    if (metadata.build_stats) {
      console.log(`\nLast build stats:`);
      console.log(`  Processed: ${metadata.build_stats.processed}`);
      console.log(`  Skipped: ${metadata.build_stats.skipped}`);
      console.log(`  Errors: ${metadata.build_stats.errors}`);
      console.log(`  Timestamp: ${metadata.build_stats.timestamp}`);
    }
    
    console.log('\nCached files (showing first 10):');
    const entries = Object.entries(metadata.files).slice(0, 10);
    for (const [cacheKey, fileInfo] of entries) {
      const fullCachePath = path.join(this.cacheDir, cacheKey);
      const exists = await fsPromises.access(fullCachePath).then(() => true).catch(() => false);
      
      console.log(`  ${cacheKey}`);
      console.log(`    UUID: ${fileInfo.uuid}`);
      console.log(`    Title: "${fileInfo.title}"`);
      console.log(`    Hash: ${fileInfo.source_hash?.substring(0, 8)}...`);
      console.log(`    Exists: ${exists}`);
      console.log(`    Updated: ${fileInfo.updated_at}`);
    }
    
    if (Object.keys(metadata.files).length > 10) {
      console.log(`  ... and ${Object.keys(metadata.files).length - 10} more files`);
    }
  }

  /**
   * AMÉLIORÉ : Nettoie les entrées obsolètes du cache
   */
  async cleanup() {
    console.log('🧹 Starting cache cleanup...');
    
    const metadata = await this.loadMetadata();
    const validFiles = {};
    let removedCount = 0;
    let invalidPathCount = 0;
    
    for (const [cacheKey, fileInfo] of Object.entries(metadata.files)) {
      // Vérifier si la clé de cache contient des chemins invalides
      if (cacheKey.includes('../') || path.isAbsolute(cacheKey)) {
        console.log(`   Removing invalid path: ${cacheKey}`);
        invalidPathCount++;
        continue;
      }
      
      const fullPath = path.join(this.cacheDir, cacheKey);
      const exists = await fsPromises.access(fullPath).then(() => true).catch(() => false);
      
      if (exists) {
        validFiles[cacheKey] = fileInfo;
      } else {
        console.log(`   Removing missing file: ${cacheKey}`);
        removedCount++;
      }
    }
    
    metadata.files = validFiles;
    metadata.total_exercises = Object.keys(validFiles).length;
    metadata.last_cleanup = new Date().toISOString();
    
    await this.saveMetadata(metadata);
    
    console.log(`✅ Cache cleanup completed:`);
    console.log(`   Invalid paths removed: ${invalidPathCount}`);
    console.log(`   Missing files removed: ${removedCount}`);
    console.log(`   Valid entries remaining: ${Object.keys(validFiles).length}`);
    
    return {
      invalidPaths: invalidPathCount,
      missingFiles: removedCount,
      validEntries: Object.keys(validFiles).length
    };
  }

  /**
   * Récupère les statistiques du cache
   */
  async getStats() {
    const metadata = await this.loadMetadata();
    
    return {
      totalFiles: Object.keys(metadata.files).length,
      lastUpdate: metadata.last_update,
      lastCleanup: metadata.last_cleanup || null,
      version: metadata.version,
      buildStats: metadata.build_stats || null
    };
  }

  /**
   * Trouve tous les fichiers cache pour un pattern donné
   */
  async findCacheFiles(pattern = '**/*.json') {
    try {
      const glob = await import('glob');
      const cacheFiles = await glob.glob(pattern, { cwd: this.cacheDir });
      
      return cacheFiles.map(file => ({
        path: path.join(this.cacheDir, file),
        relativePath: file
      }));
    } catch (error) {
      console.warn(`Cannot search cache files: ${error.message}`);
      return [];
    }
  }

  /**
   * Valide l'intégrité de tout le cache
   */
  async validateIntegrity() {
    const metadata = await this.loadMetadata();
    const issues = [];
    let checkedFiles = 0;
    
    console.log('🔧 Validating cache integrity...');
    
    for (const [cacheKey, fileInfo] of Object.entries(metadata.files)) {
      const fullPath = path.join(this.cacheDir, cacheKey);
      checkedFiles++;
      
      try {
        const data = await this.load(fullPath);
        
        if (!data) {
          issues.push(`Cannot read cache file ${cacheKey}`);
          continue;
        }
        
        // Vérifier cohérence UUID
        if (data.uuid !== fileInfo.uuid) {
          issues.push(`UUID mismatch in ${cacheKey}: ${data.uuid} vs ${fileInfo.uuid}`);
        }
        
        // Vérifier hash source si disponible
        if (data.source_hash && data.source_hash !== fileInfo.source_hash) {
          issues.push(`Source hash mismatch in ${cacheKey}`);
        }
        
        // Vérifier structure des données
        if (!data.title || !data.content || !Array.isArray(data.content)) {
          issues.push(`Invalid data structure in ${cacheKey}`);
        }
        
      } catch (error) {
        issues.push(`Error reading cache file ${cacheKey}: ${error.message}`);
      }
      
      // Afficher progression pour de gros caches
      if (checkedFiles % 100 === 0) {
        console.log(`   Checked ${checkedFiles} files...`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues: issues,
      totalFiles: Object.keys(metadata.files).length,
      checkedFiles: checkedFiles
    };
  }

  /**
   * NOUVEAU : Répare automatiquement les problèmes de cache détectés
   */
  async repair() {
    console.log('🔧 Starting cache repair...');
    
    // 1. Nettoyer d'abord
    const cleanupStats = await this.cleanup();
    
    // 2. Valider l'intégrité
    const integrity = await this.validateIntegrity();
    
    if (integrity.valid) {
      console.log('✅ Cache is healthy after cleanup');
      return {
        repaired: true,
        cleanupStats,
        integrityIssues: 0
      };
    }
    
    // 3. Essayer de réparer les problèmes
    console.log(`⚠️  Found ${integrity.issues.length} integrity issues`);
    
    const metadata = await this.loadMetadata();
    const repairedFiles = {};
    let repairedCount = 0;
    
    for (const [cacheKey, fileInfo] of Object.entries(metadata.files)) {
      const fullPath = path.join(this.cacheDir, cacheKey);
      
      try {
        const data = await this.load(fullPath);
        if (data && data.uuid && data.title) {
          // Le fichier semble valide, le garder
          repairedFiles[cacheKey] = {
            ...fileInfo,
            uuid: data.uuid, // Utiliser l'UUID du fichier plutôt que des métadonnées
            title: data.title,
            source_hash: data.source_hash || fileInfo.source_hash
          };
        } else {
          console.log(`   Removing corrupted entry: ${cacheKey}`);
          repairedCount++;
        }
      } catch (error) {
        console.log(`   Removing unreadable entry: ${cacheKey}`);
        repairedCount++;
      }
    }
    
    // Sauvegarder les métadonnées réparées
    metadata.files = repairedFiles;
    metadata.total_exercises = Object.keys(repairedFiles).length;
    metadata.last_repair = new Date().toISOString();
    
    await this.saveMetadata(metadata);
    
    console.log(`✅ Cache repair completed:`);
    console.log(`   Corrupted entries removed: ${repairedCount}`);
    console.log(`   Valid entries remaining: ${Object.keys(repairedFiles).length}`);
    
    return {
      repaired: true,
      cleanupStats,
      integrityIssues: integrity.issues.length,
      repairedEntries: repairedCount,
      validEntries: Object.keys(repairedFiles).length
    };
  }
}
