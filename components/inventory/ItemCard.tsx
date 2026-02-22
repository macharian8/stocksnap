import { useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { Item } from '../../types';

interface ItemCardProps {
  item: Item;
}

function getStockColor(quantity: number, reorderPoint: number): string {
  if (quantity === 0) return '#DC2626';
  if (quantity <= reorderPoint) return '#D97706';
  return '#16A34A';
}

export function ItemCard({ item }: ItemCardProps) {
  const stockColor = useMemo(
    () => getStockColor(item.quantity_in_stock, item.reorder_point),
    [item.quantity_in_stock, item.reorder_point]
  );

  const handlePress = useCallback(() => {
    router.push(`/(main)/inventory/${item.id}`);
  }, [item.id]);

  return (
    <Pressable
      onPress={handlePress}
      className="mb-3 flex-row rounded-xl border border-[#E5E7EB] bg-white p-3"
    >
      {/* Image */}
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          className="h-16 w-16 rounded-lg"
          contentFit="cover"
        />
      ) : (
        <View className="h-16 w-16 items-center justify-center rounded-lg bg-[#F3F4F6]">
          <Text className="text-2xl text-[#9CA3AF]">📦</Text>
        </View>
      )}

      {/* Details */}
      <View className="ml-3 flex-1 justify-center">
        <Text
          className="text-base font-semibold text-[#111827]"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="text-xs text-[#6B7280]">{item.sku}</Text>
          {item.category ? (
            <>
              <Text className="text-xs text-[#D1D5DB]">·</Text>
              <Text className="text-xs text-[#6B7280]">{item.category}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Right side: price + stock */}
      <View className="items-end justify-center">
        <Text className="text-base font-bold text-[#111827]">
          KES {item.sell_price.toLocaleString()}
        </Text>
        <Text
          className="mt-1 text-xs font-medium"
          style={{ color: stockColor }}
        >
          {item.quantity_in_stock} in stock
        </Text>
      </View>
    </Pressable>
  );
}
