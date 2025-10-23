import sessionManager from './whatsapp/sessionManager.js';
import messageSender from './services/messageSender.js';
import messageRotator from './services/messageRotator.js';
import queueManager from './services/queueManager.js';
import { logger } from './config/logger.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

class WhatsAppBulkSender {
  constructor() {
    this.sessions = [];
  }

  async showMenu() {
    console.clear();
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   WhatsApp Multi-Sender - Baileys API    ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log('1. Adicionar Sessão (Conectar WhatsApp)');
    console.log('2. Listar Sessões Ativas');
    console.log('3. Enviar Mensagens em Lote');
    console.log('4. Enviar com Multi-Sessões');
    console.log('5. Remover Sessão');
    console.log('6. Estatísticas');
    console.log('0. Sair\n');
  }

  async addSession() {
    const sessionId = await question('\n📱 Digite um ID para a sessão (ex: session1): ');
    
    if (!sessionId.trim()) {
      logger.error('ID de sessão inválido');
      return;
    }

    logger.info(`\n🔄 Iniciando sessão ${sessionId}...`);
    logger.info('📱 Escaneie o QR Code com seu WhatsApp:\n');

    try {
      await sessionManager.createSession(sessionId);
      this.sessions.push(sessionId);
      logger.info(`\n✅ Sessão ${sessionId} conectada com sucesso!`);
    } catch (error) {
      logger.error(`Erro ao criar sessão: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async listSessions() {
    console.clear();
    const sessions = sessionManager.getAllSessions();
    
    console.log('\n📋 Sessões Ativas:\n');
    
    if (sessions.length === 0) {
      console.log('Nenhuma sessão ativa no momento.');
    } else {
      sessions.forEach((session, index) => {
        console.log(`${index + 1}. ID: ${session.id}`);
        console.log(`   Telefone: ${session.phone}`);
        console.log(`   Status: ${session.isReady ? '✅ Pronta' : '⏳ Aguardando'}\n`);
      });
    }

    await question('\nPressione ENTER para continuar...');
  }

  async sendBulkMessages() {
    console.clear();
    console.log('\n📤 Envio em Lote\n');

    // Verifica se há sessões ativas
    const sessions = sessionManager.getAllSessions();
    if (sessions.length === 0) {
      logger.error('❌ Nenhuma sessão ativa. Adicione uma sessão primeiro.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    // Coleta números
    console.log('Digite os números (um por linha, linha vazia para finalizar):');
    const phoneNumbers = [];
    
    while (true) {
      const phone = await question('> ');
      if (!phone.trim()) break;
      phoneNumbers.push(phone.trim());
    }

    if (phoneNumbers.length === 0) {
      logger.error('❌ Nenhum número fornecido.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    // Coleta mensagens
    console.log('\nDigite as mensagens para alternância (linha vazia para finalizar):');
    console.log('Você pode usar variáveis: {nome}, {numero}, {total}\n');
    const messages = [];
    
    while (true) {
      const message = await question('> ');
      if (!message.trim()) break;
      messages.push(message.trim());
    }

    if (messages.length === 0) {
      logger.error('❌ Nenhuma mensagem fornecida.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    // Confirma envio
    console.log(`\n📊 Resumo:`);
    console.log(`- ${phoneNumbers.length} números`);
    console.log(`- ${messages.length} mensagens`);
    
    const confirm = await question('\nConfirmar envio? (s/n): ');
    
    if (confirm.toLowerCase() !== 's') {
      logger.info('Envio cancelado.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    // Envia mensagens
    try {
      await messageSender.sendBulk(phoneNumbers, messages);
    } catch (error) {
      logger.error(`Erro no envio: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async sendMultiSession() {
    console.clear();
    console.log('\n📤 Envio Multi-Sessão\n');

    const sessions = sessionManager.getAllSessions();
    if (sessions.length < 2) {
      logger.error('❌ São necessárias pelo menos 2 sessões ativas.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    console.log(`✅ ${sessions.length} sessões ativas disponíveis\n`);

    // Coleta números
    console.log('Digite os números (um por linha, linha vazia para finalizar):');
    const phoneNumbers = [];
    
    while (true) {
      const phone = await question('> ');
      if (!phone.trim()) break;
      phoneNumbers.push(phone.trim());
    }

    if (phoneNumbers.length === 0) {
      logger.error('❌ Nenhum número fornecido.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    // Coleta mensagens
    console.log('\nDigite as mensagens (linha vazia para finalizar):');
    const messages = [];
    
    while (true) {
      const message = await question('> ');
      if (!message.trim()) break;
      messages.push(message.trim());
    }

    if (messages.length === 0) {
      logger.error('❌ Nenhuma mensagem fornecida.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    // Confirma e envia
    const confirm = await question(`\nEnviar para ${phoneNumbers.length} números usando ${sessions.length} sessões? (s/n): `);
    
    if (confirm.toLowerCase() === 's') {
      try {
        await messageSender.sendBulkMultiSession(phoneNumbers, messages);
      } catch (error) {
        logger.error(`Erro no envio: ${error.message}`);
      }
    }

    await question('\nPressione ENTER para continuar...');
  }

  async removeSession() {
    const sessions = sessionManager.getAllSessions();
    
    if (sessions.length === 0) {
      logger.error('Nenhuma sessão ativa.');
      await question('\nPressione ENTER para continuar...');
      return;
    }

    console.log('\n📋 Sessões:\n');
    sessions.forEach((session, index) => {
      console.log(`${index + 1}. ${session.id} (${session.phone})`);
    });

    const choice = await question('\nEscolha o número da sessão para remover: ');
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < sessions.length) {
      const sessionId = sessions[index].id;
      await sessionManager.removeSession(sessionId);
      logger.info(`Sessão ${sessionId} removida.`);
    } else {
      logger.error('Opção inválida.');
    }

    await question('\nPressione ENTER para continuar...');
  }

  async showStats() {
    console.clear();
    const stats = messageSender.getStats();
    const sessions = sessionManager.getAllSessions();

    console.log('\n📊 Estatísticas\n');
    console.log(`Sessões Ativas: ${sessions.length}`);
    console.log(`\nÚltimo Envio:`);
    console.log(`- Total: ${stats.total}`);
    console.log(`- Enviadas: ${stats.sent}`);
    console.log(`- Falhas: ${stats.failed}`);
    console.log(`- Taxa de Sucesso: ${stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(2) : 0}%`);

    await question('\nPressione ENTER para continuar...');
  }

  async run() {
    let running = true;

    while (running) {
      await this.showMenu();
      const choice = await question('Escolha uma opção: ');

      switch (choice.trim()) {
        case '1':
          await this.addSession();
          break;
        case '2':
          await this.listSessions();
          break;
        case '3':
          await this.sendBulkMessages();
          break;
        case '4':
          await this.sendMultiSession();
          break;
        case '5':
          await this.removeSession();
          break;
        case '6':
          await this.showStats();
          break;
        case '0':
          console.log('\n👋 Encerrando...');
          await sessionManager.removeAllSessions();
          running = false;
          break;
        default:
          logger.error('Opção inválida.');
          await question('\nPressione ENTER para continuar...');
      }
    }

    rl.close();
    process.exit(0);
  }
}

// Inicializa a aplicação
const app = new WhatsAppBulkSender();
app.run().catch(error => {
  logger.error('Erro fatal:', error);
  process.exit(1);
});
