import { logger } from '../config/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Gerenciador de Campanhas de Disparo
 */
class CampaignManager {
  constructor() {
    this.campaigns = new Map();
    this.activeCampaign = null;
    this.campaignsFolder = path.join(process.cwd(), 'campaigns');
  }

  /**
   * Inicializa a pasta de campanhas
   */
  async initialize() {
    try {
      await fs.mkdir(this.campaignsFolder, { recursive: true });
    } catch (error) {
      logger.error('Erro ao criar pasta de campanhas:', error);
    }
  }

  /**
   * Cria uma nova campanha
   * @param {string} name - Nome da campanha
   * @param {Array<string>} messages - Mensagens para alternância
   */
  createCampaign(name) {
    if (this.campaigns.has(name)) {
      throw new Error(`Campanha "${name}" já existe`);
    }

    const campaign = {
      name,
      numbers: [],
      messages: [],
      status: 'idle', // idle, running, paused, stopped, completed
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      stats: {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0
      },
      currentIndex: 0,
      results: []
    };

    this.campaigns.set(name, campaign);
    this.activeCampaign = name;
    
    logger.info(`✅ Campanha "${name}" criada`);
    return campaign;
  }

  /**
   * Adiciona um número à campanha
   * @param {string} campaignName 
   * @param {string} phoneNumber 
   */
  addNumber(campaignName, phoneNumber) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível adicionar números enquanto a campanha está rodando. Pause primeiro.');
    }

    // Verifica se o número já existe
    if (campaign.numbers.includes(phoneNumber)) {
      throw new Error(`Número ${phoneNumber} já está na campanha`);
    }

    campaign.numbers.push(phoneNumber);
    campaign.stats.total = campaign.numbers.length;
    campaign.stats.pending = campaign.numbers.length - campaign.currentIndex;

    logger.info(`📱 Número ${phoneNumber} adicionado à campanha "${campaignName}"`);
    return campaign;
  }

  /**
   * Adiciona múltiplos números de uma vez
   * @param {string} campaignName 
   * @param {Array<string>} phoneNumbers 
   */
  addNumbers(campaignName, phoneNumbers) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível adicionar números enquanto a campanha está rodando. Pause primeiro.');
    }

    let added = 0;
    for (const phone of phoneNumbers) {
      if (!campaign.numbers.includes(phone)) {
        campaign.numbers.push(phone);
        added++;
      }
    }

    campaign.stats.total = campaign.numbers.length;
    campaign.stats.pending = campaign.numbers.length - campaign.currentIndex;

    logger.info(`📱 ${added} números adicionados à campanha "${campaignName}"`);
    return campaign;
  }

  /**
   * Remove um número da campanha
   * @param {string} campaignName 
   * @param {string} phoneNumber 
   */
  removeNumber(campaignName, phoneNumber) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível remover números enquanto a campanha está rodando. Pause primeiro.');
    }

    const index = campaign.numbers.indexOf(phoneNumber);
    if (index === -1) {
      throw new Error(`Número ${phoneNumber} não encontrado na campanha`);
    }

    campaign.numbers.splice(index, 1);
    campaign.stats.total = campaign.numbers.length;
    campaign.stats.pending = campaign.numbers.length - campaign.currentIndex;

    logger.info(`🗑️ Número ${phoneNumber} removido da campanha "${campaignName}"`);
    return campaign;
  }

  /**
   * Define as mensagens da campanha
   * @param {string} campaignName 
   * @param {Array<string>} messages 
   */
  setMessages(campaignName, messages) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível alterar mensagens enquanto a campanha está rodando. Pause primeiro.');
    }

    campaign.messages = messages;
    logger.info(`📝 ${messages.length} mensagens definidas para campanha "${campaignName}"`);
    return campaign;
  }

  /**
   * Inicia a campanha
   * @param {string} campaignName 
   */
  startCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.numbers.length === 0) {
      throw new Error('Adicione números antes de iniciar a campanha');
    }

    if (campaign.messages.length === 0) {
      throw new Error('Adicione mensagens antes de iniciar a campanha');
    }

    if (campaign.status === 'running') {
      throw new Error('Campanha já está em execução');
    }

    campaign.status = 'running';
    if (!campaign.startedAt) {
      campaign.startedAt = new Date();
    }

    logger.info(`▶️ Campanha "${campaignName}" iniciada`);
    return campaign;
  }

  /**
   * Pausa a campanha
   * @param {string} campaignName 
   */
  pauseCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status !== 'running') {
      throw new Error('Campanha não está em execução');
    }

    campaign.status = 'paused';
    logger.info(`⏸️ Campanha "${campaignName}" pausada`);
    return campaign;
  }

  /**
   * Retoma a campanha pausada
   * @param {string} campaignName 
   */
  resumeCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status !== 'paused') {
      throw new Error('Campanha não está pausada');
    }

    campaign.status = 'running';
    logger.info(`▶️ Campanha "${campaignName}" retomada`);
    return campaign;
  }

  /**
   * Para a campanha completamente
   * @param {string} campaignName 
   */
  stopCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    campaign.status = 'stopped';
    campaign.completedAt = new Date();
    
    logger.info(`⏹️ Campanha "${campaignName}" parada`);
    return campaign;
  }

  /**
   * Marca a campanha como completa
   * @param {string} campaignName 
   */
  completeCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    campaign.status = 'completed';
    campaign.completedAt = new Date();
    
    logger.info(`✅ Campanha "${campaignName}" concluída`);
    return campaign;
  }

  /**
   * Atualiza o índice atual e estatísticas
   * @param {string} campaignName 
   * @param {Object} result 
   */
  updateProgress(campaignName, result) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    campaign.results.push(result);
    campaign.currentIndex++;

    if (result.success) {
      campaign.stats.sent++;
    } else {
      campaign.stats.failed++;
    }

    campaign.stats.pending = campaign.numbers.length - campaign.currentIndex;

    return campaign;
  }

  /**
   * Obtém o próximo número a ser processado
   * @param {string} campaignName 
   */
  getNextNumber(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.currentIndex >= campaign.numbers.length) {
      return null;
    }

    return campaign.numbers[campaign.currentIndex];
  }

  /**
   * Verifica se a campanha pode continuar
   * @param {string} campaignName 
   */
  canContinue(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      return false;
    }

    return campaign.status === 'running' && campaign.currentIndex < campaign.numbers.length;
  }

  /**
   * Obtém informações da campanha
   * @param {string} campaignName 
   */
  getCampaign(campaignName) {
    return this.campaigns.get(campaignName);
  }

  /**
   * Lista todas as campanhas
   */
  listCampaigns() {
    return Array.from(this.campaigns.values());
  }

  /**
   * Obtém a campanha ativa
   */
  getActiveCampaign() {
    if (!this.activeCampaign) {
      return null;
    }
    return this.campaigns.get(this.activeCampaign);
  }

  /**
   * Define a campanha ativa
   * @param {string} campaignName 
   */
  setActiveCampaign(campaignName) {
    if (!this.campaigns.has(campaignName)) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }
    this.activeCampaign = campaignName;
  }

  /**
   * Salva a campanha em arquivo
   * @param {string} campaignName 
   */
  async saveCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    const filePath = path.join(this.campaignsFolder, `${campaignName}.json`);
    await fs.writeFile(filePath, JSON.stringify(campaign, null, 2));
    
    logger.info(`💾 Campanha "${campaignName}" salva`);
  }

  /**
   * Carrega uma campanha de arquivo
   * @param {string} campaignName 
   */
  async loadCampaign(campaignName) {
    const filePath = path.join(this.campaignsFolder, `${campaignName}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const campaign = JSON.parse(data);
      
      // Converte strings de data de volta para objetos Date
      if (campaign.createdAt) campaign.createdAt = new Date(campaign.createdAt);
      if (campaign.startedAt) campaign.startedAt = new Date(campaign.startedAt);
      if (campaign.completedAt) campaign.completedAt = new Date(campaign.completedAt);
      
      this.campaigns.set(campaignName, campaign);
      this.activeCampaign = campaignName;
      
      logger.info(`📂 Campanha "${campaignName}" carregada`);
      return campaign;
    } catch (error) {
      throw new Error(`Erro ao carregar campanha: ${error.message}`);
    }
  }

  /**
   * Deleta uma campanha
   * @param {string} campaignName 
   */
  async deleteCampaign(campaignName) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível deletar uma campanha em execução. Pare primeiro.');
    }

    this.campaigns.delete(campaignName);
    
    // Remove o arquivo se existir
    try {
      const filePath = path.join(this.campaignsFolder, `${campaignName}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // Arquivo pode não existir
    }

    if (this.activeCampaign === campaignName) {
      this.activeCampaign = null;
    }

    logger.info(`🗑️ Campanha "${campaignName}" deletada`);
  }
}

export default new CampaignManager();
