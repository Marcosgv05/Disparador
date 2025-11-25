import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Importa serviços
import sessionManager from './whatsapp/sessionManager.js';
import campaignManager from './services/campaignManager.js';
import dispatcher from './services/dispatcher.js';
import scheduler from './services/scheduler.js';
import instanceManager from './services/instanceManager.js';
import { loadPhoneNumbersFromExcel, loadMessagesFromExcel, validatePhoneSpreadsheet, loadContactsFromExcel } from './utils/excelLoader.js';
import { logger } from './config/logger.js';
import QRCode from 'qrcode';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import templatesRoutes from './routes/templates.js';
import schedulerRoutes from './routes/scheduler.js';
import analyticsRoutes from './routes/analytics.js';
import { requireAuth, optionalAuth, validateCampaignOwnership } from './middleware/auth.js';
import { clearAuthState, listAuthSessions } from './whatsapp/authStateDB.js';

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

// Deletar campanha
app.delete('/api/campaign/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Valida propriedade
    campaignManager.validateOwnership(name, req.user.id);
    
    await campaignManager.deleteCampaign(name);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: error.message });
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

// Rate Limiting (proteção contra abuso)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requisições por IP
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' // Não limita health check
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 tentativas de login por hora
  message: { error: 'Muitas tentativas de login. Tente novamente em 1 hora.' }
});

// Middlewares
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error('Bloqueado pelo CORS'));
  },
  credentials: true
}));

// Aplica rate limiting em produção
if (process.env.NODE_ENV === 'production') {
  app.use(limiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'whatsapp-dispatcher-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Log de requisições (apenas em desenvolvimento)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.info(`${req.method} ${req.path}`);
  }
  next();
});

// Rota de teste (para debug)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cors: req.headers.origin || 'no-origin'
  });
});

