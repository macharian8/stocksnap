import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../../store/auth';
import { useItems } from '../../../lib/useItems';
import { ItemCard } from '../../../components/inventory/ItemCard';
import type { Item } from '../../../types';

export default function InventoryListScreen() {
  const user = useAuthStore((s) => s.user);
  const { items, isLoading, error, refresh } = useItems(user?.id);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const query = search.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
    );
  }, [items, search]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleAddItem = useCallback(() => {
    router.push('/(main)/inventory/add');
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => <ItemCard item={item} />,
    []
  );

  const keyExtractor = useCallback((item: Item) => item.id, []);

  if (isLoading && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF] px-8">
        <Text className="mb-2 text-lg font-semibold text-[#111827]">
          Something went wrong
        </Text>
        <Text className="mb-6 text-center text-sm text-[#6B7280]">
          {error}
        </Text>
        <Pressable
          onPress={refresh}
          className="min-h-[44px] items-center justify-center rounded-xl bg-[#2563EB] px-6"
        >
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#EFF6FF]">
      {/* Search Bar */}
      <View className="px-4 pb-2 pt-3">
        <TextInput
          className="min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827]"
          placeholder="Search by name or SKU..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Error banner (when we have stale data) */}
      {error ? (
        <View className="mx-4 mb-2 rounded-lg bg-[#FEF2F2] px-3 py-2">
          <Text className="text-xs text-[#DC2626]">
            Failed to refresh: {error}
          </Text>
        </View>
      ) : null}

      {/* Item List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View className="items-center pt-20">
            <Text className="text-5xl">📦</Text>
            <Text className="mt-4 text-base font-semibold text-[#111827]">
              No items yet
            </Text>
            <Text className="mt-1 text-sm text-[#6B7280]">
              Tap + to add your first item.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={handleAddItem}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-[#2563EB]"
        style={{
          shadowColor: '#2563EB',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text className="text-2xl font-light text-white">+</Text>
      </Pressable>
    </View>
  );
}
