# Manual do Usuário - Arauto

## Sistema de Campanhas WhatsApp

---

## 1. PRIMEIROS PASSOS

### 1.1 Criando sua Conta

1. Acesse a página de login do sistema
2. Clique em **"Criar Conta"**
3. Preencha os campos:
   - Nome Completo
   - E-mail
   - Senha (mínimo 6 caracteres)
   - Confirmar Senha
4. Clique em **"Criar Minha Conta"**
5. Aguarde o redirecionamento para o painel principal

### 1.2 Fazendo Login

1. Acesse a página de login
2. Digite seu e-mail cadastrado
3. Digite sua senha
4. Clique em **"Entrar na plataforma"**

---

## 2. CONECTANDO O WHATSAPP

### 2.1 Adicionando uma Instância

1. No menu lateral, clique em **"Conexões"**
2. Clique no botão **"Adicionar Instância"**
3. Um QR Code será exibido na tela
4. Abra o WhatsApp no seu celular
5. Vá em **Configurações > Aparelhos Conectados > Conectar Aparelho**
6. Escaneie o QR Code com a câmera do celular
7. Aguarde a conexão ser estabelecida

### 2.2 Verificando Status da Conexão

- **Verde (Conectado)**: Celular online e pronto para envio
- **Amarelo (Aguardando)**: Esperando leitura do QR Code
- **Vermelho (Desconectado)**: Necessário reconectar

> **IMPORTANTE**: Mantenha o celular conectado à internet durante os disparos.

---

## 3. CRIANDO CAMPANHAS

### 3.1 Nova Campanha

1. No menu lateral, clique em **"Campanhas"**
2. Clique no botão **"+ Criar Campanha"**
3. Digite um nome para identificar sua campanha
4. Clique em **"Criar"**

### 3.2 Adicionando Contatos

1. Selecione a campanha desejada
2. Clique na aba **"Contatos"**
3. Para importar lista:
   - Clique em **"Importar Planilha"**
   - Selecione um arquivo CSV ou Excel
   - Aguarde o processamento
4. Para adicionar manualmente:
   - Clique em **"Adicionar Manual"**
   - Preencha nome e telefone

> **FORMATO DO TELEFONE**: Use código do país + DDD + número, sem o 9 extra.  
> Exemplo: 5585912345678

### 3.3 Criando Mensagens

1. Selecione a campanha
2. Clique na aba **"Mensagens"**
3. No editor, digite sua mensagem
4. Use as variáveis disponíveis:
   - `{{nome}}` - Será substituído pelo nome do contato
   - `{{telefone}}` - Será substituído pelo telefone
   - `{{custom1}}` - Campo personalizado da planilha
5. Clique em **"Salvar Mensagem"**

### 3.4 Anexando Mídia (Opcional)

1. Na aba "Mensagens", clique em **"Anexar Mídia"**
2. Selecione uma imagem ou vídeo do seu computador
3. A mídia será enviada junto com todas as mensagens

---

## 4. CONFIGURANDO O DISPARO

### 4.1 Vinculando Instâncias

1. Na aba **"Disparo"**, clique em **"Gerenciar"**
2. Marque quais números de WhatsApp serão usados
3. Clique em **"Salvar"**

### 4.2 Configurações de Envio

| Configuração | Descrição |
|--------------|-----------|
| Intervalo máximo | Tempo máximo entre mensagens (recomendado: 15-30 seg) |
| Pausa após X mensagens | Sistema pausa após enviar determinada quantidade |
| Tempo de pausa | Duração da pausa em minutos |
| Digitando... | Simula que está digitando antes de enviar |

### 4.3 Agendamento (Opcional)

1. Ative a opção **"Agendamento de Disparos"**
2. Defina o horário de início e término
3. Marque os dias da semana para envio
4. O sistema iniciará e pausará automaticamente nos horários definidos

---

## 5. INICIANDO O DISPARO

### 5.1 Passo a Passo

1. Verifique se há uma instância conectada (indicador verde)
2. Verifique se há contatos na campanha
3. Verifique se há mensagens configuradas
4. Clique no botão **"Iniciar Disparos"**
5. Acompanhe o progresso no console de execução

### 5.2 Controles Durante o Disparo

- **Pausar**: Interrompe temporariamente o envio
- **Retomar**: Continua de onde parou
- **Parar**: Encerra completamente a campanha

---

## 6. ACOMPANHANDO RESULTADOS

### 6.1 Dashboard

O painel principal exibe:
- Total de campanhas ativas
- Mensagens enviadas
- Números na base
- Falhas no período

### 6.2 Aba Visão Geral da Campanha

- Estatísticas da campanha selecionada
- Gráfico de atividade por hora
- Status de cada contato

---

## 7. DICAS IMPORTANTES

### Para Evitar Bloqueios

1. ✅ Use delays maiores entre mensagens (mínimo 15 segundos)
2. ✅ Crie múltiplas variações de mensagem
3. ✅ Evite enviar para números desconhecidos em massa
4. ✅ Conecte múltiplas instâncias para distribuir o envio
5. ✅ Respeite os horários comerciais
6. ❌ Não envie mensagens idênticas repetidamente
7. ❌ Não ultrapasse 500 mensagens por dia por chip

### Boas Práticas

- Sempre teste com poucos números antes de disparos grandes
- Monitore a taxa de erros no console
- Se o sistema pausar automaticamente, aguarde antes de retomar

---

## 8. SOLUÇÃO DE PROBLEMAS

| Problema | Solução |
|----------|---------|
| QR Code não aparece | Recarregue a página e tente novamente |
| WhatsApp desconectou | Verifique a internet do celular e reconecte |
| Mensagens não enviando | Confirme se a instância está conectada |
| Erro "Número inválido" | Verifique o formato do telefone |
| Sistema muito lento | Aumente o intervalo entre mensagens |

---

## 9. SUPORTE

Em caso de dúvidas ou problemas técnicos, entre em contato através dos canais oficiais de suporte.

---

**Arauto** - Sistema de Campanhas WhatsApp  
Versão 1.0 | 2025
