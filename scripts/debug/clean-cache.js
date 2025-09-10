#!/usr/bin/env node
// scripts/debug/clean-cache.js
import { CacheManager } from '../utils/cache-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fsPromises = fs.promises;

async function main() {
  const cacheDir = process.argv[2] || path.resolve(__dirname, '../../cache/exercises');
  const cm = new CacheManager(cacheDir);
  
  console.log('🧹 OpenYourMath V2 - Cache Cleanup Tool');
  console.log('=======================================\n');
  
  try {
    // 1. Charger les métadonnées actuelles
    const metadata = await cm.loadMetadata();
    const oldCount = Object.keys(metadata.files).length;
    
    console.log(`📊 Current cache state:`);
    console.log(`   Total entries: ${oldCount}`);
    
    // 2. Analyser les problèmes
    const problems = {
      nonExistent: [],
      invalidPaths: [],
      duplicates: new Map()
    };
    
    for (const [cacheKey, fileInfo] of Object.entries(metadata.files)) {
      const fullPath = path.join(cacheDir, cacheKey);
      const exists = await fsPromises.access(fullPath).then(() => true).catch(() => false);
      
      if (!exists) {
        problems.nonExistent.push(cacheKey);
      }
      
      // Détecter les chemins invalides (contenant ../ ou des chemins absolus)
      if (cacheKey.includes('../') || path.isAbsolute(cacheKey)) {
        problems.invalidPaths.push(cacheKey);
      }
      
      // Détecter les doublons basés sur l'UUID
      const uuid = fileInfo.uuid;
      if (problems.duplicates.has(uuid)) {
        problems.duplicates.get(uuid).push(cacheKey);
      } else {
        problems.duplicates.set(uuid, [cacheKey]);
      }
    }
    
    // Filtrer les vrais doublons (plus d'une entrée par UUID)
    const realDuplicates = new Map();
    for (const [uuid, entries] of problems.duplicates) {
      if (entries.length > 1) {
        realDuplicates.set(uuid, entries);
      }
    }
    
    console.log(`\n🔍 Problems detected:`);
    console.log(`   Non-existent files: ${problems.nonExistent.length}`);
    console.log(`   Invalid paths: ${problems.invalidPaths.length}`);
    console.log(`   Duplicate UUIDs: ${realDuplicates.size}`);
    
    // 3. Afficher les détails des problèmes
    if (problems.nonExistent.length > 0) {
      console.log(`\n❌ Non-existent cache files:`);
      problems.nonExistent.slice(0, 5).forEach(key => console.log(`   - ${key}`));
      if (problems.nonExistent.length > 5) {
        console.log(`   ... and ${problems.nonExistent.length - 5} more`);
      }
    }
    
    if (problems.invalidPaths.length > 0) {
      console.log(`\n⚠️  Invalid cache paths:`);
      problems.invalidPaths.forEach(key => console.log(`   - ${key}`));
    }
    
    if (realDuplicates.size > 0) {
      console.log(`\n🔄 Duplicate UUIDs:`);
      for (const [uuid, entries] of Array.from(realDuplicates).slice(0, 3)) {
        console.log(`   UUID ${uuid}:`);
        entries.forEach(entry => console.log(`     - ${entry}`));
      }
      if (realDuplicates.size > 3) {
        console.log(`   ... and ${realDuplicates.size - 3} more duplicates`);
      }
    }
    
    // 4. Proposer le nettoyage
    console.log(`\n🤔 Cleanup strategy:`);
    
    // Construire la nouvelle structure propre
    const cleanMetadata = {
      version: "1.0.0",
      last_update: new Date().toISOString(),
      total_exercises: 0,
      hash_algorithm: "sha256",
      files: {}
    };
    
    let keptEntries = 0;
    const keptUUIDs = new Set();
    
    for (const [cacheKey, fileInfo] of Object.entries(metadata.files)) {
      const fullPath = path.join(cacheDir, cacheKey);
      const exists = await fsPromises.access(fullPath).then(() => true).catch(() => false);
      
      // Conditions pour garder une entrée :
      // 1. Le fichier existe
      // 2. Le chemin est valide (pas de ../, pas absolu)
      // 3. Ne pas garder les doublons (premier rencontré)
      const isPathValid = !cacheKey.includes('../') && !path.isAbsolute(cacheKey);
      const isDuplicate = keptUUIDs.has(fileInfo.uuid);
      
      if (exists && isPathValid && !isDuplicate) {
        cleanMetadata.files[cacheKey] = fileInfo;
        keptEntries++;
        keptUUIDs.add(fileInfo.uuid);
      }
    }
    
    cleanMetadata.total_exercises = keptEntries;
    
    console.log(`\n✅ Summary:`);
    console.log(`   Kept entries: ${keptEntries}`);
    console.log(`   Removed entries: ${oldCount - keptEntries}`);
    
    // 5. Demander confirmation avant d'écraser les métadonnées
    if (process.argv.includes('--apply')) {
      await cm.saveMetadata(cleanMetadata);
      console.log('\n💾 Metadata updated.');
    } else {
      console.log('\nℹ️  Dry-run mode. Use --apply to write changes.');
    }
    
  } catch (error) {
    console.error('💥 Error during cleanup:', error.message);
    if (process.argv.includes('--debug')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

