import ExcelJS from 'exceljs';
import fs from 'fs';
import csvParser from 'csv-parser';
import { logger } from '../config/logger.js';

/**
 * Carrega contatos (nome e número) de planilha Excel ou CSV
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Array<{name: string, phone: string}>>}
 */
export async function loadContactsFromExcel(filePath) {
  try {
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
      return await loadContactsFromCSV(filePath);
    } else if (ext === 'xlsx' || ext === 'xls') {
      return await loadContactsFromXLSX(filePath);
    } else {
      throw new Error('Formato não suportado. Use CSV ou XLSX');
    }
  } catch (error) {
    logger.error(`Erro ao carregar planilha: ${error.message}`);
    throw error;
  }
}

/**
 * Carrega números de planilha Excel ou CSV (backward compatibility)
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Array<string>>}
 */
export async function loadPhoneNumbersFromExcel(filePath) {
  try {
    const contacts = await loadContactsFromExcel(filePath);
    return contacts.map(c => c.phone);
  } catch (error) {
    logger.error(`Erro ao carregar planilha: ${error.message}`);
    throw error;
  }
}

/**
 * Carrega mensagens de planilha Excel ou CSV
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Array<string>>}
 */
export async function loadMessagesFromExcel(filePath) {
  try {
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
      return await loadFromCSV(filePath, 'message');
    } else if (ext === 'xlsx' || ext === 'xls') {
      return await loadFromXLSX(filePath, 'message');
    } else {
      throw new Error('Formato não suportado. Use CSV ou XLSX');
    }
  } catch (error) {
    logger.error(`Erro ao carregar planilha: ${error.message}`);
    throw error;
  }
}

/**
 * Carrega contatos de arquivo CSV
 * @param {string} filePath 
 */
async function loadContactsFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        const keys = Object.keys(row);
        let name = null;
        let phone = null;
        
        // Procura colunas de nome
        const nameCol = keys.find(k => 
          k.toLowerCase().includes('name') || 
          k.toLowerCase().includes('nome') ||
          k.toLowerCase() === 'n'
        );
        
        // Procura colunas de telefone
        const phoneCol = keys.find(k => 
          k.toLowerCase().includes('phone') ||
          k.toLowerCase().includes('telefone') ||
          k.toLowerCase().includes('numero') ||
          k.toLowerCase().includes('whatsapp') ||
          k.toLowerCase() === 'p'
        );
        
        if (phoneCol && row[phoneCol]) {
          phone = row[phoneCol].trim();
          name = nameCol && row[nameCol] ? row[nameCol].trim() : phone;
          
          results.push({ name, phone });
        } else if (keys.length > 0 && row[keys[0]]) {
          // Fallback: primeira coluna como telefone
          phone = row[keys[0]].trim();
          name = keys.length > 1 && row[keys[1]] ? row[keys[1]].trim() : phone;
          results.push({ name, phone });
        }
      })
      .on('end', () => {
        logger.info(`${results.length} contatos carregados do CSV`);
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Carrega dados de arquivo CSV (backward compatibility)
 * @param {string} filePath 
 * @param {string} columnName 
 */
async function loadFromCSV(filePath, columnName) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        // Busca a coluna pelo nome ou primeira coluna
        const value = row[columnName] || row[Object.keys(row)[0]];
        
        if (value && value.trim()) {
          results.push(value.trim());
        }
      })
      .on('end', () => {
        logger.info(`${results.length} itens carregados do CSV`);
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Converte notação científica em string numérica
 * @param {*} value 
 * @returns {string}
 */
function convertScientificToNumber(value) {
  if (typeof value === 'number') {
    // Converte número (incluindo notação científica) para string sem notação
    return value.toFixed(0);
  }
  return String(value);
}

/**
 * Carrega contatos de arquivo XLSX usando ExcelJS
 * @param {string} filePath 
 */
async function loadContactsFromXLSX(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Planilha vazia');
    }
    
    const results = [];
    let nameCol = -1;
    let phoneCol = -1;
    
    // Encontra colunas de nome e telefone no header (primeira linha)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const header = String(cell.value || '').toLowerCase();
      
      if (header.includes('name') || header.includes('nome') || header === 'n') {
        nameCol = colNumber;
      }
      if (header.includes('phone') || header.includes('telefone') || 
          header.includes('numero') || header.includes('whatsapp') || header === 'p') {
        phoneCol = colNumber;
      }
    });
    
    // Fallbacks
    if (phoneCol === -1) phoneCol = 1;
    if (nameCol === -1 && worksheet.columnCount > 1) nameCol = phoneCol === 1 ? 2 : 1;
    
    // Lê os valores (começando da linha 2)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Pula header
      
      let phone = row.getCell(phoneCol).value;
      if (!phone) return;
      
      // Converte número para string
      if (typeof phone === 'number') {
        phone = convertScientificToNumber(phone);
      } else if (typeof phone === 'object' && phone.text) {
        phone = phone.text;
      } else {
        phone = String(phone).trim();
      }
      
      let name = phone;
      if (nameCol !== -1) {
        const nameValue = row.getCell(nameCol).value;
        if (nameValue) {
          name = typeof nameValue === 'object' && nameValue.text ? nameValue.text : String(nameValue).trim();
        }
      }
      
      if (phone) {
        results.push({ name, phone });
      }
    });
    
    logger.info(`${results.length} contatos carregados do XLSX`);
    return results;
  } catch (error) {
    logger.error(`Erro ao processar XLSX: ${error.message}`);
    throw error;
  }
}

/**
 * Carrega dados de arquivo XLSX usando ExcelJS (backward compatibility)
 * @param {string} filePath 
 * @param {string} columnName 
 */
async function loadFromXLSX(filePath, columnName) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Planilha vazia');
    }
    
    const results = [];
    let columnIndex = 1;
    
    // Encontra o índice da coluna pelo nome
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      if (String(cell.value || '').toLowerCase() === columnName.toLowerCase()) {
        columnIndex = colNumber;
      }
    });
    
    // Lê os valores da coluna (começando da linha 2)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Pula header
      
      let value = row.getCell(columnIndex).value;
      if (!value) return;
      
      if (typeof value === 'number') {
        value = convertScientificToNumber(value);
      } else if (typeof value === 'object' && value.text) {
        value = value.text;
      } else {
        value = String(value);
      }
      
      if (value.trim()) {
        results.push(value.trim());
      }
    });
    
    logger.info(`${results.length} itens carregados do XLSX`);
    return results;
  } catch (error) {
    logger.error(`Erro ao processar XLSX: ${error.message}`);
    throw error;
  }
}

/**
 * Carrega contatos completos de planilha (com múltiplas colunas)
 * @param {string} filePath 
 * @returns {Promise<Array<Object>>}
 */
export async function validatePhoneSpreadsheet(filePath) {
  try {
    const numbers = await loadPhoneNumbersFromExcel(filePath);
    
    const valid = [];
    const invalid = [];
    const details = [];
    
    for (const num of numbers) {
      const cleaned = num.replace(/\D/g, '');
      const isValid = cleaned.length >= 10 && cleaned.length <= 15;
      
      if (isValid) {
        valid.push(cleaned);
        details.push({ original: num, cleaned, valid: true });
      } else {
        invalid.push(num);
        details.push({ original: num, cleaned, valid: false, reason: 'Comprimento inválido' });
      }
    }
    
    return {
      total: numbers.length,
      valid: valid.length,
      invalid: invalid.length,
      validNumbers: valid,
      invalidNumbers: invalid,
      details
    };
  } catch (error) {
    throw error;
  }
}
