import makeWASocket, { 
  DisconnectReason, 
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { logger } from '../config/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { useDatabaseAuthState, clearAuthState } from './authStateDB.js';
import instanceManager from '../services/instanceManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.authFolder = path.join(process.cwd(), 'auth_sessions');
    this.messageStatusCallbacks = [];
    this.messageReceivedCallbacks = [];
    this.connectionCallbacks = [];
    this.sentMessages = new Map(); // Rastreia mensagens enviadas: messageId -> {phone, campaignName}
  }

  /**
   * Registra callback para atualizações de status de mensagem
   * @param {Function} callback - (phone, status, details) => {}
   */
  onMessageStatus(callback) {
    this.messageStatusCallbacks.push(callback);
  }

  /**
   * Registra callback para mensagens recebidas
   * @param {Function} callback - (phone, message) => {}
   */
  onMessageReceived(callback) {
    this.messageReceivedCallbacks.push(callback);
  }

  /**
   * Registra callback para mudanças de conexão
   * @param {Function} callback - (sessionId, event, data) => {}
   */
  onConnectionUpdate(callback) {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Registra mensagem enviada para rastreamento
   */
  trackSentMessage(messageId, phone, campaignName) {
    this.sentMessages.set(messageId, { phone, campaignName, sentAt: new Date() });
    
    // Limpa mensagens antigas a cada 100 novas mensagens
    if (this.sentMessages.size % 100 === 0) {
      this.cleanOldMessages();
    }
  }

  /**
   * Remove mensagens com mais de 24 horas do rastreamento
   */
  cleanOldMessages() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    const now = Date.now();
    let removed = 0;
    
    for (const [messageId, data] of this.sentMessages.entries()) {
      if (now - new Date(data.sentAt).getTime() > maxAge) {
        this.sentMessages.delete(messageId);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info(`🧹 Limpeza de mensagens antigas: ${removed} removidas, ${this.sentMessages.size} restantes`);
    }
  }

  /**
   * Cria uma nova sessão do WhatsApp
   * @param {string} sessionId - ID único da sessão
   */
  async createSession(sessionId, options = {}) {
    const { waitForConnection = true, forceNew = false } = options;
    
    if (!sessionId) {
      throw new Error('sessionId é obrigatório para criar sessão');
    }
    
    if (forceNew && this.sessions.has(sessionId)) {
      await this.removeSession(sessionId);
    } else if (this.sessions.has(sessionId)) {
      const existingSession = this.sessions.get(sessionId);
      const isReady = existingSession?.isReady && existingSession?.sock?.user;

      if (isReady) {
        logger.info(`Sessão ${sessionId} já está ativa. Reutilizando conexão existente.`);
        return existingSession.sock;
      }

      logger.info(`Sessão ${sessionId} existente porém não pronta. Encerrando socket antigo e recriando...`);
      try {
        if (typeof existingSession?.sock?.end === 'function') {
          await existingSession.sock.end();
        }
      } catch (error) {
        logger.warn(`Erro ao encerrar socket antigo da sessão ${sessionId}: ${error.message}`);
      }

      try {
        existingSession?.sock?.ws?.close?.();
      } catch (error) {
        logger.warn(`Erro ao fechar WebSocket da sessão ${sessionId}: ${error.message}`);
      }

      this.sessions.delete(sessionId);
    }
    
    try {
      logger.info(`Criando sessão: ${sessionId}`);
      
      // Se forceNew, remove credenciais antigas do banco
      if (forceNew) {
        try {
          const removed = clearAuthState(sessionId);
          logger.info(`${removed} credenciais antigas removidas do banco para nova sessão`);
        } catch (error) {
          logger.warn(`Erro ao limpar credenciais antigas: ${error.message}`);
        }
      }
      
      // Usa banco de dados em vez de arquivos
      const { state, saveCreds } = await useDatabaseAuthState(sessionId);

      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ session: sessionId }),
        browser: ['Chrome (Linux)', '', ''],
        getMessage: async () => undefined,
        // CRÍTICO: Desabilita sincronização de histórico e app state (evita erro "Invalid patch mac")
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false, // Não sincroniza mensagens antigas
        // Configurações para manter conexão estável no Railway
        keepAliveIntervalMs: 30000, // Ping a cada 30s
        connectTimeoutMs: 60000, // Timeout de 60s
        defaultQueryTimeoutMs: 60000,
        emitOwnEvents: false,
        markOnlineOnConnect: true,
        // Configurações de retry
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        // WebSocket
        qrTimeout: 60000
      });

      // Evento de atualização de credenciais
      sock.ev.on('creds.update', saveCreds);

      // Ignorar eventos de sincronização de app state (evita "Invalid patch mac")
      sock.ev.on('messaging-history.set', () => {
        logger.info(`Ignorando sincronização de histórico para ${sessionId}`);
      });

      // Evento de atualização de status de mensagens
      sock.ev.on('messages.update', (updates) => {
        for (const update of updates) {
          const messageId = update.key.id;
          const messageData = this.sentMessages.get(messageId);
          
          if (!messageData) continue;
          
          const { phone, campaignName } = messageData;
          
          // Status: delivered (recebido)
          if (update.update.status === 3) {
            logger.info(`📨 Mensagem RECEBIDA: ${phone}`);
            this.messageStatusCallbacks.forEach(cb => {
              cb(phone, 'received', { campaignName, messageId });
            });
          }
          
          // Status: read (lido)
          if (update.update.status === 4) {
            logger.info(`👁️ Mensagem LIDA: ${phone}`);
            this.messageStatusCallbacks.forEach(cb => {
              cb(phone, 'read', { campaignName, messageId });
            });
          }
        }
      });

      // Evento de mensagens recebidas (respostas)
      sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
          // Ignora mensagens enviadas por nós
          if (msg.key.fromMe) continue;
          
          const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
          
          // Verifica se é resposta a uma mensagem nossa
          const sentMessage = Array.from(this.sentMessages.values())
            .find(m => m.phone === phone);
          
          if (sentMessage) {
            logger.info(`💬 Mensagem RESPONDIDA: ${phone}`);
            this.messageStatusCallbacks.forEach(cb => {
              cb(phone, 'replied', { 
                campaignName: sentMessage.campaignName,
                message: msg.message?.conversation || msg.message?.extendedTextMessage?.text
              });
            });
          }
        }
      });

      // Evento de atualização de conexão
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info(`QR Code para sessão ${sessionId}:`);
          qrcode.generate(qr, { small: true });
          
          // Notifica callbacks
          this.connectionCallbacks.forEach(cb => {
            cb(sessionId, 'qr', { qr });
          });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          logger.info(`Conexão fechada para ${sessionId}. StatusCode: ${statusCode}, Reconectar: ${shouldReconnect}`);
          
          // Marca sessão como não pronta
          const session = this.sessions.get(sessionId);
          if (session) {
            session.isReady = false;
          }
          
          // Notifica callbacks
          this.connectionCallbacks.forEach(cb => {
            cb(sessionId, 'close', { shouldReconnect, lastDisconnect, statusCode });
          });
          
          if (shouldReconnect) {
            // Aguarda 3s antes de reconectar para evitar loops rápidos
            logger.info(`⏳ Aguardando 3s antes de reconectar ${sessionId}...`);
            setTimeout(async () => {
              try {
                logger.info(`🔄 Reconectando ${sessionId}...`);
                await this.createSession(sessionId, { waitForConnection: false });
              } catch (error) {
                logger.error(`Erro ao reconectar ${sessionId}: ${error.message}`);
              }
            }, 3000);
          } else {
            logger.warn(`🚫 Sessão ${sessionId} foi deslogada. Removendo...`);
            this.sessions.delete(sessionId);
            // Limpa credenciais do banco se foi deslogado
            try {
              clearAuthState(sessionId);
              logger.info(`🗑️ Credenciais de ${sessionId} removidas após logout`);
            } catch (error) {
              logger.error(`Erro ao limpar credenciais: ${error.message}`);
            }
          }
        } else if (connection === 'open') {
          logger.info(`✅ Sessão ${sessionId} conectada com sucesso!`);
          
          // Marca sessão como pronta
          const session = this.sessions.get(sessionId);
          if (session) {
            session.isReady = true;
            logger.info(`🔑 Sessão ${sessionId} marcada como pronta (isReady=true)`);
          } else {
            logger.warn(`⚠️ Sessão ${sessionId} não encontrada no Map ao marcar como pronta`);
          }
          
          // Obtém telefone
          const phone = sock.user?.id?.split(':')[0] || 'Conectado';
          logger.info(`📞 Telefone da sessão ${sessionId}: ${phone}`);
          
          // Notifica callbacks
          logger.info(`🔔 Notificando ${this.connectionCallbacks.length} callback(s) de conexão para ${sessionId}`);
          this.connectionCallbacks.forEach(cb => {
            try {
              cb(sessionId, 'open', { phone, user: sock.user });
            } catch (error) {
              logger.error(`Erro ao executar callback de conexão: ${error.message}`);
            }
          });
        }
      });

      this.sessions.set(sessionId, {
        sock,
        isReady: false,
        lastUsed: Date.now()
      });

      // Aguarda a conexão estar pronta caso seja solicitado
      if (waitForConnection) {
        await this.waitForConnection(sessionId);
      }

      return sock;
    } catch (error) {
      logger.error(`Erro ao criar sessão ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Aguarda a sessão estar pronta para uso
   * @param {string} sessionId 
   */
  async waitForConnection(sessionId, timeout = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const session = this.sessions.get(sessionId);
      
      if (session && session.sock.user) {
        session.isReady = true;
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Timeout ao aguardar conexão da sessão ${sessionId}`);
  }

  /**
   * Obtém uma sessão específica
   * @param {string} sessionId 
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isReady) {
      return null;
    }
    return session.sock;
  }

  /**
   * Obtém todas as sessões ativas
   */
  getAllSessions() {
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => session.isReady)
      .map(([id, session]) => ({
        id,
        phone: session.sock.user?.id,
        isReady: session.isReady
      }));
  }

  /**
   * Obtém uma sessão disponível para um usuário específico usando round-robin
   * @param {number|string} userId
   * @param {Array<string>} linkedInstanceIds - IDs das instâncias vinculadas (opcional)
   */
  getAvailableSessionForUser(userId, linkedInstanceIds = null) {
    if (!userId) {
      return this.getAvailableSession();
    }

    const userInstances = instanceManager.listInstances(userId) || [];
    
    // Se linkedInstanceIds for fornecido, filtra apenas essas instâncias
    let filteredInstances = userInstances;
    if (linkedInstanceIds && linkedInstanceIds.length > 0) {
      filteredInstances = userInstances.filter(i => linkedInstanceIds.includes(i.id));
    }
    
    const allowedSessionIds = filteredInstances.map(i => i.sessionId).filter(Boolean);

    if (allowedSessionIds.length === 0) {
      return null;
    }

    const activeSessions = Array.from(this.sessions.entries())
      .filter(([id, session]) => session.isReady && allowedSessionIds.includes(id));

    if (activeSessions.length === 0) {
      return null;
    }

    activeSessions.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const [sessionId, session] = activeSessions[0];
    session.lastUsed = Date.now();

    return {
      id: sessionId,
      sock: session.sock
    };
  }

  /**
   * Obtém uma sessão disponível usando round-robin
   */
  getAvailableSession() {
    const activeSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.isReady);

    if (activeSessions.length === 0) {
      return null;
    }

    // Ordena por última utilização e retorna a menos usada
    activeSessions.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    
    const [sessionId, session] = activeSessions[0];
    session.lastUsed = Date.now();
    
    return {
      id: sessionId,
      sock: session.sock
    };
  }

  /**
   * Remove uma sessão
   * @param {string} sessionId 
   */
  async removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.sock.logout();
      } catch (error) {
        logger.warn(`Erro ao fazer logout da sessão ${sessionId}: ${error.message}`);
      }
      this.sessions.delete(sessionId);
      logger.info(`Sessão ${sessionId} removida`);
    }
    
    // Remove credenciais do banco de dados
    try {
      const removed = clearAuthState(sessionId);
      logger.info(`${removed} credenciais removidas do banco para ${sessionId}`);
    } catch (error) {
      logger.warn(`Erro ao remover credenciais do banco: ${error.message}`);
    }
  }

  /**
   * Remove todas as sessões
   */
  async removeAllSessions() {
    for (const [sessionId, _] of this.sessions) {
      await this.removeSession(sessionId);
    }
  }

  /**
   * Restaura sessões a partir de instâncias persistidas
   * @param {Array<{sessionId: string}>} instances
   */
  async restoreSessions(instances = []) {
    if (!Array.isArray(instances) || instances.length === 0) {
      return [];
    }

    const restored = [];

    for (const instance of instances) {
      const sessionId = instance?.sessionId;
      if (!sessionId) {
        continue;
      }

      if (this.sessions.has(sessionId)) {
        restored.push(sessionId);
        continue;
      }

      try {
        await this.createSession(sessionId, { waitForConnection: false });
        restored.push(sessionId);
        logger.info(`🔄 Sessão ${sessionId} em restauração após reinício.`);
        
        // Aguarda até 5 segundos para a sessão conectar, verificando a cada 500ms
        let attempts = 0;
        const maxAttempts = 10; // 10 x 500ms = 5 segundos
        let connected = false;
        
        while (attempts < maxAttempts && !connected) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
          
          const session = this.sessions.get(sessionId);
          if (session && session.sock && session.sock.user) {
            const phone = session.sock.user?.id?.split(':')[0] || 'Conectado';
            logger.info(`✅ Sessão ${sessionId} restaurada e conectada: ${phone} (tentativa ${attempts})`);
            
            // Marca como pronta
            session.isReady = true;
            
            // Emite evento de conexão aberta
            this.connectionCallbacks.forEach(cb => {
              try {
                cb(sessionId, 'open', { phone, user: session.sock.user });
              } catch (cbError) {
                logger.error(`Erro ao executar callback após restauração: ${cbError.message}`);
              }
            });
            
            connected = true;
            break;
          }
        }
        
        if (!connected) {
          logger.warn(`⚠️ Sessão ${sessionId} não conectou após ${maxAttempts * 500}ms. Permanecerá em connecting.`);
        }
      } catch (error) {
        logger.error(`Erro ao restaurar sessão ${sessionId}: ${error.message}`);
        this.connectionCallbacks.forEach(cb => {
          cb(sessionId, 'restore-error', { error: error.message });
        });
      }
    }

    return restored;
  }
}

export default new SessionManager();
