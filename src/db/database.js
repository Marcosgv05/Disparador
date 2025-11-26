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
    // Tabela de usuários
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        max_instances INTEGER DEFAULT 3,
        max_messages_day INTEGER DEFAULT 1000,
        is_active INTEGER DEFAULT 1,
        plan_id INTEGER,
        plan_expires_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de planos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        max_instances INTEGER DEFAULT 3,
        max_messages_day INTEGER DEFAULT 1000,
        price REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de logs de atividade
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_email TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de logs de login
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de avisos do sistema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_active INTEGER DEFAULT 1,
        starts_at TEXT,
        ends_at TEXT,
        created_by INTEGER,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de configurações globais
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at TEXT NOT NULL
      )
    `);
    
    // Tabela de blacklist de números
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        reason TEXT,
        added_by INTEGER,
        created_at TEXT NOT NULL
      )
    `);
    
    // Migrações para tabela users
    try { this.db.exec(`ALTER TABLE users ADD COLUMN max_instances INTEGER DEFAULT 3`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE users ADD COLUMN max_messages_day INTEGER DEFAULT 1000`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE users ADD COLUMN plan_id INTEGER`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE users ADD COLUMN plan_expires_at TEXT`); } catch (e) {}
    
    // Tabela de templates de mensagens
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        variables TEXT,
        category TEXT DEFAULT 'geral',
        is_approved INTEGER DEFAULT 1,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT
      )
    `);
    
    // Tabela de campanhas agendadas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        template_id INTEGER,
        message TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT,
        contacts TEXT NOT NULL,
        instance_ids TEXT,
        scheduled_at TEXT NOT NULL,
        repeat_type TEXT,
        repeat_interval INTEGER,
        repeat_until TEXT,
        status TEXT DEFAULT 'pending',
        executed_at TEXT,
        result TEXT,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de métricas de mensagens
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        campaign_id INTEGER,
        instance_id TEXT,
        phone TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        sent_at TEXT,
        delivered_at TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    
    // Tabela de estatísticas diárias
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date TEXT NOT NULL,
        messages_sent INTEGER DEFAULT 0,
        messages_delivered INTEGER DEFAULT 0,
        messages_read INTEGER DEFAULT 0,
        messages_failed INTEGER DEFAULT 0,
        campaigns_executed INTEGER DEFAULT 0,
        UNIQUE(user_id, date)
      )
    `);
    
    // Insere configurações padrão se não existirem
    this.initDefaultSettings();
    this.initDefaultPlans();
  }
  
  /**
   * Inicializa configurações padrão
   */
  initDefaultSettings() {
    const defaults = [
      { key: 'message_delay', value: '3000', description: 'Delay entre mensagens (ms)' },
      { key: 'number_delay', value: '5000', description: 'Delay entre números (ms)' },
      { key: 'max_messages_per_day_global', value: '10000', description: 'Limite global de mensagens/dia' },
      { key: 'maintenance_mode', value: 'false', description: 'Modo manutenção ativo' },
      { key: 'maintenance_message', value: 'Sistema em manutenção. Voltamos em breve!', description: 'Mensagem de manutenção' }
    ];
    
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)`);
    const now = new Date().toISOString();
    defaults.forEach(s => stmt.run(s.key, s.value, s.description, now));
  }
  
  /**
   * Inicializa planos padrão
   */
  initDefaultPlans() {
    const exists = this.db.prepare('SELECT COUNT(*) as count FROM plans').get();
    if (exists.count > 0) return;
    
    const plans = [
      {
        name: 'Start',
        description: 'Para iniciar com segurança e volumes baixos (ideal para autônomos e pequenos negócios)',
        max_instances: 1,
        max_messages_day: 300,
        price: 97.00
      },
      {
        name: 'Pro',
        description: 'Para pequenos e médios negócios com operação diária constante',
        max_instances: 3,
        max_messages_day: 1500,
        price: 197.00
      },
      {
        name: 'Agency',
        description: 'Para agências e operações maiores com múltiplos chips e clientes',
        max_instances: 10,
        max_messages_day: 8000,
        price: 497.00
      }
    ];
    
    const stmt = this.db.prepare(`INSERT INTO plans (name, description, max_instances, max_messages_day, price, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`);
    const now = new Date().toISOString();
    plans.forEach(p => stmt.run(p.name, p.description, p.max_instances, p.max_messages_day, p.price, now));
  }

  /**
   * Cria tabelas no PostgreSQL
   */
  async createPostgresTables() {
    const client = await this.pool.connect();
    try {
      // Tabela de usuários
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          max_instances INTEGER DEFAULT 3,
          max_messages_day INTEGER DEFAULT 1000,
          is_active BOOLEAN DEFAULT true,
          plan_id INTEGER,
          plan_expires_at TIMESTAMP,
          firebase_uid VARCHAR(255),
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de planos
      await client.query(`
        CREATE TABLE IF NOT EXISTS plans (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          max_instances INTEGER DEFAULT 3,
          max_messages_day INTEGER DEFAULT 1000,
          price DECIMAL(10,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de logs de atividade
      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          user_email VARCHAR(255),
          action VARCHAR(255) NOT NULL,
          details TEXT,
          ip_address VARCHAR(50),
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de logs de login
      await client.query(`
        CREATE TABLE IF NOT EXISTS login_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          email VARCHAR(255),
          success BOOLEAN,
          ip_address VARCHAR(50),
          user_agent TEXT,
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de configurações do sistema
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          value TEXT,
          description TEXT,
          updated_at TIMESTAMP
        )
      `);
      
      // Tabela de blacklist
      await client.query(`
        CREATE TABLE IF NOT EXISTS blacklist (
          id SERIAL PRIMARY KEY,
          phone VARCHAR(50) UNIQUE NOT NULL,
          reason TEXT,
          added_by INTEGER,
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de templates de mensagens
      await client.query(`
        CREATE TABLE IF NOT EXISTS message_templates (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          name VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          variables TEXT,
          category VARCHAR(100) DEFAULT 'geral',
          usage_count INTEGER DEFAULT 0,
          is_approved BOOLEAN DEFAULT false,
          created_at TIMESTAMP,
          updated_at TIMESTAMP
        )
      `);
      
      // Tabela de campanhas agendadas
      await client.query(`
        CREATE TABLE IF NOT EXISTS scheduled_campaigns (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          template_id INTEGER,
          message TEXT,
          media_url TEXT,
          media_type VARCHAR(50),
          contacts TEXT,
          instance_ids TEXT,
          scheduled_at TIMESTAMP NOT NULL,
          executed_at TIMESTAMP,
          status VARCHAR(50) DEFAULT 'pending',
          result TEXT,
          repeat_type VARCHAR(50),
          repeat_interval INTEGER,
          repeat_until TIMESTAMP,
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de métricas de mensagens
      await client.query(`
        CREATE TABLE IF NOT EXISTS message_metrics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          campaign_id INTEGER,
          instance_id VARCHAR(255),
          phone VARCHAR(50),
          status VARCHAR(50) NOT NULL,
          error_message TEXT,
          sent_at TIMESTAMP,
          delivered_at TIMESTAMP,
          read_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL
        )
      `);
      
      // Tabela de estatísticas diárias
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_stats (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          date DATE NOT NULL,
          messages_sent INTEGER DEFAULT 0,
          messages_delivered INTEGER DEFAULT 0,
          messages_read INTEGER DEFAULT 0,
          messages_failed INTEGER DEFAULT 0,
          campaigns_executed INTEGER DEFAULT 0,
          UNIQUE(user_id, date)
        )
      `);
      
      // Tabela de avisos do sistema
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_notices (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info',
          is_active BOOLEAN DEFAULT true,
          created_by INTEGER,
          created_at TIMESTAMP NOT NULL,
          starts_at TIMESTAMP,
          ends_at TIMESTAMP
        )
      `);
      
      // Migração: adiciona colunas se não existirem
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='max_instances') THEN
            ALTER TABLE users ADD COLUMN max_instances INTEGER DEFAULT 3;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
            ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebase_uid') THEN
            ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255);
          END IF;
        END $$;
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
   * Lista todos os usuários (para admin)
   */
  async getAllUsers() {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT id, email, name, role, max_instances, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        return result.rows;
      } finally {
        client.release();
      }
    } else {
      return this.db.prepare(
        'SELECT id, email, name, role, max_instances, is_active, created_at FROM users ORDER BY created_at DESC'
      ).all();
    }
  }

  /**
   * Atualiza usuário (admin)
   */
  async updateUser(id, updates) {
    const { name, role, max_instances, is_active } = updates;
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `UPDATE users SET 
            name = COALESCE($1, name),
            role = COALESCE($2, role),
            max_instances = COALESCE($3, max_instances),
            is_active = COALESCE($4, is_active)
          WHERE id = $5 RETURNING id, email, name, role, max_instances, is_active, created_at`,
          [name, role, max_instances, is_active, id]
        );
        return result.rows[0];
      } finally {
        client.release();
      }
    } else {
      const fields = [];
      const values = [];
      
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (role !== undefined) { fields.push('role = ?'); values.push(role); }
      if (max_instances !== undefined) { fields.push('max_instances = ?'); values.push(max_instances); }
      if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
      
      if (fields.length === 0) return null;
      
      values.push(id);
      this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return this.getUserById(id);
    }
  }

  /**
   * Deleta usuário
   */
  async deleteUser(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    } else {
      const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return result.changes > 0;
    }
  }

  /**
   * Busca usuário por Firebase UID
   */
  async getUserByFirebaseUid(uid) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
        return result.rows[0] || null;
      } finally {
        client.release();
      }
    } else {
      return this.db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(uid) || null;
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

  // ==================== LOGS DE ATIVIDADE ====================

  /**
   * Registra log de atividade
   */
  async logActivity(userId, userEmail, action, details = null, ipAddress = null, userAgent = null) {
    const createdAt = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query(
          'INSERT INTO activity_logs (user_id, user_email, action, details, ip_address, user_agent, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [userId, userEmail, action, details, ipAddress, userAgent, createdAt]
        );
      } finally { client.release(); }
    } else {
      this.db.prepare(
        'INSERT INTO activity_logs (user_id, user_email, action, details, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, userEmail, action, details, ipAddress, userAgent, createdAt);
    }
  }

  /**
   * Lista logs de atividade
   */
  async getActivityLogs(limit = 100, offset = 0, userId = null) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const query = userId 
          ? 'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3'
          : 'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2';
        const params = userId ? [userId, limit, offset] : [limit, offset];
        const result = await client.query(query, params);
        return result.rows;
      } finally { client.release(); }
    } else {
      const query = userId
        ? 'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        : 'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const params = userId ? [userId, limit, offset] : [limit, offset];
      return this.db.prepare(query).all(...params);
    }
  }

  // ==================== LOGS DE LOGIN ====================

  /**
   * Registra log de login
   */
  async logLogin(userId, userEmail, ipAddress, userAgent, success = true) {
    const createdAt = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query(
          'INSERT INTO login_logs (user_id, user_email, ip_address, user_agent, success, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, userEmail, ipAddress, userAgent, success, createdAt]
        );
      } finally { client.release(); }
    } else {
      this.db.prepare(
        'INSERT INTO login_logs (user_id, user_email, ip_address, user_agent, success, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, userEmail, ipAddress, userAgent, success ? 1 : 0, createdAt);
    }
  }

  /**
   * Lista logs de login
   */
  async getLoginLogs(limit = 100, offset = 0) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    }
  }

  // ==================== PLANOS ====================

  /**
   * Lista todos os planos
   */
  async getAllPlans() {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM plans ORDER BY price ASC');
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM plans ORDER BY price ASC').all();
    }
  }

  /**
   * Busca plano por ID
   */
  async getPlanById(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM plans WHERE id = $1', [id]);
        return result.rows[0] || null;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) || null;
    }
  }

  /**
   * Cria plano
   */
  async createPlan(data) {
    const { name, description, max_instances, max_messages_day, price } = data;
    const createdAt = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'INSERT INTO plans (name, description, max_instances, max_messages_day, price, is_active, created_at) VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *',
          [name, description, max_instances, max_messages_day, price, createdAt]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      const result = this.db.prepare(
        'INSERT INTO plans (name, description, max_instances, max_messages_day, price, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
      ).run(name, description, max_instances, max_messages_day, price, createdAt);
      return this.getPlanById(result.lastInsertRowid);
    }
  }

  /**
   * Atualiza plano
   */
  async updatePlan(id, data) {
    const { name, description, max_instances, max_messages_day, price, is_active } = data;
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `UPDATE plans SET name = COALESCE($1, name), description = COALESCE($2, description), 
           max_instances = COALESCE($3, max_instances), max_messages_day = COALESCE($4, max_messages_day),
           price = COALESCE($5, price), is_active = COALESCE($6, is_active) WHERE id = $7 RETURNING *`,
          [name, description, max_instances, max_messages_day, price, is_active, id]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      const fields = [], values = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description); }
      if (max_instances !== undefined) { fields.push('max_instances = ?'); values.push(max_instances); }
      if (max_messages_day !== undefined) { fields.push('max_messages_day = ?'); values.push(max_messages_day); }
      if (price !== undefined) { fields.push('price = ?'); values.push(price); }
      if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
      if (fields.length === 0) return null;
      values.push(id);
      this.db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return this.getPlanById(id);
    }
  }

  /**
   * Deleta plano
   */
  async deletePlan(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM plans WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally { client.release(); }
    } else {
      const result = this.db.prepare('DELETE FROM plans WHERE id = ?').run(id);
      return result.changes > 0;
    }
  }

  /**
   * Atribui plano a usuário
   */
  async assignPlanToUser(userId, planId, expiresAt = null) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const plan = await this.getPlanById(planId);
        await client.query(
          'UPDATE users SET plan_id = $1, plan_expires_at = $2, max_instances = $3, max_messages_day = $4 WHERE id = $5',
          [planId, expiresAt, plan?.max_instances || 3, plan?.max_messages_day || 1000, userId]
        );
        return true;
      } finally { client.release(); }
    } else {
      const plan = await this.getPlanById(planId);
      this.db.prepare('UPDATE users SET plan_id = ?, plan_expires_at = ?, max_instances = ?, max_messages_day = ? WHERE id = ?')
        .run(planId, expiresAt, plan?.max_instances || 3, plan?.max_messages_day || 1000, userId);
      return true;
    }
  }

  // ==================== AVISOS DO SISTEMA ====================

  /**
   * Lista avisos ativos
   */
  async getActiveNotices() {
    const now = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `SELECT * FROM system_notices WHERE is_active = true 
           AND (starts_at IS NULL OR starts_at <= $1) 
           AND (ends_at IS NULL OR ends_at >= $1) ORDER BY created_at DESC`, [now]
        );
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare(
        `SELECT * FROM system_notices WHERE is_active = 1 
         AND (starts_at IS NULL OR starts_at <= ?) 
         AND (ends_at IS NULL OR ends_at >= ?) ORDER BY created_at DESC`
      ).all(now, now);
    }
  }

  /**
   * Lista todos os avisos
   */
  async getAllNotices() {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM system_notices ORDER BY created_at DESC');
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM system_notices ORDER BY created_at DESC').all();
    }
  }

  /**
   * Cria aviso
   */
  async createNotice(data) {
    const { title, message, type, starts_at, ends_at, created_by } = data;
    const createdAt = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'INSERT INTO system_notices (title, message, type, is_active, starts_at, ends_at, created_by, created_at) VALUES ($1, $2, $3, true, $4, $5, $6, $7) RETURNING *',
          [title, message, type || 'info', starts_at, ends_at, created_by, createdAt]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      const result = this.db.prepare(
        'INSERT INTO system_notices (title, message, type, is_active, starts_at, ends_at, created_by, created_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)'
      ).run(title, message, type || 'info', starts_at, ends_at, created_by, createdAt);
      return this.db.prepare('SELECT * FROM system_notices WHERE id = ?').get(result.lastInsertRowid);
    }
  }

  /**
   * Atualiza aviso
   */
  async updateNotice(id, data) {
    const { title, message, type, is_active, starts_at, ends_at } = data;
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `UPDATE system_notices SET title = COALESCE($1, title), message = COALESCE($2, message),
           type = COALESCE($3, type), is_active = COALESCE($4, is_active), 
           starts_at = COALESCE($5, starts_at), ends_at = COALESCE($6, ends_at) WHERE id = $7 RETURNING *`,
          [title, message, type, is_active, starts_at, ends_at, id]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      const fields = [], values = [];
      if (title !== undefined) { fields.push('title = ?'); values.push(title); }
      if (message !== undefined) { fields.push('message = ?'); values.push(message); }
      if (type !== undefined) { fields.push('type = ?'); values.push(type); }
      if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
      if (starts_at !== undefined) { fields.push('starts_at = ?'); values.push(starts_at); }
      if (ends_at !== undefined) { fields.push('ends_at = ?'); values.push(ends_at); }
      if (fields.length === 0) return null;
      values.push(id);
      this.db.prepare(`UPDATE system_notices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return this.db.prepare('SELECT * FROM system_notices WHERE id = ?').get(id);
    }
  }

  /**
   * Deleta aviso
   */
  async deleteNotice(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM system_notices WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally { client.release(); }
    } else {
      const result = this.db.prepare('DELETE FROM system_notices WHERE id = ?').run(id);
      return result.changes > 0;
    }
  }

  // ==================== CONFIGURAÇÕES DO SISTEMA ====================

  /**
   * Busca configuração
   */
  async getSetting(key) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT value FROM system_settings WHERE key = $1', [key]);
        return result.rows[0]?.value || null;
      } finally { client.release(); }
    } else {
      const row = this.db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
      return row?.value || null;
    }
  }

  /**
   * Lista todas as configurações
   */
  async getAllSettings() {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM system_settings ORDER BY key');
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM system_settings ORDER BY key').all();
    }
  }

  /**
   * Atualiza configuração
   */
  async updateSetting(key, value) {
    const updatedAt = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query('UPDATE system_settings SET value = $1, updated_at = $2 WHERE key = $3', [value, updatedAt, key]);
        return true;
      } finally { client.release(); }
    } else {
      this.db.prepare('UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?').run(value, updatedAt, key);
      return true;
    }
  }

  // ==================== BLACKLIST ====================

  /**
   * Adiciona número à blacklist
   */
  async addToBlacklist(phone, reason = null, addedBy = null) {
    const createdAt = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'INSERT INTO blacklist (phone, reason, added_by, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (phone) DO NOTHING RETURNING *',
          [phone, reason, addedBy, createdAt]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      try {
        const result = this.db.prepare('INSERT INTO blacklist (phone, reason, added_by, created_at) VALUES (?, ?, ?, ?)').run(phone, reason, addedBy, createdAt);
        return this.db.prepare('SELECT * FROM blacklist WHERE id = ?').get(result.lastInsertRowid);
      } catch (e) { return null; } // Já existe
    }
  }

  /**
   * Remove número da blacklist
   */
  async removeFromBlacklist(phone) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM blacklist WHERE phone = $1', [phone]);
        return result.rowCount > 0;
      } finally { client.release(); }
    } else {
      const result = this.db.prepare('DELETE FROM blacklist WHERE phone = ?').run(phone);
      return result.changes > 0;
    }
  }

  /**
   * Verifica se número está na blacklist
   */
  async isBlacklisted(phone) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT 1 FROM blacklist WHERE phone = $1', [phone]);
        return result.rows.length > 0;
      } finally { client.release(); }
    } else {
      const row = this.db.prepare('SELECT 1 FROM blacklist WHERE phone = ?').get(phone);
      return !!row;
    }
  }

  /**
   * Lista blacklist
   */
  async getBlacklist(limit = 100, offset = 0) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM blacklist ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM blacklist ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    }
  }

  // ==================== ESTATÍSTICAS AVANÇADAS ====================

  /**
   * Estatísticas completas do sistema
   */
  async getSystemStats() {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const users = await client.query('SELECT COUNT(*) as total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active, SUM(CASE WHEN role = \'admin\' THEN 1 ELSE 0 END) as admins FROM users');
        const logins = await client.query('SELECT COUNT(*) as total FROM login_logs WHERE created_at > NOW() - INTERVAL \'24 hours\'');
        const activities = await client.query('SELECT COUNT(*) as total FROM activity_logs WHERE created_at > NOW() - INTERVAL \'24 hours\'');
        const blacklist = await client.query('SELECT COUNT(*) as total FROM blacklist');
        return {
          users: users.rows[0],
          loginsLast24h: parseInt(logins.rows[0].total),
          activitiesLast24h: parseInt(activities.rows[0].total),
          blacklistCount: parseInt(blacklist.rows[0].total)
        };
      } finally { client.release(); }
    } else {
      const users = this.db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN role = \'admin\' THEN 1 ELSE 0 END) as admins FROM users').get();
      const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
      const logins = this.db.prepare('SELECT COUNT(*) as total FROM login_logs WHERE created_at > ?').get(yesterday);
      const activities = this.db.prepare('SELECT COUNT(*) as total FROM activity_logs WHERE created_at > ?').get(yesterday);
      const blacklist = this.db.prepare('SELECT COUNT(*) as total FROM blacklist').get();
      return {
        users: { total: users.total, active: users.active, admins: users.admins },
        loginsLast24h: logins.total,
        activitiesLast24h: activities.total,
        blacklistCount: blacklist.total
      };
    }
  }

  /**
   * Atualiza estatísticas diárias
   */
  async updateDailyStats(userId, date, field) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query(
          `INSERT INTO daily_stats (user_id, date, ${field}) VALUES ($1, $2, 1) 
           ON CONFLICT(user_id, date) DO UPDATE SET ${field} = daily_stats.${field} + 1`,
          [userId, date]
        );
      } finally { client.release(); }
    } else {
      this.db.prepare(
        `INSERT INTO daily_stats (user_id, date, ${field}) VALUES (?, ?, 1) 
         ON CONFLICT(user_id, date) DO UPDATE SET ${field} = ${field} + 1`
      ).run(userId, date);
    }
  }

  // ==================== TEMPLATES DE MENSAGENS ====================

  async getTemplates(userId = null) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const query = userId 
          ? 'SELECT * FROM message_templates WHERE user_id = $1 OR user_id IS NULL ORDER BY usage_count DESC'
          : 'SELECT * FROM message_templates ORDER BY usage_count DESC';
        const result = userId 
          ? await client.query(query, [userId])
          : await client.query(query);
        return result.rows;
      } finally { client.release(); }
    } else {
      const query = userId 
        ? 'SELECT * FROM message_templates WHERE user_id = ? OR user_id IS NULL ORDER BY usage_count DESC'
        : 'SELECT * FROM message_templates ORDER BY usage_count DESC';
      return userId ? this.db.prepare(query).all(userId) : this.db.prepare(query).all();
    }
  }

  async getTemplateById(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM message_templates WHERE id = $1', [id]);
        return result.rows[0] || null;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id) || null;
    }
  }

  async createTemplate(data) {
    const { user_id, name, content, variables, category } = data;
    const now = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'INSERT INTO message_templates (user_id, name, content, variables, category, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [user_id, name, content, variables ? JSON.stringify(variables) : null, category || 'geral', now]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      const result = this.db.prepare(
        'INSERT INTO message_templates (user_id, name, content, variables, category, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(user_id, name, content, variables ? JSON.stringify(variables) : null, category || 'geral', now);
      return this.getTemplateById(result.lastInsertRowid);
    }
  }

  async updateTemplate(id, data) {
    const { name, content, variables, category, is_approved } = data;
    const now = new Date().toISOString();
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const fields = ['updated_at = $1'];
        const values = [now];
        let paramIndex = 2;
        if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
        if (content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(content); }
        if (variables !== undefined) { fields.push(`variables = $${paramIndex++}`); values.push(JSON.stringify(variables)); }
        if (category !== undefined) { fields.push(`category = $${paramIndex++}`); values.push(category); }
        if (is_approved !== undefined) { fields.push(`is_approved = $${paramIndex++}`); values.push(is_approved); }
        values.push(id);
        await client.query(`UPDATE message_templates SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        return this.getTemplateById(id);
      } finally { client.release(); }
    } else {
      const fields = ['updated_at = ?'];
      const values = [now];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (content !== undefined) { fields.push('content = ?'); values.push(content); }
      if (variables !== undefined) { fields.push('variables = ?'); values.push(JSON.stringify(variables)); }
      if (category !== undefined) { fields.push('category = ?'); values.push(category); }
      if (is_approved !== undefined) { fields.push('is_approved = ?'); values.push(is_approved ? 1 : 0); }
      values.push(id);
      this.db.prepare(`UPDATE message_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return this.getTemplateById(id);
    }
  }

  async deleteTemplate(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM message_templates WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally { client.release(); }
    } else {
      return this.db.prepare('DELETE FROM message_templates WHERE id = ?').run(id).changes > 0;
    }
  }

  async incrementTemplateUsage(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query('UPDATE message_templates SET usage_count = usage_count + 1 WHERE id = $1', [id]);
      } finally { client.release(); }
    } else {
      this.db.prepare('UPDATE message_templates SET usage_count = usage_count + 1 WHERE id = ?').run(id);
    }
  }

  // ==================== CAMPANHAS AGENDADAS ====================

  async getScheduledCampaigns(userId = null, status = null) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        let query = 'SELECT * FROM scheduled_campaigns WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (userId) { query += ` AND user_id = $${paramIndex++}`; params.push(userId); }
        if (status) { query += ` AND status = $${paramIndex++}`; params.push(status); }
        query += ' ORDER BY scheduled_at ASC';
        const result = await client.query(query, params);
        return result.rows;
      } finally { client.release(); }
    } else {
      let query = 'SELECT * FROM scheduled_campaigns WHERE 1=1';
      const params = [];
      if (userId) { query += ' AND user_id = ?'; params.push(userId); }
      if (status) { query += ' AND status = ?'; params.push(status); }
      query += ' ORDER BY scheduled_at ASC';
      return this.db.prepare(query).all(...params);
    }
  }

  async getScheduledCampaignById(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM scheduled_campaigns WHERE id = $1', [id]);
        return result.rows[0] || null;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM scheduled_campaigns WHERE id = ?').get(id) || null;
    }
  }

  async createScheduledCampaign(data) {
    const { user_id, name, template_id, message, media_url, media_type, contacts, instance_ids, scheduled_at, repeat_type, repeat_interval, repeat_until } = data;
    const now = new Date().toISOString();
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO scheduled_campaigns (user_id, name, template_id, message, media_url, media_type, contacts, instance_ids, scheduled_at, repeat_type, repeat_interval, repeat_until, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [user_id, name, template_id, message, media_url, media_type, JSON.stringify(contacts), instance_ids ? JSON.stringify(instance_ids) : null, scheduled_at, repeat_type, repeat_interval, repeat_until, now]
        );
        return result.rows[0];
      } finally { client.release(); }
    } else {
      const result = this.db.prepare(
        `INSERT INTO scheduled_campaigns (user_id, name, template_id, message, media_url, media_type, contacts, instance_ids, scheduled_at, repeat_type, repeat_interval, repeat_until, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(user_id, name, template_id, message, media_url, media_type, JSON.stringify(contacts), instance_ids ? JSON.stringify(instance_ids) : null, scheduled_at, repeat_type, repeat_interval, repeat_until, now);
      return this.getScheduledCampaignById(result.lastInsertRowid);
    }
  }

  async updateScheduledCampaign(id, data) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && key !== 'id') {
            fields.push(`${key} = $${paramIndex++}`);
            values.push(typeof value === 'object' ? JSON.stringify(value) : value);
          }
        });
        if (fields.length === 0) return null;
        values.push(id);
        await client.query(`UPDATE scheduled_campaigns SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        return this.getScheduledCampaignById(id);
      } finally { client.release(); }
    } else {
      const fields = [];
      const values = [];
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }
      });
      if (fields.length === 0) return null;
      values.push(id);
      this.db.prepare(`UPDATE scheduled_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return this.getScheduledCampaignById(id);
    }
  }

  async deleteScheduledCampaign(id) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM scheduled_campaigns WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally { client.release(); }
    } else {
      return this.db.prepare('DELETE FROM scheduled_campaigns WHERE id = ?').run(id).changes > 0;
    }
  }

  async getPendingCampaigns() {
    const now = new Date().toISOString();
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT * FROM scheduled_campaigns WHERE status = $1 AND scheduled_at <= $2', ['pending', now]);
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare('SELECT * FROM scheduled_campaigns WHERE status = ? AND scheduled_at <= ?').all('pending', now);
    }
  }

  // ==================== MÉTRICAS E ANALYTICS ====================

  async recordMessageMetric(data) {
    const { user_id, campaign_id, instance_id, phone, status, error_message } = data;
    const now = new Date().toISOString();
    const date = now.split('T')[0];
    const field = status === 'sent' ? 'messages_sent' : status === 'delivered' ? 'messages_delivered' : status === 'read' ? 'messages_read' : 'messages_failed';
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query(
          'INSERT INTO message_metrics (user_id, campaign_id, instance_id, phone, status, error_message, sent_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [user_id, campaign_id, instance_id, phone, status, error_message, status === 'sent' ? now : null, now]
        );
        // Atualiza estatísticas diárias
        await client.query(
          `INSERT INTO daily_stats (user_id, date, ${field}) VALUES ($1, $2, 1) 
           ON CONFLICT(user_id, date) DO UPDATE SET ${field} = daily_stats.${field} + 1`,
          [user_id, date]
        );
      } finally { client.release(); }
    } else {
      this.db.prepare(
        'INSERT INTO message_metrics (user_id, campaign_id, instance_id, phone, status, error_message, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(user_id, campaign_id, instance_id, phone, status, error_message, status === 'sent' ? now : null, now);
      this.db.prepare(`INSERT INTO daily_stats (user_id, date, ${field}) VALUES (?, ?, 1) ON CONFLICT(user_id, date) DO UPDATE SET ${field} = ${field} + 1`).run(user_id, date);
    }
  }

  async updateMessageStatus(phone, campaignId, status) {
    const now = new Date().toISOString();
    const field = status === 'delivered' ? 'delivered_at' : status === 'read' ? 'read_at' : null;
    if (!field) return;
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        await client.query(`UPDATE message_metrics SET status = $1, ${field} = $2 WHERE phone = $3 AND campaign_id = $4`, [status, now, phone, campaignId]);
      } finally { client.release(); }
    } else {
      this.db.prepare(`UPDATE message_metrics SET status = ?, ${field} = ? WHERE phone = ? AND campaign_id = ?`).run(status, now, phone, campaignId);
    }
  }

  async getMessageMetrics(userId, startDate, endDate) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `SELECT status, COUNT(*) as count FROM message_metrics 
           WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3 
           GROUP BY status`,
          [userId, startDate, endDate]
        );
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare(
        `SELECT status, COUNT(*) as count FROM message_metrics 
         WHERE user_id = ? AND created_at >= ? AND created_at <= ? 
         GROUP BY status`
      ).all(userId, startDate, endDate);
    }
  }

  async getDailyStats(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM daily_stats WHERE user_id = $1 AND date >= $2 ORDER BY date ASC',
          [userId, startDate]
        );
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare(
        'SELECT * FROM daily_stats WHERE user_id = ? AND date >= ? ORDER BY date ASC'
      ).all(userId, startDate);
    }
  }

  async getCampaignMetrics(campaignId) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `SELECT status, COUNT(*) as count FROM message_metrics WHERE campaign_id = $1 GROUP BY status`,
          [campaignId]
        );
        return result.rows;
      } finally { client.release(); }
    } else {
      return this.db.prepare(
        `SELECT status, COUNT(*) as count FROM message_metrics WHERE campaign_id = ? GROUP BY status`
      ).all(campaignId);
    }
  }

  async getAnalyticsSummary(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        const statsResult = await client.query(`
          SELECT 
            COALESCE(SUM(messages_sent), 0) as total_sent,
            COALESCE(SUM(messages_delivered), 0) as total_delivered,
            COALESCE(SUM(messages_read), 0) as total_read,
            COALESCE(SUM(messages_failed), 0) as total_failed,
            COALESCE(SUM(campaigns_executed), 0) as total_campaigns
          FROM daily_stats WHERE user_id = $1 AND date >= $2
        `, [userId, startDate]);
        
        const dailyData = await this.getDailyStats(userId, days);
        
        const campaignsResult = await client.query(
          'SELECT * FROM scheduled_campaigns WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
          [userId]
        );
        
        return { 
          summary: statsResult.rows[0] || { total_sent: 0, total_delivered: 0, total_read: 0, total_failed: 0, total_campaigns: 0 }, 
          dailyData, 
          recentCampaigns: campaignsResult.rows 
        };
      } finally { client.release(); }
    } else {
      const stats = this.db.prepare(`
        SELECT 
          COALESCE(SUM(messages_sent), 0) as total_sent,
          COALESCE(SUM(messages_delivered), 0) as total_delivered,
          COALESCE(SUM(messages_read), 0) as total_read,
          COALESCE(SUM(messages_failed), 0) as total_failed,
          COALESCE(SUM(campaigns_executed), 0) as total_campaigns
        FROM daily_stats WHERE user_id = ? AND date >= ?
      `).get(userId, startDate);
      
      const dailyData = await this.getDailyStats(userId, days);
      const recentCampaigns = this.db.prepare(
        'SELECT * FROM scheduled_campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
      ).all(userId);
      
      return { summary: stats, dailyData, recentCampaigns };
    }
  }
}

// Exporta instância singleton
const dbManager = new DatabaseManager();
export default dbManager;
