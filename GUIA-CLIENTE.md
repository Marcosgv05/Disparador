# 📱 Guia do Cliente - Sistema de Campanhas

## 🚀 Início Rápido

### 1. Instalar e Iniciar
```bash
npm install
npm run client
```

---

## 📋 O que é uma Campanha?

Uma **campanha** é um conjunto de:
- ✅ **Números** para receber mensagens
- ✅ **Mensagens** que serão alternadas
- ✅ **Status** do disparo (pausado, rodando, parado)

Você pode criar, gerenciar e executar campanhas de forma independente.

---

## 🎯 Fluxo Completo de Uso

### **PASSO 1: Conectar WhatsApp**
```
Menu → Opção 1
```

1. Digite um ID para identificar esta conexão (ex: `principal`)
2. Escaneie o QR Code que aparecer
3. Aguarde a confirmação de conexão

**✅ Pronto!** Seu WhatsApp está conectado.

---

### **PASSO 2: Criar uma Campanha**
```
Menu → Opção 2
```

1. Digite um nome para sua campanha (ex: `promocao-verao`)
2. A campanha será criada e ativada automaticamente

**O que acontece:**
- Uma nova campanha vazia é criada
- Ela fica pronta para receber números e mensagens

---

### **PASSO 3: Adicionar Números**

Você tem **duas opções**:

#### **Opção A: Adicionar UM número por vez**
```
Menu → Opção 4
```

Digite o número no formato: `5511999887766`
- Código do país (Brasil = 55)
- DDD (11)
- Número (999887766)

**Quando usar:** Para adicionar poucos números ou fazer testes.

#### **Opção B: Adicionar uma BASE de números**
```
Menu → Opção 5
```

1. Crie um arquivo de texto (ex: `meus-numeros.txt`)
2. Coloque um número por linha:
   ```
   5511999887766
   5511988776655
   5521987654321
   ```
3. No menu, digite o caminho do arquivo
4. Todos os números serão importados de uma vez

**Quando usar:** Para adicionar muitos números de uma vez.

---

### **PASSO 4: Remover Números (se necessário)**
```
Menu → Opção 6
```

1. Veja a lista de números na campanha
2. Digite o número completo OU o índice para remover

**Exemplo:**
```
Números na campanha:
1. 5511999887766
2. 5511988776655
3. 5521987654321

Digite o número para remover: 2
```

O número `5511988776655` será removido.

---

### **PASSO 5: Definir Mensagens**
```
Menu → Opção 7
```

Você tem **duas opções**:

#### **Opção 1: Digitar manualmente**
```
Digite as mensagens (uma por linha, linha vazia para finalizar):

> Olá! Temos uma promoção especial para você hoje!
> Oi! Não perca nossas ofertas exclusivas!
> E aí! Chegaram novidades imperdíveis na loja!
> [ENTER vazio para finalizar]
```

#### **Opção 2: Carregar de arquivo**
1. Crie um arquivo `mensagens.txt`:
   ```
   Olá! Promoção especial hoje!
   Oi! Não perca essa oferta!
   E aí! Chegaram novidades!
   ```
2. No menu, escolha opção 2
3. Digite o caminho do arquivo

**Como funciona a alternância:**
- 1º destinatário → Mensagem 1
- 2º destinatário → Mensagem 2
- 3º destinatário → Mensagem 3
- 4º destinatário → Mensagem 1 (volta ao início)

---

### **PASSO 6: Ver Lista de Números**
```
Menu → Opção 8
```

Mostra todos os números da campanha com status:
- ✅ = Já enviado
- ⏳ = Pendente

**Exemplo:**
```
Total: 5 números

✅ 1. 5511999887766
✅ 2. 5511988776655
⏳ 3. 5521987654321
⏳ 4. 5511977665544
⏳ 5. 5511966554433
```

---

### **PASSO 7: Iniciar o Disparo**
```
Menu → Opção 9
```

1. Revise o resumo da campanha
2. Confirme digitando `s`
3. O disparo começará automaticamente

**O que acontece:**
- As mensagens começam a ser enviadas
- Você vê o progresso em tempo real
- A campanha é salva automaticamente

**⚠️ Importante:** O menu fica disponível enquanto o disparo roda!

---

### **PASSO 8: Controlar o Disparo**

Durante o disparo, você pode:

#### **Pausar**
```
Menu → Opção 10
```
- Para temporariamente
- Você pode adicionar/remover números
- Depois pode retomar de onde parou

#### **Retomar**
```
Menu → Opção 11
```
- Continua de onde parou
- Útil após adicionar mais números

#### **Parar Completamente**
```
Menu → Opção 12
```
- Para definitivamente
- O progresso é salvo
- Você pode ver os resultados

---

### **PASSO 9: Acompanhar Estatísticas**
```
Menu → Opção 13
```

Veja informações detalhadas:
```
📊 STATUS DA CAMPANHA

Nome: promocao-verao
Status: 🟢 RUNNING
Criada em: 22/10/2025 10:30:15

📊 Estatísticas:
   Total: 100
   ✅ Enviadas: 45
   ❌ Falhas: 2
   ⏳ Pendentes: 53

   Progresso: 47%
   Taxa de Sucesso: 95.74%
```

