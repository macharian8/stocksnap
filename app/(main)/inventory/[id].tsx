import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useItem } from '../../../lib/useItem';

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <View className="flex-row items-start justify-between border-b border-[#F3F4F6] py-3">
      <Text className="text-sm text-[#6B7280]">{label}</Text>
      <Text className="max-w-[60%] text-right text-sm font-medium text-[#111827]">
        {value ?? '—'}
      </Text>
    </View>
  );
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isLoading, error, softDelete } = useItem(id);
  const [isDeleting, setIsDeleting] = useState(false);
  const qrRef = useRef<View>(null);

  const stockColor = useMemo(() => {
    if (!item) return '#6B7280';
    if (item.quantity_in_stock === 0) return '#DC2626';
    if (item.quantity_in_stock <= item.reorder_point) return '#D97706';
    return '#16A34A';
  }, [item]);

  const conditionLabel = useMemo(() => {
    if (!item) return '';
    return item.condition.charAt(0).toUpperCase() + item.condition.slice(1);
  }, [item]);

  const unitLabel = useMemo(() => {
    if (!item) return '';
    const map: Record<string, string> = {
      piece: 'Piece',
      pair: 'Pair',
      kg: 'Kilogram',
      metre: 'Metre',
      litre: 'Litre',
      other: 'Other',
    };
    return map[item.unit_of_measure] ?? item.unit_of_measure;
  }, [item]);

  const handleEdit = useCallback(() => {
    router.push(`/(main)/inventory/edit/${id}`);
  }, [id]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Item',
      'This will remove the item from your inventory. This action can be undone by contacting support.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const success = await softDelete();
            setIsDeleting(false);
            if (success) {
              router.back();
            }
          },
        },
      ]
    );
  }, [softDelete]);

  const handleShareQr = useCallback(async () => {
    try {
      // Give the SVG renderer time to paint before capture; without this
      // delay the PNG is blank because the view-shot fires before the QR
      // SVG has committed its first frame to the native layer.
      await new Promise<void>((r) => setTimeout(r, 100));
      const uri = await captureRef(qrRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share QR Code',
      });
    } catch (err) {
      Alert.alert(
        'Share failed',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF] px-8">
        <Text className="mb-2 text-lg font-semibold text-[#111827]">
          Item not found
        </Text>
        <Text className="mb-6 text-center text-sm text-[#6B7280]">
          {error ?? 'This item may have been deleted.'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="min-h-[44px] items-center justify-center rounded-xl bg-[#2563EB] px-6"
        >
          <Text className="text-sm font-semibold text-white">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: item.title,
          headerStyle: { backgroundColor: '#EFF6FF' },
          headerTintColor: '#2563EB',
          headerTitleStyle: { color: '#111827', fontWeight: '700' },
          headerRight: () => (
            <Pressable
              onPress={handleEdit}
              className="min-h-[44px] min-w-[44px] items-center justify-center"
            >
              <Text className="text-sm font-semibold text-[#2563EB]">Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-[#EFF6FF]"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Image */}
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            className="h-64 w-full"
            contentFit="cover"
          />
        ) : (
          <View className="h-48 w-full items-center justify-center bg-[#F3F4F6]">
            <Text className="text-6xl">📦</Text>
          </View>
        )}

        {/* Title + Stock Badge */}
        <View className="px-4 pt-4">
          <Text className="text-2xl font-bold text-[#111827]">
            {item.title}
          </Text>
          {item.description ? (
            <Text className="mt-1 text-sm text-[#6B7280]">
              {item.description}
            </Text>
          ) : null}
          <View className="mt-3 flex-row items-center gap-3">
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: stockColor + '1A' }}
            >
              <Text className="text-xs font-semibold" style={{ color: stockColor }}>
                {item.quantity_in_stock} in stock
              </Text>
            </View>
            <Text className="text-xs text-[#6B7280]">
              {item.quantity_sold} sold
            </Text>
          </View>
        </View>

        {/* Pricing */}
        <View className="mx-4 mt-6 rounded-xl bg-white p-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Pricing
          </Text>
          <DetailRow
            label="Sell price"
            value={`KES ${item.sell_price.toLocaleString()}`}
          />
          <DetailRow
            label="Cost"
            value={`KES ${item.buy_price.toLocaleString()}`}
          />
          <DetailRow
            label="Floor price"
            value={`KES ${item.sell_price_floor.toLocaleString()}`}
          />
          <DetailRow
            label="Ceiling price"
            value={
              item.sell_price_ceiling !== null
                ? `KES ${item.sell_price_ceiling.toLocaleString()}`
                : '—'
            }
          />
        </View>

        {/* Details */}
        <View className="mx-4 mt-4 rounded-xl bg-white p-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Details
          </Text>
          <DetailRow label="SKU" value={item.sku} />
          <DetailRow label="Category" value={item.category} />
          <DetailRow label="Condition" value={conditionLabel} />
          <DetailRow label="Unit" value={unitLabel} />
          <DetailRow label="Reorder point" value={item.reorder_point} />
        </View>

        {/* QR Code */}
        <View className="mx-4 mt-4 rounded-xl bg-white p-6">
          <Text className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            QR Code
          </Text>

          {/* Captured region: QR + SKU label.
              Explicit width/backgroundColor/padding are required for
              react-native-view-shot: NativeWind flex sizing can produce a
              zero-width view before the SVG paints, yielding a blank PNG. */}
          <View
            ref={qrRef}
            style={{
              alignItems: 'center',
              backgroundColor: '#ffffff',
              padding: 16,
              width: 182,
            }}
          >
            <QRCode
              value={item.qr_code_data}
              size={150}
              ecl="M"
              color="#000000"
              backgroundColor="#ffffff"
            />
            <Text
              className="mt-2 text-sm text-[#111827]"
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              }}
            >
              {item.sku}
            </Text>
          </View>

          <Pressable
            onPress={handleShareQr}
            className="mt-4 min-h-[48px] items-center justify-center rounded-xl bg-[#2563EB]"
          >
            <Text className="text-base font-semibold text-white">
              Share QR
            </Text>
          </Pressable>
        </View>

        {/* Delete Button */}
        <View className="mx-4 mt-8">
          <Pressable
            onPress={handleDelete}
            disabled={isDeleting}
            className="min-h-[52px] items-center justify-center rounded-xl border border-[#DC2626] disabled:opacity-50"
          >
            {isDeleting ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <Text className="text-base font-semibold text-[#DC2626]">
                Delete item
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
