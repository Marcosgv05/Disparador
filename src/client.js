import sessionManager from './whatsapp/sessionManager.js';
import campaignManager from './services/campaignManager.js';
import dispatcher from './services/dispatcher.js';
import { logger } from './config/logger.js';
import { loadPhoneNumbersFromFile, loadMessagesFromFile } from './utils/fileLoader.js';
import readline from 'readline';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

class WhatsAppClient {
  constructor() {
    this.sessionConnected = false;
    this.currentCampaign = null;
    this.dispatcherRunning = false;
  }

  async initialize() {
    await campaignManager.initialize();
  }

  async showMainMenu() {
    console.clear();
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  📱 WhatsApp Disparador - Sistema de Campanha ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    // Status da sessão
    const sessions = sessionManager.getAllSessions();
    if (sessions.length > 0) {
      console.log(`✅ Sessão conectada: ${sessions[0].phone || sessions[0].id}`);
    } else {
      console.log('❌ Nenhuma sessão conectada');
    }

    // Status da campanha
    const campaign = campaignManager.getActiveCampaign();
    if (campaign) {
      console.log(`📊 Campanha ativa: "${campaign.name}"`);
      console.log(`   Números: ${campaign.numbers.length} | Mensagens: ${campaign.messages.length}`);
      console.log(`   Status: ${this.getStatusEmoji(campaign.status)} ${campaign.status.toUpperCase()}`);
    }

    console.log('\n' + '─'.repeat(50));
    console.log('\n🔧 CONFIGURAÇÃO');
    console.log('1. Conectar WhatsApp');
    console.log('2. Nova Campanha');
    console.log('3. Carregar Campanha Salva');
    
    console.log('\n📝 GERENCIAR CAMPANHA');
    console.log('4. Adicionar UM Número');
    console.log('5. Adicionar Base de Números (arquivo)');
    console.log('6. Remover Número');
    console.log('7. Definir Mensagens');
    console.log('8. Ver Lista de Números');
    
    console.log('\n▶️ DISPARO');
    console.log('9. Iniciar Disparo');
    console.log('10. Pausar Disparo');
    console.log('11. Retomar Disparo');
    console.log('12. Parar Disparo');
    
    console.log('\n📊 INFORMAÇÕES');
    console.log('13. Ver Status da Campanha');
    console.log('14. Listar Campanhas');
    
    console.log('\n0. Sair\n');
  }

  getStatusEmoji(status) {
    const emojis = {
      'idle': '⚪',
      'running': '🟢',
      'paused': '🟡',
      'stopped': '🔴',
      'completed': '✅'
    };
    return emojis[status] || '⚪';
  }

