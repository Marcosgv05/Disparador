import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import admin from 'firebase-admin';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Importa serviços
import sessionManager from './whatsapp/sessionManager.js';
import campaignManager from './services/campaignManager.js';
import dispatcher from './services/dispatcher.js';
import scheduler from './services/scheduler.js';
import instanceManager from './services/instanceManager.js';
import campaignScheduler from './services/campaignScheduler.js';
import autoPause from './services/autoPause.js';
import geminiService from './services/geminiService.js';
import { loadPhoneNumbersFromExcel, loadMessagesFromExcel, validatePhoneSpreadsheet, loadContactsFromExcel } from './utils/excelLoader.js';
import { logger } from './config/logger.js';
import { settings } from './config/settings.js';
import QRCode from 'qrcode';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import templatesRoutes from './routes/templates.js';
import schedulerRoutes from './routes/scheduler.js';
import analyticsRoutes from './routes/analytics.js';
import stripeRoutes from './routes/stripe.js';
import { requireAuth, optionalAuth, validateCampaignOwnership } from './middleware/auth.js';
import { sanitizeBody, validateCampaignNameParam, validateIdParam } from './middleware/validation.js';
import { clearAuthState, listAuthSessions } from './whatsapp/authStateDB.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Confia no proxy (necessário para rate-limiter funcionar corretamente no Render)
app.set('trust proxy', 1);

// Headers de segurança com Helmet
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Permite scripts das CDNs usadas (Firebase, Tailwind) e handlers inline do login.html
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://cdn.tailwindcss.com"
        ],
        // Importante: libera onsubmit/onclick inline (script-src-attr)
        scriptSrcAttr: [
          "'self'",
          "'unsafe-inline'"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        // Inclui gstatic para evitar bloqueio de requests auxiliares do Firebase
        connectSrc: [
          "'self'",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.gstatic.com",
          "wss:",
          "ws:"
        ],
        frameSrc: ["'self'", "https://accounts.google.com"],
        workerSrc: ["'self'", "blob:"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
} else {
  // Em desenvolvimento, usa configuração mais permissiva
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

const httpServer = createServer(app);

// Configura origens permitidas para Socket.IO
const getSocketOrigins = () => {
  if (process.env.NODE_ENV !== 'production') return '*';
  
  const origins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
  
  // Adiciona automaticamente URLs do Railway/Render
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  if (process.env.RAILWAY_STATIC_URL) {
    origins.push(process.env.RAILWAY_STATIC_URL);
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    origins.push(process.env.RENDER_EXTERNAL_URL);
  }
  
  return origins.length > 0 ? origins : '*';
};

const io = new Server(httpServer, {
  cors: {
    origin: getSocketOrigins(),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware de autenticação para Socket.IO (usa Firebase Admin)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Autenticação necessária para WebSocket'));
    }

    if (!admin.apps.length && process.env.NODE_ENV === 'production') {
      return next(new Error('Servidor de autenticação não configurado'));
    }

    let decodedToken;
    if (admin.apps.length > 0) {
      decodedToken = await admin.auth().verifyIdToken(token);
    } else {
      // Ambiente de desenvolvimento sem Firebase Admin
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        decodedToken = {
          uid: payload.user_id || payload.sub,
          email: payload.email
        };
      } catch {
        return next(new Error('Token inválido'));
      }
    }

    // Busca o usuário no banco para usar o mesmo ID das rotas HTTP
    let finalUserId = decodedToken.uid;
    try {
      const dbUser = await dbManager.getUserByEmail(decodedToken.email);
      if (dbUser) {
        finalUserId = dbUser.id;
      }
    } catch (e) {
      // Se falhar, usa o UID do Firebase
      logger.warn(`Socket.IO: erro ao buscar usuário no banco: ${e.message}`);
    }

    socket.user = {
      id: finalUserId,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email
    };

    // Cada usuário entra em uma sala própria (usando ID do banco)
    socket.join(`user:${socket.user.id}`);
    logger.info(`Socket.IO: usuário ${decodedToken.email} entrou na sala user:${socket.user.id}`);
    next();
  } catch (error) {
    logger.error(`Erro de autenticação Socket.IO: ${error.message}`);
    next(new Error('Falha na autenticação do WebSocket'));
  }
});

