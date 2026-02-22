import { useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { SalePayload } from '../types';

interface UseTransactionResult {
  isLoading: boolean;
  error: string | null;
  createSale: (userId: string, payload: SalePayload) => Promise<boolean>;
}

async function decrementStock(
  itemId: string,
  qty: number
): Promise<string | null> {
  // Try RPC first (atomic)
  const { error: rpcError } = await supabase.rpc('decrement_stock', {
    item_id: itemId,
    qty,
  });

  if (!rpcError) return null;

  // Fallback: direct update if RPC function doesn't exist yet
  const isRpcMissing =
    rpcError.message.includes('function') ||
    rpcError.message.includes('does not exist');

  if (!isRpcMissing) return rpcError.message;

  const { data: currentItem, error: fetchError } = await supabase
    .from('items')
    .select('quantity_in_stock, quantity_sold')
    .eq('id', itemId)
    .single();

  if (fetchError || !currentItem) {
    return fetchError?.message ?? 'Item not found for stock update';
  }

  const typed = currentItem as {
    quantity_in_stock: number;
    quantity_sold: number;
  };

  const { error: updateError } = await supabase
    .from('items')
    .update({
      quantity_in_stock: Math.max(0, typed.quantity_in_stock - qty),
      quantity_sold: typed.quantity_sold + qty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  return updateError?.message ?? null;
}

export function useTransaction(): UseTransactionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSale = useCallback(
    async (userId: string, payload: SalePayload): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      // Insert transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: userId,
        item_id: payload.item_id,
        attendant_id: null,
        transaction_type: 'sale' as const,
        quantity: payload.quantity,
        price_at_sale: payload.price_at_sale,
        total_amount: payload.total_amount,
        payment_method: payload.payment_method,
        payment_status: payload.payment_status,
        mpesa_transaction_code: payload.mpesa_transaction_code,
        mpesa_phone: payload.mpesa_phone,
        notes: payload.notes,
        created_at: new Date().toISOString(),
      });

      if (txError) {
        setError(txError.message);
        setIsLoading(false);
        return false;
      }

      // Decrement stock
      const stockError = await decrementStock(
        payload.item_id,
        payload.quantity
      );

      setIsLoading(false);

      if (stockError) {
        // Sale was recorded, but stock wasn't decremented — warn but don't fail
        setError(`Sale recorded. Stock update failed: ${stockError}`);
      }

      return true;
    },
    []
  );

  return { isLoading, error, createSale };
}
