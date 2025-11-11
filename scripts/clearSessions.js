/**
 * INSTRUÇÕES:
 * 1. Cole sua DATABASE_URL na linha 8 abaixo
 * 2. Execute: node scripts/clearSessions.js
 */

// ⬇️ COLE SUA DATABASE_URL AQUI ENTRE AS ASPAS:
const DATABASE_URL = "postgresql://postgres:wDUhzNlJBNqwibJsZhFSiexaIHEEgIvT@postgres-bmoj.railway.internal:5432/railway";

// ========================================
// NÃO MEXA ABAIXO DESTA LINHA
// ========================================

import pg from 'pg';

if (!DATABASE_URL || DATABASE_URL === "") {
  console.error('❌ DATABASE_URL não definida!');
  console.log('\n📝 Edite o arquivo scripts/clearSessions.js');
  console.log('   Cole sua DATABASE_URL na linha 8\n');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function clearSessions() {
  try {
    console.log('🔌 Conectando ao PostgreSQL...');
    console.log(`📍 Host: ${DATABASE_URL.split('@')[1].split('/')[0]}\n`);
    
    // Verificar se tabela existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'whatsapp_auth'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log('ℹ️  Tabela whatsapp_auth não existe ainda.');
      console.log('✅ Nada a limpar! Pode criar nova instância.\n');
      process.exit(0);
    }
    
    // Contar registros antes
    const countBefore = await pool.query('SELECT COUNT(*) FROM whatsapp_auth');
    const total = parseInt(countBefore.rows[0].count);
    
    console.log(`📊 Registros encontrados: ${total}`);
    
    if (total === 0) {
      console.log('✅ Banco já está limpo!\n');
      process.exit(0);
    }
    
    // Listar sessões
    const sessions = await pool.query(`
      SELECT DISTINCT session_id, COUNT(*) as keys 
      FROM whatsapp_auth 
      GROUP BY session_id
      ORDER BY session_id
    `);
    
    console.log('\n📱 Sessões encontradas:');
    sessions.rows.forEach(row => {
      console.log(`   - ${row.session_id}: ${row.keys} chaves`);
    });
    
    // Limpar tudo
    console.log('\n🗑️  Limpando todas as sessões...');
    const result = await pool.query('DELETE FROM whatsapp_auth');
    
    console.log(`✅ ${result.rowCount} registros removidos!`);
    console.log('\n🎉 Banco PostgreSQL limpo com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. No WhatsApp (celular): Desconecte todos os dispositivos');
    console.log('   2. No Nexus: Remova a instância antiga');
    console.log('   3. No Nexus: Adicione nova instância');
    console.log('   4. Gere QR Code e conecte\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao conectar/limpar:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('password authentication failed')) {
      console.log('💡 Dica: Verifique se a DATABASE_URL está correta');
      console.log('   Copie novamente do Railway → Postgres → Variables\n');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearSessions();
