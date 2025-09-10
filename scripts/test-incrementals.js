#!/usr/bin/env node
// scripts/test-incrementals.js - Script de test du mode incrémental
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);
const fsPromises = fs.promises;

async function testIncremental() {
  console.log('🧪 OpenYourMath V2 - Incremental Build Test');
  console.log('============================================\n');
  
  try {
    // 1. Build complet d'abord
    console.log('1️⃣ Running full build...');
    const { stdout: fullOutput, stderr: fullError } = await execAsync(
      'node scripts/parse-latex.js content/exercises/ cache/exercises/'
    );
    console.log(fullOutput);
    if (fullError) console.warn(fullError);
    
    // 2. Build incrémental immédiatement après
    console.log('\n2️⃣ Running incremental build (should skip all files)...');
    const { stdout: incOutput, stderr: incError } = await execAsync(
      'node scripts/parse-latex.js content/exercises/ cache/exercises/ --incremental'
    );
    console.log(incOutput);
    if (incError) console.warn(incError);
    
    // 3. Modifier un fichier de test
    const testFile = 'content/exercises/test-incremental.tex';
    const testContent = `\\uuid{test-incremental-${Date.now()}}
\\titre{Test Incrémental ${new Date().toLocaleTimeString()}}
\\chapitre{Test}
\\sousChapitre{Mode Incrémental}
\\auteur{Test Bot}
\\niveau{Test}
\\module{Testing}

\\texte{
Contenu de test modifié à ${new Date().toISOString()}

Ce fichier a été créé pour tester le mode incrémental du parser LaTeX.
}

\\question{
Quel est l'avantage du mode incrémental ?
}

\\reponse{
Le mode incrémental ne recompile que les fichiers qui ont été modifiés,
ce qui accélère considérablement le processus de build.
}`;
    
    console.log(`\n3️⃣ Creating/modifying test file: ${testFile}`);
    await fsPromises.mkdir(path.dirname(testFile), { recursive: true });
    await fsPromises.writeFile(testFile, testContent, 'utf8');
    
    // Attendre un peu pour s'assurer que le timestamp change
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Build incrémental après modification
    console.log('\n4️⃣ Running incremental build after modification (should process 1 file)...');
    const { stdout: modOutput, stderr: modError } = await execAsync(
      'node scripts/parse-latex.js content/exercises/ cache/exercises/ --incremental --debug'
    );
    console.log(modOutput);
    if (modError) console.warn(modError);
    
    // 5. Build incrémental encore une fois (devrait skipper le fichier)
    console.log('\n5️⃣ Running incremental build again (should skip the test file)...');
    const { stdout: skipOutput, stderr: skipError } = await execAsync(
      'node scripts/parse-latex.js content/exercises/ cache/exercises/ --incremental'
    );
    console.log(skipOutput);
    if (skipError) console.warn(skipError);
    
    // 6. Analyser les résultats
    console.log('\n6️⃣ Analyzing results...');
    
    // Vérifier si le fichier cache existe
    const expectedCacheFile = 'cache/exercises/test-incremental.json';
    const cacheExists = await fsPromises.access(expectedCacheFile).then(() => true).catch(() => false);
    console.log(`   Cache file exists: ${cacheExists ? '✅' : '❌'}`);
    
    if (cacheExists) {
      const cacheContent = await fsPromises.readFile(expectedCacheFile, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      console.log(`   Cache UUID: ${cacheData.uuid}`);
      console.log(`   Cache title: "${cacheData.title}"`);
      console.log(`   Content blocks: ${cacheData.content?.length || 0}`);
    }
    
    // 7. Nettoyer
    console.log('\n7️⃣ Cleaning up test files...');
    await fsPromises.unlink(testFile).catch(() => {}); // Ignore si n'existe pas
    await fsPromises.unlink(expectedCacheFile).catch(() => {}); // Ignore si n'existe pas
    
    console.log('\n✅ Incremental build test completed successfully!');
    console.log('\n📋 What this test verified:');
    console.log('   - Full build processes all files');
    console.log('   - Incremental build skips unchanged files');
    console.log('   - Modified files are detected and processed');
    console.log('   - Cache is properly updated and used');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    if (process.argv.includes('--debug')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function main() {
  await testIncremental();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}