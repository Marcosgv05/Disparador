import admin from 'firebase-admin';
import { logger } from '../config/logger.js';

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

    // Verifica token do Firebase
    if (admin.apps.length > 0) {
      // Produção: valida com Firebase Admin
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        role: 'user'
      };
    } else {
      // Desenvolvimento: aceita qualquer token e extrai email do payload
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        req.user = {
          id: payload.user_id || payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
          role: 'user'
        };
      } catch (e) {
        logger.warn('Token Firebase inválido em modo desenvolvimento');
        return res.status(401).json({ error: 'Token inválido' });
      }
    }
    
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
