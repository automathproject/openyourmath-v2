// scripts/build-db.mjs
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fsPromises = fs.promises;

/**
 * Configuration simple
 */
const CACHE_DIR = path.resolve(__dirname, '../cache/exercises');
const DB_PATH = path.resolve(__dirname, '../data/exercises.sqlite');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql'); 

/**
 * Trouve tous les fichiers JSON dans le cache
 */
async function findJsonFiles(dir) {
  const files = [];
  
  async function scan(currentDir) {
    const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== '.cache-meta.json') {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}

/**
 * Extrait le texte pour la recherche FTS5
 */
function extractSearchText(contentArray) {
  if (!Array.isArray(contentArray)) return '';
  
  return contentArray
    .map(block => {
      const html = block.html || '';
      const latex = block.latex || '';
      
      // Nettoyer le HTML (supprimer tags, garder texte)
      const cleanHtml = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return `${cleanHtml} ${latex}`.trim();
    })
    .join(' ');
}

/**
 * Crée et initialise la base de données
 */
function createDatabase(dbPath) {
  // Créer le dossier si nécessaire
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  // Lire le fichier de schéma SQL
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  
  // Exécuter tout le script de création en une seule fois
  db.exec(schema);

  return db;
}

/**
 * Charge tous les exercices depuis le cache
 */
async function loadExercises(cacheDir) {
  const jsonFiles = await findJsonFiles(cacheDir);
  const exercises = [];
  
  console.log(`📄 Found ${jsonFiles.length} JSON files`);
  
  for (const filePath of jsonFiles) {
    try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Validation simple
      if (!data.uuid || !data.title || !data.chapter || !Array.isArray(data.content)) {
        console.warn(`⚠️  Invalid exercise in ${path.basename(filePath)}`);
        continue;
      }
      
      exercises.push(data);
      
    } catch (error) {
      console.error(`❌ Error reading ${path.basename(filePath)}: ${error.message}`);
    }
  }
  
  return exercises;
}

/**
 * Insère les exercices dans la base
 */
function insertExercises(db, exercises) {
  console.log(`💾 Inserting ${exercises.length} exercises...`);
  
  // Préparer les requêtes
  const insertExercise = db.prepare(`
    INSERT OR REPLACE INTO exercises (
      uuid, title, chapter, subchapter, theme, difficulty,
      author, organization, video_id, created_at, updated_at,
      content_json, source_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertFTS = db.prepare(`
    INSERT OR REPLACE INTO fts_exercises (uuid, title, theme, chapter, content_text)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  // Transaction pour la performance
  const transaction = db.transaction((exercises) => {
    let count = 0;
    
    for (const exercise of exercises) {
      try {
        // Insérer dans la table principale
        insertExercise.run(
          exercise.uuid,
          exercise.title,
          exercise.chapter,
          exercise.subchapter || null,
          exercise.theme || null,
          exercise.difficulty || null,
          exercise.author || null,
          exercise.organization || null,
          exercise.video_id || null,
          exercise.created_at || new Date().toISOString(),
          exercise.updated_at || new Date().toISOString(),
          JSON.stringify(exercise.content),
          exercise.source_hash || null
        );
        
        // Insérer dans FTS5 pour la recherche
        const searchText = extractSearchText(exercise.content);
        insertFTS.run(
          exercise.uuid,
          exercise.title,
          exercise.theme || '',
          exercise.chapter,
          searchText
        );
        
        count++;
        
      } catch (error) {
        console.error(`❌ Failed to insert ${exercise.uuid}: ${error.message}`);
      }
    }
    
    return count;
  });
  
  const inserted = transaction(exercises);
  console.log(`✅ Inserted ${inserted} exercises`);
  
  return inserted;
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 OpenYourMath V2 - Database Builder');
  console.log(`📁 Cache: ${CACHE_DIR}`);
  console.log(`💾 Database: ${DB_PATH}`);
  console.log('');
  
  try {
    // Vérifier que le cache existe
    if (!fs.existsSync(CACHE_DIR)) {
      throw new Error(`Cache directory not found: ${CACHE_DIR}`);
    }

      if (fs.existsSync(DB_PATH)) {
    console.log('🔥 Deleting existing database...');
    fs.unlinkSync(DB_PATH);
  }
    
    // Créer la base de données
    console.log('📚 Creating database...');
    const db = createDatabase(DB_PATH);
    
    try {
      // Charger les exercices
      console.log('📖 Loading exercises...');
      const exercises = await loadExercises(CACHE_DIR);
      
      if (exercises.length === 0) {
        console.warn('⚠️  No valid exercises found!');
        process.exit(1);
      }
      
      // Insérer en base
      const inserted = insertExercises(db, exercises);
      
      // Optimiser FTS5
      console.log('🔧 Optimizing search index...');
      db.exec("INSERT INTO fts_exercises(fts_exercises) VALUES('optimize')");
      
      // Statistiques finales
      const total = db.prepare('SELECT COUNT(*) as count FROM exercises').get().count;
      const chapters = db.prepare('SELECT COUNT(DISTINCT chapter) as count FROM exercises').get().count;
      const size = (fs.statSync(DB_PATH).size / 1024).toFixed(1);
      
      console.log('\n📊 Results:');
      console.log(`✅ ${total} exercises in database`);
      console.log(`📖 ${chapters} different chapters`);
      console.log(`💾 Database size: ${size} KB`);
      console.log('\n🎉 Database build completed!');
      
    } finally {
      db.close();
    }
    
  } catch (error) {
    console.error('💥 Build failed:', error.message);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { createDatabase, loadExercises, insertExercises };