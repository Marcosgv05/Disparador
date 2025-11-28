import express from 'express';
import User from '../models/User.js';
import { generateToken, requireAuth, requireAdmin } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Endpoints legados de registro/login via JWT – mantidos apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  /**
   * POST /api/auth/register
   * Registro de novo usuário (LEGADO - apenas desenvolvimento)
   */
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
      }

      // Valida formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }

      // Valida senha mínima
      if (password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
      }

      const user = await User.create({ email, password, name });
      const token = generateToken(user);

      res.cookie('token', token, { 
        httpOnly: true, 
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        sameSite: 'strict'
      });

      res.json({ 
        success: true, 
        user,
        token 
      });
    } catch (error) {
      logger.error(`Erro no registro: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/auth/login
   * Login de usuário (LEGADO - apenas desenvolvimento)
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const user = await User.authenticate(email, password);
      const token = generateToken(user);

      res.cookie('token', token, { 
        httpOnly: true, 
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'strict'
      });

      req.session.token = token;
      req.session.user = user;

      res.json({ 
        success: true, 
        user,
        token 
      });
    } catch (error) {
      logger.error(`Erro no login: ${error.message}`);
      res.status(401).json({ error: error.message });
    }
  });
}

/**
 * POST /api/auth/logout
 * Logout do usuário
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  req.session.destroy();
  res.json({ success: true, message: 'Logout realizado' });
});

/**
 * GET /api/auth/me
 * Retorna dados do usuário logado
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/users (Admin apenas)
 * Lista todos os usuários
 */
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = User.findAll();
  res.json({ users });
});

/**
 * PUT /api/auth/users/:id (Admin apenas)
 * Atualiza usuário
 */
router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.update(id, updates);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/auth/users/:id (Admin apenas)
 * Remove usuário
 */
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    User.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
