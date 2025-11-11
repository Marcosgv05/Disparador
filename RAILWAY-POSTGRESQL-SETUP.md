# 🐘 PostgreSQL no Railway - Sessões WhatsApp Persistentes

## 🎯 Solução Final para Desconexão

O problema está resolvido! Agora o sistema usa:
- **PostgreSQL** no Railway (persistente)
- **SQLite** localmente (desenvolvimento)

---

## 📋 Configurar PostgreSQL no Railway

### **Passo 1: Adicionar PostgreSQL ao Projeto**

1. **Acesse Railway:**
   - https://railway.app/
   - Clique no seu projeto

2. **Adicione PostgreSQL:**
   - Clique em **"+ New"**
   - Selecione **"Database"**
   - Escolha **"Add PostgreSQL"**

3. **Aguarde Provisionamento:**
   - Railway criará automaticamente o banco (~30 segundos)
   - Você verá um novo card "PostgreSQL" no projeto

### **Passo 2: Conectar ao Serviço Principal**

1. **Clique no serviço principal** (whatsapp-disparador)

2. **Vá em "Variables"**

3. **Adicione a referência ao PostgreSQL:**
   - Clique em **"+ New Variable"**
   - Clique em **"Add Reference"**
   - Selecione o PostgreSQL
   - Escolha **"DATABASE_URL"**
   - Clique em **"Add"**

4. **Resultado:**
   ```
   DATABASE_URL = postgresql://postgres:password@host:5432/railway
   ```
   ✅ Essa variável já existe automaticamente!

### **Passo 3: Verificar Variável FIREBASE_PROJECT_ID**

Certifique-se que também tem:
```
FIREBASE_PROJECT_ID = nexus-9b811
```

Se não tiver, adicione conforme documentado em `FIREBASE-RAILWAY-CONFIG.md`

---

## 🚀 Deploy Automático

Após adicionar o PostgreSQL:
1. ✅ Railway fará **redeploy automático**
2. ✅ Tabela `whatsapp_auth` será criada automaticamente
3. ✅ Sistema detectará `DATABASE_URL` e usará PostgreSQL

---

## ✅ Testar

### **1. Remover Instâncias Antigas**

No Nexus Disparador:
- Remova todas as instâncias antigas
- Isso limpa credenciais corrompidas do SQLite

### **2. Adicionar Nova Instância**

1. Clique em **"Adicionar Instância"**
2. Digite um nome (ex: "Instância 01")
3. Clique em **"Gerar QR Code"**
4. Escaneie com WhatsApp
5. **Aguarde "Conectado"** ✅

### **3. Teste de Persistência**

1. No Railway → **Redeploy**
2. Aguarde ~2-3 minutos
3. **Instância permanece conectada!** ✅

### **4. Verificar Logs do Railway**

Procure por:
```
🚀 Usando PostgreSQL para sessões WhatsApp (Railway)
✅ Tabela whatsapp_auth inicializada (PostgreSQL)
✅ Sessão instance-01 conectada com sucesso!
```

---

## 🔍 Verificar Dados no PostgreSQL

### **Via Railway Dashboard:**

1. Clique no card **"PostgreSQL"**
2. Vá em **"Data"**
3. Selecione tabela **"whatsapp_auth"**
4. Veja os dados das sessões salvas

### **Via Comando SQL:**

No Railway PostgreSQL → "Query":
```sql
-- Ver todas as sessões salvas
SELECT session_id, COUNT(*) as keys_count 
FROM whatsapp_auth 
GROUP BY session_id;

-- Ver credenciais de uma sessão específica
SELECT * FROM whatsapp_auth 
WHERE session_id = 'instance-01';

-- Limpar sessão específica (se necessário)
DELETE FROM whatsapp_auth 
WHERE session_id = 'instance-01';
```

---

## 📊 Como Funciona

### **Detecção Automática**

```javascript
const isProduction = process.env.DATABASE_URL !== undefined;

if (isProduction) {
  // RAILWAY: Usa PostgreSQL
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
} else {
  // LOCAL: Usa SQLite
  db = Database;
}
```

### **Fluxo de Dados**

