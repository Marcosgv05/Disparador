import User from '../models/User.js';
import { logger } from '../config/logger.js';

/**
 * Script para criar usuário admin padrão
 */
async function createAdmin() {
  try {
    const adminEmail = 'admin@whatsapp.com';
    
    // Verifica se admin já existe
    const existing = User.findByEmail(adminEmail);
    if (existing) {
      logger.info('✅ Usuário admin já existe');
      return;
    }

    // Gera senha aleatória segura ou usa variável de ambiente
    const crypto = await import('crypto');
    const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
    
    // Cria admin
    const admin = await User.create({
      email: adminEmail,
      password: adminPassword,
      name: 'Administrador',
      role: 'admin'
    });

    logger.info('✅ Usuário admin criado com sucesso!');
    logger.info('📧 Email: ' + adminEmail);
    logger.info('🔑 Senha: [gerada - veja console]');
    console.log('\n========================================');
    console.log('SENHA DO ADMIN (ANOTE E GUARDE!):');
    console.log(adminPassword);
    console.log('========================================\n');
    logger.info('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  } catch (error) {
    logger.error(`Erro ao criar admin: ${error.message}`);
  }
}

createAdmin();
