import fs from 'fs/promises';
import { logger } from '../config/logger.js';

/**
 * Carrega números de telefone de um arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Array<string>} - Lista de números
 */
export async function loadPhoneNumbersFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const phoneNumbers = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .filter(line => /^\d+$/.test(line));

    logger.info(`${phoneNumbers.length} números carregados de ${filePath}`);
    return phoneNumbers;
  } catch (error) {
    logger.error(`Erro ao carregar arquivo ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Carrega mensagens de um arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Array<string>} - Lista de mensagens
 */
export async function loadMessagesFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const messages = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    logger.info(`${messages.length} mensagens carregadas de ${filePath}`);
    return messages;
  } catch (error) {
    logger.error(`Erro ao carregar arquivo ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Carrega contatos com dados estruturados de um arquivo CSV
 * @param {string} filePath - Caminho do arquivo CSV
 * @returns {Array<Object>} - Lista de contatos
 */
export async function loadContactsFromCSV(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Primeira linha é o cabeçalho
    const headers = lines[0].split(',').map(h => h.trim());
    
    const contacts = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      const contact = {};
      
      headers.forEach((header, index) => {
        contact[header] = values[index];
      });
      
      contacts.push(contact);
    }

    logger.info(`${contacts.length} contatos carregados de ${filePath}`);
    return contacts;
  } catch (error) {
    logger.error(`Erro ao carregar CSV ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Salva resultados de envio em um arquivo
 * @param {string} filePath - Caminho do arquivo
 * @param {Array} results - Resultados do envio
 */
export async function saveResultsToFile(filePath, results) {
  try {
    const content = results.map(result => {
      return `${result.phone},${result.success ? 'SUCESSO' : 'FALHA'},${result.error || '-'}`;
    }).join('\n');

    await fs.writeFile(filePath, `phone,status,error\n${content}`, 'utf-8');
    logger.info(`Resultados salvos em ${filePath}`);
  } catch (error) {
    logger.error(`Erro ao salvar resultados:`, error.message);
    throw error;
  }
}
