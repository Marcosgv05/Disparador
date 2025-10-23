# ⚡ Deploy Rápido - 5 Minutos

## 🚀 Opção 1: Railway (Recomendado)

### **1. Preparar Código**
```bash
git init
git add .
git commit -m "Deploy inicial"
```

### **2. GitHub**
1. Crie repo em https://github.com/new
2. Push:
```bash
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

### **3. Railway**
1. Acesse https://railway.app
2. Login com GitHub
3. **New Project** → **Deploy from GitHub**
4. Selecione seu repositório
5. **Deploy!**

### **4. Pronto!**
```
https://seu-app.up.railway.app
```

---

## 🎨 Opção 2: Render

### **1-2. Mesmo que Railway**

### **3. Render**
1. Acesse https://render.com
2. Login com GitHub
3. **New +** → **Web Service**
4. Conecte repositório
5. Configure:
   - Build: `npm install`
   - Start: `npm run web`
6. **Create Web Service**

### **4. Pronto!**
```
https://seu-app.onrender.com
```

⚠️ **Nota:** Render dorme após 15min inativo (plano grátis)

---

## 🖥️ Opção 3: VPS (Mais Controle)

### **1. Conectar**
```bash
ssh root@SEU-IP
```

### **2. Instalar Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

### **3. Clonar e Rodar**
```bash
cd /var/www
git clone https://github.com/SEU-USUARIO/SEU-REPO.git disparador
cd disparador
npm install
pm2 start npm --name "disparador" -- run web
pm2 startup
pm2 save
```

### **4. Nginx (Opcional)**
```bash
apt install -y nginx
nano /etc/nginx/sites-available/disparador
```

Adicione:
```nginx
server {
    listen 80;
    server_name SEU-IP;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/disparador /etc/nginx/sites-enabled/
systemctl restart nginx
```

### **5. Pronto!**
```
http://SEU-IP
```

---

## 📋 Após Deploy

1. **Acesse a URL**
2. **Adicione Instância** (Menu → Instâncias)
3. **Conecte WhatsApp** (Escanear QR Code)
4. **Crie Campanha** (Menu → Campanhas)
5. **Compartilhe URL** com seu amigo!

---

## 🎯 Recomendação

**Para começar:** Railway (grátis, fácil, 5 minutos)

**Para produção:** VPS (mais controle, $5/mês)

---

## 📚 Guia Completo

Para mais detalhes, veja: **[GUIA-DEPLOY.md](GUIA-DEPLOY.md)**

---

**Boa sorte!** 🚀
