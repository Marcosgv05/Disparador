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
