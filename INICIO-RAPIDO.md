# 🚀 Início Rápido - 5 Minutos

## Qual interface usar?

### 🤔 Perguntas Rápidas:

**1. Você vai adicionar mais números durante o disparo?**
- ✅ SIM → Use `npm run client`
- ❌ NÃO → Use `npm start`

**2. Você precisa pausar e retomar o envio?**
- ✅ SIM → Use `npm run client`
- ❌ NÃO → Use `npm start`

**3. É sua primeira vez usando?**
- ✅ SIM → Use `npm start` (mais simples)
- ❌ NÃO → Use `npm run client` (mais poderoso)

**4. Você tem múltiplos números de WhatsApp?**
- ✅ SIM → Use `npm start` (suporta multi-sessão)
- ❌ NÃO → Use `npm run client`

---

## 📱 Sistema de Campanhas (`npm run client`)

### Passo 1: Instalar e Iniciar
```bash
npm install
npm run client
```

### Passo 2: Menu Aparecer
```
╔════════════════════════════════════════════════╗
║  📱 WhatsApp Disparador - Sistema de Campanha ║
╚════════════════════════════════════════════════╝

❌ Nenhuma sessão conectada

🔧 CONFIGURAÇÃO
1. Conectar WhatsApp
...
```

### Passo 3: Conectar (Opção 1)
```
Digite um ID: principal
[QR CODE APARECE]
[ESCANEIE COM SEU WHATSAPP]
✅ WhatsApp conectado com sucesso!
```

### Passo 4: Criar Campanha (Opção 2)
```
Digite o nome: minha-primeira
✅ Campanha "minha-primeira" criada!
```

### Passo 5: Adicionar Números

**Opção A - Um por vez (Opção 4):**
```
Digite o número: 5511999887766
✅ Número adicionado! Total: 1

[Repita para mais números]
```

**Opção B - De arquivo (Opção 5):**
```
Digite o caminho: numeros-exemplo.txt
📂 Carregando números...
✅ Base importada! Total: 5 números
```

### Passo 6: Definir Mensagens (Opção 7)
```
Escolha: 1 (digitar)

> Olá! Mensagem 1
> Oi! Mensagem 2
> [ENTER vazio]

✅ 2 mensagens definidas!
```

### Passo 7: Iniciar (Opção 9)
```
Confirmar início do disparo? s

🚀 Iniciando disparo...
📤 Enviando para 5511999887766...
✅ Mensagem enviada
Progresso: 1/5 | ✅ 1 | ❌ 0 | ⏳ 4
```

### ⏸️ BÔNUS: Durante o disparo você pode:
- **Pausar:** Opção 10
- **Adicionar mais números:** Opção 4 (depois de pausar)
- **Retomar:** Opção 11
- **Parar:** Opção 12

---

## 🎨 Envio Direto (`npm start`)

### Passo 1: Instalar e Iniciar
```bash
npm install
npm start
```

### Passo 2: Menu Aparecer
```
╔════════════════════════════════════════════╗
║   WhatsApp Multi-Sender - Baileys API    ║
╚════════════════════════════════════════════╝

1. Adicionar Sessão (Conectar WhatsApp)
2. Listar Sessões Ativas
3. Enviar Mensagens em Lote
...
```

### Passo 3: Adicionar Sessão (Opção 1)
```
Digite um ID: principal
[QR CODE APARECE]
[ESCANEIE COM SEU WHATSAPP]
✅ Sessão principal conectada!
```

### Passo 4: Enviar em Lote (Opção 3)
```
Digite os números (linha vazia para finalizar):
> 5511999887766
> 5511988776655
> [ENTER vazio]

Digite as mensagens (linha vazia para finalizar):
> Olá! Mensagem 1
> Oi! Mensagem 2
> [ENTER vazio]

Confirmar envio? s

✅ Mensagem enviada para 5511999887766
Progresso: 1/2
✅ Mensagem enviada para 5511988776655
Progresso: 2/2

📊 Envio concluído!
✅ Enviadas: 2
```

---

## 📂 Usando Arquivos

### Criar arquivo de números: `meus-numeros.txt`
```
5511999887766
5511988776655
5521987654321
```

### Criar arquivo de mensagens: `minhas-mensagens.txt`
```
Olá! Promoção especial!
Oi! Não perca!
E aí! Novidades chegando!
```

### No Sistema de Campanhas:
```
Opção 5 → meus-numeros.txt
Opção 7 → 2 → minhas-mensagens.txt
```

### No Envio Direto:
```
Execute: node examples/from-file.js
```

---

## 🆘 Problemas?

### QR Code não aparece
```bash
npm install
# Tente novamente
```

### "Nenhuma sessão ativa"
```
1. Volte ao menu
2. Opção 1 (Conectar WhatsApp)
3. Escaneie o QR Code
4. Aguarde confirmação
```

### Número inválido
```
Use o formato: 5511999887766
- 55 = Brasil
- 11 = DDD
- 999887766 = Número
```

### Mensagem não chega
```
1. Teste com seu próprio número primeiro
2. Verifique se o número tem WhatsApp
3. Aguarde alguns segundos
4. Aumente o delay no .env
```

---

## 📖 Próximos Passos

### Sistema de Campanhas
→ Leia **[GUIA-CLIENTE.md](GUIA-CLIENTE.md)** para tutorial completo

### Envio Direto  
→ Leia **[GUIA-RAPIDO.md](GUIA-RAPIDO.md)** para mais detalhes

### Comparação
→ Leia **[COMPARACAO.md](COMPARACAO.md)** para ver todas as diferenças

---

## 💡 Dica Final

**Primeira vez?**
1. Use `npm start` (mais simples)
2. Teste com 2-3 números seus
3. Depois experimente `npm run client`

**Já é experiente?**
1. Use `npm run client` diretamente
2. Crie campanhas organizadas
3. Gerencie tudo profissionalmente

---

**Boa sorte!** 🚀

Se tiver dúvidas, todos os guias estão na pasta do projeto!