---

## 💾 Salvar e Carregar Campanhas

### **Auto-Save**
Toda campanha é automaticamente salva quando:
- Você inicia um disparo
- Você pausa/para o disparo
- Ocorre qualquer mudança importante

### **Carregar Campanha Salva**
```
Menu → Opção 3
```

1. Digite o nome da campanha que você criou antes
2. Ela será carregada com todos os dados:
   - Números (incluindo quais já foram enviados)
   - Mensagens
   - Status do último disparo
   - Estatísticas

**Útil para:**
- Retomar uma campanha depois
- Continuar de onde parou
- Revisar resultados antigos

---

## 📊 Listar Todas as Campanhas
```
Menu → Opção 14
```

Veja todas as campanhas criadas:
```
📋 TODAS AS CAMPANHAS

1. promocao-verao
   Status: 🟢 running
   Números: 100 | Enviadas: 45/100

2. lancamento-produto
   Status: ✅ completed
   Números: 50 | Enviadas: 48/50

3. pesquisa-clientes
   Status: ⏸️ paused
   Números: 200 | Enviadas: 87/200
```

---

## 🎓 Exemplo Completo - Do Zero ao Disparo

```bash
# 1. Iniciar o sistema
npm run client

# 2. Conectar WhatsApp
Opção: 1
ID: principal
[Escanear QR Code]

# 3. Criar campanha
Opção: 2
Nome: teste-inicial

# 4. Adicionar base de números
Opção: 5
Arquivo: numeros.txt

# 5. Definir mensagens
Opção: 7
Opção: 1
> Olá! Mensagem 1
> Oi! Mensagem 2
> [ENTER]

# 6. Ver números adicionados
Opção: 8

# 7. Iniciar disparo
Opção: 9
Confirmar: s

# 8. (DURANTE O DISPARO) Pausar se necessário
Opção: 10

# 9. (APÓS PAUSAR) Adicionar mais um número
Opção: 4
Número: 5511999887766

# 10. Retomar disparo
Opção: 11

# 11. Ver estatísticas
Opção: 13
```

---

## ⚠️ Regras Importantes

### **✅ PODE fazer durante o disparo:**
- Ver status (opção 13)
- Pausar (opção 10)
- Parar (opção 12)
- Ver lista de números (opção 8)

### **❌ NÃO PODE fazer durante o disparo:**
- Adicionar números
- Remover números
- Alterar mensagens

**Solução:** Pause o disparo primeiro (opção 10), faça as alterações, depois retome (opção 11).

---

## 🔧 Dicas Profissionais

### **1. Organize seus arquivos**
```
meu-projeto/
├── campanhas/
│   ├── numeros-clientes-vip.txt
│   ├── numeros-prospect.txt
│   └── mensagens-promocao.txt
└── [sistema]
```

### **2. Teste sempre**
Antes de um disparo grande:
1. Crie uma campanha de teste
2. Adicione apenas seus números
3. Execute o disparo completo
4. Verifique se tudo funciona

### **3. Use nomes descritivos**
❌ Ruim: `camp1`, `teste`, `abc`  
✅ Bom: `promocao-natal-2024`, `lancamento-produto-x`, `pesquisa-satisfacao`

### **4. Salve seu progresso**
- As campanhas são salvas automaticamente
- Arquivos ficam em `campaigns/[nome].json`
- Você pode copiar esses arquivos como backup

### **5. Monitore o progresso**
Use a opção 13 regularmente para ver:
- Quantas foram enviadas
- Quantas falharam
- Qual a taxa de sucesso

---

## 🆘 Problemas Comuns

### **"Campanha já existe"**
**Causa:** Você tentou criar uma campanha com nome repetido.  
**Solução:** Use outro nome ou carregue a existente (opção 3).

### **"Não é possível adicionar números enquanto rodando"**
**Causa:** A campanha está em execução.  
**Solução:** Pause primeiro (opção 10), adicione, depois retome (opção 11).

### **"Nenhuma sessão conectada"**
**Causa:** Você não conectou um WhatsApp.  
**Solução:** Use a opção 1 para conectar primeiro.

### **Números não chegam**
**Possíveis causas:**
1. Formato errado do número
2. Número não tem WhatsApp
3. WhatsApp bloqueou temporariamente

**Solução:** 
- Verifique o formato: `5511999887766`
- Teste com seu próprio número primeiro
- Use delays maiores (edite `.env`)

---

## 📞 Fluxo Visual

```
┌─────────────────────┐
│  1. Conectar WA     │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  2. Criar Campanha  │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
┌────▼────┐ ┌────▼──────┐
│ Adicionar│ │  Definir  │
│ Números  │ │ Mensagens │
└────┬────┘ └────┬──────┘
     └─────┬─────┘
           │
┌──────────▼──────────┐
│  Iniciar Disparo    │
└──────────┬──────────┘
           │
     ┌─────┼─────┐
     │     │     │
┌────▼─┐ ┌─▼──┐ ┌▼────┐
│Pausar│ │Ver │ │Parar│
└──────┘ └────┘ └─────┘
```

---

**Pronto!** Agora você domina o sistema de campanhas. Comece com campanhas pequenas e vá aumentando conforme ganha confiança! 🚀
