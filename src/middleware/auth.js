import admin from 'firebase-admin';
import { logger } from '../config/logger.js';
import dbManager from '../db/database.js';

// Inicializar Firebase Admin (se não foi inicializado)
if (!admin.apps.length) {
  // Em produção, use credenciais do Firebase
  // Em desenvolvimento, aceita qualquer token
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  }
}

// Lista de emails de administradores (pode ser configurado via env)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@whatsapp.com,admin@vext.com').split(',').map(e => e.trim().toLowerCase());

/**
 * Middleware para verificar autenticação com Firebase
 */
export async function requireAuth(req, res, next) {
  try {
    // Verifica token no header
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }

    let userEmail, userId, userName;

    // Verifica token do Firebase
    if (admin.apps.length > 0) {
      // Produção: valida com Firebase Admin
      const decodedToken = await admin.auth().verifyIdToken(token);
      userId = decodedToken.uid;
      userEmail = decodedToken.email;
      userName = decodedToken.name || decodedToken.email;
    } else {
      // Desenvolvimento: aceita qualquer token e extrai email do payload
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = payload.user_id || payload.sub;
        userEmail = payload.email;
        userName = payload.name || payload.email;
      } catch (e) {
        logger.warn('Token Firebase inválido em modo desenvolvimento');
        return res.status(401).json({ error: 'Token inválido' });
      }
    }

    // Verifica se é admin pela lista de emails ou pelo banco de dados
    let role = 'user';
    let maxInstances = 3;
    let dbUserId = null;
    
    // Verifica na lista de admins
    if (ADMIN_EMAILS.includes(userEmail?.toLowerCase())) {
      role = 'admin';
    }
    
    // Tenta buscar dados adicionais do banco (se existir)
    try {
      let dbUser = await dbManager.getUserByEmail(userEmail);
      
      // Se usuário não existe no banco local, cria automaticamente
      if (!dbUser && userEmail) {
        logger.info(`👤 Criando usuário no banco local: ${userEmail}`);
        dbUser = await dbManager.createUser(
          userEmail, 
          'firebase-auth', // senha placeholder (não usada com Firebase)
          userName || userEmail.split('@')[0],
          role
        );
      }
      
      if (dbUser) {
        dbUserId = dbUser.id;
        role = dbUser.role || role;
        maxInstances = dbUser.max_instances || 3;
        
        // Se é admin pela lista mas não no banco, atualiza o banco
        if (ADMIN_EMAILS.includes(userEmail?.toLowerCase()) && dbUser.role !== 'admin') {
          await dbManager.updateUser(dbUser.id, { role: 'admin' });
          role = 'admin';
        }
      }
    } catch (e) {
      logger.warn(`Erro ao sincronizar usuário com banco: ${e.message}`);
    }

    req.user = {
      id: dbUserId || userId, // Usa ID do banco se disponível, senão UID do Firebase
      firebaseUid: userId,
      email: userEmail,
      name: userName,
      role,
      maxInstances
    };
    
    next();
  } catch (error) {
    logger.error(`Erro de autenticação Firebase: ${error.message}`);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/**
 * Middleware para verificar se é admin
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
}

/**
 * Gera token JWT (DEPRECADO - agora usa Firebase)
 * Mantido por compatibilidade com código legado
 */
export function generateToken(user) {
  logger.warn('generateToken está deprecado. Use Firebase Authentication.');
  // Retorna objeto fake para não quebrar código antigo
  return 'firebase-auth-token';
}

/**
 * Middleware opcional - não falha se não autenticado
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token && admin.apps.length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        role: 'user'
      };
    }
  } catch (error) {
    // Ignora erro, apenas não popula req.user
  }
  
  next();
}

/**
 * Middleware para validar propriedade de campanha
 */
export function validateCampaignOwnership(campaignManager) {
  return (req, res, next) => {
    try {
      const campaignName = req.params.name;
      
      if (!campaignName || !req.user) {
        return next();
      }

      // Valida propriedade
      campaignManager.validateOwnership(campaignName, req.user.id);
      next();
    } catch (error) {
      return res.status(403).json({ error: error.message });
    }
  };
}
