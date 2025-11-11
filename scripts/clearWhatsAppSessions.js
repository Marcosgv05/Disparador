/**
 * Script para limpar todas as sessões WhatsApp do PostgreSQL
 * 
 * USO:
 * 1. Copie a DATABASE_URL do Railway → Postgres → Variables
 * 2. Execute: DATABASE_URL="postgresql://..." node scripts/clearWhatsAppSessions.js
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida!');
  console.log('\nComo usar:');
  console.log('1. Copie DATABASE_URL do Railway');
  console.log('2. Execute:');
  console.log('   DATABASE_URL="postgresql://..." node scripts/clearWhatsAppSessions.js\n');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function clearSessions() {
  try {
    console.log('🔌 Conectando ao PostgreSQL...');
    
    // Verificar se tabela existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'whatsapp_auth'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log('ℹ️  Tabela whatsapp_auth não existe ainda. Nada a limpar.');
      process.exit(0);
    }
    
    // Contar registros antes
    const countBefore = await pool.query('SELECT COUNT(*) FROM whatsapp_auth');
    console.log(`📊 Registros encontrados: ${countBefore.rows[0].count}`);
    
    if (countBefore.rows[0].count === '0') {
      console.log('✅ Banco já está limpo!');
      process.exit(0);
    }
    
    // Listar sessões
    const sessions = await pool.query(`
      SELECT DISTINCT session_id, COUNT(*) as keys 
      FROM whatsapp_auth 
      GROUP BY session_id
    `);
    
    console.log('\n📱 Sessões encontradas:');
    sessions.rows.forEach(row => {
      console.log(`   - ${row.session_id}: ${row.keys} chaves`);
    });
    
    // Limpar tudo
    console.log('\n🗑️  Limpando todas as sessões...');
    const result = await pool.query('DELETE FROM whatsapp_auth');
    
    console.log(`✅ ${result.rowCount} registros removidos!`);
    console.log('\n🎉 Banco limpo com sucesso!\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearSessions();
