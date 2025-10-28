import xlsx from 'xlsx';
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
 * Carrega contatos de arquivo XLSX
 * @param {string} filePath 
 */
async function loadContactsFromXLSX(filePath) {
  try {
    const workbook = xlsx.readFile(filePath, { cellNF: false, cellText: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const results = [];
    
    // Encontra colunas de nome e telefone
    let nameCol = -1;
    let phoneCol = -1;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
      const cell = worksheet[cellAddress];
      if (cell) {
        const header = String(cell.v).toLowerCase();
        
        if (header.includes('name') || header.includes('nome') || header === 'n') {
          nameCol = col;
        }
        if (header.includes('phone') || header.includes('telefone') || 
            header.includes('numero') || header.includes('whatsapp') || header === 'p') {
          phoneCol = col;
        }
      }
    }
    
    // Fallbacks para colunas não identificadas explicitamente
    if (nameCol === -1 && range.e.c > range.s.c) {
      nameCol = range.s.c;
    }

    if (phoneCol === -1) {
      // Procura uma coluna com valores numéricos (provável telefone)
      for (let col = range.s.c; col <= range.e.c; col++) {
        if (col === nameCol) continue;
        let hasNumericValue = false;
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
          const cellAddr = xlsx.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddr];
          if (!cell || cell.v === undefined || cell.v === null || cell.v === '') {
            continue;
          }

          const rawValue = typeof cell.v === 'number' ? convertScientificToNumber(cell.v) : String(cell.v);
          const digits = rawValue.replace(/\D/g, '');

          if (digits.length >= 8) {
            hasNumericValue = true;
            break;
          }
        }

        if (hasNumericValue) {
          phoneCol = col;
          break;
        }
      }

      // Se ainda não encontrou, assume coluna seguinte ao nome (se existir)
      if (phoneCol === -1) {
        if (nameCol !== -1 && nameCol + 1 <= range.e.c) {
          phoneCol = nameCol + 1;
        } else {
          phoneCol = range.s.c;
        }
      }
    }

    // Lê os valores
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const phoneCellAddr = xlsx.utils.encode_cell({ r: row, c: phoneCol });
      const phoneCell = worksheet[phoneCellAddr];
      
      if (phoneCell && phoneCell.v !== undefined && phoneCell.v !== null && phoneCell.v !== '') {
        let phone = phoneCell.v;
        if (typeof phone === 'number') {
          phone = convertScientificToNumber(phone);
        } else {
          phone = String(phone).trim();
        }
        
        let name = phone; // Default: nome é o próprio número
        
        if (nameCol !== -1) {
          const nameCellAddr = xlsx.utils.encode_cell({ r: row, c: nameCol });
          const nameCell = worksheet[nameCellAddr];
          if (nameCell && nameCell.v) {
            name = String(nameCell.v).trim();
          }
        }
        
        if (phone) {
          results.push({ name, phone });
        }
      }
    }
    
    logger.info(`${results.length} contatos carregados do XLSX`);
    return results;
  } catch (error) {
    logger.error(`Erro ao processar XLSX: ${error.message}`);
    throw error;
  }
}

/**
 * Carrega dados de arquivo XLSX (backward compatibility)
 * @param {string} filePath 
 * @param {string} columnName 
 */
async function loadFromXLSX(filePath, columnName) {
  try {
    const workbook = xlsx.readFile(filePath, { cellNF: false, cellText: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Lê os valores brutos das células
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const results = [];
    
    // Encontra o índice da coluna
    let columnIndex = -1;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
      const cell = worksheet[cellAddress];
      if (cell && String(cell.v).toLowerCase() === columnName.toLowerCase()) {
        columnIndex = col;
        break;
      }
    }
    
    // Se não encontrou a coluna pelo nome, usa a primeira
    if (columnIndex === -1) {
      columnIndex = range.s.c;
    }
    
    // Lê os valores da coluna (começando da linha 1, pulando o header)
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = xlsx.utils.encode_cell({ r: row, c: columnIndex });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        let value = cell.v;
        
        // Se for número, converte notação científica
        if (typeof value === 'number') {
          value = convertScientificToNumber(value);
        } else {
          value = String(value);
        }
        
        if (value.trim()) {
          results.push(value.trim());
        }
      }
    }
    
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
