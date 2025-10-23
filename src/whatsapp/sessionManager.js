import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { logger } from '../config/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.authFolder = path.join(process.cwd(), 'auth_sessions');
  }

  /**
   * Cria uma nova sessão do WhatsApp
   * @param {string} sessionId - ID único da sessão
   */
  async createSession(sessionId) {
    try {
      logger.info(`Criando sessão: ${sessionId}`);
      
      const { state, saveCreds } = await useMultiFileAuthState(
        path.join(this.authFolder, sessionId)
      );

      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ session: sessionId }),
        browser: ['WhatsApp Multi-Sender', 'Chrome', '10.0'],
        getMessage: async () => undefined
      });

      // Evento de atualização de credenciais
      sock.ev.on('creds.update', saveCreds);

      // Evento de atualização de conexão
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info(`QR Code para sessão ${sessionId}:`);
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          
          logger.info(`Conexão fechada para ${sessionId}. Reconectar: ${shouldReconnect}`);
          
          if (shouldReconnect) {
            await this.createSession(sessionId);
          } else {
            this.sessions.delete(sessionId);
          }
        } else if (connection === 'open') {
          logger.info(`✅ Sessão ${sessionId} conectada com sucesso!`);
        }
      });

      this.sessions.set(sessionId, {
        sock,
        isReady: false,
        lastUsed: Date.now()
      });

      // Aguarda a conexão estar pronta
      await this.waitForConnection(sessionId);

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
      await session.sock.logout();
      this.sessions.delete(sessionId);
      logger.info(`Sessão ${sessionId} removida`);
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
}

export default new SessionManager();
