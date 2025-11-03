import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger.js';

/**
 * InstanceManager - Gerencia instâncias com persistência
 */
class InstanceManager {
  constructor() {
    this.instances = [];
    this.instancesFile = path.join(process.cwd(), 'instances.json');
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
    const index = this.instances.findIndex(i => i.id === instanceId);
    
    if (index === -1) {
      throw new Error('Instância não encontrada');
    }

    // Valida propriedade se userId fornecido
    if (userId && this.instances[index].userId !== userId) {
      throw new Error('Acesso negado a esta instância');
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
  removeInstance(instanceId, userId = null) {
    const index = this.instances.findIndex(i => i.id === instanceId);
    
    if (index === -1) {
      throw new Error('Instância não encontrada');
    }

    // Valida propriedade se userId fornecido
    if (userId && this.instances[index].userId !== userId) {
      throw new Error('Acesso negado a esta instância');
    }

    const instance = this.instances[index];
    this.instances.splice(index, 1);
    this.saveInstances();
    
    logger.info(`📱 Instância "${instance.name}" removida`);
    return instance;
  }

  /**
   * Obtém instância por ID
   */
  getInstance(instanceId, userId = null) {
    const instance = this.instances.find(i => i.id === instanceId);
    
    if (!instance) {
      return null;
    }

    // Valida propriedade se userId fornecido
    if (userId && instance.userId !== userId) {
      throw new Error('Acesso negado a esta instância');
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
   * Salva instâncias em arquivo
   */
  async saveInstances() {
    try {
      await fs.writeFile(
        this.instancesFile,
        JSON.stringify(this.instances, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error(`Erro ao salvar instâncias: ${error.message}`);
    }
  }

  /**
   * Carrega instâncias do arquivo
   */
  async loadInstances() {
    try {
      const data = await fs.readFile(this.instancesFile, 'utf-8');
      this.instances = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Erro ao carregar instâncias: ${error.message}`);
      }
      this.instances = [];
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