// Deletar campanha
app.delete('/api/campaign/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Valida propriedade
    campaignManager.validateOwnership(name, req.user.id);
    
    await campaignManager.deleteCampaign(name);
    
    // Registra log de atividade
    try {
      await dbManager.logActivity(req.user.id, req.user.email, 'Deletou campanha', JSON.stringify({ campaignName: name }), req.ip, req.get('User-Agent'));
    } catch (logErr) { logger.warn(`Erro log atividade: ${logErr.message}`); }
    
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
  limits: {
    fileSize: 5 * 1024 * 1024, // Máximo 5MB por arquivo
    files: 1 // Apenas 1 arquivo por vez
  },
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

// Middlewares - Configuração CORS
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Adiciona automaticamente URLs do Railway/Render se disponíveis
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  corsOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}
if (process.env.RAILWAY_STATIC_URL) {
  corsOrigins.push(process.env.RAILWAY_STATIC_URL);
}
if (process.env.RENDER_EXTERNAL_URL) {
  corsOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

logger.info(`🔒 CORS configurado para: ${corsOrigins.join(', ')}`);

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (mobile apps, Postman, servidor próprio, etc)
    if (!origin) return callback(null, true);
    
    // Permite origens configuradas
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Em desenvolvimento, permite qualquer origem
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Em produção, permite origens .railway.app (mesmo domínio)
    if (origin.endsWith('.up.railway.app')) {
      return callback(null, true);
    }
    
    logger.warn(`CORS bloqueado para origin não autorizado: ${origin}`);
    return callback(new Error('Origin não permitido pelo CORS'));
  },
  credentials: true
}));

// Aplica rate limiting em produção
if (process.env.NODE_ENV === 'production') {
  // Limita apenas endpoints sensíveis de autenticação / administração
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/admin', limiter);
}

// Limite de tamanho para body JSON (proteção contra payloads grandes)
// Exclui a rota do webhook do Stripe do body parser JSON
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitização de body (remove caracteres de controle maliciosos)
app.use(sanitizeBody);

app.use(cookieParser());

// Configuração de sessão com suporte a PostgreSQL em produção
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  logger.error('SESSION_SECRET não configurado em produção. Defina uma chave forte nas variáveis de ambiente.');
  throw new Error('SESSION_SECRET obrigatório em produção');
}

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'whatsapp-dispatcher-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

// Em produção com PostgreSQL, usa store persistente
if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  sessionConfig.store = new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  });
  logger.info('📦 Usando PostgreSQL para sessões HTTP');
}

app.use(session(sessionConfig));

// Log de requisições (apenas em desenvolvimento)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.info(`${req.method} ${req.path}`);
  }
  next();
});

// Health check para Railway/Render/monitoramento
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'postgresql' : 'sqlite'
  });
});

// Endpoints de emergência foram removidos do servidor principal por segurança.
// Use os scripts CLI em src/scripts (createAdmin/resetAdminPassword) para operações administrativas.

// Rotas de autenticação (públicas)
app.use('/api/auth', authRoutes);

// Rotas de administração (protegidas)
app.use('/api/admin', adminRoutes);

