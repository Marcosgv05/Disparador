import { logger } from '../config/logger.js';

class QueueManager {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Cria uma nova fila
   * @param {string} queueId - ID único da fila
   */
  createQueue(queueId) {
    if (this.queues.has(queueId)) {
      throw new Error(`Fila ${queueId} já existe`);
    }

    this.queues.set(queueId, {
      id: queueId,
      items: [],
      status: 'idle', // idle, processing, completed, error
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      results: []
    });

    logger.info(`Fila ${queueId} criada`);
    return this.queues.get(queueId);
  }

  /**
   * Adiciona itens à fila
   * @param {string} queueId 
   * @param {Array} items 
   */
  addItems(queueId, items) {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }

    queue.items.push(...items);
    logger.info(`${items.length} itens adicionados à fila ${queueId}`);
  }

  /**
   * Processa a fila com uma função callback
   * @param {string} queueId 
   * @param {Function} processor - Função que processa cada item
   */
  async processQueue(queueId, processor) {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }

    if (queue.status === 'processing') {
      throw new Error(`Fila ${queueId} já está sendo processada`);
    }

    queue.status = 'processing';
    queue.startedAt = new Date();

    logger.info(`Iniciando processamento da fila ${queueId} com ${queue.items.length} itens`);

    try {
      for (let i = 0; i < queue.items.length; i++) {
        const item = queue.items[i];
        
        try {
          const result = await processor(item, i, queue.items.length);
          queue.results.push({
            item,
            success: true,
            result
          });
        } catch (error) {
          queue.results.push({
            item,
            success: false,
            error: error.message
          });
          logger.error(`Erro ao processar item ${i + 1}:`, error.message);
        }
      }

      queue.status = 'completed';
      queue.completedAt = new Date();
      
      logger.info(`Fila ${queueId} processada com sucesso`);
      
      return queue.results;
    } catch (error) {
      queue.status = 'error';
      logger.error(`Erro ao processar fila ${queueId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém o status de uma fila
   * @param {string} queueId 
   */
  getQueueStatus(queueId) {
    const queue = this.queues.get(queueId);
    if (!queue) {
      return null;
    }

    const processed = queue.results.length;
    const total = queue.items.length;
    const successful = queue.results.filter(r => r.success).length;
    const failed = queue.results.filter(r => !r.success).length;

    return {
      id: queue.id,
      status: queue.status,
      total,
      processed,
      successful,
      failed,
      progress: total > 0 ? (processed / total) * 100 : 0,
      createdAt: queue.createdAt,
      startedAt: queue.startedAt,
      completedAt: queue.completedAt
    };
  }

  /**
   * Remove uma fila
   * @param {string} queueId 
   */
  removeQueue(queueId) {
    const deleted = this.queues.delete(queueId);
    if (deleted) {
      logger.info(`Fila ${queueId} removida`);
    }
    return deleted;
  }

  /**
   * Lista todas as filas
   */
  listQueues() {
    return Array.from(this.queues.keys()).map(queueId => 
      this.getQueueStatus(queueId)
    );
  }
}

export default new QueueManager();
