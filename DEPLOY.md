# 🚀 Guia de Deploy - Railway

## ⚠️ ATENÇÃO: Mudanças Necessárias Antes do Deploy

### 1. **Configurar Variáveis de Ambiente no Railway**

Após criar o projeto no Railway, você **DEVE** configurar estas variáveis:

#### **Segurança (OBRIGATÓRIO)**
```bash
# Gere secrets seguros:
# No terminal local, execute:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Configure no Railway:
JWT_SECRET=cole-o-hash-gerado-aqui
SESSION_SECRET=cole-outro-hash-gerado-aqui
```

#### **Configurações da Aplicação**
```bash
NODE_ENV=production
PORT=3000  # Railway define automaticamente, mas pode especificar

# URL da sua aplicação (será algo como):
BASE_URL=https://seu-app.up.railway.app
CORS_ORIGIN=https://seu-app.up.railway.app
```

#### **Configurações WhatsApp (Opcional)**
```bash
MESSAGE_DELAY=3000
NUMBER_DELAY=5000
ROTATION_MODE=sequential
```

---

## 📋 Passo a Passo do Deploy

### **1. Prepare o Repositório GitHub**

```bash
# 1. Inicialize o Git (se ainda não fez)
git init

# 2. Adicione todos os arquivos
git add .

# 3. Commit inicial
git commit -m "feat: sistema multi-tenant completo com autenticação"

# 4. Crie um repositório no GitHub
# Acesse: https://github.com/new

# 5. Adicione o remote
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git

# 6. Faça o push
git branch -M main
git push -u origin main
```

### **2. Deploy no Railway**

1. **Acesse Railway**
   - Vá em: https://railway.app/
   - Faça login com GitHub

2. **Criar Novo Projeto**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha seu repositório

3. **Configurar Variáveis de Ambiente**
   - Clique no projeto → "Variables"
   - Adicione todas as variáveis listadas acima
   - **ESPECIALMENTE**: `JWT_SECRET` e `SESSION_SECRET`

4. **Configurar Domínio**
   - Vá em "Settings" → "Domains"
   - Railway gerará um domínio: `seu-app.up.railway.app`
   - Copie essa URL

5. **Atualizar CORS_ORIGIN**
   - Volte em "Variables"
   - Atualize `CORS_ORIGIN` com a URL do Railway
   - Exemplo: `https://seu-app.up.railway.app`

6. **Deploy Automático**
   - Railway fará o deploy automaticamente
   - Acompanhe os logs na aba "Deployments"

### **3. Criar Usuário Admin no Railway**

Após o primeiro deploy bem-sucedido:

```bash
# 1. Instale Railway CLI localmente
npm install -g @railway/cli

# 2. Faça login
railway login

# 3. Selecione seu projeto
railway link

# 4. Execute o script de criar admin
railway run npm run create-admin
```

Isso criará o usuário admin com:
- **Email**: `admin@whatsapp.com`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Troque a senha do admin após primeiro login!

---

## 🔒 Segurança em Produção

### **1. Secrets Fortes**
```bash
# Nunca use os defaults em produção!
# Gere novos com:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Execute 2x (um para JWT, outro para SESSION)
```

### **2. CORS Configurado**
- Certifique-se que `CORS_ORIGIN` aponta apenas para seu domínio
- Não use `*` em produção

### **3. HTTPS Obrigatório**
- Railway fornece HTTPS automaticamente ✅
- Certifique-se que os cookies estão configurados para `secure: true` em produção

### **4. Banco de Dados**
- O sistema usa SQLite (arquivo `data/users.db`)
- Railway persiste automaticamente (Volume montado)
- **Backup recomendado**: Configure backups periódicos

---

## 📁 Estrutura de Persistência

### **Dados que serão persistidos:**
```
data/
  ├── users.db           # Usuários e autenticação
campaigns/               # Campanhas (JSON por campanha)
instances.json           # Instâncias WhatsApp
schedules.json           # Agendamentos
auth_sessions/           # Sessões WhatsApp (QR codes)
```

