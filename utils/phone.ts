// Validação leve de telefone brasileiro antes de abrir o WhatsApp Web.
// Não substitui a validação real do WhatsApp (que só acontece ao abrir a conversa),
// mas filtra os casos óbvios: número curto, DDD inválido, só zeros, etc.

export interface PhoneValidation {
  valid: boolean;
  reason?: string;
  normalized?: string; // Formato final pronto para wa.me (apenas dígitos, com 55 na frente)
}

const VALID_BR_DDDS = new Set([
  // SP
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  // RJ/ES
  21, 22, 24, 27, 28,
  // MG
  31, 32, 33, 34, 35, 37, 38,
  // PR/SC
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  // RS
  51, 53, 54, 55,
  // Centro-Oeste
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  // Nordeste
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  // Norte
  91, 92, 93, 94, 95, 96, 97, 98, 99
]);

export const validatePhone = (raw: string): PhoneValidation => {
  if (!raw || !raw.trim()) {
    return { valid: false, reason: 'sem número' };
  }

  // Mantém apenas dígitos
  let digits = raw.replace(/\D/g, '');

  // Remove '00' inicial (chamada internacional antiga)
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Casos rejeitados imediatamente
  if (digits.length === 0) return { valid: false, reason: 'sem número' };
  if (/^0+$/.test(digits)) return { valid: false, reason: 'só zeros' };
  if (/^(\d)\1+$/.test(digits)) return { valid: false, reason: 'dígito repetido' };

  // Garante prefixo país 55 para BR
  // Comprimentos esperados:
  //   10 dígitos -> DDD + fixo (55+10 = 12)
  //   11 dígitos -> DDD + celular com 9 (55+11 = 13)
  //   12 dígitos -> já tem 55 + DDD + fixo
  //   13 dígitos -> já tem 55 + DDD + celular
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  if (digits.length !== 12 && digits.length !== 13) {
    return { valid: false, reason: `tamanho inválido (${digits.length} dígitos)` };
  }

  // Valida o DDD
  const ddd = parseInt(digits.slice(2, 4), 10);
  if (!VALID_BR_DDDS.has(ddd)) {
    return { valid: false, reason: `DDD ${ddd} inválido` };
  }

  // Para celular (13 dígitos totais com 55), o primeiro do número local deve ser 9
  if (digits.length === 13 && digits[4] !== '9') {
    return { valid: false, reason: 'celular sem 9' };
  }

  return { valid: true, normalized: digits };
};
