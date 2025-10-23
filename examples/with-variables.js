/**
 * Exemplo usando variáveis dinâmicas nas mensagens
 */

import sessionManager from '../src/whatsapp/sessionManager.js';
import messageSender from '../src/services/messageSender.js';
import messageRotator from '../src/services/messageRotator.js';
import { logger } from '../src/config/logger.js';

async function main() {
  try {
    // 1. Cria sessão
    logger.info('Criando sessão...');
    await sessionManager.createSession('exemplo_vars');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Lista de contatos com informações personalizadas
    const contacts = [
      { phone: '5511999999999', name: 'João', produto: 'Notebook' },
      { phone: '5511888888888', name: 'Maria', produto: 'Mouse' },
      { phone: '5511777777777', name: 'Pedro', produto: 'Teclado' }
    ];

    // 3. Mensagens com variáveis
    const messages = [
      'Olá {nome}! Temos uma promoção especial de {produto} para você!',
      'Oi {nome}! O {produto} que você procurava está com desconto!',
      'E aí {nome}! Não perca a oferta de {produto}!'
    ];

    messageRotator.loadMessages(messages);

    // 4. Envia para cada contato com variáveis personalizadas
    logger.info('Iniciando envio personalizado...');
    
    for (const contact of contacts) {
      const personalizedMessage = messageRotator.getNextCustomMessage({
        nome: contact.name,
        produto: contact.produto
      });

      await messageSender.sendMessage(contact.phone, personalizedMessage);
      
      // Delay entre mensagens
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    logger.info('Envio concluído!');

    // 5. Limpa
    await sessionManager.removeAllSessions();
    
    process.exit(0);
  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

main();
