/**
 * API pública para integração programática
 * Use este arquivo para integrar o WhatsApp Multi-Sender em seus próprios projetos
 */

import sessionManager from './whatsapp/sessionManager.js';
import messageSender from './services/messageSender.js';
import messageRotator from './services/messageRotator.js';
import queueManager from './services/queueManager.js';
import { loadPhoneNumbersFromFile, loadMessagesFromFile, loadContactsFromCSV } from './utils/fileLoader.js';

/**
 * API principal do WhatsApp Multi-Sender
 */
export class WhatsAppAPI {
  /**
   * Cria uma nova sessão do WhatsApp
   * @param {string} sessionId - ID único para a sessão
   * @returns {Promise<void>}
   */
  async createSession(sessionId) {
    return await sessionManager.createSession(sessionId);
  }

  /**
   * Remove uma sessão
   * @param {string} sessionId - ID da sessão
   * @returns {Promise<void>}
   */
  async removeSession(sessionId) {
    return await sessionManager.removeSession(sessionId);
  }

  /**
   * Lista todas as sessões ativas
   * @returns {Array<Object>}
   */
  listSessions() {
    return sessionManager.getAllSessions();
  }

  /**
   * Envia uma mensagem para um único número
   * @param {string} phoneNumber - Número do destinatário
   * @param {string} message - Mensagem a enviar
   * @param {string} sessionId - ID da sessão (opcional)
   * @returns {Promise<Object>}
   */
  async sendMessage(phoneNumber, message, sessionId = null) {
    return await messageSender.sendMessage(phoneNumber, message, sessionId);
  }

  /**
   * Envia mensagens em lote
   * @param {Array<string>} phoneNumbers - Lista de números
   * @param {Array<string>} messages - Lista de mensagens para alternância
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>}
   */
  async sendBulk(phoneNumbers, messages, options = {}) {
    return await messageSender.sendBulk(phoneNumbers, messages, options);
  }

  /**
   * Envia usando múltiplas sessões
   * @param {Array<string>} phoneNumbers - Lista de números
   * @param {Array<string>} messages - Lista de mensagens
   * @returns {Promise<Object>}
   */
  async sendMultiSession(phoneNumbers, messages) {
    return await messageSender.sendBulkMultiSession(phoneNumbers, messages);
  }

  /**
   * Carrega números de um arquivo
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<Array<string>>}
   */
  async loadPhoneNumbers(filePath) {
    return await loadPhoneNumbersFromFile(filePath);
  }

  /**
   * Carrega mensagens de um arquivo
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<Array<string>>}
   */
  async loadMessages(filePath) {
    return await loadMessagesFromFile(filePath);
  }

  /**
   * Carrega contatos de um CSV
   * @param {string} filePath - Caminho do arquivo CSV
   * @returns {Promise<Array<Object>>}
   */
  async loadContactsCSV(filePath) {
    return await loadContactsFromCSV(filePath);
  }

  /**
   * Obtém estatísticas de envio
   * @returns {Object}
   */
  getStats() {
    return messageSender.getStats();
  }

  /**
   * Carrega mensagens no rotator
   * @param {Array<string>} messages - Lista de mensagens
   */
  loadMessagesInRotator(messages) {
    messageRotator.loadMessages(messages);
  }

  /**
   * Obtém próxima mensagem do rotator
   * @param {Object} variables - Variáveis para substituição
   * @returns {string}
   */
  getNextMessage(variables = {}) {
    return messageRotator.getNextCustomMessage(variables);
  }

  /**
   * Cria uma fila de processamento
   * @param {string} queueId - ID da fila
   * @returns {Object}
   */
  createQueue(queueId) {
    return queueManager.createQueue(queueId);
  }

  /**
   * Adiciona itens a uma fila
   * @param {string} queueId - ID da fila
   * @param {Array} items - Itens a adicionar
   */
  addToQueue(queueId, items) {
    return queueManager.addItems(queueId, items);
  }

  /**
   * Processa uma fila
   * @param {string} queueId - ID da fila
   * @param {Function} processor - Função de processamento
   * @returns {Promise<Array>}
   */
  async processQueue(queueId, processor) {
    return await queueManager.processQueue(queueId, processor);
  }
}

// Exporta instância padrão
export default new WhatsAppAPI();
