import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import type { Item, PaymentMethod } from '../../types';
import { normalizeKenyanPhone, isValidKenyanPhone } from '../../lib/phone';
import { useToastStore } from '../../store/toast';

interface SaleSheetProps {
  item: Item;
  isLoading: boolean;
  error: string | null;
  onConfirm: (data: {
    price: number;
    quantity: number;
    paymentMethod: PaymentMethod;
    mpesaPhone: string | null;
    mpesaCode: string | null;
    notes: string | null;
  }) => void;
  onClose: () => void;
}

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'M-Pesa STK', value: 'mpesa_stk' },
  { label: 'M-Pesa Code', value: 'mpesa_till' },
  { label: 'Other', value: 'other' },
];

export function SaleSheet({
  item,
  isLoading,
  error,
  onConfirm,
  onClose,
}: SaleSheetProps) {
  const [price, setPrice] = useState(String(item.sell_price));
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [notes, setNotes] = useState('');
  const showToast = useToastStore((s) => s.show);

  const priceNum = useMemo(() => parseFloat(price) || 0, [price]);
  const total = useMemo(() => priceNum * quantity, [priceNum, quantity]);

  const priceError = useMemo(() => {
    if (priceNum < item.sell_price_floor) {
      return `Min price: KES ${item.sell_price_floor.toLocaleString()}`;
    }
    if (item.sell_price_ceiling !== null && priceNum > item.sell_price_ceiling) {
      return `Max price: KES ${item.sell_price_ceiling.toLocaleString()}`;
    }
    return null;
  }, [priceNum, item.sell_price_floor, item.sell_price_ceiling]);

  const stockColor = useMemo(() => {
    if (item.quantity_in_stock === 0) return '#DC2626';
    if (item.quantity_in_stock <= item.reorder_point) return '#D97706';
    return '#16A34A';
  }, [item.quantity_in_stock, item.reorder_point]);

  const handleIncrement = useCallback(() => {
    setQuantity((q) => q + 1);
  }, []);

  const handleDecrement = useCallback(() => {
    setQuantity((q) => Math.max(1, q - 1));
  }, []);

  const handleConfirm = useCallback(() => {
    if (priceError) return;

    // Validate payment-specific fields
    if (paymentMethod === 'mpesa_stk' && !isValidKenyanPhone(mpesaPhone)) {
      Alert.alert('Invalid Phone', 'Enter a valid Kenyan phone number.');
      return;
    }

    if (paymentMethod === 'mpesa_till') {
      const codeClean = mpesaCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(codeClean)) {
        Alert.alert(
          'Invalid Code',
          'M-Pesa transaction code must be 10 alphanumeric characters.'
        );
        return;
      }
    }

    // Warn if selling more than stock
    if (quantity > item.quantity_in_stock) {
      Alert.alert(
        'Low Stock Warning',
        `Only ${item.quantity_in_stock} in stock. Continue with ${quantity}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => submitSale(),
          },
        ]
      );
      return;
    }

    submitSale();
  }, [
    priceError,
    paymentMethod,
    mpesaPhone,
    mpesaCode,
    quantity,
    item.quantity_in_stock,
  ]);

  const submitSale = useCallback(() => {
    // STK push not yet implemented — fall back to cash and inform the user.
    if (paymentMethod === 'mpesa_stk') {
      showToast(
        'M-Pesa STK coming soon — recording as cash sale',
        'warning'
      );
      onConfirm({
        price: priceNum,
        quantity,
        paymentMethod: 'cash',
        mpesaPhone: null,
        mpesaCode: null,
        notes: notes.trim() || null,
      });
      return;
    }

    onConfirm({
      price: priceNum,
      quantity,
      paymentMethod,
      mpesaPhone: null,
      mpesaCode:
        paymentMethod === 'mpesa_till'
          ? mpesaCode.trim().toUpperCase()
          : null,
      notes: paymentMethod === 'other' && notes.trim() ? notes.trim() : null,
    });
  }, [priceNum, quantity, paymentMethod, mpesaCode, notes, onConfirm, showToast]);

  return (
    <View className="rounded-t-3xl bg-white px-6 pb-10 pt-4">
      {/* Drag indicator */}
      <View className="mb-4 items-center">
        <View className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Item info */}
        <View className="mb-4 flex-row items-center">
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              className="h-16 w-16 rounded-xl"
              contentFit="cover"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-xl bg-[#F3F4F6]">
              <Text className="text-2xl">📦</Text>
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text className="text-lg font-bold text-[#111827]" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="text-xs text-[#6B7280]">{item.sku}</Text>
          </View>
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: stockColor + '1A' }}
          >
            <Text className="text-xs font-semibold" style={{ color: stockColor }}>
              {item.quantity_in_stock} left
            </Text>
          </View>
        </View>

        {/* Price */}
        <View className="mb-4">
          <Text className="mb-1 text-sm font-medium text-[#111827]">
            Sale Price
          </Text>
          <View
            className={`flex-row items-center rounded-xl border bg-white px-4 ${
              priceError ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
            }`}
          >
            <Text className="mr-2 text-sm text-[#6B7280]">KES</Text>
            <TextInput
              className="min-h-[48px] flex-1 text-lg font-bold text-[#111827]"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
            />
          </View>
          {priceError ? (
            <Text className="mt-1 text-xs text-[#DC2626]">{priceError}</Text>
          ) : null}
        </View>

        {/* Quantity stepper */}
        <View className="mb-4">
          <Text className="mb-1 text-sm font-medium text-[#111827]">
            Quantity
          </Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={handleDecrement}
              className="h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
            >
              <Text className="text-xl font-bold text-[#6B7280]">−</Text>
            </Pressable>
            <Text className="min-w-[40px] text-center text-2xl font-bold text-[#111827]">
              {quantity}
            </Text>
            <Pressable
              onPress={handleIncrement}
              className="h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
            >
              <Text className="text-xl font-bold text-[#6B7280]">+</Text>
            </Pressable>
          </View>
        </View>

        {/* Total */}
        <View className="mb-5 rounded-xl bg-[#F0FDF4] p-4">
          <Text className="text-sm text-[#6B7280]">Total</Text>
          <Text className="text-2xl font-bold text-[#16A34A]">
            KES {total.toLocaleString()}
          </Text>
        </View>

        {/* Payment method */}
        <Text className="mb-2 text-sm font-medium text-[#111827]">
          Payment Method
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <Pressable
              key={pm.value}
              onPress={() => setPaymentMethod(pm.value)}
              className={`min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 ${
                paymentMethod === pm.value
                  ? 'border-[#16A34A] bg-[#DCFCE7]'
                  : 'border-[#E5E7EB] bg-white'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  paymentMethod === pm.value
                    ? 'text-[#15803D]'
                    : 'text-[#6B7280]'
                }`}
              >
                {pm.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Payment-specific fields */}
        {paymentMethod === 'mpesa_stk' ? (
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-[#111827]">
              Customer Phone
            </Text>
            <View className="flex-row items-center rounded-xl border border-[#E5E7EB] bg-white px-4">
              <Text className="mr-2 text-sm text-[#6B7280]">+254</Text>
              <TextInput
                className="min-h-[48px] flex-1 text-base text-[#111827]"
                keyboardType="phone-pad"
                placeholder="712 345 678"
                placeholderTextColor="#9CA3AF"
                value={mpesaPhone}
                onChangeText={setMpesaPhone}
                maxLength={13}
              />
            </View>
          </View>
        ) : null}

        {paymentMethod === 'mpesa_till' ? (
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-[#111827]">
              M-Pesa Transaction Code
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base uppercase text-[#111827]"
              placeholder="e.g. SJ45K7H2L9"
              placeholderTextColor="#9CA3AF"
              value={mpesaCode}
              onChangeText={setMpesaCode}
              maxLength={10}
              autoCapitalize="characters"
            />
          </View>
        ) : null}

        {paymentMethod === 'other' ? (
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-[#111827]">
              Notes
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
              placeholder="Payment details"
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View className="mb-4 rounded-lg bg-[#FEE2E2] px-3 py-2">
            <Text className="text-sm text-[#DC2626]">{error}</Text>
          </View>
        ) : null}

        {/* Confirm button */}
        <Pressable
          onPress={handleConfirm}
          disabled={isLoading || !!priceError}
          className="mb-3 min-h-[52px] items-center justify-center rounded-xl bg-[#16A34A] disabled:opacity-50"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Confirm Sale — KES {total.toLocaleString()}
            </Text>
          )}
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={onClose}
          disabled={isLoading}
          className="min-h-[44px] items-center justify-center"
        >
          <Text className="text-sm font-medium text-[#6B7280]">Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
