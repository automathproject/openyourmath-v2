// scripts/build-images.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fsPromises = fs.promises;

const ARTIFACTS_DIR = path.resolve(__dirname, '../static/artifacts');
const ARTIFACTS_IMAGES_DIR = path.join(ARTIFACTS_DIR, 'images');

/**
 * Trouve tous les fichiers JSON d'artifacts
 */
async function findArtifactFiles() {
  const files = [];
  const entries = await fsPromises.readdir(ARTIFACTS_DIR);
  
  for (const entry of entries) {
    if (entry.endsWith('.json')) {
      files.push(path.join(ARTIFACTS_DIR, entry));
    }
  }
  
  return files;
}

/**
 * Vérifie si pdftoppm est disponible
 */
function checkPdftoppm() {
  try {
    execSync('pdftoppm -v', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convertit un PDF en PNG avec pdftoppm
 */
async function convertPdfToPng(pdfPath, outputPath, dpi = 300) {
  const outputBase = outputPath.replace('.png', '');
  
  try {
    // -singlefile : une seule page (première page du PDF)
    // -png : format de sortie
    // -r : résolution en DPI
    execSync(`pdftoppm -singlefile -png -r ${dpi} "${pdfPath}" "${outputBase}"`, {
      stdio: 'pipe'
    });
    
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to convert ${path.basename(pdfPath)}:`, error.message);
    return false;
  }
}

/**
 * Traite un fichier d'artifacts
 */
async function processArtifactFile(artifactPath) {
  const uuid = path.basename(artifactPath, '.json');
  const imagesDir = path.join(ARTIFACTS_IMAGES_DIR, uuid);
  
  // Lire le fichier artifacts
  const content = await fsPromises.readFile(artifactPath, 'utf8');
  const artifacts = JSON.parse(content);
  
  if (!artifacts.images || artifacts.images.length === 0) {
    return { uuid, converted: 0, skipped: 0 };
  }
  
  console.log(`\n📄 Processing ${uuid} (${artifacts.images.length} images)`);
  
  let converted = 0;
  let skipped = 0;
  let modified = false;
  
  for (const image of artifacts.images) {
    if (image.format !== 'pdf') {
      skipped++;
      continue;
    }
    
    // Chemins
    const pdfPath = path.join(ARTIFACTS_DIR, '..', image.url); // /artifacts/images/{uuid}/img_1.pdf
    const pngFilename = image.id + '.png';
    const pngPath = path.join(imagesDir, pngFilename);
    const pngUrl = `/artifacts/images/${uuid}/${pngFilename}`;
    
    // Vérifier si le PDF existe
    if (!fs.existsSync(pdfPath)) {
      console.warn(`  ⚠️  PDF not found: ${pdfPath}`);
      skipped++;
      continue;
    }
    
    // Vérifier si le PNG existe déjà et est plus récent
    if (fs.existsSync(pngPath)) {
      const pdfStat = await fsPromises.stat(pdfPath);
      const pngStat = await fsPromises.stat(pngPath);
      
      if (pngStat.mtime > pdfStat.mtime) {
        console.log(`  ⏭️  Already converted: ${image.id}.pdf → ${pngFilename}`);
        // Mettre à jour l'URL même si déjà converti
        if (image.url !== pngUrl) {
          image.url = pngUrl;
          image.format = 'png';
          modified = true;
        }
        skipped++;
        continue;
      }
    }
    
    // Convertir
    console.log(`  🔄 Converting: ${image.id}.pdf → ${pngFilename}`);
    const success = await convertPdfToPng(pdfPath, pngPath);
    
    if (success) {
      // Mettre à jour les métadonnées
      image.url = pngUrl;
      image.format = 'png';
      image.sourceFormat = 'pdf'; // Garder trace de l'origine
      modified = true;
      converted++;
      console.log(`  ✅ Converted: ${pngFilename}`);
    } else {
      skipped++;
    }
  }
  
  // Sauvegarder le fichier artifacts modifié
  if (modified) {
    await fsPromises.writeFile(artifactPath, JSON.stringify(artifacts, null, 2), 'utf8');
    console.log(`  💾 Updated artifact file`);
  }
  
  return { uuid, converted, skipped };
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 OpenYourMath V2 - Image Builder');
  console.log(`📁 Artifacts: ${ARTIFACTS_DIR}\n`);
  
  // Vérifier que pdftoppm est disponible
  if (!checkPdftoppm()) {
    console.error('❌ pdftoppm not found!');
    console.error('   Install with: sudo apt-get install poppler-utils');
    process.exit(1);
  }
  
  console.log('✅ pdftoppm available\n');
  
  try {
    // Trouver tous les fichiers d'artifacts
    const artifactFiles = await findArtifactFiles();
    console.log(`📋 Found ${artifactFiles.length} artifact files\n`);
    
    if (artifactFiles.length === 0) {
      console.log('ℹ️  No artifact files to process');
      return;
    }
    
    // Traiter chaque fichier
    const results = [];
    for (const file of artifactFiles) {
      try {
        const result = await processArtifactFile(file);
        results.push(result);
      } catch (error) {
        console.error(`❌ Error processing ${path.basename(file)}:`, error.message);
      }
    }
    
    // Statistiques finales
    const totalConverted = results.reduce((sum, r) => sum + r.converted, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    
    console.log('\n📊 Summary:');
    console.log(`✅ Converted: ${totalConverted} PDF images`);
    console.log(`⏭️  Skipped: ${totalSkipped} images`);
    console.log(`📁 Processed: ${results.length} exercises`);
    console.log('\n🎉 Image build completed!');
    
  } catch (error) {
    console.error('💥 Build failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { convertPdfToPng, processArtifactFile };
