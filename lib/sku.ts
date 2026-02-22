import { storage } from './storage';

function getDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getSkuKey(userId: string, dateStr: string): string {
  return `sku-seq-${userId}-${dateStr}`;
}

export function generateSku(userId: string): string {
  const dateStr = getDateString();
  const key = getSkuKey(userId, dateStr);

  const current = storage.getNumber(key) ?? 0;
  const next = current + 1;
  storage.set(key, next);

  const padded = String(next).padStart(4, '0');
  return `SS-${dateStr}-${padded}`;
}
