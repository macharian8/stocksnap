import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useItem } from '../../../../lib/useItem';
import { useAuthStore } from '../../../../store/auth';
import { useToastStore } from '../../../../store/toast';
import { PinPad } from '../../../../components/ui/PinPad';
import type { Item } from '../../../../types';

type Condition = Item['condition'];
type UnitOfMeasure = Item['unit_of_measure'];

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: 'New', value: 'new' },
  { label: 'Used', value: 'used' },
  { label: 'Refurbished', value: 'refurbished' },
];

const UNITS: { label: string; value: UnitOfMeasure }[] = [
  { label: 'Piece', value: 'piece' },
  { label: 'Pair', value: 'pair' },
  { label: 'Kg', value: 'kg' },
  { label: 'Metre', value: 'metre' },
  { label: 'Litre', value: 'litre' },
  { label: 'Other', value: 'other' },
];

interface FormData {
  title: string;
  category: string;
  condition: Condition;
  unitOfMeasure: UnitOfMeasure;
  buyPrice: string;
  sellPrice: string;
  floorPrice: string;
  ceilingPrice: string;
  quantity: string;
  reorderPoint: string;
}

function PickerRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-[#111827]">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 ${
              value === opt.value
                ? 'border-[#2563EB] bg-[#DBEAFE]'
                : 'border-[#E5E7EB] bg-white'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                value === opt.value ? 'text-[#2563EB]' : 'text-[#6B7280]'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PriceInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string | null;
  editable?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-[#111827]">{label}</Text>
      <View
        className={`flex-row items-center rounded-xl border bg-white px-4 ${
          error ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
        } ${!editable ? 'opacity-60' : ''}`}
      >
        <Text className="mr-2 text-sm text-[#6B7280]">KES</Text>
        <TextInput
          className="min-h-[48px] flex-1 text-base text-[#111827]"
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
          editable={editable}
        />
      </View>
      {error ? (
        <Text className="mt-1 text-xs text-[#DC2626]">{error}</Text>
      ) : null}
    </View>
  );
}

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isLoading, error: fetchError, updateItem } = useItem(id);
  const checkPin = useAuthStore((s) => s.checkPin);
  const showToast = useToastStore((s) => s.show);

  const [formInitialized, setFormInitialized] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: '',
    category: '',
    condition: 'new',
    unitOfMeasure: 'piece',
    buyPrice: '',
    sellPrice: '',
    floorPrice: '',
    ceilingPrice: '',
    quantity: '',
    reorderPoint: '3',
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Track if buy price was changed (requires PIN)
  const [originalBuyPrice, setOriginalBuyPrice] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState(false);

  // Initialize form from loaded item
  if (item && !formInitialized) {
    const initialForm: FormData = {
      title: item.title,
      category: item.category ?? '',
      condition: item.condition,
      unitOfMeasure: item.unit_of_measure,
      buyPrice: String(item.buy_price),
      sellPrice: String(item.sell_price),
      floorPrice: String(item.sell_price_floor),
      ceilingPrice: item.sell_price_ceiling !== null ? String(item.sell_price_ceiling) : '',
      quantity: String(item.quantity_in_stock),
      reorderPoint: String(item.reorder_point),
    };
    setForm(initialForm);
    setOriginalBuyPrice(String(item.buy_price));
    setFormInitialized(true);
  }

  const buyPriceChanged = useMemo(
    () => form.buyPrice !== originalBuyPrice,
    [form.buyPrice, originalBuyPrice]
  );

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaveError(null);
    },
    []
  );

  const validate = useCallback((): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.buyPrice || parseFloat(form.buyPrice) <= 0)
      errors.buyPrice = 'Must be greater than 0';
    if (!form.sellPrice || parseFloat(form.sellPrice) <= 0)
      errors.sellPrice = 'Must be greater than 0';
    if (!form.quantity || parseInt(form.quantity, 10) < 0)
      errors.quantity = 'Must be 0 or greater';

    const sell = parseFloat(form.sellPrice || '0');
    const floor = parseFloat(form.floorPrice || '0');
    const ceiling = form.ceilingPrice ? parseFloat(form.ceilingPrice) : null;

    if (floor > sell) errors.floorPrice = 'Floor must be ≤ sell price';
    if (ceiling !== null && ceiling < sell)
      errors.ceilingPrice = 'Ceiling must be ≥ sell price';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  const performSave = useCallback(async () => {
    if (!item) return;

    setIsSaving(true);
    setSaveError(null);

    const success = await updateItem({
      title: form.title.trim(),
      description: null,
      category: form.category.trim() || null,
      condition: form.condition,
      unit_of_measure: form.unitOfMeasure,
      buy_price: parseFloat(form.buyPrice),
      sell_price: parseFloat(form.sellPrice),
      sell_price_floor: parseFloat(form.floorPrice || form.sellPrice),
      sell_price_ceiling: form.ceilingPrice
        ? parseFloat(form.ceilingPrice)
        : null,
      quantity_in_stock: parseInt(form.quantity, 10),
      reorder_point: parseInt(form.reorderPoint, 10) || 3,
    });

    setIsSaving(false);

    if (success) {
      showToast('Item updated', 'success');
      router.back();
    } else {
      setSaveError('Failed to update item. Please try again.');
    }
  }, [item, form, updateItem, showToast]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    if (buyPriceChanged) {
      setShowPinModal(true);
      return;
    }

    await performSave();
  }, [validate, buyPriceChanged, performSave]);

  const handlePinComplete = useCallback(
    async (pin: string): Promise<boolean> => {
      const success = await checkPin(pin);
      if (success) {
        setShowPinModal(false);
        await performSave();
      }
      return success;
    },
    [checkPin, performSave]
  );

  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (fetchError || !item) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF] px-8">
        <Text className="mb-2 text-lg font-semibold text-[#111827]">
          Item not found
        </Text>
        <Text className="mb-6 text-center text-sm text-[#6B7280]">
          {fetchError ?? 'This item may have been deleted.'}
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
          title: 'Edit Item',
          headerStyle: { backgroundColor: '#EFF6FF' },
          headerTintColor: '#2563EB',
          headerTitleStyle: { color: '#111827', fontWeight: '700' },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-[#EFF6FF]"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image preview */}
          {item.image_url ? (
            <View className="mb-6 mt-4 items-center">
              <Image
                source={{ uri: item.image_url }}
                className="h-32 w-32 rounded-xl"
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* SKU (read-only) */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              SKU
            </Text>
            <View className="min-h-[48px] justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4">
              <Text className="text-base text-[#6B7280]">{item.sku}</Text>
            </View>
          </View>

          {/* Title */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Title *
            </Text>
            <TextInput
              className={`min-h-[48px] rounded-xl border bg-white px-4 text-base text-[#111827] ${
                formErrors.title ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
              }`}
              placeholder="e.g. Blue Running Shoes"
              placeholderTextColor="#9CA3AF"
              value={form.title}
              onChangeText={(t) => updateField('title', t)}
            />
            {formErrors.title ? (
              <Text className="mt-1 text-xs text-[#DC2626]">
                {formErrors.title}
              </Text>
            ) : null}
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Category
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
              placeholder="e.g. Footwear"
              placeholderTextColor="#9CA3AF"
              value={form.category}
              onChangeText={(t) => updateField('category', t)}
            />
          </View>

          {/* Condition */}
          <PickerRow
            label="Condition"
            options={CONDITIONS}
            value={form.condition}
            onChange={(v) => updateField('condition', v)}
          />

          {/* Unit of measure */}
          <PickerRow
            label="Unit of measure"
            options={UNITS}
            value={form.unitOfMeasure}
            onChange={(v) => updateField('unitOfMeasure', v)}
          />

          {/* Pricing */}
          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Pricing
          </Text>

          <PriceInput
            label="Cost Price *"
            value={form.buyPrice}
            onChangeText={(t) => updateField('buyPrice', t)}
            error={formErrors.buyPrice}
          />
          {buyPriceChanged ? (
            <View className="mb-3 -mt-2 rounded-lg bg-[#FEF3C7] px-3 py-2">
              <Text className="text-xs text-[#92400E]">
                PIN required to change cost price
              </Text>
            </View>
          ) : null}

          <PriceInput
            label="Default Sell Price *"
            value={form.sellPrice}
            onChangeText={(t) => updateField('sellPrice', t)}
            error={formErrors.sellPrice}
          />
          <PriceInput
            label="Floor Price"
            value={form.floorPrice}
            onChangeText={(t) => updateField('floorPrice', t)}
            placeholder="Same as sell price"
            error={formErrors.floorPrice}
          />
          <PriceInput
            label="Ceiling Price"
            value={form.ceilingPrice}
            onChangeText={(t) => updateField('ceilingPrice', t)}
            placeholder="Optional"
            error={formErrors.ceilingPrice}
          />

          {/* Stock */}
          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Stock
          </Text>

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Quantity in Stock
            </Text>
            <TextInput
              className={`min-h-[48px] rounded-xl border bg-white px-4 text-base text-[#111827] ${
                formErrors.quantity ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
              }`}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              value={form.quantity}
              onChangeText={(t) =>
                updateField('quantity', t.replace(/\D/g, ''))
              }
            />
            {formErrors.quantity ? (
              <Text className="mt-1 text-xs text-[#DC2626]">
                {formErrors.quantity}
              </Text>
            ) : null}
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Reorder alert at
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor="#9CA3AF"
              value={form.reorderPoint}
              onChangeText={(t) =>
                updateField('reorderPoint', t.replace(/\D/g, ''))
              }
            />
          </View>

          {/* Save error */}
          {saveError ? (
            <View className="mb-4 rounded-lg bg-[#FEE2E2] px-3 py-2">
              <Text className="text-sm text-[#DC2626]">{saveError}</Text>
            </View>
          ) : null}

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="mb-8 min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Save Changes
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PIN Confirmation Modal for buy_price changes */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePinCancel}
      >
        <SafeAreaView className="flex-1 bg-[#EFF6FF] px-8">
          <PinPad
            title="Confirm PIN"
            subtitle="PIN required to change cost price"
            accentColor="#2563EB"
            onComplete={handlePinComplete}
            onCancel={handlePinCancel}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
