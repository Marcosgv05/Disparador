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
