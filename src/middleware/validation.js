/**
 * Middleware de validação e sanitização de inputs
 * Protege contra injeção e caracteres maliciosos
 */

import { logger } from '../config/logger.js';

/**
 * Sanitiza string removendo caracteres potencialmente perigosos
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  // Remove caracteres de controle e null bytes
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Valida nome de campanha (apenas alfanuméricos, espaços, hífens e underscores)
 */
export function validateCampaignName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome da campanha é obrigatório' };
  }
  
  const sanitized = sanitizeString(name);
  
  // Limite de tamanho
  if (sanitized.length > 100) {
    return { valid: false, error: 'Nome da campanha muito longo (máximo 100 caracteres)' };
  }
  
  // Permite apenas caracteres seguros
  if (!/^[\w\s\-áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+$/u.test(sanitized)) {
    return { valid: false, error: 'Nome da campanha contém caracteres inválidos' };
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Valida número de telefone
 */
export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Número de telefone é obrigatório' };
  }
  
  // Remove tudo que não é dígito
  const cleaned = phone.replace(/\D/g, '');
  
  // Valida tamanho
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, error: 'Número de telefone inválido' };
  }
  
  return { valid: true, value: cleaned };
}

/**
 * Valida ID (apenas números ou UUID)
 */
export function validateId(id) {
  if (!id) {
    return { valid: false, error: 'ID é obrigatório' };
  }
  
  const strId = String(id);
  
  // Aceita números ou UUIDs
  if (/^\d+$/.test(strId) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strId)) {
    return { valid: true, value: strId };
  }
  
  // Aceita IDs alfanuméricos curtos (como session IDs)
  if (/^[\w-]{1,50}$/.test(strId)) {
    return { valid: true, value: strId };
  }
  
  return { valid: false, error: 'ID inválido' };
}

/**
 * Middleware para validar parâmetro :name como nome de campanha
 */
export function validateCampaignNameParam(req, res, next) {
  const { name, campaignName } = req.params;
  const paramName = name || campaignName;
  
  if (paramName) {
    const validation = validateCampaignName(paramName);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    // Substitui pelo valor sanitizado
    if (name) req.params.name = validation.value;
    if (campaignName) req.params.campaignName = validation.value;
  }
  
  next();
}

/**
 * Middleware para validar parâmetros de ID
 */
export function validateIdParam(paramNames = ['id', 'instanceId', 'sessionId']) {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      if (req.params[paramName]) {
        const validation = validateId(req.params[paramName]);
        if (!validation.valid) {
          return res.status(400).json({ error: `${paramName}: ${validation.error}` });
        }
        req.params[paramName] = validation.value;
      }
    }
    next();
  };
}

/**
 * Middleware para sanitizar body da requisição
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

/**
 * Sanitiza recursivamente um objeto
 */
function sanitizeObject(obj, depth = 0) {
  // Previne recursão infinita
  if (depth > 10) return;
  
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map(item => 
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (obj[key] && typeof obj[key] === 'object') {
      sanitizeObject(obj[key], depth + 1);
    }
  }
}

/**
 * Valida email
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email é obrigatório' };
  }
  
  const sanitized = sanitizeString(email).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return { valid: false, error: 'Email inválido' };
  }
  
  if (sanitized.length > 254) {
    return { valid: false, error: 'Email muito longo' };
  }
  
  return { valid: true, value: sanitized };
}

export default {
  sanitizeString,
  validateCampaignName,
  validatePhoneNumber,
  validateId,
  validateEmail,
  validateCampaignNameParam,
  validateIdParam,
  sanitizeBody
};
