/**
 * Exemplo simples de envio de mensagens
 */

import sessionManager from '../src/whatsapp/sessionManager.js';
import messageSender from '../src/services/messageSender.js';
import { logger } from '../src/config/logger.js';

async function main() {
  try {
    // 1. Cria uma sessão
    logger.info('Criando sessão...');
    await sessionManager.createSession('exemplo1');
    
    logger.info('Aguarde e escaneie o QR Code...');
    
    // Aguarda alguns segundos para garantir conexão
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Define os números alvo
    const phoneNumbers = [
      '5511999999999',  // Substitua pelos números reais
      '5511888888888'
    ];

    // 3. Define as mensagens para alternância
    const messages = [
      'Olá! Esta é a primeira mensagem de teste.',
      'Oi! Esta é a segunda mensagem de teste.',
      'E aí! Esta é a terceira mensagem de teste.'
    ];

    // 4. Envia as mensagens
    logger.info('Iniciando envio...');
    const result = await messageSender.sendBulk(phoneNumbers, messages);

    logger.info('Envio concluído!');
    logger.info(JSON.stringify(result.stats, null, 2));

    // 5. Limpa as sessões
    await sessionManager.removeAllSessions();
    
    process.exit(0);
  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

main();
