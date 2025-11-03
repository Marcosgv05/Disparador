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

      const files = await fs.readdir(this.campaignsFolder);
      let loadedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const campaignName = file.replace(/\.json$/i, '');
        try {
          await this.loadCampaign(campaignName);
          loadedCount++;
        } catch (error) {
          logger.warn(`Não foi possível carregar campanha "${campaignName}": ${error.message}`);
        }
      }

      if (loadedCount > 0) {
        logger.info(`📂 ${loadedCount} campanha(s) carregadas da pasta ${this.campaignsFolder}`);
      }
    } catch (error) {
      logger.error('Erro ao inicializar campanhas:', error);
    }
  }

  /**
   * Cria uma nova campanha
   * @param {string} name - Nome da campanha
   * @param {number} userId - ID do usuário proprietário
   */
  async createCampaign(name, userId) {
    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    if (this.campaigns.has(name)) {
      throw new Error(`Campanha "${name}" já existe`);
    }

    const campaign = {
      name,
      userId,
      contacts: [], // Array de {name, phone, status, statusDetails}
      numbers: [], // Backward compatibility
      messages: [],
      status: 'idle', // idle, running, paused, stopped, completed
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      stats: {
        total: 0,
        sent: 0,
        received: 0,
        read: 0,
        replied: 0,
        failed: 0,
        pending: 0
      },
      currentIndex: 0,
      results: []
    };

    this.campaigns.set(name, campaign);
    this.activeCampaign = name;
    
    await this.saveCampaign(name);
    
    logger.info(`✅ Campanha "${name}" criada`);
    return campaign;
  }

  /**
   * Adiciona contato à campanha
   * @param {string} campaignName 
   * @param {object} contact - {name, phone}
   */
  addContact(campaignName, contact) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível adicionar contatos enquanto a campanha está rodando. Pause primeiro.');
    }

    // Verifica se o número já existe
    if (campaign.contacts.find(c => c.phone === contact.phone)) {
      throw new Error(`Contato ${contact.phone} já está na campanha`);
    }

    const contactData = {
      name: contact.name || contact.phone,
      phone: contact.phone,
      status: 'pending', // pending, sending, sent, received, read, replied, failed
      statusDetails: null,
      sentAt: null,
      receivedAt: null,
      readAt: null,
      repliedAt: null,
      error: null
    };

    campaign.contacts.push(contactData);
    campaign.numbers.push(contact.phone); // Backward compatibility
    campaign.stats.total++;
    campaign.stats.pending++;

    logger.info(`📞 Contato ${contact.name}(${contact.phone}) adicionado à campanha "${campaignName}"`);
    this.saveCampaign(campaignName);
    return contactData;
  }

  /**
   * Adiciona um número à campanha (backward compatibility)
   * @param {string} campaignName 
   * @param {string} phoneNumber 
   */
  addNumber(campaignName, phoneNumber) {
    return this.addContact(campaignName, { name: phoneNumber, phone: phoneNumber });
  }

  /**
   * Adiciona múltiplos contatos de uma vez
   * @param {string} campaignName 
   * @param {Array<{name, phone}>} contacts 
   */
  addContacts(campaignName, contacts) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível adicionar contatos enquanto a campanha está rodando. Pause primeiro.');
    }

    let added = 0;
    for (const contact of contacts) {
      if (!campaign.contacts.find(c => c.phone === contact.phone)) {
        this.addContact(campaignName, contact);
        added++;
      }
    }

    logger.info(`📱 ${added} contatos adicionados à campanha "${campaignName}"`);
    this.saveCampaign(campaignName);
    return campaign;
  }

  /**
   * Adiciona múltiplos números de uma vez (backward compatibility)
   * @param {string} campaignName 
   * @param {Array<string>} phoneNumbers 
   */
  addNumbers(campaignName, phoneNumbers) {
    const contacts = phoneNumbers.map(phone => ({ name: phone, phone }));
    return this.addContacts(campaignName, contacts);
  }

  /**
   * Atualiza status de um contato
   * @param {string} campaignName 
   * @param {string} phone 
   * @param {string} status - pending, sending, sent, received, read, replied, failed
   * @param {object} details - Detalhes adicionais
   */
  updateContactStatus(campaignName, phone, status, details = {}) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    const contact = campaign.contacts.find(c => c.phone === phone);
    if (!contact) {
      logger.warn(`Contato ${phone} não encontrado na campanha "${campaignName}"`);
      return null;
    }

    const oldStatus = contact.status;
    
    // Evita atualizar se já está no mesmo status
    if (oldStatus === status) {
      return contact;
    }
    
    contact.status = status;
    contact.statusDetails = details;

    // Atualiza timestamps e estatísticas
    if (status === 'sent') {
      contact.sentAt = new Date();
      if (oldStatus === 'pending') campaign.stats.pending--;
      if (oldStatus !== 'sent') campaign.stats.sent++;
    } else if (status === 'received') {
      contact.receivedAt = new Date();
      if (!campaign.stats.received) campaign.stats.received = 0;
      campaign.stats.received++;
    } else if (status === 'read') {
      contact.readAt = new Date();
      if (!campaign.stats.read) campaign.stats.read = 0;
      campaign.stats.read++;
    } else if (status === 'replied') {
      contact.repliedAt = new Date();
      if (!campaign.stats.replied) campaign.stats.replied = 0;
      campaign.stats.replied++;
    } else if (status === 'failed') {
      contact.error = details.error || 'Erro desconhecido';
      if (oldStatus === 'pending') campaign.stats.pending--;
      campaign.stats.failed++;
    }

    this.saveCampaign(campaignName);
    return contact;
  }

  /**
   * Remove um número/contato da campanha
   * @param {string} campaignName 
   * @param {string} phoneNumber 
   */
  async removeNumber(campaignName, phoneNumber) {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.status === 'running') {
      throw new Error('Não é possível remover contatos enquanto a campanha está rodando. Pause primeiro.');
    }

    // Remove de contacts
    const contactIndex = campaign.contacts.findIndex(c => c.phone === phoneNumber);
    if (contactIndex !== -1) {
      campaign.contacts.splice(contactIndex, 1);
    }

    // Remove de numbers (backward compatibility)
    const numberIndex = campaign.numbers.indexOf(phoneNumber);
    if (numberIndex !== -1) {
      campaign.numbers.splice(numberIndex, 1);
    }

    // Atualiza estatísticas
    campaign.stats.total = campaign.contacts.length;
    campaign.stats.pending = campaign.contacts.filter(c => c.status === 'pending').length;

    await this.saveCampaign(campaignName);
    
    logger.info(`🗑️ Contato ${phoneNumber} removido da campanha "${campaignName}"`);
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
   * @param {number} userId - Opcional, valida propriedade
   */
  getCampaign(campaignName, userId = null) {
    const campaign = this.campaigns.get(campaignName);
    
    if (!campaign) {
      return null;
    }

    // Valida propriedade se userId fornecido
    if (userId && campaign.userId !== userId) {
      throw new Error('Acesso negado a esta campanha');
    }

    return campaign;
  }

  /**
   * Lista todas as campanhas (opcionalmente filtradas por userId)
   * @param {number} userId - Opcional, filtra por usuário
   */
  listCampaigns(userId = null) {
    const campaigns = Array.from(this.campaigns.values());
    
    if (userId) {
      return campaigns.filter(c => c.userId === userId);
    }
    
    return campaigns;
  }

  /**
   * Valida se usuário tem acesso à campanha
   * @param {string} campaignName 
   * @param {number} userId 
   */
  validateOwnership(campaignName, userId) {
    const campaign = this.campaigns.get(campaignName);
    
    if (!campaign) {
      throw new Error(`Campanha "${campaignName}" não encontrada`);
    }

    if (campaign.userId !== userId) {
      throw new Error('Acesso negado a esta campanha');
    }

    return true;
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

    const sanitizedName = campaignName.trim();
    const filePath = path.join(this.campaignsFolder, `${sanitizedName}.json`);
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
