import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../../store/auth';
import { useDashboard } from '../../../lib/useDashboard';
import type { LowStockItem, RecentTransaction } from '../../../types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function txTypeIcon(type: RecentTransaction['transaction_type']): string {
  switch (type) {
    case 'sale':
      return '💰';
    case 'restock':
      return '📥';
    case 'adjustment':
      return '✏️';
    case 'return':
      return '↩️';
  }
}

function StatCard({
  title,
  value,
  prefix,
}: {
  title: string;
  value: string;
  prefix?: string;
}) {
  return (
    <View className="flex-1 rounded-xl bg-white p-4">
      <Text className="text-xs text-[#6B7280]">{title}</Text>
      <Text className="mt-1 text-xl font-bold text-[#111827]">
        {prefix ? `${prefix} ` : ''}
        {value}
      </Text>
    </View>
  );
}

function LowStockRow({ item }: { item: LowStockItem }) {
  const stockColor =
    item.quantity_in_stock === 0 ? '#DC2626' : '#D97706';

  const handlePress = useCallback(() => {
    router.push(`/(main)/inventory/${item.id}`);
  }, [item.id]);

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center justify-between border-b border-[#F3F4F6] py-3"
    >
      <View className="flex-1">
        <Text className="text-sm font-medium text-[#111827]" numberOfLines={1}>
          {item.title}
        </Text>
        <Text className="mt-0.5 text-xs text-[#6B7280]">
          Reorder at {item.reorder_point}
        </Text>
      </View>
      <View
        className="ml-3 rounded-full px-3 py-1"
        style={{ backgroundColor: stockColor + '1A' }}
      >
        <Text
          className="text-xs font-semibold"
          style={{ color: stockColor }}
        >
          {item.quantity_in_stock} left
        </Text>
      </View>
    </Pressable>
  );
}

function RecentTxRow({ tx }: { tx: RecentTransaction }) {
  const isSale = tx.transaction_type === 'sale';

  return (
    <View className="flex-row items-center border-b border-[#F3F4F6] py-3">
      <Text className="mr-3 text-xs text-[#6B7280]">
        {formatTime(tx.created_at)}
      </Text>
      <Text className="mr-2 text-base">{txTypeIcon(tx.transaction_type)}</Text>
      <View className="flex-1">
        <Text className="text-sm text-[#111827]" numberOfLines={1}>
          {tx.item_title}
        </Text>
        <Text className="text-xs text-[#6B7280]">×{tx.quantity}</Text>
      </View>
      <Text
        className="text-sm font-semibold"
        style={{ color: isSale ? '#16A34A' : '#6B7280' }}
      >
        {isSale ? '+' : ''}KES {tx.total_amount.toLocaleString()}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { stats, isLoading, error, refresh } = useDashboard(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const dateStr = useMemo(() => formatDate(), []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  if (isLoading && stats.todaySalesCount === 0 && stats.totalStock === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#EFF6FF]"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#2563EB"
        />
      }
    >
      {/* Greeting Header */}
      <View className="px-4 pb-4 pt-4">
        <Text className="text-xl font-bold text-[#111827]">
          {greeting}, {user?.business_name ?? 'there'}
        </Text>
        <Text className="mt-1 text-sm text-[#6B7280]">{dateStr}</Text>
      </View>

      {/* Error banner */}
      {error ? (
        <View className="mx-4 mb-3 rounded-lg bg-[#FEF2F2] px-3 py-2">
          <Text className="text-xs text-[#DC2626]">
            Failed to load: {error}
          </Text>
        </View>
      ) : null}

      {/* Stats Grid */}
      <View className="px-4">
        <View className="mb-3 flex-row gap-3">
          <StatCard
            title="Today's Revenue"
            value={stats.todayRevenue.toLocaleString()}
            prefix="KES"
          />
          <StatCard
            title="Today's Sales"
            value={String(stats.todaySalesCount)}
          />
        </View>
        <View className="mb-6 flex-row gap-3">
          <StatCard
            title="This Week"
            value={stats.weekRevenue.toLocaleString()}
            prefix="KES"
          />
          <StatCard
            title="Total Stock"
            value={stats.totalStock.toLocaleString()}
          />
        </View>
      </View>

      {/* Low Stock Section */}
      <View className="mx-4 mb-6 rounded-xl bg-white p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-[#111827]">
            Needs Restocking
          </Text>
          {stats.lowStockItems.length > 0 ? (
            <View className="rounded-full bg-[#FEF2F2] px-2 py-0.5">
              <Text className="text-xs font-semibold text-[#DC2626]">
                {stats.lowStockItems.length}
              </Text>
            </View>
          ) : null}
        </View>

        {stats.lowStockItems.length > 0 ? (
          stats.lowStockItems.map((item) => (
            <LowStockRow key={item.id} item={item} />
          ))
        ) : (
          <View className="items-center py-4">
            <Text className="text-sm text-[#16A34A]">All stocked up ✓</Text>
          </View>
        )}
      </View>

      {/* Recent Activity Section */}
      <View className="mx-4 rounded-xl bg-white p-4">
        <Text className="mb-2 text-sm font-semibold text-[#111827]">
          Recent Activity
        </Text>

        {stats.recentTransactions.length > 0 ? (
          stats.recentTransactions.map((tx) => (
            <RecentTxRow key={tx.id} tx={tx} />
          ))
        ) : (
          <View className="items-center py-4">
            <Text className="text-sm text-[#6B7280]">No sales yet today</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
