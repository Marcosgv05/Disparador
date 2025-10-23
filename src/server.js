import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Importa serviços
import sessionManager from './whatsapp/sessionManager.js';
import campaignManager from './services/campaignManager.js';
import dispatcher from './services/dispatcher.js';
import scheduler from './services/scheduler.js';
import instanceManager from './services/instanceManager.js';
import { loadPhoneNumbersFromExcel, loadMessagesFromExcel, validatePhoneSpreadsheet } from './utils/excelLoader.js';
import { logger } from './config/logger.js';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configuração de uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV, XLS ou XLSX são permitidos'));
    }
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Log de requisições (apenas em desenvolvimento)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.info(`${req.method} ${req.path}`);
  }
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

// Inicializa gerenciadores
await campaignManager.initialize();
await instanceManager.initialize();
await scheduler.start();

// WebSocket para atualizações em tempo real
io.on('connection', (socket) => {
  logger.info('Cliente conectado via WebSocket');
  
  socket.on('disconnect', () => {
    logger.info('Cliente desconectado');
  });
});

// Emite atualizações de progresso
function emitProgress(data) {
  io.emit('progress', data);
}

// ====== ROTAS DE SESSÃO ======

// Criar sessão (conectar WhatsApp)
app.post('/api/session/create', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório' });
    }

    // Cria sessão e captura QR Code
    let qrCodeData = null;
    
    const sock = await sessionManager.createSession(sessionId);
    
    // Escuta evento de QR Code
    sock.ev.on('connection.update', async (update) => {
      const { qr } = update;
      if (qr) {
        // Converte QR Code para base64
        qrCodeData = await QRCode.toDataURL(qr);
        io.emit('qr-code', { sessionId, qrCode: qrCodeData });
      }
      
      if (update.connection === 'open') {
        io.emit('session-connected', { sessionId });
      }
    });

    res.json({ 
      success: true, 
      message: 'Sessão criada. Aguarde o QR Code.',
      sessionId 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar sessões
app.get('/api/session/list', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover sessão
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.removeSession(sessionId);
    res.json({ success: true, message: 'Sessão removida' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS DE INSTÂNCIAS ======

// Listar instâncias
app.get('/api/instances', (req, res) => {
  try {
    const instances = instanceManager.listInstances();
    res.json({ instances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar instância
app.post('/api/instances', (req, res) => {
  try {
    const instance = instanceManager.addInstance(req.body);
    res.json({ success: true, instance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar instância
app.patch('/api/instances/:instanceId', (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = instanceManager.updateInstance(instanceId, req.body);
    res.json({ success: true, instance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover instância
app.delete('/api/instances/:instanceId', (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = instanceManager.removeInstance(instanceId);
    res.json({ success: true, instance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS DE CAMPANHA ======

// Criar campanha
app.post('/api/campaign/create', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
    }

    const campaign = campaignManager.createCampaign(name);
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar campanhas
app.get('/api/campaign/list', (req, res) => {
  try {
    const campaigns = campaignManager.listCampaigns();
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter campanha específica
app.get('/api/campaign/:name', (req, res) => {
  try {
    const { name } = req.params;
    const campaign = campaignManager.getCampaign(name);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    
    res.json({ campaign });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar número individual
app.post('/api/campaign/:name/add-number', (req, res) => {
  try {
    const { name } = req.params;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório' });
    }

    const campaign = campaignManager.addNumber(name, phoneNumber);
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload de planilha de números
app.post('/api/campaign/:name/upload-numbers', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const filePath = req.file.path;
    
    // Valida planilha
    const validation = await validatePhoneSpreadsheet(filePath);
    
    if (validation.valid === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({ 
        error: 'Nenhum número válido encontrado na planilha',
        validation 
      });
    }

    // Adiciona números válidos
    const campaign = campaignManager.addNumbers(name, validation.validNumbers);
    
    // Remove arquivo temporário
    await fs.unlink(filePath);
    
    res.json({ 
      success: true, 
      campaign,
      validation: {
        total: validation.total,
        valid: validation.valid,
        invalid: validation.invalid,
        validNumbers: validation.validNumbers.slice(0, 20), // Primeiros 20 para preview
        invalidNumbers: validation.invalidNumbers,
        details: validation.details.slice(0, 20) // Primeiros 20 para preview
      }
    });
    
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: error.message });
  }
});

// Upload de planilha de mensagens
app.post('/api/campaign/:name/upload-messages', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const filePath = req.file.path;
    
    // Carrega mensagens
    const messages = await loadMessagesFromExcel(filePath);
    
    if (messages.length === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Nenhuma mensagem encontrada na planilha' });
    }

    // Define mensagens
    const campaign = campaignManager.setMessages(name, messages);
    
    // Remove arquivo temporário
    await fs.unlink(filePath);
    
    res.json({ 
      success: true, 
      campaign,
      messagesCount: messages.length,
      messages: messages.slice(0, 10) // Primeiras 10 mensagens para preview
    });
    
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: error.message });
  }
});

// Adicionar mensagens manualmente
app.post('/api/campaign/:name/add-messages', (req, res) => {
  try {
    const { name } = req.params;
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens devem ser um array' });
    }

    const campaign = campaignManager.setMessages(name, messages);
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover número
app.delete('/api/campaign/:name/number/:phoneNumber', (req, res) => {
  try {
    const { name, phoneNumber } = req.params;
    const campaign = campaignManager.removeNumber(name, phoneNumber);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar campanha
app.post('/api/campaign/:name/save', async (req, res) => {
  try {
    const { name } = req.params;
    await campaignManager.saveCampaign(name);
    res.json({ success: true, message: 'Campanha salva' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Carregar campanha
app.post('/api/campaign/load', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
    }

    const campaign = await campaignManager.loadCampaign(name);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar campanha
app.delete('/api/campaign/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await campaignManager.deleteCampaign(name);
    res.json({ success: true, message: 'Campanha deletada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS DE DISPARO ======

// Iniciar disparo
app.post('/api/dispatch/start/:campaignName', async (req, res) => {
  try {
    const { campaignName } = req.params;
    
    // Inicia disparo em background
    dispatcher.runCampaign(campaignName)
      .then(() => {
        io.emit('dispatch-complete', { campaignName });
      })
      .catch(error => {
        io.emit('dispatch-error', { campaignName, error: error.message });
      });

    res.json({ success: true, message: 'Disparo iniciado' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pausar disparo
app.post('/api/dispatch/pause', (req, res) => {
  try {
    dispatcher.pause();
    res.json({ success: true, message: 'Disparo pausado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retomar disparo
app.post('/api/dispatch/resume', (req, res) => {
  try {
    dispatcher.resume();
    res.json({ success: true, message: 'Disparo retomado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parar disparo
app.post('/api/dispatch/stop', (req, res) => {
  try {
    dispatcher.stop();
    res.json({ success: true, message: 'Disparo parado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status do disparo
app.get('/api/dispatch/status', (req, res) => {
  try {
    const status = dispatcher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS DE AGENDAMENTO ======

// Configurar agendamento
app.post('/api/schedule/:campaignName', (req, res) => {
  try {
    const { campaignName } = req.params;
    const schedule = req.body;
    
    // Valida horários
    if (!scheduler.constructor.validateTime(schedule.startTime)) {
      return res.status(400).json({ error: 'Horário de início inválido' });
    }
    
    if (schedule.pauseTime && !scheduler.constructor.validateTime(schedule.pauseTime)) {
      return res.status(400).json({ error: 'Horário de pausa inválido' });
    }
    
    if (schedule.stopTime && !scheduler.constructor.validateTime(schedule.stopTime)) {
      return res.status(400).json({ error: 'Horário de parada inválido' });
    }
    
    const scheduleData = scheduler.setSchedule(campaignName, schedule);
    res.json({ success: true, schedule: scheduleData });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter agendamento
app.get('/api/schedule/:campaignName', (req, res) => {
  try {
    const { campaignName } = req.params;
    const schedule = scheduler.getSchedule(campaignName);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    const nextRun = scheduler.getNextRun(campaignName);
    res.json({ schedule, nextRun });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todos os agendamentos
app.get('/api/schedule', (req, res) => {
  try {
    const schedules = scheduler.listSchedules();
    res.json({ schedules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover agendamento
app.delete('/api/schedule/:campaignName', (req, res) => {
  try {
    const { campaignName } = req.params;
    scheduler.removeSchedule(campaignName);
    res.json({ success: true, message: 'Agendamento removido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Habilitar/desabilitar agendamento
app.patch('/api/schedule/:campaignName/toggle', (req, res) => {
  try {
    const { campaignName } = req.params;
    const { enabled } = req.body;
    
    scheduler.toggleSchedule(campaignName, enabled);
    res.json({ success: true, enabled });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== TEMPLATE DE PLANILHA ======

// Download template de números
app.get('/api/template/numbers', (req, res) => {
  const csv = 'phone\n5511999887766\n5511988776655\n5521987654321';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=template-numeros.csv');
  res.send(csv);
});

// Download template de mensagens
app.get('/api/template/messages', (req, res) => {
  const csv = 'message\nOlá! Esta é a mensagem 1\nOi! Esta é a mensagem 2\nE aí! Esta é a mensagem 3';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=template-mensagens.csv');
  res.send(csv);
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ====== TRATAMENTO DE ERROS ======

// 404 - Rota não encontrada
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Rota não encontrada' });
  } else {
    res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  logger.error(`Erro não tratado: ${err.message}`);
  logger.error(err.stack);
  
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: err.message 
    });
  } else {
    res.status(500).send('Erro interno do servidor');
  }
});

// Inicia servidor
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`\n${'='.repeat(50)}`);
  logger.info(`🚀 Servidor Web iniciado!`);
  logger.info(`📱 Acesse: http://localhost:${PORT}`);
  logger.info(`🌐 Compartilhe com clientes: http://SEU-IP:${PORT}`);
  logger.info(`${'='.repeat(50)}\n`);
});

export default app;
