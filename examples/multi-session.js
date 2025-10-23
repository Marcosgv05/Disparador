/**
 * Exemplo de envio com múltiplas sessões
 */

import sessionManager from '../src/whatsapp/sessionManager.js';
import messageSender from '../src/services/messageSender.js';
import { logger } from '../src/config/logger.js';

async function main() {
  try {
    // 1. Cria múltiplas sessões
    logger.info('Criando sessões...');
    
    const sessions = ['conta1', 'conta2', 'conta3'];
    
    for (const sessionId of sessions) {
      logger.info(`Criando sessão ${sessionId}...`);
      await sessionManager.createSession(sessionId);
      logger.info(`Escaneie o QR Code para ${sessionId}\n`);
      
      // Aguarda um pouco entre cada sessão
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    logger.info('Aguardando todas as conexões...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 2. Verifica sessões ativas
    const activeSessions = sessionManager.getAllSessions();
    logger.info(`${activeSessions.length} sessões ativas`);

    if (activeSessions.length === 0) {
      throw new Error('Nenhuma sessão ativa');
    }

    // 3. Define números para envio
    const phoneNumbers = [
      '5511999999999',
      '5511888888888',
      '5511777777777',
      '5511666666666',
      '5511555555555',
      '5511444444444'
    ];

    // 4. Define mensagens
    const messages = [
      'Mensagem 1 - Enviada via múltiplas contas',
      'Mensagem 2 - Sistema de rotação automática',
      'Mensagem 3 - Distribuição inteligente'
    ];

    // 5. Envia usando multi-sessão
    logger.info('Iniciando envio multi-sessão...');
    const result = await messageSender.sendBulkMultiSession(phoneNumbers, messages);

    logger.info('Envio concluído!');
    logger.info(JSON.stringify(result.stats, null, 2));

    // 6. Limpa
    await sessionManager.removeAllSessions();
    
    process.exit(0);
  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

main();
