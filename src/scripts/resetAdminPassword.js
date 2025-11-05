import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do banco de dados
const dbPath = path.join(process.cwd(), 'data', 'users.db');

// Verifica se o diretório existe
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

async function resetAdminPassword() {
  try {
    // Nova senha
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualiza a senha do admin
    const result = db.prepare(`
      UPDATE users 
      SET password = ? 
      WHERE email = ?
    `).run(hashedPassword, 'admin@whatsapp.com');

    if (result.changes > 0) {
      console.log('✓ Senha do admin resetada com sucesso!');
      console.log('Email: admin@whatsapp.com');
      console.log('Nova senha: admin123');
    } else {
      console.log('⚠ Usuário admin não encontrado. Criando...');
      
      // Se não existe, cria
      db.prepare(`
        INSERT INTO users (email, password, name, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'admin@whatsapp.com',
        hashedPassword,
        'Administrador',
        'admin',
        new Date().toISOString()
      );
      
      console.log('✓ Usuário admin criado com sucesso!');
      console.log('Email: admin@whatsapp.com');
      console.log('Senha: admin123');
    }
  } catch (error) {
    console.error('Erro ao resetar senha:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

resetAdminPassword();
