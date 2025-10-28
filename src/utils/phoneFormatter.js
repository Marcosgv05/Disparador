/**
 * Formata número de telefone para o padrão WhatsApp
 * @param {string} phone - Número de telefone
 * @returns {string} - Número formatado
 */
export const formatPhoneNumber = (phone) => {
  // Remove todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Adiciona código do país se não tiver (padrão Brasil 55)
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  // Adiciona @s.whatsapp.net
  return cleaned + '@s.whatsapp.net';
};

/**
 * Valida se um número está no formato correto
 * @param {string} phone - Número de telefone
 * @returns {boolean}
 */
export const isValidPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
};

/**
 * Valida e normaliza número brasileiro
 * @param {string} phone - Número de telefone
 * @returns {{valid: boolean, normalized: string, original: string, warning: string|null}}
 */
export const validateBrazilianPhone = (phone) => {
  const original = phone;
  let cleaned = phone.replace(/\D/g, '');
  
  // Adiciona 55 se não tiver
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  const result = {
    valid: false,
    normalized: cleaned,
    original,
    warning: null
  };
  
  if (cleaned.startsWith('55')) {
    const ddd = cleaned.substring(2, 4);
    const numero = cleaned.substring(4);
    
    // Celular: deve ter 13 dígitos (55 + 2 DDD + 9 + 8 dígitos)
    if (cleaned.length === 13 && (numero[0] === '9')) {
      result.valid = true;
    }
    // Celular sem nono dígito (será corrigido automaticamente)
    else if (cleaned.length === 12 && (numero[0] === '9' || numero[0] === '8' || numero[0] === '7')) {
      result.normalized = '55' + ddd + '9' + numero;
      result.valid = true;
      result.warning = 'Nono dígito adicionado automaticamente';
    }
    // Fixo: 12 dígitos (55 + 2 DDD + 8 dígitos começando com 2-5)
    else if (cleaned.length === 12 && ['2', '3', '4', '5'].includes(numero[0])) {
      result.valid = true;
    }
    else {
      result.warning = `Número com formato inválido (${cleaned.length} dígitos)`;
    }
  }
  
  return result;
};
