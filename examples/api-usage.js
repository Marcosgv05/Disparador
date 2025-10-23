/**
 * Exemplo de uso da API programática
 */

import WhatsAppAPI from '../src/api.js';
import { logger } from '../src/config/logger.js';

async function main() {
  try {
    logger.info('=== Exemplo de Uso da API ===\n');

    // 1. Criar sessão
    logger.info('1. Criando sessão...');
    await WhatsAppAPI.createSession('api-session');
    logger.info('✅ Sessão criada! Escaneie o QR Code.\n');

    // Aguarda conexão
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 2. Listar sessões
    logger.info('2. Listando sessões ativas...');
    const sessions = WhatsAppAPI.listSessions();
    logger.info(`Sessões ativas: ${sessions.length}\n`);

    // 3. Preparar mensagens
    logger.info('3. Preparando mensagens...');
    const messages = [
      'Olá {nome}! Esta é uma mensagem via API.',
      'Oi {nome}! Testando a API do Multi-Sender.',
      'E aí {nome}! API funcionando perfeitamente!'
    ];
    WhatsAppAPI.loadMessagesInRotator(messages);

    // 4. Enviar mensagens
    logger.info('4. Enviando mensagens...');
    const phoneNumbers = [
      '558599667548',
    ];

    for (const phone of phoneNumbers) {
      const message = WhatsAppAPI.getNextMessage({ nome: 'Cliente' });
      const result = await WhatsAppAPI.sendMessage(phone, message);
      
      if (result.success) {
        logger.info(`✅ Enviado para ${phone}`);
      } else {
        logger.error(`❌ Falha para ${phone}: ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 5. Verificar estatísticas
    logger.info('\n5. Estatísticas:');
    const stats = WhatsAppAPI.getStats();
    logger.info(JSON.stringify(stats, null, 2));

    // 6. Envio em lote
    logger.info('\n6. Testando envio em lote...');
    const bulkResult = await WhatsAppAPI.sendBulk(
      ['5511777777777', '5511666666666'],
      ['Mensagem 1 em lote', 'Mensagem 2 em lote'],
      { customerName: 'Teste API' }
    );
    logger.info(`Enviadas: ${bulkResult.stats.sent}, Falhas: ${bulkResult.stats.failed}`);

    // 7. Criar e processar fila
    logger.info('\n7. Testando sistema de filas...');
    WhatsAppAPI.createQueue('test-queue');
    WhatsAppAPI.addToQueue('test-queue', [
      { phone: '5511555555555', name: 'João' },
      { phone: '5511444444444', name: 'Maria' }
    ]);

    await WhatsAppAPI.processQueue('test-queue', async (item) => {
      logger.info(`Processando: ${item.name}`);
      return { processed: true };
    });

    logger.info('\n✅ Todos os testes da API concluídos!');

    // Limpar
    await WhatsAppAPI.removeSession('api-session');
    process.exit(0);

  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

main();
