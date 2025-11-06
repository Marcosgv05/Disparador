import bcrypt from 'bcrypt';
import dbManager from '../db/database.js';
import { logger } from '../config/logger.js';

class User {
  /**
   * Cria um novo usuário
   */
  static async create({ email, password, name, role = 'user' }) {
    try {
      // Valida dados
      if (!email || !password || !name) {
        throw new Error('Email, senha e nome são obrigatórios');
      }

      // Verifica se email já existe
      const existing = await this.findByEmail(email);
      if (existing) {
        throw new Error('Email já cadastrado');
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insere no banco
      const user = await dbManager.createUser(email, hashedPassword, name, role);

      logger.info(`👤 Novo usuário criado: ${email}`);

      return this.findById(user.id);
    } catch (error) {
      logger.error(`Erro ao criar usuário: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca usuário por ID
   */
  static async findById(id) {
    const user = await dbManager.getUserById(id);
    
    if (user) {
      delete user.password; // Remove senha do retorno
    }
    
    return user;
  }

  /**
   * Busca usuário por email
   */
  static async findByEmail(email) {
    return await dbManager.getUserByEmail(email);
  }

  /**
   * Autentica usuário
   */
  static async authenticate(email, password) {
    try {
      const user = await this.findByEmail(email);
      
      if (!user) {
        throw new Error('Email ou senha incorretos');
      }

      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        throw new Error('Email ou senha incorretos');
      }

      logger.info(`✅ Login bem-sucedido: ${email}`);

      // Remove senha do retorno
      delete user.password;
      return user;
    } catch (error) {
      logger.error(`Erro ao autenticar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Atualiza senha do usuário
   */
  static async updatePassword(email, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const success = await dbManager.updatePassword(email, hashedPassword);
      
      if (success) {
        logger.info(`✏️ Senha atualizada para: ${email}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Erro ao atualizar senha: ${error.message}`);
      throw error;
    }
  }
}

export default User;
