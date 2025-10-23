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
   * Inicializa e carrega instâncias salvas
   */
  async initialize() {
    await this.loadInstances();
    logger.info(`📱 ${this.instances.length} instâncias carregadas`);
  }

  /**
   * Adiciona nova instância
   */
  addInstance(instanceData) {
    const instance = {
      id: instanceData.id || `instance-${Date.now()}`,
      name: instanceData.name || `Instância ${this.instances.length + 1}`,
      sessionId: instanceData.sessionId || null,
      status: instanceData.status || 'disconnected',
      phone: instanceData.phone || null,
      createdAt: instanceData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.instances.push(instance);
    this.saveInstances();
    
    logger.info(`📱 Instância "${instance.name}" adicionada`);
    return instance;
  }

  /**
   * Atualiza instância
   */
  updateInstance(instanceId, updates) {
    const index = this.instances.findIndex(i => i.id === instanceId);
    
    if (index === -1) {
      throw new Error('Instância não encontrada');
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
  removeInstance(instanceId) {
    const index = this.instances.findIndex(i => i.id === instanceId);
    
    if (index === -1) {
      throw new Error('Instância não encontrada');
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
  getInstance(instanceId) {
    return this.instances.find(i => i.id === instanceId);
  }

  /**
   * Obtém instância por sessionId
   */
  getInstanceBySession(sessionId) {
    return this.instances.find(i => i.sessionId === sessionId);
  }

  /**
   * Lista todas as instâncias
   */
  listInstances() {
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
