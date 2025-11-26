import { logger } from '../config/logger.js';
import sessionManager from '../whatsapp/sessionManager.js';

/**
 * AutoPause - Sistema de pausa automática baseado em taxa de erros
 * Protege chips contra bloqueio ao detectar muitos erros consecutivos
 */
class AutoPause {
  constructor() {
    // Configurações padrão
    this.config = {
      windowSize: 20,           // Janela de mensagens para análise
      errorThreshold: 0.3,      // 30% de erros dispara pausa
      consecutiveErrors: 5,     // 5 erros consecutivos dispara pausa
      cooldownTime: 5 * 60 * 1000,  // 5 minutos de pausa
      enabled: true
    };

    // Estado por instância
    this.instanceStats = new Map();
    
    // Callbacks para notificar sobre pausas
    this.pauseCallbacks = [];
  }

  /**
   * Configura os parâmetros do auto-pause
   */
  configure(options = {}) {
    this.config = { ...this.config, ...options };
    logger.info(`⚙️ AutoPause configurado: ${JSON.stringify(this.config)}`);
  }

  /**
   * Habilita/desabilita o auto-pause
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    logger.info(`🔄 AutoPause ${enabled ? 'habilitado' : 'desabilitado'}`);
  }

  /**
   * Inicializa stats para uma instância
   */
  initInstance(instanceId) {
    if (!this.instanceStats.has(instanceId)) {
      this.instanceStats.set(instanceId, {
        results: [],           // Histórico de resultados (true = sucesso, false = erro)
        consecutiveErrors: 0,  // Contador de erros consecutivos
        isPaused: false,       // Se está pausado
        pausedAt: null,        // Quando foi pausado
        pauseReason: null,     // Motivo da pausa
        totalSent: 0,
        totalFailed: 0,
        lastError: null
      });
    }
    return this.instanceStats.get(instanceId);
  }

  /**
   * Registra resultado de um envio
   * @param {string} instanceId - ID da instância
   * @param {boolean} success - Se o envio foi bem-sucedido
   * @param {string} errorMessage - Mensagem de erro (se houver)
   * @returns {Object} Status após registro { shouldPause, reason, stats }
   */
  recordResult(instanceId, success, errorMessage = null) {
    if (!this.config.enabled) {
      return { shouldPause: false, reason: null, stats: null };
    }

    const stats = this.initInstance(instanceId);

    // Se já está pausado, não processa
    if (stats.isPaused) {
      return { shouldPause: true, reason: stats.pauseReason, stats };
    }

    // Registra resultado
    stats.results.push(success);
    if (success) {
      stats.totalSent++;
      stats.consecutiveErrors = 0;
    } else {
      stats.totalFailed++;
      stats.consecutiveErrors++;
      stats.lastError = errorMessage;
    }

    // Mantém apenas a janela de análise
    if (stats.results.length > this.config.windowSize) {
      stats.results.shift();
    }

    // Verifica se deve pausar
    const pauseCheck = this.checkShouldPause(instanceId, stats);
    
    if (pauseCheck.shouldPause) {
      this.pauseInstance(instanceId, pauseCheck.reason);
    }

    return {
      shouldPause: pauseCheck.shouldPause,
      reason: pauseCheck.reason,
      stats: this.getInstanceStats(instanceId)
    };
  }

  /**
   * Verifica se deve pausar baseado nas métricas
   */
  checkShouldPause(instanceId, stats) {
    // Verifica erros consecutivos
    if (stats.consecutiveErrors >= this.config.consecutiveErrors) {
      return {
        shouldPause: true,
        reason: `${stats.consecutiveErrors} erros consecutivos detectados`
      };
    }

    // Verifica taxa de erros na janela
    if (stats.results.length >= this.config.windowSize / 2) {
      const errors = stats.results.filter(r => !r).length;
      const errorRate = errors / stats.results.length;

      if (errorRate >= this.config.errorThreshold) {
        return {
          shouldPause: true,
          reason: `Taxa de erros alta: ${(errorRate * 100).toFixed(1)}% nas últimas ${stats.results.length} mensagens`
        };
      }
    }

    return { shouldPause: false, reason: null };
  }

