import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger.js';

/**
 * Script para migrar dados existentes para o sistema multi-tenant
 * Adiciona userId=1 (admin) a todas as instâncias e campanhas existentes
 */
async function migrateToMultiTenant() {
  try {
    logger.info('🔄 Iniciando migração para multi-tenant...');
    
    // 1. Migrar instâncias
    const instancesFile = path.join(process.cwd(), 'instances.json');
    try {
      const data = await fs.readFile(instancesFile, 'utf-8');
      const instances = JSON.parse(data);
      
      let updated = 0;
      for (const instance of instances) {
        if (!instance.userId) {
          instance.userId = 1; // Admin
          updated++;
        }
      }
      
      if (updated > 0) {
        await fs.writeFile(instancesFile, JSON.stringify(instances, null, 2));
        logger.info(`✅ ${updated} instância(s) migradas`);
      } else {
        logger.info('✅ Instâncias já estão atualizadas');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('📁 Nenhum arquivo de instâncias encontrado');
      } else {
        throw error;
      }
    }
    
    // 2. Migrar campanhas
    const campaignsFolder = path.join(process.cwd(), 'campaigns');
    try {
      const files = await fs.readdir(campaignsFolder);
      let updated = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(campaignsFolder, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const campaign = JSON.parse(data);
        
        if (!campaign.userId) {
          campaign.userId = 1; // Admin
          await fs.writeFile(filePath, JSON.stringify(campaign, null, 2));
          updated++;
        }
      }
      
      if (updated > 0) {
        logger.info(`✅ ${updated} campanha(s) migradas`);
      } else {
        logger.info('✅ Campanhas já estão atualizadas');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('📁 Nenhuma pasta de campanhas encontrada');
      } else {
        throw error;
      }
    }
    
    logger.info('✅ Migração concluída com sucesso!');
    logger.info('⚠️  IMPORTANTE: Todas as instâncias e campanhas foram atribuídas ao usuário admin (ID 1)');
    logger.info('   Faça login como admin@whatsapp.com para gerenciá-las');
    
  } catch (error) {
    logger.error(`Erro na migração: ${error.message}`);
    throw error;
  }
}

migrateToMultiTenant().catch(console.error);
