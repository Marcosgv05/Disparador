import express from 'express';
import dbManager from '../db/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/admin/users
 * Lista todos os usuários (apenas admin)
 */
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await dbManager.getAllUsers();
    res.json({ 
      success: true, 
      users: users.map(u => ({
        ...u,
        is_active: Boolean(u.is_active),
        max_instances: u.max_instances || 3,
        subscription_bypass: Boolean(u.subscription_bypass)
      }))
    });
  } catch (error) {
    logger.error(`Erro ao listar usuários: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

/**
 * GET /api/admin/users/:id
 * Busca usuário por ID (apenas admin)
 */
router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbManager.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    delete user.password;
    res.json({ success: true, user });
  } catch (error) {
    logger.error(`Erro ao buscar usuário: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Atualiza usuário (apenas admin)
 */
router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, max_instances, is_active, subscription_bypass } = req.body;
    
    // Validações
    if (max_instances !== undefined && (max_instances < 1 || max_instances > 100)) {
      return res.status(400).json({ error: 'Máximo de instâncias deve ser entre 1 e 100' });
    }
    
    if (role !== undefined && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role deve ser "user" ou "admin"' });
    }
    
    const user = await dbManager.updateUser(id, { name, role, max_instances, is_active, subscription_bypass });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    logger.info(`👤 Usuário ${id} atualizado por admin ${req.user.email}`);
    res.json({ success: true, user });
  } catch (error) {
    logger.error(`Erro ao atualizar usuário: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Remove usuário (apenas admin)
 */
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Não permite deletar a si mesmo
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'Você não pode deletar sua própria conta' });
    }
    
    const deleted = await dbManager.deleteUser(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    logger.info(`🗑️ Usuário ${id} removido por admin ${req.user.email}`);
    res.json({ success: true, message: 'Usuário removido com sucesso' });
  } catch (error) {
    logger.error(`Erro ao remover usuário: ${error.message}`);
    res.status(500).json({ error: 'Erro ao remover usuário' });
  }
});

/**
 * GET /api/admin/stats
 * Estatísticas gerais do sistema (apenas admin)
 */
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = await dbManager.getSystemStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error(`Erro ao buscar estatísticas: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// ==================== LOGS ====================

/**
 * GET /api/admin/logs/activity
 * Lista logs de atividade
 */
router.get('/logs/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId } = req.query;
    const logs = await dbManager.getActivityLogs(parseInt(limit), parseInt(offset), userId ? parseInt(userId) : null);
    res.json({ success: true, logs });
  } catch (error) {
    logger.error(`Erro ao buscar logs: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

/**
 * GET /api/admin/logs/login
 * Lista logs de login
 */
router.get('/logs/login', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const logs = await dbManager.getLoginLogs(parseInt(limit), parseInt(offset));
    res.json({ success: true, logs });
  } catch (error) {
    logger.error(`Erro ao buscar logs de login: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar logs de login' });
  }
});

// ==================== PLANOS ====================

/**
 * GET /api/admin/plans
 * Lista todos os planos
 */
router.get('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plans = await dbManager.getAllPlans();
    res.json({ success: true, plans });
  } catch (error) {
    logger.error(`Erro ao listar planos: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar planos' });
  }
});

/**
 * POST /api/admin/plans
 * Cria novo plano
 */
router.post('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, max_instances, max_messages_day, price } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    
    const plan = await dbManager.createPlan({ name, description, max_instances, max_messages_day, price });
    logger.info(`📋 Plano "${name}" criado por ${req.user.email}`);
    res.json({ success: true, plan });
  } catch (error) {
    logger.error(`Erro ao criar plano: ${error.message}`);
    res.status(500).json({ error: 'Erro ao criar plano' });
  }
});

/**
 * PUT /api/admin/plans/:id
 * Atualiza plano
 */
router.put('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await dbManager.updatePlan(id, req.body);
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
    
    logger.info(`📋 Plano ${id} atualizado por ${req.user.email}`);
    res.json({ success: true, plan });
  } catch (error) {
    logger.error(`Erro ao atualizar plano: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atualizar plano' });
  }
});

/**
 * DELETE /api/admin/plans/:id
 * Remove plano
 */
router.delete('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbManager.deletePlan(id);
    if (!deleted) return res.status(404).json({ error: 'Plano não encontrado' });
    
    logger.info(`🗑️ Plano ${id} removido por ${req.user.email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao remover plano: ${error.message}`);
    res.status(500).json({ error: 'Erro ao remover plano' });
  }
});

/**
 * POST /api/admin/users/:id/plan
 * Atribui plano a usuário
 */
