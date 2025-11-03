import bcrypt from 'bcrypt';
import db from '../config/database.js';
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
      const existing = this.findByEmail(email);
      if (existing) {
        throw new Error('Email já cadastrado');
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insere no banco
      const stmt = db.prepare(`
        INSERT INTO users (email, password, name, role)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(email, hashedPassword, name, role);

      logger.info(`👤 Novo usuário criado: ${email}`);

      return this.findById(result.lastInsertRowid);
    } catch (error) {
      logger.error(`Erro ao criar usuário: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca usuário por ID
   */
  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    
    if (user) {
      delete user.password; // Remove senha do retorno
    }
    
    return user;
  }

  /**
   * Busca usuário por email
   */
  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  /**
   * Autentica usuário
   */
  static async authenticate(email, password) {
    try {
      const user = this.findByEmail(email);
      
      if (!user) {
        throw new Error('Email ou senha incorretos');
      }

      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        throw new Error('Email ou senha incorretos');
      }

      // Atualiza último login
      const updateStmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
      updateStmt.run(user.id);

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
   * Lista todos os usuários
   */
  static findAll() {
    const stmt = db.prepare('SELECT id, email, name, role, created_at, last_login FROM users');
    return stmt.all();
  }

  /**
   * Atualiza dados do usuário
   */
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.name) {
        updates.push('name = ?');
        values.push(data.name);
      }

      if (data.email) {
        updates.push('email = ?');
        values.push(data.email);
      }

      if (data.password) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        updates.push('password = ?');
        values.push(hashedPassword);
      }

      if (data.role) {
        updates.push('role = ?');
        values.push(data.role);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);

      const stmt = db.prepare(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);

      logger.info(`✏️ Usuário ${id} atualizado`);

      return this.findById(id);
    } catch (error) {
      logger.error(`Erro ao atualizar usuário: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove usuário
   */
  static delete(id) {
    try {
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      stmt.run(id);

      logger.info(`🗑️ Usuário ${id} removido`);

      return true;
    } catch (error) {
      logger.error(`Erro ao remover usuário: ${error.message}`);
      throw error;
    }
  }
}

export default User;
