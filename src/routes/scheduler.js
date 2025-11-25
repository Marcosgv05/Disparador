import express from 'express';
import dbManager from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/scheduler
 * Lista campanhas agendadas do usuário
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const campaigns = await dbManager.getScheduledCampaigns(req.user.id, status);
    res.json({ 
      success: true, 
      campaigns: campaigns.map(c => ({
        ...c,
        contacts: JSON.parse(c.contacts || '[]'),
        instance_ids: c.instance_ids ? JSON.parse(c.instance_ids) : null
      }))
    });
  } catch (error) {
    logger.error(`Erro ao listar agendamentos: ${error.message}`);
    res.status(500).json({ error: 'Erro ao listar agendamentos' });
  }
});

/**
 * GET /api/scheduler/:id
 * Busca campanha agendada por ID
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const campaign = await dbManager.getScheduledCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    res.json({ 
      success: true, 
      campaign: {
        ...campaign,
        contacts: JSON.parse(campaign.contacts || '[]'),
        instance_ids: campaign.instance_ids ? JSON.parse(campaign.instance_ids) : null
      }
    });
  } catch (error) {
    logger.error(`Erro ao buscar agendamento: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar agendamento' });
  }
});

/**
 * POST /api/scheduler
 * Cria nova campanha agendada
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, template_id, message, media_url, media_type, contacts, instance_ids, scheduled_at, repeat_type, repeat_interval, repeat_until } = req.body;
    
    if (!name || !message || !contacts || !scheduled_at) {
      return res.status(400).json({ error: 'Nome, mensagem, contatos e data/hora são obrigatórios' });
    }
    
    // Valida data futura
    const scheduledDate = new Date(scheduled_at);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Data de agendamento deve ser no futuro' });
    }
    
    // Valida contatos
    const contactList = Array.isArray(contacts) ? contacts : contacts.split(/[\n,;]/).map(c => c.trim()).filter(c => c);
    if (contactList.length === 0) {
      return res.status(400).json({ error: 'Informe pelo menos um contato' });
    }
    
    const campaign = await dbManager.createScheduledCampaign({
      user_id: req.user.id,
      name,
      template_id,
      message,
      media_url,
      media_type,
      contacts: contactList,
      instance_ids,
      scheduled_at: scheduledDate.toISOString(),
      repeat_type,
      repeat_interval,
      repeat_until
    });
    
    logger.info(`📅 Campanha "${name}" agendada para ${scheduled_at} por ${req.user.email}`);
    res.json({ success: true, campaign });
  } catch (error) {
    logger.error(`Erro ao criar agendamento: ${error.message}`);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

/**
 * PUT /api/scheduler/:id
 * Atualiza campanha agendada
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const campaign = await dbManager.getScheduledCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    if (campaign.status !== 'pending') {
      return res.status(400).json({ error: 'Não é possível editar campanha já executada' });
    }
    
    const updated = await dbManager.updateScheduledCampaign(req.params.id, req.body);
    res.json({ success: true, campaign: updated });
  } catch (error) {
    logger.error(`Erro ao atualizar agendamento: ${error.message}`);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

/**
 * DELETE /api/scheduler/:id
 * Cancela/remove campanha agendada
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const campaign = await dbManager.getScheduledCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    await dbManager.deleteScheduledCampaign(req.params.id);
    logger.info(`🗑️ Agendamento ${req.params.id} cancelado por ${req.user.email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao cancelar agendamento: ${error.message}`);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

/**
 * POST /api/scheduler/:id/execute
 * Executa campanha manualmente (para testes)
 */
router.post('/:id/execute', requireAuth, async (req, res) => {
  try {
    const campaign = await dbManager.getScheduledCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    // Marca como em execução
    await dbManager.updateScheduledCampaign(req.params.id, { status: 'running' });
    
    // Retorna para o frontend iniciar o disparo
    res.json({ 
      success: true, 
      campaign: {
        ...campaign,
        contacts: JSON.parse(campaign.contacts || '[]'),
        instance_ids: campaign.instance_ids ? JSON.parse(campaign.instance_ids) : null
      }
    });
  } catch (error) {
    logger.error(`Erro ao executar campanha: ${error.message}`);
    res.status(500).json({ error: 'Erro ao executar campanha' });
  }
});

export default router;
