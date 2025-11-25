import dbManager from '../db/database.js';
import { logger } from '../config/logger.js';

/**
 * Serviço de agendamento de campanhas
 * Verifica periodicamente campanhas pendentes e as executa
 */
class CampaignScheduler {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Inicia o scheduler
   */
  start(intervalMs = 60000) {
    if (this.interval) return;
    
    logger.info('📅 Iniciando scheduler de campanhas...');
    
    // Verifica a cada minuto
    this.interval = setInterval(() => this.checkPendingCampaigns(), intervalMs);
    
    // Executa imediatamente na primeira vez
    this.checkPendingCampaigns();
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('📅 Scheduler de campanhas parado');
    }
  }

  /**
   * Verifica e executa campanhas pendentes
   */
  async checkPendingCampaigns() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Verifica se o banco está inicializado
      if (!dbManager.db && !dbManager.pool) {
        logger.warn('📅 Scheduler: Banco de dados ainda não inicializado, aguardando...');
        return;
      }
      
      const campaigns = await dbManager.getPendingCampaigns();
      
      for (const campaign of campaigns) {
        logger.info(`📅 Executando campanha agendada: ${campaign.name} (ID: ${campaign.id})`);
        
        try {
          // Marca como em execução
          await dbManager.updateScheduledCampaign(campaign.id, { 
            status: 'running',
            executed_at: new Date().toISOString()
          });

          // Aqui você pode integrar com o dispatcher existente
          // Por enquanto, apenas marca como executada
          // O frontend pode buscar campanhas com status 'running' e executar
          
          const contacts = JSON.parse(campaign.contacts || '[]');
          
          // Registra métricas iniciais
          for (const phone of contacts) {
            await dbManager.recordMessageMetric({
              user_id: campaign.user_id,
              campaign_id: campaign.id,
              phone,
              status: 'pending'
            });
          }

          // Marca como concluída (o disparo real seria feito pelo frontend/dispatcher)
          await dbManager.updateScheduledCampaign(campaign.id, { 
            status: 'completed',
            result: JSON.stringify({ total: contacts.length, status: 'queued' })
          });

          // Atualiza estatísticas diárias
          const date = new Date().toISOString().split('T')[0];
          try {
            await dbManager.updateDailyStats(campaign.user_id, date, 'campaigns_executed');
          } catch (e) {
            logger.warn(`Erro ao atualizar estatísticas diárias: ${e.message}`);
          }

          // Se for campanha recorrente, cria próxima execução
          if (campaign.repeat_type && campaign.repeat_type !== 'none') {
            await this.scheduleNextExecution(campaign);
          }

          logger.info(`✅ Campanha ${campaign.id} executada com sucesso`);
        } catch (error) {
          logger.error(`❌ Erro ao executar campanha ${campaign.id}: ${error.message}`);
          await dbManager.updateScheduledCampaign(campaign.id, { 
            status: 'failed',
            result: JSON.stringify({ error: error.message })
          });
        }
      }
    } catch (error) {
      logger.error(`Erro no scheduler: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Agenda próxima execução para campanhas recorrentes
   */
  async scheduleNextExecution(campaign) {
    const scheduledAt = new Date(campaign.scheduled_at);
    let nextDate;

    switch (campaign.repeat_type) {
      case 'daily':
        nextDate = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextDate = new Date(scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextDate = new Date(scheduledAt);
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'custom':
        if (campaign.repeat_interval) {
          nextDate = new Date(scheduledAt.getTime() + campaign.repeat_interval * 60 * 1000);
        }
        break;
      default:
        return;
    }

    // Verifica se ainda está dentro do período de repetição
    if (campaign.repeat_until && nextDate > new Date(campaign.repeat_until)) {
      logger.info(`📅 Campanha ${campaign.id} finalizou período de repetição`);
      return;
    }

    // Cria nova campanha agendada
    await dbManager.createScheduledCampaign({
      user_id: campaign.user_id,
      name: campaign.name,
      template_id: campaign.template_id,
      message: campaign.message,
      media_url: campaign.media_url,
      media_type: campaign.media_type,
      contacts: JSON.parse(campaign.contacts),
      instance_ids: campaign.instance_ids ? JSON.parse(campaign.instance_ids) : null,
      scheduled_at: nextDate.toISOString(),
      repeat_type: campaign.repeat_type,
      repeat_interval: campaign.repeat_interval,
      repeat_until: campaign.repeat_until
    });

    logger.info(`📅 Próxima execução agendada para ${nextDate.toISOString()}`);
  }
}

export default new CampaignScheduler();
