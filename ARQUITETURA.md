# 🏗️ Arquitetura do Sistema

## Visão Geral

O WhatsApp Multi-Sender é uma ferramenta modular construída para envio em massa de mensagens do WhatsApp usando a biblioteca Baileys. O sistema foi projetado com foco em escalabilidade, confiabilidade e facilidade de uso.

## 📊 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    WhatsApp API                         │
│              (Camada de Interface)                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Index.js / CLI                        │
│              (Interface do Usuário)                     │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Session   │  │   Message   │  │    Queue    │
│   Manager   │  │   Sender    │  │   Manager   │
└─────────────┘  └─────────────┘  └─────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Baileys   │  │   Message   │  │    Utils    │
│     API     │  │   Rotator   │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

## 🔧 Componentes Principais

### 1. SessionManager
**Arquivo**: `src/whatsapp/sessionManager.js`

**Responsabilidades**:
- Gerenciar múltiplas conexões do WhatsApp
- Autenticação e manutenção de sessões
- Sistema de round-robin para distribuição de carga
- Reconexão automática

**Métodos Principais**:
```javascript
createSession(sessionId)      // Cria nova sessão
getSession(sessionId)          // Obtém sessão específica
getAvailableSession()          // Round-robin entre sessões
removeSession(sessionId)       // Remove sessão
```

### 2. MessageSender
**Arquivo**: `src/services/messageSender.js`

**Responsabilidades**:
- Envio de mensagens individuais
- Envio em lote (bulk)
- Distribuição multi-sessão
- Estatísticas de envio

**Métodos Principais**:
```javascript
sendMessage(phone, message, sessionId)
sendBulk(phoneNumbers, messages, options)
sendBulkMultiSession(phoneNumbers, messages)
getStats()
```

### 3. MessageRotator
**Arquivo**: `src/services/messageRotator.js`

**Responsabilidades**:
- Alternância de mensagens (sequencial/aleatório)
- Substituição de variáveis
- Gerenciamento de templates

**Métodos Principais**:
```javascript
loadMessages(messages)
getNextMessage()
replaceVariables(message, variables)
getNextCustomMessage(variables)
```

### 4. QueueManager
**Arquivo**: `src/services/queueManager.js`

**Responsabilidades**:
- Criação e gerenciamento de filas
- Processamento assíncrono
- Controle de status e progresso

**Métodos Principais**:
```javascript
createQueue(queueId)
addItems(queueId, items)
processQueue(queueId, processor)
getQueueStatus(queueId)
```

## 🔄 Fluxo de Dados

### Envio Simples
```
1. Usuário → API/CLI
2. API → MessageSender
3. MessageSender → SessionManager (obtém sessão)
4. MessageSender → Baileys (envia mensagem)
5. Baileys → WhatsApp
```

### Envio em Lote
```
1. Usuário → API/CLI (números + mensagens)
2. API → MessageRotator (carrega mensagens)
3. API → MessageSender
4. Loop para cada número:
   a. MessageRotator → próxima mensagem
   b. SessionManager → sessão disponível
   c. Baileys → envia mensagem
   d. Delay
5. Retorna estatísticas
```

### Multi-Sessão
```
1. Usuário → API/CLI
2. SessionManager → lista sessões ativas
3. Loop para cada número:
   a. Round-robin → próxima sessão
   b. MessageRotator → próxima mensagem
   c. Envia via sessão selecionada
   d. Delay
4. Retorna estatísticas
```

## 🗂️ Estrutura de Dados

### Sessão
```javascript
{
  sock: WhatsAppSocket,      // Conexão Baileys
  isReady: boolean,          // Status de conexão
  lastUsed: timestamp        // Para round-robin
}
```

### Resultado de Envio
```javascript
{
  success: boolean,
  phone: string,
  error?: string
}
```

### Estatísticas
```javascript
{
  sent: number,
  failed: number,
  total: number
}
```

### Fila
```javascript
{
  id: string,
  items: Array,
  status: 'idle' | 'processing' | 'completed' | 'error',
  createdAt: Date,
  startedAt: Date,
  completedAt: Date,
  results: Array
}
```

## 🔐 Segurança

### Autenticação
- Credenciais armazenadas localmente em `auth_sessions/`
- Cada sessão tem sua própria pasta
- Arquivos protegidos pelo `.gitignore`

### Rate Limiting
- Delays configuráveis entre mensagens
- Distribuição de carga entre sessões
- Prevenção de bloqueios

### Validação
- Números validados antes do envio
- Formato automático para padrão WhatsApp
- Tratamento de erros robusto

## ⚡ Performance

### Otimizações
1. **Round-Robin**: Distribuição automática entre sessões
2. **Delays Inteligentes**: Evita bloqueios mantendo performance
3. **Processamento Assíncrono**: Filas para grandes volumes
4. **Gestão de Memória**: Limpeza automática de sessões

### Benchmarks
- **1 Sessão**: ~20 mensagens/minuto (com delays de 3s)
- **3 Sessões**: ~60 mensagens/minuto
- **5 Sessões**: ~100 mensagens/minuto

### Limites Recomendados
- Máximo 500 mensagens/dia por sessão
- Delay mínimo de 3 segundos
- Máximo 10 sessões simultâneas

## 🧩 Extensibilidade

### Adicionar Novos Tipos de Mensagem
```javascript
// Em messageSender.js
async sendImage(phone, imagePath, caption) {
  const session = this.getSession();
  await session.sendMessage(phone, {
    image: { url: imagePath },
    caption: caption
  });
}
```

### Adicionar Novos Rotadores
```javascript
// Criar novo arquivo em src/services/
class CustomRotator {
  // Implementar lógica personalizada
}
```

### Integrar com Banco de Dados
```javascript
// Substituir fileLoader por conexão DB
async function loadContactsFromDB() {
  const contacts = await db.query('SELECT * FROM contacts');
  return contacts;
}
```

## 🐛 Tratamento de Erros

### Níveis de Erro
1. **Sessão**: Reconexão automática
2. **Envio**: Log e continuação
3. **Fatal**: Encerramento gracioso

### Logs
- Pino logger com níveis configuráveis
- Logs coloridos no console
- Rastreamento completo de operações

## 🔮 Futuras Melhorias

### Planejadas
- [ ] Interface Web (Dashboard)
- [ ] API REST
- [ ] Agendamento de mensagens
- [ ] Suporte a mídias (imagem, vídeo, áudio)
- [ ] Webhooks para notificações
- [ ] Relatórios detalhados
- [ ] Integração com CRM

### Sugeridas pela Comunidade
- [ ] Docker support
- [ ] Suporte a grupos
- [ ] Auto-resposta
- [ ] Chatbot integration
- [ ] Analytics avançado

## 📚 Dependências

### Principais
- **@whiskeysockets/baileys**: Cliente WhatsApp Web
- **pino**: Sistema de logging
- **qrcode-terminal**: QR Code no terminal

### Desenvolvimento
- **Node.js**: v16+
- **ES Modules**: Import/Export

## 🤝 Contribuindo

Para contribuir com a arquitetura:

1. Mantenha a modularidade
2. Documente novas funcionalidades
3. Escreva testes
4. Siga o padrão de código
5. Atualize esta documentação

---

**Última atualização**: 2024
**Versão**: 1.0.0
