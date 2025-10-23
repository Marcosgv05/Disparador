# 📱🕐 Guia: Múltiplas Instâncias e Agendamento Automático

## 🎯 Visão Geral

O sistema agora suporta:
1. **Múltiplas Instâncias** - Conecte vários chips/números simultaneamente
2. **Agendamento Automático** - Configure horários para iniciar, pausar e parar campanhas

---

## 📱 Sistema de Múltiplas Instâncias

### **O Que São Instâncias?**

Cada instância = 1 número de WhatsApp conectado

**Benefícios:**
- ✅ Disparo simultâneo com múltiplos números
- ✅ Maior velocidade de envio
- ✅ Distribuição de carga
- ✅ Backup automático (se uma falha, outras continuam)

---

### **Como Usar**

#### **1. Adicionar Nova Instância**

1. Vá em **"Instâncias WhatsApp"** no menu
2. Clique em **"Adicionar Nova Instância"**
3. Um novo slot aparece

#### **2. Conectar Instância**

1. Clique em **"Conectar"** no slot
2. Digite um ID único (ex: `chip1`, `numero-principal`)
3. QR Code aparece no próprio slot
4. Escaneie com o WhatsApp
5. Status muda para **"✅ Conectado"**

#### **3. Gerenciar Instâncias**

**Desconectar:**
- Botão "Desconectar" no slot
- Mantém o slot para reconectar depois

**Remover:**
- Botão "Remover"
- Exclui completamente o slot

---

### **Exemplo Visual**

```
┌─────────────────────────────┐
│ Instância 1                  │
│ ✅ Conectado                 │
│ 📱 5511999887766             │
│ [Desconectar] [Remover]      │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Instância 2                  │
│ 🔄 Conectando                │
│ [QR CODE]                    │
│          [Remover]           │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Instância 3                  │
│ ⚪ Desconectado              │
│ [Conectar] [Remover]         │
└─────────────────────────────┘
```

---

### **Casos de Uso**

#### **Uso 1: Velocidade**
- 1 instância: 100 msgs/hora
- 5 instâncias: 500 msgs/hora

#### **Uso 2: Segmentação**
- Instância 1: Clientes zona norte
- Instância 2: Clientes zona sul
- Instância 3: Clientes VIP

#### **Uso 3: Redundância**
- Se uma instância cai, outras continuam

---

## 🕐 Agendamento Automático

### **O Que É?**

Configure horários para a campanha iniciar, pausar e parar automaticamente.

**Ideal para:**
- ✅ Horário comercial (9h às 18h)
- ✅ Pausar no almoço
- ✅ Não enviar finais de semana
- ✅ Respeitar horários dos clientes

---

### **Como Configurar**

#### **1. Acessar Agendamento**

1. Menu → **"Agendamento"**
2. Selecione a campanha

#### **2. Configurar Horários**

**🕐 Horário de Início (Obrigatório)**
- Exemplo: `09:00`
- Campanha inicia automaticamente

**⏸️ Horário de Pausa (Opcional)**
- Exemplo: `12:00`
- Pausa temporária (ex: almoço)

**⏹️ Horário de Parada (Opcional)**
- Exemplo: `18:00`
- Para completamente (fim do expediente)

**🔄 Retomar Automaticamente**
- Se marcado: retoma após pausa
- Se desmarcado: fica pausado até você retomar manualmente

#### **3. Selecionar Dias**

Escolha em quais dias executar:
- **Seg-Sex**: Dias úteis
- **Sáb-Dom**: Finais de semana
- Ou qualquer combinação

#### **4. Ativar/Desativar**

Toggle no topo:
- **ON** ✅: Agendamento ativo
- **OFF** ⏸️: Agendamento desabilitado (campanha fica manual)

---

### **Exemplos Práticos**

#### **Exemplo 1: Horário Comercial**

```
Início: 09:00
Pausa: 12:00
Parada: 18:00
Dias: Seg, Ter, Qua, Qui, Sex
Retomar: ✅ Sim
```

**Resultado:**
- 09:00 → Inicia disparo
- 12:00 → Pausa (almoço)
- 13:00 → Retoma automaticamente
- 18:00 → Para completamente

#### **Exemplo 2: Apenas Manhã**

```
Início: 08:00
Parada: 12:00
Dias: Todos
Retomar: N/A
```

**Resultado:**
- 08:00 → Inicia
- 12:00 → Para
- Próximo dia: repete

#### **Exemplo 3: 24/7 com Pausas**

```
Início: 00:00
Pausa: 22:00
Dias: Todos
Retomar: ✅ Sim
```

**Resultado:**
- 00:00 → Inicia
- 22:00 → Pausa
- 00:01 → Retoma

---

### **Preview em Tempo Real**

Ao configurar, você vê um resumo:

```
📋 Resumo do Agendamento

🕐 Início Automático
   Campanha inicia às 09:00

⏸️ Pausa Automática
   Pausa às 12:00

⏹️ Parada Automática
   Para completamente às 18:00
```

---

## 🔄 Como Funciona (Técnico)

### **Scheduler**

- Verifica a cada **1 minuto**
- Compara hora atual com horários configurados
- Executa ações automaticamente:
  - `startCampaign()`
  - `pauseCampaign()`
  - `resumeCampaign()`
  - `stopCampaign()`

### **Persistência**

