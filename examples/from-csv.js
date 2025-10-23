/**
 * Exemplo usando arquivo CSV com dados estruturados
 */

import sessionManager from '../src/whatsapp/sessionManager.js';
import messageSender from '../src/services/messageSender.js';
import messageRotator from '../src/services/messageRotator.js';
import { loadContactsFromCSV, saveResultsToFile } from '../src/utils/fileLoader.js';
import { logger } from '../src/config/logger.js';
import path from 'path';

async function main() {
  try {
    // 1. Cria sessão
    logger.info('Criando sessão...');
    await sessionManager.createSession('from_csv');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Carrega contatos do CSV
    const csvFile = path.join(process.cwd(), 'examples', 'contacts.csv');
    const contacts = await loadContactsFromCSV(csvFile);

    if (contacts.length === 0) {
      throw new Error('Nenhum contato encontrado no CSV');
    }

    logger.info(`${contacts.length} contatos carregados`);

    // 3. Mensagens com variáveis
    const messages = [
      'Olá {name}! Temos uma promoção especial de {product} para você!',
      'Oi {name}! O {product} que você procurava está com 50% OFF!',
      'E aí {name}! Última chance para garantir seu {product}!'
    ];

    messageRotator.loadMessages(messages);

    // 4. Envia para cada contato
    const results = [];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      const personalizedMessage = messageRotator.getNextCustomMessage({
        name: contact.name,
        product: contact.product
      });

      logger.info(`Enviando para ${contact.name} (${contact.phone})`);
      
      const result = await messageSender.sendMessage(
        contact.phone,
        personalizedMessage
      );
      
      results.push(result);
      
      // Delay entre mensagens
      if (i < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 5. Salva resultados
    const resultsFile = path.join(process.cwd(), 'results-csv.csv');
    await saveResultsToFile(resultsFile, results);

    logger.info('Envio concluído!');
    
    const stats = messageSender.getStats();
    logger.info(JSON.stringify(stats, null, 2));

    // 6. Limpa
    await sessionManager.removeAllSessions();
    
    process.exit(0);
  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

main();
