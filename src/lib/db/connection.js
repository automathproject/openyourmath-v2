// src/lib/db/connection.js
import Database from 'better-sqlite3';
import { dev } from '$app/environment';

let db;

/**
 * Initialise la connexion à la base de données
 */
function initDatabase() {
  if (db) return db;
  
  const dbPath = dev 
    ? './data/exercises.sqlite'  // En développement
    : process.env.DATABASE_PATH || '/app/data/exercises.sqlite'; // En production
    
  try {
    db = new Database(dbPath, { 
      readonly: true,  // Lecture seule en runtime
      fileMustExist: true 
    });
    
    // Configuration pour de meilleures performances en lecture
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');
    db.pragma('mmap_size = 268435456'); // 256MB
    
    console.log(`📚 Database connected: ${dbPath}`);
    return db;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw new Error(`Cannot connect to database: ${error.message}`);
  }
}

/**
 * Obtient la connexion database (singleton)
 */
export function getDatabase() {
  return initDatabase();
}

/**
 * Ferme la connexion (pour les tests ou le shutdown)
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('📚 Database connection closed');
  }
}

/**
 * Vérifie que la base est accessible et a le bon schéma
 */
export function healthCheck() {
  try {
    const db = getDatabase();
    
    // Vérifier que les tables existent
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('exercises', 'fts_exercises')
    `).all();
    
    if (tables.length < 2) {
      throw new Error('Missing required tables');
    }
    
    // Compter les exercices
    const count = db.prepare('SELECT COUNT(*) as count FROM exercises').get();
    
    return {
      status: 'healthy',
      exerciseCount: count.count,
      tables: tables.map(t => t.name)
    };
    
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}