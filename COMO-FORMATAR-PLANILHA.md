# 📊 Como Formatar Planilha Corretamente

## ⚠️ Problema: Notação Científica no Excel

Quando você digita números longos (como telefones) no Excel, ele automaticamente converte para notação científica:

```
❌ 5511999887766  →  5,59E+12
```

Isso faz com que o sistema não reconheça como número de telefone.

---

## ✅ Solução 1: Formatar Coluna como Texto (RECOMENDADO)

### **Passo a Passo:**

1. **Abra o Excel**
2. **ANTES de digitar os números**, selecione a coluna A
3. Clique com botão direito → **Formatar Células**
4. Escolha **"Texto"**
5. Clique OK
6. **Agora** digite os números

### **Visual:**
```
A1: phone
A2: 5511999887766  (como texto)
A3: 5511988776655  (como texto)
A4: 5521987654321  (como texto)
```

---

## ✅ Solução 2: Adicionar Aspas Simples

Digite uma aspas simples (`'`) antes do número:

```
A1: phone
A2: '5511999887766
A3: '5511988776655
A4: '5521987654321
```

A aspas força o Excel a tratar como texto, mas ela não aparece no arquivo final.

---

## ✅ Solução 3: Usar CSV (Mais Simples)

### **No Bloco de Notas:**
```
phone
5511999887766
5511988776655
5521987654321
```

Salvar como: `numeros.csv`

**Vantagem:** CSV não tem formatação, então nunca converte para notação científica.

---

## ✅ Solução 4: Corrigir Planilha Existente

Se você já digitou e está em notação científica:

### **Método A: Copiar como Texto**
1. Selecione as células com notação científica
2. Copie (Ctrl+C)
3. Cole no Bloco de Notas
4. Copie novamente do Bloco de Notas
5. No Excel, formate a coluna como TEXTO
6. Cole os valores

### **Método B: Usar Fórmula**
1. Na coluna B, digite: `=TEXT(A2;"0")`
2. Arraste para baixo
3. Copie a coluna B
4. Cole como **Valores** na coluna A
5. Delete a coluna B

---

## 📝 Template Correto

### **Para Números:**

| Coluna A (formatada como TEXTO) |
|---------------------------------|
| phone                           |
| 5511999887766                   |
| 5511988776655                   |
| 5521987654321                   |

### **Para Mensagens:**

| Coluna A |
|----------|
| message  |
| Olá! Esta é a mensagem 1 |
| Oi! Esta é a mensagem 2 |
| E aí! Esta é a mensagem 3 |

---

## 🎯 Dica Profissional

**Use o Template:**
1. Baixe o template direto da interface web
2. Clique em **"Baixar Template de Números"**
3. O arquivo já vem formatado corretamente
4. Apenas adicione seus números

---

## 🔍 Como Verificar se Está Correto

### **✅ Correto:**
```
5511999887766  (sem vírgulas, sem pontos, sem E+12)
```

### **❌ Errado:**
```
5,59E+12       (notação científica)
55.11.999887766 (com pontos)
55 11 999887766 (com espaços)
```

---

## 🆘 Ainda Não Funciona?

### **Teste Rápido:**
1. Crie um arquivo `teste.txt`
2. Coloque:
   ```
   phone
   5511999887766
   ```
3. Salve e renomeie para `teste.csv`
4. Faça upload
5. Se funcionar, o problema é a formatação do Excel

---

## 💡 Resumo

### **Para Números no Excel:**
1. **SEMPRE** formate a coluna como TEXTO antes de digitar
2. Ou use aspas simples: `'5511999887766`
3. Ou use CSV (Bloco de Notas)

### **Para Mensagens:**
- Qualquer formato funciona (texto é o padrão)

---

## 📊 Exemplos Práticos

### **Arquivo Excel (.xlsx) Correto:**
```
Coluna A formatada como TEXTO
─────────────────────────────
phone
5511999887766
5511988776655
5521987654321
5511977665544
```

### **Arquivo CSV (.csv) Correto:**
```
phone
5511999887766
5511988776655
5521987654321
5511977665544
```

### **Arquivo de Mensagens (.csv) Correto:**
```
message
Olá! Temos uma promoção especial para você!
Oi! Não perca nossas ofertas exclusivas!
E aí! Chegaram novidades imperdíveis!
```

---

## 🎓 Vídeo Tutorial (Passo a Passo)

1. Abra Excel → Nova planilha
2. Selecione coluna A → Botão direito → Formatar células → Texto
3. Digite "phone" em A1
4. A partir de A2, digite os números normalmente
5. Salve como .xlsx ou .csv
6. Faça upload na interface web
7. Veja o modal com os números reconhecidos! ✅

---

**Problema resolvido!** 🎉

Agora seus números serão carregados corretamente e você verá um modal com a confirmação de todos os números válidos.
