import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Item } from '../types';

interface ItemUpdatePayload {
  title: string;
  description: string | null;
  category: string | null;
  condition: Item['condition'];
  unit_of_measure: Item['unit_of_measure'];
  buy_price: number;
  sell_price: number;
  sell_price_floor: number;
  sell_price_ceiling: number | null;
  quantity_in_stock: number;
  reorder_point: number;
}

interface UseItemResult {
  item: Item | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  softDelete: () => Promise<boolean>;
  updateItem: (payload: ItemUpdatePayload) => Promise<boolean>;
}

export function useItem(itemId: string | undefined): UseItemResult {
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    if (!itemId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const { data, error: fetchError } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setItem(data as Item);
    setIsLoading(false);
  }, [itemId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const softDelete = useCallback(async (): Promise<boolean> => {
    if (!itemId) return false;

    const { error: deleteError } = await supabase
      .from('items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    return true;
  }, [itemId]);

  const updateItem = useCallback(
    async (payload: ItemUpdatePayload): Promise<boolean> => {
      if (!itemId) return false;

      setError(null);

      const { error: updateError } = await supabase
        .from('items')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      await fetchItem();
      return true;
    },
    [itemId, fetchItem]
  );

  return { item, isLoading, error, refresh: fetchItem, softDelete, updateItem };
}
