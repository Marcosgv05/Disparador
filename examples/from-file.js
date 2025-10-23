/**
 * Exemplo carregando números e mensagens de arquivos
 */

import sessionManager from '../src/whatsapp/sessionManager.js';
import messageSender from '../src/services/messageSender.js';
import { loadPhoneNumbersFromFile, loadMessagesFromFile, saveResultsToFile } from '../src/utils/fileLoader.js';
import { logger } from '../src/config/logger.js';
import path from 'path';

async function main() {
  try {
    // 1. Cria sessão
    logger.info('Criando sessão...');
    await sessionManager.createSession('from_file');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Carrega números e mensagens dos arquivos
    const contactsFile = path.join(process.cwd(), 'examples', 'contacts.txt');
    const messagesFile = path.join(process.cwd(), 'examples', 'messages.txt');

    logger.info('Carregando arquivos...');
    const phoneNumbers = await loadPhoneNumbersFromFile(contactsFile);
    const messages = await loadMessagesFromFile(messagesFile);

    if (phoneNumbers.length === 0) {
      throw new Error('Nenhum número encontrado no arquivo');
    }

    if (messages.length === 0) {
      throw new Error('Nenhuma mensagem encontrada no arquivo');
    }

    // 3. Envia
    logger.info('Iniciando envio...');
    const result = await messageSender.sendBulk(phoneNumbers, messages);

    // 4. Salva resultados
    const resultsFile = path.join(process.cwd(), 'results.csv');
    await saveResultsToFile(resultsFile, result.results);

    logger.info('Processo concluído!');
    logger.info(JSON.stringify(result.stats, null, 2));

    // 5. Limpa
    await sessionManager.removeAllSessions();
    
    process.exit(0);
  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

main();
