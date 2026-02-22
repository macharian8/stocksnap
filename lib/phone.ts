/**
 * Normalise a Kenyan phone number to E.164 format (+254...).
 * Accepts: 0712345678, 712345678, +254712345678, 254712345678
 */
export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+254${digits}`;
  }

  return `+${digits}`;
}

export function isValidKenyanPhone(input: string): boolean {
  const normalized = normalizeKenyanPhone(input);
  return /^\+254[17]\d{8}$/.test(normalized);
}
