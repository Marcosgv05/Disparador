# 🔧 Configurar Persistência de Dados no Railway

## ⚠️ Problema

O Railway **não persiste** arquivos entre deploys por padrão. A cada deploy, o banco de dados e sessões são perdidos.

## ✅ Solução: Volumes Persistentes

### **Passo 1: Configurar Volumes no Railway Dashboard**

1. Acesse: https://railway.app/
2. Clique no seu projeto **"whatsapp-disparador"**
3. Clique no **serviço** principal
4. Vá na aba **"Settings"**
5. Procure pela seção **"Volumes"**
6. Clique em **"+ New Volume"** (ou "+ Add Volume")

### **Passo 2: Criar 3 Volumes**

#### **Volume 1: Banco de Dados (OBRIGATÓRIO)**
```
Mount Path: /app/data
Volume Name: nexus-data
```
✅ **Clique em "Add"**

#### **Volume 2: Sessões WhatsApp**
```
Mount Path: /app/auth_sessions
Volume Name: nexus-sessions
```
✅ **Clique em "Add"**

#### **Volume 3: Campanhas**
```
Mount Path: /app/campaigns
Volume Name: nexus-campaigns
```
✅ **Clique em "Add"**

### **Passo 3: Aguardar Redeploy**

- Railway fará **redeploy automático** após adicionar volumes
- Aguarde ~2-3 minutos

---

## 🔑 Criar Usuário Admin (Após Configurar Volumes)

### **Método 1: Via Endpoint de Emergência (Mais Fácil)**

1. Abra o **Console do Navegador** (F12)
2. Cole e execute:

```javascript
fetch('https://whatsapp-disparador-production-9f6f.up.railway.app/api/emergency/create-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ secret: 'nexus-emergency-2025' })
})
.then(r => r.json())
.then(console.log)
```

3. Deve retornar:
```json
{
  "success": true,
  "message": "Admin criado com sucesso!",
  "credentials": {
    "email": "admin@whatsapp.com",
    "password": "admin123"
  }
}
```

4. **Faça login** com:
   - Email: `admin@whatsapp.com`
   - Senha: `admin123`

---

### **Método 2: Via Railway CLI (Requer Instalação)**

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Conectar ao projeto
railway link

# Criar admin
railway run npm run create-admin
```

---

## 🎯 Verificar Se Funcionou

### **Teste 1: Criar Conta e Fazer Novo Deploy**

1. Crie uma conta de teste: `teste@teste.com`
2. Faça um novo deploy (commit qualquer alteração)
3. Após deploy, tente logar com `teste@teste.com`
4. ✅ **Deve funcionar!** Se funcionar, os volumes estão configurados corretamente

### **Teste 2: Verificar Volumes no Railway**

1. Railway → Seu Projeto → Settings → Volumes
2. Deve mostrar:
   ```
   ✅ nexus-data           (/app/data)
   ✅ nexus-sessions       (/app/auth_sessions)
   ✅ nexus-campaigns      (/app/campaigns)
   ```

---

## 📊 Tamanho dos Volumes

**Railway Free Tier:**
- 1GB de armazenamento persistente **grátis**
- Suficiente para:
  - Milhares de usuários
  - Centenas de campanhas
  - Dezenas de sessões WhatsApp

---

## 🚨 Troubleshooting

### **Problema: Ainda perde dados após deploy**

**Causa**: Volumes não configurados corretamente

**Solução**:
1. Verifique se os volumes existem em Settings → Volumes
2. Verifique se o **Mount Path** está correto: `/app/data` (com `/app/`)
3. Redeploy manualmente: Settings → Deploy

---

### **Problema: Erro "SQLITE_CANTOPEN"**

**Causa**: Diretório `/app/data` não existe ou sem permissão

**Solução**:
1. Verifique os logs: Railway → Deployments → View Logs
2. Procure por: `✅ Diretório data criado`
3. Se não aparecer, o volume não está montado

---

### **Problema: Endpoint de emergência retorna 403**

**Causa**: Secret incorreto

**Solução**:
- Use exatamente: `nexus-emergency-2025`
- Ou configure `EMERGENCY_SECRET` nas variáveis do Railway

---

## 🔐 Segurança

### **Endpoint de Emergência**

⚠️ O endpoint `/api/emergency/create-admin` é temporário e protegido por secret.

**Para remover após criar admin:**
1. Comente ou delete o endpoint no `src/server.js` (linhas 116-160)
2. Commit e push
3. Railway fará redeploy automaticamente

---

## 📋 Checklist Completo

- [ ] Acessar Railway Dashboard
- [ ] Ir em Settings → Volumes
- [ ] Criar volume `nexus-data` em `/app/data`
- [ ] Criar volume `nexus-sessions` em `/app/auth_sessions`
- [ ] Criar volume `nexus-campaigns` em `/app/campaigns`
- [ ] Aguardar redeploy (~3 min)
- [ ] Executar endpoint de emergência OU `railway run npm run create-admin`
- [ ] Fazer login com `admin@whatsapp.com` / `admin123`
- [ ] Testar criando nova conta
- [ ] Fazer novo deploy
- [ ] Verificar se conta persiste após deploy ✅

---

## 🎉 Pronto!

Agora seu banco de dados e sessões **persistem entre deploys**! 🚀

**Importante:**
- ✅ Volumes são persistentes
- ✅ Dados não são perdidos em redeploys
- ✅ WhatsApp permanece conectado (se sessões persistidas)
- ✅ Campanhas e contatos são mantidos
