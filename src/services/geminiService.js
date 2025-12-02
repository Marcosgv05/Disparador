import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../config/logger.js';

/**
 * Serviço de integração com Google Gemini para geração de variações de mensagens
 */
class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
  }

  /**
   * Inicializa o cliente Gemini
   */
  initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      logger.warn('⚠️ GEMINI_API_KEY não configurada. Funcionalidade de IA desabilitada.');
      return false;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Usando Gemini 2.5 Flash (mais rápido e econômico)
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash-lite',
        generationConfig: {
          temperature: 0.9, // Mais criativo para variações
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        }
      });
      this.initialized = true;
      logger.info('✅ Gemini AI inicializado com sucesso');
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao inicializar Gemini: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica se o serviço está disponível
   */
  isAvailable() {
    return this.initialized && this.model !== null;
  }

  /**
   * Gera variações de uma mensagem base
   * @param {string} baseMessage - Mensagem original
   * @param {number} count - Número de variações (padrão: 10)
   * @param {object} options - Opções adicionais
   * @returns {Promise<string[]>} Array com as variações geradas
   */
  async generateVariations(baseMessage, count = 10, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Serviço de IA não está disponível. Configure GEMINI_API_KEY.');
    }

    if (!baseMessage || baseMessage.trim().length === 0) {
      throw new Error('Mensagem base é obrigatória');
    }

    const { preserveVariables = true, tone = 'original' } = options;

    // Detecta variáveis na mensagem ({{variavel}} ou {variavel})
    const variablePattern = /\{\{?\w+\}?\}/g;
    const variables = baseMessage.match(variablePattern) || [];
    
    let variableInstruction = '';
    if (preserveVariables && variables.length > 0) {
      variableInstruction = `
IMPORTANTE: A mensagem contém variáveis dinâmicas que DEVEM ser mantidas EXATAMENTE como estão em TODAS as variações:
${variables.join(', ')}

Essas variáveis serão substituídas por dados reais (nome do cliente, telefone, etc), então NÃO altere, traduza ou remova nenhuma delas.`;
    }

    let toneInstruction = '';
    if (tone !== 'original') {
      const tones = {
        formal: 'Use um tom mais formal e profissional.',
        informal: 'Use um tom mais informal e descontraído.',
        friendly: 'Use um tom amigável e acolhedor.',
        urgent: 'Use um tom que transmita urgência.',
        persuasive: 'Use um tom persuasivo e convincente.'
      };
      toneInstruction = tones[tone] || '';
    }

    const prompt = `Você é um especialista em copywriting e comunicação via WhatsApp. Sua tarefa é criar ${count} variações únicas de uma mensagem de marketing/vendas, mantendo o mesmo significado e intenção, mas com palavras e estruturas diferentes.

MENSAGEM ORIGINAL:
"${baseMessage}"

${variableInstruction}

${toneInstruction}

REGRAS:
1. Crie exatamente ${count} variações diferentes
2. Mantenha o mesmo significado e call-to-action da mensagem original
3. Varie a estrutura das frases, sinônimos e abordagem
4. Mantenha um tamanho similar à mensagem original (no mínimo cerca de 80% do número de caracteres da mensagem original). NÃO gere mensagens muito curtas.
5. Use linguagem natural para WhatsApp (pode usar emojis se a original tiver)
6. Cada variação deve ser única e não repetitiva
7. NÃO adicione saudações como "Olá" se a original não tiver
8. NÃO adicione despedidas se a original não tiver
9. Mantenha a formatação de quebras de linha se existirem. Se a mensagem original tiver vários parágrafos ou lista de benefícios, cada variação também deve ter múltiplas linhas, preservando aproximadamente a mesma quantidade de parágrafos/itens.

FORMATO DE RESPOSTA (OBRIGATÓRIO):
Responda APENAS com um JSON VÁLIDO, sem nenhum texto antes ou depois, exatamente no formato:

{
  "variations": [
    "[mensagem completa da variação 1, com todas as linhas]",
    "[mensagem completa da variação 2, com todas as linhas]",
    ...
  ]
}

- Cada item do array deve ser uma mensagem COMPLETA de WhatsApp, com todos os parágrafos e quebras de linha incluídos.
- NÃO retorne markdown, nem numeração "1.", "2.", etc. Use apenas o array de strings dentro do JSON.

Gere as ${count} variações agora:`;

    try {
      logger.info(`🤖 Gerando ${count} variações com Gemini AI...`);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      let variations = [];

      // Primeiro, tenta interpretar a resposta como JSON estruturado
      try {
        let jsonText = text.trim();

        // Remove possíveis blocos de código markdown ou texto extra,
        // mantendo apenas o conteúdo entre o primeiro "{" e o último "}"
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = jsonText.slice(firstBrace, lastBrace + 1);
        }

        // Remove vírgulas finais inválidas antes de ']' ou '}' (JSON estrito não permite)
        jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');

        const parsed = JSON.parse(jsonText);
        if (parsed && Array.isArray(parsed.variations)) {
          variations = parsed.variations
            .map(v =>
              typeof v === 'string'
                // Converte sequências literais "\n" em quebras de linha reais
                ? v.replace(/\\n/g, '\n').trim()
                : ''
            )
            .filter(v => v.length > 0);
        }
      } catch (jsonError) {
        // Se não for JSON válido, segue para o parser de texto
        logger.warn(`Resposta do Gemini não está em JSON válido, usando parser de texto. Detalhe: ${jsonError.message}`);
      }

      // Fallback intermediário: tenta extrair strings do array "variations" manualmente
      if (!variations || variations.length === 0) {
        const match = text.match(/"variations"\s*:\s*\[(.*?)\]/s);
        if (match && match[1]) {
          const arrayContent = match[1];
          const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
          const extracted = [];
          let m;
          while ((m = stringRegex.exec(arrayContent)) !== null) {
            const inner = m[1];
            try {
              // Usa JSON.parse em cada string individual para decodificar \n, \" etc.
              const decoded = JSON.parse(`"${inner}"`);
              if (typeof decoded === 'string' && decoded.trim().length > 0) {
                extracted.push(decoded.trim());
              }
            } catch {
              // Ignora strings malformadas
            }
          }
          if (extracted.length > 0) {
            variations = extracted;
          }
        }
      }

      // Fallback final: se ainda não conseguiu ler do JSON, usa o parser de texto linha a linha
      if (!variations || variations.length === 0) {
        variations = this.parseVariations(text, count);
      }
      
      if (variations.length === 0) {
        throw new Error('Não foi possível gerar variações. Tente novamente.');
      }

      logger.info(`✅ ${variations.length} variações geradas com sucesso`);
      // Garante que não retornamos mais do que o solicitado
      return variations.slice(0, count);

    } catch (error) {
      logger.error(`❌ Erro ao gerar variações: ${error.message}`);
      
      if (error.message.includes('API_KEY')) {
        throw new Error('Chave de API do Gemini inválida ou expirada.');
      }
      if (error.message.includes('quota')) {
        throw new Error('Limite de uso da API do Gemini atingido. Tente novamente mais tarde.');
      }
      if (error.message.includes('SAFETY')) {
        throw new Error('A mensagem foi bloqueada por políticas de segurança. Reformule o conteúdo.');
      }
      
      throw error;
    }
  }

  /**
   * Parseia as variações da resposta do Gemini
   * @param {string} text - Texto retornado pelo Gemini
   * @param {number} expectedCount - Número esperado de variações
   * @returns {string[]} Array de variações
   */
  parseVariations(text, expectedCount) {
    const lines = text.split('\n');
    const variations = [];
    let current = '';

    const pushCurrent = () => {
      const cleaned = current.trim();
      if (cleaned.length > 10) {
        variations.push(cleaned);
      }
      current = '';
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();

      // Ignora linhas puramente estruturais de JSON/markdown
      if (
        !trimmed ||
        trimmed === '{' ||
        trimmed === '}' ||
        trimmed === '[' ||
        trimmed === ']' ||
        trimmed.toLowerCase().startsWith('"variations"') ||
        trimmed.toLowerCase().startsWith('```')
      ) {
        continue;
      }

      // Detecta início explícito de uma nova variação
      const isNumberedHeader = /^\d+[\.\)\-:]\s+/.test(trimmed);
      const isLabelHeader = /^variaç[ãa]o\s+\d+/i.test(trimmed);

      if ((isNumberedHeader || isLabelHeader) && current) {
        // Fecha a variação anterior antes de começar a nova
        pushCurrent();
      }

      // Remove numeração/labels comuns no início da linha
      let cleanedLine = trimmed
        .replace(/^\d+[\.\)\-:]\s*/, '')  // Remove "1. ", "1) ", "1- ", "1: "
        .replace(/^variaç[ãa]o\s+\d+[:\-]?\s*/i, '') // Remove "Variação 1:"
        .replace(/^\*+\s*/, '')            // Remove "* " ou "** "
        .replace(/^-\s*/, '')              // Remove "- "
        .trim();

      if (!cleanedLine) {
        continue;
      }

      // Acumula a linha na variação atual
      current += (current ? '\n' : '') + cleanedLine;
    }

    // Adiciona a última variação acumulada
    if (current) {
      pushCurrent();
    }

    // Fallback: se ainda não houver variações, tenta dividir por parágrafos
    if (variations.length === 0) {
      const paragraphs = text
        .split(/\n\s*\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 10 && !p.toLowerCase().startsWith('variação'));

      if (paragraphs.length > 0) {
        paragraphs.slice(0, expectedCount).forEach(p => variations.push(p));
      }
    }

    return variations;
  }

  /**
   * Verifica a saúde do serviço
   */
  async healthCheck() {
    if (!this.isAvailable()) {
      return { status: 'unavailable', message: 'GEMINI_API_KEY não configurada' };
    }

    try {
      const result = await this.model.generateContent('Responda apenas: OK');
      const response = await result.response;
      const text = response.text();
      
      return { 
        status: 'healthy', 
        message: 'Gemini AI funcionando corretamente',
        model: 'gemini-2.5-flash-lite'
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }
}

// Exporta instância singleton
const geminiService = new GeminiService();
export default geminiService;
