import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

/**
 * Classe para gerenciar conexão com banco de dados
 * Suporta SQLite (local) e PostgreSQL (produção)
 */
class DatabaseManager {
  constructor() {
    this.db = null;
    this.pool = null;
    this.isPostgres = false;
  }

  /**
   * Inicializa conexão com banco de dados
   */
  async initialize() {
    // Verifica se tem DATABASE_URL (PostgreSQL no Railway)
    if (process.env.DATABASE_URL) {
      console.log('🐘 Usando PostgreSQL');
      this.isPostgres = true;
      
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Cria tabelas no PostgreSQL
      await this.createPostgresTables();
      
    } else {
      console.log('📁 Usando SQLite');
      this.isPostgres = false;
      
      // Usa SQLite local
      const dbPath = path.join(process.cwd(), 'data', 'users.db');
      const dataDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      this.db = new Database(dbPath);
      
      // Cria tabelas no SQLite
      this.createSQLiteTables();
    }
  }

  /**
   * Cria tabelas no SQLite
   */
  createSQLiteTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TEXT NOT NULL
      )
    `);
  }

  /**
   * Cria tabelas no PostgreSQL
   */
  async createPostgresTables() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP NOT NULL
        )
      `);
      console.log('✅ Tabelas PostgreSQL criadas');
    } finally {
      client.release();
    }
  }

  /**
   * Busca usuário por email
   */
  async getUserByEmail(email) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
      } finally {
        client.release();
      }
    } else {
      return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
    }
  }

  /**
   * Busca usuário por ID
   */
  async getUserById(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
      } finally {
        client.release();
      }
    } else {
      return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
    }
  }

  /**
   * Cria novo usuário
   */
  async createUser(email, password, name, role = 'user') {
    const createdAt = new Date().toISOString();
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'INSERT INTO users (email, password, name, role, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [email, password, name, role, createdAt]
        );
        return result.rows[0];
      } finally {
        client.release();
      }
    } else {
      const result = this.db.prepare(
        'INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(email, password, name, role, createdAt);
      
      return this.getUserById(result.lastInsertRowid);
    }
  }

  /**
   * Atualiza senha do usuário
   */
  async updatePassword(email, newPassword) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'UPDATE users SET password = $1 WHERE email = $2',
          [newPassword, email]
        );
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    } else {
      const result = this.db.prepare('UPDATE users SET password = ? WHERE email = ?').run(newPassword, email);
      return result.changes > 0;
    }
  }

  /**
   * Fecha conexão
   */
  async close() {
    if (this.isPostgres && this.pool) {
      await this.pool.end();
    } else if (this.db) {
      this.db.close();
    }
  }
}

// Exporta instância singleton
const dbManager = new DatabaseManager();
export default dbManager;