router.post('/users/:id/plan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_id, expires_at } = req.body;
    
    await dbManager.assignPlanToUser(id, plan_id, expires_at);
    logger.info(`📋 Plano ${plan_id} atribuído ao usuário ${id} por ${req.user.email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao atribuir plano: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atribuir plano' });
  }
});

// ==================== AVISOS ====================

/**
 * GET /api/admin/notices
 * Lista todos os avisos
 */
router.get('/notices', requireAuth, requireAdmin, async (req, res) => {
  try {
    const notices = await dbManager.getAllNotices();
    res.json({ success: true, notices });
  } catch (error) {
    logger.error(`Erro ao listar avisos: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar avisos' });
  }
});

/**
 * POST /api/admin/notices
 * Cria novo aviso
 */
router.post('/notices', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, message, type, starts_at, ends_at } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    
    const notice = await dbManager.createNotice({ title, message, type, starts_at, ends_at, created_by: req.user.id });
    logger.info(`📢 Aviso "${title}" criado por ${req.user.email}`);
    res.json({ success: true, notice });
  } catch (error) {
    logger.error(`Erro ao criar aviso: ${error.message}`);
    res.status(500).json({ error: 'Erro ao criar aviso' });
  }
});

/**
 * PUT /api/admin/notices/:id
 * Atualiza aviso
 */
router.put('/notices/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await dbManager.updateNotice(id, req.body);
    if (!notice) return res.status(404).json({ error: 'Aviso não encontrado' });
    
    res.json({ success: true, notice });
  } catch (error) {
    logger.error(`Erro ao atualizar aviso: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atualizar aviso' });
  }
});

/**
 * DELETE /api/admin/notices/:id
 * Remove aviso
 */
router.delete('/notices/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbManager.deleteNotice(id);
    if (!deleted) return res.status(404).json({ error: 'Aviso não encontrado' });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao remover aviso: ${error.message}`);
    res.status(500).json({ error: 'Erro ao remover aviso' });
  }
});

// ==================== CONFIGURAÇÕES ====================

/**
 * GET /api/admin/settings
 * Lista todas as configurações
 */
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await dbManager.getAllSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error(`Erro ao listar configurações: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar configurações' });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Atualiza configuração
 */
router.put('/settings/:key', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await dbManager.updateSetting(key, value);
    logger.info(`⚙️ Configuração "${key}" atualizada por ${req.user.email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao atualizar configuração: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atualizar configuração' });
  }
});

// ==================== BLACKLIST ====================

/**
 * GET /api/admin/blacklist
 * Lista números na blacklist
 */
router.get('/blacklist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const blacklist = await dbManager.getBlacklist(parseInt(limit), parseInt(offset));
    res.json({ success: true, blacklist });
  } catch (error) {
    logger.error(`Erro ao listar blacklist: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar blacklist' });
  }
});

/**
 * POST /api/admin/blacklist
 * Adiciona número à blacklist
 */
router.post('/blacklist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { phone, reason } = req.body;
    if (!phone) return res.status(400).json({ error: 'Número é obrigatório' });
    
    const entry = await dbManager.addToBlacklist(phone, reason, req.user.id);
    if (!entry) return res.status(400).json({ error: 'Número já está na blacklist' });
    
    logger.info(`🚫 Número ${phone} adicionado à blacklist por ${req.user.email}`);
    res.json({ success: true, entry });
  } catch (error) {
    logger.error(`Erro ao adicionar à blacklist: ${error.message}`);
    res.status(500).json({ error: 'Erro ao adicionar à blacklist' });
  }
});

/**
 * DELETE /api/admin/blacklist/:phone
 * Remove número da blacklist
 */
router.delete('/blacklist/:phone', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { phone } = req.params;
    const removed = await dbManager.removeFromBlacklist(phone);
    if (!removed) return res.status(404).json({ error: 'Número não encontrado na blacklist' });
    
    logger.info(`✅ Número ${phone} removido da blacklist por ${req.user.email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao remover da blacklist: ${error.message}`);
    res.status(500).json({ error: 'Erro ao remover da blacklist' });
  }
});

// ==================== INSTÂNCIAS (GLOBAL) ====================

/**
 * GET /api/admin/instances
 * Lista todas as instâncias de todos os usuários
 */
router.get('/instances', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Importa o gerenciador de instâncias
    const { getAllInstances } = await import('../services/instanceManager.js');
    const instances = getAllInstances ? getAllInstances() : [];
    res.json({ success: true, instances });
  } catch (error) {
    logger.error(`Erro ao listar instâncias: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar instâncias' });
  }
});

export default router;
