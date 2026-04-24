// scripts/build-db.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { generatePreview } from './utils/previewUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const fsPromises = fs.promises;
let Database = null;

/**
 * Configuration simple
 */
const CACHE_DIR = path.resolve(__dirname, '../cache/exercises');
const DB_PATH = path.resolve(__dirname, '../data/exercises.sqlite');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql'); 

function isAbiMismatchError(error) {
  const message = String(error?.message || '');
  return (
    message.includes('was compiled against a different Node.js version') ||
    message.includes('NODE_MODULE_VERSION')
  );
}

function runNativeRebuild() {
  const pkgPath = require.resolve('better-sqlite3/package.json');
  const moduleDir = path.dirname(pkgPath);

  // Dériver le préfixe Node.js depuis le binaire en cours d'exécution.
  // ex: process.execPath = /home/user/.nvm/versions/node/v22.18.0/bin/node
  //     nodeDir           = /home/user/.nvm/versions/node/v22.18.0
  // Cela garantit que node-gyp compile avec les headers du runtime actuel,
  // quel que soit le Node système ou celui utilisé par pnpm.
  const nodeDir = path.dirname(path.dirname(process.execPath));
  const env = { ...process.env, npm_config_nodedir: nodeDir };

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'build-release'], {
    cwd: moduleDir,
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    throw new Error('Failed to rebuild better-sqlite3 native bindings');
  }
}

function loadDatabaseModule() {
  const tryLoad = () => {
    const mod = require('better-sqlite3');
    const Db = mod.default || mod;
    // Provoquer l'erreur ABI maintenant plutôt qu'à l'ouverture de la vraie base
    const probe = new Db(':memory:');
    probe.close();
    return Db;
  };

  try {
    Database = tryLoad();
  } catch (error) {
    if (!isAbiMismatchError(error)) {
      throw error;
    }

    console.log('⚠️ better-sqlite3 ABI mismatch detected, rebuilding native bindings...');
    runNativeRebuild();

    // Vider tous les nœuds de cache liés à better-sqlite3 (pnpm inclus)
    for (const key of Object.keys(require.cache)) {
      if (key.includes('better-sqlite3') || key.endsWith('.node')) {
        delete require.cache[key];
      }
    }

    Database = tryLoad();
    console.log('✅ better-sqlite3 rebuilt for current Node.js runtime');
  }
}

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
 * Hash du contenu sémantiquement pertinent (Pipeline A).
 * Couvre uniquement les blocs énoncé/question/réponse/indication.
 * Permet au Pipeline B de détecter si une réindexation est nécessaire.
 */
function computeContentHash(contentArray) {
  if (!Array.isArray(contentArray)) return null;
  const semanticTypes = new Set(['enonce', 'question', 'reponse', 'indication', 'hint', 'answer', 'solution', 'texte', 'text']);
  const blocks = contentArray.filter(b => semanticTypes.has((b?.type || '').toLowerCase()));
  return crypto.createHash('sha256').update(JSON.stringify(blocks)).digest('hex');
}

/**
 * Ajoute les colonnes manquantes sur une base existante.
 * Nécessaire lors de la première exécution après ajout des colonnes sémantiques.
 */
function runMigrations(db) {
  // Sur une base neuve la table n'existe pas encore : le schéma s'en charge.
  const tableExists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='exercises'"
  ).get();
  if (!tableExists) return;

  const existing = new Set(db.prepare('PRAGMA table_info(exercises)').all().map(c => c.name));
  const toAdd = [
    ['content_hash', 'TEXT'],
    ['summary',      'TEXT'],
    ['concepts',     'TEXT'],
    ['methods',      'TEXT'],
    ['indexed_at',   'TEXT'],
  ];
  for (const [col, type] of toAdd) {
    if (!existing.has(col)) {
      db.exec(`ALTER TABLE exercises ADD COLUMN ${col} ${type}`);
      console.log(`✅ Migration: added column exercises.${col}`);
    }
  }
}

/**
 * Crée et initialise la base de données
 */
