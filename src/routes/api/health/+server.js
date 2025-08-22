// src/routes/api/health/+server.js
import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Configuration cohérente des chemins
const DB_PATH = path.resolve('data/exercises.sqlite');

export async function GET() {
  try {
    // Vérifier l'existence du fichier DB
    if (!fs.existsSync(DB_PATH)) {
      return json({ 
        status: 'error',
        error: 'Database file not found',
        path: DB_PATH
      }, { status: 503 });
    }
    
    // Tester la connexion DB
    let db;
    try {
      db = new Database(DB_PATH, { readonly: true });
      const result = db.prepare('SELECT COUNT(*) as count FROM exercises').get();
      
      return json({ 
        status: 'healthy',
        database: 'connected',
        exerciseCount: result.count,
        timestamp: new Date().toISOString()
      });
      
    } finally {
      if (db) db.close();
    }
    
  } catch (error) {
    console.error('Health check failed:', error);
    return json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}