  async connectWhatsApp() {
    try {
      console.clear();
      console.log('📱 CONECTAR WHATSAPP\n');
      
      const sessionId = await question('Digite um ID para a sessão (ex: principal): ');
      
      if (!sessionId.trim()) {
        logger.error('ID inválido');
        return;
      }

      logger.info(`\n🔄 Conectando sessão ${sessionId}...`);
      logger.info('📱 Escaneie o QR Code com seu WhatsApp:\n');

      await sessionManager.createSession(sessionId);
      this.sessionConnected = true;
      
      logger.info(`\n✅ WhatsApp conectado com sucesso!`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async newCampaign() {
    try {
      console.clear();
      console.log('📋 NOVA CAMPANHA\n');
      
      const name = await question('Digite o nome da campanha: ');
      
      if (!name.trim()) {
        logger.error('Nome inválido');
        return;
      }

      const campaign = campaignManager.createCampaign(name.trim());
      this.currentCampaign = name.trim();
      
      logger.info(`✅ Campanha "${name}" criada com sucesso!`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async loadCampaign() {
    try {
      console.clear();
      console.log('📂 CARREGAR CAMPANHA\n');
      
      const name = await question('Digite o nome da campanha para carregar: ');
      
      if (!name.trim()) {
        logger.error('Nome inválido');
        return;
      }

      await campaignManager.loadCampaign(name.trim());
      this.currentCampaign = name.trim();
      
      const campaign = campaignManager.getCampaign(name.trim());
      logger.info(`✅ Campanha carregada!`);
      logger.info(`   Números: ${campaign.numbers.length}`);
      logger.info(`   Mensagens: ${campaign.messages.length}`);
      logger.info(`   Status: ${campaign.status}`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async addSingleNumber() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      console.clear();
      console.log('📱 ADICIONAR UM NÚMERO\n');
      
      const phone = await question('Digite o número (ex: 5511999887766): ');
      
      if (!phone.trim()) {
        logger.error('Número inválido');
        return;
      }

      campaignManager.addNumber(this.currentCampaign, phone.trim());
      
      const campaign = campaignManager.getCampaign(this.currentCampaign);
      logger.info(`✅ Número adicionado! Total: ${campaign.numbers.length}`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async addNumbersFromFile() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      console.clear();
      console.log('📂 ADICIONAR BASE DE NÚMEROS\n');
      
      const filePath = await question('Digite o caminho do arquivo (ex: numeros.txt): ');
      
      if (!filePath.trim()) {
        logger.error('Caminho inválido');
        return;
      }

      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      
      logger.info('📂 Carregando números do arquivo...');
      const phoneNumbers = await loadPhoneNumbersFromFile(fullPath);
      
      if (phoneNumbers.length === 0) {
        logger.error('Nenhum número encontrado no arquivo');
        return;
      }

      campaignManager.addNumbers(this.currentCampaign, phoneNumbers);
      
      const campaign = campaignManager.getCampaign(this.currentCampaign);
      logger.info(`✅ Base importada! Total: ${campaign.numbers.length} números`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async removeNumber() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      console.clear();
      console.log('🗑️ REMOVER NÚMERO\n');
      
      const campaign = campaignManager.getCampaign(this.currentCampaign);
      
      if (campaign.numbers.length === 0) {
        logger.error('Nenhum número na campanha');
        return;
      }

      console.log('Números na campanha:');
      campaign.numbers.forEach((num, index) => {
        console.log(`${index + 1}. ${num}`);
      });

      const choice = await question('\nDigite o número para remover (ou índice): ');
      
      if (!choice.trim()) {
        return;
      }

      let phoneToRemove;
      
      // Verifica se é um índice ou número completo
      if (/^\d+$/.test(choice) && parseInt(choice) <= campaign.numbers.length) {
        const index = parseInt(choice) - 1;
        phoneToRemove = campaign.numbers[index];
      } else {
        phoneToRemove = choice.trim();
      }

      campaignManager.removeNumber(this.currentCampaign, phoneToRemove);
      
      const updatedCampaign = campaignManager.getCampaign(this.currentCampaign);
      logger.info(`✅ Número removido! Total: ${updatedCampaign.numbers.length}`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async setMessages() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      console.clear();
      console.log('📝 DEFINIR MENSAGENS\n');
      console.log('Escolha uma opção:');
      console.log('1. Digitar mensagens manualmente');
      console.log('2. Carregar de arquivo\n');
      
      const option = await question('Opção: ');

      if (option === '1') {
        console.log('\nDigite as mensagens (uma por linha, linha vazia para finalizar):');
        console.log('Dica: Use variáveis como {nome}, {numero}, {total}\n');
        
        const messages = [];
        while (true) {
          const msg = await question('> ');
          if (!msg.trim()) break;
          messages.push(msg.trim());
        }

        if (messages.length === 0) {
          logger.error('Nenhuma mensagem fornecida');
          return;
        }

        campaignManager.setMessages(this.currentCampaign, messages);
        logger.info(`✅ ${messages.length} mensagens definidas!`);

      } else if (option === '2') {
        const filePath = await question('\nDigite o caminho do arquivo: ');
        
        if (!filePath.trim()) {
          logger.error('Caminho inválido');
          return;
        }

        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        
        logger.info('📂 Carregando mensagens...');
        const messages = await loadMessagesFromFile(fullPath);
        
        if (messages.length === 0) {
          logger.error('Nenhuma mensagem encontrada no arquivo');
          return;
        }

        campaignManager.setMessages(this.currentCampaign, messages);
        logger.info(`✅ ${messages.length} mensagens carregadas!`);
      }
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async viewNumbers() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      console.clear();
      console.log('📋 LISTA DE NÚMEROS\n');
      
      const campaign = campaignManager.getCampaign(this.currentCampaign);
      
      if (campaign.numbers.length === 0) {
        console.log('Nenhum número adicionado ainda.');
      } else {
        console.log(`Total: ${campaign.numbers.length} números\n`);
        campaign.numbers.forEach((num, index) => {
          const status = index < campaign.currentIndex ? '✅' : '⏳';
          console.log(`${status} ${index + 1}. ${num}`);
        });
      }
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async startDispatch() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      const sessions = sessionManager.getAllSessions();
      if (sessions.length === 0) {
        logger.error('❌ Conecte um WhatsApp primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      const campaign = campaignManager.getCampaign(this.currentCampaign);
      
      console.clear();
      console.log('🚀 INICIAR DISPARO\n');
      console.log(`Campanha: ${campaign.name}`);
      console.log(`Números: ${campaign.numbers.length}`);
      console.log(`Mensagens: ${campaign.messages.length}`);
      console.log(`Status atual: ${campaign.status}\n`);

      if (campaign.numbers.length === 0) {
        logger.error('❌ Adicione números antes de iniciar');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      if (campaign.messages.length === 0) {
        logger.error('❌ Adicione mensagens antes de iniciar');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      const confirm = await question('Confirmar início do disparo? (s/n): ');
      
      if (confirm.toLowerCase() !== 's') {
        logger.info('Disparo cancelado');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      // Salva antes de iniciar
      await campaignManager.saveCampaign(this.currentCampaign);

      console.log('\n');
      
      // Executa em background (não bloqueia)
      this.dispatcherRunning = true;
      dispatcher.runCampaign(this.currentCampaign)
        .then(() => {
          this.dispatcherRunning = false;
        })
        .catch(error => {
          logger.error(`Erro no disparo: ${error.message}`);
          this.dispatcherRunning = false;
        });

      logger.info('✅ Disparo iniciado! Use o menu para pausar/parar.');
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async pauseDispatch() {
    try {
      dispatcher.pause();
      await campaignManager.saveCampaign(this.currentCampaign);
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async resumeDispatch() {
    try {
      dispatcher.resume();
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async stopDispatch() {
    try {
      dispatcher.stop();
      await campaignManager.saveCampaign(this.currentCampaign);
      logger.info('⏹️ Disparo será parado após o envio atual');
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async viewCampaignStatus() {
    try {
      if (!this.currentCampaign) {
        logger.error('❌ Crie ou carregue uma campanha primeiro');
        await question('\nPressione ENTER para continuar...');
        return;
      }

      console.clear();
      console.log('📊 STATUS DA CAMPANHA\n');
      
      const campaign = campaignManager.getCampaign(this.currentCampaign);
      
      console.log(`Nome: ${campaign.name}`);
      console.log(`Status: ${this.getStatusEmoji(campaign.status)} ${campaign.status.toUpperCase()}`);
      console.log(`Criada em: ${campaign.createdAt.toLocaleString('pt-BR')}`);
      
      if (campaign.startedAt) {
        console.log(`Iniciada em: ${campaign.startedAt.toLocaleString('pt-BR')}`);
      }
      
      if (campaign.completedAt) {
        console.log(`Concluída em: ${campaign.completedAt.toLocaleString('pt-BR')}`);
      }

      console.log(`\n📊 Estatísticas:`);
      console.log(`   Total: ${campaign.stats.total}`);
      console.log(`   ✅ Enviadas: ${campaign.stats.sent}`);
      console.log(`   ❌ Falhas: ${campaign.stats.failed}`);
      console.log(`   ⏳ Pendentes: ${campaign.stats.pending}`);

      if (campaign.stats.total > 0) {
        const progress = ((campaign.stats.sent + campaign.stats.failed) / campaign.stats.total * 100).toFixed(2);
        const successRate = campaign.stats.sent > 0 
          ? ((campaign.stats.sent / (campaign.stats.sent + campaign.stats.failed)) * 100).toFixed(2)
          : 0;
        
        console.log(`\n   Progresso: ${progress}%`);
        console.log(`   Taxa de Sucesso: ${successRate}%`);
      }

      console.log(`\n📝 Configuração:`);
      console.log(`   Números: ${campaign.numbers.length}`);
      console.log(`   Mensagens: ${campaign.messages.length}`);
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async listCampaigns() {
    try {
      console.clear();
      console.log('📋 TODAS AS CAMPANHAS\n');
      
      const campaigns = campaignManager.listCampaigns();
      
      if (campaigns.length === 0) {
        console.log('Nenhuma campanha criada ainda.');
      } else {
        campaigns.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.name}`);
          console.log(`   Status: ${this.getStatusEmoji(campaign.status)} ${campaign.status}`);
          console.log(`   Números: ${campaign.numbers.length} | Enviadas: ${campaign.stats.sent}/${campaign.stats.total}`);
          console.log('');
        });
      }
      
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
    }

    await question('\nPressione ENTER para continuar...');
  }

  async run() {
    await this.initialize();
    
    let running = true;

    while (running) {
      await this.showMainMenu();
      const choice = await question('Escolha uma opção: ');

      switch (choice.trim()) {
        case '1':
          await this.connectWhatsApp();
          break;
        case '2':
          await this.newCampaign();
          break;
        case '3':
          await this.loadCampaign();
          break;
        case '4':
          await this.addSingleNumber();
          break;
        case '5':
          await this.addNumbersFromFile();
          break;
        case '6':
          await this.removeNumber();
          break;
        case '7':
          await this.setMessages();
          break;
        case '8':
          await this.viewNumbers();
          break;
        case '9':
          await this.startDispatch();
          break;
        case '10':
          await this.pauseDispatch();
          break;
        case '11':
          await this.resumeDispatch();
          break;
        case '12':
          await this.stopDispatch();
          break;
        case '13':
          await this.viewCampaignStatus();
          break;
        case '14':
          await this.listCampaigns();
          break;
        case '0':
          console.log('\n👋 Encerrando...');
          if (this.dispatcherRunning) {
            console.log('⚠️ Aguarde o disparo atual finalizar...');
          }
          await sessionManager.removeAllSessions();
          running = false;
          break;
        default:
          logger.error('Opção inválida');
          await question('\nPressione ENTER para continuar...');
      }
    }

    rl.close();
    process.exit(0);
  }
}

// Inicializa a aplicação
const app = new WhatsAppClient();
app.run().catch(error => {
  logger.error('Erro fatal:', error);
  process.exit(1);
});
