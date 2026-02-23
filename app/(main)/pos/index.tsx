import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';

// CameraView crashes the iOS simulator at the native module level — never render it there.
const IS_SIMULATOR = Platform.OS === 'ios' && __DEV__;
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from 'expo-camera';
import { supabase } from '../../../lib/supabase';
import { useTransaction } from '../../../lib/useTransaction';
import { useAuthStore } from '../../../store/auth';
import { useToastStore } from '../../../store/toast';
import { SaleSheet } from '../../../components/pos/SaleSheet';
import type { Item, PaymentMethod } from '../../../types';

const SCAN_DEBOUNCE_MS = 2000;

function useClock(): string {
  const [time, setTime] = useState(() => formatTime());
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function PosScreen() {
  const user = useAuthStore((s) => s.user);
  const lastScannedSku = useAuthStore((s) => s.lastScannedSku);
  const lastScanTime = useAuthStore((s) => s.lastScanTime);
  const setLastScannedSku = useAuthStore((s) => s.setLastScannedSku);
  const showToast = useToastStore((s) => s.show);
  const { isLoading: isSaleLoading, error: saleError, createSale } = useTransaction();
  const time = useClock();

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Manual SKU entry
  const [manualSku, setManualSku] = useState('');

  // IS_SIMULATOR is the primary guard — permission check is secondary.
  const cameraAvailable = !IS_SIMULATOR && permission?.granted === true && !cameraError;

  const lookupBySku = useCallback(
    async (sku: string) => {
      if (!user) return;

      setIsLookingUp(true);

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('sku', sku)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setIsLookingUp(false);

      if (error) {
        showToast('Error looking up item', 'error');
        return;
      }

      if (!data) {
        showToast('Item not in system', 'error');
        return;
      }

      setScannedItem(data as Item);
      setShowSheet(true);
    },
    [user, showToast]
  );

  const handleBarcodeScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (showSheet || isLookingUp) return;

      const rawData = result.data;
      // Extract SKU from stocksnap://item/{sku} format
      const match = rawData.match(/^stocksnap:\/\/item\/(.+)$/);
      if (!match) return;

      const sku = match[1];

      // Debounce: ignore same SKU within 2 seconds
      if (sku === lastScannedSku && Date.now() - lastScanTime < SCAN_DEBOUNCE_MS) {
        return;
      }

      setLastScannedSku(sku);
      lookupBySku(sku);
    },
    [showSheet, isLookingUp, lastScannedSku, lastScanTime, setLastScannedSku, lookupBySku]
  );

  const handleManualLookup = useCallback(() => {
    const sku = manualSku.trim();
    if (!sku) return;
    // Do NOT call setLastScannedSku here — that's camera debounce state.
    // Manual lookup goes straight to Supabase, independent of camera.
    lookupBySku(sku);
  }, [manualSku, lookupBySku]);

  const handleConfirmSale = useCallback(
    async (data: {
      price: number;
      quantity: number;
      paymentMethod: PaymentMethod;
      mpesaPhone: string | null;
      mpesaCode: string | null;
      notes: string | null;
    }) => {
      if (!user || !scannedItem) return;

      const success = await createSale(user.id, {
        item_id: scannedItem.id,
        quantity: data.quantity,
        price_at_sale: data.price,
        total_amount: data.price * data.quantity,
        payment_method: data.paymentMethod,
        payment_status:
          data.paymentMethod === 'mpesa_stk' ? 'pending' : 'confirmed',
        mpesa_transaction_code: data.mpesaCode,
        mpesa_phone: data.mpesaPhone,
        notes: data.notes,
      });

      if (success) {
        const remaining = scannedItem.quantity_in_stock - data.quantity;
        showToast(
          `Sold ${data.quantity}× ${scannedItem.title} — KES ${(data.price * data.quantity).toLocaleString()}`,
          'success'
        );

        if (remaining <= scannedItem.reorder_point && remaining >= 0) {
          setTimeout(() => {
            showToast(
              `Low stock: ${scannedItem.title} — ${Math.max(0, remaining)} left`,
              'warning'
            );
          }, 3500);
        }

        setShowSheet(false);
        setScannedItem(null);
        setManualSku('');
      }
    },
    [user, scannedItem, createSale, showToast]
  );

  const handleCloseSheet = useCallback(() => {
    setShowSheet(false);
    setScannedItem(null);
  }, []);

  // Request camera permission on mount — wrapped in try/catch because
  // simulators and some environments throw when camera is unavailable
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      (async () => {
        try {
          await requestPermission();
        } catch {
          setCameraError(true);
        }
      })();
    }
  }, [permission, requestPermission]);

  return (
    <View className="flex-1 bg-[#111827]">
      {/* Green header */}
      <View className="bg-[#16A34A] px-4 pb-3 pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-white">POS Mode</Text>
          <Text className="font-mono text-sm text-white/80">{time}</Text>
        </View>
      </View>

      {/* Camera or Manual Entry */}
      {IS_SIMULATOR ? (
        // Simulator: CameraView crashes the native module — never render it here.
        // Show placeholder text and a fully functional manual SKU entry instead.
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-10 text-center text-sm text-white opacity-50">
            Camera unavailable in simulator{'\n'}Use manual SKU entry below
          </Text>
          <View className="w-full flex-row gap-2">
            <TextInput
              className="min-h-[52px] flex-1 rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white"
              placeholder="Enter SKU (e.g. SS-20260221-0001)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={manualSku}
              onChangeText={setManualSku}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleManualLookup}
              disabled={isLookingUp || !manualSku.trim()}
              className="min-h-[52px] items-center justify-center rounded-xl bg-[#16A34A] px-5 disabled:opacity-50"
            >
              {isLookingUp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">Find</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : cameraAvailable ? (
        // Physical device with camera permission — show live scanner
        <View className="flex-1">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarcodeScan}
          >
            {/* Scan overlay */}
            <View className="flex-1 items-center justify-center">
              <View className="h-64 w-64 rounded-3xl border-2 border-white/40" />
              <Text className="mt-4 text-sm text-white/70">
                Point at a StockSnap QR code
              </Text>
              {isLookingUp ? (
                <View className="mt-4 flex-row items-center gap-2">
                  <ActivityIndicator color="#16A34A" />
                  <Text className="text-sm text-white/80">Looking up item...</Text>
                </View>
              ) : null}
            </View>

            {/* Manual entry toggle at bottom */}
            <View className="px-4 pb-6">
              <View className="flex-row gap-2">
                <TextInput
                  className="min-h-[48px] flex-1 rounded-xl border border-white/20 bg-black/40 px-4 text-base text-white"
                  placeholder="Or enter SKU manually"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={manualSku}
                  onChangeText={setManualSku}
                  autoCapitalize="characters"
                />
                <Pressable
                  onPress={handleManualLookup}
                  disabled={isLookingUp || !manualSku.trim()}
                  className="min-h-[48px] items-center justify-center rounded-xl bg-[#16A34A] px-5 disabled:opacity-50"
                >
                  <Text className="text-sm font-semibold text-white">
                    Find
                  </Text>
                </Pressable>
              </View>
            </View>
          </CameraView>
        </View>
      ) : (
        // Physical device without camera permission — manual entry fallback
        <View className="flex-1 items-center justify-center bg-[#F0FDF4] px-6">
          <Text className="text-5xl">🔍</Text>
          <Text className="mt-4 text-lg font-semibold text-[#111827]">
            Manual Item Lookup
          </Text>
          <Text className="mb-8 mt-2 text-center text-sm text-[#6B7280]">
            Camera requires a dev build.{'\n'}Enter the item SKU to make a sale.
          </Text>

          <View className="w-full flex-row gap-2">
            <TextInput
              className="min-h-[52px] flex-1 rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
              placeholder="Enter SKU (e.g. SS-20260221-0001)"
              placeholderTextColor="#9CA3AF"
              value={manualSku}
              onChangeText={setManualSku}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleManualLookup}
              disabled={isLookingUp || !manualSku.trim()}
              className="min-h-[52px] items-center justify-center rounded-xl bg-[#16A34A] px-5 disabled:opacity-50"
            >
              {isLookingUp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  Find Item
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Sale Sheet Modal */}
      <Modal
        visible={showSheet}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSheet}
      >
        <View className="flex-1 justify-end bg-black/40">
          {scannedItem ? (
            <SaleSheet
              item={scannedItem}
              isLoading={isSaleLoading}
              error={saleError}
              onConfirm={handleConfirmSale}
              onClose={handleCloseSheet}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
