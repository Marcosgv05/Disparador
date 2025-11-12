/**
 * Adapter para salvar estado de autenticação do Baileys no banco de dados
 * Usa PostgreSQL no Railway e SQLite localmente
 */
import { logger } from '../config/logger.js';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import pg from 'pg';

// Detecta se está em produção (Railway) ou desenvolvimento (local)
const isProduction = process.env.DATABASE_URL !== undefined;
let db = null;
let pgPool = null;

if (isProduction) {
  // PRODUÇÃO: Usa PostgreSQL
  logger.info('🚀 Usando PostgreSQL para sessões WhatsApp (Railway)');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
} else {
  // DESENVOLVIMENTO: Usa SQLite
  logger.info('💻 Usando SQLite para sessões WhatsApp (Local)');
  const { default: Database } = await import('../config/database.js');
  db = Database;
}

// Cria tabela para armazenar credenciais de autenticação
async function initAuthTable() {
  try {
    if (isProduction) {
      // PostgreSQL
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_auth (
          session_id TEXT NOT NULL,
          data_key TEXT NOT NULL,
          data_value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (session_id, data_key)
        )
      `);
      logger.info('✅ Tabela whatsapp_auth inicializada (PostgreSQL)');
    } else {
      // SQLite
      db.exec(`
        CREATE TABLE IF NOT EXISTS whatsapp_auth (
          session_id TEXT NOT NULL,
          data_key TEXT NOT NULL,
          data_value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (session_id, data_key)
        )
      `);
      logger.info('✅ Tabela whatsapp_auth inicializada (SQLite)');
    }
  } catch (error) {
    logger.error(`Erro ao criar tabela whatsapp_auth: ${error.message}`);
  }
}

await initAuthTable();

/**
 * Usa banco de dados como armazenamento de auth state
 * Compatível com useMultiFileAuthState do Baileys
 */
export async function useDatabaseAuthState(sessionId) {
  // Função para escrever dados
  const writeData = async (key, data) => {
    try {
      // Ignora chaves de app state que causam "Invalid patch mac"
      if (key.startsWith('app-state-sync-key-') || key.startsWith('app-state-sync-version-')) {
        logger.debug(`Ignorando chave de app state: ${key}`);
        return;
      }
      
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      
      if (isProduction) {
        // PostgreSQL
        await pgPool.query(`
          INSERT INTO whatsapp_auth (session_id, data_key, data_value, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (session_id, data_key) 
          DO UPDATE SET data_value = $3, updated_at = CURRENT_TIMESTAMP
        `, [sessionId, key, serialized]);
      } else {
        // SQLite
        const stmt = db.prepare(`
          INSERT INTO whatsapp_auth (session_id, data_key, data_value, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(session_id, data_key) 
          DO UPDATE SET data_value = ?, updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(sessionId, key, serialized, serialized);
      }
    } catch (error) {
      logger.error(`Erro ao salvar ${key} para ${sessionId}: ${error.message}`);
    }
  };

  // Função para ler dados
  const readData = async (key) => {
    try {
      let row;
      
      if (isProduction) {
        // PostgreSQL
        const result = await pgPool.query(`
          SELECT data_value FROM whatsapp_auth 
          WHERE session_id = $1 AND data_key = $2
        `, [sessionId, key]);
        row = result.rows[0];
      } else {
        // SQLite
        const stmt = db.prepare(`
          SELECT data_value FROM whatsapp_auth 
          WHERE session_id = ? AND data_key = ?
        `);
        row = stmt.get(sessionId, key);
      }
      
      if (!row) return null;
      
      return JSON.parse(row.data_value, BufferJSON.reviver);
    } catch (error) {
      logger.error(`Erro ao ler ${key} para ${sessionId}: ${error.message}`);
      return null;
    }
  };

  // Função para remover dados
  const removeData = async (key) => {
    try {
      if (isProduction) {
        // PostgreSQL
        await pgPool.query(`
          DELETE FROM whatsapp_auth 
          WHERE session_id = $1 AND data_key = $2
        `, [sessionId, key]);
      } else {
        // SQLite
        const stmt = db.prepare(`
          DELETE FROM whatsapp_auth 
          WHERE session_id = ? AND data_key = ?
        `);
        stmt.run(sessionId, key);
      }
    } catch (error) {
      logger.error(`Erro ao remover ${key} para ${sessionId}: ${error.message}`);
    }
  };

  // Carrega ou cria credenciais
  let creds = await readData('creds') || initAuthCreds();
  
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = BufferJSON.reviver('', value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                await writeData(key, value);
              } else {
                await removeData(key);
              }
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    }
  };
}

/**
 * Remove todas as credenciais de uma sessão
 */
export async function clearAuthState(sessionId) {
  try {
    if (isProduction) {
      // PostgreSQL
      const result = await pgPool.query('DELETE FROM whatsapp_auth WHERE session_id = $1', [sessionId]);
      logger.info(`🗑️ ${result.rowCount} registros de auth removidos para ${sessionId}`);
      return result.rowCount;
    } else {
      // SQLite
      const stmt = db.prepare('DELETE FROM whatsapp_auth WHERE session_id = ?');
      const result = stmt.run(sessionId);
      logger.info(`🗑️ ${result.changes} registros de auth removidos para ${sessionId}`);
      return result.changes;
    }
  } catch (error) {
    logger.error(`Erro ao limpar auth state de ${sessionId}: ${error.message}`);
    return 0;
  }
}

/**
 * Lista todas as sessões que têm dados salvos
 */
export async function listAuthSessions() {
  try {
    if (isProduction) {
      // PostgreSQL
      const result = await pgPool.query(`
        SELECT DISTINCT session_id, COUNT(*) as keys_count, MAX(updated_at) as last_update
        FROM whatsapp_auth 
        GROUP BY session_id
        ORDER BY last_update DESC
      `);
      return result.rows;
    } else {
      // SQLite
      const stmt = db.prepare(`
        SELECT DISTINCT session_id, COUNT(*) as keys_count, MAX(updated_at) as last_update
        FROM whatsapp_auth 
        GROUP BY session_id
        ORDER BY last_update DESC
      `);
      return stmt.all();
    }
  } catch (error) {
    logger.error(`Erro ao listar sessões: ${error.message}`);
    return [];
  }
}
