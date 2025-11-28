import express from 'express';
import dbManager from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/templates
 * Lista templates do usuário
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const templates = await dbManager.getTemplates(req.user.id);
    res.json({ success: true, templates });
  } catch (error) {
    logger.error(`Erro ao listar templates: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

/**
 * GET /api/templates/:id
 * Busca template por ID
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const template = await dbManager.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    if (template.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para acessar este template' });
    }
    res.json({ success: true, template });
  } catch (error) {
    logger.error(`Erro ao buscar template: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar template' });
  }
});

/**
 * POST /api/templates
 * Cria novo template
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, content, variables, category } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });
    }
    
    // Extrai variáveis do conteúdo automaticamente
    const extractedVars = content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g, '')) || [];
    
    const template = await dbManager.createTemplate({
      user_id: req.user.id,
      name,
      content,
      variables: variables || extractedVars,
      category
    });
    
    logger.info(`📝 Template "${name}" criado por ${req.user.email}`);
    res.json({ success: true, template });
  } catch (error) {
    logger.error(`Erro ao criar template: ${error.message}`);
    res.status(500).json({ error: 'Erro ao criar template' });
  }
});

/**
 * PUT /api/templates/:id
 * Atualiza template
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const template = await dbManager.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    if (template.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para editar este template' });
    }
    
    const updated = await dbManager.updateTemplate(req.params.id, req.body);
    res.json({ success: true, template: updated });
  } catch (error) {
    logger.error(`Erro ao atualizar template: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atualizar template' });
  }
});

/**
 * DELETE /api/templates/:id
 * Remove template
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const template = await dbManager.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    if (template.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para excluir este template' });
    }
    
    await dbManager.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao excluir template: ${error.message}`);
    res.status(500).json({ error: 'Erro ao excluir template' });
  }
});

/**
 * POST /api/templates/:id/use
 * Incrementa uso do template e retorna conteúdo processado
 */
router.post('/:id/use', requireAuth, async (req, res) => {
  try {
    const template = await dbManager.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    if (template.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para usar este template' });
    }
    
    const { variables } = req.body;
    let content = template.content;
    
    // Substitui variáveis
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      });
    }
    
    await dbManager.incrementTemplateUsage(req.params.id);
    res.json({ success: true, content });
  } catch (error) {
    logger.error(`Erro ao usar template: ${error.message}`);
    res.status(500).json({ error: 'Erro ao usar template' });
  }
});

export default router;
