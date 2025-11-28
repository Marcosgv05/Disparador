import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import { logger } from '../config/logger.js';

// Pool de conexões PostgreSQL (se disponível)
let pgPool = null;
const isProduction = !!process.env.DATABASE_URL;

if (isProduction) {
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}

/**
 * InstanceManager - Gerencia instâncias com persistência
 * Usa PostgreSQL em produção e arquivo JSON em desenvolvimento
 */
class InstanceManager {
  constructor() {
    this.instances = [];
    this.instancesFile = path.join(process.cwd(), 'instances.json');
    this.isProduction = isProduction;
  }

  /**
   * Inicializa tabela no PostgreSQL
   */
  async initPostgresTable() {
    if (!this.isProduction) return;
    
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_instances (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name TEXT,
          session_id TEXT,
          status TEXT DEFAULT 'disconnected',
          phone TEXT,
          last_activity TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logger.info('✅ Tabela whatsapp_instances inicializada (PostgreSQL)');
    } catch (error) {
      logger.error(`Erro ao criar tabela whatsapp_instances: ${error.message}`);
    }
  }

  /**
   * Formata número com zero à esquerda
   */
  formatNumber(number) {
    return String(number).padStart(2, '0');
  }

  /**
   * Extrai número do ID da instância
   */
  extractNumber(instanceId) {
    if (!instanceId) return null;
    const match = String(instanceId).match(/instance-(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Obtém próximo número disponível para um usuário específico
   */
  getNextInstanceNumber(userId = null) {
    // Filtra instâncias do usuário se userId fornecido
    const userInstances = userId 
      ? this.instances.filter(i => i.userId === userId)
      : this.instances;

    const usedNumbers = new Set(
      userInstances
        .map(instance => this.extractNumber(instance.id))
        .filter(number => Number.isInteger(number) && number > 0)
    );

    let candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
    return candidate;
  }

  /**
   * Normaliza instâncias removendo duplicatas
   */
  normalizeInstances() {
    if (!Array.isArray(this.instances) || this.instances.length === 0) {
      return;
    }

    const seen = new Map();
    const normalized = [];

    // Ordena por número extraído do ID
    const sorted = [...this.instances].sort((a, b) => {
      const numA = this.extractNumber(a.id) ?? Number.MAX_SAFE_INTEGER;
      const numB = this.extractNumber(b.id) ?? Number.MAX_SAFE_INTEGER;
      return numA - numB;
    });

    // Remove duplicatas mantendo a primeira ocorrência
    for (const instance of sorted) {
      const number = this.extractNumber(instance.id);
      if (number && !seen.has(number)) {
        seen.set(number, true);
        const formatted = this.formatNumber(number);
        normalized.push({
          ...instance,
          id: `instance-${formatted}`,
          name: instance.name || `Instância ${formatted}`
        });
      }
    }

    this.instances = normalized;
  }

  /**
   * Inicializa e carrega instâncias salvas
   */
  async initialize() {
    // Inicializa tabela PostgreSQL se em produção
    await this.initPostgresTable();
    
    await this.loadInstances();
    this.normalizeInstances();
    
    // NÃO cria instâncias fixas automaticamente em modo multi-tenant
    // Cada usuário criará suas próprias instâncias
    
    logger.info(`📱 ${this.instances.length} instâncias carregadas`);
  }

  /**
   * Adiciona nova instância
   */
  addInstance(instanceData, userId) {
    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    // Calcula o próximo número baseado apenas nas instâncias do usuário
    const number = this.getNextInstanceNumber(userId);
    const formatted = this.formatNumber(number);

    const instance = {
      id: `instance-${formatted}`,
      name: instanceData.name || `Instância ${number}`,
      sessionId: instanceData.sessionId || null,
      status: instanceData.status || 'disconnected',
      phone: instanceData.phone || null,
      userId: userId,
      createdAt: instanceData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.instances.push(instance);
    
    // Ordena instâncias por número
    this.instances.sort((a, b) => {
      const numA = this.extractNumber(a.id) ?? Number.MAX_SAFE_INTEGER;
      const numB = this.extractNumber(b.id) ?? Number.MAX_SAFE_INTEGER;
      return numA - numB;
    });
    
    this.saveInstances();
    
    logger.info(`📱 Instância "${instance.name}" adicionada para usuário ${userId}`);
    return instance;
  }

  /**
   * Atualiza instância
   */
  updateInstance(instanceId, updates, userId = null) {
    let index;
    if (userId) {
      index = this.instances.findIndex(i => i.id === instanceId && i.userId === userId);
    } else {
      index = this.instances.findIndex(i => i.id === instanceId);
    }
    
    if (index === -1) {
      throw new Error(userId ? 'Instância não encontrada para este usuário' : 'Instância não encontrada');
    }

    this.instances[index] = {
      ...this.instances[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveInstances();
    return this.instances[index];
  }

  /**
   * Remove instância
   */
  async removeInstance(instanceId, userId = null) {
    let index;
    if (userId) {
      index = this.instances.findIndex(i => i.id === instanceId && i.userId === userId);
    } else {
      index = this.instances.findIndex(i => i.id === instanceId);
    }
    
    if (index === -1) {
      throw new Error(userId ? 'Instância não encontrada para este usuário' : 'Instância não encontrada');
    }

    const instance = this.instances[index];
    this.instances.splice(index, 1);
    
    // Remove do PostgreSQL se em produção
    await this.deleteInstanceFromDB(instanceId);
    await this.saveInstances();
    
    logger.info(`📱 Instância "${instance.name}" removida`);
    return instance;
  }

  /**
   * Obtém instância por ID
   */
  getInstance(instanceId, userId = null) {
    const instance = this.instances.find(i => {
      if (userId) {
        return i.id === instanceId && i.userId === userId;
      }
      return i.id === instanceId;
    });

    if (!instance) {
      return null;
    }

    return instance;
  }

  /**
   * Obtém instância por sessionId
   */
  getInstanceBySession(sessionId) {
    return this.instances.find(i => i.sessionId === sessionId);
  }

  /**
   * Lista todas as instâncias (opcionalmente filtradas por userId)
   */
  listInstances(userId = null) {
    if (userId) {
      return this.instances.filter(i => i.userId === userId);
    }
    return [...this.instances];
  }

  /**
   * Salva instâncias (PostgreSQL em produção, arquivo em desenvolvimento)
   */
  async saveInstances() {
    try {
      if (this.isProduction) {
        // PostgreSQL: salva cada instância individualmente
        for (const instance of this.instances) {
          await pgPool.query(`
            INSERT INTO whatsapp_instances (id, user_id, name, session_id, status, phone, last_activity, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
              name = $3,
              session_id = $4,
              status = $5,
              phone = $6,
              last_activity = $7,
              updated_at = CURRENT_TIMESTAMP
          `, [
            instance.id,
            instance.userId,
            instance.name,
            instance.sessionId,
            instance.status,
            instance.phone,
            instance.lastActivity || null
          ]);
        }
      } else {
        // Desenvolvimento: salva em arquivo JSON
        await fs.writeFile(
          this.instancesFile,
          JSON.stringify(this.instances, null, 2),
          'utf-8'
        );
      }
    } catch (error) {
      logger.error(`Erro ao salvar instâncias: ${error.message}`);
    }
  }

  /**
   * Carrega instâncias (PostgreSQL em produção, arquivo em desenvolvimento)
   */
  async loadInstances() {
    try {
      if (this.isProduction) {
        // PostgreSQL
        const result = await pgPool.query('SELECT * FROM whatsapp_instances ORDER BY id');
        this.instances = result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          sessionId: row.session_id,
          status: row.status || 'disconnected',
          phone: row.phone,
          lastActivity: row.last_activity,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      } else {
        // Desenvolvimento: carrega de arquivo JSON
        const data = await fs.readFile(this.instancesFile, 'utf-8');
        this.instances = JSON.parse(data);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Erro ao carregar instâncias: ${error.message}`);
      }
      this.instances = [];
    }
  }

  /**
   * Remove instância do banco de dados (PostgreSQL)
   */
  async deleteInstanceFromDB(instanceId) {
    if (this.isProduction) {
      try {
        await pgPool.query('DELETE FROM whatsapp_instances WHERE id = $1', [instanceId]);
      } catch (error) {
        logger.error(`Erro ao deletar instância do DB: ${error.message}`);
      }
    }
  }

  /**
   * Limpa instâncias desconectadas antigas
   */
  async cleanupOldInstances(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const before = this.instances.length;
    
    this.instances = this.instances.filter(instance => {
      if (instance.status === 'disconnected') {
        const updatedAt = new Date(instance.updatedAt);
        return updatedAt > cutoffDate;
      }
      return true;
    });

    const removed = before - this.instances.length;
    
    if (removed > 0) {
      await this.saveInstances();
      logger.info(`🧹 ${removed} instâncias antigas removidas`);
    }

    return removed;
  }
}

export default new InstanceManager();