  /**
   * Pausa uma instância
   */
  pauseInstance(instanceId, reason) {
    const stats = this.instanceStats.get(instanceId);
    if (!stats || stats.isPaused) return;

    stats.isPaused = true;
    stats.pausedAt = Date.now();
    stats.pauseReason = reason;

    logger.warn(`🚨 AUTO-PAUSE ATIVADO para instância ${instanceId}`);
    logger.warn(`📛 Motivo: ${reason}`);
    logger.warn(`⏳ Cooldown: ${this.config.cooldownTime / 1000}s`);

    // Notifica callbacks
    this.pauseCallbacks.forEach(cb => {
      try {
        cb({
          type: 'pause',
          instanceId,
          reason,
          cooldownTime: this.config.cooldownTime,
          stats: this.getInstanceStats(instanceId)
        });
      } catch (e) {
        logger.error('Erro no callback de pausa:', e);
      }
    });

    // Agenda retomada automática
    setTimeout(() => {
      this.resumeInstance(instanceId, true);
    }, this.config.cooldownTime);
  }

  /**
   * Retoma uma instância pausada
   */
  resumeInstance(instanceId, automatic = false) {
    const stats = this.instanceStats.get(instanceId);
    if (!stats || !stats.isPaused) return;

    stats.isPaused = false;
    stats.pausedAt = null;
    stats.pauseReason = null;
    stats.consecutiveErrors = 0;
    stats.results = []; // Limpa histórico para recomeçar

    const resumeType = automatic ? 'automática' : 'manual';
    logger.info(`✅ Instância ${instanceId} retomada (${resumeType})`);

    // Notifica callbacks
    this.pauseCallbacks.forEach(cb => {
      try {
        cb({
          type: 'resume',
          instanceId,
          automatic,
          stats: this.getInstanceStats(instanceId)
        });
      } catch (e) {
        logger.error('Erro no callback de retomada:', e);
      }
    });
  }

  /**
   * Verifica se uma instância está pausada
   */
  isInstancePaused(instanceId) {
    const stats = this.instanceStats.get(instanceId);
    return stats?.isPaused || false;
  }

  /**
   * Obtém tempo restante de pausa
   */
  getRemainingCooldown(instanceId) {
    const stats = this.instanceStats.get(instanceId);
    if (!stats?.isPaused || !stats.pausedAt) return 0;

    const elapsed = Date.now() - stats.pausedAt;
    const remaining = this.config.cooldownTime - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Obtém estatísticas de uma instância
   */
  getInstanceStats(instanceId) {
    const stats = this.instanceStats.get(instanceId);
    if (!stats) return null;

    const recentErrors = stats.results.filter(r => !r).length;
    const recentTotal = stats.results.length;
    const errorRate = recentTotal > 0 ? recentErrors / recentTotal : 0;

    return {
      instanceId,
      isPaused: stats.isPaused,
      pauseReason: stats.pauseReason,
      remainingCooldown: this.getRemainingCooldown(instanceId),
      consecutiveErrors: stats.consecutiveErrors,
      recentErrorRate: errorRate,
      recentErrors,
      recentTotal,
      totalSent: stats.totalSent,
      totalFailed: stats.totalFailed,
      lastError: stats.lastError,
      health: this.calculateHealth(errorRate, stats.consecutiveErrors)
    };
  }

  /**
   * Calcula "saúde" da instância (0-100)
   */
  calculateHealth(errorRate, consecutiveErrors) {
    // Penaliza por taxa de erros
    let health = 100 - (errorRate * 100);
    
    // Penaliza por erros consecutivos
    health -= (consecutiveErrors * 10);
    
    return Math.max(0, Math.min(100, Math.round(health)));
  }

  /**
   * Obtém estatísticas de todas as instâncias
   */
  getAllStats() {
    const result = {};
    for (const [instanceId] of this.instanceStats) {
      result[instanceId] = this.getInstanceStats(instanceId);
    }
    return result;
  }

  /**
   * Registra callback para eventos de pausa/retomada
   */
  onPauseEvent(callback) {
    this.pauseCallbacks.push(callback);
  }

  /**
   * Reseta estatísticas de uma instância
   */
  resetInstance(instanceId) {
    this.instanceStats.delete(instanceId);
    logger.info(`🔄 Estatísticas resetadas para instância ${instanceId}`);
  }

  /**
   * Reseta todas as estatísticas
   */
  resetAll() {
    this.instanceStats.clear();
    logger.info('🔄 Todas as estatísticas de AutoPause resetadas');
  }

  /**
   * Obtém configuração atual
   */
  getConfig() {
    return { ...this.config };
  }
}

// Exporta instância singleton
export const autoPause = new AutoPause();
export default autoPause;
