# 🔐 Sistema de Autenticação Multi-Tenant

## ✨ Funcionalidades Implementadas

- **Registro de usuários** com validação de email e senha
- **Login seguro** com JWT (JSON Web Tokens)
- **Logout** com limpeza de sessões
- **Proteção de rotas** via middleware
- **Separação de dados** por usuário (preparado para multi-tenant)
- **Roles** (user/admin) para controle de acesso
- **Interface moderna** de login/registro

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
npm install
```

### 2. Criar Usuário Admin

```bash
npm run create-admin
```

Isso criará um usuário administrador com as credenciais:
- **Email**: `admin@whatsapp.com`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

### 3. Iniciar o Servidor

```bash
npm run web
```

### 4. Acessar o Sistema

1. Abra `http://localhost:3000`
2. Você será redirecionado para `/login.html`
3. Faça login com as credenciais do admin
4. Você será redirecionado para o dashboard principal

## 📁 Estrutura de Arquivos

```
src/
├── config/
│   └── database.js          # Configuração SQLite
├── models/
│   └── User.js              # Modelo de usuário
├── middleware/
│   └── auth.js              # Middlewares de autenticação
├── routes/
│   └── auth.js              # Rotas de autenticação
└── scripts/
    └── createAdmin.js       # Script para criar admin

public/
└── login.html               # Tela de login/registro

data/
└── users.db                 # Banco de dados SQLite
```

## 🔒 Endpoints da API

### Públicos

#### `POST /api/auth/register`
Registro de novo usuário.

**Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123",
  "name": "Nome Completo"
}
```

**Resposta:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `POST /api/auth/login`
Login de usuário.

**Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Resposta:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Protegidos (Requerem Autenticação)

#### `GET /api/auth/me`
Retorna dados do usuário logado.

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "user": {
    "id": 1,
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "role": "user"
  }
}
```

#### `POST /api/auth/logout`
Faz logout do usuário.

### Admin Apenas

#### `GET /api/auth/users`
Lista todos os usuários.

#### `PUT /api/auth/users/:id`
Atualiza dados de um usuário.

#### `DELETE /api/auth/users/:id`
Remove um usuário.

## 🛡️ Middlewares Disponíveis

### `requireAuth`
Protege rotas que requerem autenticação.

```javascript
import { requireAuth } from './middleware/auth.js';

app.get('/api/campaigns', requireAuth, (req, res) => {
  // req.user contém os dados do usuário
  const userId = req.user.id;
  // ...
});
```

### `requireAdmin`
Protege rotas que requerem privilégios de admin.

```javascript
import { requireAuth, requireAdmin } from './middleware/auth.js';

app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  // Apenas admins podem acessar
});
```

### `optionalAuth`
Permite acesso com ou sem autenticação (popula `req.user` se autenticado).

```javascript
import { optionalAuth } from './middleware/auth.js';

app.get('/api/public', optionalAuth, (req, res) => {
  if (req.user) {
    // Usuário logado
  } else {
    // Usuário anônimo
  }
});
```

## 🎨 Personalização

### Alterar Tempo de Expiração do Token

No arquivo `src/middleware/auth.js`:

```javascript
export function generateToken(user) {
  return jwt.sign(
    { /* ... */ },
    JWT_SECRET,
    { expiresIn: '7d' } // Altere aqui (ex: '30d', '12h', '60m')
  );
}
```

### Alterar Secret do JWT

Configure a variável de ambiente:

```bash
export JWT_SECRET="sua-chave-super-secreta-aqui"
```

Ou edite diretamente em `src/middleware/auth.js`:

```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-aqui';
```

## 🔄 Próximos Passos (Multi-Tenant Completo)

Para tornar o sistema completamente multi-tenant, você precisa:

1. **Adicionar `userId` às tabelas**:
   - `campaigns` → adicionar coluna `user_id`
   - `instances` → adicionar coluna `user_id`

2. **Filtrar dados por usuário**:
   ```javascript
   // Exemplo: Listar apenas campanhas do usuário
   app.get('/api/campaigns', requireAuth, (req, res) => {
     const campaigns = campaignManager.listCampaigns()
       .filter(c => c.userId === req.user.id);
     res.json({ campaigns });
   });
   ```

3. **Validar propriedade** antes de ações:
   ```javascript
   app.delete('/api/campaign/:id', requireAuth, (req, res) => {
     const campaign = campaignManager.getCampaign(req.params.id);
     if (campaign.userId !== req.user.id && req.user.role !== 'admin') {
       return res.status(403).json({ error: 'Não autorizado' });
     }
     // Processa exclusão
   });
   ```

## ⚠️ Migrando Dados Existentes

Se você já tinha campanhas/instâncias antes da atualização multi-tenant:

### **Método Automático (Recomendado)**

```bash
# 1. Pare o servidor
# 2. Execute o script de migração
npm run migrate

# 3. Inicie o servidor novamente
npm run web

# 4. Faça login como admin
# Email: admin@whatsapp.com
# Senha: admin123
```

O script automaticamente:
- ✅ Adiciona `userId: 1` a todas as instâncias existentes
- ✅ Adiciona `userId: 1` a todas as campanhas existentes
- ✅ Mantém todos os dados intactos

### **Método Manual (Se necessário)**

1. **Backup**:
   ```bash
   cp campaigns/*.json campaigns_backup/
   cp instances.json instances_backup.json
   ```

2. **Adicionar userId manualmente** aos JSONs:
   ```json
   {
     "name": "Campanha Antiga",
     "userId": 1,
     ...
   }
   ```

## 📝 Observações

- **Banco SQLite**: Ideal para desenvolvimento e pequenas aplicações
- **Produção**: Considere migrar para PostgreSQL/MySQL
- **HTTPS**: Sempre use HTTPS em produção para proteger tokens
- **Backup**: Faça backup regular do arquivo `data/users.db`

## 🐛 Troubleshooting

### Erro: "Token inválido ou expirado"
- Limpe o localStorage: `localStorage.clear()` no console do navegador
- Faça login novamente

### Erro: "Database is locked"
- Pare o servidor
- Exclua o arquivo `data/users.db`
- Reinicie e execute `npm run create-admin` novamente

### Tela de login não carrega
- Verifique se o servidor está rodando: `http://localhost:3000`
- Verifique se há erros no console do navegador (F12)

## 📧 Suporte

Em caso de dúvidas, verifique:
1. Logs do servidor no terminal
2. Console do navegador (F12 → Console)
3. Network tab do navegador (F12 → Network)