// Endpoint de emergência para criar admin (APENAS DESENVOLVIMENTO/PRIMEIRO DEPLOY)
app.post('/api/emergency/create-admin', async (req, res) => {
  try {
    const { secret } = req.body;
    
    // Proteção básica
    if (secret !== process.env.EMERGENCY_SECRET && secret !== 'nexus-emergency-2025') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Importa User model dinamicamente
    const User = (await import('./models/User.js')).default;
    
    // Verifica se admin já existe
    const existing = await User.findByEmail('admin@whatsapp.com');
    
    if (existing) {
      return res.json({ 
        message: 'Admin já existe', 
        email: 'admin@whatsapp.com',
        tip: 'Use o endpoint /api/emergency/reset-admin para resetar a senha'
      });
    }
    
    // Cria admin
    await User.create({
      email: 'admin@whatsapp.com',
      password: 'admin123',
      name: 'Administrador',
      role: 'admin'
    });
    
    res.json({ 
      success: true, 
      message: 'Admin criado com sucesso!',
      credentials: {
        email: 'admin@whatsapp.com',
        password: 'admin123'
      }
    });
    
  } catch (error) {
    logger.error(`Erro ao criar admin: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de emergência para resetar senha do admin
app.post('/api/emergency/reset-admin', async (req, res) => {
  try {
    const { secret } = req.body;
    
    // Proteção básica
    if (secret !== process.env.EMERGENCY_SECRET && secret !== 'nexus-emergency-2025') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const User = (await import('./models/User.js')).default;
    
    // Reseta senha
    const success = await User.updatePassword('admin@whatsapp.com', 'admin123');
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Senha do admin resetada!',
        credentials: {
          email: 'admin@whatsapp.com',
          password: 'admin123'
        }
      });
    } else {
      res.status(404).json({ error: 'Admin não encontrado' });
    }
    
  } catch (error) {
    logger.error(`Erro ao resetar admin: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Health check para Render/monitoramento
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rotas de autenticação (públicas)
app.use('/api/auth', authRoutes);

// Rotas de administração (protegidas)
app.use('/api/admin', adminRoutes);

// Rotas de templates, agendamentos e analytics
app.use('/api/templates', templatesRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(express.static(path.join(__dirname, '../public')));

// Inicializa banco de dados
import dbManager from './db/database.js';
await dbManager.initialize();
logger.info('✅ Banco de dados inicializado');

// Inicializa gerenciadores
await campaignManager.initialize();
await instanceManager.initialize();
await scheduler.start();

// Inicia scheduler de campanhas agendadas
import campaignScheduler from './services/campaignScheduler.js';
campaignScheduler.start(60000); // Verifica a cada 1 minuto

// Restaura sessões persistidas após reinício do servidor
const persistedInstances = instanceManager.listInstances();
const instancesToRestore = persistedInstances.filter(inst => inst.sessionId);

if (instancesToRestore.length > 0) {
  logger.info(`🔄 Restaurando ${instancesToRestore.length} sessão(ões) persistidas...`);

  for (const inst of instancesToRestore) {
    try {
      if (inst.status === 'connected') {
        instanceManager.updateInstance(inst.id, { status: 'connecting' });
      }
    } catch (error) {
      logger.warn(`Não foi possível atualizar status da instância ${inst.id}: ${error.message}`);
    }
  }

  // Aguarda restauração das sessões
  const restoredSessions = await sessionManager.restoreSessions(instancesToRestore);
  logger.info(`👋 ${restoredSessions.length} sessão(oes) restaurada(s) com sucesso`);
  
  // Verifica novamente o status de cada instância após restauração
  setTimeout(() => {
    logger.info('🔍 Verificando status final das instâncias restauradas...');
    for (const inst of instancesToRestore) {
      try {
        const currentInst = instanceManager.getInstance(inst.id);
        if (currentInst && currentInst.status === 'connecting' && currentInst.sessionId) {
          const session = sessionManager.getSession(currentInst.sessionId);
          if (session && session.user) {
            const phone = session.user?.id?.split(':')[0] || 'Conectado';
            instanceManager.updateInstance(currentInst.id, { 
              status: 'connected',
              phone 
            });
            io.emit('session-connected', { sessionId: currentInst.sessionId, phone });
            logger.info(`✅ Instância ${currentInst.id} atualizada para conectada na verificação final`);
          }
        }
      } catch (error) {
        logger.warn(`Erro ao verificar instância ${inst.id}: ${error.message}`);
      }
    }
  }, 6000); // 6 segundos após restauração
}

// Registra callbacks para status de mensagens
sessionManager.onMessageStatus((phone, status, details) => {
  const { campaignName } = details;
  
  if (!campaignName) return;
  
  // Atualiza status no campaignManager
  const contact = campaignManager.updateContactStatus(campaignName, phone, status, details);
  
  if (contact) {
    // Emite atualização via WebSocket
    io.emit('contact-status-updated', {
      campaignName,
      phone,
      status,
      details,
      sentAt: contact.sentAt,
      receivedAt: contact.receivedAt,
      readAt: contact.readAt,
      repliedAt: contact.repliedAt
    });
    
    logger.info(`📊 Status atualizado: ${phone} -> ${status}`);
  }
});

// Registra callbacks para mudanças de conexão
sessionManager.onConnectionUpdate(async (sessionId, event, data) => {
  if (event === 'qr') {
    // Converte QR Code para base64 e emite
    const qrCodeData = await QRCode.toDataURL(data.qr);
    io.emit('qr-code', { sessionId, qrCode: qrCodeData });
    logger.info(`📱 QR Code emitido via WebSocket para ${sessionId}`);
  } else if (event === 'open') {
    // Conexão estabelecida
    logger.info(`🔔 Emitindo evento 'session-connected' via WebSocket para ${sessionId}`);
    logger.info(`📡 Dados: sessionId=${sessionId}, phone=${data.phone}`);
    io.emit('session-connected', { sessionId, phone: data.phone });
    logger.info(`✅ Sessão ${sessionId} conectada: ${data.phone}`);
    
    // Atualiza instância se estiver em restauração
    try {
      const instance = instanceManager.getInstanceBySession(sessionId);
      if (instance) {
        logger.info(`🔍 Instância encontrada: ${instance.id}, status atual: ${instance.status}`);
        if (instance.status === 'connecting') {
          instanceManager.updateInstance(instance.id, { 
            status: 'connected',
            phone: data.phone 
          });
          logger.info(`📱 Instância ${instance.id} atualizada para conectada após restauração`);
        } else {
          logger.info(`ℹ️ Instância ${instance.id} já está em status: ${instance.status}`);
        }
      } else {
        logger.warn(`⚠️ Nenhuma instância encontrada para sessionId: ${sessionId}`);
      }
    } catch (error) {
      logger.warn(`Erro ao atualizar instância após restauração: ${error.message}`);
    }
  } else if (event === 'close') {
    // Conexão fechada
    if (!data.shouldReconnect) {
      io.emit('session-error', { sessionId, error: 'Sessão desconectada. Faça login novamente.' });
      logger.info(`❌ Sessão ${sessionId} desconectada`);
    }
  } else if (event === 'restore-error') {
    io.emit('session-error', { sessionId, error: data.error || 'Falha ao restaurar sessão persistida.' });
    logger.warn(`Erro ao restaurar sessão ${sessionId}: ${data.error}`);
  }
});

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

// ====== ROTAS DE SESSÃO (Protegidas) ======

// Criar sessão (conectar WhatsApp)
app.post('/api/session/create', requireAuth, async (req, res) => {
  try {
    const { sessionId, forceNew } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório' });
    }

    // Verifica se o sessionId corresponde a uma instância do usuário
    const instance = instanceManager.getInstanceBySession(sessionId);
    if (instance && instance.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta instância' });
    }

    // Responde imediatamente
    res.json({ 
      success: true, 
      message: 'Sessão criada. Aguarde o QR Code.',
      sessionId 
    });

    // Cria sessão de forma assíncrona
    await sessionManager.createSession(sessionId, { 
      waitForConnection: false,
      forceNew: forceNew || false
    });
    
  } catch (error) {
    logger.error(`Erro ao criar sessão: ${error.message}`);
    io.emit('session-error', { sessionId: req.body.sessionId, error: error.message });
  }
});

// Listar sessões do usuário
app.get('/api/session/list', requireAuth, (req, res) => {
  try {
    const allSessions = sessionManager.getAllSessions();
    
    // Filtra sessões pelas instâncias do usuário
    const userInstances = instanceManager.listInstances(req.user.id);
    const userSessionIds = userInstances.map(i => i.sessionId).filter(Boolean);
    
    const userSessions = allSessions.filter(session => 
      userSessionIds.includes(session.id)
    );
    
    res.json({ sessions: userSessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover sessão
app.delete('/api/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Verifica se o sessionId corresponde a uma instância do usuário
    const instance = instanceManager.getInstanceBySession(sessionId);
    if (instance && instance.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta sessão' });
    }
    
    await sessionManager.removeSession(sessionId);
    res.json({ success: true, message: 'Sessão removida' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS ADMINISTRATIVAS ======

// Listar todas as sessões do banco (admin)
app.get('/api/admin/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await listAuthSessions();
    res.json({ sessions });
  } catch (error) {
    logger.error('Erro ao listar sessões:', error);
    res.status(500).json({ error: error.message });
  }
});

// Limpar todas as sessões do banco (admin)
app.post('/api/admin/clear-sessions', requireAuth, async (req, res) => {
  try {
    logger.info(`🗑️ Usuário ${req.user.email} solicitou limpeza de todas as sessões`);
    
    // Listar sessões antes de limpar
    const sessionsBefore = await listAuthSessions();
    let totalKeys = 0;
    sessionsBefore.forEach(s => totalKeys += parseInt(s.keys_count));
    
    // Limpar cada sessão
    const cleared = [];
    for (const session of sessionsBefore) {
      const removed = await clearAuthState(session.session_id);
      cleared.push({
        sessionId: session.session_id,
        keysRemoved: removed
      });
    }
    
    logger.info(`✅ ${sessionsBefore.length} sessões limpas, ${totalKeys} chaves removidas`);
    
    res.json({ 
      success: true, 
      message: `${sessionsBefore.length} sessão(ões) limpa(s) do banco`,
      sessionsCleared: sessionsBefore.length,
      totalKeysRemoved: totalKeys,
      details: cleared
    });
  } catch (error) {
    logger.error('Erro ao limpar sessões:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS DE INSTÂNCIAS (Protegidas) ======

// Listar instâncias do usuário
app.get('/api/instances', requireAuth, (req, res) => {
  try {
    const instances = instanceManager.listInstances(req.user.id);
    res.json({ instances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar instância
app.post('/api/instances', requireAuth, (req, res) => {
  try {
    const instance = instanceManager.addInstance(req.body, req.user.id);
    res.json({ success: true, instance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar instância
app.patch('/api/instances/:instanceId', requireAuth, (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = instanceManager.updateInstance(instanceId, req.body, req.user.id);
    res.json({ success: true, instance });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Remover instância
app.delete('/api/instances/:instanceId', requireAuth, (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = instanceManager.removeInstance(instanceId, req.user.id);
    res.json({ success: true, instance });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// ====== ROTAS DE CAMPANHA (Protegidas) ======

// Criar campanha
app.post('/api/campaign/create', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
    }

    const campaign = await campaignManager.createCampaign(name, req.user.id);
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar campanhas do usuário
app.get('/api/campaign/list', requireAuth, (req, res) => {
  try {
    const campaigns = campaignManager.listCampaigns(req.user.id);
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter campanha específica
app.get('/api/campaign/:name', requireAuth, (req, res) => {
  try {
    const { name } = req.params;
    const campaign = campaignManager.getCampaign(name, req.user.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    
    res.json({ campaign });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Adicionar número individual
app.post('/api/campaign/:name/add-number', requireAuth, validateCampaignOwnership(campaignManager), (req, res) => {
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
app.post('/api/campaign/:name/upload-numbers', requireAuth, validateCampaignOwnership(campaignManager), upload.single('file'), async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const filePath = req.file.path;
    
    // Carrega contatos com nome
    const contacts = await loadContactsFromExcel(filePath);
    
    if (contacts.length === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({ 
        error: 'Nenhum contato encontrado na planilha'
      });
    }

    // Valida números
    const validation = {
      total: contacts.length,
      valid: 0,
      invalid: 0,
      validContacts: [],
      invalidContacts: []
    };

    for (const contact of contacts) {
      const cleaned = contact.phone.replace(/\D/g, '');
      if (cleaned.length >= 10 && cleaned.length <= 15) {
        validation.valid++;
        validation.validContacts.push({
          name: contact.name,
          phone: cleaned
        });
      } else {
        validation.invalid++;
        validation.invalidContacts.push(contact);
      }
    }
    
    if (validation.valid === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({ 
        error: 'Nenhum número válido encontrado',
        validation 
      });
    }

    // Adiciona contatos válidos
    const campaign = campaignManager.addContacts(name, validation.validContacts);
    
    // Remove arquivo temporário
    await fs.unlink(filePath);
    
    // Emite atualização via WebSocket
    io.emit('contacts-updated', { campaignName: name, contacts: campaign.contacts });
    
    res.json({ 
      success: true, 
      campaign,
      validation: {
        total: validation.total,
        valid: validation.valid,
        invalid: validation.invalid,
        contacts: validation.validContacts.slice(0, 50) // Primeiros 50 para preview
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
app.post('/api/campaign/:name/upload-messages', requireAuth, validateCampaignOwnership(campaignManager), upload.single('file'), async (req, res) => {
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

// Adicionar mensagens manualmente (array completo)
app.post('/api/campaign/:name/add-messages', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
  try {
    const { name } = req.params;
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens devem ser um array' });
    }

    const campaign = campaignManager.setMessages(name, messages);
    await campaignManager.saveCampaign(name);
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar uma mensagem individual
app.post('/api/campaign/:name/message', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
  try {
    const { name } = req.params;
    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Mensagem não pode estar vazia' });
    }

    const campaign = campaignManager.getCampaign(name);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    campaign.messages.push(message.trim());
    await campaignManager.saveCampaign(name);
    
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover uma mensagem pelo índice
app.delete('/api/campaign/:name/message/:index', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
  try {
    const { name, index } = req.params;
    const messageIndex = parseInt(index, 10);
    
    if (isNaN(messageIndex)) {
      return res.status(400).json({ error: 'Índice inválido' });
    }

    const campaign = campaignManager.getCampaign(name);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (messageIndex < 0 || messageIndex >= campaign.messages.length) {
      return res.status(400).json({ error: 'Índice fora do intervalo' });
    }

    campaign.messages.splice(messageIndex, 1);
    await campaignManager.saveCampaign(name);
    
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover número/contato
app.delete('/api/campaign/:name/number/:phoneNumber', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
  try {
    const { name, phoneNumber } = req.params;
    const campaign = await campaignManager.removeNumber(name, phoneNumber);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar campanha
app.post('/api/campaign/:name/save', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
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

// ====== ROTAS DE DISPARO (Protegidas) ======

// Iniciar disparo
app.post('/api/dispatch/start/:campaignName', requireAuth, async (req, res) => {
  try {
    const { campaignName } = req.params;
    const { messageDelay, numberDelay } = req.body || {};
    
    // Valida propriedade
    campaignManager.validateOwnership(campaignName, req.user.id);
    
    // Prepara opções de delay
    const options = {};
    if (messageDelay && messageDelay > 0) {
      options.messageDelay = messageDelay;
    }
    if (numberDelay && numberDelay > 0) {
      options.numberDelay = numberDelay;
    }
    
    logger.info(`Iniciando disparo com delays personalizados: messageDelay=${options.messageDelay || 'padrão'}ms, numberDelay=${options.numberDelay || 'padrão'}ms`);
    
    // Inicia disparo em background
    dispatcher.runCampaign(campaignName, options)
      .then(() => {
        io.emit('dispatch-complete', { campaignName });
      })
      .catch(error => {
        io.emit('dispatch-error', { campaignName, error: error.message });
      });

    res.json({ 
      success: true, 
      message: 'Disparo iniciado',
      delays: {
        messageDelay: options.messageDelay || settings.messageDelay,
        numberDelay: options.numberDelay || settings.numberDelay
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pausar disparo
app.post('/api/dispatch/pause', requireAuth, (req, res) => {
  try {
    dispatcher.pause();
    res.json({ success: true, message: 'Disparo pausado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retomar disparo
app.post('/api/dispatch/resume', requireAuth, (req, res) => {
  try {
    dispatcher.resume();
    res.json({ success: true, message: 'Disparo retomado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parar disparo
app.post('/api/dispatch/stop', requireAuth, (req, res) => {
  try {
    dispatcher.stop();
    res.json({ success: true, message: 'Disparo parado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status do disparo
app.get('/api/dispatch/status', requireAuth, (req, res) => {
  try {
    const status = dispatcher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ====== ROTAS DE AGENDAMENTO (Protegidas) ======

// Configurar agendamento
app.post('/api/schedule/:campaignName', requireAuth, (req, res) => {
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
app.get('/api/schedule/:campaignName', requireAuth, (req, res) => {
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

// Listar todos os agendamentos do usuário
app.get('/api/schedule', requireAuth, (req, res) => {
  try {
    const schedules = scheduler.listSchedules();
    res.json({ schedules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover agendamento
app.delete('/api/schedule/:campaignName', requireAuth, (req, res) => {
  try {
    const { campaignName } = req.params;
    scheduler.removeSchedule(campaignName);
    res.json({ success: true, message: 'Agendamento removido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Habilitar/desabilitar agendamento
app.patch('/api/schedule/:campaignName/toggle', requireAuth, (req, res) => {
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

// Registra callback para atualização de status de mensagens
sessionManager.onMessageStatus((phone, status, details) => {
  const { campaignName, messageId, message } = details;
  
  if (!campaignName) return;
  
  try {
    logger.info(`📊 Atualizando status: ${phone} -> ${status} (Campanha: ${campaignName})`);
    
    const statusDetails = { messageId };
    if (message) statusDetails.message = message;
    
    campaignManager.updateContactStatus(campaignName, phone, status, statusDetails);
    
    // Emite atualização via WebSocket
    const campaign = campaignManager.getCampaign(campaignName);
    if (campaign) {
      const contact = campaign.contacts.find(c => c.phone === phone);
      if (contact) {
        io.emit('contact-status-updated', {
          campaignName,
          phone,
          status: contact.status,
          details: contact.statusDetails,
          sentAt: contact.sentAt,
          receivedAt: contact.receivedAt,
          readAt: contact.readAt,
          repliedAt: contact.repliedAt,
          error: contact.error
        });
      }
    }
  } catch (error) {
    logger.error(`Erro ao atualizar status de contato: ${error.message}`);
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