function createDatabase(dbPath) {
  // Créer le dossier si nécessaire
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (!Database) {
    throw new Error('better-sqlite3 is not initialized');
  }

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
    
    // Ajouter les colonnes manquantes AVANT d'exécuter le schéma :
    // sinon CREATE INDEX sur content_hash échoue si la colonne n'existe pas encore.
    runMigrations(db);

    // Migration : si exercise_embeddings existe avec l'ancien schéma, la recréer
    try {
      const existingTable = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='exercise_embeddings'"
      ).get();
      if (existingTable && !existingTable.sql.includes('embedding_summary')) {
        const count = db.prepare('SELECT COUNT(*) as n FROM exercise_embeddings').get().n;
        if (count > 0) {
          throw new Error(
            `❌ Migration impossible : ${count} embeddings existent déjà avec l'ancien schéma.\n` +
            `   Sauvegardez-les avant de recréer la table.`
          );
        }
        console.log('🔄 Migration : recréation de exercise_embeddings avec le schéma conforme');
        db.exec('DROP TABLE exercise_embeddings');
      }
    } catch (err) {
      if (!err.message.includes('no such table')) throw err;
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
 * Chargement auteurs (facultatif)
 */
function loadAuthorsConfig() {
  const AUTHORS_PATH = path.resolve(__dirname, '../content/authors.json');
  try {
    if (!fs.existsSync(AUTHORS_PATH)) return { list: [], byPseudo: new Map(), byNorm: new Map() };
    const raw = fs.readFileSync(AUTHORS_PATH, 'utf8').trim();
    if (!raw) return { list: [], byPseudo: new Map(), byNorm: new Map() };
    const list = JSON.parse(raw);

    // Build indexes by pseudo and by normalized names/aliases
    const byPseudo = new Map();
    const byNorm = new Map();

    const norm = (s) => (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    for (const a of Array.isArray(list) ? list : []) {
      if (!a || typeof a !== 'object') continue;
      if (a.pseudo) byPseudo.set(a.pseudo, a);
      const prenom = a.prenom || a.first_name || '';
      const nom = a.nom || a.last_name || '';
      const display = a.display_name || [prenom, nom].filter(Boolean).join(' ') || a.pseudo || '';
      const variants = new Set([
        display,
        [nom, prenom].filter(Boolean).join(' '),
        prenom,
        nom,
        a.pseudo
      ].filter(Boolean));
      // aliases éventuels
      if (Array.isArray(a.aliases)) a.aliases.forEach(v => v && variants.add(v));
      for (const v of variants) {
        const key = norm(v);
        if (key) byNorm.set(key, a);
      }
    }

    return { list, byPseudo, byNorm };
  } catch (e) {
    console.warn('⚠️ Failed to load content/authors.json:', e.message);
    return { list: [], byPseudo: new Map(), byNorm: new Map() };
  }
}

function resolveAuthor(authorValue, exerciseOrg, authorsIdx) {
  if (!authorValue) return { author: null, organization: exerciseOrg || null, license_code: null, license_url: null };
  const { byPseudo, byNorm } = authorsIdx || {};
  const norm = (s) => (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  // Normalize and split potential multi-author strings.
  // Preserve commas used as "Nom, Prénom" by first trying a two-token comma form.
  const original = authorValue.toString().trim();

  // Candidate separators for multiple authors (avoid raw comma alone)
  const multiSepRegex = /\s*(?:;|\||\/|•|·| et | and )\s*/i;

  let parts = [original];
  if (multiSepRegex.test(original)) {
    parts = original.split(multiSepRegex).map(s => s.trim()).filter(Boolean);
  }

  const resolvedParts = parts.map((part) => {
    // Try pseudo exact
    let e = byPseudo?.get(part) || null;
    
    // Try reverse comma form: "Nom, Prénom" -> "Nom Prénom"
    let candidate = part;
    if (!e && /,/.test(part)) {
      const tw = part.split(',').map(s => s.trim()).filter(Boolean);
      if (tw.length === 2) candidate = `${tw[0]} ${tw[1]}`;
    }
    
    // Try normalized match on name/aliases
    if (!e) e = byNorm?.get(norm(candidate)) || null;

    // NOUVEAU : Si toujours pas trouvé, tester l'inversion "Prénom Nom" -> "Nom Prénom"
    if (!e && !candidate.includes(',')) {
      const words = candidate.trim().split(/\s+/).filter(Boolean);
      if (words.length === 2) {
        // Tester "Nom Prénom" si on avait "Prénom Nom"
        const reversed = `${words[1]} ${words[0]}`;
        e = byNorm?.get(norm(reversed)) || null;
        
        // Si trouvé avec l'ordre inversé, utiliser ce candidat
        if (e) {
          candidate = reversed;
        }
      }
    }

    if (!e) {
      return {
        display: part,
        organization: null,
        license_code: null,
        license_url: null
      };
    }

    const prenom = e.prenom || e.first_name || '';
    const nom = e.nom || e.last_name || '';
    const display = e.display_name || [prenom, nom].filter(Boolean).join(' ') || e.pseudo || part;
    return {
      display,
      pseudo: e.pseudo || null,
      organization: e.organization || null,
      license_code: e.license_code || null,
      license_url: e.license_url || null
    };
  });

  // Compose final values
  const authorDisplay = resolvedParts.map(p => p.display).join(' • ');
  const organization = exerciseOrg || resolvedParts.find(p => p.organization)?.organization || null;
  // If all license codes are the same (non-null), keep it; otherwise null
  const codes = Array.from(new Set(resolvedParts.map(p => p.license_code).filter(Boolean)));
  const urls = Array.from(new Set(resolvedParts.map(p => p.license_url).filter(Boolean)));
  const license_code = codes.length === 1 ? codes[0] : null;
  const license_url = urls.length === 1 ? urls[0] : null;

  return { author: authorDisplay, organization, license_code, license_url, parts: resolvedParts };
}

/**
 * Insère les exercices dans la base
 */
function insertExercises(db, exercises, authorsIdx) {
  console.log(`💾 Inserting ${exercises.length} exercises...`);

  const existingHashes = new Map(
    db.prepare('SELECT uuid, content_hash FROM exercises').all()
      .map(r => [r.uuid, r.content_hash])
  );

  // Préparer les requêtes
  // ON CONFLICT : met à jour toutes les colonnes Pipeline A, ne touche JAMAIS
  // aux colonnes sémantiques (summary, concepts, methods, indexed_at).
  // created_at est aussi préservé pour ne pas écraser la date de création originale.
  const insertExercise = db.prepare(`
    INSERT INTO exercises (
      uuid, title, chapter, subchapter, theme, level, difficulty, module,
      author, organization, license_code, license_url, video_id, created_at, updated_at, preview,
      hasIndication, hasSolution,
      content_json, source_hash, content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uuid) DO UPDATE SET
      title        = excluded.title,
      chapter      = excluded.chapter,
      subchapter   = excluded.subchapter,
      theme        = excluded.theme,
      level        = excluded.level,
      difficulty   = excluded.difficulty,
      module       = excluded.module,
      author       = excluded.author,
      organization = excluded.organization,
      license_code = excluded.license_code,
      license_url  = excluded.license_url,
      video_id     = excluded.video_id,
      updated_at   = excluded.updated_at,
      preview      = excluded.preview,
      hasIndication = excluded.hasIndication,
      hasSolution  = excluded.hasSolution,
      content_json = excluded.content_json,
      source_hash  = excluded.source_hash,
      content_hash = excluded.content_hash
  `);
  const deleteAuthorsFor = db.prepare(`DELETE FROM exercise_authors WHERE uuid = ?`);
  const insertAuthor = db.prepare(`
    INSERT OR REPLACE INTO exercise_authors (uuid, author_display, author_pseudo)
    VALUES (?, ?, ?)
  `);
  
  const invalidateIndexing = db.prepare(`UPDATE exercises SET indexed_at = NULL WHERE uuid = ?`);

  // FTS5 ne supporte pas ON CONFLICT : on supprime puis réinsère
  const deleteFTS = db.prepare(`DELETE FROM fts_exercises WHERE uuid = ?`);
  const insertFTS = db.prepare(`
    INSERT INTO fts_exercises (uuid, title, theme, chapter, module, level, difficulty, preview, content_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let added = 0, changedSemantically = 0, unchanged = 0, errors = 0;

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

        // Calculer les flags hasIndication / hasSolution
        const blocks = Array.isArray(exercise.content) ? exercise.content : [];
        const hasIndication = blocks.some((b) => {
          const t = (b?.type || '').toString().toLowerCase();
          return t === 'indication' || t === 'hint';
        }) ? 1 : 0;
        const hasSolution = blocks.some((b) => {
          const t = (b?.type || '').toString().toLowerCase();
          return t === 'reponse' || t === 'solution' || t === 'answer';
        }) ? 1 : 0;

        // Résoudre l'auteur (pseudo vs "Prénom Nom") et organisation
        const resolved = resolveAuthor(exercise.author, exercise.organization, authorsIdx);

        // Générer un preview intelligent qui respecte la syntaxe LaTeX
        const smartPreview = generatePreview(exercise) || exercise.preview || (exercise.title ? `<p>${exercise.title}</p>` : null);

        // Insérer dans la table principale (upsert Pipeline A)
        const contentHash = computeContentHash(exercise.content);
        insertExercise.run(
          exercise.uuid,
          exercise.title,
          exercise.chapter,
          exercise.subchapter || null,
          exercise.theme || null,
          exercise.level || null,
          exercise.difficulty,
          exercise.module || null,
          resolved.author || null,
          resolved.organization || null,
          resolved.license_code || null,
          resolved.license_url || null,
          exercise.video_id || null,
          exercise.created_at || new Date().toISOString(),
          exercise.updated_at || new Date().toISOString(),
          smartPreview,
          hasIndication,
          hasSolution,
          JSON.stringify(exercise.content),
          exercise.source_hash || null,
          contentHash
        );
        
        // Classification sémantique
        const wasNew = !existingHashes.has(exercise.uuid);
        const oldHash = existingHashes.get(exercise.uuid);
        const hashChanged = !wasNew && oldHash !== contentHash;
        if (hashChanged) {
          invalidateIndexing.run(exercise.uuid);
          changedSemantically++;
        } else if (wasNew) {
          added++;
        } else {
          unchanged++;
        }

        // Insérer les auteurs (table plate)
        try {
          deleteAuthorsFor.run(exercise.uuid);
          const parts = (resolved.parts || []).length ? resolved.parts : [{ display: resolved.author, pseudo: null }];
          for (const p of parts) {
            if (!p || !p.display) continue;
            insertAuthor.run(exercise.uuid, p.display, p.pseudo || null);
          }
        } catch (e) {
          console.warn('⚠️ Failed to insert exercise_authors for', exercise.uuid, e.message);
        }

        // Insérer dans FTS5 pour la recherche (DELETE + INSERT pour compatibilité FTS5)
        const searchText = extractSearchText(exercise.content);
        const cleanPreview = cleanPreviewForSearch(smartPreview);
        deleteFTS.run(exercise.uuid);
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
        errors++;
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
  
  transaction(exercises);

  console.log(`\n📊 Rapport d'insertion :`);
  console.log(`  ✅ Nouveaux        : ${added}`);
  console.log(`  🔄 Modifiés (sém.) : ${changedSemantically}  [indexation invalidée]`);
  console.log(`  ⏸️  Inchangés       : ${unchanged}`);
  if (errors > 0) console.log(`  ❌ Erreurs         : ${errors}`);

  return added + changedSemantically + unchanged;
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

    console.log('🔧 Checking native SQLite bindings...');
    loadDatabaseModule();

    // Ouvrir ou créer la base de données (mode incrémental : pas de suppression)
    console.log('📚 Opening/creating database...');
    const db = createDatabase(DB_PATH);
    
    try {
      // Charger les auteurs (optionnel)
      console.log('👤 Loading authors config (if any)...');
      const authorsIdx = loadAuthorsConfig();
      console.log(`👤 Authors loaded: ${authorsIdx.list.length}`);

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
      insertExercises(db, exercises, authorsIdx);

      // Suppression des exercices qui ne sont plus dans le cache
      console.log('\n🧹 Recherche des exercices obsolètes...');
      const validUuids = new Set(exercises.map(e => e.uuid));
      const allUuidsInDb = db.prepare('SELECT uuid FROM exercises').all().map(r => r.uuid);
      const toDelete = allUuidsInDb.filter(uuid => !validUuids.has(uuid));
      if (toDelete.length > 0) {
        console.log(`🗑️  Suppression de ${toDelete.length} exercices absents du cache`);
        console.log(`   (leurs embeddings seront supprimés via ON DELETE CASCADE)`);
        const deleteStmt = db.prepare('DELETE FROM exercises WHERE uuid = ?');
        db.transaction((uuids) => { for (const uuid of uuids) deleteStmt.run(uuid); })(toDelete);
      } else {
        console.log('✅ Aucun exercice obsolète à supprimer');
      }

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

        const indexed = db.prepare(`SELECT COUNT(*) as count FROM exercises WHERE indexed_at IS NOT NULL`).get().count;
        const pending = db.prepare(`SELECT COUNT(*) as count FROM exercises WHERE indexed_at IS NULL`).get().count;
        const embeddings = db.prepare(`SELECT COUNT(*) as count FROM exercise_embeddings`).get().count;
        console.log(`\n🧠 Indexation sémantique :`);
        console.log(`   ${indexed} exercices indexés (summary + embedding)`);
        console.log(`   ${pending} exercices en attente d'indexation`);
        console.log(`   ${embeddings} embeddings stockés`);

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
