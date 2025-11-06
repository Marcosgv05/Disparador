/**
 * Adapter para salvar estado de autenticação do Baileys no banco de dados
 * Resolve problema de persistência no Railway
 */
import db from '../config/database.js';
import { logger } from '../config/logger.js';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

// Cria tabela para armazenar credenciais de autenticação
function initAuthTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_auth (
        session_id TEXT NOT NULL,
        data_key TEXT NOT NULL,
        data_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, data_key)
      )
    `);
    logger.info('✅ Tabela whatsapp_auth inicializada');
  } catch (error) {
    logger.error(`Erro ao criar tabela whatsapp_auth: ${error.message}`);
  }
}

initAuthTable();

/**
 * Usa banco de dados como armazenamento de auth state
 * Compatível com useMultiFileAuthState do Baileys
 */
export async function useDatabaseAuthState(sessionId) {
  // Função para escrever dados
  const writeData = (key, data) => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      const stmt = db.prepare(`
        INSERT INTO whatsapp_auth (session_id, data_key, data_value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id, data_key) 
        DO UPDATE SET data_value = ?, updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(sessionId, key, serialized, serialized);
    } catch (error) {
      logger.error(`Erro ao salvar ${key} para ${sessionId}: ${error.message}`);
    }
  };

  // Função para ler dados
  const readData = (key) => {
    try {
      const stmt = db.prepare(`
        SELECT data_value FROM whatsapp_auth 
        WHERE session_id = ? AND data_key = ?
      `);
      const row = stmt.get(sessionId, key);
      
      if (!row) return null;
      
      return JSON.parse(row.data_value, BufferJSON.reviver);
    } catch (error) {
      logger.error(`Erro ao ler ${key} para ${sessionId}: ${error.message}`);
      return null;
    }
  };

  // Função para remover dados
  const removeData = (key) => {
    try {
      const stmt = db.prepare(`
        DELETE FROM whatsapp_auth 
        WHERE session_id = ? AND data_key = ?
      `);
      stmt.run(sessionId, key);
    } catch (error) {
      logger.error(`Erro ao remover ${key} para ${sessionId}: ${error.message}`);
    }
  };

  // Carrega ou cria credenciais
  let creds = readData('creds') || initAuthCreds();
  
  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = BufferJSON.reviver('', value);
            }
            data[id] = value;
          }
          return data;
        },
        set: (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                writeData(key, value);
              } else {
                removeData(key);
              }
            }
          }
        }
      }
    },
    saveCreds: () => {
      writeData('creds', creds);
    }
  };
}

/**
 * Remove todas as credenciais de uma sessão
 */
export function clearAuthState(sessionId) {
  try {
    const stmt = db.prepare('DELETE FROM whatsapp_auth WHERE session_id = ?');
    const result = stmt.run(sessionId);
    logger.info(`🗑️ ${result.changes} registros de auth removidos para ${sessionId}`);
    return result.changes;
  } catch (error) {
    logger.error(`Erro ao limpar auth state de ${sessionId}: ${error.message}`);
    return 0;
  }
}

/**
 * Lista todas as sessões que têm dados salvos
 */
export function listAuthSessions() {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT session_id, COUNT(*) as keys_count, MAX(updated_at) as last_update
      FROM whatsapp_auth 
      GROUP BY session_id
      ORDER BY last_update DESC
    `);
    return stmt.all();
  } catch (error) {
    logger.error(`Erro ao listar sessões: ${error.message}`);
    return [];
  }
}
