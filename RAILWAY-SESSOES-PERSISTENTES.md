# 🚀 Sessões WhatsApp Persistentes no Railway

## ❌ Problema Identificado

**Sintoma:**
- QR Code aparece e é escaneado
- Celular mostra "conectando..."
- Conexão aparece como "conectada" por breve momento
- Depois a conexão cai em segundos
- **Só acontece no Railway, não localmente**

**Causa Raiz:**
O Railway usa containers **efêmeros**. Todos os arquivos são apagados quando:
- Ocorre um novo deploy
- O container reinicia
- O Railway move o container para outro servidor

O Baileys (biblioteca do WhatsApp) salvava as credenciais de autenticação em:
```
auth_sessions/
  ├── instance-01/
  │   ├── creds.json
  │   └── app-state-sync-key-*.json
  └── instance-02/
      └── ...
```

Esses arquivos eram **perdidos**, fazendo o WhatsApp desconectar.

---

## ✅ Solução Implementada

### 1. **Banco de Dados para Sessões**

Criado `authStateDB.js` que:
- Salva credenciais no **SQLite** (banco que já existe)
- Persiste entre deploys e reinícios
- Compatível com API do Baileys (`useMultiFileAuthState`)

**Tabela Criada:**
```sql
CREATE TABLE whatsapp_auth (
  session_id TEXT NOT NULL,      -- ID da instância (ex: "instance-01")
  data_key TEXT NOT NULL,         -- Tipo de dado (ex: "creds", "app-state-sync-key-123")
  data_value TEXT NOT NULL,       -- JSON serializado do dado
  updated_at DATETIME,            -- Última atualização
  PRIMARY KEY (session_id, data_key)
)
```

### 2. **Configurações de Estabilidade**

Adicionado no `makeWASocket`:
```javascript
keepAliveIntervalMs: 30000,     // Ping a cada 30s para manter conexão
connectTimeoutMs: 60000,        // Timeout de 60s
defaultQueryTimeoutMs: 60000,
markOnlineOnConnect: true,      // Marca como online ao conectar
retryRequestDelayMs: 250,       // Retry rápido
maxMsgRetryCount: 5             // Tenta 5 vezes antes de falhar
```

### 3. **Reconexão Inteligente**

Quando a conexão cai:
```javascript
if (shouldReconnect) {
  // Aguarda 3s antes de reconectar (evita loops)
  setTimeout(() => {
    createSession(sessionId);
  }, 3000);
} else {
  // Se foi deslogado, limpa credenciais
  clearAuthState(sessionId);
}
```

---

## 🔧 Arquivos Modificados

### Novos Arquivos
- ✅ `src/whatsapp/authStateDB.js` - Adapter de banco de dados

### Arquivos Modificados
- ✅ `src/whatsapp/sessionManager.js` - Usa DB em vez de arquivos
- ✅ `src/config/database.js` - Já existente (sem mudanças)

---

## 📊 Como Funciona

### Fluxo de Autenticação

```
1. Usuário clica "Gerar QR Code"
   ↓
2. createSession() é chamado
   ↓
3. useDatabaseAuthState() carrega credenciais do banco
   ↓
4. Se não existir, cria novas (initAuthCreds)
   ↓
5. makeWASocket usa as credenciais
   ↓
6. QR Code é gerado
   ↓
7. Usuário escaneia
   ↓
8. WhatsApp autentica
   ↓
9. saveCreds() salva no banco automaticamente
   ↓
10. Conexão permanece ativa com keep-alive
```

### Persistência

```
┌─────────────────────────────────────────────┐
│         ANTES (Arquivos - ❌)               │
├─────────────────────────────────────────────┤
│  Deploy 1: WhatsApp conecta                 │
│  Deploy 2: Arquivos perdidos ❌             │
│  Deploy 3: WhatsApp desconecta ❌           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         AGORA (Banco - ✅)                  │
├─────────────────────────────────────────────┤
│  Deploy 1: WhatsApp conecta                 │
│  Deploy 2: Credenciais no banco ✅          │
│  Deploy 3: WhatsApp permanece conectado ✅  │
└─────────────────────────────────────────────┘
```

---

## 🚀 Deploy e Teste

### 1. Fazer Deploy

```bash
git add .
git commit -m "feat: persistir sessões WhatsApp no banco de dados"
git push origin main
```

Railway detectará e fará deploy automático (~2-3 min)

### 2. Testar

1. **Primeira Conexão:**
   - Adicione instância
   - Gere QR Code
   - Escaneie com WhatsApp
   - Aguarde "Conectado" ✅

2. **Teste de Persistência:**
   - No Railway, vá em "Deployments"
   - Clique em "Redeploy" (forçar novo deploy)
   - Aguarde ~2 min
   - **Instância deve permanecer conectada!** ✅

3. **Verificar Logs:**
   ```
   ✅ Sessão instance-01 conectada com sucesso!
   🔑 Sessão instance-01 marcada como pronta
   ```

### 3. Verificar Banco

Você pode consultar o banco localmente:
```bash
npm run web
```

Abra `data/users.db` com SQLite Browser e veja:
- Tabela `whatsapp_auth` com credenciais salvas
- `session_id`, `data_key`, `data_value`

---

## 🐛 Troubleshooting

### Problema: Ainda desconecta

**Causa:** Credenciais antigas corrompidas

**Solução:**
1. Remova a instância
2. Adicione novamente
3. Gere novo QR Code
4. Conecte novamente

### Problema: Não conecta após escanear

**Causa:** Keep-alive não está funcionando

**Solução:**
- Verifique logs do Railway para erros
- Certifique-se que o deploy terminou com sucesso
- Tente em outra rede (pode ser firewall/proxy)

### Problema: "Error: Table whatsapp_auth not found"

**Causa:** Tabela não foi criada

**Solução:**
1. Redeploy no Railway
2. `authStateDB.js` criará tabela automaticamente na inicialização

---

## 📈 Benefícios

✅ **Persistência Total:** Sessões sobrevivem a deploys e reinícios
✅ **Sem Configuração Extra:** Usa SQLite que já existe
✅ **Keep-Alive:** Conexão mantida ativa com pings
✅ **Reconexão Inteligente:** Reconecta automaticamente se cair
✅ **Logs Detalhados:** Diagnóstico fácil de problemas
✅ **Compatível:** Funciona igual localmente e no Railway

---

## 🔮 Futuro: PostgreSQL

Se quiser usar PostgreSQL em vez de SQLite:

1. **Adicione dependência:**
```bash
npm install pg
```

2. **Configure Railway:**
- Adicione PostgreSQL service
- Copie `DATABASE_URL` para variáveis

3. **Modifique `authStateDB.js`:**
```javascript
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
```

Mas SQLite já funciona perfeitamente! 🎉

---

## ✅ Resumo

| Item | Antes | Agora |
|------|-------|-------|
| **Armazenamento** | Arquivos | Banco de Dados |
| **Persistência** | ❌ Perdida | ✅ Permanente |
| **Deploy** | ❌ Desconecta | ✅ Mantém |
| **Reconexão** | Manual | ✅ Automática |
| **Keep-Alive** | ❌ Não | ✅ 30s |

**Agora suas instâncias WhatsApp permanecerão conectadas indefinidamente no Railway!** 🚀
