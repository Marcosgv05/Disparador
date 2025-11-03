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

    // Cria admin
    const admin = await User.create({
      email: adminEmail,
      password: 'admin123',
      name: 'Administrador',
      role: 'admin'
    });

    logger.info('✅ Usuário admin criado com sucesso!');
    logger.info('📧 Email: admin@whatsapp.com');
    logger.info('🔑 Senha: admin123');
    logger.info('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  } catch (error) {
    logger.error(`Erro ao criar admin: ${error.message}`);
  }
}

createAdmin();
