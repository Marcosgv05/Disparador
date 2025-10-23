import { settings } from '../config/settings.js';

class MessageRotator {
  constructor() {
    this.messages = [];
    this.currentIndex = 0;
  }

  /**
   * Carrega as mensagens para alternância
   * @param {Array<string>} messages - Lista de mensagens
   */
  loadMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('É necessário fornecer pelo menos uma mensagem');
    }
    this.messages = messages;
    this.currentIndex = 0;
  }

  /**
   * Obtém a próxima mensagem de acordo com o modo configurado
   * @returns {string}
   */
  getNextMessage() {
    if (this.messages.length === 0) {
      throw new Error('Nenhuma mensagem carregada');
    }

    let message;

    if (settings.rotationMode === 'random') {
      // Modo aleatório
      const randomIndex = Math.floor(Math.random() * this.messages.length);
      message = this.messages[randomIndex];
    } else {
      // Modo sequencial (padrão)
      message = this.messages[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.messages.length;
    }

    return message;
  }

  /**
   * Substitui variáveis na mensagem
   * @param {string} message - Mensagem com variáveis
   * @param {Object} variables - Objeto com as variáveis
   * @returns {string}
   */
  replaceVariables(message, variables = {}) {
    let processedMessage = message;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processedMessage = processedMessage.replace(regex, value);
    }

    return processedMessage;
  }

  /**
   * Obtém a próxima mensagem personalizada
   * @param {Object} variables - Variáveis para substituição
   * @returns {string}
   */
  getNextCustomMessage(variables = {}) {
    const message = this.getNextMessage();
    return this.replaceVariables(message, variables);
  }

  /**
   * Reseta o índice de mensagens
   */
  reset() {
    this.currentIndex = 0;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      totalMessages: this.messages.length,
      currentIndex: this.currentIndex,
      mode: settings.rotationMode
    };
  }
}

export default new MessageRotator();
