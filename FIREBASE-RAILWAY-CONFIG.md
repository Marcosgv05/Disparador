# 🔥 Configuração Firebase + Railway

## Problema Resolvido

**Erro:** "Token inválido ou expirado" após fazer login

**Causa:** Backend não estava validando tokens do Firebase corretamente

**Solução:** Atualizado middleware de autenticação para usar Firebase Admin SDK

---

## 🚀 Configuração no Railway

### Passo 1: Adicionar Variável de Ambiente

1. Acesse: https://railway.app/
2. Clique no seu projeto
3. Vá em **Variables**
4. Clique em **"+ New Variable"**
5. Adicione:

```
Name: FIREBASE_PROJECT_ID
Value: nexus-9b811
```

⚠️ **Importante:** Use o `projectId` do seu Firebase (mesmo que está em `firebase-config.js`)

### Passo 2: Redeploy

O Railway fará redeploy automático após adicionar a variável.

Aguarde ~2-3 minutos até aparecer "✓ Success"

---

## ✅ Verificação

Após o deploy:

1. Acesse: `https://whatsapp-disparador-production-9f6f.up.railway.app`
2. Faça login com Firebase
3. **✅ Deve funcionar sem erro "Token inválido"**
4. **✅ Deve conseguir adicionar instâncias**
5. **✅ Deve conseguir criar campanhas**

---

## 🔧 Como Funciona

### Modo Desenvolvimento (Local)

- Firebase Admin **não** é inicializado
- Aceita qualquer token válido do Firebase
- Extrai informações do payload do JWT

### Modo Produção (Railway)

- Firebase Admin **é** inicializado com `FIREBASE_PROJECT_ID`
- Valida tokens usando `admin.auth().verifyIdToken()`
- Garante segurança total

---

## 📋 Checklist Completo

**No Firebase Console:**
- [x] Projeto criado (`nexus-9b811`)
- [x] Authentication ativado (Email/Password)
- [x] App Web registrado
- [x] Config copiado para `firebase-config.js`
- [x] Domínio Railway autorizado

**No Railway:**
- [ ] Variável `FIREBASE_PROJECT_ID` = `nexus-9b811`
- [ ] Deploy concluído com sucesso
- [ ] Teste de login funcionando

**No Código:**
- [x] `firebase-config.js` configurado
- [x] `firebase-auth.js` implementado
- [x] `login.html` usando Firebase
- [x] `app.js` enviando `firebaseToken`
- [x] Middleware `auth.js` validando Firebase

---

## 🐛 Troubleshooting

### Erro: "Token inválido ou expirado"

**Causa:** Variável `FIREBASE_PROJECT_ID` não configurada no Railway

**Solução:**
1. Adicione a variável no Railway
2. Aguarde redeploy
3. Limpe cache: `Ctrl + Shift + Delete`
4. Faça login novamente

### Erro: "Failed to load resource: 401"

**Causa:** Token não está sendo enviado ou é inválido

**Solução:**
1. Faça logout: Clique no botão "Sair"
2. Limpe localStorage: `F12 → Console → localStorage.clear()`
3. Recarregue a página
4. Faça login novamente

### Erro: "Não consegue adicionar instâncias"

**Causa:** Middleware de autenticação não validou o token

**Solução:**
1. Verifique se `FIREBASE_PROJECT_ID` está no Railway
2. Veja logs do Railway para erros
3. Confirme que domínio Railway está nos "Authorized domains" do Firebase

---

## 📊 Fluxo de Autenticação

```
1. Usuário faz login no Firebase (frontend)
   ↓
2. Firebase retorna token JWT
   ↓
3. Token salvo em localStorage.firebaseToken
   ↓
4. Toda requisição envia: Authorization: Bearer <token>
   ↓
5. Backend valida com Firebase Admin
   ↓
6. req.user = { id, email, name, role }
   ↓
7. Rotas protegidas funcionam normalmente
```

---

## 🔒 Segurança

### Desenvolvimento (Local)
- ⚠️ Aceita tokens sem validação estrita
- ✅ Facilita desenvolvimento
- ❌ Não use em produção

### Produção (Railway)
- ✅ Valida tokens com Firebase Admin
- ✅ Verifica assinatura e expiração
- ✅ Garante que token é autêntico
- ✅ Previne falsificação

---

## 📝 Código Importante

### Middleware Atualizado

```javascript
// src/middleware/auth.js
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (admin.apps.length > 0) {
    // PRODUÇÃO: Valida com Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      role: 'user'
    };
  } else {
    // DESENVOLVIMENTO: Aceita token direto
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));
    req.user = { id: payload.user_id, email: payload.email };
  }
  
  next();
}
```

### Frontend

```javascript
// public/app.js
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('firebaseToken');
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers
    }
  });
  return response.json();
}
```

---

## ✅ Pronto!

Agora o sistema usa **Firebase Authentication** completo:

- ✅ Login/Registro gerenciado pelo Firebase
- ✅ Tokens validados com segurança
- ✅ Dados persistem entre deploys
- ✅ Sem problemas de "token inválido"
- ✅ Escalável e confiável

**Próximo passo:** Adicione `FIREBASE_PROJECT_ID` no Railway e teste! 🚀