### **Railway Volumes**
Railway persiste automaticamente:
- ✅ `data/` (banco de usuários)
- ✅ `campaigns/` (campanhas)
- ✅ `auth_sessions/` (sessões WhatsApp)
- ✅ `instances.json`
- ✅ `schedules.json`

---

## 🧪 Testando o Deploy

### **1. Acesse a URL do Railway**
```
https://seu-app.up.railway.app
```

### **2. Faça Login**
- Email: `admin@whatsapp.com`
- Senha: `admin123`

### **3. Teste Funcionalidades**
- ✅ Criar instância
- ✅ Conectar WhatsApp (QR Code)
- ✅ Criar campanha
- ✅ Adicionar contatos
- ✅ Executar disparo

### **4. Teste Multi-Tenant**
- Crie um novo usuário
- Faça logout
- Faça login com novo usuário
- Verifique que não vê dados do admin ✅

---

## 🔄 Atualizações Futuras

Após cada atualização no código:

```bash
# 1. Commit as mudanças
git add .
git commit -m "feat: nova funcionalidade"

# 2. Push para GitHub
git push origin main

# 3. Railway faz deploy automático!
```

Railway detecta o push e faz redeploy automaticamente. 🚀

---

## ⚠️ Problemas Comuns

### **Erro: "Token inválido"**
**Causa**: `JWT_SECRET` não configurado ou diferente entre deploys

**Solução**:
1. Vá em Railway → Variables
2. Configure `JWT_SECRET` com um hash fixo
3. Não mude depois!

### **Erro: "Database is locked"**
**Causa**: Múltiplas instâncias tentando escrever no SQLite

**Solução**:
- Railway roda 1 instância por padrão (OK)
- Se escalar, considere migrar para PostgreSQL

### **Sessão WhatsApp desconecta**
**Causa**: Container reiniciou e perdeu a sessão

**Solução**:
- Normal em ambientes serverless
- Reconecte escaneando novo QR Code
- As campanhas e dados não são perdidos ✅

### **CORS Error**
**Causa**: `CORS_ORIGIN` não configurado

**Solução**:
1. Railway → Variables
2. `CORS_ORIGIN=https://seu-app.up.railway.app`
3. Redeploy

---

## 📊 Monitoramento

### **Logs do Railway**
```bash
# Via CLI
railway logs

# Ou via Dashboard
# Projeto → Deployments → View Logs
```

### **Métricas**
- Railway mostra uso de CPU/Memória automaticamente
- Monitore na aba "Metrics"

---

## 💰 Custos Railway

### **Plano Gratuito**
- $5 de crédito/mês
- Suficiente para:
  - 1 aplicação pequena/média
  - ~500 horas de runtime
  - Até ~10 usuários simultâneos

### **Upgrade Recomendado**
Se crescer:
- **Hobby Plan**: $5/mês
- **Pro Plan**: $20/mês (mais recursos)

---

## 🎯 Checklist Final

Antes de fazer deploy, certifique-se:

- [ ] `.env.example` configurado
- [ ] `.gitignore` correto (não commita `data/`, `auth_sessions/`)
- [ ] Código commitado no GitHub
- [ ] Railway projeto criado
- [ ] Variáveis de ambiente configuradas:
  - [ ] `JWT_SECRET` (hash seguro)
  - [ ] `SESSION_SECRET` (hash seguro)
  - [ ] `CORS_ORIGIN` (URL do Railway)
  - [ ] `NODE_ENV=production`
- [ ] Admin criado (`railway run npm run create-admin`)
- [ ] Primeiro login testado
- [ ] Multi-tenant testado

---

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs**: `railway logs`
2. **Variáveis**: Certifique-se que todas estão configuradas
3. **GitHub**: Código está atualizado?
4. **Railway Status**: https://railway.statuspage.io/

---

## 🎉 Pronto!

Seu sistema multi-tenant está pronto para produção! 🚀

Acesse: `https://seu-app.up.railway.app`
