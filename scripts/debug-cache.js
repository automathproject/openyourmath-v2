#!/usr/bin/env node
// scripts/debug-cache.js - Script de debug du cache
import { CacheManager } from './utils/cache-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const command = process.argv[2];
  const cacheDir = process.argv[3] || path.resolve(__dirname, '../cache/exercises');
  const cm = new CacheManager(cacheDir);
  
  console.log('🔍 OpenYourMath V2 - Cache Management Tool');
  console.log('==========================================\n');
  
  try {
    switch (command) {
      case 'debug':
      case 'status':
        await cm.debugCacheState();
        break;
        
      case 'cleanup':
        await cm.cleanup();
        break;
        
      case 'validate':
        console.log('🔧 Validating cache integrity...');
        const integrity = await cm.validateIntegrity();
        
        if (integrity.valid) {
          console.log('✅ Cache integrity: OK');
        } else {
          console.log('❌ Cache integrity issues found:');
          integrity.issues.slice(0, 10).forEach(issue => console.log(`   - ${issue}`));
          if (integrity.issues.length > 10) {
            console.log(`   ... and ${integrity.issues.length - 10} more issues`);
          }
        }
        break;
        
      case 'repair':
        const repairResult = await cm.repair();
        console.log('\n📊 Repair Summary:');
        console.log(`   Cleanup - Invalid paths: ${repairResult.cleanupStats.invalidPaths}`);
        console.log(`   Cleanup - Missing files: ${repairResult.cleanupStats.missingFiles}`);
        console.log(`   Repair - Corrupted entries: ${repairResult.repairedEntries || 0}`);
        console.log(`   Final - Valid entries: ${repairResult.validEntries}`);
        break;
        
      case 'stats':
        console.log('📊 Cache Statistics:');
        const stats = await cm.getStats();
        console.log(`   Total files: ${stats.totalFiles}`);
        console.log(`   Last update: ${stats.lastUpdate || 'Never'}`);
        console.log(`   Last cleanup: ${stats.lastCleanup || 'Never'}`);
        console.log(`   Version: ${stats.version}`);
        
        if (stats.buildStats) {
          console.log(`\n   Last build: ${stats.buildStats.timestamp}`);
          console.log(`   - Processed: ${stats.buildStats.processed}`);
          console.log(`   - Skipped: ${stats.buildStats.skipped}`);
          console.log(`   - Errors: ${stats.buildStats.errors}`);
        }
        break;
        
      default:
        console.log('Usage: node scripts/debug-cache.js <command> [cache-dir]');
        console.log('');
        console.log('Commands:');
        console.log('  debug     - Show detailed cache state');
        console.log('  status    - Same as debug');
        console.log('  cleanup   - Remove invalid entries');
        console.log('  validate  - Check cache integrity');
        console.log('  repair    - Cleanup + validate + fix issues');
        console.log('  stats     - Show cache statistics');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/debug-cache.js debug');
        console.log('  node scripts/debug-cache.js repair');
        console.log('  node scripts/debug-cache.js cleanup cache/exercises');
        break;
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
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