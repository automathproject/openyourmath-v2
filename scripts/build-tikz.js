// scripts/build-tikz.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertTikzToSVG, defaultConfig } from './utils/tikz2svg-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fsPromises = fs.promises;

// --- Configuration des chemins ---
const PROJECT_ROOT = path.resolve(__dirname, '..');
// Le répertoire où se trouvent les fichiers uuid.json des artéfacts
const ARTIFACTS_JSON_DIR = path.join(PROJECT_ROOT, 'static/artifacts');
// La racine du site statique, utilisée pour résoudre les URLs publiques
const STATIC_ROOT_DIR = path.join(PROJECT_ROOT, 'static');

/**
 * Traite un unique fichier JSON d'artéfacts.
 * @param {string} jsonFilePath - Le chemin complet vers le fichier uuid.json
 * @returns {Promise<{compiled: number, errors: number}>} - Statistiques de compilation pour ce fichier.
 */
async function processArtifactFile(jsonFilePath) {
  let compiledCount = 0;
  let errorCount = 0;

  console.log(`\n📄 Processing artifact file: ${path.basename(jsonFilePath)}`);

  try {
    const fileContent = await fsPromises.readFile(jsonFilePath, 'utf8');
    const artifactData = JSON.parse(fileContent);

    if (!artifactData.tikz || artifactData.tikz.length === 0) {
      console.log('   -> No TikZ artifacts to process.');
      return { compiled: 0, errors: 0 };
    }

    // Traiter toutes les compilations TikZ pour ce fichier en parallèle
    const updatePromises = artifactData.tikz.map(async (tikzObject) => {
      console.log(`   -> 🎨 Compiling: ${tikzObject.id}`);

      try {
        // 1. Compiler le code LaTeX en SVG
        // L'utilitaire gère déjà les erreurs en créant un SVG d'erreur, donc il ne devrait pas planter ici.
        const svgContent = await convertTikzToSVG(tikzObject.latex, defaultConfig);

        // 2. Déterminer le chemin de sortie pour le fichier SVG
        // L'URL est relative à la racine web (ex: /artifacts/tikz/uuid.svg)
        // On la résout par rapport à la racine du dossier statique.
        const svgOutputPath = path.join(STATIC_ROOT_DIR, tikzObject.url);

        // S'assurer que le dossier de destination existe
        await fsPromises.mkdir(path.dirname(svgOutputPath), { recursive: true });

        // 3. Écrire le fichier SVG
        await fsPromises.writeFile(svgOutputPath, svgContent, 'utf8');

        // 4. Mettre à jour l'objet en mémoire avec le contenu SVG
        tikzObject.svg = svgContent;
        compiledCount++;

      } catch (error) {
        console.error(`❌ ERROR compiling ${tikzObject.id} in ${path.basename(jsonFilePath)}: ${error.message}`);
        // Même en cas d'erreur, l'utilitaire peut fournir un SVG d'erreur.
        // On le met à jour s'il existe dans l'objet d'erreur.
        if (error.svg) {
          tikzObject.svg = error.svg;
        }
        errorCount++;
      }
    });

    // Attendre que toutes les compilations pour ce fichier soient terminées
    await Promise.all(updatePromises);

    // 5. Réécrire le fichier JSON mis à jour avec le contenu SVG
    await fsPromises.writeFile(jsonFilePath, JSON.stringify(artifactData, null, 2), 'utf8');
    console.log(`   -> ✅ Updated ${path.basename(jsonFilePath)}`);

    return { compiled: compiledCount, errors: errorCount };

  } catch (error) {
    console.error(`❌ Failed to process file ${jsonFilePath}:`, error.message);
    return { compiled: 0, errors: 1 }; // Compte le fichier entier comme une erreur
  }
}

/**
 * Lit les UUID ciblés depuis la ligne de commande.
 * Sans option, la compilation conserve son comportement global.
 *
 * @param {string[]} args
 * @returns {string[]}
 */
export function parseUuidArgs(args) {
  const uuids = [];

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--uuid') {
      const uuid = args[++index];
      if (!uuid || uuid.startsWith('-')) throw new Error('Usage : build:tikz [--uuid <uuid>]');
      uuids.push(uuid);
      continue;
    }

    if (argument.startsWith('--uuid=')) {
      const uuid = argument.slice('--uuid='.length);
      if (!uuid) throw new Error('Usage : build:tikz [--uuid <uuid>]');
      uuids.push(uuid);
      continue;
    }

    throw new Error(`Option inconnue : ${argument}`);
  }

  return [...new Set(uuids)];
}

/**
 * Point d'entrée principal du script.
 */
async function main() {
  const uuids = parseUuidArgs(process.argv.slice(2));
  console.log('🚀 Starting TikZ to SVG compilation process...');
  console.log(`🔍 Scanning for artifact files in: ${ARTIFACTS_JSON_DIR}`);

  const stats = {
    filesProcessed: 0,
    tikzCompiled: 0,
    totalErrors: 0,
  };

  try {
    const entries = await fsPromises.readdir(ARTIFACTS_JSON_DIR, { withFileTypes: true });
    const allJsonFiles = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => path.join(ARTIFACTS_JSON_DIR, entry.name));
    const jsonFiles = uuids.length === 0
      ? allJsonFiles
      : allJsonFiles.filter(filePath => uuids.includes(path.basename(filePath, '.json')));

    const foundUuids = new Set(jsonFiles.map(filePath => path.basename(filePath, '.json')));
    const missingUuids = uuids.filter(uuid => !foundUuids.has(uuid));
    if (missingUuids.length > 0) {
      throw new Error(`Artefact(s) introuvable(s) : ${missingUuids.join(', ')}`);
    }

    if (jsonFiles.length === 0) {
      console.log('No artifact JSON files found. Nothing to do.');
      return;
    }

    if (uuids.length > 0) console.log(`🎯 UUID ciblé(s) : ${uuids.join(', ')}`);
    console.log(`Found ${jsonFiles.length} artifact file(s) to process.`);

    for (const file of jsonFiles) {
      const result = await processArtifactFile(file);
      stats.filesProcessed++;
      stats.tikzCompiled += result.compiled;
      stats.totalErrors += result.errors;
    }

    console.log('\n\n📊--- Compilation Summary ---');
    console.log(`✅ Files Processed: ${stats.filesProcessed}`);
    console.log(`🎨 TikZ Compiled:   ${stats.tikzCompiled}`);
    console.log(`❌ Errors:          ${stats.totalErrors}`);
    console.log('-----------------------------\n');

    if (stats.totalErrors > 0) {
      console.log('⚠️  Compilation finished with errors.');
      process.exit(1);
    } else {
      console.log('✨ Compilation finished successfully!');
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: The directory does not exist: ${ARTIFACTS_JSON_DIR}`);
    } else {
      console.error('💥 A fatal error occurred:', error);
    }
    process.exit(1);
  }
}

// Exécution si appelé directement
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error('💥 An unexpected error occurred in main:', error);
    process.exitCode = 1;
  });
}
