import { storage } from './storage';

// SKU format: SS-YYMM-[3CHAR]-[5DIGITS]
// Example:    SS-2602-TEC-00001
//
// YYMM    — last 2 digits of year + zero-padded month (reflects when item was added)
// 3CHAR   — first 3 alphanumeric chars of business_name, uppercased, non-alphanum stripped.
//           Padded with 'X' if the name has fewer than 3 usable chars.
// 5DIGITS — global per-user counter. NEVER resets — continues across months and years.
//           Item 1 = 00001, item 247 = 00247, up to 99999 per store.

function getYYMM(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

export function storeCode(businessName: string): string {
  return businessName
    .replace(/[^a-zA-Z0-9]/g, '') // strip spaces and special chars
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X'); // pad with X if fewer than 3 chars remain
}

export function generateSku(userId: string, businessName: string): string {
  const key = `sku-global-${userId}`;
  const current = storage.getNumber(key) ?? 0;
  const next = current + 1;
  storage.set(key, next);

  const yymm = getYYMM();
  const code = storeCode(businessName);
  const seq = String(next).padStart(5, '0');
  return `SS-${yymm}-${code}-${seq}`;
}
