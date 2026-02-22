import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Item } from '../types';

interface UseItemsResult {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useItems(userId: string | undefined): UseItemsResult {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const { data, error: fetchError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setItems((data as Item[]) ?? []);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, isLoading, error, refresh: fetchItems };
}
