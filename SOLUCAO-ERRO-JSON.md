# 🔧 Solução: Erro "Unexpected token '<', "<!DOCTYPE"... is not valid JSON"

## 🎯 O Que Significa Este Erro?

Este erro ocorre quando:
- O **frontend** espera receber **JSON** da API
- Mas o **servidor** retorna **HTML** (geralmente uma página de erro)

**Causa comum:** Servidor não está rodando ou há erro não tratado.

---

## ✅ Correções Implementadas

### **1. Middleware de Tratamento de Erros**

Adicionado no `src/server.js`:

```javascript
// 404 - Rota não encontrada
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Rota não encontrada' });
  } else {
    res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  logger.error(`Erro não tratado: ${err.message}`);
  logger.error(err.stack);
  
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: err.message 
    });
  } else {
    res.status(500).send('Erro interno do servidor');
  }
});
```

**Benefício:** Garante que rotas `/api/*` sempre retornem JSON, mesmo em caso de erro.

---

### **2. Validação de Content-Type no Frontend**

Adicionado no `public/app.js`:

```javascript
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        // Verifica se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Resposta inválida do servidor. Verifique se o servidor está rodando corretamente.');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}
```

**Benefício:** Detecta quando o servidor retorna HTML ao invés de JSON e mostra mensagem clara.

---

### **3. Log de Requisições**

Adicionado no `src/server.js`:

```javascript
// Log de requisições (apenas em desenvolvimento)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.info(`${req.method} ${req.path}`);
  }
  next();
});
```

**Benefício:** Facilita debug mostrando todas as requisições no console.

---

## 🔍 Como Diagnosticar

### **Passo 1: Verificar se o Servidor Está Rodando**

```bash
# Deve estar rodando
npm run web
```

**Saída esperada:**
```
🚀 Servidor Web iniciado!
📱 Acesse: http://localhost:3000
```

---

### **Passo 2: Testar API Diretamente**

Abra o navegador e acesse:
```
http://localhost:3000/api/campaign/list
```

**Resposta esperada (JSON):**
```json
{
  "campaigns": []
}
```

**Se receber HTML:** Servidor não está rodando ou há erro.

---

### **Passo 3: Verificar Console do Servidor**

Procure por erros no terminal onde rodou `npm run web`:

```bash
# Erros comuns:
❌ Error: Cannot find module 'express'
   → Solução: npm install

❌ Error: EADDRINUSE: address already in use
   → Solução: Porta 3000 ocupada, mude no .env

❌ SyntaxError: ...
   → Solução: Erro de código, verifique o arquivo
```

---

### **Passo 4: Verificar Console do Navegador**

Abra DevTools (F12) → Console:

```javascript
// Se aparecer:
Unexpected token '<', "<!DOCTYPE"... is not valid JSON

// Significa que a API retornou HTML ao invés de JSON
```

---

## 🛠️ Soluções Rápidas

### **Solução 1: Reiniciar Servidor**

```bash
# Pare o servidor (Ctrl+C)
# Inicie novamente
npm run web
```

### **Solução 2: Limpar Cache**

```bash
# Limpe node_modules e reinstale
rm -rf node_modules
npm install
npm run web
```

### **Solução 3: Verificar Porta**

```bash
# Se porta 3000 estiver ocupada
# Crie arquivo .env na raiz:
PORT=3001

# Ou mude diretamente em src/server.js:
const PORT = process.env.PORT || 3001;
```

### **Solução 4: Verificar Dependências**

```bash
# Certifique-se que todas estão instaladas
npm install express cors socket.io multer xlsx csv-parser qrcode
```

---

## 📋 Checklist de Verificação

Antes de reportar erro, verifique:

- [ ] Servidor está rodando (`npm run web`)
- [ ] Porta 3000 está livre
- [ ] Todas as dependências instaladas (`npm install`)
- [ ] Arquivo `package.json` está correto
- [ ] Não há erros no console do servidor
- [ ] Navegador está acessando `http://localhost:3000`
- [ ] Cache do navegador foi limpo (Ctrl+Shift+R)

---

## 🎯 Teste Rápido

Execute este teste para verificar se tudo está OK:

```bash
# 1. Pare o servidor
Ctrl+C

# 2. Reinstale dependências
npm install

# 3. Inicie servidor
npm run web

# 4. Abra navegador
http://localhost:3000

# 5. Abra DevTools (F12)
# 6. Vá em Network
# 7. Clique em qualquer ação (ex: criar campanha)
# 8. Verifique a requisição:
#    - Status: 200 OK (ou 400/500 com JSON)
#    - Response: JSON (não HTML)
```

---

## 🚨 Erros Específicos e Soluções

### **Erro: "Cannot find module 'scheduler'"**

```bash
# O arquivo foi criado mas não foi salvo
# Verifique se existe:
ls src/services/scheduler.js

# Se não existir, crie novamente ou reinicie o editor
```

### **Erro: "Port 3000 is already in use"**

```bash
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3000 | xargs kill -9
```

### **Erro: "CORS policy"**

```javascript
// Já corrigido em src/server.js:
app.use(cors());

// Se persistir, adicione:
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
```

---

## 📊 Logs Úteis

### **Servidor Funcionando Corretamente:**

```
[INFO] 🚀 Servidor Web iniciado!
[INFO] 📱 Acesse: http://localhost:3000
[INFO] 📅 Scheduler iniciado
[INFO] Cliente conectado via WebSocket
[INFO] GET /api/campaign/list
[INFO] POST /api/session/create
```

### **Servidor Com Problemas:**

```
[ERROR] Erro não tratado: Cannot read property...
[ERROR] Error: ENOENT: no such file or directory
[ERROR] SyntaxError: Unexpected token
```

---

## 🎓 Entendendo o Fluxo

```
Frontend (app.js)
    ↓
apiCall('/api/campaign/list')
    ↓
fetch('http://localhost:3000/api/campaign/list')
    ↓
Servidor (server.js)
    ↓
app.get('/api/campaign/list', ...)
    ↓
res.json({ campaigns: [...] })
    ↓
Frontend recebe JSON ✅
```

**Se algo falha:**

```
Frontend (app.js)
    ↓
apiCall('/api/campaign/list')
    ↓
fetch('http://localhost:3000/api/campaign/list')
    ↓
Servidor NÃO ESTÁ RODANDO ❌
    ↓
Navegador retorna página de erro HTML
    ↓
Frontend tenta parsear HTML como JSON
    ↓
Erro: "Unexpected token '<'"
```

---

## ✅ Teste Final

Após aplicar as correções:

```bash
# 1. Reinicie o servidor
npm run web

# 2. Abra o navegador
http://localhost:3000

# 3. Abra DevTools (F12) → Console
# 4. Execute:
fetch('/api/campaign/list')
  .then(r => r.json())
  .then(console.log)

# Deve retornar:
# { campaigns: [] }
```

---

## 🎉 Resumo

**Problema:** Frontend recebia HTML ao invés de JSON

**Solução:**
1. ✅ Middleware de erro que garante JSON em rotas `/api/*`
2. ✅ Validação de content-type no frontend
3. ✅ Logs para facilitar debug
4. ✅ Mensagens de erro mais claras

**Agora:**
- Erros sempre retornam JSON
- Mensagens mais claras
- Mais fácil de debugar

---

**Reinicie o servidor e teste novamente!** 🚀
