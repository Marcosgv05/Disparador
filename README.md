# 📱 WhatsApp Multi-Sender

Ferramenta profissional de disparo em massa para WhatsApp usando Baileys API. Suporta múltiplas sessões simultâneas e alternância inteligente de mensagens.

## 🎯 Três Formas de Usar

### 🌐 **Interface Web** - Visual e Moderna (NOVO!)
```bash
npm run web
```
**Acesse:** `http://localhost:3000`

**Ideal para:** Clientes acessarem via navegador, upload de planilhas, interface visual completa.

→ **[Leia o Guia Web](GUIA-WEB.md)**

### 📋 **Modo Cliente (CLI)** - Sistema de Campanhas
```bash
npm run client
```
**Ideal para:** Terminal, gerenciar campanhas, adicionar/remover números dinamicamente.

→ **[Leia o Guia CLI](GUIA-CLIENTE.md)**

### 🚀 **Modo Básico (CLI)** - Envio Direto
```bash
npm start
```
**Ideal para:** Envios rápidos, múltiplas sessões simultâneas, simplicidade.

→ **[Veja as Diferenças](COMPARACAO.md)**

## 🚀 Características

### Modo Cliente (Sistema de Campanhas)
- 📋 **Gerenciamento de Campanhas**: Crie, salve e carregue campanhas
- ➕ **Adicionar/Remover Números**: Gerencie números dinamicamente
- ⏯️ **Pausar/Retomar**: Controle total do disparo
- 💾 **Persistência**: Salva automaticamente o progresso
- 📊 **Status Detalhado**: Acompanhe cada número (enviado/pendente)

### Modo Básico (Multi-Sender)
- ✅ **Múltiplas Sessões**: Conecte vários números de WhatsApp simultaneamente
- 🔄 **Alternância de Mensagens**: Alterne entre diferentes mensagens (sequencial ou aleatório)
- 🎯 **Round-Robin**: Distribuição automática de envios entre sessões
- 📝 **Variáveis Dinâmicas**: Use variáveis personalizadas nas mensagens
- ⏱️ **Delays Configuráveis**: Controle o tempo entre mensagens
- 📈 **Estatísticas em Tempo Real**: Acompanhe o progresso dos envios

## 📦 Instalação

```bash
# Entre no diretório do projeto
cd windsurf-project

# Instale as dependências
npm install

# Escolha sua interface:

# Opção 1: Interface Web (NOVO! - Recomendado)
npm run web

# Opção 2: Sistema de Campanhas CLI
npm run client

# Opção 3: Envio Direto CLI
npm start
```

## 🎓 Primeiros Passos

### **Sistema de Campanhas** (Gestão Completa)
1. Execute `npm run client`
2. Conecte seu WhatsApp (opção 1)
3. Crie uma campanha (opção 2)
4. Adicione números (opção 4 ou 5)
5. Defina mensagens (opção 7)
6. Inicie o disparo (opção 9)

**[📖 Guia Completo do Cliente](GUIA-CLIENTE.md)**

### **Envio Direto** (Rápido e Simples)
1. Execute `npm start`
2. Adicione uma sessão (opção 1)
3. Envie em lote (opção 3)
4. Digite números e mensagens
5. Confirme o envio

**[📖 Guia Rápido](GUIA-RAPIDO.md)**

## ⚙️ Configuração

Edite o arquivo `.env` com suas preferências:

```env
# Delay entre mensagens (em milissegundos)
MESSAGE_DELAY=3000

# Delay entre números diferentes (em milissegundos)
NUMBER_DELAY=5000

# Modo de alternância: 'sequential' ou 'random'
ROTATION_MODE=sequential
```

## 🎯 Como Usar

### Modo Interativo

```bash
npm start
```

O menu interativo oferece as seguintes opções:

1. **Adicionar Sessão**: Conecta um novo número de WhatsApp
2. **Listar Sessões**: Visualiza todas as sessões ativas
3. **Enviar em Lote**: Envia mensagens para múltiplos números
4. **Multi-Sessão**: Distribui envios entre múltiplas contas
5. **Remover Sessão**: Desconecta uma sessão
6. **Estatísticas**: Visualiza estatísticas de envio

### Modo Programático

```javascript
import sessionManager from './src/whatsapp/sessionManager.js';
import messageSender from './src/services/messageSender.js';

// Cria uma sessão
await sessionManager.createSession('session1');

// Define números e mensagens
const phoneNumbers = [
  '5511999999999',
  '5511888888888'
];

const messages = [
  'Olá {nome}! Esta é a mensagem 1',
  'Oi {nome}! Esta é a mensagem 2',
  'E aí {nome}! Esta é a mensagem 3'
];

// Envia em lote
await messageSender.sendBulk(phoneNumbers, messages, {
  customerName: 'Cliente'
});
```

## 📝 Variáveis nas Mensagens

Você pode usar as seguintes variáveis nas mensagens:

- `{nome}`: Nome do destinatário
- `{numero}`: Número sequencial do envio
- `{total}`: Total de envios

Exemplo:
```
Olá {nome}! Você é o destinatário {numero} de {total}.
```

## 🔧 Estrutura do Projeto

```
windsurf-project/
├── src/
│   ├── config/
│   │   ├── logger.js          # Configuração de logs
│   │   └── settings.js        # Configurações gerais
│   ├── services/
│   │   ├── messageSender.js   # Serviço de envio
│   │   ├── messageRotator.js  # Alternância de mensagens
│   │   └── queueManager.js    # Gerenciamento de filas
│   ├── whatsapp/
│   │   └── sessionManager.js  # Gerenciamento de sessões
│   ├── utils/
│   │   ├── delay.js           # Funções de delay
│   │   └── phoneFormatter.js  # Formatação de números
│   └── index.js               # Arquivo principal
├── auth_sessions/             # Dados de autenticação (gerado)
├── examples/                  # Exemplos de uso
├── .env                       # Variáveis de ambiente
├── .env.example              # Exemplo de configuração
├── package.json              # Dependências
└── README.md                 # Documentação
```

## 🛡️ Segurança

- As credenciais são armazenadas localmente em `auth_sessions/`
- Nunca compartilhe a pasta `auth_sessions/` ou arquivos `.env`
- Use delays adequados para evitar bloqueios do WhatsApp
- Respeite as políticas de uso do WhatsApp

## ⚠️ Avisos Importantes

1. **Limites do WhatsApp**: O WhatsApp tem limites de mensagens. Use delays adequados.
2. **Banimento**: Uso inadequado pode resultar em banimento da conta.
3. **Responsabilidade**: Use esta ferramenta de forma ética e legal.
4. **Spam**: Não envie mensagens não solicitadas (spam).

## 📊 Melhores Práticas

1. **Delays**: Use delays de pelo menos 3-5 segundos entre mensagens
2. **Contas**: Use números dedicados para disparo em massa
3. **Mensagens**: Varie o conteúdo para evitar detecção de padrões
4. **Volume**: Não envie mais de 500 mensagens por dia por número
5. **Testes**: Sempre teste com números próprios primeiro

## 🔄 Atualizações

Para atualizar as dependências:

```bash
npm update
```

## 📞 Suporte

Para dúvidas e suporte, abra uma issue no repositório.

## 📄 Licença

ISC License

---

**Desenvolvido com ❤️ usando Baileys API**
