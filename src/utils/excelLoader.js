import xlsx from 'xlsx';
import fs from 'fs';
import csvParser from 'csv-parser';
import { logger } from '../config/logger.js';

/**
 * Carrega números de planilha Excel ou CSV
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Array<string>>}
 */
export async function loadPhoneNumbersFromExcel(filePath) {
  try {
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
      return await loadFromCSV(filePath, 'phone');
    } else if (ext === 'xlsx' || ext === 'xls') {
      return await loadFromXLSX(filePath, 'phone');
    } else {
      throw new Error('Formato não suportado. Use CSV ou XLSX');
    }
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
 * Carrega dados de arquivo CSV
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
 * Carrega dados de arquivo XLSX
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
export async function loadContactsFromExcel(filePath) {
  try {
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
      return await loadContactsCSV(filePath);
    } else if (ext === 'xlsx' || ext === 'xls') {
      return await loadContactsXLSX(filePath);
    } else {
      throw new Error('Formato não suportado. Use CSV ou XLSX');
    }
  } catch (error) {
    logger.error(`Erro ao carregar contatos: ${error.message}`);
    throw error;
  }
}

async function loadContactsCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        results.push(row);
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

async function loadContactsXLSX(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    logger.info(`${data.length} contatos carregados do XLSX`);
    return data;
  } catch (error) {
    logger.error(`Erro ao processar XLSX: ${error.message}`);
    throw error;
  }
}

/**
 * Valida formato de planilha de números
 * @param {string} filePath 
 * @returns {Promise<Object>}
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
