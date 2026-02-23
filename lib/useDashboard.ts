import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type {
  DashboardStats,
  LowStockItem,
  RecentTransaction,
} from '../types';

interface UseDashboardResult {
  stats: DashboardStats;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const EMPTY_STATS: DashboardStats = {
  todayRevenue: 0,
  todaySalesCount: 0,
  weekRevenue: 0,
  totalStock: 0,
  lowStockItems: [],
  recentTransactions: [],
};

export function useDashboard(userId: string | undefined): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const today = startOfToday();
    const weekAgo = startOfWeek();

    const [
      todayTxResult,
      weekTxResult,
      itemsResult,
      lowStockResult,
      recentResult,
    ] = await Promise.all([
      // Today's confirmed sales
      supabase
        .from('transactions')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'sale')
        .eq('payment_status', 'confirmed')
        .gte('created_at', today),

      // This week's confirmed sales
      supabase
        .from('transactions')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'sale')
        .eq('payment_status', 'confirmed')
        .gte('created_at', weekAgo),

      // Total stock across active items
      supabase
        .from('items')
        .select('quantity_in_stock')
        .eq('user_id', userId)
        .eq('is_active', true),

      // Low stock items — fetch all active, filter client-side (PostgREST
      // cannot compare two columns; JS filter below handles the actual logic)
      supabase
        .from('items')
        .select('id, title, sku, quantity_in_stock, reorder_point')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('quantity_in_stock', { ascending: true }),

      // Recent transactions with item title
      supabase
        .from('transactions')
        .select('id, transaction_type, quantity, total_amount, created_at, item_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Check for errors
    const firstError =
      todayTxResult.error ??
      weekTxResult.error ??
      itemsResult.error ??
      lowStockResult.error ??
      recentResult.error;

    if (firstError) {
      setError(firstError.message);
      setIsLoading(false);
      return;
    }

    // Compute today's stats
    const todayRows = (todayTxResult.data ?? []) as { total_amount: number }[];
    const todayRevenue = todayRows.reduce(
      (sum, row) => sum + row.total_amount,
      0
    );
    const todaySalesCount = todayRows.length;

    // Week revenue
    const weekRows = (weekTxResult.data ?? []) as { total_amount: number }[];
    const weekRevenue = weekRows.reduce(
      (sum, row) => sum + row.total_amount,
      0
    );

    // Total stock
    const stockRows = (itemsResult.data ?? []) as {
      quantity_in_stock: number;
    }[];
    const totalStock = stockRows.reduce(
      (sum, row) => sum + row.quantity_in_stock,
      0
    );

    // Low stock — apply filter client-side as a safety net since the column
    // comparison filter may not be supported on all Supabase versions
    const lowStockRaw = (lowStockResult.data ?? []) as LowStockItem[];
    const lowStockItems = lowStockRaw.filter(
      (item) => item.quantity_in_stock <= item.reorder_point
    );

    // Recent transactions — resolve item titles
    const recentRaw = (recentResult.data ?? []) as {
      id: string;
      transaction_type: string;
      quantity: number;
      total_amount: number;
      created_at: string;
      item_id: string;
    }[];

    let recentTransactions: RecentTransaction[] = [];
    if (recentRaw.length > 0) {
      const itemIds = [...new Set(recentRaw.map((t) => t.item_id))];
      const { data: itemNames } = await supabase
        .from('items')
        .select('id, title')
        .in('id', itemIds);

      const titleMap = new Map<string, string>();
      if (itemNames) {
        for (const item of itemNames as { id: string; title: string }[]) {
          titleMap.set(item.id, item.title);
        }
      }

      recentTransactions = recentRaw.map((t) => ({
        id: t.id,
        transaction_type: t.transaction_type as RecentTransaction['transaction_type'],
        quantity: t.quantity,
        total_amount: t.total_amount,
        created_at: t.created_at,
        item_title: titleMap.get(t.item_id) ?? 'Unknown item',
      }));
    }

    setStats({
      todayRevenue,
      todaySalesCount,
      weekRevenue,
      totalStock,
      lowStockItems,
      recentTransactions,
    });
    setIsLoading(false);
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime subscription on transactions table
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dashboard-tx-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchStats]);

  return { stats, isLoading, error, refresh: fetchStats };
}
