import sessionManager from '../whatsapp/sessionManager.js';
import messageRotator from './messageRotator.js';
import { logger } from '../config/logger.js';
import { formatPhoneNumber, isValidPhoneNumber } from '../utils/phoneFormatter.js';
import { delay, humanizedDelay } from '../utils/delay.js';
import { settings } from '../config/settings.js';
import fs from 'fs/promises';

class MessageSender {
  constructor() {
    this.sendingStats = {
      sent: 0,
      failed: 0,
      total: 0
    };
  }

  /**
   * Envia mensagem para um único número
   * @param {string} phoneNumber - Número do destinatário
   * @param {string} message - Mensagem a ser enviada
   * @param {string} sessionId - ID da sessão (opcional, usa round-robin se não fornecido)
   * @param {string} campaignName - Nome da campanha (para rastreamento)
   * @param {number} userId - ID do usuário
   * @param {Object} options - Opções adicionais
   * @param {Array<string>} options.linkedInstances - IDs das instâncias vinculadas
   */
  async sendMessage(phoneNumber, message, sessionId = null, campaignName = null, userId = null, options = {}) {
    try {
      // Valida o número
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error(`Número inválido: ${phoneNumber}`);
      }

      // Formata o número
      const formattedNumber = formatPhoneNumber(phoneNumber);

      // Obtém a sessão
      let session;
      let usedSessionId = sessionId;
      
      if (sessionId) {
        session = sessionManager.getSession(sessionId);
        if (!session) {
          throw new Error(`Sessão ${sessionId} não encontrada ou não está pronta`);
        }
      } else {
        // Usa instâncias vinculadas se disponível
        const linkedInstances = options.linkedInstances || null;
        const availableSession = userId 
          ? sessionManager.getAvailableSessionForUser(userId, linkedInstances)
          : sessionManager.getAvailableSession();
        if (!availableSession) {
          throw new Error('Nenhuma sessão disponível');
        }
        session = availableSession.sock;
        usedSessionId = availableSession.id;
      }

      const enableTyping = !!options.enableTyping;

      // Opcional: envia status "digitando..." real antes da mensagem
      if (enableTyping && typeof session.sendPresenceUpdate === 'function') {
        try {
          await session.sendPresenceUpdate('composing', formattedNumber);
        } catch (error) {
          logger.warn(`Erro ao enviar status "digitando" para ${phoneNumber}:`, error.message);
        }
      }

      // Prepara o conteúdo da mensagem (texto simples ou com mídia global)
      let messageContent;
      let sentMsg;
      
      // Verifica se há mídia GLOBAL para anexar à mensagem
      const globalMedia = options.globalMedia;
      
      if (globalMedia && globalMedia.mediaPath) {
        // Mensagem com mídia GLOBAL (imagem/vídeo + texto como legenda)
        try {
          const mediaBuffer = await fs.readFile(globalMedia.mediaPath);
          const textMessage = typeof message === 'string' ? message : '';
          
          if (globalMedia.type === 'image') {
            messageContent = {
              image: mediaBuffer,
              caption: textMessage,
              mimetype: globalMedia.mimetype || 'image/jpeg'
            };
          } else if (globalMedia.type === 'video') {
            messageContent = {
              video: mediaBuffer,
              caption: textMessage,
              mimetype: globalMedia.mimetype || 'video/mp4'
            };
          }
          
          logger.info(`📎 Enviando ${globalMedia.type} + texto para ${phoneNumber}...`);
        } catch (mediaError) {
          logger.error(`Erro ao ler mídia global: ${mediaError.message}`);
          // Se falhar ao carregar mídia, envia só o texto
          logger.warn(`Enviando apenas texto como fallback...`);
          messageContent = { text: typeof message === 'string' ? message : '' };
        }
      } else if (typeof message === 'object' && message.type) {
        // Mensagem com mídia individual (legado - não usado mais)
        try {
          const mediaBuffer = await fs.readFile(message.mediaPath);
          
          if (message.type === 'image') {
            messageContent = {
              image: mediaBuffer,
              caption: message.caption || '',
              mimetype: message.mimetype || 'image/jpeg'
            };
          } else if (message.type === 'video') {
            messageContent = {
              video: mediaBuffer,
              caption: message.caption || '',
              mimetype: message.mimetype || 'video/mp4'
            };
          }
          
          logger.info(`📎 Enviando ${message.type} para ${phoneNumber}...`);
        } catch (mediaError) {
          logger.error(`Erro ao ler arquivo de mídia: ${mediaError.message}`);
          throw new Error(`Falha ao carregar mídia: ${mediaError.message}`);
        }
      } else {
        // Mensagem de texto simples
        messageContent = { text: message };
      }
      
      // Envia a mensagem e captura o messageId
      sentMsg = await session.sendMessage(formattedNumber, messageContent);
      const messageId = sentMsg?.key?.id;
      
      // Rastreia a mensagem para detectar status
      if (messageId && campaignName) {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        sessionManager.trackSentMessage(messageId, cleanPhone, campaignName);
      }
      
      logger.info(`✅ Mensagem enviada para ${phoneNumber} via ${usedSessionId}`);

      // Após o envio, atualiza presença para "pausado" se o recurso estiver disponível
      if (enableTyping && typeof session.sendPresenceUpdate === 'function') {
        try {
          await session.sendPresenceUpdate('paused', formattedNumber);
        } catch (error) {
          logger.warn(`Erro ao limpar status "digitando" para ${phoneNumber}:`, error.message);
        }
      }
      this.sendingStats.sent++;
      
      return { success: true, phone: phoneNumber, messageId, sessionId: usedSessionId };
    } catch (error) {
      logger.error(`❌ Erro ao enviar para ${phoneNumber}:`, error.message);
      this.sendingStats.failed++;
      
      return { success: false, phone: phoneNumber, error: error.message };
    }
  }

  /**
   * Envia mensagens em lote para múltiplos números
   * @param {Array<string>} phoneNumbers - Lista de números
   * @param {Array<string>} messages - Lista de mensagens para rotação
   * @param {Object} options - Opções de envio
   */
  async sendBulk(phoneNumbers, messages, options = {}) {
    try {
      // Carrega mensagens no rotator
      messageRotator.loadMessages(messages);

      // Reseta estatísticas
      this.sendingStats = {
        sent: 0,
        failed: 0,
        total: phoneNumbers.length
      };

      const results = [];

      logger.info(`📤 Iniciando envio em lote para ${phoneNumbers.length} números`);
      logger.info(`📝 ${messages.length} mensagens carregadas para alternância`);

      for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        
        // Obtém a próxima mensagem do rotator
        const message = messageRotator.getNextCustomMessage({
          nome: options.customerName || 'Cliente',
          numero: i + 1,
          total: phoneNumbers.length
        });

        // Envia a mensagem
        const result = await this.sendMessage(phone, message);
        results.push(result);

        // Log de progresso
        logger.info(`Progresso: ${i + 1}/${phoneNumbers.length}`);

        // Delay humanizado entre mensagens (exceto na última)
        if (i < phoneNumbers.length - 1) {
          const { delayTime } = await humanizedDelay(settings.messageDelay, { messageIndex: i });
          logger.info(`⏱️ Aguardando ${(delayTime / 1000).toFixed(1)}s`);
        }
      }

      // Log final
      logger.info(`\n📊 Envio concluído!`);
      logger.info(`✅ Enviadas: ${this.sendingStats.sent}`);
      logger.info(`❌ Falhas: ${this.sendingStats.failed}`);
      logger.info(`📈 Total: ${this.sendingStats.total}`);

      return {
        stats: this.sendingStats,
        results
      };
    } catch (error) {
      logger.error('Erro no envio em lote:', error);
      throw error;
    }
  }

  /**
   * Envia mensagens distribuindo entre múltiplas sessões
   * @param {Array<string>} phoneNumbers - Lista de números
   * @param {Array<string>} messages - Lista de mensagens
   */
  async sendBulkMultiSession(phoneNumbers, messages) {
    try {
      const activeSessions = sessionManager.getAllSessions();
      
      if (activeSessions.length === 0) {
        throw new Error('Nenhuma sessão ativa disponível');
      }

      logger.info(`📤 Enviando com ${activeSessions.length} sessões ativas`);
      
      messageRotator.loadMessages(messages);

      this.sendingStats = {
        sent: 0,
        failed: 0,
        total: phoneNumbers.length
      };

      const results = [];

      for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        const message = messageRotator.getNextMessage();

        // Usa round-robin entre as sessões
        const result = await this.sendMessage(phone, message);
        results.push(result);

        logger.info(`Progresso: ${i + 1}/${phoneNumbers.length}`);

        // Delay humanizado entre números
        if (i < phoneNumbers.length - 1) {
          const { delayTime } = await humanizedDelay(settings.numberDelay, { messageIndex: i });
          logger.info(`⏱️ Aguardando ${(delayTime / 1000).toFixed(1)}s`);
        }
      }

      logger.info(`\n📊 Envio multi-sessão concluído!`);
      logger.info(`✅ Enviadas: ${this.sendingStats.sent}`);
      logger.info(`❌ Falhas: ${this.sendingStats.failed}`);

      return {
        stats: this.sendingStats,
        results
      };
    } catch (error) {
      logger.error('Erro no envio multi-sessão:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de envio
   */
  getStats() {
    return this.sendingStats;
  }
}

export default new MessageSender();
