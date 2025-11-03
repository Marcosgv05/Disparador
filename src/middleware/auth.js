import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-dispatcher-secret-key-change-in-production';

/**
 * Middleware para verificar autenticação
 */
export function requireAuth(req, res, next) {
  try {
    // Verifica token no header ou cookie
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.token ||
                  req.session?.token;

    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }

    // Verifica e decodifica token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    logger.error(`Erro de autenticação: ${error.message}`);
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
 * Gera token JWT
 */
export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Middleware opcional - não falha se não autenticado
 */
export function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.token ||
                  req.session?.token;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
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
