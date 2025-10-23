/**
 * Exemplo de uso programático do sistema de campanhas
 */

import campaignManager from '../src/services/campaignManager.js';
import sessionManager from '../src/whatsapp/sessionManager.js';
import dispatcher from '../src/services/dispatcher.js';
import { logger } from '../src/config/logger.js';

async function main() {
  try {
    // Inicializa o gerenciador de campanhas
    await campaignManager.initialize();

    // 1. Conecta uma sessão do WhatsApp
    logger.info('1. Conectando WhatsApp...');
    await sessionManager.createSession('campanha-exemplo');
    logger.info('Escaneie o QR Code');
    
    // Aguarda conexão
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 2. Cria uma campanha
    logger.info('\n2. Criando campanha...');
    const campaign = campaignManager.createCampaign('minha-primeira-campanha');

    // 3. Adiciona números
    logger.info('3. Adicionando números...');
    campaignManager.addNumbers('minha-primeira-campanha', [
      '5511999999999',  // Substitua por números reais
      '5511888888888',
      '5511777777777'
    ]);

    // 4. Define mensagens
    logger.info('4. Definindo mensagens...');
    campaignManager.setMessages('minha-primeira-campanha', [
      'Olá! Esta é a primeira mensagem de teste.',
      'Oi! Esta é a segunda mensagem de teste.',
      'E aí! Esta é a terceira mensagem de teste.'
    ]);

    // 5. Salva a campanha
    logger.info('5. Salvando campanha...');
    await campaignManager.saveCampaign('minha-primeira-campanha');

    // 6. Inicia o disparo
    logger.info('6. Iniciando disparo...\n');
    await dispatcher.runCampaign('minha-primeira-campanha');

    // 7. Mostra estatísticas finais
    const finalCampaign = campaignManager.getCampaign('minha-primeira-campanha');
    logger.info('\n📊 Estatísticas Finais:');
    logger.info(JSON.stringify(finalCampaign.stats, null, 2));

    // Limpa
    await sessionManager.removeAllSessions();
    process.exit(0);

  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

// Exemplo de como pausar/retomar programaticamente
async function exemploComControle() {
  try {
    await campaignManager.initialize();
    await sessionManager.createSession('controle-exemplo');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    const campaign = campaignManager.createCampaign('campanha-controlada');
    campaignManager.addNumbers('campanha-controlada', [
      '5511999999999',
      '5511888888888',
      '5511777777777',
      '5511666666666',
      '5511555555555'
    ]);

    campaignManager.setMessages('campanha-controlada', [
      'Mensagem 1',
      'Mensagem 2'
    ]);

    // Inicia o disparo em background
    const dispatchPromise = dispatcher.runCampaign('campanha-controlada');

    // Após 10 segundos, pausa
    setTimeout(() => {
      logger.info('\n⏸️ Pausando após 10 segundos...');
      dispatcher.pause();

      // Adiciona mais números durante a pausa
      setTimeout(() => {
        logger.info('\n➕ Adicionando mais números...');
        campaignManager.addNumbers('campanha-controlada', [
          '5511444444444',
          '5511333333333'
        ]);

        // Retoma após 5 segundos
        setTimeout(() => {
          logger.info('\n▶️ Retomando disparo...');
          dispatcher.resume();
        }, 5000);

      }, 3000);

    }, 10000);

    // Aguarda conclusão
    await dispatchPromise;

    await sessionManager.removeAllSessions();
    process.exit(0);

  } catch (error) {
    logger.error('Erro:', error);
    process.exit(1);
  }
}

// Descomente para executar o exemplo com controle
// exemploComControle();

main();
