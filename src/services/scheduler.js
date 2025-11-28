import campaignManager from './campaignManager.js';
import dispatcher from './dispatcher.js';
import { logger } from '../config/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Scheduler - Gerencia agendamentos automáticos de campanhas
 */
class Scheduler {
  constructor() {
    this.schedules = new Map();
    this.intervalId = null;
    this.schedulesFile = path.join(process.cwd(), 'schedules.json');
  }

  /**
   * Inicia o scheduler
   */
  async start() {
    await this.loadSchedules();
    
    // Verifica a cada minuto
    this.intervalId = setInterval(() => {
      this.checkSchedules();
    }, 60000); // 1 minuto
    
    logger.info('📅 Scheduler iniciado');
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('📅 Scheduler parado');
    }
  }

  /**
   * Adiciona ou atualiza agendamento de uma campanha
   * @param {string} campaignName 
   * @param {Object} schedule 
   */
  setSchedule(campaignName, schedule, userId = null) {
    const scheduleData = {
      campaignName,
      userId: schedule.userId || userId || null,
      enabled: schedule.enabled !== false,
      startTime: schedule.startTime, // HH:MM
      pauseTime: schedule.pauseTime, // HH:MM
      stopTime: schedule.stopTime,   // HH:MM (opcional)
      days: schedule.days || [0, 1, 2, 3, 4, 5, 6], // Dias da semana (0=Dom, 6=Sáb)
      timezone: schedule.timezone || 'America/Sao_Paulo',
      autoResume: schedule.autoResume !== false, // Retoma automaticamente após pausa
      createdAt: new Date(),
      lastRun: null
    };

    this.schedules.set(campaignName, scheduleData);
    this.saveSchedules();
    
    logger.info(`📅 Agendamento configurado para campanha "${campaignName}"`);
    logger.info(`   Início: ${scheduleData.startTime}`);
    logger.info(`   Pausa: ${scheduleData.pauseTime}`);
    if (scheduleData.stopTime) {
      logger.info(`   Parada: ${scheduleData.stopTime}`);
    }
    
    return scheduleData;
  }

  /**
   * Remove agendamento
   * @param {string} campaignName 
   */
  removeSchedule(campaignName) {
    this.schedules.delete(campaignName);
    this.saveSchedules();
    logger.info(`📅 Agendamento removido da campanha "${campaignName}"`);
  }

  /**
   * Obtém agendamento de uma campanha
   * @param {string} campaignName 
   */
  getSchedule(campaignName) {
    return this.schedules.get(campaignName);
  }

  /**
   * Lista todos os agendamentos
   */
  listSchedules(userId = null) {
    const all = Array.from(this.schedules.values());
    if (!userId) return all;
    return all.filter(s => s.userId === userId);
  }

  /**
   * Verifica e executa agendamentos
   */
  checkSchedules() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = now.getDay();

    for (const [campaignName, schedule] of this.schedules.entries()) {
      if (!schedule.enabled) continue;
      if (!schedule.days.includes(currentDay)) continue;

      const campaign = campaignManager.getCampaign(campaignName);
      if (!campaign) continue;

      // Verifica se deve iniciar
      if (currentTime === schedule.startTime) {
        if (campaign.status === 'idle' || campaign.status === 'paused') {
          logger.info(`📅 Iniciando campanha "${campaignName}" automaticamente (agendamento)`);
          this.startScheduledCampaign(campaignName);
        }
      }

      // Verifica se deve pausar
      if (schedule.pauseTime && currentTime === schedule.pauseTime) {
        if (campaign.status === 'running') {
          logger.info(`📅 Pausando campanha "${campaignName}" automaticamente (agendamento)`);
          try {
            dispatcher.pause();
          } catch (error) {
            logger.error(`Erro ao pausar campanha: ${error.message}`);
          }
        }
      }

      // Verifica se deve retomar (após pausa)
      if (schedule.autoResume && schedule.pauseTime) {
        const [pauseHour, pauseMin] = schedule.pauseTime.split(':').map(Number);
        const [nowHour, nowMin] = currentTime.split(':').map(Number);
        
        // Retoma 1 minuto após o horário de pausa
        if (nowHour === pauseHour && nowMin === pauseMin + 1) {
          if (campaign.status === 'paused') {
            logger.info(`📅 Retomando campanha "${campaignName}" automaticamente`);
            try {
              dispatcher.resume();
            } catch (error) {
              logger.error(`Erro ao retomar campanha: ${error.message}`);
            }
          }
        }
      }

      // Verifica se deve parar completamente
      if (schedule.stopTime && currentTime === schedule.stopTime) {
        if (campaign.status === 'running' || campaign.status === 'paused') {
          logger.info(`📅 Parando campanha "${campaignName}" automaticamente (agendamento)`);
          try {
            dispatcher.stop();
          } catch (error) {
            logger.error(`Erro ao parar campanha: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Inicia campanha agendada
   * @param {string} campaignName 
   */
  async startScheduledCampaign(campaignName) {
    try {
      const schedule = this.schedules.get(campaignName);
      if (schedule) {
        schedule.lastRun = new Date();
        this.saveSchedules();
      }

      // Inicia disparo em background
      dispatcher.runCampaign(campaignName).catch(error => {
        logger.error(`Erro no disparo agendado: ${error.message}`);
      });

    } catch (error) {
      logger.error(`Erro ao iniciar campanha agendada: ${error.message}`);
    }
  }

  /**
   * Salva agendamentos em arquivo
   */
  async saveSchedules() {
    try {
      const data = Array.from(this.schedules.entries());
      await fs.writeFile(
        this.schedulesFile,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error(`Erro ao salvar agendamentos: ${error.message}`);
    }
  }

  /**
   * Carrega agendamentos do arquivo
   */
  async loadSchedules() {
    try {
      const data = await fs.readFile(this.schedulesFile, 'utf-8');
      const schedules = JSON.parse(data);
      
      this.schedules = new Map(schedules);
      logger.info(`📅 ${schedules.length} agendamentos carregados`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Erro ao carregar agendamentos: ${error.message}`);
      }
    }
  }

  /**
   * Habilita/desabilita agendamento
   * @param {string} campaignName 
   * @param {boolean} enabled 
   */
  toggleSchedule(campaignName, enabled) {
    const schedule = this.schedules.get(campaignName);
    if (schedule) {
      schedule.enabled = enabled;
      this.saveSchedules();
      logger.info(`📅 Agendamento ${enabled ? 'habilitado' : 'desabilitado'} para "${campaignName}"`);
    }
  }

  /**
   * Valida formato de horário
   * @param {string} time 
   */
  static validateTime(time) {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  /**
   * Obtém próxima execução agendada
   * @param {string} campaignName 
   */
  getNextRun(campaignName) {
    const schedule = this.schedules.get(campaignName);
    if (!schedule || !schedule.enabled) return null;

    const now = new Date();
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    
    const nextRun = new Date();
    nextRun.setHours(startHour, startMin, 0, 0);

    // Se o horário já passou hoje, agenda para amanhã
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    // Verifica dia da semana
    while (!schedule.days.includes(nextRun.getDay())) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }
}

export default new Scheduler();
