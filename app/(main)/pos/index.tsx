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

import Constants from 'expo-constants';
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from 'expo-camera';

// CameraView crashes the iOS Simulator at the native module level — never render it there.
// On physical devices __DEV__ can be true, so we check the device name instead.
const IS_SIMULATOR =
  Platform.OS === 'ios' && (Constants.deviceName?.includes('Simulator') ?? false);
import { supabase } from '../../../lib/supabase';
import { useTransaction } from '../../../lib/useTransaction';
import { useAuthStore } from '../../../store/auth';
import { useToastStore } from '../../../store/toast';
import { SaleSheet } from '../../../components/pos/SaleSheet';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
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
  const showToast = useToastStore((s) => s.show);
  const { isLoading: isSaleLoading, error: saleError, createSale } = useTransaction();
  const time = useClock();

  const isProcessing = useRef(false);
  // Sync showSheet into a ref so the stable scan callback always reads the
  // current value without being recreated on every modal open/close.
  const showSheetRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  showSheetRef.current = showSheet; // always current — never stale in callbacks
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Manual SKU entry
  const [manualSku, setManualSku] = useState('');

  // IS_SIMULATOR is the primary guard — permission check is secondary.
  const cameraAvailable = !IS_SIMULATOR && permission?.granted === true && !cameraError;

  const lookupBySku = useCallback(
    async (sku: string) => {
      if (!user) {
        console.log('[POS] lookupBySku: no user in store — aborting');
        return;
      }

      console.log('[POS] lookupBySku: start', { sku, userId: user.id });
      setIsLookingUp(true);

      try {
        // Query both sku AND qr_code_data columns — items created before the
        // SKU format change may store the new-format value in qr_code_data
        // while the sku column still holds the old format, or vice-versa.
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .or(`sku.eq.${sku},qr_code_data.eq.${sku}`)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        console.log('[POS] lookupBySku: query complete', {
          found: !!data,
          title: data?.title ?? null,
          skuInDb: data?.sku ?? null,
          qrCodeDataInDb: data?.qr_code_data ?? null,
          errorCode: error?.code ?? null,
          errorMessage: error?.message ?? null,
        });

        if (error) {
          console.error('[POS] lookupBySku: Supabase error', error);
          showToast('Error looking up item', 'error');
          return;
        }

        if (!data) {
          console.log('[POS] lookupBySku: no row matched sku or qr_code_data =', sku);
          showToast('Item not in system', 'error');
          return;
        }

        console.log('[POS] lookupBySku: setting scannedItem →', data.title);
        setScannedItem(data as Item);
        setShowSheet(true);
        console.log('[POS] lookupBySku: showSheet set true');
      } catch (e) {
        console.error('[POS] lookupBySku: unexpected throw', e);
        showToast('Error looking up item', 'error');
      } finally {
        setIsLookingUp(false);
      }
    },
    [user, showToast]
  );

  // Stable callback — never recreated when showSheet / isLookingUp change.
  // Uses refs and store.getState() to always read current values, avoiding
  // stale closures that caused the CameraView to miss the modal-open guard.
  const handleBarcodeScan = useCallback(
    async (result: BarcodeScanningResult) => {
      // isProcessing blocks any concurrent scan while a lookup is in flight.
      if (isProcessing.current) return;
      // showSheetRef is kept current on every render — no stale value risk.
      if (showSheetRef.current) return;

      isProcessing.current = true;
      try {
        const rawData = result.data;
        console.log('[POS] scanned:', rawData);

        // Legacy items encoded as: stocksnap://item/{sku}
        // New items encode the bare SKU:  SS-YYMM-3CHAR-5DIGITS  e.g. SS-2602-TEC-00001
        const urlMatch = rawData.match(/^stocksnap:\/\/item\/(.+)$/);
        const skuMatch = rawData.match(/^SS-\d{4}-[A-Z0-9]{3}-\d{5}$/);
        if (!urlMatch && !skuMatch) return;

        const sku = urlMatch ? urlMatch[1] : rawData.trim();

        // Read debounce state from the store directly — avoids stale closure.
        const {
          lastScannedSku,
          lastScanTime,
          setLastScannedSku,
        } = useAuthStore.getState();

        if (sku === lastScannedSku && Date.now() - lastScanTime < SCAN_DEBOUNCE_MS) {
          return;
        }

        setLastScannedSku(sku);
        await lookupBySku(sku);
      } catch (e) {
        console.error('[POS] scan error:', e);
      } finally {
        isProcessing.current = false;
      }
    },
    [lookupBySku]
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

  // Request camera permission after the component fully mounts.
  // Requesting immediately (or re-requesting on every permission change) causes
  // expo-camera to read its permissions plist before the native module has
  // finished initialising, producing a SIGABRT (NSMutableDictionary
  // initWithContentsOfFile) crash on the first launch after a cold start or
  // crash-recovery. The 500 ms delay lets the native layer settle first.
  // Empty deps is intentional — one request per mount, not per permission tick.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!IS_SIMULATOR) requestPermission().catch(() => setCameraError(true));
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-[#111827]">
      {/* ── CameraView at screen root ──────────────────────────────────────────
          CameraView must NOT live inside the Modal subtree, and must be
          unmounted before a Modal presents. When iOS presents a modal view
          controller, UIKit signals the active AVCaptureSession to suspend.
          expo-camera's native handler performs an NSMutableDictionary
          initWithContentsOfFile read during that callback. If the session is
          still running when the Modal animates in, that read races with the
          presentation and triggers SIGABRT.

          Fix: render CameraView once at the screen root, absolutely positioned
          behind all other views. Guard with !showSheet so the AVCaptureSession
          is fully stopped before the Modal becomes visible. When the sheet
          closes, the component remounts and the camera restarts.             */}
      {!IS_SIMULATOR && cameraAvailable && !showSheet ? (
        <CameraView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScan}
        />
      ) : null}

      {/* Green header */}
      <View className="bg-[#16A34A] px-4 pb-3 pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-white">POS Mode</Text>
          <Text className="font-mono text-sm text-white/80">{time}</Text>
        </View>
      </View>

      {/* Scan overlay / Manual Entry
          When cameraAvailable, the content View is transparent — the root-level
          CameraView (absolutely positioned behind everything) shows through.   */}
      {IS_SIMULATOR ? (
        // Simulator: CameraView is never rendered — manual SKU entry only.
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-10 text-center text-sm text-white opacity-50">
            Camera unavailable in simulator{'\n'}Use manual SKU entry below
          </Text>
          <View className="w-full flex-row gap-2">
            <TextInput
              className="min-h-[52px] flex-1 rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white"
              placeholder="Enter SKU (e.g. SS-2602-TEC-00001)"
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
        // Physical device — transparent overlay on top of the root CameraView.
        <View className="flex-1">
          {/* Scan frame */}
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

          {/* Manual entry at bottom */}
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
        </View>
      ) : (
        // Physical device without camera permission — manual entry fallback.
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
              placeholder="Enter SKU (e.g. SS-2602-TEC-00001)"
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
          <ErrorBoundary>
            {scannedItem ? (
              <SaleSheet
                item={scannedItem}
                isLoading={isSaleLoading}
                error={saleError}
                onConfirm={handleConfirmSale}
                onClose={handleCloseSheet}
              />
            ) : null}
          </ErrorBoundary>
        </View>
      </Modal>
    </View>
  );
}
