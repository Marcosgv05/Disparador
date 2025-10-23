# 🚀 Guia Rápido - WhatsApp Multi-Sender

## Instalação em 3 Passos

### 1. Instale as dependências
```bash
npm install
```

### 2. Configure o ambiente
```bash
cp .env.example .env
```

### 3. Execute
```bash
npm start
```

## 📱 Primeiro Uso

### Passo 1: Conecte um WhatsApp
1. Execute `npm start`
2. Escolha a opção **1 - Adicionar Sessão**
3. Digite um nome para a sessão (ex: `principal`)
4. Escaneie o QR Code que aparecer com seu WhatsApp

### Passo 2: Envie sua primeira mensagem
1. Escolha a opção **3 - Enviar em Lote**
2. Digite os números (com código do país):
   ```
   5511999999999
   5511888888888
   ```
3. Digite as mensagens (serão alternadas):
   ```
   Olá! Esta é a primeira mensagem
   Oi! Esta é a segunda mensagem
   ```
4. Confirme o envio digitando `s`

## 🎯 Casos de Uso Comuns

### Envio Simples
```bash
npm start
# Opção 1 -> Conectar
# Opção 3 -> Enviar
```

### Múltiplas Contas
```bash
npm start
# Opção 1 -> Conectar conta 1
# Opção 1 -> Conectar conta 2
# Opção 4 -> Enviar com Multi-Sessão
```

### Usar Arquivos
```bash
# 1. Edite os arquivos:
# examples/contacts.txt - coloque os números
# examples/messages.txt - coloque as mensagens

# 2. Execute:
node examples/from-file.js
```

### Usar CSV com Dados Personalizados
```bash
# 1. Edite examples/contacts.csv com seus dados

# 2. Execute:
node examples/from-csv.js
```

## ⚙️ Configurações Importantes

### Delays (arquivo .env)
```env
MESSAGE_DELAY=3000  # 3 segundos entre mensagens
NUMBER_DELAY=5000   # 5 segundos ao trocar de número
```

### Modo de Alternância
```env
ROTATION_MODE=sequential  # ou "random"
```

## 🔧 Solução de Problemas

### Erro: "Nenhuma sessão ativa"
- Certifique-se de escanear o QR Code
- Aguarde alguns segundos após escanear

### Erro ao enviar mensagem
- Verifique o formato do número: `5511999999999`
- Confirme que o número está registrado no WhatsApp

### QR Code não aparece
- Reinstale: `npm install`
- Atualize o Baileys: `npm update @whiskeysockets/baileys`

## 📊 Dicas de Performance

### Evite Bloqueios
- Use delays de pelo menos 3 segundos
- Não envie mais de 500 mensagens/dia por número
- Alterne o conteúdo das mensagens

### Múltiplas Contas
- Use 3-5 contas para distribuir a carga
- Cada conta pode enviar ~500 mensagens/dia
- Total: 1500-2500 mensagens/dia

### Variáveis nas Mensagens
Use variáveis para personalizar:
```
Olá {nome}! Seu pedido {numero} está pronto.
```

## 🎓 Exemplos Prontos

### 1. Envio Simples
```bash
node examples/simple-send.js
```

### 2. Multi-Sessão
```bash
node examples/multi-session.js
```

### 3. Com Variáveis
```bash
node examples/with-variables.js
```

### 4. De Arquivo
```bash
node examples/from-file.js
```

### 5. De CSV
```bash
node examples/from-csv.js
```

## 📞 Próximos Passos

1. **Teste com seus números** - Use números próprios primeiro
2. **Ajuste os delays** - Encontre o melhor equilíbrio
3. **Crie suas mensagens** - Personalize o conteúdo
4. **Escale gradualmente** - Comece pequeno e aumente aos poucos

## ⚠️ Lembre-se

- ✅ Use apenas para mensagens autorizadas
- ✅ Respeite os limites do WhatsApp
- ✅ Mantenha delays adequados
- ❌ Não envie spam
- ❌ Não abuse do sistema

---

**Precisa de ajuda?** Abra uma issue no repositório!
