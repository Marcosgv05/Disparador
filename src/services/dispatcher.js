import campaignManager from './campaignManager.js';
import messageSender from './messageSender.js';
import messageRotator from './messageRotator.js';
import { logger } from '../config/logger.js';
import { delay } from '../utils/delay.js';
import { settings } from '../config/settings.js';

/**
 * Dispatcher - Executa campanhas de forma controlada
 */
class Dispatcher {
  constructor() {
    this.isRunning = false;
    this.currentCampaign = null;
  }

  /**
   * Executa uma campanha
   * @param {string} campaignName 
   */
  async runCampaign(campaignName) {
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

      // Inicia a campanha
      campaignManager.startCampaign(campaignName);

      // Carrega mensagens no rotator
      messageRotator.loadMessages(campaign.messages);

      logger.info(`\n🚀 Iniciando disparo da campanha "${campaignName}"`);
      logger.info(`📊 Total de números: ${campaign.numbers.length}`);
      logger.info(`📝 Total de mensagens: ${campaign.messages.length}\n`);

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

        // Obtém o próximo número
        const phoneNumber = campaignManager.getNextNumber(campaignName);
        if (!phoneNumber) {
          break;
        }

        // Obtém a próxima mensagem
        const message = messageRotator.getNextMessage();

        // Envia a mensagem
        logger.info(`📤 Enviando para ${phoneNumber}...`);
        const result = await messageSender.sendMessage(phoneNumber, message);

        // Atualiza progresso
        campaignManager.updateProgress(campaignName, result);

        // Log do resultado
        const stats = currentCampaign.stats;
        logger.info(`Progresso: ${stats.sent + stats.failed}/${stats.total} | ✅ ${stats.sent} | ❌ ${stats.failed} | ⏳ ${stats.pending}\n`);

        // Delay antes do próximo envio
        await delay(settings.messageDelay);
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
