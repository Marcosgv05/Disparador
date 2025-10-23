# 🚀 Instalação - Interface Web

## ⚡ Início Rápido (2 Minutos)

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar Servidor
```bash
npm run web
```

### 3. Abrir no Navegador
```
http://localhost:3000
```

**Pronto!** A interface visual está rodando! 🎉

---

## 📱 Primeiro Uso

### Passo 1: Conectar WhatsApp
1. Clique em "Conectar WhatsApp" no menu lateral
2. Digite um ID (ex: `principal`)
3. Escaneie o QR Code que aparece na tela
4. Aguarde a confirmação

### Passo 2: Criar Campanha
1. Clique em "Campanhas"
2. Digite um nome
3. Clique em "Criar Campanha"

### Passo 3: Upload de Planilha
1. Baixe o template de números
2. Preencha com seus números
3. Faça upload

### Passo 4: Adicionar Mensagens
1. Baixe o template de mensagens
2. Preencha com suas mensagens
3. Faça upload

### Passo 5: Iniciar Disparo
1. Vá em "Disparo"
2. Selecione sua campanha
3. Clique em "Iniciar"
4. Acompanhe o progresso!

---

## 🌐 Compartilhar com Clientes

### Opção 1: Mesma Rede (Wi-Fi)

1. **Descubra seu IP:**
   ```bash
   # Windows
   ipconfig
   
   # Veja "Endereço IPv4", exemplo: 192.168.1.100
   ```

2. **Compartilhe a URL:**
   ```
   http://192.168.1.100:3000
   ```

3. **Cliente acessa:**
   - Mesmo Wi-Fi
   - Digite a URL no navegador
   - Pronto!

---

### Opção 2: Acesso pela Internet (Ngrok - Mais Fácil)

1. **Instalar Ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Com o servidor rodando, abra outro terminal:**
   ```bash
   ngrok http 3000
   ```

3. **Copie a URL gerada:**
   ```
   Exemplo: https://abc123.ngrok.io
   ```

4. **Compartilhe com o cliente:**
   - Funciona de qualquer lugar
   - Válido por 8 horas (versão gratuita)
   - Cliente acessa direto no navegador

---

## 📊 Formato das Planilhas

### Números (CSV ou XLSX)

**Coluna:** `phone`

```
phone
5511999887766
5511988776655
5521987654321
```

**No Excel:**
- Coluna A1: phone
- A partir de A2: números

---

### Mensagens (CSV ou XLSX)

**Coluna:** `message`

```
message
Olá! Esta é a mensagem 1
Oi! Esta é a mensagem 2
E aí! Esta é a mensagem 3
```

**No Excel:**
- Coluna A1: message
- A partir de A2: mensagens

---

## ⚙️ Configurações

### Mudar Porta

Crie um arquivo `.env`:
```env
PORT=8080
```

Ou:
```bash
PORT=8080 npm run web
```

---

### Ajustar Delays

Arquivo `.env`:
```env
MESSAGE_DELAY=3000  # 3 segundos entre mensagens
NUMBER_DELAY=5000   # 5 segundos entre números
```

---

## 🔥 Recursos da Interface Web

### ✅ Upload de Planilhas
- CSV e XLSX
- Validação automática
- Feedback em tempo real

### ✅ Dashboard Visual
- Estatísticas
- Campanhas recentes
- Números totais

### ✅ QR Code na Tela
- Aparece automaticamente
- Não precisa terminal
- Visual e fácil

### ✅ Controle em Tempo Real
- Iniciar
- Pausar
- Retomar
- Parar
- Barra de progresso

### ✅ Responsivo
- Desktop
- Tablet
- Celular

---

## 🆘 Problemas Comuns

### "npm install falha"
```bash
# Limpar cache
npm cache clean --force
npm install
```

### "Porta 3000 em uso"
```bash
# Usar outra porta
PORT=3001 npm run web
```

### "Não abre no navegador"
- Verifique se o servidor está rodando
- Vá manualmente em http://localhost:3000
- Tente outro navegador

### "Cliente não consegue acessar"
- Mesma rede Wi-Fi?
- Firewall bloqueando?
- IP correto?

---

## 📞 Suporte

### Guias Disponíveis:
- **[GUIA-WEB.md](GUIA-WEB.md)** - Tutorial completo da interface web
- **[README.md](README.md)** - Visão geral do projeto
- **[COMPARACAO.md](COMPARACAO.md)** - Comparação entre interfaces

### Dúvidas Técnicas:
- Veja logs no terminal
- Consulte ARQUITETURA.md

---

## 🎯 Checklist de Instalação

- [ ] `npm install` executado
- [ ] `npm run web` rodando
- [ ] Abriu http://localhost:3000
- [ ] QR Code escaneado
- [ ] Campanha criada
- [ ] Planilha enviada
- [ ] Primeiro disparo teste

✅ **Tudo funcionando!** 

---

**Próximo passo:** Leia [GUIA-WEB.md](GUIA-WEB.md) para tutorial completo! 🚀