- Agendamentos salvos em `schedules.json`
- Sobrevivem a reinicializações do servidor
- Sincronizados com campanhas

---

## 📊 Visualização de Agendamentos

Na seção "Agendamentos Ativos", você vê todos configurados:

```
┌────────────────────────────────────┐
│ promocao-natal          ✅ Ativo   │
│ 🕐 Início: 09:00                   │
│ ⏸️ Pausa: 12:00                    │
│ ⏹️ Parada: 18:00                   │
│ 📅 Dias: Seg, Ter, Qua, Qui, Sex   │
└────────────────────────────────────┘
```

---

## 🎯 Cenários de Uso Combinados

### **Cenário 1: Multi-Instância + Agendamento**

**Setup:**
- 3 instâncias conectadas
- Agendamento: 9h-18h, Seg-Sex

**Resultado:**
- 09:00: Sistema inicia automaticamente
- Disparo distribuído entre 3 números
- 12:00: Pausa automática
- 13:00: Retoma automaticamente
- 18:00: Para automaticamente
- Sáb-Dom: Não executa

### **Cenário 2: Failover Automático**

**Setup:**
- 5 instâncias
- 1 instância cai

**Resultado:**
- Sistema continua com 4 instâncias
- Sem interrupção no disparo
- Você pode reconectar a que caiu

### **Cenário 3: Campanha Noturna**

**Setup:**
- 1 instância
- Agendamento: 22:00-06:00

**Resultado:**
- Disparo durante madrugada
- Ideal para fusos diferentes
- Para antes do horário comercial

---

## ⚙️ Configuração Avançada

### **Arquivo: `schedules.json`**

```json
[
  [
    "promocao-natal",
    {
      "campaignName": "promocao-natal",
      "enabled": true,
      "startTime": "09:00",
      "pauseTime": "12:00",
      "stopTime": "18:00",
      "days": [1, 2, 3, 4, 5],
      "timezone": "America/Sao_Paulo",
      "autoResume": true
    }
  ]
]
```

**Edição Manual:**
- Você pode editar diretamente
- Reinicie o servidor para aplicar

---

## 🆘 Troubleshooting

### **"Agendamento não executa"**

**Verifique:**
1. Toggle está **ON** ✅
2. Dia da semana está selecionado
3. Horário está correto (formato 24h)
4. Servidor está rodando

### **"Instância não conecta"**

**Verifique:**
1. QR Code não expirou (60s)
2. WhatsApp no celular está aberto
3. Internet estável
4. ID da sessão é único

### **"Campanha não pausa no horário"**

**Motivo:**
- Scheduler verifica a cada minuto
- Pode ter atraso de até 1 minuto

**Solução:**
- Configurar horário com 1 min de margem

---

## 📝 Boas Práticas

### **Instâncias**

✅ **Fazer:**
- Use IDs descritivos (`chip1`, `numero-vendas`)
- Teste com 1 instância primeiro
- Aumente gradualmente

❌ **Evitar:**
- IDs genéricos (`teste`, `abc`)
- Muitas instâncias simultaneamente no início
- Reconectar rapidamente (espere 5 min)

### **Agendamento**

✅ **Fazer:**
- Respeite horários comerciais
- Use pausa para almoço
- Configure dias úteis

❌ **Evitar:**
- Horários noturnos sem necessidade
- Disparos em finais de semana (clientes)
- Sem parada definida (pode esgotar lista)

---

## 🚀 Início Rápido

### **Setup Básico (5 min)**

```bash
# 1. Inicie o servidor
npm run web

# 2. Acesse
http://localhost:3000

# 3. Adicione instância
Menu → Instâncias WhatsApp → Adicionar Nova Instância

# 4. Conecte
Clique "Conectar" → Escaneie QR Code

# 5. Configure agendamento
Menu → Agendamento → Selecione campanha
Início: 09:00
Pausa: 12:00
Parada: 18:00
Dias: Seg-Sex
Salvar

# 6. Pronto!
Sistema opera automaticamente
```

---

## 🎓 Tutoriais em Vídeo (Sugeridos)

1. **Como adicionar múltiplas instâncias** (2 min)
2. **Configurar agendamento passo a passo** (3 min)
3. **Cenário real: horário comercial** (5 min)

---

## 📞 Suporte

**Dúvidas Comuns:**
- [GUIA-WEB.md](GUIA-WEB.md) - Interface geral
- [README.md](README.md) - Visão geral do projeto
- [ARQUITETURA.md](ARQUITETURA.md) - Detalhes técnicos

---

## 🎉 Recursos Principais

### **✨ Novidades**

1. **Slots Visuais** - Veja todas as instâncias de uma vez
2. **QR Code no Slot** - Não precisa sair da tela
3. **Status em Tempo Real** - Conectado, conectando, desconectado
4. **Preview de Agendamento** - Veja como ficará antes de salvar
5. **Timeline Visual** - Entenda o fluxo do dia
6. **Toggle Rápido** - Ative/desative agendamento em 1 clique
7. **Seletor de Dias** - Interface intuitiva

---

**Sistema completo de múltiplas instâncias e agendamento automático pronto!** 🚀

Agora você pode:
- ✅ Conectar quantos números quiser
- ✅ Agendar campanhas para rodar sozinhas
- ✅ Respeitar horários comerciais automaticamente
- ✅ Escalar seus disparos facilmente
