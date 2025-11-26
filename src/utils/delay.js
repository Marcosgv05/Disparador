/**
 * Aguarda um determinado tempo em milissegundos
 * @param {number} ms - Tempo em milissegundos
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Gera um delay aleatório entre min e max
 * @param {number} min - Tempo mínimo em milissegundos
 * @param {number} max - Tempo máximo em milissegundos
 */
export const randomDelay = (min, max) => {
  const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(delayTime);
};

/**
 * Gera um delay humanizado baseado no tempo máximo definido pelo usuário
 * O tempo mínimo será 30% do máximo, com variações "humanas"
 * 
 * @param {number} maxMs - Tempo máximo em milissegundos (definido pelo usuário)
 * @param {Object} options - Opções adicionais
 * @param {number} options.minPercent - Porcentagem mínima do max (padrão: 0.3 = 30%)
 * @param {boolean} options.addLongPause - Se deve adicionar pausas longas ocasionais
 * @param {number} options.messageIndex - Índice da mensagem atual (para pausas periódicas)
 * @returns {Promise<{delayTime: number, isLongPause: boolean}>}
 */
export const humanizedDelay = async (maxMs, options = {}) => {
  const {
    minPercent = 0.3,        // Mínimo é 30% do máximo
    addLongPause = true,     // Adiciona pausas longas ocasionais
    messageIndex = 0,        // Para calcular pausas periódicas
    longPauseEvery = 10,     // Pausa longa a cada X mensagens
    longPauseMultiplier = 2  // Multiplicador da pausa longa
  } = options;

  // Calcula mínimo e máximo
  const minMs = Math.floor(maxMs * minPercent);
  
  // Verifica se é hora de uma pausa longa (simula pessoa fazendo outra coisa)
  const isLongPause = addLongPause && messageIndex > 0 && messageIndex % longPauseEvery === 0;
  
  let delayTime;
  
  if (isLongPause) {
    // Pausa longa: entre 1x e 2x o máximo
    delayTime = Math.floor(Math.random() * (maxMs * longPauseMultiplier - maxMs + 1)) + maxMs;
  } else {
    // Distribuição não-uniforme para parecer mais humano
    // Usa uma distribuição que favorece valores intermediários
    const random = Math.random();
    
    // Curva de distribuição: mais provável ficar no meio
    // Usa função de Bezier simplificada
    const curved = random < 0.5 
      ? 2 * random * random 
      : 1 - Math.pow(-2 * random + 2, 2) / 2;
    
    delayTime = Math.floor(minMs + curved * (maxMs - minMs));
  }
  
  // Adiciona pequena variação aleatória (+/- 10%) para parecer ainda mais natural
  const variation = delayTime * 0.1;
  delayTime = Math.floor(delayTime + (Math.random() * variation * 2 - variation));
  
  // Garante que não fique abaixo do mínimo ou acima do máximo ajustado
  delayTime = Math.max(minMs, Math.min(delayTime, isLongPause ? maxMs * longPauseMultiplier : maxMs));
  
  await delay(delayTime);
  
  return { delayTime, isLongPause };
};

/**
 * Retorna informações sobre o delay sem executar
 * Útil para mostrar ao usuário qual será o tempo aproximado
 */
export const getDelayInfo = (maxMs, minPercent = 0.3) => {
  const minMs = Math.floor(maxMs * minPercent);
  return {
    min: minMs,
    max: maxMs,
    average: Math.floor((minMs + maxMs) / 2),
    minSeconds: (minMs / 1000).toFixed(1),
    maxSeconds: (maxMs / 1000).toFixed(1),
    averageSeconds: ((minMs + maxMs) / 2000).toFixed(1)
  };
};
