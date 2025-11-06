# 📱 Nexus Disparador - Guia Completo de Uso

> Sistema completo de disparo de mensagens WhatsApp com gerenciamento de campanhas, agendamento e multi-instâncias.

---

## 📑 Índice

1. [Primeiro Acesso](#1-primeiro-acesso)
2. [Conectar WhatsApp](#2-conectar-whatsapp)
3. [Criar e Gerenciar Campanhas](#3-criar-e-gerenciar-campanhas)
4. [Adicionar Contatos](#4-adicionar-contatos)
5. [Criar Mensagens](#5-criar-mensagens)
6. [Executar Disparo](#6-executar-disparo)
7. [Agendamento Automático](#7-agendamento-automático)
8. [Gerenciar Instâncias](#8-gerenciar-instâncias)
9. [Boas Práticas](#9-boas-práticas)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Primeiro Acesso

### 1.1. Criar Conta

1. Acesse a URL do sistema (ex: `https://seu-app.up.railway.app`)
2. Clique em **"Registrar"**
3. Preencha:
   - **Nome**: Seu nome ou empresa
   - **Email**: Seu email (será usado para login)
   - **Senha**: Mínimo 6 caracteres
4. Clique em **"Criar Conta"**
5. Você será redirecionado automaticamente para o dashboard

### 1.2. Fazer Login

1. Acesse a URL do sistema
2. Preencha:
   - **Email**: Seu email cadastrado
   - **Senha**: Sua senha
3. Clique em **"Entrar"**

### 1.3. Dashboard Inicial

Após o login, você verá:
- **Dashboard**: Visão geral do sistema
- **Conectar WhatsApp**: Gerenciar instâncias
- **Painel de Disparos**: Campanhas, execução e agendamento

---

## 2. Conectar WhatsApp

### 2.1. Criar Primeira Instância

1. No menu lateral, clique em **"Conectar WhatsApp"**
2. Clique no botão **"➕ Adicionar Instância"**
3. Uma nova instância será criada (Instância 1)

### 2.2. Gerar QR Code

1. No card da instância, clique em **"📱 Gerar QR Code"**
2. Aguarde 5-10 segundos até o QR Code aparecer
3. **No seu celular:**
   - Abra o **WhatsApp**
   - Vá em **Configurações** → **Aparelhos Conectados**
   - Toque em **"Conectar Aparelho"**
   - Escaneie o QR Code na tela do computador
4. Status mudará para **"✓ Conectado"**

### 2.3. Múltiplas Instâncias (Opcional)

**Por que usar múltiplas instâncias?**
- Distribuir envios entre vários números
- Aumentar capacidade de disparo
- Reduzir risco de bloqueio

**Como adicionar:**
1. Clique novamente em **"➕ Adicionar Instância"**
2. Repita o processo de gerar QR Code
3. Use um **número diferente** de WhatsApp para cada instância

**Exemplo:**
- Instância 1: WhatsApp pessoal (11) 99999-9999
- Instância 2: WhatsApp comercial (11) 88888-8888
- Instância 3: WhatsApp adicional (11) 77777-7777

---

## 3. Criar e Gerenciar Campanhas

### 3.1. Criar Nova Campanha

1. No menu lateral, clique em **"Painel de Disparos"**
2. Na aba **"📊 Campanhas"**, localize a seção "Criar Campanha"
3. Digite um nome para a campanha (ex: `promocao-black-friday`)
4. Clique em **"Criar Campanha"**
5. A campanha aparecerá na lista de campanhas disponíveis

**Dicas de nomenclatura:**
- Use nomes descritivos: `natal-2024`, `lancamento-produto`
- Evite espaços: use `-` ou `_`
- Seja específico: `clientes-vip` em vez de `campanha1`

### 3.2. Selecionar Campanha

1. No dropdown **"Selecionar Campanha"**, escolha a campanha criada
2. Agora você pode gerenciar contatos e mensagens dessa campanha

### 3.3. Visualizar Campanhas

Todas as campanhas criadas aparecem na lista lateral com:
- Nome da campanha
- Quantidade de contatos
- Quantidade de mensagens
- Status

---

## 4. Adicionar Contatos

Existem **3 formas** de adicionar contatos à campanha:

### 4.1. Adicionar Manualmente (Um por Vez)

1. Selecione a campanha no dropdown
2. Na seção **"Adicionar Contato"**:
   - **Nome**: Nome do contato (ex: João Silva)
   - **Telefone**: Formato completo com DDI + DDD + número
3. Clique em **"Adicionar Contato"**

**Formato do telefone:**
```
Brasil: 5511999999999
       ││└─ Número (9 dígitos)
       │└── DDD (11)
       └─── DDI (55)

Argentina: 5491123456789
EUA: 15551234567
```

### 4.2. Importar de Planilha (CSV/Excel)

**Formato da planilha:**

Crie uma planilha com 2 colunas:

| Nome | Telefone |
|------|----------|
| João Silva | 5511999999999 |
| Maria Costa | 5521988888888 |
| Pedro Santos | 5531977777777 |

**Passos:**
1. Clique em **"📤 Importar de Planilha"**
2. Selecione o arquivo (`.csv`, `.xlsx` ou `.xls`)
3. O sistema importará automaticamente todos os contatos
4. Você verá uma mensagem de confirmação com o total importado

**Dicas:**
- Primeira linha deve ter os cabeçalhos: `Nome` e `Telefone`
- Telefones sem formatação (apenas números)
- Salve como CSV UTF-8 para evitar problemas de acentuação

### 4.3. Importar de Arquivo de Texto

**Formato do arquivo:**

Crie um arquivo `.txt` com um número por linha:

```
5511999999999
5521988888888
5531977777777
5541966666666
```

**Passos:**
1. Clique em **"📄 Importar de Arquivo"**
2. Selecione o arquivo `.txt`
3. Contatos serão importados (nome será o próprio número)
4. Você pode editar os nomes depois

### 4.4. Gerenciar Contatos

Na tabela de contatos, você pode:

- **✏️ Editar**: Alterar nome ou telefone
- **🗑️ Remover**: Excluir da campanha
- **🔄 Reenviar**: Tentar enviar novamente (se falhou)
- **Ver Status**: 
  - ✅ **Enviado**: Mensagem entregue com sucesso
  - ⏳ **Pendente**: Aguardando envio
  - ❌ **Erro**: Falha no envio (número inválido, bloqueado, etc.)

---

## 5. Criar Mensagens

### 5.1. Adicionar Uma Mensagem

1. Selecione a campanha
2. Na seção **"Mensagens"**
3. Digite a mensagem no campo de texto
4. Clique em **"Adicionar Mensagem"**

**Exemplo:**
```
Olá! 👋

Temos uma promoção especial para você!
Aproveite 50% OFF em todos os produtos.

Válido até amanhã! 🔥
```

### 5.2. Adicionar Múltiplas Mensagens de Uma Vez

**Por que usar múltiplas mensagens?**
- Evita detecção de spam pelo WhatsApp
- Mensagens variadas parecem mais naturais
- Aumenta taxa de entrega

**Como fazer:**
1. Na seção **"Adicionar Múltiplas Mensagens"**
2. Cole várias mensagens no campo grande
3. **Uma mensagem por linha**
4. Clique em **"➕ Adicionar Todas as Mensagens"**

**Exemplo:**
```
Olá! Como vai? Temos uma novidade para você! 🎉

Oi! Tudo bem? Preparamos uma oferta especial! 💎

Olá! Que tal aproveitar nossa promoção exclusiva? 🚀

Oi! Não perca essa oportunidade incrível! ⭐

Olá! Temos algo especial preparado para você! 🎁
```

### 5.3. Usar Variáveis Dinâmicas

Personalize mensagens com variáveis:

**Variáveis disponíveis:**
- `{nome}` - Nome do contato
- `{telefone}` - Telefone do contato

**Exemplo:**
```
Olá {nome}! 👋

Temos uma oferta especial para você!

Seu número cadastrado: {telefone}

Aproveite! 🎉
```

**Resultado enviado:**
```
Olá João Silva! 👋

Temos uma oferta especial para você!

Seu número cadastrado: 5511999999999

Aproveite! 🎉
```

### 5.4. Gerenciar Mensagens

Na lista de mensagens:
- **Ver prévia**: Visualizar como ficará
- **🗑️ Remover**: Excluir mensagem
- **Ordem**: Sistema alterna entre as mensagens automaticamente

---

## 6. Executar Disparo

### 6.1. Configurar Delays (Intervalos)

Antes de iniciar, configure os intervalos entre envios:

1. Vá na aba **"🚀 Executar Disparo"**
2. Configure:
   - **⏳ Delay entre mensagens**: Tempo de espera após enviar cada mensagem
     - Mínimo: 1 segundo
     - Máximo: 360 segundos (6 minutos)
     - Recomendado: 3-5 segundos
   
   - **🔄 Delay entre números**: Tempo de espera entre contatos diferentes
     - Mínimo: 1 segundo
     - Máximo: 120 segundos (2 minutos)
     - Recomendado: 5-10 segundos

**Por que configurar delays?**
- ✅ Evita bloqueio pelo WhatsApp
- ✅ Parece mais natural (não é robô)
- ✅ Aumenta taxa de entrega
- ⚠️ Delays muito curtos podem resultar em ban

### 6.2. Iniciar Disparo

1. Selecione a **campanha** no dropdown
2. Verifique os delays configurados
3. Clique em **"▶ Iniciar Disparo"**
4. Confirme a ação no popup

### 6.3. Acompanhar Progresso

Durante o disparo, você verá:

**Barra de Progresso:**
- Porcentagem concluída
- Barra visual colorida

**Estatísticas Gerais:**
- 📊 **Total**: Quantidade total de contatos
- ✅ **Enviados**: Mensagens entregues com sucesso
- ⏳ **Pendentes**: Aguardando envio
- ❌ **Falhas**: Erros no envio
- 📈 **Taxa de Sucesso**: Porcentagem de sucesso

**Estatísticas por Instância:**

Cards individuais mostrando desempenho de cada número conectado:

```
┌─────────────────────┐  ┌─────────────────────┐
│ [1] Instância 1     │  │ [2] Instância 2     │
│ 45 envios           │  │ 38 envios           │
│                     │  │                     │
│ ✅ 43  ❌ 2         │  │ ✅ 36  ❌ 2         │
│ Taxa: 95.6%         │  │ Taxa: 94.7%         │
└─────────────────────┘  └─────────────────────┘
```

### 6.4. Controles Durante o Disparo

**⏸ Pausar:**
- Para o disparo temporariamente
- Contatos já enviados não são afetados
- Pode retomar depois

**▶ Retomar:**
- Continua de onde parou
- Mantém estatísticas
- Respeita os delays configurados

**⏹ Parar:**
- Encerra definitivamente o disparo
- Não pode ser retomado
- Estatísticas são salvas

---

## 7. Agendamento Automático

### 7.1. Configurar Agendamento

1. Vá na aba **"⏰ Agendamento"**
2. Preencha:
   - **Campanha**: Selecione qual campanha agendar
   - **Dias da semana**: Marque os dias (seg-dom)
   - **Horário de início**: Quando começar (ex: 09:00)
   - **Horário de pausa**: Quando pausar (ex: 12:00)
   - **Horário de retomada**: Quando continuar (ex: 14:00)
   - **Horário de parada**: Quando parar (ex: 18:00)
3. Clique em **"Salvar Agendamento"**

### 7.2. Exemplo de Configuração

**Cenário: Envios comerciais em horário comercial**

```
Campanha: promocao-semanal
Dias: Segunda a Sexta
Horários:
  09:00 - Inicia disparo
  12:00 - Pausa (horário de almoço)
  14:00 - Retoma disparo
  18:00 - Para definitivamente

Fim de semana: Não envia
```

**Resultado:**
- Sistema envia automaticamente de seg-sex
- Pausa no almoço (12h-14h)
- Não envia à noite nem fim de semana
- Você não precisa fazer nada manualmente

### 7.3. Gerenciar Agendamentos

Na lista de agendamentos ativos:
- Ver configuração completa
- Editar horários
- Desativar temporariamente
- Excluir agendamento

---

## 8. Gerenciar Instâncias

### 8.1. Desconectar Instância

**Quando desconectar?**
- Trocar de número
- Manutenção
- Problema de conexão

**Como fazer:**
1. No card da instância, clique em **"📵 Desconectar"**
2. Confirme a ação
3. Status muda para "Desconectado"
4. Sessão do WhatsApp é encerrada

### 8.2. Reconectar Instância

1. Clique em **"📱 Gerar QR Code"**
2. Escaneie novamente com o WhatsApp
3. Instância volta a funcionar
4. Campanhas não são afetadas

### 8.3. Remover Instância

**⚠️ Atenção:** Ação permanente!

**Passos:**
1. **Primeiro desconecte** a instância
2. Clique em **"🗑️ Remover Instância"**
3. Confirme a exclusão
4. Instância é deletada permanentemente

**Nota:** Não é possível remover instância conectada (precisa desconectar primeiro)

### 8.4. Status das Instâncias

- **✓ Conectado** (verde): Funcionando normalmente
- **⏳ Aguardando** (amarelo): Gerando QR Code
- **❌ Desconectado** (vermelho): Precisa reconectar
- **🔄 Reconectando** (azul): Tentando reconectar

---

## 9. Boas Práticas

### 9.1. Delays Recomendados

| Cenário | Delay entre Mensagens | Delay entre Números |
|---------|----------------------|---------------------|
| **Envio Rápido** | 3-5 segundos | 5-8 segundos |
| **Envio Seguro** | 5-10 segundos | 10-15 segundos |
| **Envio Conservador** | 10-30 segundos | 20-60 segundos |
| **Envio Muito Espaçado** | 60-360 segundos | 60-120 segundos |

### 9.2. Limites Diários

**Por número de WhatsApp:**
- ✅ Máximo: 500 mensagens/dia
- ✅ Recomendado: 300-400 mensagens/dia
- ⚠️ Evite ultrapassar limites

**Com múltiplas instâncias:**
- 3 instâncias = até 1.200 mensagens/dia
- 5 instâncias = até 2.000 mensagens/dia

### 9.3. Horários Ideais

**✅ Melhores horários:**
- 09:00 - 12:00 (manhã)
- 14:00 - 18:00 (tarde)
- 19:00 - 21:00 (noite)

**❌ Evite:**
- 00:00 - 08:00 (madrugada/manhã cedo)
- 22:00 - 23:59 (noite tarde)
- Domingos e feriados (depende do público)

### 9.4. Conteúdo das Mensagens

**✅ Faça:**
- Use múltiplas mensagens variadas
- Personalize com variáveis `{nome}`
- Seja objetivo e claro
- Use emojis moderadamente
- Inclua call-to-action

**❌ Evite:**
- Mensagens idênticas repetidas
- Spam ou conteúdo enganoso
- Links suspeitos ou encurtados demais
- CAPS LOCK excessivo
- Enviar para quem não autorizou

### 9.5. Múltiplas Instâncias

**Estratégia de distribuição:**
- Sistema distribui automaticamente (round-robin)
- Cada instância envia para contatos diferentes
- Balanceamento de carga automático

**Exemplo com 3 instâncias e 300 contatos:**
- Instância 1: ~100 contatos
- Instância 2: ~100 contatos
- Instância 3: ~100 contatos

---

## 10. Troubleshooting

### 10.1. QR Code Não Aparece

**Soluções:**
1. Aguarde 10-15 segundos
2. Recarregue a página (F5)
3. Clique em "Gerar QR Code" novamente
4. Verifique conexão com internet
5. Limpe cache do navegador

### 10.2. Instância Desconecta Sozinha

**Causas comuns:**
- Servidor reiniciou (normal no Railway)
- WhatsApp desconectou no celular
- Conexão instável

**Solução:**
1. Clique em "Gerar QR Code"
2. Escaneie novamente
3. Dados da campanha não são perdidos

### 10.3. Mensagens Não Enviam

**Verifique:**
- ✅ Instância está conectada (status verde)
- ✅ Formato do telefone correto (DDI+DDD+número)
- ✅ Não atingiu limite diário (500/dia)
- ✅ Número não está bloqueado
- ✅ WhatsApp ativo no celular

**Soluções:**
1. Teste com seu próprio número primeiro
2. Verifique logs de erro
3. Reduza velocidade (aumente delays)
4. Use múltiplas instâncias

### 10.4. Taxa de Sucesso Baixa

**Causas:**
- Números inválidos ou desativados
- Delays muito curtos
- Muitas mensagens em pouco tempo
- Conteúdo considerado spam

**Soluções:**
1. Valide números antes de importar
2. Aumente delays entre envios
3. Use múltiplas mensagens variadas
4. Distribua em múltiplas instâncias
5. Respeite limites diários

### 10.5. Erro "Não foi possível fazer login"

**Causas:**
- Credenciais incorretas
- Conta não existe
- Problema com Firebase

**Soluções:**
1. Verifique email e senha
2. Use "Esqueci minha senha" (se disponível)
3. Crie nova conta se necessário
4. Limpe cache: `Ctrl + Shift + Delete`
5. Tente em modo anônimo

### 10.6. Campanha Não Aparece

**Soluções:**
1. Recarregue a página
2. Verifique se criou a campanha
3. Selecione no dropdown
4. Faça logout e login novamente

### 10.7. Importação de Planilha Falha

**Verifique:**
- Formato correto (CSV, XLSX, XLS)
- Colunas: "Nome" e "Telefone"
- Telefones apenas números (sem espaços ou caracteres)
- Encoding UTF-8 (para acentos)

**Exemplo correto:**
```csv
Nome,Telefone
João Silva,5511999999999
Maria Costa,5521988888888
```

---

## 📊 Fluxo Completo Resumido

```
1. Login/Registro
   ↓
2. Conectar WhatsApp (Gerar QR Code)
   ↓
3. Criar Campanha
   ↓
4. Adicionar Contatos (manual/planilha/arquivo)
   ↓
5. Adicionar Mensagens (uma ou múltiplas)
   ↓
6. Configurar Delays
   ↓
7. Executar Disparo
   ↓
8. Acompanhar Estatísticas
   ↓
9. (Opcional) Configurar Agendamento
```

---

## 🎯 Casos de Uso Práticos

### Caso 1: Envio Simples e Rápido

**Cenário:** 100 contatos, mensagem única, envio imediato

```
1. Conectar 1 instância
2. Criar campanha "teste-rapido"
3. Importar 100 contatos via Excel
4. Adicionar 1 mensagem
5. Delays: 3s (mensagens) / 5s (números)
6. Iniciar disparo
7. Tempo estimado: ~10 minutos
```

### Caso 2: Envio em Larga Escala

**Cenário:** 1.000 contatos, múltiplas mensagens, distribuído

```
1. Conectar 3 instâncias (3 números diferentes)
2. Criar campanha "black-friday"
3. Importar 1.000 contatos
4. Adicionar 5 mensagens variadas
5. Delays: 5s (mensagens) / 10s (números)
6. Configurar agendamento (seg-sex, 9h-18h)
7. Sistema envia automaticamente
8. Tempo estimado: ~2-3 dias
```

### Caso 3: Multi-Tenant (Agência)

**Cenário:** Vários clientes, dados isolados

```
Cliente A:
- Login: cliente-a@email.com
- 2 instâncias próprias
- 3 campanhas ativas
- 500 contatos

Cliente B:
- Login: cliente-b@email.com
- 1 instância própria
- 1 campanha ativa
- 200 contatos

✅ Dados completamente isolados!
✅ Cada cliente vê apenas seus dados
```

---

## 🔒 Segurança e Privacidade

- ✅ Autenticação via Firebase (Google)
- ✅ Dados isolados por usuário (multi-tenant)
- ✅ Sessões WhatsApp criptografadas
- ✅ Senhas nunca armazenadas em texto plano
- ✅ HTTPS obrigatório em produção

---

## 📞 Suporte

**Problemas ou dúvidas?**
- Consulte este guia primeiro
- Verifique a seção [Troubleshooting](#10-troubleshooting)
- Entre em contato com o administrador do sistema

---

## 📝 Changelog

**Versão Atual:**
- ✅ Firebase Authentication (persistência garantida)
- ✅ Múltiplas instâncias com estatísticas individuais
- ✅ Controle de delays personalizados (até 6 minutos)
- ✅ Adicionar múltiplas mensagens de uma vez
- ✅ Interface consolidada "Painel de Disparos"
- ✅ Sistema multi-tenant completo

---

**🎉 Pronto para usar o Nexus Disparador!**

Siga este guia passo a passo e aproveite todas as funcionalidades do sistema.