```
┌─────────────────────────────────────┐
│     LOCAL (Desenvolvimento)         │
├─────────────────────────────────────┤
│  DATABASE_URL = undefined           │
│  ↓                                  │
│  SQLite (data/users.db)             │
│  ✅ Rápido e simples                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     RAILWAY (Produção)              │
├─────────────────────────────────────┤
│  DATABASE_URL = postgresql://...    │
│  ↓                                  │
│  PostgreSQL (persistente)           │
│  ✅ Sobrevive a deploys             │
└─────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### **Erro: "relation 'whatsapp_auth' does not exist"**

**Solução:**
1. No Railway → PostgreSQL → "Query"
2. Execute:
```sql
CREATE TABLE whatsapp_auth (
  session_id TEXT NOT NULL,
  data_key TEXT NOT NULL,
  data_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, data_key)
);
```

### **Erro: "connect ECONNREFUSED"**

**Causa:** `DATABASE_URL` não configurada

**Solução:**
1. Verifique se PostgreSQL está adicionado ao projeto
2. Verifique se `DATABASE_URL` está nas variáveis
3. Redeploy o serviço

### **Ainda Desconecta Após Conectar**

**Solução:**
1. Verifique logs do Railway para erros de SQL
2. Limpe dados antigos:
```sql
TRUNCATE TABLE whatsapp_auth;
```
3. Remova e adicione instância novamente
4. Me envie logs do Railway

---

## 📈 Vantagens PostgreSQL vs SQLite

| Recurso | SQLite | PostgreSQL |
|---------|--------|------------|
| **Persistência Railway** | ❌ Perdido | ✅ Permanente |
| **Desenvolvimento Local** | ✅ Ideal | ⚠️ Complexo |
| **Deploys** | ❌ Reseta | ✅ Mantém |
| **Escalabilidade** | ⚠️ Limitada | ✅ Ilimitada |
| **Backup** | Manual | ✅ Automático |
| **Custo Railway** | Grátis | Grátis* |

*Hobby plan do Railway inclui 1 PostgreSQL grátis

---

## 🔒 Segurança

✅ **Credenciais Criptografadas:** WhatsApp usa criptografia end-to-end
✅ **SSL no PostgreSQL:** Conexão segura via Railway
✅ **Isolamento:** Cada usuário vê apenas suas sessões
✅ **Backup Automático:** Railway faz backup diário do PostgreSQL

---

## 💾 Backup Manual (Opcional)

Para backup extra:

1. **Exportar dados:**
```sql
COPY whatsapp_auth TO '/tmp/backup.csv' CSV HEADER;
```

2. **Importar dados:**
```sql
COPY whatsapp_auth FROM '/tmp/backup.csv' CSV HEADER;
```

---

## ✅ Checklist Final

### **Railway:**
- [ ] PostgreSQL adicionado ao projeto
- [ ] `DATABASE_URL` nas variáveis do serviço
- [ ] `FIREBASE_PROJECT_ID` configurado
- [ ] Deploy com sucesso
- [ ] Logs mostram "Usando PostgreSQL"

### **Nexus Disparador:**
- [ ] Instâncias antigas removidas
- [ ] Nova instância adicionada
- [ ] QR Code gerado e escaneado
- [ ] Status "Conectado" ✅
- [ ] Persistência testada (redeploy)

---

## 🎉 Resultado

**Antes:**
```
Deploy 1: Conecta ✅
Deploy 2: Desconecta ❌ (arquivos perdidos)
Deploy 3: Desconecta ❌
```

**Agora:**
```
Deploy 1: Conecta ✅
Deploy 2: Permanece conectado ✅ (PostgreSQL)
Deploy 3: Permanece conectado ✅
Deploy ∞: Permanece conectado ✅
```

---

## 📞 Suporte

Se ainda tiver problemas:

1. **Me envie:**
   - Screenshot dos logs do Railway
   - Screenshot do console do navegador (F12)
   - Mensagem de erro específica

2. **Informações úteis:**
   - Qual passo deu erro?
   - Conseguiu adicionar PostgreSQL?
   - `DATABASE_URL` está configurada?

**Suas sessões WhatsApp agora são 100% persistentes no Railway!** 🚀🐘
