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
  
  function cleanLatex(latex) {
    if (!latex) return '';
    
    let text = latex
      // Nettoyer mise en forme
      .replace(/\\textbf\{([^}]+)\}/g, '$1')
      .replace(/\\textit\{([^}]+)\}/g, '$1') 
      .replace(/\\emph\{([^}]+)\}/g, '$1')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      // Nettoyer math
      .replace(/\$\$([^$]+)\$\$/g, ' $1 ')
      .replace(/\$([^$]+)\$/g, ' $1 ')
      .replace(/\\\\?\[([^\]]+)\\\\?\]/g, ' $1 ')
      .replace(/\\\\?\(([^)]+)\\\\?\)/g, ' $1 ')
      // Simplifier notations
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 sur $2')
      .replace(/\\sqrt\{([^}]+)\}/g, 'racine de $1')
      .replace(/\^{([^}]+)}/g, ' puissance $1')
      .replace(/\^(\w)/g, ' puissance $1')
      .replace(/_\{([^}]+)\}/g, ' indice $1')
      .replace(/_(\w)/g, ' indice $1')
      // Supprimer environnements
      .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, ' ')
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ')
      .replace(/[{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text;
  }
  
  return contentArray
    .map(block => block.latex ? cleanLatex(block.latex) : '')
    .filter(text => text.trim() !== '')
    .join(' ');
}

/**
 * Nettoie le texte de preview pour la recherche FTS5
 */
function cleanPreviewForSearch(preview) {
  if (!preview) return '';
  
  // Nettoyer le HTML de la preview (supprimer tags, garder texte)
  return preview
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Crée et initialise la base de données
 */
function createDatabase(dbPath) {
  // Créer le dossier si nécessaire
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  try {
    // Vérifier que FTS5 est disponible avec plusieurs méthodes
    console.log('🔍 Checking FTS5 support...');
    let ftsSupported = false;
    
    try {
      // Méthode 1: Tester fts5_version()
      const ftsCheck = db.prepare("SELECT fts5_version()").get();
      console.log('✅ FTS5 version:', ftsCheck['fts5_version()']);
      ftsSupported = true;
    } catch (error) {
      console.log('⚠️ fts5_version() failed:', error.message);
      
      try {
        // Méthode 2: Tester la création d'une table FTS5
        db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS test_fts USING fts5(content)");
        db.exec("DROP TABLE test_fts");
        console.log('✅ FTS5 table creation successful');
        ftsSupported = true;
      } catch (error2) {
        console.log('⚠️ FTS5 table creation failed:', error2.message);
        console.warn('⚠️ FTS5 not available, falling back to standard tables');
        ftsSupported = false;
      }
    }
    
    // Afficher des infos de debug sur better-sqlite3
    console.log('📋 Database info:');
    try {
      const version = db.prepare("SELECT sqlite_version()").get();
      console.log('   SQLite version:', version['sqlite_version()']);
    } catch (e) {
      console.log('   Could not get SQLite version');
    }
    
    // Lire le fichier de schéma SQL
    let schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Si FTS5 n'est pas supporté, remplacer par une table normale
    if (!ftsSupported) {
      console.log('📋 Using fallback schema without FTS5...');
      schema = schema.replace(
        /CREATE VIRTUAL TABLE IF NOT EXISTS fts_exercises USING fts5\([^)]+\);/,
        `CREATE TABLE IF NOT EXISTS fts_exercises (
          uuid TEXT,
          title TEXT,
          theme TEXT,
          chapter TEXT,
          module TEXT,
          level TEXT,
          difficulty INTEGER,
          preview TEXT,
          content_text TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_fts_title ON fts_exercises(title);
        CREATE INDEX IF NOT EXISTS idx_fts_theme ON fts_exercises(theme);
        CREATE INDEX IF NOT EXISTS idx_fts_chapter ON fts_exercises(chapter);
        CREATE INDEX IF NOT EXISTS idx_fts_module ON fts_exercises(module);
        CREATE INDEX IF NOT EXISTS idx_fts_level ON fts_exercises(level);
        CREATE INDEX IF NOT EXISTS idx_fts_difficulty ON fts_exercises(difficulty);
        CREATE INDEX IF NOT EXISTS idx_fts_preview ON fts_exercises(preview);`
      );
    }
    
    console.log('📋 Executing schema...');
    
    // Exécuter tout le script de création en une seule fois
    db.exec(schema);
    
    // Vérifier que les tables ont été créées
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('✅ Created tables:', tables.map(t => t.name));
    
    // Stocker l'info FTS5 dans l'objet db pour l'utiliser plus tard
    db.ftsSupported = ftsSupported;
    
    return db;
    
  } catch (error) {
    console.error('❌ Failed to create database schema:', error.message);
    db.close();
    throw error;
  }
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
        console.warn(`⚠️ Invalid exercise in ${path.basename(filePath)}`);
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
      uuid, title, chapter, subchapter, theme, level, difficulty, module,
      author, organization, video_id, created_at, updated_at, preview,
      content_json, source_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertFTS = db.prepare(`
    INSERT OR REPLACE INTO fts_exercises (uuid, title, theme, chapter, module, level, difficulty, preview, content_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Transaction pour la performance
  const transaction = db.transaction((exercises) => {
    let count = 0;
    
    for (const exercise of exercises) {
      try {
        // Vérifier que les champs obligatoires existent
        if (!exercise.uuid || !exercise.title || !exercise.chapter) {
          console.warn(`⚠️ Skipping exercise with missing required fields:`, {
            uuid: exercise.uuid,
            title: exercise.title,
            chapter: exercise.chapter
          });
          continue;
        }

        // Insérer dans la table principale
        insertExercise.run(
          exercise.uuid,
          exercise.title,
          exercise.chapter,
          exercise.subchapter || null,
          exercise.theme || null,
          exercise.level || null, // MODIFIÉ : ancien difficulty devient level (TEXT)
          exercise.difficulty, // NOUVEAU : difficulté numérique (INTEGER, peut être null)
          exercise.module || null,
          exercise.author || null,
          exercise.organization || null,
          exercise.video_id || null,
          exercise.created_at || new Date().toISOString(),
          exercise.updated_at || new Date().toISOString(),
          exercise.preview || null,
          JSON.stringify(exercise.content),
          exercise.source_hash || null
        );
        
        // Insérer dans FTS5 pour la recherche
        const searchText = extractSearchText(exercise.content);
        const cleanPreview = cleanPreviewForSearch(exercise.preview);
        
        // S'assurer que tous les champs sont des chaînes non nulles pour FTS5
        insertFTS.run(
          exercise.uuid || '',
          exercise.title || '',
          exercise.theme || '',
          exercise.chapter || '',
          exercise.module || '',
          exercise.level || '', // MODIFIÉ : level au lieu de difficulty
          exercise.difficulty || null, // NOUVEAU : difficulté numérique
          cleanPreview || '',
          searchText || ''
        );
        
        count++;
        
      } catch (error) {
        console.error(`❌ Failed to insert ${exercise.uuid}:`, error.message);
        console.error(`   Exercise data:`, {
          uuid: exercise.uuid,
          title: exercise.title,
          chapter: exercise.chapter,
          module: exercise.module,
          level: exercise.level,
          difficulty: exercise.difficulty,
          preview: exercise.preview ? exercise.preview.substring(0, 50) + '...' : 'N/A'
        });
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
        console.warn('⚠️ No valid exercises found!');
        process.exit(1);
      }
      
      // Vérifier les previews avant insertion
      console.log('🔍 Checking preview generation...');
      let exercisesWithPreview = 0;
      let exercisesWithoutPreview = 0;
      
      exercises.forEach(exercise => {
        if (exercise.preview && exercise.preview.trim() !== '') {
          exercisesWithPreview++;
        } else {
          exercisesWithoutPreview++;
          if (exercisesWithoutPreview <= 3) { // Afficher seulement les 3 premiers
            console.log(`⚠️ Exercise without preview: ${exercise.uuid} - ${exercise.title}`);
          }
        }
      });
      
      console.log(`📊 Preview stats: ${exercisesWithPreview} with preview, ${exercisesWithoutPreview} without preview`);
      
      // NOUVEAU : Vérifier les statistiques sur les nouveaux champs
      console.log('🔍 Checking level/difficulty distribution...');
      let levelStats = {};
      let difficultyStats = { null: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      exercises.forEach(exercise => {
        // Statistiques sur level (texte)
        const level = exercise.level || 'N/A';
        levelStats[level] = (levelStats[level] || 0) + 1;
        
        // Statistiques sur difficulty (numérique)
        const diff = exercise.difficulty;
        if (diff === null || diff === undefined) {
          difficultyStats.null++;
        } else if (diff >= 1 && diff <= 5) {
          difficultyStats[diff]++;
        }
      });
      
      console.log('📈 Level distribution:', Object.entries(levelStats).slice(0, 5).map(([k,v]) => `${k}: ${v}`).join(', '));
      console.log('📊 Difficulty distribution:', Object.entries(difficultyStats).map(([k,v]) => `${k}: ${v}`).join(', '));
      
      // Insérer en base
      const inserted = insertExercises(db, exercises);
      
      // Vérifier que la table FTS5 existe avant d'optimiser
      console.log('🔍 Checking search table...');
      try {
        const ftsCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fts_exercises'").get();
        if (!ftsCheck) {
          console.error('❌ Search table not found!');
          process.exit(1);
        }
        console.log('✅ Search table exists');
        
        // Vérifier la structure de la table de recherche
        const ftsInfo = db.prepare("PRAGMA table_info(fts_exercises)").all();
        console.log('📋 Search table structure:', ftsInfo.map(col => col.name));
        
        // Optimiser seulement si FTS5 est supporté
        if (db.ftsSupported) {
          console.log('🔧 Optimizing FTS5 search index...');
          db.exec("INSERT INTO fts_exercises(fts_exercises) VALUES('optimize')");
          console.log('✅ FTS5 search index optimized');
        } else {
          console.log('ℹ️ Using standard table for search (FTS5 not available)');
        }
        
      } catch (error) {
        console.error('❌ Search optimization failed:', error.message);
        // Ne pas faire échouer le build pour ça
        console.log('⚠️ Continuing without optimization...');
      }
      
      // Statistiques finales
      console.log('📊 Calculating statistics...');
      
      try {
        const total = db.prepare('SELECT COUNT(*) as count FROM exercises').get().count;
        console.log(`✅ Total exercises: ${total}`);
        
        const chapters = db.prepare('SELECT COUNT(DISTINCT chapter) as count FROM exercises').get().count;
        console.log(`✅ Chapters: ${chapters}`);
        
        // Requêtes avec gestion des valeurs nulles/vides
        const modules = db.prepare(`
          SELECT COUNT(DISTINCT module) as count 
          FROM exercises 
          WHERE module IS NOT NULL AND TRIM(module) != ''
        `).get().count;
        console.log(`✅ Modules: ${modules}`);
        
        // MODIFIÉ : Statistiques pour level (texte) au lieu de difficulty
        const levels = db.prepare(`
          SELECT COUNT(DISTINCT level) as count 
          FROM exercises 
          WHERE level IS NOT NULL AND TRIM(level) != ''
        `).get().count;
        console.log(`✅ Levels: ${levels}`);
        
        // NOUVEAU : Statistiques pour difficulty (numérique 1-5)
        const difficulties = db.prepare(`
          SELECT COUNT(DISTINCT difficulty) as count 
          FROM exercises 
          WHERE difficulty IS NOT NULL
        `).get().count;
        console.log(`✅ Numeric difficulties: ${difficulties}`);
        
        const withPreview = db.prepare(`
          SELECT COUNT(*) as count 
          FROM exercises 
          WHERE preview IS NOT NULL AND TRIM(preview) != ''
        `).get().count;
        console.log(`✅ Exercises with preview: ${withPreview}`);
        
        const size = (fs.statSync(DB_PATH).size / 1024).toFixed(1);
        
        console.log('\n📊 Results:');
        console.log(`✅ ${total} exercises in database`);
        console.log(`📖 ${chapters} different chapters`);
        console.log(`📚 ${modules} different modules`);
        console.log(`🎓 ${levels} different levels (text)`);
        console.log(`📈 ${difficulties} different difficulties (1-5)`);
        console.log(`👁️ ${withPreview} exercises with preview`);
        console.log(`💾 Database size: ${size} KB`);
        console.log('\n🎉 Database build completed!');
        
      } catch (statsError) {
        console.error('❌ Error calculating statistics:', statsError.message);
        console.log('⚠️ Database created successfully but statistics failed');
      }
      
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