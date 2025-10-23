# 🚀 Guia Completo de Deploy - WhatsApp Disparador

## 📋 Índice

1. [Preparação](#preparação)
2. [Deploy no Railway (Recomendado)](#deploy-no-railway)
3. [Deploy no Render](#deploy-no-render)
4. [Deploy em VPS (DigitalOcean, AWS, etc)](#deploy-em-vps)
5. [Configuração Pós-Deploy](#configuração-pós-deploy)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Preparação

### **1. Certifique-se que tudo está funcionando localmente**

```bash
# Teste local
npm install
npm run web

# Acesse: http://localhost:3000
# Teste todas as funcionalidades
```

### **2. Crie arquivo .env (se não existir)**

```bash
cp .env.example .env
```

### **3. Commit seu código no Git**

```bash
git init
git add .
git commit -m "Preparando para deploy"
```

### **4. Crie repositório no GitHub**

1. Vá em https://github.com/new
2. Crie repositório (pode ser privado)
3. Siga instruções para push:

```bash
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git branch -M main
git push -u origin main
```

---

## 🚂 Deploy no Railway (Recomendado)

### **Por que Railway?**
- ✅ **GRÁTIS** (500h/mês)
- ✅ Deploy automático do GitHub
- ✅ SSL automático (HTTPS)
- ✅ Fácil de usar
- ✅ Suporta WebSocket

### **Passo a Passo:**

#### **1. Criar Conta**
- Acesse: https://railway.app
- Faça login com GitHub

#### **2. Novo Projeto**
1. Clique em **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Escolha seu repositório
4. Railway detecta automaticamente que é Node.js

#### **3. Configurar Variáveis de Ambiente**

No painel do Railway:
1. Vá em **"Variables"**
2. Adicione:

```env
NODE_ENV=production
PORT=3000
MESSAGE_DELAY=3000
NUMBER_DELAY=5000
ROTATION_MODE=sequential
```

#### **4. Deploy Automático**

Railway faz deploy automaticamente!

Aguarde alguns minutos e você terá:
```
https://seu-app.up.railway.app
```

#### **5. Configurar Domínio Personalizado (Opcional)**

1. Vá em **"Settings"** → **"Domains"**
2. Clique em **"Generate Domain"**
3. Ou adicione seu próprio domínio

---

## 🎨 Deploy no Render

### **Por que Render?**
- ✅ **GRÁTIS** (750h/mês)
- ✅ SSL automático
- ✅ Fácil configuração
- ⚠️ Dorme após 15min inativo (plano grátis)

### **Passo a Passo:**

#### **1. Criar Conta**
- Acesse: https://render.com
- Faça login com GitHub

#### **2. Novo Web Service**
1. Clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório GitHub
3. Configure:

```
Name: whatsapp-disparador
Environment: Node
Build Command: npm install
Start Command: npm run web
```

#### **3. Variáveis de Ambiente**

Em **"Environment"**, adicione:

```env
NODE_ENV=production
MESSAGE_DELAY=3000
NUMBER_DELAY=5000
ROTATION_MODE=sequential
```

#### **4. Deploy**

Clique em **"Create Web Service"**

Aguarde o deploy (5-10 min)

Você terá:
```
https://seu-app.onrender.com
```

### **⚠️ Importante no Render:**

O plano grátis **dorme** após 15min sem uso. Para manter ativo:

**Opção 1: Upgrade para plano pago ($7/mês)**

**Opção 2: Usar cron job gratuito:**
- Crie conta em https://cron-job.org
- Adicione job que acessa sua URL a cada 10 minutos

---

## 🖥️ Deploy em VPS

### **Opções de VPS:**
- DigitalOcean ($6/mês)
- AWS EC2 (grátis 1 ano)
- Vultr ($5/mês)
- Contabo ($4/mês)

### **Passo a Passo (Ubuntu 22.04):**

#### **1. Conectar no VPS**

```bash
ssh root@SEU-IP
```

#### **2. Instalar Node.js**

```bash
# Atualiza sistema
apt update && apt upgrade -y

# Instala Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verifica
node -v  # deve mostrar v20.x.x
npm -v
```

#### **3. Instalar PM2 (Process Manager)**

```bash
npm install -g pm2
```

#### **4. Clonar Repositório**

```bash
# Cria diretório
mkdir -p /var/www
cd /var/www

# Clona repo
git clone https://github.com/SEU-USUARIO/SEU-REPO.git disparador
cd disparador

# Instala dependências
npm install
```

#### **5. Configurar Ambiente**

```bash
# Cria .env
nano .env
```

Adicione:
```env
NODE_ENV=production
PORT=3000
MESSAGE_DELAY=3000
NUMBER_DELAY=5000
ROTATION_MODE=sequential
```

Salve: `Ctrl+X` → `Y` → `Enter`

#### **6. Iniciar com PM2**

```bash
# Inicia aplicação
pm2 start npm --name "disparador" -- run web

# Configura para iniciar no boot
pm2 startup
pm2 save

# Verifica status
pm2 status
pm2 logs disparador
```

#### **7. Configurar Nginx (Proxy Reverso)**

```bash
# Instala Nginx
apt install -y nginx

# Cria configuração
nano /etc/nginx/sites-available/disparador
```

Adicione:
```nginx
server {
    listen 80;
    server_name SEU-DOMINIO.com;  # ou seu IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Ativa configuração
ln -s /etc/nginx/sites-available/disparador /etc/nginx/sites-enabled/
nginx -t  # testa configuração
systemctl restart nginx
```

#### **8. Configurar SSL (HTTPS) com Let's Encrypt**

```bash
# Instala Certbot
apt install -y certbot python3-certbot-nginx

# Gera certificado
certbot --nginx -d SEU-DOMINIO.com

# Renovação automática já está configurada
```

#### **9. Configurar Firewall**

```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

#### **10. Comandos Úteis PM2**

```bash
# Ver logs
pm2 logs disparador

# Reiniciar
pm2 restart disparador

# Parar
pm2 stop disparador

# Atualizar código
cd /var/www/disparador
git pull
npm install
pm2 restart disparador
```

---

## ⚙️ Configuração Pós-Deploy

### **1. Acessar Aplicação**

```
https://seu-dominio.com
# ou
https://seu-app.railway.app
# ou
https://seu-app.onrender.com
```

### **2. Primeiro Acesso**

1. **Adicionar Instância**
   - Menu → Instâncias WhatsApp
   - Adicionar Nova Instância
   - Conectar e escanear QR Code

2. **Criar Campanha**
   - Menu → Campanhas
   - Nova Campanha
   - Adicionar números e mensagens

3. **Configurar Agendamento (Opcional)**
   - Menu → Agendamento
   - Selecionar campanha
   - Configurar horários

### **3. Compartilhar com Amigo**

Envie a URL:
```
https://seu-app.railway.app
```

**Ele poderá:**
- ✅ Criar suas próprias instâncias
- ✅ Criar campanhas
- ✅ Fazer disparos
- ✅ Configurar agendamentos

**Tudo salva automaticamente!**

---

## 🔒 Segurança (Opcional mas Recomendado)

### **Adicionar Autenticação Básica**

Se quiser proteger com senha:

#### **No Railway/Render:**

Adicione variável de ambiente:
```env
AUTH_USER=admin
AUTH_PASS=sua-senha-forte
```

#### **No código (src/server.js):**

Adicione antes das rotas:

```javascript
// Autenticação básica (opcional)
if (process.env.AUTH_USER && process.env.AUTH_PASS) {
  app.use((req, res, next) => {
    const auth = { login: process.env.AUTH_USER, password: process.env.AUTH_PASS };
    
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    if (login && password && login === auth.login && password === auth.password) {
      return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Autenticação necessária');
  });
}
```

---

## 🐛 Troubleshooting

### **Erro: "Application failed to respond"**

**Causa:** Aplicação não iniciou corretamente

**Solução:**
1. Verifique logs no painel do Railway/Render
2. Certifique-se que `package.json` tem script `web`
3. Verifique se todas as dependências estão instaladas

### **Erro: "Port already in use"**

**Causa:** Porta 3000 ocupada

**Solução:**
- Railway/Render usam variável `PORT` automática
- Não precisa fazer nada, eles gerenciam isso

### **WebSocket não funciona**

**Causa:** Proxy não configurado para WebSocket

**Solução VPS:**
```nginx
# Adicione no Nginx:
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

### **Sessões WhatsApp não persistem**

**Causa:** Pasta `auth_sessions` não persiste

**Solução Railway:**
1. Vá em **"Volumes"**
2. Adicione volume montado em `/app/auth_sessions`

**Solução Render:**
- Render não tem volumes persistentes no plano grátis
- Upgrade para plano pago ou use VPS

### **Aplicação lenta/travando**

**Causa:** Recursos insuficientes

**Solução:**
- Railway: Upgrade para plano pago
- Render: Upgrade para plano pago
- VPS: Aumente recursos do servidor

---

## 📊 Comparação de Plataformas

| Plataforma | Grátis | Persistência | WebSocket | SSL | Recomendado Para |
|------------|--------|--------------|-----------|-----|------------------|
| **Railway** | ✅ 500h | ✅ Com volumes | ✅ | ✅ | **Melhor opção geral** |
| **Render** | ✅ 750h | ⚠️ Só pago | ✅ | ✅ | Teste/desenvolvimento |
| **VPS** | ❌ ~$5/mês | ✅ | ✅ | ✅ | Produção profissional |

---

## 🎯 Recomendação Final

### **Para Começar:**
1. **Railway** (grátis, fácil, completo)

### **Para Produção Séria:**
1. **VPS** (DigitalOcean, Vultr)
2. Configure PM2 + Nginx + SSL
3. Backup automático

### **Para Teste:**
1. **Render** (grátis, mas dorme)

---

## 📝 Checklist de Deploy

- [ ] Código commitado no GitHub
- [ ] Testado localmente
- [ ] `.env.example` atualizado
- [ ] Plataforma escolhida (Railway/Render/VPS)
- [ ] Deploy realizado
- [ ] URL funcionando
- [ ] SSL configurado (HTTPS)
- [ ] Primeira instância conectada
- [ ] Primeira campanha testada
- [ ] URL compartilhada com amigo
- [ ] Backup configurado (se VPS)

---

## 🆘 Suporte

**Problemas?**
1. Verifique logs da plataforma
2. Teste localmente primeiro
3. Consulte documentação da plataforma:
   - Railway: https://docs.railway.app
   - Render: https://render.com/docs
   - DigitalOcean: https://docs.digitalocean.com

---

## 🎉 Pronto!

Seu disparador WhatsApp está online e acessível de qualquer lugar!

**Próximos passos:**
1. Compartilhe URL com seu amigo
2. Configure backup (se VPS)
3. Monitore uso de recursos
4. Adicione mais funcionalidades conforme necessário

**Boa sorte!** 🚀
