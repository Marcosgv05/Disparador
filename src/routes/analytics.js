import express from 'express';
import dbManager from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/analytics/summary
 * Resumo geral de analytics do usuário
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const analytics = await dbManager.getAnalyticsSummary(req.user.id, parseInt(days));
    res.json({ success: true, ...analytics });
  } catch (error) {
    logger.error(`Erro ao buscar analytics: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar analytics' });
  }
});

/**
 * GET /api/analytics/daily
 * Estatísticas diárias
 */
router.get('/daily', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = await dbManager.getDailyStats(req.user.id, parseInt(days));
    res.json({ success: true, stats });
  } catch (error) {
    logger.error(`Erro ao buscar estatísticas diárias: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * GET /api/analytics/campaign/:id
 * Métricas de uma campanha específica
 */
router.get('/campaign/:id', requireAuth, async (req, res) => {
  try {
    const campaign = await dbManager.getScheduledCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    const metrics = await dbManager.getCampaignMetrics(req.params.id);
    const total = metrics.reduce((sum, m) => sum + m.count, 0);
    
    res.json({ 
      success: true, 
      campaign: {
        ...campaign,
        contacts: JSON.parse(campaign.contacts || '[]')
      },
      metrics: {
        total,
        byStatus: metrics.reduce((acc, m) => ({ ...acc, [m.status]: m.count }), {}),
        successRate: total > 0 ? ((metrics.find(m => m.status === 'sent')?.count || 0) / total * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    logger.error(`Erro ao buscar métricas da campanha: ${error.message}`);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

/**
 * GET /api/analytics/export
 * Exporta dados em CSV
 */
router.get('/export', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, format = 'csv' } = req.query;
    
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();
    
    const metrics = await dbManager.getMessageMetrics(req.user.id, startDate, endDate);
    const dailyStats = await dbManager.getDailyStats(req.user.id, 30);
    
    if (format === 'csv') {
      // Gera CSV
      let csv = 'Data,Enviadas,Entregues,Lidas,Falhas\n';
      dailyStats.forEach(day => {
        csv += `${day.date},${day.messages_sent},${day.messages_delivered},${day.messages_read},${day.messages_failed}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      res.json({ success: true, metrics, dailyStats });
    }
  } catch (error) {
    logger.error(`Erro ao exportar dados: ${error.message}`);
    res.status(500).json({ error: 'Erro ao exportar dados' });
  }
});

/**
 * POST /api/analytics/record
 * Registra métrica de mensagem (chamado internamente)
 */
router.post('/record', requireAuth, async (req, res) => {
  try {
    const { campaign_id, instance_id, phone, status, error_message } = req.body;
    
    await dbManager.recordMessageMetric({
      user_id: req.user.id,
      campaign_id,
      instance_id,
      phone,
      status,
      error_message
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erro ao registrar métrica: ${error.message}`);
    res.status(500).json({ error: 'Erro ao registrar métrica' });
  }
});

export default router;
