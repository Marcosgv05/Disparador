```markdown
# 🌐 Guia da Interface Web

## 🚀 Início Rápido

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar o Servidor
```bash
npm run web
```

### 3. Acessar no Navegador
```
http://localhost:3000
```

### 4. Compartilhar com Clientes
```
http://SEU-IP:3000
```

**Para descobrir seu IP:**
- Windows: `ipconfig`
- Mac/Linux: `ifconfig`

---

## 📱 Funcionalidades

### **1. Dashboard**
- Visão geral de todas as campanhas
- Estatísticas em tempo real
- Campanhas recentes

### **2. Conectar WhatsApp**
- QR Code aparece na tela
- Escanear com WhatsApp
- Múltiplas sessões suportadas

### **3. Gerenciar Campanhas**
- Criar novas campanhas
- Upload de planilhas (CSV/XLSX)
- Adicionar números e mensagens
- Remover números específicos

### **4. Controle de Disparo**
- Iniciar disparo
- Pausar em tempo real
- Retomar de onde parou
- Parar completamente
- Progresso visual

---

## 📊 Como Usar - Passo a Passo

### **Passo 1: Conectar WhatsApp**

1. Clique em **"Conectar WhatsApp"** no menu lateral
2. Digite um ID (ex: `principal`)
3. Clique em **"Conectar"**
4. Aguarde o QR Code aparecer
5. Abra o WhatsApp no celular
6. Vá em **Menu > Aparelhos conectados**
7. Escaneie o QR Code na tela
8. Aguarde a confirmação

✅ **Status muda para "Conectado"** no topo

---

### **Passo 2: Criar Campanha**

1. Clique em **"Campanhas"** no menu
2. Na aba **"Nova Campanha"**
3. Digite o nome (ex: `promocao-natal`)
4. Clique em **"Criar Campanha"**

✅ **Campanha criada!**

---

### **Passo 3: Adicionar Números**

#### **Opção A: Upload de Planilha (Recomendado)**

1. Na aba **"Gerenciar"**
2. Selecione sua campanha
3. Na seção **"Adicionar Números"**
4. Clique na área de upload ou arraste o arquivo
5. Selecione sua planilha (.csv ou .xlsx)
6. Aguarde o processamento

**Formato da Planilha:**
```
phone
5511999887766
5511988776655
5521987654321
```

**Baixar Template:**
- Clique em "Baixar Template de Números"
- Edite com seus números
- Faça upload

---

### **Passo 4: Adicionar Mensagens**

#### **Upload de Planilha**

1. Na seção **"Adicionar Mensagens"**
2. Faça upload da planilha de mensagens
3. Aguarde confirmação

**Formato da Planilha:**
```
message
Olá! Esta é a mensagem 1
Oi! Esta é a mensagem 2
E aí! Esta é a mensagem 3
```

**Baixar Template:**
- Clique em "Baixar Template de Mensagens"
- Edite com suas mensagens
- Faça upload

---

### **Passo 5: Verificar Status**

Na aba **"Gerenciar"**, você verá:

- **Total**: Quantidade de números
- **Enviadas**: Já foram enviadas
- **Falhas**: Erros no envio
- **Pendentes**: Aguardando envio

**Lista de Números:**
- ✅ = Já enviado
- ⏳ = Pendente

---

### **Passo 6: Iniciar Disparo**

1. Clique em **"Disparo"** no menu
2. Selecione a campanha
3. Clique em **"Iniciar Disparo"**
4. Confirme
5. Acompanhe o progresso em tempo real

**Barra de Progresso:**
- Mostra porcentagem concluída
- Estatísticas em tempo real
- Atualização automática

---

### **Passo 7: Controlar Durante o Disparo**

#### **Pausar**
- Clique em **"Pausar"**
- O disparo para após a mensagem atual
- Você pode adicionar mais números
- Clique em **"Retomar"** para continuar

#### **Parar**
- Clique em **"Parar"**
- O disparo para completamente
- O progresso é salvo
- Você pode ver os resultados

---

## 📁 Preparando Planilhas

### **Excel (XLSX)**

1. Abra o Excel
2. Na coluna A1, escreva: `phone` (para números) ou `message` (para mensagens)
3. A partir de A2, coloque os dados
4. Salve como `.xlsx`

**Exemplo - Números:**
```
| A                |
|------------------|
| phone            |
| 5511999887766    |
| 5511988776655    |
```

**Exemplo - Mensagens:**
```
| A                                      |
|----------------------------------------|
| message                                |
| Olá! Esta é a mensagem 1               |
| Oi! Esta é a mensagem 2                |
```

---

### **CSV**

1. Abra o Bloco de Notas
2. Digite no formato:
   ```
   phone
   5511999887766
   5511988776655
   ```
3. Salve com extensão `.csv`

**Ou:**
- Baixe os templates direto da interface
- Edite e faça upload

---

## 🔄 Fluxo Completo Visual

```
┌─────────────────────┐
│ 1. Conectar WA      │
│ (Escanear QR Code)  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 2. Criar Campanha   │
│ (Dar um nome)       │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
┌────▼────┐ ┌────▼──────┐
│ Upload  │ │  Upload   │
│ Números │ │ Mensagens │
└────┬────┘ └────┬──────┘
     └─────┬─────┘
           │
