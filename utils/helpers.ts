
// Pad a number with leading zero
export const padZero = (num: number): string => String(num).padStart(2, '0');

// Format date as DD/MM/YYYY
export const formatDate = (date: Date): string => {
  if (isNaN(date.getTime())) return 'Data Inválida';
  return `${padZero(date.getDate())}/${padZero(date.getMonth() + 1)}/${date.getFullYear()}`;
};

// Format date for display in cards (short)
export const formatDateShort = (date: Date): string => {
  if (isNaN(date.getTime())) return 'Data Inválida';
  return `${padZero(date.getDate())}/${padZero(date.getMonth() + 1)}`;
};

// Format date with time (Configurable)
export const formatDateWithTime = (date: Date, timeString: string = '20:00'): string => {
  if (isNaN(date.getTime())) return 'Data Inválida';
  // Format the time string to ensure it looks good (e.g., 20:00 -> 20h)
  const formattedTime = timeString.replace(':', 'h');
  return `${formatDate(date)} às ${formattedTime}`;
};

// Format date object to YYYY-MM-DD input string
export const toInputDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = padZero(date.getMonth() + 1);
    const dd = padZero(date.getDate());
    return `${yyyy}-${mm}-${dd}`;
};

// Format currency
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Process Spin Syntax {a|b|c}
export const processSpinSyntax = (text: string): string => {
  return text.replace(/\{([^{}]+)\}/g, (match, content) => {
    const choices = content.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
};

// Apply Anti-Ban invisible characters
export const applyAntiBan = (text: string): string => {
  if (!text) return text;
  const invisibleChar = '\u200B'; // Zero Width Space
  let result = '';
  // Randomly insert invisible char (approx 10% chance per character)
  for (let i = 0; i < text.length; i++) {
    result += text[i];
    if (Math.random() < 0.1) {
      result += invisibleChar;
    }
  }
  return result;
};

// Re-export para acesso unificado a partir de helpers
export { validatePhone } from './phone';
import { validatePhone } from './phone';

// Versão validada: além de extrair, marca se o número parece válido
export const extractPhoneValidated = (text: string) => {
  const base = extractPhone(text);
  if (!base.whatsapp) {
    return { ...base, isValid: false, invalidReason: 'sem número', normalized: '' };
  }
  const v = validatePhone(base.whatsapp);
  return {
    ...base,
    isValid: v.valid,
    invalidReason: v.reason,
    normalized: v.normalized || base.whatsapp
  };
};

// Extract phone number from notes
export const extractPhone = (text: string) => {
  if (!text) return { cleanText: '', whatsapp: '', original: '' };

  // Improved Regex:
  // Supports (11) 9999-9999, 11 9999-9999, +55 11 ..., 5511...
  // Avoids matching dates (DD/MM/YYYY) by excluding '/' from main charset
  const phoneRegex = /(?:(?:\+|00)\d[\d\s().-]{5,}\d|[\d(][\d\s().-]{7,}\d)/i;
  
  const match = text.match(phoneRegex);

  let original = '';
  let whatsapp = '';
  let cleanText = text;

  if (match && match[0]) {
    original = match[0].trim();
    let tempNum = original;

    // Clean for WhatsApp link
    if (tempNum.startsWith('+')) {
      whatsapp = tempNum.substring(1).replace(/\D/g, '');
    } else if (tempNum.startsWith('00')) {
      whatsapp = tempNum.substring(2).replace(/\D/g, '');
    } else {
      whatsapp = tempNum.replace(/\D/g, '');
    }

    // Escape special characters for regex replacement to remove it from text
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanText = text.replace(new RegExp(escapedOriginal), '').replace(/^[\s,;-]+|[\s,;-]+$/g, '').trim();
  }

  return { cleanText, whatsapp, original };
};

// Extract Credentials (User/Pass) from notes
export const extractCredentials = (text: string) => {
    if (!text) return { login: null, pass: null };
    
    // Regex looking for User: X | Pass: Y patterns
    // Captures content after User/Login/ID until next pipe or newline
    const loginMatch = text.match(/(?:User|Login|Usuario|ID)\s*[:=]\s*([^|\n]+)/i);
    const passMatch = text.match(/(?:Senha|Password|Pass)\s*[:=]\s*([^|\n]+)/i);

    return {
        login: loginMatch ? loginMatch[1].trim() : null,
        pass: passMatch ? passMatch[1].trim() : null
    };
};

// Generate CSV content
export const generateCSV = (data: Array<{ name: string; date: Date; notes: string; customNotes: string; phone: string }>, defaultTime: string) => {
  let csvContent = 'Nome,Data de Vencimento,Observações Originais,Telefone,Observação Adicional\n';
  
  data.forEach(row => {
    const escapeCSV = (text: string) => text ? `"${String(text).replace(/"/g, '""')}"` : '""';
    const dateStr = formatDateWithTime(row.date, defaultTime);
    csvContent += `${escapeCSV(row.name)},${escapeCSV(dateStr)},${escapeCSV(row.notes)},${escapeCSV(row.phone)},${escapeCSV(row.customNotes)}\n`;
  });

  return csvContent;
};
