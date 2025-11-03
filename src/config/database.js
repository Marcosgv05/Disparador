import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cria diretório data se não existir
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  logger.info('📁 Diretório data criado');
}

// Cria banco de dados SQLite
const dbPath = path.join(dataDir, 'users.db');
const db = new Database(dbPath);

// Habilita foreign keys
db.pragma('foreign_keys = ON');

// Cria tabelas
function initDatabase() {
  try {
    // Tabela de usuários
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Tabela de sessões
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired DATETIME NOT NULL
      )
    `);

    logger.info('✅ Banco de dados inicializado');
  } catch (error) {
    logger.error(`Erro ao inicializar banco: ${error.message}`);
    throw error;
  }
}

initDatabase();

export default db;