┌──────────▼──────────┐
│ 3. Verificar Status │
│ (Dashboard)         │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 4. Iniciar Disparo  │
│ (Acompanhar)        │
└──────────┬──────────┘
           │
     ┌─────┼─────┐
     │     │     │
┌────▼─┐ ┌─▼──┐ ┌▼────┐
│Pausar│ │Ver │ │Parar│
└──────┘ └────┘ └─────┘
```

---

## 🌐 Compartilhar com Clientes

### **1. Descobrir seu IP**

**Windows (CMD ou PowerShell):**
```bash
ipconfig
```
Procure por "Endereço IPv4"

**Mac/Linux:**
```bash
ifconfig
# ou
ip addr show
```

**Exemplo de IP:** `192.168.1.100`

---

### **2. Liberar Porta no Firewall**

**Windows:**
1. Painel de Controle → Firewall
2. Configurações Avançadas
3. Regras de Entrada → Nova Regra
4. Porta → TCP 3000
5. Permitir conexão

**Mac:**
1. Preferências → Segurança
2. Firewall → Opções
3. Adicionar aplicação Node.js

---

### **3. Compartilhar URL**

Envie para o cliente:
```
http://192.168.1.100:3000
```

**Importante:**
- Cliente deve estar na mesma rede (Wi-Fi)
- Ou configure port forwarding no roteador para acesso externo

---

### **4. Acesso Externo (Internet)**

Para acesso pela internet, você precisa:

1. **Port Forwarding no Roteador:**
   - Acesse seu roteador (geralmente 192.168.1.1)
   - Configure port forwarding da porta 3000
   - Aponte para o IP do seu computador

2. **Usar seu IP Público:**
   - Descubra em: https://meuip.com.br
   - Compartilhe: `http://SEU-IP-PUBLICO:3000`

3. **Ou usar Ngrok (mais fácil):**
   ```bash
   npm install -g ngrok
   ngrok http 3000
   ```
   - Ngrok gera uma URL pública
   - Compartilhe essa URL com o cliente
   - Válida por 8 horas (versão gratuita)

---

## ⚙️ Configurações Avançadas

### **Mudar Porta**

No arquivo `.env`:
```env
PORT=8080
```

Ou ao iniciar:
```bash
PORT=8080 npm run web
```

---

### **Delay entre Mensagens**

No arquivo `.env`:
```env
MESSAGE_DELAY=5000  # 5 segundos
NUMBER_DELAY=7000   # 7 segundos
```

---

## 🔒 Segurança

### **Recomendações:**

1. **Não exponha para internet sem segurança**
   - Use HTTPS em produção
   - Adicione autenticação
   - Use firewall

2. **Backups:**
   - Pasta `campaigns/` contém os dados
   - Faça backup regularmente

3. **Senhas:**
   - Não compartilhe credenciais de sessão
   - Pasta `auth_sessions/` é sensível

---

## 📊 Monitoramento

### **Via Dashboard:**
- Estatísticas em tempo real
- Progresso visual
- Status das campanhas

### **Via Logs:**
Os logs aparecem no terminal onde você executou `npm run web`

---

## 🆘 Problemas Comuns

### **"Não consigo acessar de outro dispositivo"**
- Verifique se estão na mesma rede
- Confirme o firewall
- Use o IP correto (não `localhost`)

### **"Upload não funciona"**
- Verifique formato da planilha
- Certifique-se que a coluna se chama `phone` ou `message`
- Tente com o template baixado

### **"QR Code não aparece"**
- Recarregue a página
- Verifique se o servidor está rodando
- Olhe os logs no terminal

### **"Disparo não inicia"**
- Certifique-se que está conectado ao WhatsApp
- Verifique se há números e mensagens
- Veja os logs no terminal

---

## 📱 Mobile Responsivo

A interface funciona perfeitamente em:
- ✅ Desktop
- ✅ Tablet
- ✅ Celular

Clientes podem acessar de qualquer dispositivo!

---

## 🎨 Personalização

### **Logo:**
Edite `public/index.html` e substitua o SVG

### **Cores:**
Edite `public/styles.css`:
```css
:root {
    --primary: #25D366;
    --primary-dark: #128C7E;
    /* ... */
}
```

---

## 📚 Próximos Passos

1. Teste com números próprios primeiro
2. Configure delays adequados
3. Compartilhe com clientes em produção
4. Monitore os resultados

---

**Interface web pronta para uso!** 🚀

Qualquer dúvida, consulte também:
- `README.md` - Visão geral
- `GUIA-CLIENTE.md` - Versão CLI
- `ARQUITETURA.md` - Detalhes técnicos
```
