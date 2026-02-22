import { useRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useItem } from '../../../../lib/useItem';
import { useToastStore } from '../../../../store/toast';

export default function QrPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isLoading, error } = useItem(id);
  const show = useToastStore((s) => s.show);
  const viewShotRef = useRef<ViewShot>(null);

  const handleShare = useCallback(async () => {
    try {
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share QR Code',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Share failed';
      show(message, 'error');
    }
  }, [show]);

  const handlePrint = useCallback(() => {
    show('Printing not yet available', 'warning');
  }, [show]);

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
        <Text className="text-center text-sm text-[#6B7280]">
          {error ?? 'This item may have been deleted.'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'QR Code',
          headerStyle: { backgroundColor: '#EFF6FF' },
          headerTintColor: '#2563EB',
          headerTitleStyle: { color: '#111827', fontWeight: '700' },
        }}
      />
      <SafeAreaView className="flex-1 bg-[#EFF6FF]" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1 }}
          >
            <View className="items-center rounded-2xl bg-white p-8">
              <QRCode value={item.qr_code_data} size={240} />
              <Text className="mt-4 text-lg font-bold text-[#111827]">
                {item.title}
              </Text>
              <Text className="mt-1 text-sm text-[#6B7280]">{item.sku}</Text>
            </View>
          </ViewShot>

          <View className="mt-8 w-full gap-3">
            <Pressable
              onPress={handleShare}
              className="min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB]"
            >
              <Text className="text-base font-semibold text-white">
                Share QR Code
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePrint}
              className="min-h-[52px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
            >
              <Text className="text-base font-semibold text-[#111827]">
                Print label
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
