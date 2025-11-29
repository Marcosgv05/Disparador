import campaignManager from './campaignManager.js';
import messageSender from './messageSender.js';
import messageRotator from './messageRotator.js';
import { logger } from '../config/logger.js';
import { delay, humanizedDelay, getDelayInfo } from '../utils/delay.js';
import { settings } from '../config/settings.js';
import autoPause from './autoPause.js';
import dbManager from '../db/database.js';

/**
 * Dispatcher - Executa campanhas de forma controlada
 */
class Dispatcher {
  constructor() {
    this.isRunning = false;
    this.currentCampaign = null;
    this.messageIndex = 0; // Contador para pausas periódicas
  }

  /**
   * Executa uma campanha
   * @param {string} campaignName 
   * @param {Object} options - Opções de delay customizadas
   * @param {number} options.messageDelay - Delay MÁXIMO entre mensagens em ms (será randomizado)
   * @param {number} options.numberDelay - Delay MÁXIMO entre números em ms (será randomizado)
   * @param {boolean} options.useHumanizedDelay - Se deve usar delay humanizado (padrão: true)
   */
  async runCampaign(campaignName, options = {}) {
    try {
      const campaign = campaignManager.getCampaign(campaignName);
      if (!campaign) {
        throw new Error(`Campanha "${campaignName}" não encontrada`);
      }

      if (this.isRunning) {
        throw new Error('Já existe uma campanha em execução');
      }

      this.isRunning = true;
      this.currentCampaign = campaignName;
      this.messageIndex = 0;

      // Define delays MÁXIMOS (usa customizados ou padrão)
      const maxMessageDelay = options.messageDelay || settings.messageDelay;
      const maxNumberDelay = options.numberDelay || settings.numberDelay;
      const useHumanizedDelay = options.useHumanizedDelay !== false; // Padrão: true
      const pauseAfterMessages = options.pauseAfterMessages || null;
      const pauseDurationMs = options.pauseDuration || null;
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      const enableTyping = !!options.enableTyping;

      // Inicia a campanha
      campaignManager.startCampaign(campaignName);

      // Carrega mensagens no rotator
      messageRotator.loadMessages(campaign.messages);

      // Info sobre delays humanizados
      const delayInfo = getDelayInfo(maxMessageDelay);

      logger.info(`\n🚀 Iniciando disparo da campanha "${campaignName}"`);
      logger.info(`📊 Total de números: ${campaign.numbers.length}`);
      logger.info(`📝 Total de mensagens: ${campaign.messages.length}`);
      if (useHumanizedDelay) {
        logger.info(`⏱️ Delay humanizado: ${delayInfo.minSeconds}s - ${delayInfo.maxSeconds}s (média: ${delayInfo.averageSeconds}s)`);
        logger.info(`🔄 Pausas longas a cada 10 mensagens para simular comportamento humano`);
      } else {
        logger.info(`⏱️ Delay fixo: ${maxMessageDelay}ms`);
      }
      logger.info('');

      // Loop de envio
      while (campaignManager.canContinue(campaignName)) {
        // Verifica se foi pausado
        const currentCampaign = campaignManager.getCampaign(campaignName);
        
        if (currentCampaign.status === 'paused') {
          logger.info('⏸️ Campanha pausada. Aguardando retomada...');
          await delay(1000);
          continue;
        }

        if (currentCampaign.status === 'stopped') {
          logger.info('⏹️ Campanha parada pelo usuário');
          break;
        }

        // Obtém o próximo contato
        const contact = campaignManager.getNextContact(campaignName);
        if (!contact) {
          break;
        }
        const phoneNumber = contact.phone;

        // Monta variáveis para personalização da mensagem
        const variables = {
          nome: contact.name || '',
          telefone: contact.phone || '',
          phone: contact.phone || ''
        };

        // Obtém a próxima mensagem com variáveis substituídas
        const message = messageRotator.getNextCustomMessage(variables);

        // Envia a mensagem
        logger.info(`📤 Enviando para ${phoneNumber}...`);
        const result = await messageSender.sendMessage(
          phoneNumber,
          message,
          null,
          campaignName,
          campaign.userId,
          { 
            enableTyping,
            linkedInstances: campaign.linkedInstances || []
          }
        );

        // Atualiza status do contato
        if (result.success) {
          campaignManager.updateContactStatus(campaignName, phoneNumber, 'sent', {
            messageId: result.messageId,
            sessionId: result.sessionId
          });
          
          // Rastreia estatísticas por instância
          if (result.sessionId) {
            campaignManager.trackInstanceStat(campaignName, result.sessionId, 'sent');
          }
          
          // Registra métrica no banco de dados para analytics
          try {
            await dbManager.recordMessageMetric({
              user_id: campaign.userId,
              campaign_id: campaignName,
              instance_id: result.sessionId,
              phone: phoneNumber,
              status: 'sent'
            });
          } catch (e) {
            logger.warn(`Erro ao registrar métrica: ${e.message}`);
          }
        } else {
          campaignManager.updateContactStatus(campaignName, phoneNumber, 'failed', {
            error: result.error
          });
          
          // Registra falha no banco de dados para analytics
          try {
            await dbManager.recordMessageMetric({
              user_id: campaign.userId,
              campaign_id: campaignName,
              instance_id: result.sessionId,
              phone: phoneNumber,
              status: 'failed',
              error_message: result.error
            });
          } catch (e) {
            logger.warn(`Erro ao registrar métrica de falha: ${e.message}`);
          }
        }

        // Registra resultado no AutoPause para monitorar taxa de erros
        if (result.sessionId) {
          const pauseCheck = autoPause.recordResult(result.sessionId, result.success, result.error);
          
          if (pauseCheck.shouldPause) {
            logger.warn(`🚨 ALERTA: Instância ${result.sessionId} pausada automaticamente!`);
            logger.warn(`📛 Motivo: ${pauseCheck.reason}`);
            logger.warn(`⏳ Aguardando cooldown de ${autoPause.getConfig().cooldownTime / 1000}s...`);
            
            // Aguarda cooldown antes de continuar
            await delay(autoPause.getConfig().cooldownTime);
            logger.info(`✅ Cooldown finalizado, retomando envios...`);
          } else if (pauseCheck.stats) {
            // Mostra health da instância se estiver baixo
            if (pauseCheck.stats.health < 70) {
              logger.warn(`⚠️ Saúde da instância ${result.sessionId}: ${pauseCheck.stats.health}% (${pauseCheck.stats.consecutiveErrors} erros consecutivos)`);
            }
          }
        }

        // Atualiza progresso
        const updatedCampaign = campaignManager.updateProgress(campaignName, result);

        // Notifica callback de progresso (usado para WebSocket "progress")
        if (onProgress) {
          try {
            onProgress({ campaign: updatedCampaign });
          } catch (error) {
            logger.warn(`Erro ao executar callback de progresso: ${error.message}`);
          }
        }

        // Log do resultado
        const stats = updatedCampaign.stats;
        logger.info(`Progresso: ${stats.sent + stats.failed}/${stats.total} | ✅ ${stats.sent} | ❌ ${stats.failed} | ⏳ ${stats.pending}`);

        // Incrementa contador de mensagens
        this.messageIndex++;

        // Pausa configurada pelo usuário (quando atinge múltiplos de pauseAfterMessages)
        if (pauseAfterMessages && pauseDurationMs && this.messageIndex % pauseAfterMessages === 0) {
          logger.info(`⏸️ Pausa configurada pelo usuário após ${this.messageIndex} mensagens. Aguardando ${(pauseDurationMs / 1000).toFixed(1)}s...`);
          await delay(pauseDurationMs);
          logger.info('▶️ Fim da pausa configurada, retomando envios...');
        }

        // Delay antes do próximo envio (humanizado ou fixo)
        if (useHumanizedDelay) {
          const { delayTime, isLongPause } = await humanizedDelay(maxMessageDelay, {
            messageIndex: this.messageIndex,
            longPauseEvery: 10,
            longPauseMultiplier: 2
          });
          
          if (isLongPause) {
            logger.info(`☕ Pausa longa: ${(delayTime / 1000).toFixed(1)}s (simulando comportamento humano)`);
          } else {
            logger.info(`⏱️ Aguardando ${(delayTime / 1000).toFixed(1)}s`);
          }
        } else {
          await delay(maxMessageDelay);
        }
        logger.info('');
      }

      // Finaliza a campanha
      const finalCampaign = campaignManager.getCampaign(campaignName);
      
      if (finalCampaign.status === 'running') {
        campaignManager.completeCampaign(campaignName);
      }

      // Salva a campanha
      await campaignManager.saveCampaign(campaignName);

      // Relatório final
      logger.info(`\n${'='.repeat(50)}`);
      logger.info(`📊 RELATÓRIO FINAL - Campanha "${campaignName}"`);
      logger.info(`${'='.repeat(50)}`);
      logger.info(`Status: ${finalCampaign.status}`);
      logger.info(`Total: ${finalCampaign.stats.total}`);
      logger.info(`✅ Enviadas: ${finalCampaign.stats.sent}`);
      logger.info(`❌ Falhas: ${finalCampaign.stats.failed}`);
      logger.info(`⏳ Pendentes: ${finalCampaign.stats.pending}`);
      
      if (finalCampaign.stats.total > 0) {
        const successRate = ((finalCampaign.stats.sent / finalCampaign.stats.total) * 100).toFixed(2);
        logger.info(`📈 Taxa de Sucesso: ${successRate}%`);
      }
      
      logger.info(`${'='.repeat(50)}\n`);

      this.isRunning = false;
      this.currentCampaign = null;

      return finalCampaign;

    } catch (error) {
      logger.error(`Erro ao executar campanha: ${error.message}`);
      this.isRunning = false;
      this.currentCampaign = null;
      throw error;
    }
  }

  /**
   * Pausa a campanha em execução
   */
  pause() {
    if (!this.isRunning || !this.currentCampaign) {
      throw new Error('Nenhuma campanha em execução');
    }

    campaignManager.pauseCampaign(this.currentCampaign);
    logger.info('⏸️ Campanha pausada');
  }

  /**
   * Retoma a campanha pausada
   */
  resume() {
    if (!this.currentCampaign) {
      throw new Error('Nenhuma campanha pausada');
    }

    campaignManager.resumeCampaign(this.currentCampaign);
    logger.info('▶️ Campanha retomada');
  }

  /**
   * Para a campanha em execução
   */
  stop() {
    if (!this.currentCampaign) {
      throw new Error('Nenhuma campanha em execução');
    }

    campaignManager.stopCampaign(this.currentCampaign);
    logger.info('⏹️ Parando campanha...');
  }

  /**
   * Obtém o status atual
   */
  getStatus() {
    if (!this.currentCampaign) {
      return {
        isRunning: false,
        campaign: null
      };
    }

    return {
      isRunning: this.isRunning,
      campaign: campaignManager.getCampaign(this.currentCampaign)
    };
  }
}

export default new Dispatcher();