// Rotas de templates, agendamentos e analytics
app.use('/api/templates', templatesRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/analytics', analyticsRoutes);

// Rotas do Stripe (pagamentos)
app.use('/api/stripe', stripeRoutes);

// Endpoint público de planos (para página de pricing)
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await dbManager.getAllPlans();
    const activePlans = (plans || []).filter(p => p.is_active !== false);
    res.json({ success: true, plans: activePlans });
  } catch (error) {
    logger.error(`Erro ao listar planos públicos: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erro ao listar planos' });
  }
});

// ======= ROTAS AUTO-PAUSE =======

// Obtém configuração e status do auto-pause
app.get('/api/auto-pause/status', requireAuth, (req, res) => {
  try {
    res.json({
      config: autoPause.getConfig(),
      instances: autoPause.getAllStats()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configura auto-pause
app.post('/api/auto-pause/configure', requireAuth, (req, res) => {
  try {
    const { windowSize, errorThreshold, consecutiveErrors, cooldownTime, enabled } = req.body;
    
    const config = {};
    if (windowSize !== undefined) config.windowSize = parseInt(windowSize);
    if (errorThreshold !== undefined) config.errorThreshold = parseFloat(errorThreshold);
    if (consecutiveErrors !== undefined) config.consecutiveErrors = parseInt(consecutiveErrors);
    if (cooldownTime !== undefined) config.cooldownTime = parseInt(cooldownTime) * 1000; // Converte para ms
    if (enabled !== undefined) config.enabled = enabled;
    
    autoPause.configure(config);
    
    res.json({
      success: true,
      config: autoPause.getConfig()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Habilita/desabilita auto-pause
app.post('/api/auto-pause/toggle', requireAuth, (req, res) => {
  try {
    const { enabled } = req.body;
    autoPause.setEnabled(enabled);
    
    res.json({
      success: true,
      enabled: autoPause.getConfig().enabled
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retoma manualmente uma instância pausada
app.post('/api/auto-pause/resume/:instanceId', requireAuth, (req, res) => {
  try {
    const { instanceId } = req.params;
    autoPause.resumeInstance(instanceId, false);
    
    res.json({
      success: true,
      stats: autoPause.getInstanceStats(instanceId)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reseta estatísticas de uma instância
app.post('/api/auto-pause/reset/:instanceId', requireAuth, (req, res) => {
  try {
    const { instanceId } = req.params;
    autoPause.resetInstance(instanceId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtém estatísticas de uma instância específica
app.get('/api/auto-pause/instance/:instanceId', requireAuth, (req, res) => {
  try {
    const { instanceId } = req.params;
    const stats = autoPause.getInstanceStats(instanceId);
    
    if (!stats) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.join(__dirname, '../public')));

// Inicializa banco de dados
import dbManager from './db/database.js';
await dbManager.initialize();
logger.info('✅ Banco de dados inicializado');

// Inicializa gerenciadores
await campaignManager.initialize();
await instanceManager.initialize();
await scheduler.start();

// Inicializa serviço de IA (Gemini)
geminiService.initialize();

// Inicia scheduler de campanhas agendadas (após banco inicializado)
campaignScheduler.start(60000); // Verifica a cada 1 minuto

// Configura notificações do AutoPause via Socket.IO
autoPause.onPauseEvent((event) => {
  if (event.instanceId && event.userId) {
    io.to(`user:${event.userId}`).emit('autoPauseEvent', event);
  }
  
  if (event.type === 'pause') {
    logger.warn(`🚨 Socket.IO: Instância ${event.instanceId} pausada - ${event.reason}`);
  } else if (event.type === 'resume') {
    logger.info(`✅ Socket.IO: Instância ${event.instanceId} retomada`);
  }
});

// Restaura sessões persistidas após reinício do servidor
const persistedInstances = instanceManager.listInstances();
const instancesToRestore = persistedInstances.filter(inst => inst.sessionId && inst.status === 'connected');

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
            if (currentInst.userId) {
              io.to(`user:${currentInst.userId}`).emit('session-connected', { sessionId: currentInst.sessionId, phone });
            }
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
  const { campaignName, userId } = details;
  
  if (!campaignName) return;
  
  // Atualiza status no campaignManager
  const contact = campaignManager.updateContactStatus(campaignName, phone, status, details);
  
  if (contact) {
    // Emite atualização via WebSocket apenas para o dono da campanha
    if (contact.userId || userId) {
      const ownerId = contact.userId || userId;
      io.to(`user:${ownerId}`).emit('contact-status-updated', {
        campaignName,
        phone,
        status,
        details,
        sentAt: contact.sentAt,
        receivedAt: contact.receivedAt,
        readAt: contact.readAt,
        repliedAt: contact.repliedAt
      });
    }
    
    logger.info(`📊 Status atualizado: ${phone} -> ${status}`);
  }
});

// Registra callbacks para mudanças de conexão
sessionManager.onConnectionUpdate(async (sessionId, event, data) => {
  const instance = instanceManager.getInstanceBySession(sessionId);
  const ownerId = instance?.userId;

  if (event === 'qr') {
    // Converte QR Code para base64 e emite
    const qrCodeData = await QRCode.toDataURL(data.qr);
    if (ownerId) {
      io.to(`user:${ownerId}`).emit('qr-code', { sessionId, qrCode: qrCodeData });
    }
    logger.info(`📱 QR Code emitido via WebSocket para ${sessionId}`);
  } else if (event === 'open') {
    // Conexão estabelecida
    logger.info(`🔔 Emitindo evento 'session-connected' via WebSocket para ${sessionId}`);
    logger.info(`📡 Dados: sessionId=${sessionId}, phone=${data.phone}`);
    if (ownerId) {
      io.to(`user:${ownerId}`).emit('session-connected', { sessionId, phone: data.phone });
    }
    logger.info(`✅ Sessão ${sessionId} conectada: ${data.phone}`);
    
    // Atualiza instância se estiver em restauração
    try {
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
    if (!data.shouldReconnect && ownerId) {
      io.to(`user:${ownerId}`).emit('session-error', { sessionId, error: 'Sessão desconectada. Faça login novamente.' });
      logger.info(`❌ Sessão ${sessionId} desconectada`);
    }
  } else if (event === 'restore-error') {
    if (ownerId) {
      io.to(`user:${ownerId}`).emit('session-error', { sessionId, error: data.error || 'Falha ao restaurar sessão persistida.' });
    }
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

// Emite atualizações de progresso (escopo por usuário)
function emitProgress(data) {
  if (data?.userId) {
    io.to(`user:${data.userId}`).emit('progress', data);
  }
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
    // Emite erro apenas para o usuário que tentou criar a sessão
    if (req.user?.id) {
      io.to(`user:${req.user.id}`).emit('session-error', { sessionId: req.body.sessionId, error: error.message });
    }
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
    
    // Registra log de atividade
    try {
      await dbManager.logActivity(
        req.user.id,
        req.user.email,
        'Criou campanha',
        JSON.stringify({ campaignName: name }),
        req.ip,
        req.get('User-Agent')
      );
    } catch (logErr) {
      logger.warn(`Erro ao registrar log de atividade: ${logErr.message}`);
    }
    
    res.json({ success: true, campaign });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover todas as mensagens de uma campanha
app.delete('/api/campaign/:name/messages', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
  try {
    const { name } = req.params;

    const campaign = campaignManager.getCampaign(name);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    campaign.messages = [];
    // Opcional: limpa metadados de geração por IA, se existirem
    if (campaign.aiGenerated) {
      campaign.aiGenerated = {
        ...campaign.aiGenerated,
        variationCount: 0
      };
    }

    await campaignManager.saveCampaign(name);

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

// Adicionar contato manual (nome + telefone)
app.post('/api/campaign/:name/add-contact', requireAuth, validateCampaignOwnership(campaignManager), (req, res) => {
  try {
    const { name } = req.params;
    const { contactName, phone } = req.body || {};

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
      return res.status(400).json({ error: 'Telefone inválido' });
    }

    const contact = campaignManager.addContact(name, {
      name: contactName || cleaned,
      phone: cleaned
    });
    const campaign = campaignManager.getCampaign(name);

    // Emite atualização via WebSocket apenas para o dono da campanha
    if (req.user?.id && campaign) {
      io.to(`user:${req.user.id}`).emit('contacts-updated', {
        campaignName: name,
        contacts: campaign.contacts
      });
    }

    res.json({ success: true, contact, campaign });
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
    
    // Emite atualização via WebSocket apenas para o dono da campanha
    if (req.user?.id) {
      io.to(`user:${req.user.id}`).emit('contacts-updated', { campaignName: name, contacts: campaign.contacts });
    }
    
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

// ====== ROTAS DE IA (Gemini) ======

// Verificar disponibilidade do serviço de IA
app.get('/api/ai/status', requireAuth, async (req, res) => {
  try {
    const status = await geminiService.healthCheck();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gerar variações de mensagem com IA
app.post('/api/ai/generate-variations', requireAuth, async (req, res) => {
  try {
    const { baseMessage, count = 10, tone = 'original', preserveVariables = true } = req.body;
    
    if (!baseMessage || typeof baseMessage !== 'string' || baseMessage.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem base é obrigatória' });
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({ 
        error: 'Serviço de IA não disponível. Configure GEMINI_API_KEY no ambiente.',
        available: false
      });
    }

    // Limita o número de variações entre 1 e 15
    const variationCount = Math.min(Math.max(parseInt(count) || 10, 1), 15);

    const variations = await geminiService.generateVariations(
      baseMessage.trim(),
      variationCount,
      { tone, preserveVariables }
    );

    res.json({ 
      success: true, 
      variations,
      count: variations.length,
      baseMessage: baseMessage.trim()
    });

  } catch (error) {
    logger.error(`Erro ao gerar variações: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Gerar variações e adicionar diretamente à campanha
app.post('/api/campaign/:name/ai-messages', requireAuth, validateCampaignOwnership(campaignManager), async (req, res) => {
  try {
    const { name } = req.params;
    const { baseMessage, count = 10, tone = 'original', preserveVariables = true, replaceExisting = false } = req.body;
    
    if (!baseMessage || typeof baseMessage !== 'string' || baseMessage.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem base é obrigatória' });
    }

    const campaign = campaignManager.getCampaign(name);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({ 
        error: 'Serviço de IA não disponível. Configure GEMINI_API_KEY no ambiente.',
        available: false
      });
    }

    const variationCount = Math.min(Math.max(parseInt(count) || 10, 1), 15);

    const variations = await geminiService.generateVariations(
      baseMessage.trim(),
      variationCount,
      { tone, preserveVariables }
    );

    // Se replaceExisting, limpa as mensagens existentes
    if (replaceExisting) {
      campaign.messages = [];
    }

    // Adiciona as variações geradas
    for (const variation of variations) {
      campaign.messages.push(variation);
    }

    // Salva informações sobre a geração de IA
    campaign.aiGenerated = {
      enabled: true,
      baseMessage: baseMessage.trim(),
      generatedAt: new Date(),
      variationCount: variations.length,
      tone
    };

    await campaignManager.saveCampaign(name);

    res.json({ 
      success: true, 
      campaign,
      aiGenerated: {
        count: variations.length,
        baseMessage: baseMessage.trim()
      }
    });

  } catch (error) {
    logger.error(`Erro ao gerar mensagens com IA: ${error.message}`);
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

// Vincular instâncias à campanha
app.post('/api/campaign/:name/linked-instances', requireAuth, async (req, res) => {
  try {
    const campaignName = decodeURIComponent(req.params.name);
    const { instanceIds } = req.body;
    
    // Valida propriedade da campanha
    try {
      campaignManager.validateOwnership(campaignName, req.user.id);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }
    
    if (!Array.isArray(instanceIds)) {
      return res.status(400).json({ error: 'instanceIds deve ser um array' });
    }
    
    // Valida que as instâncias pertencem ao usuário
    const userInstances = instanceManager.listInstances(req.user.id);
    const userInstanceIds = userInstances.map(i => i.id);
    const validIds = instanceIds.filter(id => userInstanceIds.includes(id));
    
    const campaign = campaignManager.setLinkedInstances(campaignName, validIds);
    
    res.json({ 
      success: true, 
      linkedInstances: campaign.linkedInstances,
      campaign 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter instâncias vinculadas à campanha
app.get('/api/campaign/:name/linked-instances', requireAuth, async (req, res) => {
  try {
    const campaignName = decodeURIComponent(req.params.name);
    
    // Valida propriedade da campanha
    try {
      campaignManager.validateOwnership(campaignName, req.user.id);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }
    
    const linkedInstances = campaignManager.getLinkedInstances(campaignName);
    
    // Retorna também os dados completos das instâncias vinculadas
    const userInstances = instanceManager.listInstances(req.user.id);
    const linkedInstancesData = userInstances.filter(i => linkedInstances.includes(i.id));
    
    res.json({ 
      linkedInstances,
      instances: linkedInstancesData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Carregar campanha (PROTEGIDO - requer autenticação)
app.post('/api/campaign/load', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
    }

    // Valida propriedade da campanha
    campaignManager.validateOwnership(name, req.user.id);
    
    const campaign = await campaignManager.loadCampaign(name);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// NOTA: Rota DELETE /api/campaign/:name já está definida e protegida no início do arquivo (linha ~97)

// ====== ROTAS DE DISPARO (Protegidas) ======

// Iniciar disparo
app.post('/api/dispatch/start/:campaignName', requireAuth, async (req, res) => {
  try {
    const { campaignName } = req.params;
    const { messageDelay, numberDelay, pauseAfterMessages, pauseDuration, enableTyping } = req.body || {};
    
    // Valida propriedade
    campaignManager.validateOwnership(campaignName, req.user.id);
    
    // Prepara opções de delay e controle
    const options = {};
    if (messageDelay && messageDelay > 0) {
      options.messageDelay = messageDelay;
    }
    if (numberDelay && numberDelay > 0) {
      options.numberDelay = numberDelay;
    }
    if (typeof pauseAfterMessages === 'number' && pauseAfterMessages > 0) {
      options.pauseAfterMessages = pauseAfterMessages;
    }
    if (typeof pauseDuration === 'number' && pauseDuration > 0) {
      options.pauseDuration = pauseDuration;
    }
    if (typeof enableTyping === 'boolean') {
      options.enableTyping = enableTyping;
    }

    // Callback de progresso para alimentar o WebSocket "progress" por usuário
    options.onProgress = ({ campaign }) => {
      if (campaign && campaign.userId) {
        emitProgress({ userId: campaign.userId, campaign });
      }
    };
    
    logger.info(`Iniciando disparo com opções: messageDelay=${options.messageDelay || 'padrão'}ms, numberDelay=${options.numberDelay || 'padrão'}ms, pauseAfterMessages=${options.pauseAfterMessages || 'nenhum'}, pauseDuration=${options.pauseDuration || 'nenhum'}, enableTyping=${options.enableTyping ? 'on' : 'off'}`);
    
    // Registra log de atividade
    try {
      await dbManager.logActivity(req.user.id, req.user.email, 'Iniciou disparo', JSON.stringify({ campaignName }), req.ip, req.get('User-Agent'));
    } catch (logErr) { logger.warn(`Erro log atividade: ${logErr.message}`); }
    
    // Guarda userId para emitir eventos apenas para o dono
    const userId = req.user.id;
    
    // Inicia disparo em background
    dispatcher.runCampaign(campaignName, options)
      .then(() => {
        // Emite apenas para o usuário dono da campanha
        io.to(`user:${userId}`).emit('dispatch-complete', { campaignName });
      })
      .catch(error => {
        // Emite apenas para o usuário dono da campanha
        io.to(`user:${userId}`).emit('dispatch-error', { campaignName, error: error.message });
      });
 
    res.json({ 
      success: true, 
      message: 'Disparo iniciado',
      delays: {
        messageDelay: options.messageDelay || settings.messageDelay,
        numberDelay: options.numberDelay || settings.numberDelay,
        pauseAfterMessages: options.pauseAfterMessages || null,
        pauseDuration: options.pauseDuration || null,
        enableTyping: !!options.enableTyping
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
    if (status.campaign && status.campaign.userId !== req.user.id && req.user.role !== 'admin') {
      return res.json({ isRunning: false, campaign: null });
    }
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
    
    // Garante que a campanha pertence ao usuário
    try {
      campaignManager.validateOwnership(campaignName, req.user.id);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }
    
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
    
    const scheduleData = scheduler.setSchedule(campaignName, schedule, req.user.id);
    res.json({ success: true, schedule: scheduleData });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter agendamento
app.get('/api/schedule/:campaignName', requireAuth, (req, res) => {
  try {
    const { campaignName } = req.params;

    // Garante que a campanha pertence ao usuário
    try {
      campaignManager.validateOwnership(campaignName, req.user.id);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }

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
    const schedules = scheduler.listSchedules(req.user.id);
    res.json({ schedules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover agendamento
app.delete('/api/schedule/:campaignName', requireAuth, (req, res) => {
  try {
    const { campaignName } = req.params;

    // Garante que a campanha pertence ao usuário
    try {
      campaignManager.validateOwnership(campaignName, req.user.id);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }

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

    // Garante que a campanha pertence ao usuário
    try {
      campaignManager.validateOwnership(campaignName, req.user.id);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }

    scheduler.toggleSchedule(campaignName, enabled);
    res.json({ success: true, message: `Agendamento ${enabled ? 'habilitado' : 'desabilitado'}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    // Em produção, não expõe detalhes do erro
    const errorResponse = {
      error: 'Erro interno do servidor'
    };
    
    // Apenas em desenvolvimento, inclui detalhes do erro
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.message = err.message;
      errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
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
    
    // Emite atualização via WebSocket apenas para o dono da campanha
    const campaign = campaignManager.getCampaign(campaignName);
    if (campaign) {
      const contact = campaign.contacts.find(c => c.phone === phone);
      if (contact && campaign.userId) {
        io.to(`user:${campaign.userId}`).emit('contact-status-updated', {
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
